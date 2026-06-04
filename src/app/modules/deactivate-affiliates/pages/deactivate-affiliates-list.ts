import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/service/toast.service';
import {
  DeactivateAffiliateRow,
  DeactivationContext,
} from '../interfaces/deactivate-affiliates.interface';
import { DeactivateAffiliatesService } from '../services/deactivate-affiliates.service';

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

  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly showConfirmationModal = signal(false);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly context = signal<DeactivationContext | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly affiliates = signal<DeactivateAffiliateRow[]>([]);

  protected readonly canDeactivateByDate = computed(() => {
    const context = this.context();
    if (!context) {
      return false;
    }

    return context.currentDay >= context.minDay && context.canDeactivateByDate;
  });
  protected readonly isDeactivateButtonDisabled = computed(
    () => this.selectedCount() === 0 || this.isLoading() || this.isSubmitting() || !this.canDeactivateByDate(),
  );
  protected readonly modalMessage = computed(
    () => `Se desactivarán ${this.selectedCount()} usuario(s), ¿desea continuar?`,
  );

  protected readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];

    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }

    return range;
  });

  protected readonly selectedVisibleCount = computed(() =>
    this.affiliates().filter((affiliate) => this.isSelected(affiliate.id)).length,
  );

  protected readonly allVisibleSelected = computed(() => {
    const visible = this.affiliates();
    return visible.length > 0 && visible.every((affiliate) => this.selectedIds().includes(affiliate.id));
  });

  protected readonly someVisibleSelected = computed(() => {
    const visible = this.affiliates();
    const selectedCount = visible.filter((affiliate) => this.selectedIds().includes(affiliate.id)).length;
    return selectedCount > 0 && selectedCount < visible.length;
  });

  protected readonly selectedCount = computed(() => this.selectedIds().length);

  ngOnInit(): void {
    this.loadAffiliates(1);
  }

  protected loadAffiliates(page: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._deactivateAffiliatesService.getActiveAffiliates(page).subscribe({
      next: (response) => {
        const safeTotalPages = Math.max(1, response.totalPages || 1);

        if (response.page > safeTotalPages) {
          this.loadAffiliates(safeTotalPages);
          return;
        }

        this.affiliates.set(response.data);
        this.totalItems.set(response.total);
        this.currentPage.set(response.page);
        this.totalPages.set(safeTotalPages);
        this.context.set(response.context);
        this.selectedIds.set([]);
        this.isLoading.set(false);
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message);
        this.isLoading.set(false);
      },
    });
  }

  protected goToPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.totalPages());
    if (nextPage === this.currentPage()) {
      return;
    }

    this.loadAffiliates(nextPage);
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
    this.affiliates().forEach((affiliate) => {
      if (checked) {
        next.add(affiliate.id);
      } else {
        next.delete(affiliate.id);
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
        this.loadAffiliates(this.currentPage());
      },
      error: (error: Error) => {
        this.isSubmitting.set(false);
        this.showConfirmationModal.set(false);
        this._toastService.showError(error.message || 'No fue posible desactivar los afiliados seleccionados.');
      },
    });
  }

  protected trackById(_: number, item: DeactivateAffiliateRow): number {
    return item.id;
  }
}
