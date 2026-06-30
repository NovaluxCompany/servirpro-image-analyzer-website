import { Component, inject, input, output, OnInit, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateMember, CreateAffiliateMemberDto } from '../../interfaces/affiliate-member.interface';
import { Plan, Company, Grouper, Advisor, EpsItem, Pension, CompensationBox } from '../../interfaces/catalog.interface';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/components/searchable-select/searchable-select';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-affiliate-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
  templateUrl: './affiliate-form-modal.html',
})
export class AffiliateFormModalComponent implements OnInit {
  private _fb = inject(FormBuilder);
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  mode = input<'create' | 'edit'>('create');
  affiliate = input<AffiliateMember | null>(null);
  existingAffiliates = input<AffiliateMember[]>([]);

  saved = output<void>();
  closed = output<void>();

  isLoading = signal(false);
  duplicateDocument = signal(false);
  errorMessage = signal<string | null>(null);
  fileError = signal<string | null>(null);
  catalogsLoading = signal(true);

  plans = signal<Plan[]>([]);
  companies = signal<Company[]>([]);
  groupers = signal<Grouper[]>([]);
  advisors = signal<Advisor[]>([]);
  epsList = signal<EpsItem[]>([]);
  pensions = signal<Pension[]>([]);
  compensationBoxes = signal<CompensationBox[]>([]);
  references = signal<string[]>([]);

  section1Open = true
  section2Open = true
  section3Open = true

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CC', label: 'CC' },
    { value: 'CE', label: 'CE' },
    { value: 'TI', label: 'TI' },
    { value: 'NIT', label: 'NIT' },
    { value: 'PPT', label: 'PPT' },
  ];

  toggleSection1() {
    this.section1Open = !this.section1Open;
  }

  toggleSection2() {
    this.section2Open = !this.section2Open;
  }

  toggleSection3() {
    this.section3Open = !this.section3Open;
  }

  // SelectOption arrays for searchable dropdowns
  get planOptions(): SelectOption[] {
    return this.plans().map((p) => ({ value: String(p.id), label: p.name }));
  }
  get companyOptions(): SelectOption[] {
    return this.companies().map((c) => ({ value: String(c.id), label: c.name }));
  }
  get grouperOptions(): SelectOption[] {
    return this.groupers().map((g) => ({ value: String(g.id), label: g.name }));
  }
  get advisorOptions(): SelectOption[] {
    return this.advisors().map((a) => ({ value: String(a.id), label: a.name }));
  }
  get epsOptions(): SelectOption[] {
    return this.epsList().map((e) => ({ value: String(e.id), label: e.name }));
  }
  get referenceOptions(): SelectOption[] {
    return this.references().map((r) => ({ value: r, label: r }));
  }
  get pensionOptions(): SelectOption[] {
    return this.pensions().map((p) => ({
      value: String(p.id),
      label: (p as any).namePensions || p.name
    }));
  }
  get compensationBoxOptions(): SelectOption[] {
    return this.compensationBoxes().map((c) => ({ value: String(c.id), label: (c as any).nameCompensationBox || c.name }));
  }
  readonly genderOptions: SelectOption[] = [
    { value: 'MASCULINO', label: 'Hombre' },
    { value: 'FEMENINO', label: 'Mujer' },
  ];

  form = this._fb.group({
    // Datos personales
    documentType: ['CC', Validators.required],
    documentNumber: ['', [Validators.required, Validators.maxLength(20)]],
    firstName: ['', [Validators.required, Validators.maxLength(255)]],
    lastName: ['', [Validators.required, Validators.maxLength(255)]],
    birthDate: [''],
    documentExpDate: [''],
    gender: [''],
    phone: ['', Validators.maxLength(50)],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.maxLength(500)],
    municipality: ['', Validators.maxLength(255)],
    reference: ['', Validators.required],
    profession: ['', Validators.maxLength(255)],
    //Fecha whatsapp
    companyEntryDate: [{ value: '', disabled: false }, Validators.required],
    // Datos de afiliación
    planId: ['', Validators.required],
    companyId: [''],
    grouperId: ['', Validators.required],
    advisorId: ['', Validators.required],
    epsId: [''],
    pensionId: [''],
    compensationBoxId: [''],
    isActive: [true],
    entryDate: [{ value: '', disabled: true }],
    observation: ['', Validators.maxLength(2000)],
    documentFile: [<File | string | null>null],
    // Seguridad social (sin ADRES, sin price/deposit/charge)
    arl: [<number | null>null],
    // Certificados de documentación (solo en edición)
    certArl: [{ value: false, disabled: true }],
    certEps: [{ value: false, disabled: true }],
    certPension: [{ value: false, disabled: true }],
    certCcf: [{ value: false, disabled: true }],
  });

  constructor() {
    effect(() => {
      if (this.isVisible()) {
        this.loadCatalogs();
        if (this.mode() === 'edit' && this.affiliate()) {
          this.patchForm(this.affiliate()!);
        } else {
          this.form.reset();
          this.form.patchValue({
            documentType: 'CC',
            isActive: true,
          });
          this.form.get('entryDate')?.setValue(this.todayDate());
          this.form.get('companyEntryDate')?.setValue(this.todayDate());
          // In create mode: entryDate is automatic (disabled), companyEntryDate is freely editable
          this.form.get('entryDate')?.disable({ emitEvent: false });
          this.form.get('companyEntryDate')?.enable({ emitEvent: false });
          // Asegurar que el campo de archivo esté siempre habilitado en modo creación
          this.form.get('documentFile')?.enable({ emitEvent: false });
          this.form.get('documentFile')?.clearValidators();
          this.form.get('documentFile')?.updateValueAndValidity({ emitEvent: false });
          this.duplicateDocument.set(false);
          this.errorMessage.set(null);
          this.selectedFile = null;
          this.existingDocumentId = null;
          this.keepExistingDocument = true;
          this.fileError.set(null);
          if (this.fileInputRef?.nativeElement) {
            this.fileInputRef.nativeElement.value = '';
          }
        }
      }
    });
  }

  selectedPlanLabel: string = '';
  selectedGrouperLabel: string = '';

  validateAfp(pensionControl: AbstractControl | null) {
    if (!this.selectedPlanLabel.includes('AFP')) {
      pensionControl?.disable();
      pensionControl?.setValue('');
      pensionControl?.clearValidators();
    } else {
      pensionControl?.setValidators([Validators.required]);
      pensionControl?.enable();
    }
  }

  validateArl(arlControl: AbstractControl | null) {
    if (!this.selectedPlanLabel.includes('ARL')) {
      arlControl?.disable();
      arlControl?.setValue('');
      arlControl?.clearValidators();
    } else {
      arlControl?.setValidators(Validators.required);
      arlControl?.enable();
    }
  }

  validateCcf(ccfControl: AbstractControl | null) {
    if (!this.selectedPlanLabel.includes('CCF')) {
      ccfControl?.disable();
      ccfControl?.setValue('');
      ccfControl?.clearValidators();
    } else {
      ccfControl?.setValidators([Validators.required]);
      ccfControl?.enable();
    }
  }

  validateEps(epsControl: AbstractControl | null) {
    if (!this.selectedPlanLabel.includes('EPS')) {
      epsControl?.disable();
      epsControl?.setValue('');
      epsControl?.clearValidators();
    } else {
      epsControl?.setValidators(Validators.required);
      epsControl?.enable();
    }
  }

  validateDocumentFile() {
    const fileControl = this.form.get('documentFile');
    if (!fileControl) return;

    const label = this.selectedGrouperLabel || '';
    const existingDoc = this.affiliate()?.documents?.[0];
    const existingDisplayName = existingDoc?.fileName?.split('/').pop() || existingDoc?.fileName || '';

    // El campo de archivo siempre está habilitado sin importar la agrupadora
    fileControl.enable({ emitEvent: false });

    // Solo es obligatorio para GESTIÓN
    if (label.includes('GESTIÓN') || label.includes('GESTION')) {
      fileControl.setValidators([Validators.required]);
    } else {
      // Para cualquier otra agrupadora: opcional (sin validadores)
      fileControl.clearValidators();
    }

    // En modo edición, restaurar documento existente si no se ha cambiado
    if (this.isEdit && this.existingDocumentId && this.keepExistingDocument && !fileControl.value) {
      if (existingDisplayName) {
        fileControl.setValue(existingDisplayName, { emitEvent: false });
      }
    }

    fileControl.updateValueAndValidity({ emitEvent: false });
  }

  // Verificar si la agrupación actual es de GESTIÓN
  get isGestionGrouper(): boolean {
    const label = this.selectedGrouperLabel || '';
    return label.includes('GESTIÓN') || label.includes('GESTION');
  }

  ngOnInit() {
    this.form.get('planId')?.valueChanges.subscribe(value => {
      this.updatePlanLogic(value);
    });

    const initialValue = this.form.get('planId')?.value;
    if (initialValue) {
      this.updatePlanLogic(initialValue);
    }

    this.form.get('grouperId')?.valueChanges.subscribe((value) => {
      if (!value) {
        this.selectedGrouperLabel = '';
        this.validateDocumentFile();
        return;
      }

      const selectedGrouper = this.groupers().find(g => String(g.id) === String(value));
      this.selectedGrouperLabel = selectedGrouper ? selectedGrouper.name.toUpperCase() : '';

      this.validateDocumentFile();
    });
  }

  private updatePlanLogic(planId: any) {
    const plan = this.planOptions.find(p => p.value === planId);
    this.selectedPlanLabel = plan ? plan.label.toUpperCase() : '';

    this.validateAfp(this.form.get('pensionId'));
    this.validateArl(this.form.get('arl'));
    this.validateCcf(this.form.get('compensationBoxId'));
    this.validateEps(this.form.get('epsId'));

    this.updateCertControls();
  }

  private updateCertControls(): void {
    const label = this.selectedPlanLabel;

    const certArl = this.form.get('certArl');
    const certEps = this.form.get('certEps');
    const certPension = this.form.get('certPension');
    const certCcf = this.form.get('certCcf');

    if (label.includes('ARL')) {
      certArl?.enable({ emitEvent: false });
    } else {
      certArl?.setValue(false, { emitEvent: false });
      certArl?.disable({ emitEvent: false });
    }

    if (label.includes('EPS')) {
      certEps?.enable({ emitEvent: false });
    } else {
      certEps?.setValue(false, { emitEvent: false });
      certEps?.disable({ emitEvent: false });
    }

    if (label.includes('AFP')) {
      certPension?.enable({ emitEvent: false });
    } else {
      certPension?.setValue(false, { emitEvent: false });
      certPension?.disable({ emitEvent: false });
    }

    if (label.includes('CCF')) {
      certCcf?.enable({ emitEvent: false });
    } else {
      certCcf?.setValue(false, { emitEvent: false });
      certCcf?.disable({ emitEvent: false });
    }
  }

  get isEdit(): boolean {
    return this.mode() === 'edit';
  }

  get title(): string {
    return this.isEdit ? 'Editar Afiliado' : 'Nuevo Afiliado';
  }

  private todayDate(): string {
    // Get current date in Colombia timezone (UTC-5) to avoid UTC day mismatch
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  }

  private toLocalDateStr(value: string | Date | null | undefined): string {
    if (!value) return '';
    const str = typeof value === 'string' ? value : value.toISOString();
    // Handle DD-MM-YYYY or DD/MM/YYYY format
    const ddmmyyyy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
    // Take the first 10 chars (YYYY-MM-DD). Date fields from the backend come as pure date strings
    // or as UTC-midnight timestamps; both yield the correct Colombia calendar date via substring.
    return str.substring(0, 10);
  }

  private loadCatalogs(): void {
    this.catalogsLoading.set(true);
    forkJoin({
      plans: this._service.getPlans(),
      companies: this._service.getCompanies(),
      groupers: this._service.getGroupers(),
      advisors: this._service.getAdvisors(),
      epsList: this._service.getEpsList(),
      references: this._service.getReferences(),
      pensions: this._service.getPensions(),
      compensationBoxes: this._service.getCompensationBoxes(),
    }).subscribe({
      next: ({ plans, companies, groupers, advisors, epsList, references, pensions, compensationBoxes }) => {
        this.plans.set(plans);
        this.companies.set(companies);
        this.groupers.set(groupers);
        this.advisors.set(advisors);
        this.epsList.set(epsList);
        this.references.set(references);
        this.pensions.set(pensions);
        this.compensationBoxes.set(compensationBoxes);
        this.catalogsLoading.set(false);

        // Re-run plan/grouper logic once catalogs are loaded (edit mode has values before catalogs arrive)
        const currentPlanId = this.form.get('planId')?.value;
        if (currentPlanId) {
          this.updatePlanLogic(currentPlanId);
        }
        const currentGrouperId = this.form.get('grouperId')?.value;
        if (currentGrouperId) {
          const selectedGrouper = this.groupers().find(g => String(g.id) === String(currentGrouperId));
          this.selectedGrouperLabel = selectedGrouper ? selectedGrouper.name.toUpperCase() : '';
          this.validateDocumentFile();
        }
      },
      error: () => this.catalogsLoading.set(false),
    });
  }

  private patchForm(a: AffiliateMember): void {
    this.selectedFile = null;
    this.existingDocumentId = a.documents?.[0]?.id ?? null;
    this.keepExistingDocument = true;
    this.fileError.set(null);
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
    this.form.patchValue({
      documentType: a.documentType,
      documentNumber: a.documentNumber,
      firstName: a.firstName ?? '',
      lastName: a.lastName ?? '',
      birthDate: this.toLocalDateStr(a.birthDate),
      documentExpDate: this.toLocalDateStr(a.documentExpDate),
      gender: a.gender ?? '',
      phone: a.phone ?? '',
      email: a.email ?? '',
      address: a.address ?? '',
      municipality: a.municipality ?? '',
      reference: a.reference ?? '',
      profession: a.profession ?? '',

      companyId: a.companyId ? String(a.companyId) : '',
      planId: a.planId ? String(a.planId) : '',
      grouperId: a.grouperId ? String(a.grouperId) : '',
      advisorId: a.advisorId ? String(a.advisorId) : '',
      epsId: a.epsId ? String(a.epsId) : '',
      isActive: a.isActive ?? true,
      companyEntryDate: this.toLocalDateStr(a.companyEntryDate ?? this.todayDate()),
      entryDate: this.toLocalDateStr(a.entryDate),
      arl: a.arl ?? null,
      pensionId: a.pensionId ? String(a.pensionId) : '',
      compensationBoxId: a.compensationBoxId ? String(a.compensationBoxId) : '',
      observation: a.observation ?? '',
      certArl: a.certArl ?? false,
      certEps: a.certEps ?? false,
      certPension: a.certPension ?? false,
      certCcf: a.certCcf ?? false,
    });

    // In edit mode: entryDate is fixed (disable to prevent editing), companyEntryDate is editable (enable)
    this.form.get('entryDate')?.disable({ emitEvent: false });
    this.form.get('companyEntryDate')?.enable({ emitEvent: false });

    const existingDoc = a.documents?.[0];
    if (existingDoc) {
      const displayName = existingDoc.fileName.split('/').pop() || existingDoc.fileName;
      this.form.get('documentFile')?.setValue(displayName, { emitEvent: false });
    } else {
      this.form.get('documentFile')?.setValue('', { emitEvent: false });
    }

    this.errorMessage.set(null);
  }

  selectedFile: File | null = null;
  existingDocumentId: number | null = null;
  private keepExistingDocument = true;
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  private static readonly ALLOWED_FILE_TYPES = ['application/pdf'];
  private static readonly MAX_FILE_SIZE_MB = 10;

  onFileSelected(event: any): void {
    const file: File | null = event.target.files?.[0] ?? null;
    this.fileError.set(null);

    if (!file) {
      this.selectedFile = null;
      this.form.get('documentFile')?.setValue(null, { emitEvent: false });
      return;
    }

    if (!AffiliateFormModalComponent.ALLOWED_FILE_TYPES.includes(file.type)) {
      this.fileError.set('Solo se permiten archivos en formato PDF.');
      this.selectedFile = null;
      this.form.get('documentFile')?.setValue(null, { emitEvent: false });
      event.target.value = '';
      return;
    }

    const maxBytes = AffiliateFormModalComponent.MAX_FILE_SIZE_MB * 1024 * 1024;
     if (file.size > maxBytes) {
      this.fileError.set(`El archivo no puede superar ${AffiliateFormModalComponent.MAX_FILE_SIZE_MB} MB.`);
      this.selectedFile = null;
      this.form.get('documentFile')?.setValue(null, { emitEvent: false });
      event.target.value = '';
      return;
    }

    this.selectedFile = file;
    this.keepExistingDocument = false;
    this.form.get('documentFile')?.setValue(file.name, { emitEvent: false });
  }

  clearFile(): void {
    this.selectedFile = null;
    this.keepExistingDocument = false;
    this.fileError.set(null);
    this.form.get('documentFile')?.setValue(null, { emitEvent: false });
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  onDocumentNumberBlur(): void {
    this.checkDuplicate();
  }

  private checkDuplicate(): void {
    const docNumber = this.form.value.documentNumber?.trim();
    if (!docNumber) { this.duplicateDocument.set(false); return; }
    const currentDocNumber = this.affiliate()?.documentNumber?.trim();
    const exists = this.existingAffiliates().some(
      (a) => a.documentNumber?.trim() === docNumber && a.documentNumber?.trim() !== currentDocNumber
    );
    this.duplicateDocument.set(exists);
  }

  onClose(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    this.checkDuplicate();
    if (this.duplicateDocument()) {
      this.errorMessage.set('Ya existe un afiliado con ese número de documento.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    const toNumberOrNull = (value: any): number | null => {
      if (value === null || value === undefined || String(value).trim() === '') {
        return null;
      }
      const parsed = Number(value);
      return isNaN(parsed) ? null : parsed;
    };
    const firstName = (raw.firstName ?? '').trim();
    const lastName = (raw.lastName ?? '').trim();
    const dto: CreateAffiliateMemberDto = {
      documentType: raw.documentType!,
      documentNumber: raw.documentNumber!,
      firstName,
      lastName,
      fullName: [firstName, lastName].filter(Boolean).join(' '),
      birthDate: raw.birthDate || undefined,
      documentExpDate: raw.documentExpDate || undefined,
      phone: raw.phone || undefined,
      email: raw.email || undefined,
      address: raw.address || undefined,
      municipality: raw.municipality || undefined,
      reference: raw.reference!,
      profession: raw.profession || undefined,
      gender: raw.gender || undefined,
      whatsappEntryDate: this.todayDate(),
      planId: toNumberOrNull(raw.planId),
      companyId: toNumberOrNull(raw.companyId),
      grouperId: toNumberOrNull(raw.grouperId),
      advisorId: toNumberOrNull(raw.advisorId),
      epsId: toNumberOrNull(raw.epsId),
      pensionId: toNumberOrNull(raw.pensionId),
      compensationBoxId: toNumberOrNull(raw.compensationBoxId),
      isActive: raw.isActive ?? true,
      // companyEntryDate comes from its own form control (disabled), NOT from entryDate
      companyEntryDate: raw.companyEntryDate || this.toLocalDateStr(this.todayDate()),
      // entryDate only sent on create; in edit mode the backend ignores it (only set on create/enable)
      entryDate: this.isEdit ? undefined : (raw.entryDate || this.toLocalDateStr(this.todayDate())),
      arl: raw.arl ?? undefined,
      observation: raw.observation?.trim() || undefined,
      ...(this.isEdit ? {
        certArl: raw.certArl ?? false,
        certEps: raw.certEps ?? false,
        certPension: raw.certPension ?? false,
        certCcf: raw.certCcf ?? false,
      } : {}),
    };

    const obs =
      this.isEdit && this.affiliate()?.id
        ? this._service.updateAffiliate(this.affiliate()!.id!, dto)
        : this._service.createAffiliate(dto);

    obs.subscribe({
      next: (result: any) => {
        const successMsg = this.isEdit ? 'Afiliado actualizado exitosamente' : 'Afiliación creada exitosamente';
        const affiliateId = result?.id ?? this.affiliate()?.id;

        const finalize = () => {
          this._toast.showSuccess(successMsg);
          this.isLoading.set(false);
          this.saved.emit();
        };

        const uploadNewFile = () => {
          if (this.selectedFile && affiliateId) {
            this._service.uploadDocument(affiliateId, this.selectedFile).subscribe({
              next: () => finalize(),
              error: () => {
                this.fileError.set('El afiliado fue guardado, pero no se pudo subir el documento. Inténtalo nuevamente.');
                finalize();
              },
            });
          } else {
            finalize();
          }
        };

        // Delete old document if needed (grouper changed away from GESTIÓN, or user replaced/cleared file)
        const shouldDelete = !this.keepExistingDocument && !!this.existingDocumentId && !!affiliateId;
        if (shouldDelete) {
          this._service.deleteDocument(affiliateId!, this.existingDocumentId!).subscribe({
            next: () => uploadNewFile(),
            error: () => uploadNewFile(), // Continue even if delete fails
          });
        } else {
          uploadNewFile();
        }
      },
      error: (err) => {
        const backend = err?.error;
        if (backend?.message) {
          const msg = Array.isArray(backend.message)
            ? backend.message.join(' • ')
            : String(backend.message);
          this.errorMessage.set(msg);
        } else {
          this.errorMessage.set(err.message ?? 'Ha ocurrido un error inesperado.');
        }
        this.isLoading.set(false);
      },
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}

