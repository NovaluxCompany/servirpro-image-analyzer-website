import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { NewVsReentryResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe, formatMoney } from '../../utils/metrics-format';
import { INK, seriesColor } from '../../utils/chart-theme';

/** Gráfico 3: ventas de afiliaciones nuevas vs reingresos (torta). */
@Component({
  selector: 'app-new-vs-reentry-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  template: `
    @if (data().total.affiliates === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay afiliaciones nuevas aprobadas con estos filtros.</p>
    } @else {
      <div class="grid grid-cols-1 items-center gap-6" [class.md:grid-cols-2]="detailed()">
        <app-chart-canvas [config]="chartConfig()" [height]="detailed() ? '320px' : '220px'"
          ariaLabel="Ventas de afiliaciones nuevas frente a reingresos" />

        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Usuarios</th>
                <th class="px-3 py-2 text-right">Afiliados</th>
                <th class="px-3 py-2 text-right">Ventas</th>
                @if (detailed()) {
                  <th class="px-3 py-2 text-right">Ticket promedio</th>
                }
                <th class="px-3 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr>
                <td class="px-3 py-2"><span class="mr-2 inline-block h-2.5 w-2.5 rounded-sm" [style.background]="colors[0]"></span>Nuevos</td>
                <td class="px-3 py-2 text-right">{{ data().newOnes.affiliates }}</td>
                <td class="px-3 py-2 text-right">{{ data().newOnes.sales | money }}</td>
                @if (detailed()) {
                  <td class="px-3 py-2 text-right">{{ average(data().newOnes) | money }}</td>
                }
                <td class="px-3 py-2 text-right">{{ share(data().newOnes.sales) }}</td>
              </tr>
              <tr>
                <td class="px-3 py-2"><span class="mr-2 inline-block h-2.5 w-2.5 rounded-sm" [style.background]="colors[1]"></span>Reingresos</td>
                <td class="px-3 py-2 text-right">{{ data().reentries.affiliates }}</td>
                <td class="px-3 py-2 text-right">{{ data().reentries.sales | money }}</td>
                @if (detailed()) {
                  <td class="px-3 py-2 text-right">{{ average(data().reentries) | money }}</td>
                }
                <td class="px-3 py-2 text-right">{{ share(data().reentries.sales) }}</td>
              </tr>
            </tbody>
            <tfoot class="bg-gray-100 font-bold">
              <tr>
                <td class="px-3 py-2">Suma total</td>
                <td class="px-3 py-2 text-right">{{ data().total.affiliates }}</td>
                <td class="px-3 py-2 text-right">{{ data().total.sales | money }}</td>
                @if (detailed()) {
                  <td class="px-3 py-2 text-right">{{ average(data().total) | money }}</td>
                }
                <td class="px-3 py-2 text-right">100 %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      @if (detailed()) {
        <p class="mt-2 text-xs text-gray-500">
          Reingresos = afiliados con origen Reingreso. Nuevos = el resto de transacciones nuevas. Ticket promedio = ventas ÷ afiliados.
        </p>
      }
    }
  `,
})
export class NewVsReentryViewComponent {
  data = input.required<NewVsReentryResponse>();
  detailed = input(false);

  readonly colors = [seriesColor(0), seriesColor(1)];

  chartConfig = computed<ChartConfiguration>(() => {
    const data = this.data();
    return {
      type: 'doughnut',
      data: {
        labels: ['Nuevos', 'Reingresos'],
        datasets: [
          {
            data: [data.newOnes.sales, data.reentries.sales],
            backgroundColor: this.colors,
            borderColor: INK.surface,
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { color: INK.secondary, boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(Number(ctx.raw))}` } },
        },
      },
    } as ChartConfiguration;
  });

  average(group: { affiliates: number; sales: number }): number {
    return group.affiliates > 0 ? group.sales / group.affiliates : 0;
  }

  share(value: number): string {
    const total = this.data().total.sales;
    return total > 0 ? `${((value / total) * 100).toFixed(1)} %` : '0 %';
  }
}
