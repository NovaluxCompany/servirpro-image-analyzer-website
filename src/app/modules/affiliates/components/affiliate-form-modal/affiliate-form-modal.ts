import { Component, inject, input, output, OnInit, signal, effect } from '@angular/core';
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

  readonly documentTypes = ['CC', 'CE', 'TI', 'PA', 'NIT', 'PPT'];

  toggleSection1() {
    this.section1Open = !this.section1Open;
  }

  toggleSection2() {
    this.section2Open = !this.section2Open;
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

  form = this._fb.group({
    // Datos personales
    documentType: ['CC', Validators.required],
    documentNumber: ['', [Validators.required, Validators.maxLength(20)]],
    fullName: ['', [Validators.required, Validators.maxLength(255)]],
    birthDate: [''],
    documentExpDate: [''],
    phone: ['', Validators.maxLength(50)],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.maxLength(500)],
    municipality: ['', Validators.maxLength(255)],
    reference: ['', Validators.required],
    profession: ['', Validators.maxLength(255)],
    //Fecha whatsapp
    companyEntryDate: [{ value: '', disabled: true }, Validators.required],
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
    documentFile: [{ value: <File | string | null>null, disabled: true }],
    // Seguridad social (sin ADRES, sin price/deposit/charge)
    arl: [<number | null>null],
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
          this.duplicateDocument.set(false);
          this.errorMessage.set(null);
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

    if (label.includes('GESTIÓN') || label.includes('GESTION')) {
      fileControl.enable({ emitEvent: false });
      fileControl.setValidators([Validators.required]);
    } else {
      fileControl.clearValidators();
      // Cambiamos null por '' para evitar el conflicto con 'never'
      fileControl.setValue('', { emitEvent: false });
      fileControl.disable({ emitEvent: false });
    }

    fileControl.updateValueAndValidity({ emitEvent: false });
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
    const ddmmyyyy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;
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
      },
      error: () => this.catalogsLoading.set(false),
    });
  }

  private patchForm(a: AffiliateMember): void {
    this.form.patchValue({
      documentType: a.documentType,
      documentNumber: a.documentNumber,
      fullName: a.fullName,
      birthDate: this.toLocalDateStr(a.birthDate),
      documentExpDate: this.toLocalDateStr(a.documentExpDate),
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
      companyEntryDate: this.toLocalDateStr(this.todayDate()),
      entryDate: this.toLocalDateStr(this.todayDate()),
      arl: a.arl ?? null,
      pensionId: a.pensionId ? String(a.pensionId) : '',
      compensationBoxId: a.compensationBoxId ? String(a.compensationBoxId) : '',

    });
    this.errorMessage.set(null);
  }

  selectedFile: File | null = null;

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    } else {
      this.selectedFile = null;
    }
  }

  onDocumentNumberBlur(): void {
    this.checkDuplicate();
  }

  private checkDuplicate(): void {
    if (this.mode() !== 'create') return;
    const docNumber = this.form.value.documentNumber?.trim();
    if (!docNumber) { this.duplicateDocument.set(false); return; }
    const exists = this.existingAffiliates().some(
      (a) => a.documentNumber?.trim() === docNumber
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
    const dto: CreateAffiliateMemberDto = {
      documentType: raw.documentType!,
      documentNumber: raw.documentNumber!,
      fullName: raw.fullName!,
      birthDate: raw.birthDate || undefined,
      documentExpDate: raw.documentExpDate || undefined,
      phone: raw.phone || undefined,
      email: raw.email || undefined,
      address: raw.address || undefined,
      municipality: raw.municipality || undefined,
      reference: raw.reference!,
      profession: raw.profession || undefined,
      whatsappEntryDate: this.todayDate(),
      planId: toNumberOrNull(raw.planId),
      companyId: toNumberOrNull(raw.companyId),
      grouperId: toNumberOrNull(raw.grouperId),
      advisorId: toNumberOrNull(raw.advisorId),
      epsId: toNumberOrNull(raw.epsId),
      pensionId: toNumberOrNull(raw.pensionId),
      compensationBoxId: toNumberOrNull(raw.compensationBoxId),
      isActive: raw.isActive ?? true,
      companyEntryDate: this.toLocalDateStr(this.todayDate()),
      entryDate: this.toLocalDateStr(this.todayDate()),
      arl: raw.arl ?? undefined,
    };

    let payload: CreateAffiliateMemberDto | FormData = dto;

    if (this.selectedFile) {
      const formData = new FormData();
      Object.keys(dto).forEach((key) => {
        const value = (dto as any)[key];
        if (value !== undefined && value !== null) {
          formData.append(key, String(value));
        }
      });
      formData.append('files', this.selectedFile);
      payload = formData;
    }

    const obs =
      this.isEdit && this.affiliate()?.id
        ? this._service.updateAffiliate(this.affiliate()!.id!, payload)
        : this._service.createAffiliate(payload);

    obs.subscribe({
      next: () => {
        this._toast.showSuccess(
          this.isEdit ? 'Afiliado actualizado exitosamente' : 'Afiliación creada exitosamente'
        );
        this.isLoading.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      },
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.invalid && control.touched);
  }
}

