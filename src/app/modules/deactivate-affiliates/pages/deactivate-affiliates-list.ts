import { ChangeDetectionStrategy, Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { ToastService } from '../../../core/service/toast.service';
import { PermissionService } from '../../../core/service/permission.service';
import { ConfigGeneralService } from '../../../core/service/config-general.service';
import { TokenService } from '../../../core/service/token.service';
import {
  AffiliateTransactionRow,
  DeactivateAffiliateFilters,
  DeactivateAffiliatesResponse,
  DeactivationContext,
  InactivationAffiliateRow,
} from '../interfaces/deactivate-affiliates.interface';
import { DeactivateAffiliatesService } from '../services/deactivate-affiliates.service';

type InactivationTab = 'unpaid' | 'underpaid';

@Component({
  selector: 'app-deactivate-affiliates-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deactivate-affiliates-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeactivateAffiliatesList implements OnInit {
  private readonly _deactivateAffiliatesService = inject(DeactivateAffiliatesService);
  private readonly _toastService = inject(ToastService);
  private readonly _configGeneralService = inject(ConfigGeneralService);
  private readonly _tokenService = inject(TokenService);
  private _permission = inject(PermissionService);
  private _toast = inject(ToastService);

  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly showConfirmationModal = signal(false);
  protected readonly isDeactivatingAll = signal(false);
  protected readonly showApprovePaymentModal = signal(false);
  protected readonly pendingApproveAffiliate = signal<InactivationAffiliateRow | null>(null);
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

  protected readonly showResultsModal = signal(false);
  protected readonly deactivationResult = signal<DeactivateAffiliatesResponse | null>(null);

  // Verifica si el usuario puede acceder al tab "Pagos Incompletos"
  protected readonly canViewUnderpaid = computed(() =>
    this._permission.can('view', '/desactivar-afiliados/pagos-incompletos')
  );

  // Verifica si el usuario puede desactivar afiliados en el tab actual
  protected readonly canDeactivateAffiliates = computed(() => {
    const path = this.activeTab() === 'unpaid'
      ? '/desactivar-afiliados/sin-pago'
      : '/desactivar-afiliados/pagos-incompletos';
    return this._permission.can('delete', path);
  });

  // ── Filtros (señales reactivas) ───────────────────────────────────
  protected readonly filterName = signal('');
  protected readonly filterDocument = signal('');
  protected readonly filterReference = signal('');
  protected readonly filterAdviser = signal('');
  protected readonly filterCompany = signal('');
  protected readonly filterGrouper = signal('');

  // ── Datos ───────────────────────────────────
  isDownloadingExcel = signal(false);
  readonly approvingPaymentId = signal<number | null>(null);
  readonly approvingTransactionId = signal<string | null>(null);
  readonly openDropdownId = signal<number | null>(null);
  readonly dropdownPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  // Paginación
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly canDeactivateByDate = computed(() => {
    const context = this.context();
    if (!context) return false;
    return context.currentDay >= context.minDay && context.canDeactivateByDate;
  });

  protected readonly allAffiliates = computed(() =>
    this.activeTab() === 'unpaid' ? this.unpaidAffiliates() : this.underpaidAffiliates(),
  );

  // ── Afiliados filtrados (filtro client-side reactivo) ─────────────
  protected readonly filteredAffiliates = computed(() => {
    const all = this.allAffiliates();
    const name = this.filterName().toLowerCase().trim();
    const document = this.filterDocument().toLowerCase().trim();
    const reference = this.filterReference().toLowerCase().trim();
    const adviser = this.filterAdviser().toLowerCase().trim();
    const company = this.filterCompany().toLowerCase().trim();
    const grouper = this.filterGrouper().toLowerCase().trim();

    if (!name && !document && !reference && !adviser && !company && !grouper) {
      return all;
    }

    return all.filter((a) => {
      if (name && !a.name?.toLowerCase().includes(name)) return false;
      if (document && !a.document?.toLowerCase().includes(document)) return false;
      if (reference && !a.reference?.toLowerCase().includes(reference)) return false;
      if (adviser && !a.advisor?.toLowerCase().includes(adviser)) return false;
      if (company && !a.company?.toLowerCase().includes(company)) return false;
      if (grouper && !a.grouper?.toLowerCase().includes(grouper)) return false;
      return true;
    });
  });

  protected readonly totalItems = computed(() => this.filteredAffiliates().length);
  protected readonly totalPages = computed(() =>
    Math.ceil((this.totalItems() || 1) / (this.pageSize() || 1))
  );

  protected readonly currentAffiliates = computed(() => {
    const all = this.filteredAffiliates();
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

  protected readonly modalMessage = computed(() =>
    this.isDeactivatingAll()
      ? `Se van a inhabilitar <strong>${this.totalItems()}</strong> afiliado(s) sin pago${this.hasActiveFilters() ? ' según los filtros activos' : ' del mes actual'}. ¿Desea continuar?`
      : `Se desactivarán <strong>${this.selectedCount()}</strong> afiliado(s) seleccionado(s). ¿Desea continuar?`
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

  protected readonly hasActiveFilters = computed(() =>
    !!(this.filterName() || this.filterDocument() || this.filterReference() || this.filterAdviser() || this.filterCompany() || this.filterGrouper())
  );


  ngOnInit(): void {
    this._configGeneralService.getValue('REGISTROS_POR_PAGINA').subscribe({
      next: (value) => {
        const pageSize = parseInt(value, 10);
        if (!isNaN(pageSize) && pageSize > 0) {
          this.pageSize.set(pageSize);
        }
        this.loadData();
      },
      error: () => {
        this.loadData();
      },
    });
  }

  // ── Setters de filtros ────────────────────────────────────────────
  protected setFilterName(value: string): void {
    this.filterName.set(value);
    this.currentPage.set(1);
  }

  protected setFilterDocument(value: string): void {
    this.filterDocument.set(value);
    this.currentPage.set(1);
  }

  protected setFilterReference(value: string): void {
    this.filterReference.set(value);
    this.currentPage.set(1);
  }

  protected setFilterAdviser(value: string): void {
    this.filterAdviser.set(value);
    this.currentPage.set(1);
  }

  protected setFilterCompany(value: string): void {
    this.filterCompany.set(value);
    this.currentPage.set(1);
  }

  protected setFilterGrouper(value: string): void {
    this.filterGrouper.set(value);
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.filterName.set('');
    this.filterDocument.set('');
    this.filterReference.set('');
    this.filterAdviser.set('');
    this.filterCompany.set('');
    this.filterGrouper.set('');
    this.currentPage.set(1);
  }

  // ── Carga de datos ────────────────────────────────────────────────
  protected loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.selectedIds.set([]);

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

  // ── Tabs ──────────────────────────────────────────────────────────
  protected changeTab(tab: InactivationTab): void {
    if (this.activeTab() === tab) return;

    const path = tab === 'unpaid'
      ? '/desactivar-afiliados/sin-pago'
      : '/desactivar-afiliados/pagos-incompletos';

    if (!this._permission.check('view', path, 'No tienes permiso para acceder a este módulo.')) {
      return;
    }

    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.selectedIds.set([]);
    this.clearFilters();
  }

  // ── Paginación ────────────────────────────────────────────────────
  protected previousPage(): void {
    if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
  }

  protected nextPage(): void {
    if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
  }

  protected goToPage(page: number): void {
    if (page > 0 && page <= this.totalPages()) this.currentPage.set(page);
  }

  // ── Selección ─────────────────────────────────────────────────────
  protected toggleRow(id: number, checked: boolean): void {
    const next = new Set(this.selectedIds());
    checked ? next.add(id) : next.delete(id);
    this.selectedIds.set(Array.from(next));
  }

  protected toggleVisibleRows(checked: boolean): void {
    const next = new Set(this.selectedIds());
    this.currentAffiliates().forEach((affiliate) => {
      checked ? next.add(affiliate.affiliateId) : next.delete(affiliate.affiliateId);
    });
    this.selectedIds.set(Array.from(next));
  }

  protected isSelected(id: number): boolean {
    return this.selectedIds().includes(id);
  }

  // ── Modal desactivación ───────────────────────────────────────────
  protected openConfirmationModal(): void {
    if (this.selectedCount() === 0) return;

    const path = this.activeTab() === 'unpaid'
      ? '/desactivar-afiliados/sin-pago'
      : '/desactivar-afiliados/pagos-incompletos';

    if (!this._permission.check('delete', path, 'Tu rol no tiene permiso para desactivar afiliados en este módulo.')) {
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
    this.isDeactivatingAll.set(false);
  }

  protected deactivateAll(): void {
    if (!this._permission.check('delete', '/desactivar-afiliados/sin-pago', 'Tu rol no tiene permiso para desactivar afiliados.')) return;
    if (!this.canDeactivateByDate()) {
      const minDay = this.context()?.minDay;
      this._toastService.showError(
        minDay
          ? `La desactivación está habilitada únicamente si la fecha actual es mayor o igual al día ${minDay} de cada mes.`
          : 'La desactivación no está habilitada para la fecha actual.',
      );
      return;
    }
    if (this.unpaidAffiliates().length === 0) {
      this._toastService.showInfo('No hay afiliados sin pago para inhabilitar.');
      return;
    }
    this.isDeactivatingAll.set(true);
    this.showConfirmationModal.set(true);
  }

  protected openApprovePaymentModal(affiliate: InactivationAffiliateRow): void {
    this.pendingApproveAffiliate.set(affiliate);
    this.showApprovePaymentModal.set(true);
  }

  protected cancelApprovePayment(): void {
    this.showApprovePaymentModal.set(false);
    this.pendingApproveAffiliate.set(null);
  }

  protected confirmApprovePayment(): void {
    const affiliate = this.pendingApproveAffiliate();
    if (!affiliate || this.approvingPaymentId() !== null) return;

    this.approvingPaymentId.set(affiliate.affiliateId);
    this.showApprovePaymentModal.set(false);

    this._deactivateAffiliatesService.approvePayment(affiliate.affiliateId, true).subscribe({
      next: () => {
        this.approvingPaymentId.set(null);
        this.pendingApproveAffiliate.set(null);
        this._toast.showSuccess('Pago aceptado');
        this.loadData();
      },
      error: (error: Error) => {
        this.approvingPaymentId.set(null);
        this.pendingApproveAffiliate.set(null);
        this._toast.showError(error.message || 'Error al aceptar el pago.');
      },
    });
  }

  protected confirmDeactivation(): void {
    if (this.isSubmitting()) return;

    this.isSubmitting.set(true);

    if (this.isDeactivatingAll()) {
      const filters = {
        name: this.filterName() || undefined,
        document: this.filterDocument() || undefined,
        reference: this.filterReference() || undefined,
        advisor: this.filterAdviser() || undefined,
        company: this.filterCompany() || undefined,
        grouper: this.filterGrouper() || undefined,
      };

      this._deactivateAffiliatesService.deactivateAllAffiliates(filters).subscribe({
        next: (response) => {
          this.showConfirmationModal.set(false);
          this.isDeactivatingAll.set(false);
          this.isSubmitting.set(false);
          this.handleDeactivationResponse(response);
        },
        error: (error: Error) => {
          this.isSubmitting.set(false);
          this.showConfirmationModal.set(false);
          this.isDeactivatingAll.set(false);
          this._toastService.showError(error.message || 'No fue posible inhabilitar los afiliados.');
        },
      });
      return;
    }

    const ids = [...this.selectedIds()];
    const selectedAtConfirmation = ids.length;

    if (selectedAtConfirmation === 0) {
      this.isSubmitting.set(false);
      return;
    }

    this._deactivateAffiliatesService.deactivateAffiliates(ids).subscribe({
      next: (response) => {
        this.showConfirmationModal.set(false);
        this.isDeactivatingAll.set(false);
        this.isSubmitting.set(false);
        this.handleDeactivationResponse(response);
      },
      error: (error: Error) => {
        this.isSubmitting.set(false);
        this.showConfirmationModal.set(false);
        this.isDeactivatingAll.set(false);
        this._toastService.showError(error.message || 'No fue posible desactivar los afiliados seleccionados.');
      },
    });
  }

  protected handleDeactivationResponse(response: DeactivateAffiliatesResponse): void {
    this.loadData();
    if (response.failed?.length > 0) {
      this.deactivationResult.set(response);
      this.showResultsModal.set(true);
    } else {
      this._toastService.showSuccess(response.message || 'Afiliados inhabilitados exitosamente.');
    }
  }

  protected closeResultsModal(): void {
    this.showResultsModal.set(false);
    this.deactivationResult.set(null);
    this.selectedIds.set([]);
  }

  // ── Modal transacciones ───────────────────────────────────────────
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

  protected toggleTransactionApproved(tx: AffiliateTransactionRow): void {
    if (this.approvingTransactionId() !== null) return;

    const newValue = !tx.isApproved;
    this.approvingTransactionId.set(tx.transactionId);

    this._deactivateAffiliatesService.approveTransaction(tx.transactionId, newValue).subscribe({
      next: () => {
        this.affiliateTransactions.update((rows) =>
          rows.map((r) => r.transactionId === tx.transactionId ? { ...r, isApproved: newValue } : r),
        );
        this.approvingTransactionId.set(null);
        this._toast.showSuccess(newValue ? 'Transacción aprobada' : 'Aprobación revertida');
        if (newValue) {
          this.loadData();
        }
      },
      error: (error: Error) => {
        this.approvingTransactionId.set(null);
        this._toast.showError(error.message || 'Error al actualizar el estado de la transacción.');
      },
    });
  }

  // ── Menú de acciones ─────────────────────────────────────────────
  protected toggleDropdown(id: number, buttonEl: HTMLElement): void {
    if (this.openDropdownId() === id) {
      this.openDropdownId.set(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    this.dropdownPos.set({ top: rect.bottom + 4, left: rect.left });
    this.openDropdownId.set(id);
  }

  protected closeDropdown(): void {
    this.openDropdownId.set(null);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openDropdownId.set(null);
  }

  // ── Utilidades ────────────────────────────────────────────────────
  protected trackById(_: number, item: InactivationAffiliateRow): number {
    return item.affiliateId;
  }

  protected trackByTransactionId(_: number, item: AffiliateTransactionRow): string {
    return item.transactionId;
  }

  protected formatDateColombia(dateString: string): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'America/Bogota',
      }).format(date);
    } catch {
      return dateString || '-';
    }
  }

  protected formatDateOnlyColumbia(dateString: string): string {
    if (!dateString) return '-';
    try {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
        const [year, month, day] = dateString.trim().split('-');
        return `${day}/${month}/${year}`;
      }
      if (/T00:00:00/.test(dateString)) {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
      }
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return new Intl.DateTimeFormat('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        timeZone: 'America/Bogota',
      }).format(date);
    } catch {
      return dateString || '-';
    }
  }

  protected formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  // ── Descargar Excel (solo tab sin pago) ──────────────────────────
  downloadExcel(): void {
    if (this.activeTab() !== 'unpaid') return;
    if (!this._permission.check('export', '/desactivar-afiliados/sin-pago', 'Tu rol no tiene permiso para descargar reportes en Excel.')) return;
    if (this.totalItems() === 0) {
      this._toastService.showInfo('No hay resultados para descargar con los filtros actuales.');
      return;
    }

    this.isDownloadingExcel.set(true);
    this.errorMessage.set(null);
    this._toast.showInfo('Descarga en proceso...');

    const exportFilters: DeactivateAffiliateFilters = {
      name: this.filterName() || undefined,
      document: this.filterDocument() || undefined,
      reference: this.filterReference() || undefined,
      advisor: this.filterAdviser() || undefined,
      company: this.filterCompany() || undefined,
      grouper: this.filterGrouper() || undefined,
    };

    this._deactivateAffiliatesService.exportToExcel(this.activeTab(), exportFilters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        const tabName = this.activeTab() === 'unpaid' ? 'sin_pago' : 'pago_incompleto';
        link.download = `afiliados_${tabName}_${timestamp}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.isDownloadingExcel.set(false);
        this._toast.showSuccess('Excel descargado exitosamente');
      },
      error: (error) => {
        this.isDownloadingExcel.set(false);
        this._toast.showError(error?.message ?? 'Error al descargar el Excel. Intenta de nuevo.');
      },
    });
  }
}
