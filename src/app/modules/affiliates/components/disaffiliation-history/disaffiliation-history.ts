import { Component, effect, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { DisaffiliationHistoryRow } from '../../../deactivate-affiliates/interfaces/disaffiliation.interface';

/**
 * Histórico de solicitudes de desafiliación (pendientes y confirmadas) de un
 * afiliado puntual. Pestaña de la ficha del afiliado, misma mecánica que
 * IncapacityHistoryComponent: no pide nada hasta que `enabled` es true.
 */
@Component({
  selector: 'app-disaffiliation-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './disaffiliation-history.html',
})
export class DisaffiliationHistoryComponent {
  private _service = inject(AffiliateMembersService);

  affiliationId = input.required<number | null>();
  enabled = input<boolean>(true);

  requests = signal<DisaffiliationHistoryRow[]>([]);
  isLoading = signal(false);
  hasLoaded = signal(false);

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
    this._service.getDisaffiliationHistory(affiliationId).subscribe((rows) => {
      this.requests.set(rows ?? []);
      this.isLoading.set(false);
      this.hasLoaded.set(true);
    });
  }

  statusClass(status: string): string {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-red-100 text-red-700';
      case 'PENDING':
        return 'bg-amber-100 text-amber-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED':
        return 'Desafiliado';
      case 'PENDING':
        return 'Pendiente de validar';
      default:
        return status;
    }
  }

  formatDate(value?: string | null): string {
    if (!value) return '—';
    const [year, month, day] = value.substring(0, 10).split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
}
