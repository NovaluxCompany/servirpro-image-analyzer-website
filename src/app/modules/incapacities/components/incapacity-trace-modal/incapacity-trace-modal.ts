import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { IncapacitiesService } from '../../services/incapacities.service';
import { Incapacity, IncapacityLogEntry } from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';

/**
 * "Ver trámite": histórico de aprobaciones y observaciones de UNA
 * incapacidad, separado por columna Servirpro / Tercero (CYA o Gestión).
 *
 * Es distinto de <app-incapacity-history>, que lista las incapacidades DE
 * UN AFILIADO — este componente lee incapacity_status_log de una sola
 * incapacidad puntual (GET /incapacities/:id/log).
 */
@Component({
  selector: 'app-incapacity-trace-modal',
  standalone: true,
  templateUrl: './incapacity-trace-modal.html',
})
export class IncapacityTraceModalComponent {
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  incapacity = input<Incapacity | null>(null);

  closed = output<void>();

  entries = signal<IncapacityLogEntry[]>([]);
  isLoading = signal(false);

  /**
   * Qué lado del trámite se está mirando. Las dos líneas de tiempo ya no
   * van lado a lado: se alternan con el switch de arriba, así cada una usa
   * el ancho completo del modal y no hay que leer dos columnas a la vez.
   */
  activeSide = signal<'SERVIRPRO' | 'TERCERO'>('SERVIRPRO');

  /** Los soportes arrancan plegados: son auditoría, no el flujo principal. */
  documentsOpen = signal(false);

  /**
   * Dos líneas de tiempo, cada una con lo más reciente arriba.
   *
   * El corte NO es el `scope` que graba el backend, sino QUIÉN hizo la
   * cosa. El scope mezcla las dos: `ENRUTAMIENTO` y el envío del correo se
   * graban como TERCERO/CORREO porque afectan al tercero, pero los ejecuta
   * Servirpro — y verlos en la columna del tercero hace parecer que el
   * tercero hizo algo cuando ni se ha enterado.
   *
   * - Servirpro: todo lo que ejecuta Servirpro — radicación, cambios de
   *   estado interno, anulación, enrutamiento, envío del correo (y su
   *   error) y la marca de PILA.
   * - Tercero: solo los cambios de estado DEL tercero, que es lo que
   *   responde a "¿en qué va del otro lado?".
   */
  private byDateDesc = (entries: IncapacityLogEntry[]) =>
    [...entries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  /** Lo hace Servirpro aunque el backend lo grabe con scope del tercero. */
  private isServirproWork(entry: IncapacityLogEntry): boolean {
    if (entry.scope === 'SERVIRPRO' || entry.scope === 'GENERAL') return true;
    if (entry.scope === 'CORREO' || entry.scope === 'PILA') return true;
    return entry.scope === 'TERCERO' && entry.action === 'ENRUTAMIENTO';
  }

  servirproEntries = computed(() =>
    this.byDateDesc(this.entries().filter((e) => this.isServirproWork(e))),
  );

  thirdPartyEntries = computed(() =>
    this.byDateDesc(
      this.entries().filter((e) => e.scope === 'TERCERO' && !this.isServirproWork(e)),
    ),
  );

  /**
   * Los soportes van aparte y no dentro de la línea de Servirpro: cada
   * apertura de un PDF deja un CONSULTA_DOCUMENTO, así que mezclarlos
   * ahogaría el flujo de aprobación en ruido de auditoría.
   */
  documentEntries = computed(() =>
    this.byDateDesc(this.entries().filter((e) => e.scope === 'DOCUMENTO')),
  );

  /** La línea de tiempo que toca pintar según el switch. */
  visibleEntries = computed(() =>
    this.activeSide() === 'SERVIRPRO' ? this.servirproEntries() : this.thirdPartyEntries(),
  );

  /** Gestión aplicada al trámite, para rotular el lado del tercero. */
  gestionLabel = computed(() => {
    const incapacity = this.incapacity();
    if (incapacity?.routedTo) return incapacity.routedTo === 'CYA' ? 'CYA' : 'Gestión';
    return 'Tercero';
  });

  /** Solo tiene sentido hablar de correo cuando la gestión es Gestión. */
  showsEmailChip = computed(() => this.incapacity()?.routedTo === 'GESTION');

  private readonly statusLabels: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_PROCESO: 'En proceso',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    PAGADO: 'Pagado',
    TUTELA: 'Tutela',
    // El código interno sigue siendo ENVIADO_A_CYA; lo que ve el usuario
    // es la gestión que sigue: el registro en PILA.
    ENVIADO_A_CYA: 'Enviado para PILA',
  };

  private readonly actionLabels: Record<string, string> = {
    CREACION: 'Radicación',
    CAMBIO_ESTADO: 'Cambio de estado',
    CAMBIO_ESTADO_AUTOMATICO: 'Cambio de estado automático',
    ENRUTAMIENTO: 'Enrutamiento',
    MARCA_PILA: 'Marca de PILA',
    CARGA_DOCUMENTO: 'Documento cargado',
    CONSULTA_DOCUMENTO: 'Documento consultado',
    CONSULTA_DENEGADA: 'Consulta denegada',
    ELIMINACION_DOCUMENTO: 'Documento eliminado',
    ENVIO_CORREO: 'Correo enviado',
    ERROR_CORREO: 'Error al enviar correo',
    ENVIO_CYA: 'Enviado para PILA',
    ANULACION: 'Anulación',
  };

  constructor() {
    effect(() => {
      const incapacity = this.incapacity();
      if (!this.isVisible() || !incapacity) return;
      this.load(incapacity.id);
    });
  }

  private load(incapacityId: number): void {
    this.isLoading.set(true);
    this._service.getLog(incapacityId).subscribe({
      next: (entries) => {
        this.entries.set(entries ?? []);
        this.isLoading.set(false);
      },
      error: (error: Error) => {
        this._toast.showError(error.message);
        this.isLoading.set(false);
      },
    });
  }

  close(): void {
    this.entries.set([]);
    this.activeSide.set('SERVIRPRO');
    this.documentsOpen.set(false);
    this.closed.emit();
  }

  actionLabel(action: string): string {
    return this.actionLabels[action] ?? action;
  }

  valueLabel(value: string | null): string {
    if (!value) return '—';
    return this.statusLabels[value] ?? value;
  }

  formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  // ── Presentación de la línea de tiempo ────────────────────────────

  /** Rótulo del origen del evento. TERCERO se nombra por su gestión real. */
  scopeLabel(scope: string): string {
    if (scope === 'TERCERO') return this.gestionLabel();
    return this.scopeLabels[scope] ?? scope;
  }

  private readonly scopeLabels: Record<string, string> = {
    SERVIRPRO: 'Servirpro',
    CORREO: 'Correo',
    DOCUMENTO: 'Documento',
    PILA: 'PILA',
    GENERAL: 'General',
  };

  /**
   * Color del evento según lo que significa, no según su scope: lo que
   * guía el ojo es "esto salió bien / esto falló / esto es de trámite".
   */
  private readonly actionTones: Record<string, string> = {
    CREACION: 'blue',
    CAMBIO_ESTADO: 'blue',
    CAMBIO_ESTADO_AUTOMATICO: 'gray',
    ENRUTAMIENTO: 'indigo',
    ENVIO_CORREO: 'emerald',
    ENVIO_CYA: 'emerald',
    MARCA_PILA: 'emerald',
    ERROR_CORREO: 'red',
    CONSULTA_DENEGADA: 'red',
    ANULACION: 'orange',
    CARGA_DOCUMENTO: 'gray',
    CONSULTA_DOCUMENTO: 'gray',
    ELIMINACION_DOCUMENTO: 'gray',
  };

  /**
   * Un cambio de estado no tiene un color fijo: aprobar y rechazar son el
   * mismo `action` y deben verse distinto, así que manda el valor nuevo.
   */
  private tone(entry: IncapacityLogEntry): string {
    if (entry.newValue === 'APROBADO' || entry.newValue === 'PAGADO') return 'emerald';
    if (entry.newValue === 'RECHAZADO') return 'red';
    return this.actionTones[entry.action] ?? 'gray';
  }

  private readonly dotClasses: Record<string, string> = {
    blue: 'bg-blue-500 ring-blue-100',
    emerald: 'bg-emerald-500 ring-emerald-100',
    red: 'bg-red-500 ring-red-100',
    orange: 'bg-orange-500 ring-orange-100',
    indigo: 'bg-indigo-500 ring-indigo-100',
    gray: 'bg-gray-300 ring-gray-100',
  };

  private readonly badgeClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    gray: 'bg-gray-100 text-gray-600',
  };

  dotClass(entry: IncapacityLogEntry): string {
    return this.dotClasses[this.tone(entry)];
  }

  badgeClass(entry: IncapacityLogEntry): string {
    return this.badgeClasses[this.tone(entry)];
  }

  /** Los errores se resaltan con fondo propio: son lo que hay que ver. */
  isError(entry: IncapacityLogEntry): boolean {
    return this.tone(entry) === 'red';
  }

  statusChipClass(code: string): string {
    switch (code) {
      case 'APROBADO':
      case 'PAGADO':
      case 'ENVIADO_A_CYA':
        return 'bg-emerald-100 text-emerald-700';
      case 'RECHAZADO':
        return 'bg-red-100 text-red-700';
      case 'EN_PROCESO':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }
}
