import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { ToastService } from '../../../core/service/toast.service';
import { PermissionService } from '../../../core/service/permission.service';
import { ConfigGeneralService } from '../../../core/service/config-general.service';
import { TokenService } from '../../../core/service/token.service';
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
  private readonly _permissionService = inject(PermissionService);
  private readonly _configGeneralService = inject(ConfigGeneralService);
  private readonly _tokenService = inject(TokenService);

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

  // Verifica si el usuario puede acceder al tab "Pagos Incompletos"
  protected readonly canViewUnderpaid = computed(() =>
    this._permissionService.can('view', '/desactivar-afiliados/pagos-incompletos')
  );

  // Verifica si el usuario puede desactivar afiliados en el tab actual
  protected readonly canDeactivateAffiliates = computed(() => {
    const path = this.activeTab() === 'unpaid'
      ? '/desactivar-afiliados/sin-pago'
      : '/desactivar-afiliados/pagos-incompletos';
    return this._permissionService.can('delete', path);
  });

  // Paginación
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly canDeactivateByDate = computed(() => {
    const context = this.context();
    if (!context) {
      return false;
    }

    return context.currentDay >= context.minDay && context.canDeactivateByDate;
  });

  protected readonly allAffiliates = computed(() =>
    this.activeTab() === 'unpaid' ? this.unpaidAffiliates() : this.underpaidAffiliates(),
  );

  protected readonly totalItems = computed(() => this.allAffiliates().length);

  protected readonly totalPages = computed(() =>
    Math.ceil(this.totalItems() / this.pageSize())
  );

  protected readonly currentAffiliates = computed(() => {
    const all = this.allAffiliates();
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return all.slice(start, end);
  });

  protected get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
  }

  protected readonly isDeactivateButtonDisabled = computed(
    () => this.selectedCount() === 0 || this.isLoading() || this.isSubmitting() || !this.canDeactivateByDate() || !this.canDeactivateAffiliates(),
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
    // Debug: Verificar permisos del usuario
    const user = this._tokenService.getUser();

    // Cargar la configuración de paginación desde la base de datos
    this._configGeneralService.getValue('REGISTROS_POR_PAGINA').subscribe({
      next: (value) => {
        const pageSize = parseInt(value, 10);
        if (!isNaN(pageSize) && pageSize > 0) {
          this.pageSize.set(pageSize);
        }
        this.loadData();
      },
      error: (error) => {
        console.error('Error al cargar configuración de paginación:', error);
        // Si falla, continuar con el valor por defecto (10)
        this.loadData();
      },
    });
  }

  protected loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.selectedIds.set([]);

    // Solo carga underpaid si el usuario tiene permiso
    const underpaidRequest = this.canViewUnderpaid()
      ? this._deactivateAffiliatesService.getUnderpaidAffiliates()
      : of([]);

    forkJoin({
      context: this._deactivateAffiliatesService.getContext(),
      unpaid: this._deactivateAffiliatesService.getUnpaidAffiliates(),
      underpaid: underpaidRequest,
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

    // Verifica permisos antes de cambiar de tab
    const path = tab === 'unpaid'
      ? '/desactivar-afiliados/sin-pago'
      : '/desactivar-afiliados/pagos-incompletos';

    if (!this._permissionService.check('view', path, `No tienes permiso para acceder a este módulo.`)) {
      return;
    }

    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.selectedIds.set([]);
  }

  protected previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  protected goToPage(page: number): void {
    if (page > 0 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
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

    // Verificar permisos de desactivación
    const path = this.activeTab() === 'unpaid'
      ? '/desactivar-afiliados/sin-pago'
      : '/desactivar-afiliados/pagos-incompletos';

    if (!this._permissionService.check('delete', path, 'Tu rol no tiene permiso para desactivar afiliados en este módulo.')) {
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
