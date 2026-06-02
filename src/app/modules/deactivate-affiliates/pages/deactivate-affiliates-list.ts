import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ToastService } from '../../../core/service/toast.service';
import {
  AffiliateTransactionRow,
  DeactivationContext,
  InactivationAffiliateRow,
} from '../interfaces/deactivate-affiliates.interface';
import { DeactivateAffiliatesService } from '../services/deactivate-affiliates.service';

type InactivationTab = 'unpaid' | 'underpaid';

@Component({
  selector: 'app-deactivate-affiliates-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './deactivate-affiliates-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeactivateAffiliatesList implements OnInit {
  private readonly _deactivateAffiliatesService = inject(DeactivateAffiliatesService);
  private readonly _toastService = inject(ToastService);

  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly showConfirmationModal = signal(false);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly context = signal<DeactivationContext | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly activeTab = signal<InactivationTab>('unpaid');

  protected readonly unpaidAffiliates = signal<InactivationAffiliateRow[]>([]);
  protected readonly underpaidAffiliates = signal<InactivationAffiliateRow[]>([]);

  protected readonly isTransactionsModalOpen = signal(false);
  protected readonly isLoadingTransactions = signal(false);
  protected readonly transactionsError = signal<string | null>(null);
  protected readonly selectedAffiliateForDetail = signal<InactivationAffiliateRow | null>(null);
  protected readonly affiliateTransactions = signal<AffiliateTransactionRow[]>([]);

  protected readonly canDeactivateByDate = computed(() => {
    const context = this.context();
    if (!context) {
      return false;
    }

    return context.currentDay >= context.minDay && context.canDeactivateByDate;
  });

  protected readonly currentAffiliates = computed(() =>
    this.activeTab() === 'unpaid' ? this.unpaidAffiliates() : this.underpaidAffiliates(),
  );

  protected readonly totalItems = computed(() => this.currentAffiliates().length);

  protected readonly isDeactivateButtonDisabled = computed(
    () => this.selectedCount() === 0 || this.isLoading() || this.isSubmitting() || !this.canDeactivateByDate(),
  );
  protected readonly modalMessage = computed(
    () => `Se desactivarán ${this.selectedCount()} usuario(s), ¿desea continuar?`,
  );

  protected readonly selectedVisibleCount = computed(() =>
    this.currentAffiliates().filter((affiliate) => this.isSelected(affiliate.affiliateId)).length,
  );

  protected readonly allVisibleSelected = computed(() => {
    const visible = this.currentAffiliates();
    return visible.length > 0 && visible.every((affiliate) => this.selectedIds().includes(affiliate.affiliateId));
  });

  protected readonly someVisibleSelected = computed(() => {
    const visible = this.currentAffiliates();
    const selectedCount = visible.filter((affiliate) => this.selectedIds().includes(affiliate.affiliateId)).length;
    return selectedCount > 0 && selectedCount < visible.length;
  });

  protected readonly selectedCount = computed(() => this.selectedIds().length);

  ngOnInit(): void {
    this.loadData();
  }

  protected loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.selectedIds.set([]);

    forkJoin({
      context: this._deactivateAffiliatesService.getContext(),
      unpaid: this._deactivateAffiliatesService.getUnpaidAffiliates(),
      underpaid: this._deactivateAffiliatesService.getUnderpaidAffiliates(),
    }).subscribe({
      next: (response) => {
        this.context.set(response.context);
        this.unpaidAffiliates.set(response.unpaid);
        this.underpaidAffiliates.set(response.underpaid);
        this.isLoading.set(false);
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.isLoading.set(false);
      },
    });
  }

  protected changeTab(tab: InactivationTab): void {
    if (this.activeTab() === tab) {
      return;
    }

    this.activeTab.set(tab);
    this.selectedIds.set([]);
  }

  protected toggleRow(id: number, checked: boolean): void {
    const next = new Set(this.selectedIds());
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selectedIds.set(Array.from(next));
  }

  protected toggleVisibleRows(checked: boolean): void {
    const next = new Set(this.selectedIds());
    this.currentAffiliates().forEach((affiliate) => {
      if (checked) {
        next.add(affiliate.affiliateId);
      } else {
        next.delete(affiliate.affiliateId);
      }
    });
    this.selectedIds.set(Array.from(next));
  }

  protected isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  protected openConfirmationModal(): void {
    if (this.selectedCount() === 0) {
      return;
    }

    if (!this.canDeactivateByDate()) {
      const minDay = this.context()?.minDay;
      this._toastService.showError(
        minDay
          ? `La desactivación está habilitada únicamente si la fecha actual es mayor o igual al día ${minDay} de cada mes.`
          : 'La desactivación no está habilitada para la fecha actual.',
      );
      return;
    }

    this.showConfirmationModal.set(true);
  }

  protected cancelDeactivation(): void {
    this.showConfirmationModal.set(false);
  }

  protected confirmDeactivation(): void {
    const ids = [...this.selectedIds()];
    const selectedAtConfirmation = ids.length;

    if (selectedAtConfirmation === 0 || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    this._deactivateAffiliatesService.deactivateAffiliates(ids).subscribe({
      next: (response) => {
        this.showConfirmationModal.set(false);
        this.isSubmitting.set(false);
        this._toastService.showSuccess(
          response?.message || `${selectedAtConfirmation} usuarios fueron desactivados exitosamente.`,
        );
        this.loadData();
      },
      error: (error: Error) => {
        this.isSubmitting.set(false);
        this.showConfirmationModal.set(false);
        this._toastService.showError(error.message || 'No fue posible desactivar los afiliados seleccionados.');
      },
    });
  }

  protected openTransactionsModal(affiliate: InactivationAffiliateRow): void {
    this.selectedAffiliateForDetail.set(affiliate);
    this.isTransactionsModalOpen.set(true);
    this.isLoadingTransactions.set(true);
    this.transactionsError.set(null);
    this.affiliateTransactions.set([]);

    this._deactivateAffiliatesService.getAffiliateTransactions(affiliate.document).subscribe({
      next: (transactions) => {
        this.affiliateTransactions.set(transactions);
        this.isLoadingTransactions.set(false);
      },
      error: (error: Error) => {
        this.transactionsError.set(error.message);
        this.isLoadingTransactions.set(false);
      },
    });
  }

  protected closeTransactionsModal(): void {
    this.isTransactionsModalOpen.set(false);
    this.selectedAffiliateForDetail.set(null);
    this.affiliateTransactions.set([]);
    this.transactionsError.set(null);
  }

  protected trackById(_: number, item: InactivationAffiliateRow): number {
    return item.affiliateId;
  }

  protected trackByTransactionId(_: number, item: AffiliateTransactionRow): string {
    return item.transactionId;
  }
}
