import { Component, inject, signal, OnInit, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateMembersService, AffiliateFilters } from '../../services/affiliate-members.service';
import { AffiliateMember, AffiliateDocument } from '../../interfaces/affiliate-member.interface';
import { AffiliateFormModalComponent } from '../../components/affiliate-form-modal/affiliate-form-modal';
import { AffiliateStatusModalComponent } from '../../components/affiliate-status-modal/affiliate-status-modal';
import { AffiliateSendEmailModalComponent } from '../../components/affiliate-send-email-modal/affiliate-send-email-modal';
import { AffiliateInfoModalComponent } from '../../components/affiliate-info-modal/affiliate-info-modal';
import { AffiliateDocumentsModalComponent } from '../../components/affiliate-documents-modal/affiliate-documents-modal';
import { AffiliateSendEmailObservationModalComponent } from '../../components/affiliate-send-email-observation-modal/affiliate-send-email-observation-modal';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';
import { ConfigGeneralService } from '../../../../core/service/config-general.service';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/components/searchable-select/searchable-select';
import { PageSizeControlComponent, REGISTROS_POR_PAGINA_KEY, MIN_PAGE_SIZE } from '../../../../shared/components/page-size-control/page-size-control';
import { TableScrollComponent } from '../../../../shared/components/table-scroll/table-scroll';
import { Department } from '../../interfaces/catalog.interface';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-affiliates-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AffiliateFormModalComponent, AffiliateStatusModalComponent, AffiliateSendEmailModalComponent, AffiliateSendEmailObservationModalComponent, AffiliateInfoModalComponent, AffiliateDocumentsModalComponent, SearchableSelectComponent, PageSizeControlComponent, TableScrollComponent],
  templateUrl: './affiliates-list.html',
})
export class AffiliatesListComponent implements OnInit {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);
  private _permission = inject(PermissionService);
  private _configGeneralService = inject(ConfigGeneralService);

  // ── Datos ─────────────────────────────────────────────────────────
  affiliates = signal<AffiliateMember[]>([]);
  isLoading = signal(false);
  isDownloadingExcel = signal(false);
  errorMessage = signal<string | null>(null);

  // ── Paginación backend ────────────────────────────────────────────
  currentPage = signal(1);
  pageSize = signal(MIN_PAGE_SIZE);
  totalItems = signal(0);
  totalPages = signal(0);

  // ── Filtros ───────────────────────────────────────────────────────
  filterName = '';
  filterCedula = '';
  filterReference = '';
  filterAdvisor = '';
  filterIsActive = '';
  filterGrupo = '';
  filterEntryDateFrom = '';
  filterEntryDateTo = '';
  filterPaymentStatus = '';
  advisorOptions = signal<SelectOption[]>([]);
  referenceOptions = signal<SelectOption[]>([]);
  private departmentNameByCode = new Map<string, string>();

  private filterSubject = new Subject<void>();

  // ── Modales ───────────────────────────────────────────────────────
  showFormModal = signal(false);
  showStatusModal = signal(false);
  showSendEmailModal = signal(false);
  showSendEmailObservationModal = signal(false);
  showInfoModal = signal(false);
  showDocumentsModal = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  selectedAffiliate = signal<AffiliateMember | null>(null);

  // ── Siigo ─────────────────────────────────────────────────────────
  syncingSiigoId = signal<number | null>(null);  sendingEmailId = signal<number | null>(null);
  // ── Dropdown acciones ─────────────────────────────────────────────
  openDropdownId = signal<string | null>(null);
  dropdownPos = signal<{ top: number | null; bottom: number | null; left: number; maxHeight: number }>({
    top: 0,
    bottom: null,
    left: 0,
    maxHeight: 400,
  });

  toggleDropdown(id: string, buttonEl: HTMLElement): void {
    if (this.openDropdownId() === id) {
      this.openDropdownId.set(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();

    // El menú puede tener entre 4 y ~9 ítems según el plan/estado del
    // afiliado (certificados + correo + Siigo + documentos), así que no se
    // puede adivinar su altura para decidir la posición. En vez de eso: si
    // no hay espacio razonable debajo del botón pero sí arriba, se ancla por
    // "bottom" (crece hacia arriba con su altura real, como un menú
    // contextual) y siempre se limita su alto máximo al espacio disponible
    // real, con scroll propio como respaldo si aun así no alcanza.
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

  ngOnInit(): void {
    // debounce text filter changes
    this.filterSubject.pipe(debounceTime(400)).subscribe(() => {
      this.currentPage.set(1);
      this.loadAffiliates();
    });
    this._configGeneralService.getValue(REGISTROS_POR_PAGINA_KEY).subscribe({
      next: (value) => {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed >= MIN_PAGE_SIZE) this.pageSize.set(parsed);
        this.loadAffiliates();
      },
      error: () => this.loadAffiliates(),
    });
    this.loadFilterOptions();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize.set(newSize);
    this.currentPage.set(1);
    this.loadAffiliates();
  }

  private buildFilters(): AffiliateFilters {
    return {
      page: this.currentPage(),
      limit: this.pageSize(),
      name: this.filterName || undefined,
      cedula: this.filterCedula || undefined,
      reference: this.filterReference || undefined,
      advisor: this.filterAdvisor || undefined,
      isActive: this.filterIsActive === '' ? undefined : this.filterIsActive === 'true',
      grupo: this.filterGrupo || undefined,
      entryDateFrom: this.filterEntryDateFrom || undefined,
      entryDateTo: this.filterEntryDateTo || undefined,
      paymentStatus: this.filterPaymentStatus === 'paid' || this.filterPaymentStatus === 'unpaid' ? this.filterPaymentStatus : undefined,
    };
  }

  loadAffiliates(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._service.getAffiliates(this.buildFilters()).subscribe({
      next: (res) => {
        this.affiliates.set(res.data);
        this.totalItems.set(res.total);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      },
    });
  }

  private loadFilterOptions(): void {
    this._service.getAdvisors().subscribe((list) => {
      this.advisorOptions.set(list.map((a) => ({ value: a.name, label: a.name })));
    });
    this._service.getReferences().subscribe((list) => {
      this.referenceOptions.set(list.map((r) => ({ value: r, label: r })));
    });
    this._service.getDepartments().subscribe((list: Department[]) => {
      this.departmentNameByCode = new Map(list.map((d) => [d.code, d.name]));
    });
  }

  getDepartmentName(departmentCode: string | null | undefined): string {
    if (!departmentCode) return '-';
    return this.departmentNameByCode.get(departmentCode) ?? '-';
  }

  // Triggered by text filter inputs (debounced)
  onTextFilterChange(): void {
    this.filterSubject.next();
  }

  // Triggered by dropdown filter changes (immediate)
  onDropdownFilterChange(): void {
    this.currentPage.set(1);
    this.loadAffiliates();
  }

  clearFilters(): void {
    this.filterName = '';
    this.filterCedula = '';
    this.filterReference = '';
    this.filterAdvisor = '';
    this.filterIsActive = '';
    this.filterGrupo = '';
    this.filterEntryDateFrom = '';
    this.filterEntryDateTo = '';
    this.filterPaymentStatus = '';
    this.currentPage.set(1);
    this.loadAffiliates();
  }

  get hasActiveFilters(): boolean {
    return !!(this.filterName || this.filterCedula || this.filterReference || this.filterAdvisor || this.filterIsActive || this.filterGrupo || this.filterEntryDateFrom || this.filterEntryDateTo || this.filterPaymentStatus);
  }

  // ── Paginación ────────────────────────────────────────────────────
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadAffiliates();
  }
  nextPage(): void { this.goToPage(this.currentPage() + 1); }
  previousPage(): void { this.goToPage(this.currentPage() - 1); }

  get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
  }

  // ── Acciones de la tabla ──────────────────────────────────────────
  openCreate(): void {
    if (!this._permission.check('create', undefined, 'Tu rol no tiene permiso para crear afiliados.')) return;
    this.formMode.set('create');
    this.selectedAffiliate.set(null);
    this.showFormModal.set(true);
  }

  openEdit(affiliate: AffiliateMember): void {
    if (!this._permission.check('edit', undefined, 'Tu rol no tiene permiso para editar afiliados.')) return;
    this.formMode.set('edit');
    this.selectedAffiliate.set(affiliate);
    this.showFormModal.set(true);
  }

  openInfo(affiliate: AffiliateMember): void {
    this.selectedAffiliate.set(affiliate);
    this.showInfoModal.set(true);
  }

  onInfoClosed(): void {
    this.showInfoModal.set(false);
    this.selectedAffiliate.set(null);
  }

  openDocuments(affiliate: AffiliateMember): void {
    this.selectedAffiliate.set(affiliate);
    this.showDocumentsModal.set(true);
  }

  onDocumentsClosed(): void {
    this.showDocumentsModal.set(false);
    this.selectedAffiliate.set(null);
  }

  openStatusToggle(affiliate: AffiliateMember): void {
    const message = affiliate.isActive
      ? 'Tu rol no tiene permiso para deshabilitar afiliados.'
      : 'Tu rol no tiene permiso para habilitar afiliados.';

    if (!this._permission.check('toggle', undefined, message)) return;
    this.selectedAffiliate.set(affiliate);
    this.showStatusModal.set(true);
  }

  onFormSaved(): void {
    this.showFormModal.set(false);
    this.selectedAffiliate.set(null);
    this.loadAffiliates();
  }

  onFormClosed(): void {
    this.showFormModal.set(false);
    this.selectedAffiliate.set(null);
  }

  onStatusConfirmed(): void {
    this.showStatusModal.set(false);
    this.selectedAffiliate.set(null);
    this.loadAffiliates();
  }

  onStatusCancelled(): void {
    this.showStatusModal.set(false);
    this.selectedAffiliate.set(null);
  }

  downloadDocument(affiliate: AffiliateMember, doc?: AffiliateDocument): void {
    if (!affiliate.id || !affiliate.documents || affiliate.documents.length === 0) return;
    const target = doc ?? affiliate.documents[0];
    const documentId = target.id;
    const ext = target.fileName.includes('.') ? target.fileName.split('.').pop() : '';
    // Si hay más de un documento, se agrega la posición al nombre para no
    // sobrescribir el archivo anterior al descargar varios del mismo afiliado.
    const suffix = affiliate.documents.length > 1 ? `_${affiliate.documents.indexOf(target) + 1}` : '';
    const downloadName = ext ? `${affiliate.documentNumber}${suffix}.${ext}` : `${affiliate.documentNumber}${suffix}`;

    this._toast.showInfo('Descarga en proceso...');

    this._service.downloadBlob(affiliate.id, documentId).subscribe({
      next: (blob) => {
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = downloadName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(objectUrl);
        this._toast.showSuccess('Descarga exitosa');
      },
      error: (err) => {
        this._toast.showError('No se pudo descargar el archivo');
        this.errorMessage.set(err.message);
      }
    });
  }

  downloadExcel(): void {
    if (!this._permission.check('export', undefined, 'Tu rol no tiene permiso para descargar reportes en Excel.')) return;
    if (this.totalItems() === 0) {
      this._toast.showError('No hay resultados para descargar con los filtros actuales.');
      return;
    }

    this.isDownloadingExcel.set(true);
    this.errorMessage.set(null);
    this._toast.showInfo('Descarga en proceso...');

    const exportFilters: AffiliateFilters = {
      name: this.filterName || undefined,
      cedula: this.filterCedula || undefined,
      reference: this.filterReference || undefined,
      advisor: this.filterAdvisor || undefined,
      isActive: this.filterIsActive === '' ? undefined : this.filterIsActive === 'true',
      grupo: this.filterGrupo || undefined,
      entryDateFrom: this.filterEntryDateFrom || undefined,
      entryDateTo: this.filterEntryDateTo || undefined,
      paymentStatus: this.filterPaymentStatus === 'paid' || this.filterPaymentStatus === 'unpaid' ? this.filterPaymentStatus : undefined,
    };

    this._service.exportToExcel(exportFilters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `afiliados_${timestamp}.xlsx`;
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

  // ── Utilidades ────────────────────────────────────────────────────
  formatDate(date?: string | Date): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    // Extract date from UTC ISO string directly — the DB session (America/Bogota) stores
    // timestamp-without-tz values as Colombia-local time, so the UTC date portion IS the correct Colombia date.
    const [y, m, day] = d.toISOString().substring(0, 10).split('-');
    return `${day}/${m}/${y}`;
  }

  isEmptyValue(value: any): boolean {
    if (value === null || value === undefined) return true;
    const str = String(value).trim().toUpperCase();
    return str === '' || str === '-' || str === 'N/A' || str === 'NO APLICA';
  }

  get allAffiliatesForModal(): AffiliateMember[] {
    return this.affiliates();
  }

  isGestionAffiliate(affiliate: AffiliateMember): boolean {
    const name = (affiliate.grouperName ?? '').toUpperCase();
    const grouperId = Number(affiliate.grouperId);
    const isGestion = name.includes('GESTION') || grouperId === 1;
    const hasDocument = !!(affiliate.documents && affiliate.documents.length > 0);
    return isGestion && hasDocument;
  }

  isIndependienteAffiliate(affiliate: AffiliateMember): boolean {
    return (affiliate.affiliateType ?? '').toUpperCase() === 'INDEPENDIENTE';
  }

  // El envío de correo aplica a agrupadora GESTIÓN (con documento) y a afiliados
  // INDEPENDIENTE (no tienen agrupadora, pero sí requieren documento propio).
  canSendEmail(affiliate: AffiliateMember): boolean {
    return this.isGestionAffiliate(affiliate) || this.isIndependienteAffiliate(affiliate);
  }

  // Los nombres de plan son compuestos (ej: 'EPS+ARL2+CCF+AFP'): esa es la única fuente
  // de verdad de qué beneficios aplican. No basta con que el campo tenga valor (arl
  // llega en 0 por defecto, no null, aunque el plan no incluya ARL).
  private planIncludes(affiliate: AffiliateMember, token: string): boolean {
    return (affiliate.planName || '').toUpperCase().includes(token);
  }

  planHasEps(affiliate: AffiliateMember): boolean {
    return this.planIncludes(affiliate, 'EPS');
  }

  planHasArl(affiliate: AffiliateMember): boolean {
    return this.planIncludes(affiliate, 'ARL');
  }

  planHasCcf(affiliate: AffiliateMember): boolean {
    return this.planIncludes(affiliate, 'CCF');
  }

  planHasPension(affiliate: AffiliateMember): boolean {
    return this.planIncludes(affiliate, 'AFP');
  }

  // ── Check de documentos (EPS/ARL/CCF/Pensión) inline desde la tabla ────
  // Antes solo se podía marcar el certificado abriendo el modal de edición
  // completo; esto permite alternarlo directo desde la afiliación en la fila.
  togglingCertId = signal<string | null>(null);

  toggleCert(affiliate: AffiliateMember, field: 'certArl' | 'certEps' | 'certPension' | 'certCcf'): void {
    if (!this._permission.check('edit', undefined, 'Tu rol no tiene permiso para editar afiliados.')) return;
    if (!affiliate.id || this.togglingCertId() !== null) return;

    const newValue = !affiliate[field];
    this.togglingCertId.set(affiliate.id);
    this._service
      .updateAffiliate(affiliate.id, {
        documentNumber: affiliate.documentNumber,
        cityCode: affiliate.cityCode,
        [field]: newValue,
      })
      .subscribe({
        next: () => {
          affiliate[field] = newValue;
          this.togglingCertId.set(null);
          this._toast.showSuccess('Certificado actualizado');
        },
        error: (err) => {
          this._toast.showError(err.message ?? 'No se pudo actualizar el certificado');
          this.togglingCertId.set(null);
        },
      });
  }

  sendEmail(affiliate: AffiliateMember): void {
    if (!this._permission.check('send_email', undefined, 'Tu rol no tiene permiso para enviar correos de afiliación.')) {
      return;
    }

    this.selectedAffiliate.set(affiliate);
    // Elegir varios correos destino es exclusivo de Independiente. Para Gestión
    // (y cualquier otro Dependiente elegible) solo se pide la observación del
    // correo; el envío va siempre al correo registrado del afiliado.
    if (this.isIndependienteAffiliate(affiliate)) {
      this.showSendEmailModal.set(true);
    } else {
      this.showSendEmailObservationModal.set(true);
    }
  }

  onEmailSent(): void {
    this.showSendEmailModal.set(false);
    this.showSendEmailObservationModal.set(false);
    this.selectedAffiliate.set(null);
    this.loadAffiliates();
  }

  onEmailModalCancelled(): void {
    this.showSendEmailModal.set(false);
    this.showSendEmailObservationModal.set(false);
    this.selectedAffiliate.set(null);
  }

  syncToSiigo(affiliate: AffiliateMember): void {
    if (!this._permission.check('edit', undefined, 'Tu rol no tiene permiso para sincronizar afiliados con Siigo.')) {
      return;
    }

    const affiliationId = Number(affiliate.id);
    if (!affiliationId || this.syncingSiigoId() !== null) return;

    this.syncingSiigoId.set(affiliationId);
    this._toast.showInfo('Subiendo afiliado a Siigo...');
    this._service.syncToSiigo(affiliationId).subscribe({
      next: (result) => {
        if (result?.siigoSyncStatus === 'SUCCESS') {
          this._toast.showSuccess('Afiliado subido a Siigo correctamente');
        } else {
          this._toast.showError(result?.siigoSyncError || 'No se pudo subir el afiliado a Siigo');
        }
        this.loadAffiliates();
        this.syncingSiigoId.set(null);
      },
      error: (err) => {
        this._toast.showError(err.message ?? 'No se pudo subir el afiliado a Siigo');
        this.syncingSiigoId.set(null);
      },
    });
  }
}
