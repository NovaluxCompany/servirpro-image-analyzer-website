import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { DisaffiliationRequestStatus, DisaffiliationsData } from '../../interfaces/metrics.interface';
import { NEUTRAL_COLOR, STACKED_BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const REQUEST_STATUS_LABELS: Record<DisaffiliationRequestStatus, string> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmada',
  REJECTED: 'Rechazada',
};

/** Estados en orden fijo; el color sigue al estado, no a su posición en el resultado. */
const STATUSES: Array<{ key: DisaffiliationRequestStatus; color: string; badge: string }> = [
  { key: 'PENDING', color: seriesColor(3), badge: 'bg-amber-100 text-amber-800' },
  { key: 'CONFIRMED', color: seriesColor(0), badge: 'bg-blue-100 text-blue-800' },
  { key: 'REJECTED', color: NEUTRAL_COLOR, badge: 'bg-gray-100 text-gray-700' },
];

/**
 * Gráfico 10, vista "Solicitudes de desafiliación": las solicitudes hechas
 * desde Afiliación, por motivo · submotivo y estado (pendiente, confirmada o
 * rechazada), por fidelizador y el listado.
 */
@Component({
  selector: 'app-disaffiliation-requests-view',
  standalone: true,
  imports: [ChartCanvasComponent],
  template: `
    @if (data().total === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay solicitudes de desafiliación con estos filtros.</p>
    } @else {
      <div class="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Solicitudes</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().total }}</p>
        </div>
        @for (status of statuses; track status.key) {
          <div class="rounded-lg bg-gray-50 px-3 py-2">
            <p class="flex items-center gap-1.5 text-xs text-gray-500">
              <span class="inline-block h-2.5 w-2.5 rounded-sm" [style.background-color]="status.color"></span>
              {{ statusLabel(status.key) }}s
            </p>
            <p class="text-lg font-semibold text-gray-900">{{ data().byStatus[status.key] }}</p>
          </div>
        }
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="chartHeight()" ariaLabel="Solicitudes de desafiliación por motivo y estado" />

      @if (detailed()) {
        <h4 class="mt-6 mb-2 text-sm font-semibold text-gray-800">Por fidelizador</h4>
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fidelizador</th>
                @for (status of statuses; track status.key) {
                  <th class="px-3 py-2 text-right">{{ statusLabel(status.key) }}s</th>
                }
                <th class="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().byFidelizador; track row.fidelizador) {
                <tr>
                  <td class="px-3 py-2 font-medium">{{ row.fidelizador }}</td>
                  @for (status of statuses; track status.key) {
                    <td class="px-3 py-2 text-right">{{ row.byStatus[status.key] }}</td>
                  }
                  <td class="px-3 py-2 text-right font-semibold">{{ row.total }}</td>
                </tr>
              }
              <tr class="bg-gray-50 font-semibold">
                <td class="px-3 py-2">Total</td>
                @for (status of statuses; track status.key) {
                  <td class="px-3 py-2 text-right">{{ data().byStatus[status.key] }}</td>
                }
                <td class="px-3 py-2 text-right">{{ data().total }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 class="mt-6 mb-2 text-sm font-semibold text-gray-800">Solicitudes</h4>
        <div class="overflow-auto max-h-[28rem] rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700">
            <thead class="sticky top-0 bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fecha</th>
                <th class="px-3 py-2">Afiliado</th>
                <th class="px-3 py-2">Plan</th>
                <th class="px-3 py-2">Fidelizador</th>
                <th class="px-3 py-2">Motivo</th>
                <th class="px-3 py-2">Submotivo</th>
                <th class="px-3 py-2">Empresa</th>
                <th class="px-3 py-2">Observación</th>
                <th class="px-3 py-2">Estado</th>
                <th class="px-3 py-2">Solicitado por</th>
                <th class="px-3 py-2">Confirmado por</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.requestId) {
                <tr>
                  <td class="px-3 py-2 whitespace-nowrap tabular-nums">{{ formatDate(row.requestedAt) }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    <span class="font-medium text-gray-900">{{ row.fullName }}</span>
                    <span class="block text-xs text-gray-500">{{ row.documentNumber }}</span>
                  </td>
                  <td class="px-3 py-2">{{ row.plan ?? '—' }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">{{ row.fidelizador }}</td>
                  <td class="px-3 py-2">{{ row.reason }}</td>
                  <td class="px-3 py-2">{{ row.subReason ?? '—' }}</td>
                  <td class="px-3 py-2">{{ row.company ?? '—' }}</td>
                  <td class="px-3 py-2">{{ row.observation ?? '—' }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    <span [class]="statusBadge(row.status)">{{ statusLabel(row.status) }}</span>
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">{{ row.requestedBy ?? '—' }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {{ row.confirmedBy ?? '—' }}
                    @if (row.confirmedAt) {
                      <span class="block text-xs text-gray-500 tabular-nums">{{ formatDate(row.confirmedAt) }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-1 text-xs text-gray-500">
          Va por la fecha de la solicitud. Pendiente = aún no se confirma en Desactivar Afiliados; Confirmada = el afiliado ya quedó desafiliado.
        </p>
      }
    }
  `,
})
export class DisaffiliationRequestsViewComponent {
  data = input.required<DisaffiliationsData>();
  detailed = input(false);

  readonly statuses = STATUSES;

  chartHeight = computed(() => `${Math.max(this.detailed() ? 260 : 200, this.data().byReason.length * 38 + 80)}px`);

  // Barras por motivo · submotivo, apiladas por estado.
  chartConfig = computed<ChartConfiguration>(() => {
    const byReason = this.data().byReason;
    return {
      type: 'bar',
      data: {
        labels: byReason.map((r) => r.reason),
        datasets: STATUSES.map((status) => ({
          label: REQUEST_STATUS_LABELS[status.key],
          data: byReason.map((r) => r.byStatus[status.key]),
          backgroundColor: status.color,
          ...STACKED_BAR_STYLE,
          borderWidth: { top: 0, bottom: 0, left: 0, right: 2 },
        })),
      },
      options: baseOptions('number', { horizontal: true, stacked: true, compact: !this.detailed() }),
    } as ChartConfiguration;
  });

  statusLabel(status: DisaffiliationRequestStatus): string {
    return REQUEST_STATUS_LABELS[status];
  }

  statusBadge(status: DisaffiliationRequestStatus): string {
    return `rounded-full px-2 py-0.5 text-xs font-medium ${STATUSES.find((s) => s.key === status)?.badge ?? ''}`;
  }

  formatDate(iso: string): string {
    return DATE_FORMAT.format(new Date(iso));
  }
}
