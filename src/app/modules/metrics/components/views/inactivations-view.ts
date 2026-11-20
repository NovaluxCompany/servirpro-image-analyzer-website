import { Component, input } from '@angular/core';
import { DeactivationsResponse } from '../../interfaces/metrics.interface';
import { DeactivationsViewComponent } from './deactivations-view';
import { DisaffiliationRequestsViewComponent } from './disaffiliation-requests-view';

/**
 * Gráfico 10: métrica doble. Sin escoger "Inactivaciones" o "Solicitudes de
 * desafiliación" en el filtro general (Gráfico 10 · Ver) no se muestra nada,
 * y en el tablero tampoco se puede abrir su detalle.
 */
@Component({
  selector: 'app-inactivations-view',
  standalone: true,
  imports: [DeactivationsViewComponent, DisaffiliationRequestsViewComponent],
  template: `
    @if (data().view === 'DEACTIVATIONS' && data().deactivations) {
      <app-deactivations-view [data]="data().deactivations!" [detailed]="detailed()" />
    } @else if (data().view === 'DISAFFILIATIONS' && data().disaffiliations) {
      <app-disaffiliation-requests-view [data]="data().disaffiliations!" [detailed]="detailed()" />
    } @else {
      <div class="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-900" role="alert">
        <svg class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p class="font-semibold">Escoge qué quieres ver: Inactivaciones o Solicitudes de desafiliación</p>
          <p class="mt-0.5 text-amber-800">
            Selecciónalo en el filtro, en "Gráfico 10 · Ver", y presiona "Aplicar filtros". Cada opción muestra sus propios filtros.
          </p>
        </div>
      </div>
    }
  `,
})
export class InactivationsViewComponent {
  data = input.required<DeactivationsResponse>();
  detailed = input(false);
}
