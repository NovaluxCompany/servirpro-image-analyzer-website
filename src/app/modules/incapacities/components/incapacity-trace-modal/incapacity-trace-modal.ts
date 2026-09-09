import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],
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

  servirproEntries = computed(() => this.entries().filter((e) => e.scope === 'SERVIRPRO'));
  thirdPartyEntries = computed(() => this.entries().filter((e) => e.scope === 'TERCERO'));
  otherEntries = computed(() =>
    this.entries().filter((e) => e.scope !== 'SERVIRPRO' && e.scope !== 'TERCERO'),
  );

  private readonly statusLabels: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_PROCESO: 'En proceso',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    PAGADO: 'Pagado',
    TUTELA: 'Tutela',
    ENVIADO_A_CYA: 'Enviado a CYA',
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
    ENVIO_CYA: 'Enviado a CYA',
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
}
