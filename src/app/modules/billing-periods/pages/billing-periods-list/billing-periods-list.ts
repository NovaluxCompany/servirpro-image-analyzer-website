import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BillingPeriodsService } from '../../services/billing-periods.service';
import { BillingPeriod } from '../../interfaces/billing-period.interface';
import { BillingPeriodFilters } from '../../interfaces/billing-period-filters.interface';
import { SiigoInvoicePayload, SiigoInvoicePricingBreakdown } from '../../interfaces/siigo-invoice-payload.interface';
import { BillingPeriodFiltersComponent } from '../../components/billing-period-filters/billing-period-filters';
import { SendToSiigoModalComponent } from '../../components/send-to-siigo-modal/send-to-siigo-modal';
import { ToastService } from '../../../../core/service/toast.service';
import { ConfigGeneralService } from '../../../../core/service/config-general.service';
import { PageSizeControlComponent, REGISTROS_POR_PAGINA_KEY, MIN_PAGE_SIZE } from '../../../../shared/components/page-size-control/page-size-control';
import { TableScrollComponent } from '../../../../shared/components/table-scroll/table-scroll';

@Component({
  selector: 'app-billing-periods-list',
  standalone: true,
  imports: [CommonModule, BillingPeriodFiltersComponent, SendToSiigoModalComponent, PageSizeControlComponent, TableScrollComponent],
  templateUrl: './billing-periods-list.html',
})
export class BillingPeriodsListComponent implements OnInit {
  private _service = inject(BillingPeriodsService);
  private _toastService = inject(ToastService);
  private _configGeneralService = inject(ConfigGeneralService);

  isDownloadingExcel = signal(false);

  showSendModal = signal(false);
  isLoadingPayload = signal(false);
  selectedPayload = signal<SiigoInvoicePayload | null>(null);
  selectedPricingBreakdown = signal<SiigoInvoicePricingBreakdown | null>(null);
  private selectedPeriodId: number | null = null;

  pageSize = signal(MIN_PAGE_SIZE);

  billingPeriods = signal<BillingPeriod[]>([]);
  isLoading = signal(false);
  hasSearched = signal(false);
  currentFilters?: BillingPeriodFilters;

  currentPage = signal(1);
  totalPages = signal(0);
  totalItems = signal(0);

  ngOnInit(): void {
    this._configGeneralService.getValue(REGISTROS_POR_PAGINA_KEY).subscribe({
      next: (value) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed >= MIN_PAGE_SIZE) this.pageSize.set(parsed);
      },
      error: () => {},
    });
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    if (this.currentFilters) this.loadBillingPeriods(1);
  }

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

  onFiltersCleared(): void {
    this.currentFilters = undefined;
    this.hasSearched.set(false);
    this.billingPeriods.set([]);
    this.currentPage.set(1);
    this.totalPages.set(0);
    this.totalItems.set(0);
  }

  loadBillingPeriods(page: number = this.currentPage()): void {
    if (!this.currentFilters) return;

    this.isLoading.set(true);
    this._service.getPaginatedBillingPeriods(this.currentFilters, page, this.pageSize()).subscribe({
      next: (response) => {
        this.billingPeriods.set(response.data);
        this.currentPage.set(response.page);
        this.totalPages.set(response.totalPages);
        this.totalItems.set(response.total);
        this.isLoading.set(false);
      },
      error: (err) => {
        this._toastService.showError(err?.message ?? 'No fue posible cargar los periodos de facturación');
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
    this.selectedPricingBreakdown.set(null);
    this.showSendModal.set(true);
    this.fetchPayloadPreview(period.id, 0, { closeModalOnMismatch: true });
  }

  onLateFeeChanged(lateFee: number): void {
    if (this.selectedPeriodId === null) return;
    this.fetchPayloadPreview(this.selectedPeriodId, lateFee, { closeModalOnMismatch: false });
  }

  private fetchPayloadPreview(periodId: number, lateFee: number, options: { closeModalOnMismatch: boolean }): void {
    this.isLoadingPayload.set(true);

    this._service.getSiigoInvoicePayloadPreview(periodId, lateFee).subscribe({
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
        this.selectedPricingBreakdown.set(preview.pricingBreakdown);
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

  onConfirmSendToSiigo(request: { lateFee: number; observations: string }): void {
    if (this.selectedPeriodId === null) return;
    const periodId = this.selectedPeriodId;

    this.isLoadingPayload.set(true);
    this._service.sendToSiigo(periodId, request).subscribe({
      next: () => {
        this.isLoadingPayload.set(false);
        this.showSendModal.set(false);
        this.selectedPayload.set(null);
        this.selectedPricingBreakdown.set(null);
        this.selectedPeriodId = null;
        this._toastService.showSuccess('Factura creada en Siigo correctamente');
        this.loadBillingPeriods();
      },
      error: (err) => {
        this.isLoadingPayload.set(false);
        this._toastService.showError(err?.message ?? 'No fue posible crear la factura en Siigo');
      },
    });
  }

  onCancelSendToSiigo(): void {
    this.showSendModal.set(false);
    this.selectedPayload.set(null);
    this.selectedPricingBreakdown.set(null);
    this.selectedPeriodId = null;
  }

  clientLabel(period: BillingPeriod): string {
    const client = period.affiliation?.client;
    return client ? `${client.fullName} (${client.documentNumber})` : `Afiliación #${period.affiliationId}`;
  }

  downloadExcel(): void {
    if (!this.currentFilters) return;

    this.isDownloadingExcel.set(true);
    this._toastService.showInfo('Descarga en proceso...');

    this._service.exportToExcel(this.currentFilters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `periodos-facturacion_${timestamp}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.isDownloadingExcel.set(false);
        this._toastService.showSuccess('Excel descargado exitosamente');
      },
      error: (err) => {
        this.isDownloadingExcel.set(false);
        this._toastService.showError(err?.message ?? 'No fue posible descargar el Excel');
      },
    });
  }
}
