import { Component, inject, input, output, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../../core/service/toast.service';
import { AffiliateMember, CreateAffiliateMemberDto } from '../../interfaces/affiliate-member.interface';
import { Plan, Company, Grouper, Advisor, EpsItem } from '../../interfaces/catalog.interface';
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
  references = signal<string[]>([]);

  readonly documentTypes = ['CC', 'CE', 'TI', 'PA', 'NIT'];

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

  form = this._fb.group({
    // Datos personales
    documentType: ['CC', Validators.required],
    documentNumber: ['', [Validators.required, Validators.maxLength(20)]],
    fullName: ['', [Validators.required, Validators.maxLength(255)]],
    birthDate: [''],
    documentExpDate: [''],
    phone: ['', Validators.maxLength(50)],
    email: ['', Validators.email],
    address: ['', Validators.maxLength(500)],
    municipality: ['', Validators.maxLength(255)],
    reference: ['', Validators.required],
    profession: ['', Validators.maxLength(255)],
    whatsappEntryDate: [''],
    companyEntryDate: [''],
    // Datos de afiliación
    planId: ['', Validators.required],
    companyId: ['', Validators.required],
    grouperId: ['', Validators.required],
    advisorId: ['', Validators.required],
    epsId: [''],
    isActive: [true],
    entryDate: [''],
    // Seguridad social (sin ADRES, sin price/deposit/charge)
    arl: [<number | null>null],
    pension: [''],
    compensationFund: [''],
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
          this.duplicateDocument.set(false);
          this.errorMessage.set(null);
        }
      }
    });
  }

  ngOnInit(): void {}

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
    }).subscribe({
      next: ({ plans, companies, groupers, advisors, epsList, references }) => {
        this.plans.set(plans);
        this.companies.set(companies);
        this.groupers.set(groupers);
        this.advisors.set(advisors);
        this.epsList.set(epsList);
        this.references.set(references);
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
      whatsappEntryDate: this.toLocalDateStr(a.whatsappEntryDate),
      companyEntryDate: this.toLocalDateStr(a.companyEntryDate),
      planId: a.planId ? String(a.planId) : '',
      companyId: a.companyId ? String(a.companyId) : '',
      grouperId: a.grouperId ? String(a.grouperId) : '',
      advisorId: a.advisorId ? String(a.advisorId) : '',
      epsId: a.epsId ? String(a.epsId) : '',
      isActive: a.isActive ?? true,
      entryDate: this.toLocalDateStr(a.entryDate),
      arl: a.arl ?? null,
      pension: a.pension ?? '',
      compensationFund: a.compensationFund ?? '',
    });
    this.errorMessage.set(null);
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
      whatsappEntryDate: raw.whatsappEntryDate || undefined,
      companyEntryDate: raw.companyEntryDate || undefined,
      planId: raw.planId!,
      companyId: raw.companyId!,
      grouperId: raw.grouperId!,
      advisorId: raw.advisorId!,
      epsId: raw.epsId || undefined,
      isActive: raw.isActive ?? true,
      entryDate: raw.entryDate || this.todayDate(),
      arl: raw.arl ?? undefined,
      pension: raw.pension || undefined,
      compensationFund: raw.compensationFund || undefined,
    };

    const obs =
      this.isEdit && this.affiliate()?.id
        ? this._service.updateAffiliate(this.affiliate()!.id!, dto)
        : this._service.createAffiliate(dto);

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

