import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BillingPeriodsService } from '../../services/billing-periods.service';
import { BillingPeriod } from '../../interfaces/billing-period.interface';
import { BillingPeriodFilters } from '../../interfaces/billing-period-filters.interface';
import { SiigoInvoicePayload, SiigoInvoicePricingBreakdown } from '../../interfaces/siigo-invoice-payload.interface';
import { BillingPeriodFiltersComponent } from '../../components/billing-period-filters/billing-period-filters';
import { SendToSiigoModalComponent } from '../../components/send-to-siigo-modal/send-to-siigo-modal';
import {
  BulkSendToSiigoModalComponent,
  BulkSendRow,
  BULK_STATUS_WAITING_USER,
  BULK_STATUS_WAITING_SEND,
} from '../../components/bulk-send-to-siigo-modal/bulk-send-to-siigo-modal';
import { ToastService } from '../../../../core/service/toast.service';
import { ConfigGeneralService } from '../../../../core/service/config-general.service';
import { PageSizeControlComponent, REGISTROS_POR_PAGINA_KEY, MIN_PAGE_SIZE } from '../../../../shared/components/page-size-control/page-size-control';
import { TableScrollComponent } from '../../../../shared/components/table-scroll/table-scroll';

@Component({
  selector: 'app-billing-periods-list',
  standalone: true,
  imports: [CommonModule, BillingPeriodFiltersComponent, SendToSiigoModalComponent, BulkSendToSiigoModalComponent, PageSizeControlComponent, TableScrollComponent],
  templateUrl: './billing-periods-list.html',
})
export class BillingPeriodsListComponent implements OnInit {
  private _service = inject(BillingPeriodsService);
  private _toastService = inject(ToastService);
  private _configGeneralService = inject(ConfigGeneralService);

  isDownloadingExcel = signal(false);

  showSendModal = signal(false);
  isLoadingPayload = signal(false);
  isSavingLateFee = signal(false);
  selectedPayload = signal<SiigoInvoicePayload | null>(null);
  selectedPricingBreakdown = signal<SiigoInvoicePricingBreakdown | null>(null);
  selectedPeriodIsUncertain = signal(false);
  selectedPeriodLateFee = signal(0);
  private selectedPeriodId: number | null = null;

  showBulkModal = signal(false);
  isLoadingBulkRows = signal(false);
  isSendingBulk = signal(false);
  bulkRows = signal<BulkSendRow[]>([]);
  selectedForBulk = signal<Set<number>>(new Set());

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
    UNCERTAIN: '⚠ Verificar en Siigo',
    // Periodo incluido en un lote que Siigo ya aceptó; el resultado real
    // llega después por webhook. No es un error: es la espera normal.
    SENDING: '⏳ Enviando (lote Siigo)',
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
    this.selectedForBulk.set(new Set());
  }

  loadBillingPeriods(page: number = this.currentPage()): void {
    if (!this.currentFilters) return;

    this.isLoading.set(true);
    this.selectedForBulk.set(new Set());
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

  sendButtonLabel(period: BillingPeriod): string {
    return period.siigoInvoiceStatus === 'UNCERTAIN' ? 'Verificar / Reintentar' : 'Enviar a Siigo';
  }

  onSendToSiigo(period: BillingPeriod): void {
    this.selectedPeriodId = period.id;
    this.selectedPeriodIsUncertain.set(period.siigoInvoiceStatus === 'UNCERTAIN');
    this.selectedPeriodLateFee.set(Number(period.lateFee) || 0);
    this.isLoadingPayload.set(true);
    this.selectedPayload.set(null);
    this.selectedPricingBreakdown.set(null);
    this.showSendModal.set(true);
    this.fetchPayloadPreview(period.id, Number(period.lateFee) || 0, { closeModalOnMismatch: true });
  }

  onSaveLateFee(lateFee: number): void {
    if (this.selectedPeriodId === null) return;
    const periodId = this.selectedPeriodId;

    this.isSavingLateFee.set(true);
    this._service.saveLateFee(periodId, lateFee).subscribe({
      next: () => {
        this.isSavingLateFee.set(false);
        this.selectedPeriodLateFee.set(lateFee);
        this._toastService.showSuccess('Mora guardada correctamente');
        this.loadBillingPeriods();
        this.fetchPayloadPreview(periodId, lateFee, { closeModalOnMismatch: false });
      },
      error: (err) => {
        this.isSavingLateFee.set(false);
        this._toastService.showError(err?.message ?? 'No fue posible guardar la mora');
      },
    });
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
        this.selectedPeriodIsUncertain.set(false);
        this.selectedPeriodLateFee.set(0);
        this.selectedPeriodId = null;
        this._toastService.showSuccess('Factura creada en Siigo correctamente');
        this.loadBillingPeriods();
      },
      error: (err) => {
        this.isLoadingPayload.set(false);
        this._toastService.showError(err?.message ?? 'No fue posible crear la factura en Siigo');
        // El backend ya marcó el periodo como UNCERTAIN o ERROR según el
        // caso; se refresca la tabla en segundo plano (sin cerrar el modal)
        // para que la fila muestre el estado real si el usuario decide
        // cerrar el modal en vez de reintentar.
        this.loadBillingPeriods();
      },
    });
  }

  onCancelSendToSiigo(): void {
    this.showSendModal.set(false);
    this.selectedPayload.set(null);
    this.selectedPricingBreakdown.set(null);
    this.selectedPeriodIsUncertain.set(false);
    this.selectedPeriodLateFee.set(0);
    this.selectedPeriodId = null;
  }

  clientLabel(period: BillingPeriod): string {
    const client = period.affiliation?.client;
    return client ? `${client.fullName} (${client.documentNumber})` : `Afiliación #${period.affiliationId}`;
  }

  // Un periodo solo puede seleccionarse para el envío masivo si cumple con
  // una regla de pricing (mismo plan/grouper/categoría de la tabla
  // siigo_pricing_rules) y no fue ya facturado — misma condición que
  // habilita el botón individual "Enviar a Siigo".
  isEligibleForBulk(period: BillingPeriod): boolean {
    // SENDING queda fuera: el periodo ya está en un lote aceptado por Siigo,
    // esperando el webhook con el resultado real — reenviarlo ahora solo
    // duplicaría la espera (aunque sería seguro por la Idempotency-Key).
    return !!period.hasSiigoMatch && period.siigoInvoiceStatus !== 'INVOICED' && period.siigoInvoiceStatus !== 'SENDING';
  }

  isSelectedForBulk(period: BillingPeriod): boolean {
    return this.selectedForBulk().has(period.id);
  }

  toggleBulkSelection(period: BillingPeriod): void {
    if (!this.isEligibleForBulk(period)) return;
    this.selectedForBulk.update((current) => {
      const next = new Set(current);
      if (next.has(period.id)) {
        next.delete(period.id);
      } else {
        next.add(period.id);
      }
      return next;
    });
  }

  selectedBulkCount(): number {
    return this.selectedForBulk().size;
  }

  private eligiblePeriodsOnPage(): BillingPeriod[] {
    return this.billingPeriods().filter((p) => this.isEligibleForBulk(p));
  }

  isAllEligibleSelected(): boolean {
    const eligible = this.eligiblePeriodsOnPage();
    return eligible.length > 0 && eligible.every((p) => this.selectedForBulk().has(p.id));
  }

  toggleSelectAllEligible(): void {
    const eligible = this.eligiblePeriodsOnPage();
    if (eligible.length === 0) return;

    const allSelected = this.isAllEligibleSelected();
    this.selectedForBulk.update((current) => {
      const next = new Set(current);
      for (const period of eligible) {
        if (allSelected) {
          next.delete(period.id);
        } else {
          next.add(period.id);
        }
      }
      return next;
    });
  }

  hasBulkEligiblePeriods(): boolean {
    return this.selectedBulkCount() >= 2;
  }

  private selectedPeriodsForBulk(): BillingPeriod[] {
    const selectedIds = this.selectedForBulk();
    return this.billingPeriods().filter((p) => selectedIds.has(p.id));
  }

  onOpenBulkSend(): void {
    const selected = this.selectedPeriodsForBulk();
    if (selected.length < 2) {
      this._toastService.showError('Selecciona al menos 2 afiliados para enviar a Siigo de forma masiva.');
      return;
    }

    this.showBulkModal.set(true);
    this.isLoadingBulkRows.set(true);
    this.bulkRows.set([]);

    const previews$ = selected.map((period) =>
      this._service.getSiigoInvoicePayloadPreview(period.id, Number(period.lateFee) || 0).pipe(
        catchError(() => of(null)),
      ),
    );

    forkJoin(previews$).subscribe((previews) => {
      const rows: BulkSendRow[] = selected.map((period, index) => ({
        periodId: period.id,
        affiliateName: this.clientLabel(period),
        lateFee: Number(period.lateFee) || 0,
        valueToSend: previews[index]?.pricingBreakdown?.total ?? null,
        status: BULK_STATUS_WAITING_USER,
      }));
      this.bulkRows.set(rows);
      this.isLoadingBulkRows.set(false);
    });
  }

  onBulkConfirmed(periodIds: number[]): void {
    this.bulkRows.update((rows) => rows.map((r) => ({ ...r, status: BULK_STATUS_WAITING_SEND })));
    this.isSendingBulk.set(true);

    this._service.sendToSiigoBulk(periodIds).subscribe({
      next: (result) => {
        this.isSendingBulk.set(false);
        const statusByPeriodId = new Map(result.results.map((r) => [r.id, r]));
        this.bulkRows.update((rows) =>
          rows.map((r) => {
            const item = statusByPeriodId.get(r.periodId);
            if (!item) return r;
            let status: string;
            if (item.status === 'INVOICED') {
              status = 'Enviado';
            } else if (item.status === 'SENDING') {
              // Siigo procesa el lote de forma asíncrona: esto solo confirma
              // que lo aceptó, no que la factura ya se creó. El resultado
              // real llega después por webhook (ver loadBillingPeriods()).
              status = 'Enviado a Siigo, esperando confirmación...';
            } else {
              status = `Error: ${item.errorMessage ?? 'No fue posible enviar la factura'}`;
            }
            return { ...r, status };
          }),
        );

        if (result.queued > 0) {
          this._toastService.showInfo(
            `${result.queued} factura(s) enviada(s) a Siigo en lote, esperando confirmación` +
              (result.failed > 0 ? `. ${result.failed} con error inmediato.` : '.'),
          );
        } else {
          this._toastService.showSuccess(`Se enviaron ${result.succeeded} facturas de ${result.total}`);
        }
        this.selectedForBulk.set(new Set());
        this.loadBillingPeriods();
      },
      error: (err) => {
        this.isSendingBulk.set(false);
        this._toastService.showError(err?.message ?? 'No fue posible completar el envío masivo a Siigo');
        this.loadBillingPeriods();
      },
    });
  }

  onCancelBulkSend(): void {
    if (this.isSendingBulk()) return;
    this.showBulkModal.set(false);
    this.bulkRows.set([]);
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
