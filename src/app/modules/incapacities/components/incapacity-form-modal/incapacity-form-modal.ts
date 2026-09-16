import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IncapacitiesService } from '../../services/incapacities.service';
import {
  CatalogItem,
  Incapacity,
  IncapacityDocumentType,
  IncapacityType,
} from '../../interfaces/incapacity.interface';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/components/searchable-select/searchable-select';
import { ToastService } from '../../../../core/service/toast.service';
import { TokenService } from '../../../../core/service/token.service';
import { IncapacityHistoryComponent } from '../incapacity-history/incapacity-history';

/** Mismo tope que valida el backend (MAX_INCAPACITY_DAYS en el DTO). */
const MAX_INCAPACITY_DAYS = 730;

/**
 * Espejo de lo que valida el backend (ALLOWED_MIME_TYPES y
 * MAX_FILE_SIZE_BYTES en IncapacitiesService). Se repite acá a propósito:
 * el `accept` del input solo filtra el explorador de archivos — no aplica a
 * un arrastrar-y-soltar — y sin esto un archivo de 40 MB se sube entero
 * para que el servidor lo rechace al final.
 */
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

interface DocumentSlot {
  type: IncapacityDocumentType;
  label: string;
  required: boolean;
  /** false hasta que se elige un origen que lo incluya en su matriz — ver originGatedSlots. */
  enabled: boolean;
  hint?: string;
}

/** Slots fijos: no dependen del origen elegido. */
const BASE_SLOTS: Omit<DocumentSlot, 'enabled'>[] = [
  { type: 'INCAPACIDAD', label: 'Incapacidad', required: true },
  { type: 'HISTORIA_CLINICA', label: 'Historia clínica', required: true,
    hint: 'Dato sensible: solo lo abre quien tenga el permiso, y cada consulta queda registrada.' },
  { type: 'CERT_BANCARIO', label: 'Certificado bancario (no mayor a 30 días)', required: true },
  { type: 'AUTORIZACION_BANCARIA', label: 'Autorización bancaria', required: true },
  { type: 'AUTORIZACION_PAGO_TERCERO', label: 'Autorización a terceros', required: false,
    hint: 'Solo si la cuenta bancaria no es del afiliado.' },
];

/** Universo de slots que dependen del origen elegido — deshabilitados hasta entonces. */
const ORIGIN_GATED_SLOTS: Partial<Record<IncapacityDocumentType, string>> = {
  RUAF: 'RUAF',
  CERTIFICADO_NACIDO_VIVO: 'Certificado de nacido vivo',
  REGISTRO_CIVIL: 'Registro civil',
  SOAT: 'SOAT',
  LICENCIA_CONDUCCION: 'Licencia de conducción',
  FURIPS: 'FURIPS',
};

/**
 * Modal de "Enviar a incapacidades": histórico del afiliado arriba,
 * formulario abajo.
 *
 * El histórico va primero a propósito — es lo que evita radicar dos veces la
 * misma incapacidad, y sirve de poco si hay que buscarlo después de llenar
 * el formulario.
 *
 * Toma `affiliationId` y un par de campos de texto, no un `AffiliateMember`:
 * así el módulo de incapacidades no depende del de afiliados.
 */
@Component({
  selector: 'app-incapacity-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IncapacityHistoryComponent, SearchableSelectComponent],
  templateUrl: './incapacity-form-modal.html',
})
export class IncapacityFormModalComponent {
  private _fb = inject(FormBuilder);
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);
  private _tokenService = inject(TokenService);

  isVisible = input<boolean>(false);
  affiliationId = input<number | null>(null);
  affiliateName = input<string>('');
  affiliateDocument = input<string>('');

  saved = output<void>();
  closed = output<void>();

  isSaving = signal(false);
  /** Archivo elegido por tipo de documento. */
  files = signal<Partial<Record<IncapacityDocumentType, File>>>({});
  /** Motivo por el que se rechazó el último archivo de un slot, para mostrarlo en su tarjeta. */
  fileErrors = signal<Partial<Record<IncapacityDocumentType, string>>>({});
  /** Slot sobre el que se está arrastrando un archivo, para resaltarlo. */
  draggingOver = signal<IncapacityDocumentType | null>(null);

  // Parametrizados en base de datos (incapacity_origins /
  // incapacity_entity_types), más la matriz de documentos obligatorios por
  // origen. Se cargan al abrir el modal, no al arrancar la app: son listas
  // cortas que solo hacen falta acá.
  origins = signal<CatalogItem[]>([]);
  entityTypes = signal<CatalogItem[]>([]);
  documentRequirements = signal<Record<string, { documentType: IncapacityDocumentType; required: boolean }[]>>({});
  isLoadingCatalogs = signal(false);
  private catalogsLoaded = false;

  // CIE-10: no es un catálogo que se pueda cargar de golpe (~14.000 filas), así
  // que el select trabaja en modo servidor — solo tiene en memoria los
  // resultados de lo último que el usuario escribió.
  diagnosisOptions = signal<SelectOption[]>([]);
  isSearchingDiagnoses = signal(false);

  form = this._fb.group({
    type: ['NUEVA' as IncapacityType, Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    days: [null as number | null, [Validators.min(1), Validators.max(MAX_INCAPACITY_DAYS)]],
    originId: [''],
    entityTypeId: [''],
    issuingEntityName: [''],
    diagnosisId: [''],
    servirproObservation: [''],
  });

  /** Código (no id) del origen elegido — la matriz de documentos y las etiquetas van por code. */
  selectedOriginCode = computed(() => {
    const originId = this.formValue().originId;
    if (!originId) return null;
    return this.origins().find((o) => String(o.id) === String(originId))?.code ?? null;
  });

  selectedEntityTypeCode = computed(() => {
    const entityTypeId = this.formValue().entityTypeId;
    if (!entityTypeId) return null;
    return this.entityTypes().find((e) => String(e.id) === String(entityTypeId))?.code ?? null;
  });

  /**
   * Slots del formulario de soportes: los fijos siempre visibles y
   * habilitados, más el universo de "origin-gated" — deshabilitados hasta
   * elegir un origen, y de esos, solo se habilitan y se marcan obligatorios
   * los que la matriz del origen elegido efectivamente pide.
   */
  documentSlots = computed<DocumentSlot[]>(() => {
    const originCode = this.selectedOriginCode();
    const requiredTypes = new Set(
      originCode ? (this.documentRequirements()[originCode] ?? []).map((r) => r.documentType) : [],
    );

    // El rol "Incapacidad" gestiona el trámite sin acceso a cuentas bancarias
    // del afiliado, así que para ese rol este soporte no puede ser obligatorio.
    const isIncapacidadRole = this._tokenService.hasRole('Incapacidad');
    const base: DocumentSlot[] = BASE_SLOTS.map((slot) => ({
      ...slot,
      enabled: true,
      required: slot.type === 'AUTORIZACION_BANCARIA' && isIncapacidadRole ? false : slot.required,
    }));
    const gated: DocumentSlot[] = (Object.keys(ORIGIN_GATED_SLOTS) as IncapacityDocumentType[]).map((type) => ({
      type,
      label: ORIGIN_GATED_SLOTS[type]!,
      enabled: requiredTypes.has(type),
      required: requiredTypes.has(type),
    }));

    return [...base, ...gated];
  });

  /** Solo cuenta contra "obligatorios" los que además están habilitados (origen elegido). */
  missingRequired = computed(() =>
    this.documentSlots().some((slot) => slot.enabled && slot.required && !this.files()[slot.type]),
  );

  /**
   * Entidad que emite el certificado, según quién responde:
   * - EPS: se hereda sola de la EPS del afiliado (el backend la resuelve al
   *   leer/exportar — ver IncapacitiesService —, así que acá no se manda).
   * - ARL: valor de negocio por defecto, no hay catálogo de proveedores ARL.
   * - AFP: no hay un default de negocio, así que queda un campo abierto.
   */
  showIssuingEntityField = computed(() => this.selectedEntityTypeCode() === 'AFP');

  private resolveIssuingEntityName(): string | undefined {
    const code = this.selectedEntityTypeCode();
    if (code === 'ARL') return 'Axxa Colpatria';
    if (code === 'AFP') return this.form.getRawValue().issuingEntityName?.trim() || undefined;
    return undefined;
  }

  constructor() {
    effect(() => {
      if (this.isVisible()) this.loadCatalogs();
    });

    // Al desmarcar un slot origin-gated que ya no aplica (cambio de origen),
    // se limpia el archivo que tuviera cargado: no debe viajar un soporte
    // de un tipo que el origen actual ya no pide.
    effect(() => {
      const enabledTypes = new Set(this.documentSlots().filter((s) => s.enabled).map((s) => s.type));
      const current = this.files();
      const stale = Object.keys(current).filter(
        (type) => !enabledTypes.has(type as IncapacityDocumentType),
      ) as IncapacityDocumentType[];
      if (stale.length === 0) return;
      const next = { ...current };
      stale.forEach((type) => delete next[type]);
      this.files.set(next);
    });

    // Rellena los días al cambiar las fechas, MIENTRAS el usuario no los haya
    // escrito él mismo. Si ya los escribió, cambiar una fecha no le pisa el
    // valor: sería borrarle un dato que puso a propósito.
    // `emitEvent: false` evita que el patch dispare valueChanges y el effect
    // se retroalimente.
    effect(() => {
      const calendar = this.calendarDays();
      if (this.daysTouchedByUser()) return;
      this.form.patchValue({ days: calendar }, { emitEvent: false });
    });
  }

  /**
   * Busca diagnósticos CIE-10. La llama el select ya con debounce y con al
   * menos el mínimo de caracteres; un texto vacío significa "limpia lo que
   * había" (el usuario borró la búsqueda), no "tráeme todo".
   */
  onDiagnosisSearch(query: string): void {
    if (!query) {
      this.diagnosisOptions.set([]);
      this.isSearchingDiagnoses.set(false);
      return;
    }

    this.isSearchingDiagnoses.set(true);
    this._service.searchDiagnoses(query).subscribe((results) => {
      // El value es el id (FK), no el código: renombrar o recodificar un
      // diagnóstico no debe cambiar a qué fila apuntan las incapacidades.
      this.diagnosisOptions.set(
        results.map((d) => ({ value: String(d.id), label: `${d.code} — ${d.description}` })),
      );
      this.isSearchingDiagnoses.set(false);
    });
  }

  /** Una sola vez por vida del componente: los catálogos no cambian mientras el modal está abierto. */
  private loadCatalogs(): void {
    if (this.catalogsLoaded || this.isLoadingCatalogs()) return;

    this.isLoadingCatalogs.set(true);
    this._service.getCatalogs().subscribe({
      next: ({ origins, entityTypes, documentRequirements }) => {
        this.origins.set(origins);
        this.entityTypes.set(entityTypes);
        this.documentRequirements.set(documentRequirements ?? {});
        this.catalogsLoaded = true;
        this.isLoadingCatalogs.set(false);
      },
      error: (error: Error) => {
        this.isLoadingCatalogs.set(false);
        this._toast.showError(`No se pudieron cargar los catálogos: ${error.message}`);
      },
    });
  }

  /**
   * Valor del formulario como señal.
   *
   * Los reactive forms clásicos no son señales, así que un `computed()` que
   * lea `form.getRawValue()` no tiene de qué depender: se calcula una vez y
   * se queda pegado con el valor inicial. `toSignal(valueChanges)` es lo que
   * hace que lo derivado (días, aviso de discrepancia) se actualice de
   * verdad mientras el usuario escribe.
   */
  private formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /**
   * Días que abarca el rango de fechas. Es una SUGERENCIA: el campo se puede
   * sobrescribir porque el certificado médico no siempre coincide con el
   * calendario, y ese número es el que vale para el trámite.
   */
  calendarDays = computed(() => {
    const { startDate, endDate } = this.formValue();
    if (!startDate || !endDate) return null;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return null;
    return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  });

  /** Se apaga en cuanto el usuario escribe los días: de ahí en más el número es suyo. */
  private daysTouchedByUser = signal(false);

  /**
   * El valor escrito no coincide con el rango de fechas. No es un error —
   * es un caso legítimo— pero se avisa para que un dedazo no pase de largo.
   */
  daysDifferFromCalendar = computed(() => {
    if (!this.daysTouchedByUser()) return false;
    const typed = this.formValue().days;
    const calendar = this.calendarDays();
    return typed != null && calendar != null && Number(typed) !== calendar;
  });

  onDaysInput(): void {
    this.daysTouchedByUser.set(true);
  }

  hasDateOrderError(): boolean {
    const { startDate, endDate } = this.form.getRawValue();
    if (!startDate || !endDate) return false;
    return new Date(endDate) < new Date(startDate);
  }

  // ── Soportes ──────────────────────────────────────────────────────

  onFileChange(type: IncapacityDocumentType, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.acceptFile(type, input.files?.[0] ?? null);
    // Limpia el input para que volver a elegir EL MISMO archivo tras un
    // rechazo dispare el evento igual (si no, `change` no vuelve a saltar).
    input.value = '';
  }

  onDrop(type: IncapacityDocumentType, event: DragEvent): void {
    event.preventDefault();
    this.draggingOver.set(null);
    this.acceptFile(type, event.dataTransfer?.files?.[0] ?? null);
  }

  onDragOver(type: IncapacityDocumentType, event: DragEvent): void {
    event.preventDefault();
    this.draggingOver.set(type);
  }

  onDragLeave(): void {
    this.draggingOver.set(null);
  }

  /**
   * Valida y guarda. El archivo se rechaza ACÁ, antes de subirlo: mandar 40
   * MB por la red para que el servidor conteste 400 desperdicia la subida
   * completa y el usuario se entera al final.
   */
  private acceptFile(type: IncapacityDocumentType, file: File | null): void {
    if (!file) return;

    const error = this.validateFile(file);
    const errors = { ...this.fileErrors() };

    if (error) {
      errors[type] = error;
      this.fileErrors.set(errors);
      return;
    }

    delete errors[type];
    this.fileErrors.set(errors);
    this.files.set({ ...this.files(), [type]: file });
  }

  private validateFile(file: File): string | null {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return 'Formato no permitido. Solo PDF, JPG o PNG.';
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `Pesa ${this.formatSize(file.size)}. El máximo es 10 MB.`;
    }
    if (file.size === 0) {
      return 'El archivo está vacío.';
    }
    return null;
  }

  removeFile(type: IncapacityDocumentType): void {
    const next = { ...this.files() };
    delete next[type];
    this.files.set(next);

    const errors = { ...this.fileErrors() };
    delete errors[type];
    this.fileErrors.set(errors);
  }

  attachedFile(type: IncapacityDocumentType): File | null {
    return this.files()[type] ?? null;
  }

  fileError(type: IncapacityDocumentType): string | null {
    return this.fileErrors()[type] ?? null;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** Cuántos soportes van adjuntos, para el contador del encabezado. */
  attachedCount = computed(() => Object.keys(this.files()).length);

  private reset(): void {
    this.form.reset({
      type: 'NUEVA',
      startDate: '',
      endDate: '',
      days: null,
      originId: '',
      entityTypeId: '',
      issuingEntityName: '',
      diagnosisId: '',
      servirproObservation: '',
    });
    this.files.set({});
    this.fileErrors.set({});
    this.draggingOver.set(null);
    this.diagnosisOptions.set([]);
    this.daysTouchedByUser.set(false);
  }

  onClose(): void {
    this.reset();
    this.closed.emit();
  }

  save(): void {
    // El botón ya se deshabilita con isSaving(), pero eso es solo la vista:
    // el Enter del teclado o un doble evento entrarían igual. El cerrojo va
    // acá, que es donde se dispara la petición.
    if (this.isSaving()) return;

    const affiliationId = this.affiliationId();
    if (!affiliationId) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this._toast.showError('Completa las fechas de inicio y fin.');
      return;
    }
    if (this.hasDateOrderError()) {
      this._toast.showError('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }
    if (this.missingRequired()) {
      this._toast.showError('Adjunta los documentos obligatorios antes de guardar.');
      return;
    }

    const chosen = this.files();
    const types = Object.keys(chosen) as IncapacityDocumentType[];
    const selectedFiles = types.map((type) => chosen[type]!);

    const raw = this.form.getRawValue();
    this.isSaving.set(true);

    this._service
      .createIncapacity(
        {
          affiliationId,
          type: raw.type ?? 'NUEVA',
          startDate: raw.startDate!,
          endDate: raw.endDate!,
          originId: raw.originId ? Number(raw.originId) : undefined,
          entityTypeId: raw.entityTypeId ? Number(raw.entityTypeId) : undefined,
          issuingEntityName: this.resolveIssuingEntityName(),
          days: raw.days ? Number(raw.days) : undefined,
          diagnosisId: raw.diagnosisId ? Number(raw.diagnosisId) : undefined,
          servirproObservation: raw.servirproObservation || undefined,
        },
        selectedFiles,
        types,
      )
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this._toast.showSuccess('Incapacidad registrada.');
          this.saved.emit();
          // Se cierra al guardar: el trámite terminó. Antes quedaba abierto
          // con el formulario en blanco, que se lee como "no pasó nada" —
          // el toast es la única señal de éxito y se va solo a los segundos.
          this.onClose();
        },
        error: (error: Error) => {
          this.isSaving.set(false);
          this._toast.showError(error.message);
        },
      });
  }
}
