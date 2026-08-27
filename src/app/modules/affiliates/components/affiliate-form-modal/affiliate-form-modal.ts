import { Component, inject, input, output, OnInit, signal, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';
import { AffiliateMember, CreateAffiliateMemberDto } from '../../interfaces/affiliate-member.interface';
import { Plan, Company, Grouper, Advisor, EpsItem, Pension, CompensationBox, Branch, Department, CityOption } from '../../interfaces/catalog.interface';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/components/searchable-select/searchable-select';
import { forkJoin, of, switchMap } from 'rxjs';

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
  private _permission = inject(PermissionService);

  // La fecha de ingreso es automática (se fija al crear y al habilitar al afiliado).
  // Solo los roles con el permiso 'edit_entry_date' sobre /afiliados —Administrador
  // por defecto— pueden corregirla a mano; el backend lo vuelve a validar.
  readonly canEditEntryDate = this._permission.can('edit_entry_date', '/afiliados');

  isVisible = input<boolean>(false);
  mode = input<'create' | 'edit'>('create');
  affiliate = input<AffiliateMember | null>(null);
  existingAffiliates = input<AffiliateMember[]>([]);

  saved = output<void>();
  closed = output<void>();

  isLoading = signal(false);
  duplicateDocument = signal(false);
  duplicateDocumentMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  fileError = signal<string | null>(null);
  catalogsLoading = signal(true);
  // Mientras esto sea true, el select de Municipio se muestra en un placeholder
  // en vez del valor real, para no mostrar el código crudo un instante antes de
  // que lleguen los municipios del departamento (parpadeo código -> nombre).
  citiesLoading = signal(true);
  // En modo edición, controla si ya se cargaron catálogos + ciudades del afiliado
  // y se rellenó el formulario. Mientras sea false, el modal muestra un loader en
  // vez del formulario, para no pintar campos que luego "cambian solos" cuando
  // llegan los catálogos (profesión, ARL, AFP, CCF, EPS, municipio, etc.).
  formReady = signal(true);

  plans = signal<Plan[]>([]);
  companies = signal<Company[]>([]);
  groupers = signal<Grouper[]>([]);
  advisors = signal<Advisor[]>([]);
  epsList = signal<EpsItem[]>([]);
  pensions = signal<Pension[]>([]);
  compensationBoxes = signal<CompensationBox[]>([]);
  branches = signal<Branch[]>([]);
  references = signal<string[]>([]);
  departments = signal<Department[]>([]);
  cities = signal<CityOption[]>([]);

  section1Open = true
  section2Open = false

  readonly documentTypeOptions: SelectOption[] = [
    { value: 'CC', label: 'CC' },
    { value: 'CE', label: 'CE' },
    { value: 'TI', label: 'TI' },
    { value: 'NIT', label: 'NIT' },
    { value: 'PPT', label: 'PPT' },
  ];

  toggleSection1() {
    this.section1Open = !this.section1Open;
    if (this.section1Open) this.section2Open = false;
  }

  toggleSection2() {
    this.section2Open = !this.section2Open;
    if (this.section2Open) this.section1Open = false;
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
  get branchOptions(): SelectOption[] {
    return this.branches().map((b) => ({ value: String(b.id), label: b.name }));
  }
  get departmentOptions(): SelectOption[] {
    return this.departments().map((d) => ({ value: d.code, label: d.name }));
  }
  get cityOptions(): SelectOption[] {
    return this.cities().map((c) => ({ value: c.cityCode, label: c.cityName }));
  }
  readonly genderOptions: SelectOption[] = [
    { value: 'MASCULINO', label: 'Hombre' },
    { value: 'FEMENINO', label: 'Mujer' },
  ];

  /** Estado del afiliado en edición, usado para bloquear campos como referralType. */
  affiliateIsActive = false;

  form = this._fb.group({
    // Datos personales
    documentType: ['CC', Validators.required],
    documentNumber: ['', [Validators.required, Validators.maxLength(11)]],
    firstName: ['', [Validators.required, Validators.maxLength(255)]],
    lastName: ['', [Validators.required, Validators.maxLength(255)]],
    birthDate: [''],
    documentExpDate: [''],
    gender: [''],
    phone: ['', Validators.maxLength(50)],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.maxLength(500)],
    municipality: ['', [Validators.required, Validators.maxLength(255)]],
    departmentCode: ['', Validators.required],
    cityCode: ['', Validators.required],
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
    branchId: [''],
    isActive: [true],
    discount: [<number | null>null],
    affiliateType: ['DEPENDIENTE', Validators.required],
    isNew: [false],
    referralType: ['', Validators.required],
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
        this.section1Open = true;
        this.section2Open = false;
        if (this.mode() === 'edit' && this.affiliate()) {
          this.formReady.set(false);
          this.loadEditData(this.affiliate()!);
        } else {
          this.loadCatalogs();
          this.formReady.set(true);
          this.citiesLoading.set(false);
          this.form.reset();
          this.form.patchValue({
            documentType: 'CC',
            isActive: true,
          });
          this.form.get('entryDate')?.setValue(this.todayDate());
          this.form.get('companyEntryDate')?.setValue(this.todayDate());
          // In create mode: entryDate is automatic (solo editable con permiso), companyEntryDate is freely editable
          this.applyEntryDatePermission();
          this.form.get('companyEntryDate')?.enable({ emitEvent: false });
          // El bloqueo de plan/origen por afiliado activo solo aplica en edición
          this.affiliateIsActive = false;
          this.form.get('planId')?.enable({ emitEvent: false });
          this.form.get('referralType')?.enable({ emitEvent: false });
          // Asegurar que el campo de archivo esté siempre habilitado en modo creación
          this.form.get('documentFile')?.enable({ emitEvent: false });
          this.form.get('documentFile')?.clearValidators();
          this.form.get('documentFile')?.updateValueAndValidity({ emitEvent: false });
          this.duplicateDocument.set(false);
          this.duplicateDocumentMessage.set(null);
          this.errorMessage.set(null);
          this.selectedFiles = [];
          this.existingDocumentId = null;
          this.keepExistingDocument = true;
          this.fileError.set(null);
          if (this.fileInputRef?.nativeElement) {
            this.fileInputRef.nativeElement.value = '';
          }
          this.validateAffiliateType();
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

  validateProfession(professionControl: AbstractControl | null) {
    if (!this.selectedPlanLabel.includes('ARL')) {
      professionControl?.setValue('', { emitEvent: false });
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

  /**
   * Habilita el input de fecha de ingreso solo si el rol tiene el permiso
   * 'edit_entry_date' sobre /afiliados. Para el resto sigue siendo un campo
   * automático de solo lectura, igual que antes.
   */
  private applyEntryDatePermission(): void {
    const entryDateControl = this.form.get('entryDate');
    if (this.canEditEntryDate) {
      entryDateControl?.enable({ emitEvent: false });
    } else {
      entryDateControl?.disable({ emitEvent: false });
    }
  }

  validateDocumentFile() {
    const fileControl = this.form.get('documentFile');
    if (!fileControl) return;

    const existingDoc = this.affiliate()?.documents?.[0];
    const existingDisplayName = existingDoc?.fileName?.split('/').pop() || existingDoc?.fileName || '';

    // El campo de archivo siempre está habilitado sin importar la agrupadora
    fileControl.enable({ emitEvent: false });

    // Obligatorio para afiliados INDEPENDIENTE y para la agrupadora GESTIÓN
    if (this.isDocumentRequired) {
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

  // Los afiliados INDEPENDIENTE no pertenecen a ninguna empresa/agrupadora: esos
  // campos quedan bloqueados y vacíos. El documento de soporte, en cambio, es
  // obligatorio para ellos (no tienen empresa que respalde la afiliación).
  get isIndependiente(): boolean {
    return this.form.get('affiliateType')?.value === 'INDEPENDIENTE';
  }

  // El PDF es obligatorio para los afiliados INDEPENDIENTE y para la agrupadora GESTIÓN.
  get isDocumentRequired(): boolean {
    return this.isIndependiente || this.isGestionGrouper;
  }

  // Campos que quedan bloqueados (deshabilitados y sin validadores) cuando el
  // afiliado es INDEPENDIENTE. No deben poder bloquear el botón de guardar.
  private readonly independentBlockedFields = ['companyId', 'grouperId'];

  // No se usa directamente `form.invalid`: aunque los controles bloqueados están
  // deshabilitados (lo que ya debería excluirlos de la validez del FormGroup),
  // se recalcula explícitamente ignorándolos para blindar el botón de guardar
  // ante cualquier caso donde ese control siga marcado como inválido.
  get isSubmitDisabled(): boolean {
    if (this.isLoading()) return true;
    if (!this.isIndependiente) return this.form.invalid;

    return Object.entries(this.form.controls).some(
      ([key, control]) => !this.independentBlockedFields.includes(key) && control.invalid,
    );
  }

  private validateAffiliateType(): void {
    const companyControl = this.form.get('companyId');
    const grouperControl = this.form.get('grouperId');

    if (this.isIndependiente) {
      companyControl?.disable({ emitEvent: false });
      companyControl?.setValue('', { emitEvent: false });

      grouperControl?.disable({ emitEvent: false });
      grouperControl?.setValue('', { emitEvent: false });
      grouperControl?.clearValidators();
      grouperControl?.updateValueAndValidity({ emitEvent: false });

      this.selectedGrouperLabel = '';
    } else {
      companyControl?.enable({ emitEvent: false });

      grouperControl?.enable({ emitEvent: false });
      grouperControl?.setValidators([Validators.required]);
      grouperControl?.updateValueAndValidity({ emitEvent: false });
    }

    // El documento se recalcula en ambos casos: para INDEPENDIENTE pasa a ser
    // obligatorio y el archivo ya cargado se conserva (antes se borraba).
    this.validateDocumentFile();
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

    this.form.get('departmentCode')?.valueChanges.subscribe((code) => {
      const cityControl = this.form.get('cityCode');
      cityControl?.setValue('', { emitEvent: false });
      this.form.get('municipality')?.setValue('', { emitEvent: false });
      if (!code) {
        this.cities.set([]);
        return;
      }
      this.loadCitiesForDepartment(code);
    });

    this.form.get('cityCode')?.valueChanges.subscribe((code) => {
      if (!code) return;
      const city = this.cities().find((c) => c.cityCode === code);
      if (city) {
        this.form.get('municipality')?.setValue(city.cityName, { emitEvent: false });
      }
    });

    this.form.get('affiliateType')?.valueChanges.subscribe(() => {
      this.validateAffiliateType();
    });
  }

  private loadCitiesForDepartment(departmentCode: string): void {
    this.citiesLoading.set(true);
    this._service.getCitiesByDepartment(departmentCode).subscribe((cities) => {
      this.cities.set(cities);
      this.citiesLoading.set(false);
    });
  }

  private updatePlanLogic(planId: any) {
    const plan = this.planOptions.find(p => p.value === planId);
    this.selectedPlanLabel = plan ? plan.label.toUpperCase() : '';

    this.validateAfp(this.form.get('pensionId'));
    this.validateArl(this.form.get('arl'));
    this.validateProfession(this.form.get('profession'));
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

  private loadCatalogs$() {
    this.catalogsLoading.set(true);
    return forkJoin({
      plans: this._service.getPlans(),
      companies: this._service.getCompanies(),
      groupers: this._service.getGroupers(),
      advisors: this._service.getAdvisors(),
      epsList: this._service.getEpsList(),
      references: this._service.getReferences(),
      pensions: this._service.getPensions(),
      compensationBoxes: this._service.getCompensationBoxes(),
      departments: this._service.getDepartments(),
      branches: this._service.getBranchesDropdown(),
    }).pipe(
      switchMap(({ plans, companies, groupers, advisors, epsList, references, pensions, compensationBoxes, departments, branches }) => {
        this.plans.set(plans);
        this.companies.set(companies);
        this.groupers.set(groupers);
        this.advisors.set(advisors);
        this.epsList.set(epsList);
        this.references.set(references);
        this.pensions.set(pensions);
        this.compensationBoxes.set(compensationBoxes);
        this.departments.set(departments);
        this.branches.set(branches);
        this.catalogsLoading.set(false);
        return of(null);
      }),
    );
  }

  private loadCatalogs(): void {
    this.loadCatalogs$().subscribe({
      error: () => this.catalogsLoading.set(false),
    });
  }

  // Modo edición: primero cargamos catálogos y las ciudades del departamento del
  // afiliado, y solo cuando todo eso ya está disponible rellenamos el formulario.
  // Así evitamos que patchForm() dispare valueChanges (planId, cityCode, etc.) con
  // catálogos todavía vacíos, que borraban campos (profesión, ARL, AFP, CCF, EPS,
  // municipio) y luego "aparecían solos" al reabrir el modal.
  private loadEditData(a: AffiliateMember): void {
    this.citiesLoading.set(true);
    this.loadCatalogs$().pipe(
      switchMap(() => a.departmentCode
        ? this._service.getCitiesByDepartment(a.departmentCode)
        : of([])),
    ).subscribe({
      next: (cities) => {
        this.cities.set(cities);
        this.citiesLoading.set(false);

        this.patchForm(a);

        if (a.planId) {
          this.updatePlanLogic(String(a.planId));
        }
        // El plan solo puede cambiarse mientras el afiliado está desactivado.
        this.affiliateIsActive = !!a.isActive;
        if (a.isActive) {
          this.form.get('planId')?.disable({ emitEvent: false });
          // El origen del afiliado solo puede corregirse mientras está desactivado.
          this.form.get('referralType')?.disable({ emitEvent: false });
        } else {
          this.form.get('planId')?.enable({ emitEvent: false });
          this.form.get('referralType')?.enable({ emitEvent: false });
        }
        if (a.grouperId) {
          const selectedGrouper = this.groupers().find(g => String(g.id) === String(a.grouperId));
          this.selectedGrouperLabel = selectedGrouper ? selectedGrouper.name.toUpperCase() : '';
        }
        this.validateAffiliateType();

        this.formReady.set(true);
      },
      error: () => {
        this.catalogsLoading.set(false);
        this.citiesLoading.set(false);
        this.formReady.set(true);
      },
    });
  }

  private patchForm(a: AffiliateMember): void {
    this.selectedFiles = [];
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
      departmentCode: a.departmentCode ?? '',
      cityCode: a.cityCode ?? '',
      reference: a.reference ?? '',
      profession: a.profession ?? '',

      companyId: a.companyId ? String(a.companyId) : '',
      planId: a.planId ? String(a.planId) : '',
      grouperId: a.grouperId ? String(a.grouperId) : '',
      advisorId: a.advisorId ? String(a.advisorId) : '',
      epsId: a.epsId ? String(a.epsId) : '',
      isActive: a.isActive ?? true,
      discount: a.discount ?? null,
      affiliateType: a.affiliateType ?? 'DEPENDIENTE',
      referralType: a.referralType ?? '',
      companyEntryDate: this.toLocalDateStr(a.companyEntryDate ?? this.todayDate()),
      entryDate: this.toLocalDateStr(a.entryDate),
      arl: a.arl ?? null,
      pensionId: a.pensionId ? String(a.pensionId) : '',
      compensationBoxId: a.compensationBoxId ? String(a.compensationBoxId) : '',
      branchId: a.branchId ? String(a.branchId) : '',
      observation: a.observation ?? '',
      certArl: a.certArl ?? false,
      certEps: a.certEps ?? false,
      certPension: a.certPension ?? false,
      certCcf: a.certCcf ?? false,
    }, { emitEvent: false });

    // In edit mode: entryDate solo se habilita para roles con permiso 'edit_entry_date';
    // companyEntryDate siempre es editable.
    this.applyEntryDatePermission();
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

  selectedFiles: File[] = [];
  existingDocumentId: number | null = null;
  private keepExistingDocument = true;
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  private static readonly ALLOWED_FILE_TYPES = ['application/pdf'];
  private static readonly MAX_FILE_SIZE_MB = 10;
  private static readonly MAX_FILES = 100;

  private updateDocumentFileControl(): void {
    const value = this.selectedFiles.length > 0 ? this.selectedFiles.map((f) => f.name).join(', ') : null;
    this.form.get('documentFile')?.setValue(value, { emitEvent: false });
  }

  onFileSelected(event: any): void {
    const files: File[] = Array.from(event.target.files ?? []);
    this.fileError.set(null);
    if (files.length === 0) return;

    if (this.selectedFiles.length + files.length > AffiliateFormModalComponent.MAX_FILES) {
      this.fileError.set(`Puedes adjuntar máximo ${AffiliateFormModalComponent.MAX_FILES} archivos.`);
      event.target.value = '';
      return;
    }

    const maxBytes = AffiliateFormModalComponent.MAX_FILE_SIZE_MB * 1024 * 1024;
    for (const file of files) {
      if (!AffiliateFormModalComponent.ALLOWED_FILE_TYPES.includes(file.type)) {
        this.fileError.set('Solo se permiten archivos en formato PDF.');
        event.target.value = '';
        return;
      }
      if (file.size > maxBytes) {
        this.fileError.set(`Cada archivo no puede superar ${AffiliateFormModalComponent.MAX_FILE_SIZE_MB} MB.`);
        event.target.value = '';
        return;
      }
    }

    this.selectedFiles = [...this.selectedFiles, ...files];
    this.keepExistingDocument = false;
    this.updateDocumentFileControl();
    event.target.value = '';
  }

  removeFile(index: number): void {
    this.selectedFiles = this.selectedFiles.filter((_, i) => i !== index);
    this.keepExistingDocument = false;
    this.fileError.set(null);
    this.updateDocumentFileControl();
  }

  clearFile(): void {
    this.selectedFiles = [];
    this.keepExistingDocument = false;
    this.fileError.set(null);
    this.form.get('documentFile')?.setValue(null, { emitEvent: false });
    if (this.fileInputRef?.nativeElement) {
      this.fileInputRef.nativeElement.value = '';
    }
  }

  onDocumentNumberBlur(): void {
    // Chequeo instantáneo con lo ya cargado en la página actual (feedback inmediato)...
    this.checkDuplicate();
    // ...y chequeo contra el backend (cubre afiliados fuera de la página actual/paginación,
    // y afiliados desactivados) para no descubrir el duplicado recién al enviar el formulario.
    this.checkDuplicateRemote();
  }

  private checkDuplicate(): void {
    const docNumber = this.form.value.documentNumber?.trim();
    if (!docNumber) { this.duplicateDocument.set(false); this.duplicateDocumentMessage.set(null); return; }
    const currentDocNumber = this.affiliate()?.documentNumber?.trim();
    const exists = this.existingAffiliates().some(
      (a) => a.documentNumber?.trim() === docNumber && a.documentNumber?.trim() !== currentDocNumber
    );
    this.duplicateDocument.set(exists);
    if (exists) {
      this.duplicateDocumentMessage.set('Ya existe un afiliado con este número de documento.');
    } else {
      this.duplicateDocumentMessage.set(null);
    }
  }

  private checkDuplicateRemote(): void {
    const docNumber = this.form.value.documentNumber?.trim();
    const currentDocNumber = this.affiliate()?.documentNumber?.trim();
    if (!docNumber || docNumber === currentDocNumber) return;

    this._service.checkDocumentExists(docNumber).subscribe((res) => {
      // Si mientras tanto el usuario ya cambió el campo, ignorar esta respuesta tardía.
      if (this.form.value.documentNumber?.trim() !== docNumber) return;
      if (res?.exists) {
        this.duplicateDocument.set(true);
        this.duplicateDocumentMessage.set(
          res.isActive
            ? 'Ya existe un afiliado activo con este número de documento.'
            : 'Ya existe un afiliado con este número de documento, pero está desactivado. Reactívalo en vez de crear uno nuevo.',
        );
      }
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    this.checkDuplicate();
    if (this.duplicateDocument()) {
      // El mensaje ya se muestra debajo del campo de documento (duplicateDocumentMessage);
      // no se repite en el banner de errorMessage para no duplicar el aviso.
      return;
    }
    if (this.isSubmitDisabled) {
      this.form.markAllAsTouched();
      return;
    }

    // Chequeo final y autoritativo contra el backend (cubre afiliados fuera de la
    // página actual y desactivados) antes de construir y enviar el DTO — así el
    // usuario nunca llena todo el formulario para enterarse del duplicado al final.
    const docNumber = this.form.value.documentNumber?.trim();
    const currentDocNumber = this.affiliate()?.documentNumber?.trim();

    if (docNumber && docNumber !== currentDocNumber) {
      this.isLoading.set(true);
      this._service.checkDocumentExists(docNumber).subscribe((res) => {
        if (res?.exists) {
          this.isLoading.set(false);
          this.duplicateDocument.set(true);
          this.duplicateDocumentMessage.set(
            res.isActive
              ? 'Ya existe un afiliado activo con este número de documento.'
              : 'Ya existe un afiliado con este número de documento, pero está desactivado. Reactívalo en vez de crear uno nuevo.',
          );
          return;
        }
        this.proceedWithSubmit();
      });
    } else {
      this.proceedWithSubmit();
    }
  }

  private proceedWithSubmit(): void {
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
      // municipality/departmentCode ya no son columnas de clients ni campos del DTO del
      // backend (forbidNonWhitelisted rechaza campos desconocidos): solo se usan aquí
      // para la cascada departamento -> municipio del formulario. Solo se envía cityCode,
      // que es la única columna real de ubicación (FK hacia cities).
      cityCode: raw.cityCode || undefined,
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
      branchId: toNumberOrNull(raw.branchId),
      isActive: raw.isActive ?? true,
      discount: toNumberOrNull(raw.discount) ?? undefined,
      affiliateType: raw.affiliateType as 'INDEPENDIENTE' | 'DEPENDIENTE' | undefined,
      referralType: (raw.referralType || undefined) as 'META' | 'WEB' | undefined,
      // companyEntryDate comes from its own form control (disabled), NOT from entryDate
      companyEntryDate: raw.companyEntryDate || this.toLocalDateStr(this.todayDate()),
      // Al crear, entryDate siempre viaja (por defecto hoy). En edición solo se envía
      // si el rol tiene permiso para corregirla: si no, el backend rechazaría el cambio.
      entryDate: this.isEdit
        ? (this.canEditEntryDate ? (raw.entryDate || undefined) : undefined)
        : (raw.entryDate || this.toLocalDateStr(this.todayDate())),
      arl: raw.arl ?? undefined,
      observation: raw.observation?.trim() || undefined,
      ...(this.isEdit ? {
        certArl: raw.certArl ?? false,
        certEps: raw.certEps ?? false,
        certPension: raw.certPension ?? false,
        certCcf: raw.certCcf ?? false,
      } : {
        // isNew solo se captura al crear; en edición no se envía (el backend tampoco lo acepta)
        isNew: raw.isNew ?? false,
      }),
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
          if (!this.isEdit) {
            if (result?.siigoSyncStatus === 'SUCCESS') {
              this._toast.showSuccess('Afiliado creado en Siigo correctamente');
            } else if (result?.siigoSyncStatus === 'FAILED') {
              this._toast.showError(result?.siigoSyncError || 'No se pudo crear el afiliado en Siigo');
            }
          }
          this.isLoading.set(false);
          this.saved.emit();
        };

        const uploadNewFile = () => {
          if (this.selectedFiles.length > 0 && affiliateId) {
            this._service.uploadDocuments(affiliateId, this.selectedFiles).subscribe({
              next: () => finalize(),
              error: () => {
                this.fileError.set('El afiliado fue guardado, pero no se pudieron subir los documentos. Inténtalo nuevamente.');
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

