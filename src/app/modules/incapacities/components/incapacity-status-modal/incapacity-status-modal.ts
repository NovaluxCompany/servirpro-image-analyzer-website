import { Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IncapacitiesService } from '../../services/incapacities.service';
import {
  Incapacity,
  ServirproStatus,
  ThirdPartyStatus,
} from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';

export type StatusScope = 'SERVIRPRO' | 'TERCERO';

/**
 * Cambio de estado, para los dos lados.
 *
 * Un solo modal con `scope` en vez de dos componentes casi idénticos: lo
 * único que cambia son las opciones disponibles y el endpoint.
 *
 * La observación es obligatoria al rechazar; el backend la exige también,
 * esta validación es para no gastar un viaje al servidor.
 */
@Component({
  selector: 'app-incapacity-status-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './incapacity-status-modal.html',
})
export class IncapacityStatusModalComponent {
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);

  isVisible = input<boolean>(false);
  incapacity = input<Incapacity | null>(null);
  scope = input<StatusScope>('SERVIRPRO');

  confirmed = output<void>();
  cancelled = output<void>();

  selectedStatus = signal<string>('');
  observation = signal<string>('');
  isSaving = signal(false);

  title = computed(() =>
    this.scope() === 'SERVIRPRO' ? 'Estado Servirpro' : 'Estado del tercero',
  );

  options = computed<{ value: string; label: string }[]>(() =>
    this.scope() === 'SERVIRPRO'
      ? [
          { value: 'APROBADO', label: 'Aprobado' },
          { value: 'RECHAZADO', label: 'Rechazado' },
        ]
      : [
          { value: 'PENDIENTE', label: 'Pendiente' },
          { value: 'EN_PROCESO', label: 'En proceso' },
          { value: 'APROBADO', label: 'Aprobado' },
          { value: 'RECHAZADO', label: 'Rechazado' },
        ],
  );

  /** Aviso de lo que dispara aprobar del lado de Servirpro. */
  showApprovalNotice = computed(
    () => this.scope() === 'SERVIRPRO' && this.selectedStatus() === 'APROBADO',
  );

  requiresObservation = computed(() => this.selectedStatus() === 'RECHAZADO');

  onCancel(): void {
    this.reset();
    this.cancelled.emit();
  }

  private reset(): void {
    this.selectedStatus.set('');
    this.observation.set('');
  }

  confirm(): void {
    const incapacity = this.incapacity();
    const status = this.selectedStatus();
    if (!incapacity || !status) {
      this._toast.showError('Elige un estado.');
      return;
    }
    if (this.requiresObservation() && !this.observation().trim()) {
      this._toast.showError('Escribe el motivo del rechazo en la observación.');
      return;
    }

    this.isSaving.set(true);
    const observation = this.observation().trim() || undefined;

    const request$ =
      this.scope() === 'SERVIRPRO'
        ? this._service.updateServirproStatus(incapacity.id, {
            status: status as Extract<ServirproStatus, 'APROBADO' | 'RECHAZADO'>,
            observation,
          })
        : this._service.updateThirdPartyStatus(incapacity.id, {
            status: status as ThirdPartyStatus,
            observation,
          });

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this._toast.showSuccess('Estado actualizado.');
        this.reset();
        this.confirmed.emit();
      },
      error: (error: Error) => {
        this.isSaving.set(false);
        this._toast.showError(error.message);
      },
    });
  }
}
