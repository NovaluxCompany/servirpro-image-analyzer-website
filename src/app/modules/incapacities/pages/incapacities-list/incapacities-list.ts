import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncapacitiesService } from '../../services/incapacities.service';
import {
  CatalogItem,
  GrouperOption,
  Incapacity,
  IncapacityFilters,
  IncapacityGrouperRoute,
  IncapacityRoute,
  IncapacityType,
  ServirproStatusCode,
  ThirdPartyStatusCode,
} from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';
import { ConfigGeneralService } from '../../../../core/service/config-general.service';
import { PermissionService } from '../../../../core/service/permission.service';
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
import { IncapacityTraceModalComponent } from '../../components/incapacity-trace-modal/incapacity-trace-modal';

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
    IncapacityTraceModalComponent,
  ],
  templateUrl: './incapacities-list.html',
})
export class IncapacitiesListComponent implements OnInit {
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);
  private _configGeneral = inject(ConfigGeneralService);
  permission = inject(PermissionService);

  incapacities = signal<Incapacity[]>([]);
  isLoading = signal(false);
  busyId = signal<number | null>(null);

  pageSize = signal(MIN_PAGE_SIZE);
  currentPage = signal(1);
  totalPages = signal(0);
  totalItems = signal(0);

  documentNumberFilter = signal<string>('');
  typeFilter = signal<IncapacityType | ''>('');
  servirproStatusFilter = signal<ServirproStatusCode | ''>('');
  thirdPartyStatusFilter = signal<ThirdPartyStatusCode | ''>('');
  /**
   * Gestión ya aplicada. NO es un filtro de pantalla — el visible es
   * `grouperFilter`. Queda solo como mecanismo del atajo del contador
   * "Sin registrar en PILA", que por definición es de las de CYA.
   */
  routeFilter = signal<IncapacityRoute | ''>('');
  grouperFilter = signal<string>('');
  pilaFilter = signal<'' | 'true' | 'false'>('');
  showCancelled = signal(false);

  /** Catálogos en BD, para las opciones del filtro y para pintar la insignia con la label real. */
  servirproStatusCatalog = signal<CatalogItem[]>([]);
  thirdPartyStatusCatalog = signal<CatalogItem[]>([]);
  groupers = signal<GrouperOption[]>([]);

  /**
   * Mapa agrupadora → gestión (`incapacity_grouper_routes`). Es la única
   * fuente para saber qué gestión le toca a cada agrupadora: no hay regla
   * derivable en código, cada agrupadora se configura como dato.
   */
  grouperRoutes = signal<IncapacityGrouperRoute[]>([]);

  pendingServirproCount = signal(0);
  pilaPendingCount = signal(0);

  showStatusModal = signal(false);
  statusScope = signal<StatusScope>('SERVIRPRO');
  selectedIncapacity = signal<Incapacity | null>(null);

  showTraceModal = signal(false);
  traceIncapacity = signal<Incapacity | null>(null);

  showDeleteModal = signal(false);
  deleteTarget = signal<Incapacity | null>(null);
  isDeleting = signal(false);

  showCancelModal = signal(false);
  cancelTarget = signal<Incapacity | null>(null);
  cancelReason = signal('');
  isCancelling = signal(false);

  isExporting = signal(false);

  /**
   * El Excel sale con los filtros puestos, no con todo el histórico
   * (exportExcel() manda buildFilters()). El botón vive junto al contador
   * de la tabla justamente por eso, y el tooltip lo deja explícito: lo que
   * se descarga es lo que se está viendo.
   */
  exportHint = computed(() =>
    this.hasActiveFilters()
      ? `Descarga las ${this.totalItems()} incapacidades filtradas`
      : `Descarga las ${this.totalItems()} incapacidades`,
  );

  // ── Dropdown acciones ─────────────────────────────────────────────
  openDropdownId = signal<number | null>(null);
  dropdownPos = signal<{ top: number | null; bottom: number | null; left: number; maxHeight: number }>({
    top: 0,
    bottom: null,
    left: 0,
    maxHeight: 400,
  });

  toggleDropdown(id: number, buttonEl: HTMLElement): void {
    if (this.openDropdownId() === id) {
      this.openDropdownId.set(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const opensUpward = spaceBelow < 200 && spaceAbove > spaceBelow;

    this.dropdownPos.set({
      top: opensUpward ? null : rect.bottom + 4,
      bottom: opensUpward ? window.innerHeight - rect.top + 4 : null,
      left: rect.left,
      maxHeight: Math.max(120, (opensUpward ? spaceAbove : spaceBelow) - 12),
    });
    this.openDropdownId.set(id);
  }

  closeDropdown(): void {
    this.openDropdownId.set(null);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openDropdownId.set(null);
  }

  readonly incapacityTypes: IncapacityType[] = ['NUEVA', 'PRORROGA'];

  private readonly typeLabels: Record<IncapacityType, string> = {
    NUEVA: 'Nueva',
    PRORROGA: 'Prórroga',
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
    this._service.getCatalogs().subscribe({
      next: ({ servirproStatuses, thirdPartyStatuses }) => {
        this.servirproStatusCatalog.set(servirproStatuses);
        this.thirdPartyStatusCatalog.set(thirdPartyStatuses);
      },
      error: (error: Error) => this._toast.showError(`No se pudieron cargar los estados: ${error.message}`),
    });
    this._service.getGroupers().subscribe({
      next: (groupers) => this.groupers.set(groupers),
    });
    // Sin este mapeo no se sabe qué gestión le toca a cada agrupadora: el
    // rótulo del estado del tercero y el botón "Enviar correo" dependen de él.
    this._service.getGrouperRoutes().subscribe({
      next: (routes) => this.grouperRoutes.set(routes),
      error: (error: Error) =>
        this._toast.showError(`No se pudo cargar la gestión por agrupadora: ${error.message}`),
    });
  }

  /**
   * Habilita el botón "Enviar correo": el correo es parte de la gestión de
   * Gestión, así que aplica cuando la agrupadora del afiliado está mapeada
   * a GESTION. Misma condición que el backend
   * (IncapacityWorkflowService.sendEmailAndApprove), que también resuelve
   * por agrupadora contra `incapacity_grouper_routes`.
   */
  isGestionRoute(incapacity: Incapacity): boolean {
    return this.resolveThirdPartyRoute(incapacity) === 'GESTION';
  }

  showSendEmailModal = signal(false);
  sendEmailTarget = signal<Incapacity | null>(null);
  isSendingEmail = signal(false);

  openSendEmailModal(incapacity: Incapacity): void {
    this.sendEmailTarget.set(incapacity);
    this.showSendEmailModal.set(true);
  }

  closeSendEmailModal(): void {
    this.showSendEmailModal.set(false);
    this.sendEmailTarget.set(null);
  }

  confirmSendEmailAndApprove(): void {
    const incapacity = this.sendEmailTarget();
    if (!incapacity) return;

    this.isSendingEmail.set(true);
    this.busyId.set(incapacity.id);
    this._service.sendEmailAndApprove(incapacity.id).subscribe({
      next: () => {
        this.isSendingEmail.set(false);
        this.busyId.set(null);
        this.closeSendEmailModal();
        this._toast.showSuccess('Correo enviado y incapacidad aprobada.');
        this.load();
        this.loadCounters();
      },
      error: (error: Error) => {
        this.isSendingEmail.set(false);
        this.busyId.set(null);
        this._toast.showError(error.message);
      },
    });
  }

  /**
   * Gestión que le corresponde a la incapacidad, resuelta por la agrupadora
   * del afiliado contra `incapacity_grouper_routes`.
   *
   * No hay regla derivable en código: cada agrupadora tiene su gestión
   * configurada como dato, y una agrupadora sin mapeo (hoy, ORDINARIAS) no
   * tiene ninguna — por eso puede devolver null. Si el trámite ya se
   * enrutó, manda lo que quedó registrado (`routedTo`): eso es lo que
   * realmente pasó, no lo que hoy diría la configuración.
   */
  resolveThirdPartyRoute(incapacity: Incapacity): IncapacityRoute | null {
    if (incapacity.routedTo) return incapacity.routedTo;

    const grouperId = incapacity.affiliation?.grouper?.id;
    if (!grouperId) return null;

    const mapping = this.grouperRoutes().find((r) => r.active && r.grouperId === grouperId);
    return mapping?.route ?? null;
  }

  private buildFilters(): IncapacityFilters {
    const filters: IncapacityFilters = {};
    if (this.documentNumberFilter().trim()) filters.documentNumber = this.documentNumberFilter().trim();
    if (this.typeFilter()) filters.type = this.typeFilter() as IncapacityType;
    if (this.servirproStatusFilter()) filters.servirproStatus = this.servirproStatusFilter() as ServirproStatusCode;
    if (this.thirdPartyStatusFilter()) filters.thirdPartyStatus = this.thirdPartyStatusFilter() as ThirdPartyStatusCode;
    if (this.routeFilter()) filters.routedTo = this.routeFilter() as IncapacityRoute;
    if (this.grouperFilter()) filters.grouperId = Number(this.grouperFilter());
    if (this.pilaFilter()) filters.registeredInPila = this.pilaFilter() === 'true';
    if (this.showCancelled()) filters.cancelled = true;
    return filters;
  }

  load(page: number = this.currentPage()): void {
    const filters = this.buildFilters();

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
      !!this.documentNumberFilter().trim() ||
      !!this.typeFilter() ||
      !!this.servirproStatusFilter() ||
      !!this.thirdPartyStatusFilter() ||
      !!this.routeFilter() ||
      !!this.grouperFilter() ||
      !!this.pilaFilter() ||
      this.showCancelled(),
  );

  clearFilters(): void {
    this.documentNumberFilter.set('');
    this.typeFilter.set('');
    this.servirproStatusFilter.set('');
    this.thirdPartyStatusFilter.set('');
    this.routeFilter.set('');
    this.grouperFilter.set('');
    this.pilaFilter.set('');
    this.showCancelled.set(false);
    this.onFilterChange();
  }

  toggleCancelledView(): void {
    this.showCancelled.set(!this.showCancelled());
    this.onFilterChange();
  }

  /** Atajo del contador: lo pendiente de decisión es a lo que se entra a hacer algo. */
  filterByServirpro(status: ServirproStatusCode): void {
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

  openTraceModal(incapacity: Incapacity): void {
    this.traceIncapacity.set(incapacity);
    this.showTraceModal.set(true);
  }

  closeTraceModal(): void {
    this.showTraceModal.set(false);
    this.traceIncapacity.set(null);
  }

  /** El motivo es obligatorio: sin rastro de por qué, anular no sirve para auditoría. */
  cancelIncapacity(incapacity: Incapacity): void {
    this.cancelTarget.set(incapacity);
    this.cancelReason.set('');
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
    this.cancelTarget.set(null);
    this.cancelReason.set('');
  }

  confirmCancelIncapacity(): void {
    const incapacity = this.cancelTarget();
    if (!incapacity) return;
    if (!this.cancelReason().trim()) {
      this._toast.showError('Escribe el motivo de la anulación.');
      return;
    }

    this.isCancelling.set(true);
    this.busyId.set(incapacity.id);
    this._service.cancel(incapacity.id, { reason: this.cancelReason().trim() }).subscribe({
      next: () => {
        this.isCancelling.set(false);
        this.busyId.set(null);
        this.closeCancelModal();
        this._toast.showSuccess('Incapacidad anulada.');
        this.load();
        this.loadCounters();
      },
      error: (error: Error) => {
        this.isCancelling.set(false);
        this.busyId.set(null);
        this._toast.showError(error.message);
      },
    });
  }

  removeIncapacity(incapacity: Incapacity): void {
    this.deleteTarget.set(incapacity);
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const incapacity = this.deleteTarget();
    if (!incapacity) return;

    this.isDeleting.set(true);
    this.busyId.set(incapacity.id);
    this._service.remove(incapacity.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.busyId.set(null);
        this.showDeleteModal.set(false);
        this.deleteTarget.set(null);
        this._toast.showSuccess('Incapacidad eliminada.');
        this.load();
        this.loadCounters();
      },
      error: (error: Error) => {
        this.isDeleting.set(false);
        this.busyId.set(null);
        this._toast.showError(error.message);
      },
    });
  }

  exportExcel(): void {
    this.isExporting.set(true);
    this._service.exportToExcel(this.buildFilters()).subscribe({
      next: (blob) => {
        this.isExporting.set(false);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'incapacidades.xlsx';
        link.click();
        window.URL.revokeObjectURL(url);
        this._toast.showSuccess('Excel descargado.');
      },
      error: (error: Error) => {
        this.isExporting.set(false);
        this._toast.showError(error.message);
      },
    });
  }

  // ── Presentación ──────────────────────────────────────────────────

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
    return `${client.documentType ?? ''} - ${client.documentNumber}`.trim();
  }

  grouperName(incapacity: Incapacity): string {
    return incapacity.affiliation?.grouper?.name ?? '—';
  }

  companyName(incapacity: Incapacity): string {
    return incapacity.affiliation?.company?.name ?? '—';
  }

  epsName(incapacity: Incapacity): string {
    return incapacity.affiliation?.eps?.name ?? '—';
  }

  /**
   * La edad la guarda el backend al radicar (`incapacity.age`), calculada a
   * la fecha de inicio de la incapacidad. No se recalcula acá: así el
   * listado, el Excel y el correo muestran siempre el mismo número, y el
   * valor no cambia con el paso del tiempo.
   *
   * El cálculo al vuelo queda solo para las incapacidades radicadas antes
   * de que existiera esa columna. Cuenta por calendario, no dividiendo
   * milisegundos entre 365,25 como antes: esa aproximación se equivocaba en
   * un año justo alrededor del cumpleaños.
   */
  age(incapacity: Incapacity): string {
    if (incapacity.age !== null && incapacity.age !== undefined) {
      return String(incapacity.age);
    }

    const birthDate = incapacity.birthDate ?? incapacity.affiliation?.client?.birthDate;
    if (!birthDate) return '—';

    const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
    const reference = new Date(`${incapacity.startDate.slice(0, 10)}T00:00:00Z`);
    if (isNaN(birth.getTime()) || isNaN(reference.getTime())) return '—';

    let years = reference.getUTCFullYear() - birth.getUTCFullYear();
    const monthDiff = reference.getUTCMonth() - birth.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && reference.getUTCDate() < birth.getUTCDate())) {
      years--;
    }

    // Fuera de rango = fecha de nacimiento mal digitada en la ficha del
    // afiliado. Mejor un guion que un número que nadie va a cuestionar.
    return years >= 0 && years <= 130 ? String(years) : '—';
  }

  typeLabel(incapacity: Incapacity): string {
    return this.typeLabels[incapacity.type] ?? incapacity.type;
  }

  /** EPS se lee por join; ARL no tiene catálogo, así que se guarda como texto en la incapacidad. */
  issuingEntity(incapacity: Incapacity): string {
    if (incapacity.entityType?.code === 'EPS') return incapacity.affiliation?.eps?.name ?? '—';
    return incapacity.issuingEntityName ?? '—';
  }

  filedBy(incapacity: Incapacity): string {
    return incapacity.createdByUser?.name ?? incapacity.createdByUser?.email ?? '—';
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const [year, month, day] = value.substring(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
}
