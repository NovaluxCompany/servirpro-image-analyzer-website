import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { OfficeProfitsResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

/** Gráfico 4B: ganancias de las afiliaciones hechas en oficina, por sede (separado de la publicidad). */
@Component({
  selector: 'app-office-profits-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  template: `
    @if (!data().available) {
      <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
        No disponible: el sistema no tiene un origen de oficina, así que no se pueden identificar las afiliaciones hechas en oficina ni agruparlas por sede.
      </p>
    } @else if (data().rows.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">Sin afiliaciones de oficina en el rango.</p>
    } @else {
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Ganancia oficinas</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().total.profit | money }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Afiliados en oficina</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().total.affiliates }}</p>
        </div>
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="chartHeight()" ariaLabel="Ganancia de oficinas por sede" />

      <div class="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table class="w-full text-left text-gray-700 tabular-nums" [class.text-xs]="!detailed()" [class.text-sm]="detailed()">
          <thead class="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th class="px-3 py-2">Sede</th>
              <th class="px-3 py-2 text-right">Afiliados oficina</th>
              <th class="px-3 py-2 text-right">Ganancia</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            @for (row of data().rows; track row.branch) {
              <tr>
                <td class="px-3 py-1.5 font-medium">{{ row.branch }}</td>
                <td class="px-3 py-1.5 text-right">{{ row.affiliates }}</td>
                <td class="px-3 py-1.5 text-right">{{ row.profit | money }}</td>
              </tr>
            }
          </tbody>
          <tfoot class="bg-green-100 font-bold">
            <tr>
              <td class="px-3 py-1.5">Total</td>
              <td class="px-3 py-1.5 text-right">{{ data().total.affiliates }}</td>
              <td class="px-3 py-1.5 text-right">{{ data().total.profit | money }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      @if (detailed()) {
        <p class="mt-1 text-xs text-gray-500">Ganancia = ventas de las afiliaciones nuevas con origen de oficina, agrupadas por la sede del afiliado.</p>
      }
    }
  `,
})
export class OfficeProfitsViewComponent {
  data = input.required<OfficeProfitsResponse>();
  detailed = input(false);

  chartHeight = computed(() => `${Math.max(this.detailed() ? 260 : 180, this.data().rows.length * 36 + 60)}px`);

  // Una sola serie (ganancia): un color y sin leyenda.
  chartConfig = computed<ChartConfiguration>(() => {
    const rows = this.data().rows;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.branch),
        datasets: [{ label: 'Ganancia', data: rows.map((r) => r.profit), backgroundColor: seriesColor(2), ...BAR_STYLE }],
      },
      options: baseOptions('money', { horizontal: true, legend: false, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
