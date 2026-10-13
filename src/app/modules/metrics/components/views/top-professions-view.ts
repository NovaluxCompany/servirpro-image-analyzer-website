import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { TopProfessionsResponse } from '../../interfaces/metrics.interface';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

/** Gráfico 8C: profesiones con más afiliados (antes dentro de la línea de vida). */
@Component({
  selector: 'app-top-professions-view',
  standalone: true,
  imports: [ChartCanvasComponent],
  template: `
    @if (data().professions.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay afiliados con estos filtros.</p>
    } @else {
      <div class="mb-4 rounded-lg bg-gray-50 px-3 py-2">
        <p class="text-xs text-gray-500">Profesión con más afiliados</p>
        @if (topProfession(); as profession) {
          <p class="text-sm font-semibold text-gray-900 truncate">{{ profession.profession }}</p>
          <p class="text-xs text-gray-600">{{ profession.affiliates }} afiliados</p>
        } @else {
          <p class="text-sm text-gray-500">—</p>
        }
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="detailed() ? '340px' : '260px'" ariaLabel="Afiliados por profesión" />

      @if (detailed()) {
        <div class="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Profesión</th>
                <th class="px-3 py-2 text-right">Afiliados</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (profession of data().professions; track profession.profession) {
                <tr>
                  <td class="px-3 py-2">{{ profession.profession }}</td>
                  <td class="px-3 py-2 text-right">{{ profession.affiliates }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    }
  `,
})
export class TopProfessionsViewComponent {
  data = input.required<TopProfessionsResponse>();
  detailed = input(false);

  topProfession = computed(() => this.data().professions.find((p) => p.profession !== 'Sin profesión') ?? null);

  // Una sola serie (afiliados por profesión): un color, sin leyenda.
  chartConfig = computed<ChartConfiguration>(() => {
    const professions = this.data().professions;
    return {
      type: 'bar',
      data: {
        labels: professions.map((p) => p.profession),
        datasets: [{ label: 'Afiliados', data: professions.map((p) => p.affiliates), backgroundColor: seriesColor(0), ...BAR_STYLE }],
      },
      options: baseOptions('number', { horizontal: true, legend: false, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
