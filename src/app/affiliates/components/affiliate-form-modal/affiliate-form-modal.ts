import { Component, inject, input, output, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { ToastService } from '../../../core/service/toast.service';
import { AffiliateMember, CreateAffiliateMemberDto } from '../../interfaces/affiliate-member.interface';
import { Plan, Company, Grouper, Advisor, EpsItem } from '../../interfaces/catalog.interface';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-affiliate-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
  isSearchingAdres = signal(false);
  adresFound = signal(false);
  adresNotFound = signal(false);
  duplicateDocument = signal(false);
  errorMessage = signal<string | null>(null);
  catalogsLoading = signal(true);

  plans = signal<Plan[]>([]);
  companies = signal<Company[]>([]);
  groupers = signal<Grouper[]>([]);
  advisors = signal<Advisor[]>([]);
  epsList = signal<EpsItem[]>([]);

  readonly depositOptions = ['DOMICILIO', 'EMPRESA', 'OTRO'];
  readonly chargeOptions = ['PROTECCIÓN', 'SUBSIDIO', 'COTIZANTE', 'BENEFICIARIO'];
  readonly documentTypes = ['CC', 'CE', 'TI', 'PA', 'NIT'];

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
    reference: ['', Validators.maxLength(255)],
    whatsappEntryDate: [''],
    companyEntryDate: [''],
    // Datos de afiliación
    planId: ['', Validators.required],
    companyId: ['', Validators.required],
    grouperId: ['', Validators.required],
    advisorId: ['', Validators.required],
    epsId: [''],
    isActive: [true],
    entryDate: [{ value: this.todayDate(), disabled: true }],
    // Datos ADRES
    eps: [''],
    arl: [<number | null>null],
    pension: [''],
    compensationFund: [''],
    deposit: [''],
    charge: [''],
    price: [<number | null>null],
  });

  constructor() {
    effect(() => {
      if (this.isVisible()) {
        this.loadCatalogs();
        if (this.mode() === 'edit' && this.affiliate()) {
          this.patchForm(this.affiliate()!);
        } else {
          this.form.reset();
          this.form.patchValue({ documentType: 'CC', isActive: true, entryDate: this.todayDate() });
          this.adresFound.set(false);
          this.adresNotFound.set(false);
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
    return new Date().toISOString().split('T')[0];
  }

  /** Convierte cualquier valor de fecha al formato 'YYYY-MM-DD' que requiere
   *  el input type="date" de HTML, sin desfase de zona horaria. */
  private toLocalDateStr(value: string | Date | null | undefined): string {
    if (!value) return '';
    const str = typeof value === 'string' ? value : value.toISOString();

    // Formato DD-MM-YYYY o DD/MM/YYYY  →  convertir a YYYY-MM-DD
    const ddmmyyyy = str.match(/^(\d{2})[-/](\d{2})[-/](\d{4})/);
    if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`;

    // Formato YYYY-MM-DDTHH:MM... (ISO con hora)  →  tomar solo la fecha
    // Formato YYYY-MM-DD  →  usar directo
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
    }).subscribe({
      next: ({ plans, companies, groupers, advisors, epsList }) => {
        this.plans.set(plans);
        this.companies.set(companies);
        this.groupers.set(groupers);
        this.advisors.set(advisors);
        this.epsList.set(epsList);
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
      birthDate: a.birthDate ?? '',
      documentExpDate: a.documentExpDate ?? '',
      phone: a.phone ?? '',
      email: a.email ?? '',
      address: a.address ?? '',
      municipality: a.municipality ?? '',
      reference: a.reference ?? '',
      whatsappEntryDate: a.whatsappEntryDate ?? '',
      companyEntryDate: a.companyEntryDate ?? '',
      planId: a.planId ?? '',
      companyId: a.companyId ?? '',
      grouperId: a.grouperId ?? '',
      advisorId: a.advisorId ?? '',
      epsId: a.epsId ?? '',
      isActive: a.isActive ?? true,
      eps: a.eps ?? '',
      arl: a.arl ?? null,
      pension: a.pension ?? '',
      compensationFund: a.compensationFund ?? '',
      deposit: a.deposit ?? '',
      charge: a.charge ?? '',
      price: a.price != null ? Math.round(a.price) : null,
    });
    this.errorMessage.set(null);
  }

  onDocumentNumberBlur(): void {
    this.checkDuplicate();
    this.triggerAdresSearch();
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

  private triggerAdresSearch(): void {
    const docNumber = this.form.value.documentNumber?.trim();
    const docType = this.form.value.documentType?.trim();
    if (!docNumber || docNumber.length < 3 || !docType) return;

    this.isSearchingAdres.set(true);
    this.adresFound.set(false);
    this.adresNotFound.set(false);

    this._service.searchAdres(docType, docNumber).subscribe({
      next: (result) => {
        if (result?.found) {
          // Normalize deposit value to match select options (DOMICILIO / EMPRESA / OTRO)
          const depositNorm = result.deposit
            ? this.depositOptions.find(
                (o) => o.toUpperCase() === result.deposit.toUpperCase()
              ) ?? ''
            : '';

          // Normalize charge value to match select options (PROTECCIÓN / SUBSIDIO / COTIZANTE / BENEFICIARIO)
          const chargeNorm = result.charge
            ? this.chargeOptions.find(
                (o) => o.toUpperCase() === result.charge.toUpperCase()
              ) ?? ''
            : '';

          // Match eps name case-insensitively against loaded epsList
          const matchedEps = result.eps
            ? this.epsList().find(
                (e) => e.name.toUpperCase() === result.eps.toUpperCase()
              )
            : null;
          const epsNorm = matchedEps?.name ?? result.eps ?? '';

          // Match plan, company, grouper, advisor names against loaded catalogs → auto-select IDs
          const matchedPlan = result.plan
            ? this.plans().find((p) => p.name.toUpperCase() === result.plan.toUpperCase())
            : null;
          const matchedCompany = result.company
            ? this.companies().find((c) => c.name.toUpperCase() === result.company.toUpperCase())
            : null;
          const matchedGrouper = result.grouper
            ? this.groupers().find((g) => g.name.toUpperCase() === result.grouper.toUpperCase())
            : null;
          const matchedAdvisor = result.advisor
            ? this.advisors().find((a) => a.name.toUpperCase() === result.advisor.toUpperCase())
            : null;

          this.form.patchValue({
            // Datos personales
            fullName:        result.fullName       || '',
            birthDate:       this.toLocalDateStr(result.birthDate),
            documentExpDate: this.toLocalDateStr(result.documentExpDate),
            phone:           result.phone          || '',
            email:           result.email          || '',
            address:         result.address        || '',
            municipality:    result.municipality   || '',
            reference:       result.reference      || '',
            // Fecha de ingreso desde ADRES
            entryDate: this.toLocalDateStr(result.entryDate),
            // Sección afiliación: IDs auto-seleccionados si el nombre coincide
            ...(matchedPlan    ? { planId:    String(matchedPlan.id)    } : {}),
            ...(matchedCompany ? { companyId: String(matchedCompany.id) } : {}),
            ...(matchedGrouper ? { grouperId: String(matchedGrouper.id) } : {}),
            ...(matchedAdvisor ? { advisorId: String(matchedAdvisor.id) } : {}),
            ...(matchedEps     ? { epsId:     String(matchedEps.id)     } : {}),
            // Datos ADRES / seguridad social
            eps:              epsNorm,
            arl:              result.arl              ?? null,
            pension:          result.pension           || '',
            compensationFund: result.compensationFund  || '',
            deposit:          depositNorm,
            charge:           chargeNorm,
            price:            result.price ? Math.round(result.price) : null,
          });
          this.adresFound.set(true);
        } else {
          this.adresNotFound.set(true);
        }
        this.isSearchingAdres.set(false);
      },
      error: () => {
        this.adresNotFound.set(true);
        this.isSearchingAdres.set(false);
      },
    });
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
      reference: raw.reference || undefined,
      whatsappEntryDate: raw.whatsappEntryDate || undefined,
      companyEntryDate: raw.companyEntryDate || undefined,
      planId: raw.planId!,
      companyId: raw.companyId!,
      grouperId: raw.grouperId!,
      advisorId: raw.advisorId!,
      epsId: raw.epsId ? raw.epsId : undefined,
      isActive: raw.isActive ?? true,
      entryDate: raw.entryDate || this.todayDate(),
      eps: raw.eps || undefined,
      arl: raw.arl ?? undefined,
      pension: raw.pension || undefined,
      compensationFund: raw.compensationFund || undefined,
      deposit: raw.deposit || undefined,
      charge: raw.charge || undefined,
      price: raw.price ?? undefined,
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
