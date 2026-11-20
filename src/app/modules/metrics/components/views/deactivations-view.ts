import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { DeactivationsData } from '../../interfaces/metrics.interface';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

const DATE_FORMAT = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Gráfico 10, vista "Inactivaciones": afiliaciones desactivadas (desde
 * "Desactivar", no desafiliadas). Son las que los gráficos 1 al 9 ya no cuentan.
 */
@Component({
  selector: 'app-deactivations-view',
  standalone: true,
  imports: [ChartCanvasComponent],
  template: `
    @if (data().total === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay afiliados desactivados con estos filtros.</p>
    } @else {
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Afiliados desactivados</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().total }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Motivo más frecuente</p>
          <p class="text-sm font-semibold text-gray-900 truncate">{{ data().byReason[0].reason }}</p>
          <p class="text-xs text-gray-600">{{ data().byReason[0].affiliates }} afiliados</p>
        </div>
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="chartHeight()" ariaLabel="Afiliados desactivados por motivo" />

      @if (detailed()) {
        <h4 class="mt-6 mb-2 text-sm font-semibold text-gray-800">Por fidelizador</h4>
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fidelizador</th>
                @for (reason of reasons(); track reason) {
                  <th class="px-3 py-2 text-right">{{ reason }}</th>
                }
                <th class="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().byFidelizador; track row.fidelizador) {
                <tr>
                  <td class="px-3 py-2 font-medium">{{ row.fidelizador }}</td>
                  @for (reason of reasons(); track reason) {
                    <td class="px-3 py-2 text-right">{{ row.byReason[reason] ?? 0 }}</td>
                  }
                  <td class="px-3 py-2 text-right font-semibold">{{ row.total }}</td>
                </tr>
              }
              <tr class="bg-gray-50 font-semibold">
                <td class="px-3 py-2">Total</td>
                @for (item of data().byReason; track item.reason) {
                  <td class="px-3 py-2 text-right">{{ item.affiliates }}</td>
                }
                <td class="px-3 py-2 text-right">{{ data().total }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 class="mt-6 mb-2 text-sm font-semibold text-gray-800">Afiliados</h4>
        <div class="overflow-auto max-h-[28rem] rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700">
            <thead class="sticky top-0 bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fecha</th>
                <th class="px-3 py-2">Afiliado</th>
                <th class="px-3 py-2">Plan</th>
                <th class="px-3 py-2">Fidelizador</th>
                <th class="px-3 py-2">Motivo</th>
                <th class="px-3 py-2">Observación</th>
                <th class="px-3 py-2">Tipo</th>
                <th class="px-3 py-2">Realizado por</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.affiliationId) {
                <tr>
                  <td class="px-3 py-2 whitespace-nowrap tabular-nums">{{ formatDate(row.deactivatedAt) }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    <span class="font-medium text-gray-900">{{ row.fullName }}</span>
                    <span class="block text-xs text-gray-500">{{ row.documentNumber }}</span>
                  </td>
                  <td class="px-3 py-2">{{ row.plan ?? '—' }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">{{ row.fidelizador }}</td>
                  <td class="px-3 py-2">{{ row.reason }}</td>
                  <td class="px-3 py-2">{{ row.observation ?? '—' }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">{{ row.kind }}</td>
                  <td class="px-3 py-2 whitespace-nowrap">{{ row.user ?? '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-1 text-xs text-gray-500">
          Va por la fecha de la desactivación. Individual = desde Afiliación; Masiva = desde Desactivar Afiliados.
        </p>
      }
    }
  `,
})
export class DeactivationsViewComponent {
  data = input.required<DeactivationsData>();
  detailed = input(false);

  /** Columnas de la tabla por fidelizador: los motivos, en el mismo orden del gráfico. */
  reasons = computed(() => this.data().byReason.map((r) => r.reason));

  chartHeight = computed(() => `${Math.max(this.detailed() ? 260 : 200, this.data().byReason.length * 38 + 60)}px`);

  // Una sola serie (afiliados por motivo): un color, sin leyenda.
  chartConfig = computed<ChartConfiguration>(() => {
    const byReason = this.data().byReason;
    return {
      type: 'bar',
      data: {
        labels: byReason.map((r) => r.reason),
        datasets: [{ label: 'Afiliados', data: byReason.map((r) => r.affiliates), backgroundColor: seriesColor(0), ...BAR_STYLE }],
      },
      options: baseOptions('number', { horizontal: true, legend: false, compact: !this.detailed() }),
    } as ChartConfiguration;
  });

  formatDate(iso: string): string {
    return DATE_FORMAT.format(new Date(iso));
  }
}
