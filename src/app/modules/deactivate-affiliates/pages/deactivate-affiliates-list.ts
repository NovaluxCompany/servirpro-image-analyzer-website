import { ChangeDetectionStrategy, Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchableSelectComponent, SelectOption } from '../../../shared/components/searchable-select/searchable-select';
import { forkJoin, of } from 'rxjs';
import { ToastService } from '../../../core/service/toast.service';
import { PermissionService } from '../../../core/service/permission.service';
import { ConfigGeneralService } from '../../../core/service/config-general.service';
import { TokenService } from '../../../core/service/token.service';
import { PageSizeControlComponent, REGISTROS_POR_PAGINA_KEY, MIN_PAGE_SIZE } from '../../../shared/components/page-size-control/page-size-control';
import { TableScrollComponent } from '../../../shared/components/table-scroll/table-scroll';
import {
  AffiliateTransactionRow,
  DeactivateAffiliateFilters,
  DeactivateAffiliatesResponse,
  DeactivationContext,
  InactivationAffiliateRow,
} from '../interfaces/deactivate-affiliates.interface';
import { DeactivateAffiliatesService } from '../services/deactivate-affiliates.service';
import { AffiliateMembersService } from '../../affiliates/services/affiliate-members.service';
import { PendingDisaffiliationRow } from '../interfaces/disaffiliation.interface';

type InactivationTab = 'unpaid' | 'underpaid' | 'disaffiliation';

@Component({
  selector: 'app-deactivate-affiliates-list',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, PageSizeControlComponent, TableScrollComponent],
  templateUrl: './deactivate-affiliates-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeactivateAffiliatesList implements OnInit {
  private readonly _deactivateAffiliatesService = inject(DeactivateAffiliatesService);
  private readonly _affiliateMembersService = inject(AffiliateMembersService);
  private readonly _toastService = inject(ToastService);
  private readonly _configGeneralService = inject(ConfigGeneralService);
  private readonly _tokenService = inject(TokenService);
  private _permission = inject(PermissionService);
  private _toast = inject(ToastService);

  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly showConfirmationModal = signal(false);
  protected deactivationReason = '';
  // Es el id de deactivation_reasons (FK real) que se manda al backend.
  protected reasonTypeId: number | null = null;
  protected showReasonTypeError = false;
  protected readonly isDeactivatingAll = signal(false);

  // Viene de deactivation_reasons (ver AffiliateMembersService.getDeactivationReasons):
  // agregar un motivo nuevo es un INSERT en esa tabla, no un deploy de este archivo.
  reasonTypeOptions: { value: number; label: string }[] = [];
  protected readonly showApprovePaymentModal = signal(false);
  protected readonly pendingApproveAffiliate = signal<InactivationAffiliateRow | null>(null);
  protected readonly selectedIds = signal<number[]>([]);
  protected readonly context = signal<DeactivationContext | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isPermissionError = signal(false);
  // Antes solo elegía entre 'unpaid'/'underpaid': un rol que solo tuviera
  // acceso a "Desafiliar" (sin Sin pago ni Pagos incompletos) igual
  // arrancaba parado en un tab sin permiso, con la tabla vacía y sin
  // explicación. Ahora recorre los tres en el mismo orden en que aparecen
  // en la barra de tabs y cae en el primero al que el rol sí tiene acceso.
  protected readonly activeTab = signal<InactivationTab>(
    this._permission.hasMenuEntry('/desactivar-afiliados/sin-pago')
      ? 'unpaid'
      : this._permission.hasMenuEntry('/desactivar-afiliados/pagos-incompletos')
        ? 'underpaid'
        : this._permission.hasMenuEntry('/desactivar-afiliados/desafiliar')
          ? 'disaffiliation'
          : 'unpaid'
  );

  protected readonly unpaidAffiliates = signal<InactivationAffiliateRow[]>([]);
  protected readonly underpaidAffiliates = signal<InactivationAffiliateRow[]>([]);

  // ── Tab "Desafiliar" (paso 2: confirmar solicitudes pendientes) ─────
  protected readonly pendingDisaffiliations = signal<PendingDisaffiliationRow[]>([]);
  // Evita el parpadeo de "no hay registros" antes de que responda el backend.
  protected readonly hasLoadedDisaffiliations = signal(false);
  protected readonly disaffiliationSelectedIds = signal<number[]>([]);
  protected readonly filterDisaffName = signal('');
  protected readonly filterDisaffDocument = signal('');
  protected readonly filterDisaffCompany = signal('');
  protected readonly filterDisaffPlan = signal('');
  protected readonly filterDisaffType = signal('');
  protected readonly filterDisaffReason = signal('');
  protected readonly showDisaffiliationConfirmModal = signal(false);
  protected readonly isDisaffiliatingAll = signal(false);
  protected readonly isSubmittingDisaffiliation = signal(false);
  protected readonly isDownloadingDisaffiliationExcel = signal(false);

  // El botón del tab solo se muestra si hay al menos una solicitud
  // pendiente. Si el rol tiene otros tabs (Sin pago / Pagos incompletos),
  // esto simplemente lo oculta y el usuario sigue en los flujos a los que
  // sí tiene acceso.
  protected readonly showDisaffiliationTab = computed(
    () => this.canViewDisaffiliation() && this.pendingDisaffiliations().length > 0,
  );

  // Si se llega a estar parado en "Desafiliar" sin ningún registro pendiente
  // (por ejemplo, es el único permiso del rol y por eso arranca ahí, o se
  // confirmó la última solicitud estando en el tab), no tiene sentido pintar
  // filtros ni botones de acción: se reemplaza todo por un único mensaje.
  protected readonly disaffiliationTableEmpty = computed(
    () => this.hasLoadedDisaffiliations() && this.pendingDisaffiliations().length === 0,
  );

  protected readonly filteredDisaffiliations = computed(() => {
    const all = this.pendingDisaffiliations();
    const name = this.filterDisaffName().toLowerCase().trim();
    const document = this.filterDisaffDocument().toLowerCase().trim();
    const company = this.filterDisaffCompany().toLowerCase().trim();
    const plan = this.filterDisaffPlan().toLowerCase().trim();
    const type = this.filterDisaffType();
    const reason = this.filterDisaffReason().toLowerCase().trim();

    if (!name && !document && !company && !plan && !type && !reason) return all;

    return all.filter((row) => {
      if (name && !row.fullName?.toLowerCase().includes(name)) return false;
      if (document && !row.documentNumber?.toLowerCase().includes(document)) return false;
      if (company && row.company?.toLowerCase() !== company) return false;
      if (plan && row.plan?.toLowerCase() !== plan) return false;
      if (type && row.affiliateType !== type) return false;
      if (reason && row.reasonLabel?.toLowerCase() !== reason) return false;
      return true;
    });
  });

  protected readonly hasDisaffFilters = computed(
    () => !!(this.filterDisaffName() || this.filterDisaffDocument() || this.filterDisaffCompany()
      || this.filterDisaffPlan() || this.filterDisaffType() || this.filterDisaffReason()),
  );

  private readonly uniqueDisaffOptions = (pick: (row: PendingDisaffiliationRow) => string | undefined): SelectOption[] =>
    [...new Set(this.pendingDisaffiliations().map(pick).filter(Boolean) as string[])]
      .sort()
      .map((v) => ({ value: v, label: v }));

  protected readonly disaffPlanOptions = computed(() => this.uniqueDisaffOptions((r) => r.plan));
  protected readonly disaffCompanyOptions = computed(() => this.uniqueDisaffOptions((r) => r.company));
  protected readonly disaffReasonOptions = computed(() => this.uniqueDisaffOptions((r) => r.reasonLabel));
  protected readonly disaffTypeOptions: SelectOption[] = [
    { value: 'INDEPENDIENTE', label: 'INDEPENDIENTE' },
    { value: 'DEPENDIENTE', label: 'DEPENDIENTE' },
  ];

  private disaffServerFilters() {
    return {
      name: this.filterDisaffName() || undefined,
      document: this.filterDisaffDocument() || undefined,
      company: this.filterDisaffCompany() || undefined,
      plan: this.filterDisaffPlan() || undefined,
      affiliateType: this.filterDisaffType() || undefined,
      reason: this.filterDisaffReason() || undefined,
    };
  }

  protected readonly disaffiliationTotalItems = computed(() => this.filteredDisaffiliations().length);
  protected readonly disaffiliationTotalPages = computed(() =>
    Math.ceil((this.disaffiliationTotalItems() || 1) / (this.pageSize() || 1)),
  );

  protected readonly currentDisaffiliations = computed(() => {
    const all = this.filteredDisaffiliations();
    const start = (this.currentPage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return all.slice(start, end);
  });

  protected readonly selectedDisaffiliationCount = computed(() => this.disaffiliationSelectedIds().length);

  protected readonly allDisaffiliationVisibleSelected = computed(() => {
    const visible = this.currentDisaffiliations();
    return visible.length > 0 && visible.every((row) => this.disaffiliationSelectedIds().includes(row.requestId));
  });

  protected readonly someDisaffiliationVisibleSelected = computed(() => {
    const visible = this.currentDisaffiliations();
    const selectedCount = visible.filter((row) => this.disaffiliationSelectedIds().includes(row.requestId)).length;
    return selectedCount > 0 && selectedCount < visible.length;
  });

  protected readonly disaffiliationModalMessage = computed(() => {
    if (this.isDisaffiliatingAll()) {
      return `Se van a desafiliar <strong>${this.disaffiliationTotalItems()}</strong> afiliado(s)${this.hasDisaffFilters() ? ' según los filtros activos' : ''}. ¿Desea continuar?`;
    }
    if (this.selectedDisaffiliationCount() === 1) {
      const row = this.pendingDisaffiliations().find((r) => this.disaffiliationSelectedIds().includes(r.requestId));
      return `¿Desea desafiliar al afiliado con número de identificación <strong>${row?.documentNumber ?? ''}</strong>?`;
    }
    return `Se van a desafiliar <strong>${this.selectedDisaffiliationCount()}</strong> afiliado(s) seleccionado(s). ¿Desea continuar?`;
  });

  protected readonly expandedAffiliateId = signal<number | null>(null);
  protected readonly isLoadingTransactions = signal(false);
  protected readonly transactionsError = signal<string | null>(null);
  protected readonly affiliateTransactions = signal<AffiliateTransactionRow[]>([]);

  protected readonly showResultsModal = signal(false);
  protected readonly deactivationResult = signal<DeactivateAffiliatesResponse | null>(null);

  // Verifica si el usuario puede acceder al tab "Sin pago"
  protected readonly canViewUnpaid = computed(() =>
    this._permission.hasMenuEntry('/desactivar-afiliados/sin-pago')
  );

  // Verifica si el usuario puede acceder al tab "Pagos Incompletos"
  protected readonly canViewUnderpaid = computed(() =>
    this._permission.hasMenuEntry('/desactivar-afiliados/pagos-incompletos')
  );

  // Verifica si el usuario puede acceder al tab "Desafiliar"
  protected readonly canViewDisaffiliation = computed(() =>
    this._permission.hasMenuEntry('/desactivar-afiliados/desafiliar')
  );

  // Si el rol no tiene acceso a ninguno de los tres tabs, no tiene sentido
  // pintar tabs vacíos ni disparar cargas que van a devolver 403: se corta
  // acá con un mensaje claro y no se deja "entrar" al módulo.
  protected readonly hasAnyDeactivationAccess = computed(
    () => this.canViewUnpaid() || this.canViewUnderpaid() || this.canViewDisaffiliation(),
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
  protected readonly filterFidelizador = signal('');
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
  protected readonly pageSize = signal(MIN_PAGE_SIZE);

  protected readonly canDeactivateByDate = computed(() => {
    const context = this.context();
    if (!context) return false;
    return context.canDeactivateByDate;
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
    const fidelizador = this.filterFidelizador().toLowerCase().trim();
    const company = this.filterCompany().toLowerCase().trim();
    const grouper = this.filterGrouper().toLowerCase().trim();

    if (!name && !document && !reference && !adviser && !fidelizador && !company && !grouper) {
      return all;
    }

    return all.filter((a) => {
      if (name && !a.name?.toLowerCase().includes(name)) return false;
      if (document && !a.document?.toLowerCase().includes(document)) return false;
      if (reference && a.reference?.toLowerCase() !== reference) return false;
      if (adviser && a.advisor?.toLowerCase() !== adviser) return false;
      if (fidelizador && a.fidelizador?.toLowerCase() !== fidelizador) return false;
      if (company && a.company?.toLowerCase() !== company) return false;
      if (grouper && a.grouper?.toLowerCase() !== grouper) return false;
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
    !!(this.filterName() || this.filterDocument() || this.filterReference() || this.filterAdviser() || this.filterFidelizador() || this.filterCompany() || this.filterGrouper())
  );

  // ── Opciones para filtros desplegables (derivadas de los datos cargados) ──
  protected readonly referenceOptions = computed((): SelectOption[] => {
    const unique = [...new Set(this.allAffiliates().map(a => a.reference).filter(Boolean))].sort();
    return unique.map(v => ({ value: v, label: v }));
  });

  // Nombres del catálogo de asesores HABILITADOS (GET /advisors/dropdown).
  protected readonly activeAdvisorNames = signal<Set<string>>(new Set());
  // Nombres del catálogo de fidelizadores HABILITADOS (GET /fidelizadores/dropdown).
  protected readonly activeFidelizadorNames = signal<Set<string>>(new Set());

  protected readonly fidelizadorOptions = computed((): SelectOption[] => {
    const active = this.activeFidelizadorNames();
    const unique = [...new Set(this.allAffiliates().map(a => a.fidelizador).filter(Boolean))]
      .filter(name => active.size === 0 || active.has(name))
      .sort();
    return unique.map(v => ({ value: v, label: v }));
  });

  // Intersección: solo asesores que (a) tienen al menos un afiliado en la
  // lista cargada (ya filtrada por la fidelización elegida, si hay una — así
  // "Asesor" depende de "Fidelización" igual que en el modal de crear/editar
  // afiliado) Y (b) están habilitados. Derivarlo solo de los datos mostraría
  // asesores viejos/deshabilitados que quedaron pegados a algún afiliado sin
  // reasignar; derivarlo solo del catálogo mostraría asesores habilitados
  // con cero resultados en este tab (filtro "muerto").
  protected readonly adviserOptions = computed((): SelectOption[] => {
    const active = this.activeAdvisorNames();
    const fidelizador = this.filterFidelizador().toLowerCase().trim();
    const rows = fidelizador
      ? this.allAffiliates().filter(a => a.fidelizador?.toLowerCase() === fidelizador)
      : this.allAffiliates();
    const unique = [...new Set(rows.map(a => a.advisor).filter(Boolean))]
      .filter(name => active.size === 0 || active.has(name))
      .sort();
    return unique.map(v => ({ value: v, label: v }));
  });

  protected readonly companyOptions = computed((): SelectOption[] => {
    const unique = [...new Set(this.allAffiliates().map(a => a.company).filter(Boolean))].sort();
    return unique.map(v => ({ value: v, label: v }));
  });

  protected readonly grouperOptions = computed((): SelectOption[] => {
    const unique = [...new Set(this.allAffiliates().map(a => a.grouper).filter(Boolean))].sort();
    return unique.map(v => ({ value: v, label: v }));
  });


  ngOnInit(): void {
    this._configGeneralService.getValue(REGISTROS_POR_PAGINA_KEY).subscribe({
      next: (value) => {
        const pageSize = parseInt(value, 10);
        if (!isNaN(pageSize) && pageSize >= MIN_PAGE_SIZE) {
          this.pageSize.set(pageSize);
        }
        this.loadData();
      },
      error: () => {
        this.loadData();
      },
    });

    this._affiliateMembersService.getAdvisors().subscribe((advisors) => {
      this.activeAdvisorNames.set(new Set(advisors.map((a) => a.name)));
    });

    this._affiliateMembersService.getFidelizadores().subscribe((fidelizadores) => {
      this.activeFidelizadorNames.set(new Set(fidelizadores.map((f) => f.name)));
    });

    this._affiliateMembersService.getDeactivationReasons().subscribe((reasons) => {
      this.reasonTypeOptions = reasons.map((r) => ({ value: r.id, label: r.label }));
    });

    if (this.canViewDisaffiliation()) {
      // El caso "Desafiliar es el único permiso y está vacío" ya lo resuelve
      // disaffiliation-sole-access.guard.ts ANTES de llegar acá (si hubiera
      // que sacar al usuario, ni siquiera se monta este componente), así que
      // esta carga no necesita repetir esa validación.
      this.loadPendingDisaffiliations();
    }
  }

  // ── Tab "Desafiliar": carga/selección/confirmación ──────────────────
  protected loadPendingDisaffiliations(): void {
    this._deactivateAffiliatesService.getPendingDisaffiliations().subscribe({
      next: (response) => {
        this.pendingDisaffiliations.set(response.data);
        this.disaffiliationSelectedIds.set([]);
        this.hasLoadedDisaffiliations.set(true);
      },
      error: () => {
        // Silencioso: la tabla queda vacía y cae en su propio estado "sin registros".
        this.hasLoadedDisaffiliations.set(true);
      },
    });
  }

  protected setFilterDisaffName(value: string): void {
    this.filterDisaffName.set(value);
    this.currentPage.set(1);
  }

  protected setFilterDisaffDocument(value: string): void {
    this.filterDisaffDocument.set(value);
    this.currentPage.set(1);
  }

  protected setFilterDisaffCompany(value: string): void {
    this.filterDisaffCompany.set(value);
    this.currentPage.set(1);
  }

  protected setFilterDisaffPlan(value: string): void {
    this.filterDisaffPlan.set(value ?? '');
    this.currentPage.set(1);
  }

  protected setFilterDisaffType(value: string): void {
    this.filterDisaffType.set(value ?? '');
    this.currentPage.set(1);
  }

  protected setFilterDisaffReason(value: string): void {
    this.filterDisaffReason.set(value ?? '');
    this.currentPage.set(1);
  }

  protected clearDisaffFilters(): void {
    this.filterDisaffName.set('');
    this.filterDisaffDocument.set('');
    this.filterDisaffCompany.set('');
    this.filterDisaffPlan.set('');
    this.filterDisaffType.set('');
    this.filterDisaffReason.set('');
    this.currentPage.set(1);
  }

  protected toggleDisaffRow(id: number, checked: boolean): void {
    const next = new Set(this.disaffiliationSelectedIds());
    checked ? next.add(id) : next.delete(id);
    this.disaffiliationSelectedIds.set(Array.from(next));
  }

  protected toggleDisaffVisibleRows(checked: boolean): void {
    const next = new Set(this.disaffiliationSelectedIds());
    this.currentDisaffiliations().forEach((row) => {
      checked ? next.add(row.requestId) : next.delete(row.requestId);
    });
    this.disaffiliationSelectedIds.set(Array.from(next));
  }

  protected isDisaffSelected(id: number): boolean {
    return this.disaffiliationSelectedIds().includes(id);
  }

  protected openDisaffiliationConfirmModal(): void {
    if (this.selectedDisaffiliationCount() === 0) return;
    if (!this._permission.check('delete', '/desactivar-afiliados/desafiliar', 'Tu rol no tiene permiso para desafiliar afiliados.')) {
      return;
    }
    this.isDisaffiliatingAll.set(false);
    this.showDisaffiliationConfirmModal.set(true);
  }

  protected disaffiliateAll(): void {
    if (!this._permission.check('delete', '/desactivar-afiliados/desafiliar', 'Tu rol no tiene permiso para desafiliar afiliados.')) {
      return;
    }
    if (this.filteredDisaffiliations().length === 0) {
      this._toastService.showInfo('No hay solicitudes de desafiliación pendientes para desafiliar.');
      return;
    }
    this.isDisaffiliatingAll.set(true);
    this.showDisaffiliationConfirmModal.set(true);
  }

  protected cancelDisaffiliationConfirm(): void {
    this.showDisaffiliationConfirmModal.set(false);
    this.isDisaffiliatingAll.set(false);
  }

  protected confirmDisaffiliation(): void {
    if (this.isSubmittingDisaffiliation()) return;
    this.isSubmittingDisaffiliation.set(true);

    const request = this.isDisaffiliatingAll()
      ? this._deactivateAffiliatesService.confirmAllDisaffiliations(this.disaffServerFilters())
      : this._deactivateAffiliatesService.confirmDisaffiliations([...this.disaffiliationSelectedIds()]);

    request.subscribe({
      next: (response) => {
        this.isSubmittingDisaffiliation.set(false);
        this.showDisaffiliationConfirmModal.set(false);
        this.isDisaffiliatingAll.set(false);
        this._toastService.showSuccess(response.message || 'Afiliados desafiliados exitosamente.');
        if (response.failed?.length) {
          this._toastService.showError(`${response.failed.length} solicitud(es) no pudieron procesarse.`);
        }
        this.loadPendingDisaffiliations();
      },
      error: (error: Error) => {
        this.isSubmittingDisaffiliation.set(false);
        this.showDisaffiliationConfirmModal.set(false);
        this.isDisaffiliatingAll.set(false);
        this._toastService.showError(error.message || 'No fue posible desafiliar los afiliados.');
      },
    });
  }

  protected downloadDisaffiliationExcel(): void {
    if (!this._permission.check('export', '/desactivar-afiliados/desafiliar', 'Tu rol no tiene permiso para descargar reportes en Excel.')) return;
    if (this.disaffiliationTotalItems() === 0) {
      this._toastService.showInfo('No hay resultados para descargar con los filtros actuales.');
      return;
    }

    this.isDownloadingDisaffiliationExcel.set(true);
    this._toast.showInfo('Descarga en proceso...');

    this._deactivateAffiliatesService
      .exportDisaffiliationsToExcel(this.disaffServerFilters())
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          const timestamp = new Date().toISOString().split('T')[0];
          link.download = `desafiliar_afiliados_${timestamp}.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          this.isDownloadingDisaffiliationExcel.set(false);
          this._toast.showSuccess('Excel descargado exitosamente');
        },
        error: (error) => {
          this.isDownloadingDisaffiliationExcel.set(false);
          this._toast.showError(error?.message ?? 'Error al descargar el Excel. Intenta de nuevo.');
        },
      });
  }

  protected onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.currentPage.set(1);
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

  // "Asesor" depende de "Fidelización": al cambiar el fidelizador se limpia
  // la selección de asesor si ya no aplica, igual que en el modal de
  // crear/editar afiliado.
  protected setFilterFidelizador(value: string): void {
    this.filterFidelizador.set(value);
    this.filterAdviser.set('');
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
    this.filterFidelizador.set('');
    this.filterCompany.set('');
    this.filterGrouper.set('');
    this.currentPage.set(1);
  }

  // ── Carga de datos ────────────────────────────────────────────────
  protected loadData(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.isPermissionError.set(false);
    this.selectedIds.set([]);

    // Ni "Sin pago" ni "Pagos incompletos" ni "Desafiliar": no hay nada que
    // pedirle al backend (ni siquiera el contexto, que también exige
    // permiso sobre el menú padre) — se corta acá con el mensaje de
    // permisos en vez de una llamada que va a devolver 403 igual.
    if (!this.hasAnyDeactivationAccess()) {
      this.isPermissionError.set(true);
      this.isLoading.set(false);
      return;
    }

    // Antes "unpaid" se pedía siempre, sin importar el permiso: un rol sin
    // acceso a "Sin pago" recibía un 403 ahí, y como forkJoin falla entero
    // ante cualquier error, eso tumbaba TODA la carga (incluido el tab al
    // que el rol sí tenía acceso) y dejaba la vista vacía sin explicación.
    const unpaidRequest = this.canViewUnpaid()
      ? this._deactivateAffiliatesService.getUnpaidAffiliates()
      : of([]);
    const underpaidRequest = this.canViewUnderpaid()
      ? this._deactivateAffiliatesService.getUnderpaidAffiliates()
      : of([]);

    forkJoin({
      context: this._deactivateAffiliatesService.getContext(),
      unpaid: unpaidRequest,
      underpaid: underpaidRequest,
    }).subscribe({
      next: (response) => {
        this.context.set(response.context);
        this.unpaidAffiliates.set(response.unpaid);
        this.underpaidAffiliates.set(response.underpaid);
        this.isLoading.set(false);
      },
      error: (error: Error & { status?: number }) => {
        if (error.status === 403) {
          this.isPermissionError.set(true);
        } else {
          this.errorMessage.set(error.message);
        }
        this.isLoading.set(false);
      },
    });
  }

  // ── Tabs ──────────────────────────────────────────────────────────
  protected changeTab(tab: InactivationTab): void {
    if (this.activeTab() === tab) return;

    const path = tab === 'unpaid'
      ? '/desactivar-afiliados/sin-pago'
      : tab === 'underpaid'
        ? '/desactivar-afiliados/pagos-incompletos'
        : '/desactivar-afiliados/desafiliar';

    if (!this._permission.hasMenuEntry(path)) {
      this._toastService.showError('No tienes permiso para acceder a este módulo.');
      return;
    }

    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.selectedIds.set([]);
    this.disaffiliationSelectedIds.set([]);
    this.clearFilters();
    this.clearDisaffFilters();
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
    this.deactivationReason = '';
    this.reasonTypeId = null;
    this.showReasonTypeError = false;
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

    if (!this.reasonTypeId) {
      this.showReasonTypeError = true;
      this._toastService.showError('Selecciona el motivo de la deshabilitación antes de continuar.');
      return;
    }
    this.isSubmitting.set(true);

    if (this.isDeactivatingAll()) {
      const filters = {
        name: this.filterName() || undefined,
        document: this.filterDocument() || undefined,
        reference: this.filterReference() || undefined,
        advisor: this.filterAdviser() || undefined,
        fidelizador: this.filterFidelizador() || undefined,
        company: this.filterCompany() || undefined,
        grouper: this.filterGrouper() || undefined,
        reason: this.deactivationReason || undefined,
        reasonTypeId: this.reasonTypeId ?? undefined,
      };

      this._deactivateAffiliatesService.deactivateAllAffiliates(filters).subscribe({
        next: (response) => {
          this.showConfirmationModal.set(false);
          this.isDeactivatingAll.set(false);
          this.isSubmitting.set(false);
          this.resetReasonFields();
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

    this._deactivateAffiliatesService
      .deactivateAffiliates(ids, this.deactivationReason || undefined, this.reasonTypeId ?? undefined)
      .subscribe({
        next: (response) => {
          this.showConfirmationModal.set(false);
          this.isDeactivatingAll.set(false);
          this.isSubmitting.set(false);
          this.resetReasonFields();
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

  private resetReasonFields(): void {
    this.deactivationReason = '';
    this.reasonTypeId = null;
    this.showReasonTypeError = false;
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

  // ── Fila expandible de transacciones ──────────────────────────────
  /** Alterna la fila expandible de detalle; solo una fila puede estar expandida a la vez. */
  protected toggleAffiliateExpand(affiliate: InactivationAffiliateRow): void {
    if (this.expandedAffiliateId() === affiliate.affiliateId) {
      this.expandedAffiliateId.set(null);
      return;
    }

    this.expandedAffiliateId.set(affiliate.affiliateId);
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

  protected trackByRequestId(_: number, item: PendingDisaffiliationRow): number {
    return item.requestId;
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
    // Pure date strings (YYYY-MM-DD)
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
    // ISO timestamps (date columns from TypeORM return UTC midnight; timestamp columns with Bogota
    // session store Colombia-local time). Extract the date prefix directly — it is the correct Colombia date.
    const isoPrefix = /^(\d{4})-(\d{2})-(\d{2})T/.exec(String(dateString));
    if (isoPrefix) return `${isoPrefix[3]}/${isoPrefix[2]}/${isoPrefix[1]}`;
    try {
      // For full timestamps, normalize to explicit UTC before converting
      const normalized = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(dateString) && !dateString.match(/[Z+]/)
        ? dateString.replace(' ', 'T') + 'Z'
        : dateString;
      const date = new Date(normalized);
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

    this._deactivateAffiliatesService.exportToExcel('unpaid', exportFilters).subscribe({
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
