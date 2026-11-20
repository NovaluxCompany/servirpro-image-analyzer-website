import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { AdvertisingResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe, MonthLabelPipe } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

/**
 * Gráfico 4: publicidad por canal (Meta y Web) frente a lo que dejaron los
 * afiliados nuevos de ese canal. La inversión sale de lo registrado por mes
 * (botón "Publicidad por mes" del gráfico 1). Las ganancias por oficina van aparte (4B).
 */
@Component({
  selector: 'app-advertising-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  template: `
    <div class="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
      <div class="rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Afiliados Meta + Web</p>
        <p class="text-lg font-semibold text-gray-900">{{ data().totals.affiliates }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Recaudo</p>
        <p class="text-lg font-semibold text-gray-900">{{ data().totals.collected | money }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Invertido en publicidad</p>
        <p class="text-lg font-semibold text-gray-900">{{ data().totals.invested | money }}</p>
      </div>
      <div class="rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Costo por afiliado</p>
        <p class="text-lg font-semibold text-gray-900">{{ data().totals.costPerAffiliate | money }}</p>
      </div>
    </div>

    @if (data().totals.affiliates > 0 || data().totals.invested > 0) {
      <app-chart-canvas [config]="chartConfig()" [height]="detailed() ? '300px' : '200px'" ariaLabel="Recaudo frente a inversión en publicidad por canal" />

      <div class="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table class="w-full text-left text-gray-700 tabular-nums" [class.text-xs]="!detailed()" [class.text-sm]="detailed()">
          <thead class="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th class="px-3 py-2">Canal</th>
              <th class="px-3 py-2 text-right">Afiliados</th>
              <th class="px-3 py-2 text-right">Recaudo</th>
              <th class="px-3 py-2 text-right">Invertido</th>
              <th class="px-3 py-2 text-right">Costo afiliaciones</th>
              <th class="px-3 py-2 text-right">Costo por afiliado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            @for (row of data().channels; track row.channel) {
              <tr>
                <td class="px-3 py-1.5 font-medium">{{ row.label }}</td>
                <td class="px-3 py-1.5 text-right">{{ row.affiliates }}</td>
                <td class="px-3 py-1.5 text-right">{{ row.collected | money }}</td>
                <td class="px-3 py-1.5 text-right">{{ row.invested | money }}</td>
                <td class="px-3 py-1.5 text-right">{{ row.affiliationCost | money }}</td>
                <td class="px-3 py-1.5 text-right">{{ row.costPerAffiliate | money }}</td>
              </tr>
            }
          </tbody>
          <tfoot class="bg-gray-100 font-bold">
            <tr>
              <td class="px-3 py-1.5">Total</td>
              <td class="px-3 py-1.5 text-right">{{ data().totals.affiliates }}</td>
              <td class="px-3 py-1.5 text-right">{{ data().totals.collected | money }}</td>
              <td class="px-3 py-1.5 text-right">{{ data().totals.invested | money }}</td>
              <td class="px-3 py-1.5 text-right">{{ data().totals.affiliationCost | money }}</td>
              <td class="px-3 py-1.5 text-right">{{ data().totals.costPerAffiliate | money }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      @if (detailed()) {
        <p class="mt-1 text-xs text-gray-500">
          Afiliados y recaudo: transacciones nuevas aprobadas con origen Meta o Web. Invertido: publicidad registrada
          @if (data().months.length) {
            para {{ monthsLabel() }}.
          } @else {
            (no hay meses registrados en este rango).
          }
          Costo afiliaciones = afiliados × costo por afiliación del filtro. Costo por afiliado = invertido ÷ afiliados.
        </p>
      }
    } @else {
      <p class="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
        No hay afiliados de Meta o Web ni publicidad registrada en este rango. La publicidad se registra con el botón
        "Publicidad por mes" del gráfico 1.
      </p>
    }
  `,
})
export class AdvertisingViewComponent {
  data = input.required<AdvertisingResponse>();
  detailed = input(false);

  private monthLabel = new MonthLabelPipe();
  monthsLabel = computed(() => this.data().months.map((m) => this.monthLabel.transform(m)).join(', '));

  // Dos series (recaudo e invertido) por canal: colores fijos de la paleta y leyenda.
  chartConfig = computed<ChartConfiguration>(() => {
    const channels = this.data().channels;
    return {
      type: 'bar',
      data: {
        labels: channels.map((c) => c.label),
        datasets: [
          { label: 'Recaudo', data: channels.map((c) => c.collected), backgroundColor: seriesColor(0), ...BAR_STYLE },
          { label: 'Invertido', data: channels.map((c) => c.invested), backgroundColor: seriesColor(1), ...BAR_STYLE },
        ],
      },
      options: baseOptions('money', { horizontal: true, legend: true, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
