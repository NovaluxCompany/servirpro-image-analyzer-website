import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { TopPlansResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

/** Planes que se muestran en el gráfico; la tabla del detalle los trae todos. */
const PLANS_IN_CHART = 10;

/** Gráfico 8B: planes con mayor número de ventas (transacciones aprobadas). */
@Component({
  selector: 'app-top-plans-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  template: `
    @if (data().plans.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay ventas aprobadas con estos filtros.</p>
    } @else {
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Plan con más ventas</p>
          <p class="text-sm font-semibold text-gray-900 truncate">{{ data().plans[0].plan }}</p>
          <p class="text-xs text-gray-600">{{ data().plans[0].salesCount }} ventas · {{ data().plans[0].sales | money }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Ventas totales</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().totalSalesCount }}</p>
        </div>
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="chartHeight()" ariaLabel="Número de ventas por plan" />

      <div class="mt-4 overflow-auto rounded-lg border border-gray-200" [class.max-h-64]="!detailed()">
        <table class="w-full text-left text-gray-700 tabular-nums" [class.text-xs]="!detailed()" [class.text-sm]="detailed()">
          <thead class="sticky top-0 bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th class="px-3 py-2">Plan</th>
              <th class="px-3 py-2 text-right">N.º ventas</th>
              <th class="px-3 py-2 text-right">% ventas</th>
              @if (detailed()) {
                <th class="px-3 py-2 text-right">Afiliados</th>
              }
              <th class="px-3 py-2 text-right">Ingreso</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            @for (plan of visiblePlans(); track plan.plan) {
              <tr>
                <td class="px-3 py-1.5 font-medium">{{ plan.plan }}</td>
                <td class="px-3 py-1.5 text-right">{{ plan.salesCount }}</td>
                <td class="px-3 py-1.5 text-right">{{ share(plan.salesCount) }}</td>
                @if (detailed()) {
                  <td class="px-3 py-1.5 text-right">{{ plan.affiliates }}</td>
                }
                <td class="px-3 py-1.5 text-right">{{ plan.sales | money }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (detailed()) {
        <p class="mt-1 text-xs text-gray-500">N.º ventas = afiliados en transacciones aprobadas del rango (nuevas y mensualidades). Afiliados = personas distintas.</p>
      }
    }
  `,
})
export class TopPlansViewComponent {
  data = input.required<TopPlansResponse>();
  detailed = input(false);

  visiblePlans = computed(() => (this.detailed() ? this.data().plans : this.data().plans.slice(0, PLANS_IN_CHART)));

  chartHeight = computed(() => {
    const bars = Math.min(this.data().plans.length, PLANS_IN_CHART);
    return `${Math.max(this.detailed() ? 280 : 200, bars * 34 + 60)}px`;
  });

  share(count: number): string {
    const total = this.data().totalSalesCount;
    return total > 0 ? `${((count / total) * 100).toFixed(1)} %` : '0 %';
  }

  // Una sola serie (número de ventas): un color, sin leyenda.
  chartConfig = computed<ChartConfiguration>(() => {
    const plans = this.data().plans.slice(0, PLANS_IN_CHART);
    return {
      type: 'bar',
      data: {
        labels: plans.map((p) => p.plan),
        datasets: [{ label: 'Ventas', data: plans.map((p) => p.salesCount), backgroundColor: seriesColor(0), ...BAR_STYLE }],
      },
      options: baseOptions('number', { horizontal: true, legend: false, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
