import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillingPeriodsService } from '../../services/billing-periods.service';
import { BillingPeriod } from '../../interfaces/billing-period.interface';
import { BillingPeriodFilters } from '../../interfaces/billing-period-filters.interface';
import { SiigoInvoicePayload } from '../../interfaces/siigo-invoice-payload.interface';
import { BillingPeriodFiltersComponent } from '../../components/billing-period-filters/billing-period-filters';
import { SendToSiigoModalComponent } from '../../components/send-to-siigo-modal/send-to-siigo-modal';
import { ToastService } from '../../../../core/service/toast.service';

@Component({
  selector: 'app-billing-periods-list',
  standalone: true,
  imports: [CommonModule, BillingPeriodFiltersComponent, SendToSiigoModalComponent],
  templateUrl: './billing-periods-list.html',
})
export class BillingPeriodsListComponent {
  private _service = inject(BillingPeriodsService);
  private _toastService = inject(ToastService);

  showSendModal = signal(false);
  isLoadingPayload = signal(false);
  selectedPayload = signal<SiigoInvoicePayload | null>(null);
  private selectedPeriodId: number | null = null;

  readonly pageSize = 10;

  billingPeriods = signal<BillingPeriod[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  hasSearched = signal(false);
  currentFilters?: BillingPeriodFilters;

  currentPage = signal(1);
  totalPages = signal(0);
  totalItems = signal(0);

  private readonly monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];

  private readonly statusLabels: Record<string, string> = {
    PENDING: 'Pendiente envío',
    INVOICED: 'Enviado',
    ERROR: 'Error',
  };

  onFilterApplied(filters: BillingPeriodFilters): void {
    this.currentFilters = filters;
    this.hasSearched.set(true);
    this.currentPage.set(1);
    this.loadBillingPeriods(1);
  }

  loadBillingPeriods(page: number = this.currentPage()): void {
    if (!this.currentFilters) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._service.getPaginatedBillingPeriods(this.currentFilters, page, this.pageSize).subscribe({
      next: (response) => {
        this.billingPeriods.set(response.data);
        this.currentPage.set(response.page);
        this.totalPages.set(response.totalPages);
        this.totalItems.set(response.total);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.message ?? 'No fue posible cargar los periodos de facturación');
        this.isLoading.set(false);
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadBillingPeriods(page);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }

  monthLabel(month: number): string {
    return this.monthNames[month - 1] ?? String(month);
  }

  statusLabel(status: string): string {
    return this.statusLabels[status] ?? status;
  }

  onSendToSiigo(period: BillingPeriod): void {
    this.selectedPeriodId = period.id;
    this.isLoadingPayload.set(true);
    this.selectedPayload.set(null);
    this.showSendModal.set(true);
    this.fetchPayloadPreview(period.id, 0, { closeModalOnMismatch: true });
  }

  onMoraChanged(mora: number): void {
    if (this.selectedPeriodId === null) return;
    this.fetchPayloadPreview(this.selectedPeriodId, mora, { closeModalOnMismatch: false });
  }

  private fetchPayloadPreview(periodId: number, mora: number, options: { closeModalOnMismatch: boolean }): void {
    this.isLoadingPayload.set(true);

    this._service.getSiigoInvoicePayloadPreview(periodId, mora).subscribe({
      next: (preview) => {
        this.isLoadingPayload.set(false);
        if (!preview.hasMatch || !preview.payload) {
          if (options.closeModalOnMismatch) {
            this.showSendModal.set(false);
            this._toastService.showError('Este pago no coincide con ninguna regla de pricing de Siigo y no puede enviarse.');
          }
          return;
        }
        this.selectedPayload.set(preview.payload);
      },
      error: (err) => {
        this.isLoadingPayload.set(false);
        if (options.closeModalOnMismatch) {
          this.showSendModal.set(false);
        }
        this._toastService.showError(err?.message ?? 'No fue posible preparar el envío a Siigo');
      },
    });
  }

  onConfirmSendToSiigo(): void {
    // Envío simulado: no se llama realmente a la API de Siigo.
    this.showSendModal.set(false);
    this.selectedPayload.set(null);
    this.selectedPeriodId = null;
    this._toastService.showSuccess('Información enviada a Siigo correctamente');
  }

  onCancelSendToSiigo(): void {
    this.showSendModal.set(false);
    this.selectedPayload.set(null);
    this.selectedPeriodId = null;
  }

  clientLabel(period: BillingPeriod): string {
    const client = period.affiliation?.client;
    return client ? `${client.fullName} (${client.documentNumber})` : `Afiliación #${period.affiliationId}`;
  }
}
