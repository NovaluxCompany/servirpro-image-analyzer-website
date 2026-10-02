import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { AdvertisingResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

/** Gráfico 4: gastos de publicidad (Meta + Web) y ganancias por oficina. */
@Component({
  selector: 'app-advertising-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  template: `
    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Publicidad Meta</p>
        <p class="text-lg font-semibold text-gray-900">{{ data().advertising.meta | money }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Publicidad Web</p>
        <p class="text-lg font-semibold text-gray-900">{{ data().advertising.web | money }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Total publicidad</p>
        <p class="text-lg font-semibold text-gray-900">{{ data().advertising.total | money }}</p>
      </div>
    </div>

    @if (data().advertising.total > 0) {
      <app-chart-canvas [config]="chartConfig()" [height]="detailed() ? '300px' : '200px'" ariaLabel="Gastos de publicidad por canal" />

      <div class="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table class="w-full text-left text-gray-700 tabular-nums" [class.text-xs]="!detailed()" [class.text-sm]="detailed()">
          <thead class="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th class="px-3 py-2">Canal</th>
              <th class="px-3 py-2 text-right">Publicidad</th>
              <th class="px-3 py-2 text-right">% del total</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr>
              <td class="px-3 py-1.5 font-medium">Meta</td>
              <td class="px-3 py-1.5 text-right">{{ data().advertising.meta | money }}</td>
              <td class="px-3 py-1.5 text-right">{{ share(data().advertising.meta) }}</td>
            </tr>
            <tr>
              <td class="px-3 py-1.5 font-medium">Web</td>
              <td class="px-3 py-1.5 text-right">{{ data().advertising.web | money }}</td>
              <td class="px-3 py-1.5 text-right">{{ share(data().advertising.web) }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-100 font-bold">
            <tr>
              <td class="px-3 py-1.5">Total</td>
              <td class="px-3 py-1.5 text-right">{{ data().advertising.total | money }}</td>
              <td class="px-3 py-1.5 text-right">100 %</td>
            </tr>
          </tfoot>
        </table>
      </div>
    } @else {
      <p class="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
        Digita la publicidad de Meta y Web en el filtro para verla aquí.
      </p>
    }

    @if (!detailed()) {
      <p class="mt-3 text-xs text-gray-500">
        Ganancia de oficinas:
        @if (data().offices.available) {
          <span class="font-semibold text-gray-700">{{ data().offices.total.profit | money }}</span> ({{ data().offices.total.affiliates }} afiliados) · detalle por sede en el gráfico.
        } @else {
          no disponible (no existe un origen de oficina).
        }
      </p>
    }

    @if (detailed()) {
      <h3 class="mt-8 mb-2 text-base font-semibold text-gray-900">Ganancias por las oficinas</h3>
      @if (data().offices.available) {
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Sede</th>
                <th class="px-3 py-2 text-right">Afiliados oficina</th>
                <th class="px-3 py-2 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().offices.rows; track row.branch) {
                <tr>
                  <td class="px-3 py-2 font-medium">{{ row.branch }}</td>
                  <td class="px-3 py-2 text-right">{{ row.affiliates }}</td>
                  <td class="px-3 py-2 text-right">{{ row.profit | money }}</td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="px-3 py-4 text-center text-gray-500">Sin afiliaciones de oficina en el rango.</td></tr>
              }
            </tbody>
            <tfoot class="bg-green-100 font-bold">
              <tr>
                <td class="px-3 py-2">Total</td>
                <td class="px-3 py-2 text-right">{{ data().offices.total.affiliates }}</td>
                <td class="px-3 py-2 text-right">{{ data().offices.total.profit | money }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      } @else {
        <p class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
          No disponible: el sistema no tiene un origen de oficina, así que no se pueden identificar las afiliaciones hechas en oficina ni agruparlas por sede.
        </p>
      }
    }
  `,
})
export class AdvertisingViewComponent {
  data = input.required<AdvertisingResponse>();
  detailed = input(false);

  share(value: number): string {
    const total = this.data().advertising.total;
    return total > 0 ? `${((value / total) * 100).toFixed(1)} %` : '0 %';
  }

  // Una sola serie (publicidad) -> un solo color y sin leyenda: el título la nombra.
  chartConfig = computed<ChartConfiguration>(() => {
    const ad = this.data().advertising;
    return {
      type: 'bar',
      data: {
        labels: ['Meta', 'Web'],
        datasets: [{ label: 'Publicidad', data: [ad.meta, ad.web], backgroundColor: seriesColor(0), ...BAR_STYLE }],
      },
      options: baseOptions('money', { horizontal: true, legend: false, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
