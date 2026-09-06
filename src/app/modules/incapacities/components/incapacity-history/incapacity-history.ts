import { Component, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IncapacitiesService } from '../../services/incapacities.service';
import { Incapacity } from '../../interfaces/incapacity.interface';
import { ToastService } from '../../../../core/service/toast.service';
import { IncapacityDocumentsListComponent } from '../incapacity-documents-list/incapacity-documents-list';

/**
 * Histórico de incapacidades de un afiliado.
 *
 * Standalone y sin dependencias de la pantalla que lo contiene, porque lo
 * montan dos: el modal de "Enviar a incapacidades" y la pestaña
 * Incapacidades de la ficha del afiliado.
 *
 * Carga diferida: no pide nada hasta que `enabled` es true, para que abrir
 * la ficha en "Datos básicos" no dispare una petición que nadie va a mirar.
 */
@Component({
  selector: 'app-incapacity-history',
  standalone: true,
  imports: [CommonModule, IncapacityDocumentsListComponent],
  templateUrl: './incapacity-history.html',
})
export class IncapacityHistoryComponent {
  private _service = inject(IncapacitiesService);
  private _toast = inject(ToastService);

  affiliationId = input.required<number | null>();
  enabled = input<boolean>(true);

  incapacities = signal<Incapacity[]>([]);
  isLoading = signal(false);
  hasLoaded = signal(false);

  private readonly statusLabels: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_PROCESO: 'En proceso',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
  };

  constructor() {
    effect(() => {
      const affiliationId = this.affiliationId();
      const enabled = this.enabled();

      if (!enabled || !affiliationId) return;
      this.load(affiliationId);
    });
  }

  private load(affiliationId: number): void {
    this.isLoading.set(true);
    this._service.getIncapacities({ affiliationId }, 1, 50).subscribe({
      next: (response) => {
        this.incapacities.set(response.items ?? []);
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
      error: (error: Error) => {
        this._toast.showError(error.message);
        this.isLoading.set(false);
        this.hasLoaded.set(true);
      },
    });
  }

  statusLabel(status: string): string {
    return this.statusLabels[status] ?? status;
  }

  statusClass(status: string): string {
    switch (status) {
      case 'APROBADO':
        return 'bg-emerald-100 text-emerald-700';
      case 'RECHAZADO':
        return 'bg-red-100 text-red-700';
      case 'EN_PROCESO':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const [year, month, day] = value.substring(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
}
