import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncapacitiesService } from '../../services/incapacities.service';
import {
  Incapacity,
  IncapacityFilters,
  IncapacityRoute,
  ServirproStatus,
  ThirdPartyStatus,
} from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';
import { ConfigGeneralService } from '../../../../core/service/config-general.service';
import {
  MIN_PAGE_SIZE,
  PageSizeControlComponent,
  REGISTROS_POR_PAGINA_KEY,
} from '../../../../shared/components/page-size-control/page-size-control';
import { TableScrollComponent } from '../../../../shared/components/table-scroll/table-scroll';
import { IncapacityDocumentsListComponent } from '../../components/incapacity-documents-list/incapacity-documents-list';
import {
  IncapacityStatusModalComponent,
  StatusScope,
} from '../../components/incapacity-status-modal/incapacity-status-modal';

@Component({
  selector: 'app-incapacities-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageSizeControlComponent,
    TableScrollComponent,
    IncapacityDocumentsListComponent,
    IncapacityStatusModalComponent,
  ],
  templateUrl: './incapacities-list.html',
})
export class IncapacitiesListComponent implements OnInit {
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);
  private _configGeneral = inject(ConfigGeneralService);

  incapacities = signal<Incapacity[]>([]);
  isLoading = signal(false);
  busyId = signal<number | null>(null);

  pageSize = signal(MIN_PAGE_SIZE);
  currentPage = signal(1);
  totalPages = signal(0);
  totalItems = signal(0);

  servirproStatusFilter = signal<ServirproStatus | ''>('');
  thirdPartyStatusFilter = signal<ThirdPartyStatus | ''>('');
  routeFilter = signal<IncapacityRoute | ''>('');
  pilaFilter = signal<'' | 'true' | 'false'>('');

  pendingServirproCount = signal(0);
  pilaPendingCount = signal(0);

  showStatusModal = signal(false);
  statusScope = signal<StatusScope>('SERVIRPRO');
  selectedIncapacity = signal<Incapacity | null>(null);

  readonly servirproStatuses: ServirproStatus[] = ['PENDIENTE', 'APROBADO', 'RECHAZADO'];
  readonly thirdPartyStatuses: ThirdPartyStatus[] = ['PENDIENTE', 'EN_PROCESO', 'APROBADO', 'RECHAZADO'];
  readonly routes: IncapacityRoute[] = ['GESTION', 'CYA'];

  private readonly statusLabels: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_PROCESO: 'En proceso',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
  };

  ngOnInit(): void {
    this._configGeneral.getValue(REGISTROS_POR_PAGINA_KEY).subscribe({
      next: (value) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed >= MIN_PAGE_SIZE) this.pageSize.set(parsed);
        this.load(1);
      },
      error: () => this.load(1),
    });
    this.loadCounters();
  }

  load(page: number = this.currentPage()): void {
    const filters: IncapacityFilters = {};
    if (this.servirproStatusFilter()) filters.servirproStatus = this.servirproStatusFilter() as ServirproStatus;
    if (this.thirdPartyStatusFilter()) filters.thirdPartyStatus = this.thirdPartyStatusFilter() as ThirdPartyStatus;
    if (this.routeFilter()) filters.routedTo = this.routeFilter() as IncapacityRoute;
    if (this.pilaFilter()) filters.registeredInPila = this.pilaFilter() === 'true';

    this.isLoading.set(true);
    this._service.getIncapacities(filters, page, this.pageSize()).subscribe({
      next: (response) => {
        this.incapacities.set(response.items ?? []);
        this.currentPage.set(response.page);
        this.totalPages.set(response.totalPages);
        this.totalItems.set(response.total);
        this.isLoading.set(false);
      },
      error: (error: Error) => {
        this._toast.showError(error.message);
        this.incapacities.set([]);
        this.isLoading.set(false);
      },
    });
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.load(1);
  }

  onFilterChange(): void {
    this.load(1);
    this.loadCounters();
  }

  hasActiveFilters = computed(
    () =>
      !!this.servirproStatusFilter() ||
      !!this.thirdPartyStatusFilter() ||
      !!this.routeFilter() ||
      !!this.pilaFilter(),
  );

  clearFilters(): void {
    this.servirproStatusFilter.set('');
    this.thirdPartyStatusFilter.set('');
    this.routeFilter.set('');
    this.pilaFilter.set('');
    this.onFilterChange();
  }

  /** Atajo del contador: lo pendiente de decisión es a lo que se entra a hacer algo. */
  filterByServirpro(status: ServirproStatus): void {
    const alreadyOn = this.servirproStatusFilter() === status;
    this.servirproStatusFilter.set(alreadyOn ? '' : status);
    this.thirdPartyStatusFilter.set('');
    this.routeFilter.set('');
    this.pilaFilter.set('');
    this.onFilterChange();
  }

  /** Atajo del contador: incapacidades de CYA que faltan por marcar en PILA. */
  filterByPilaPending(): void {
    const alreadyOn = this.routeFilter() === 'CYA' && this.pilaFilter() === 'false';
    this.servirproStatusFilter.set('');
    this.thirdPartyStatusFilter.set('');
    this.routeFilter.set(alreadyOn ? '' : 'CYA');
    this.pilaFilter.set(alreadyOn ? '' : 'false');
    this.onFilterChange();
  }

  /**
   * Totales de los dos contadores del encabezado.
   *
   * Se piden con limit=1 y se lee `total` de la respuesta paginada: solo
   * interesa el número, no las filas, y traerlas sería gastar ancho de banda
   * en datos que nadie va a ver.
   */
  private loadCounters(): void {
    this._service.getIncapacities({ servirproStatus: 'PENDIENTE' }, 1, 1).subscribe({
      next: (r) => this.pendingServirproCount.set(r.total),
      error: () => this.pendingServirproCount.set(0),
    });
    this._service.getIncapacities({ routedTo: 'CYA', registeredInPila: false }, 1, 1).subscribe({
      next: (r) => this.pilaPendingCount.set(r.total),
      error: () => this.pilaPendingCount.set(0),
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.load(page);
  }

  // ── Acciones ──────────────────────────────────────────────────────

  openStatusModal(incapacity: Incapacity, scope: StatusScope): void {
    this.selectedIncapacity.set(incapacity);
    this.statusScope.set(scope);
    this.showStatusModal.set(true);
  }

  onStatusConfirmed(): void {
    this.showStatusModal.set(false);
    this.load();
    this.loadCounters();
  }

  onStatusCancelled(): void {
    this.showStatusModal.set(false);
  }

  togglePila(incapacity: Incapacity): void {
    this.busyId.set(incapacity.id);
    this._service.markPila(incapacity.id, !incapacity.registeredInPila).subscribe({
      next: () => {
        this.busyId.set(null);
        this._toast.showSuccess(
          incapacity.registeredInPila ? 'Marca de PILA retirada.' : 'Marcada como registrada en PILA.',
        );
        this.load();
        this.loadCounters();
      },
      error: (error: Error) => {
        this.busyId.set(null);
        this._toast.showError(error.message);
      },
    });
  }

  resendEmail(incapacity: Incapacity): void {
    this.busyId.set(incapacity.id);
    this._service.resendEmail(incapacity.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this._toast.showSuccess('Correo reenviado.');
        this.load();
      },
      error: (error: Error) => {
        this.busyId.set(null);
        this._toast.showError(error.message);
      },
    });
  }

  // ── Presentación ──────────────────────────────────────────────────

  statusLabel(status: string): string {
    return this.statusLabels[status] ?? status;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'APROBADO':
        return 'bg-emerald-100 text-emerald-700';
      case 'RECHAZADO':
        return 'bg-red-100 text-red-700';
      case 'EN_PROCESO':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  affiliateName(incapacity: Incapacity): string {
    return incapacity.affiliation?.client?.fullName?.trim() || '—';
  }

  affiliateDocument(incapacity: Incapacity): string {
    const client = incapacity.affiliation?.client;
    if (!client?.documentNumber) return '—';
    return `${client.documentType ?? ''} ${client.documentNumber}`.trim();
  }

  grouperName(incapacity: Incapacity): string {
    return incapacity.affiliation?.grouper?.name ?? '—';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const [year, month, day] = value.substring(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
}
