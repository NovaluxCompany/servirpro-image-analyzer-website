import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { RetentionLevel, RetentionResponse } from '../../interfaces/metrics.interface';
import { BAR_STYLE, STATUS_COLORS, baseOptions } from '../../utils/chart-theme';

const LEVEL_LABELS: Record<RetentionLevel, string> = { GREEN: 'Verde', YELLOW: 'Amarillo', RED: 'Rojo' };
const LEVEL_CLASSES: Record<RetentionLevel, string> = {
  GREEN: 'bg-green-100 text-green-800',
  YELLOW: 'bg-yellow-100 text-yellow-800',
  RED: 'bg-red-100 text-red-800',
};

/** Gráfico 6: % de retiro por fidelizador con semáforo. */
@Component({
  selector: 'app-retention-view',
  standalone: true,
  imports: [ChartCanvasComponent],
  template: `
    @if (data().rows.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay pagos ni retiros con estos filtros.</p>
    } @else {
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Usuarios totales</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().totals.totalUsers }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Retiros</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().totals.withdrawals }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">% retiro</p>
          <p class="text-lg font-semibold text-gray-900">
            {{ data().totals.withdrawalRate }} %
            <span class="ml-1 rounded-full px-2 py-0.5 text-xs font-medium" [class]="levelClass(data().totals.level)">{{ levelIcon(data().totals.level) }} {{ levelLabel(data().totals.level) }}</span>
          </p>
        </div>
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="chartHeight()" ariaLabel="Porcentaje de retiro por fidelizador" />

      @if (!detailed()) {
        <div class="mt-4 max-h-64 overflow-auto rounded-lg border border-gray-200">
          <table class="w-full text-xs text-left text-gray-700 tabular-nums">
            <thead class="sticky top-0 bg-gray-50 uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fidelizador</th>
                <th class="px-3 py-2 text-right">Usuarios totales</th>
                <th class="px-3 py-2 text-right">Retiros</th>
                <th class="px-3 py-2 text-right">% retiro</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.fidelizador) {
                <tr>
                  <td class="px-3 py-1.5 font-medium">{{ row.fidelizador }}</td>
                  <td class="px-3 py-1.5 text-right">{{ row.totalUsers }}</td>
                  <td class="px-3 py-1.5 text-right">{{ row.withdrawals }}</td>
                  <td class="px-3 py-1.5 text-right">
                    <span class="rounded-full px-2 py-0.5 font-medium" [class]="levelClass(row.level)">{{ levelIcon(row.level) }} {{ row.withdrawalRate }} %</span>
                  </td>
                </tr>
              }
            </tbody>
            <tfoot class="sticky bottom-0 bg-gray-100 font-bold">
              <tr>
                <td class="px-3 py-1.5">{{ data().totals.fidelizador }}</td>
                <td class="px-3 py-1.5 text-right">{{ data().totals.totalUsers }}</td>
                <td class="px-3 py-1.5 text-right">{{ data().totals.withdrawals }}</td>
                <td class="px-3 py-1.5 text-right">{{ data().totals.withdrawalRate }} %</td>
              </tr>
            </tfoot>
          </table>
        </div>
      }

      @if (detailed()) {
        <div class="mt-6 overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fidelizador</th>
                <th class="px-3 py-2 text-right">Mensualidad</th>
                <th class="px-3 py-2 text-right">Nuevos</th>
                <th class="px-3 py-2 text-right">Usuarios totales</th>
                <th class="px-3 py-2 text-right">Pagos</th>
                <th class="px-3 py-2 text-right">Retiros</th>
                <th class="px-3 py-2 text-right">% retiro</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.fidelizador) {
                <tr>
                  <td class="px-3 py-2 font-medium">{{ row.fidelizador }}</td>
                  <td class="px-3 py-2 text-right">{{ row.monthly }}</td>
                  <td class="px-3 py-2 text-right">{{ row.newOnes }}</td>
                  <td class="px-3 py-2 text-right">{{ row.totalUsers }}</td>
                  <td class="px-3 py-2 text-right">{{ row.payments }}</td>
                  <td class="px-3 py-2 text-right">{{ row.withdrawals }}</td>
                  <td class="px-3 py-2 text-right">
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium" [class]="levelClass(row.level)">{{ levelIcon(row.level) }} {{ row.withdrawalRate }} %</span>
                  </td>
                </tr>
              }
            </tbody>
            <tfoot class="bg-blue-50 font-bold">
              <tr>
                <td class="px-3 py-2">{{ data().totals.fidelizador }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.monthly }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.newOnes }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.totalUsers }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.payments }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.withdrawals }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.withdrawalRate }} %</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="mt-2 text-xs text-gray-500">
          Usuarios totales = mensualidad + nuevos + retiros · Pagos = mensualidad + nuevos · Retiro = afiliación inactivada en el rango (fecha de inactivación).
          <span class="ml-1">■ Verde &lt; 20 % · ■ Amarillo 20–30 % · ■ Rojo &gt; 30 %</span>
        </p>
      }
    }
  `,
})
export class RetentionViewComponent {
  data = input.required<RetentionResponse>();
  detailed = input(false);

  chartHeight = computed(() => `${Math.max(this.detailed() ? 260 : 200, this.data().rows.length * 36 + 60)}px`);

  chartConfig = computed<ChartConfiguration>(() => {
    const rows = this.data().rows;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.fidelizador),
        datasets: [
          {
            label: '% retiro',
            data: rows.map((r) => r.withdrawalRate),
            backgroundColor: rows.map((r) => STATUS_COLORS[r.level]),
            ...BAR_STYLE,
          },
        ],
      },
      options: baseOptions('percent', { horizontal: true, legend: false, compact: !this.detailed() }),
    } as ChartConfiguration;
  });

  levelLabel(level: RetentionLevel): string {
    return LEVEL_LABELS[level];
  }

  levelClass(level: RetentionLevel): string {
    return LEVEL_CLASSES[level];
  }

  /** El semáforo nunca va solo por color: ícono + etiqueta. */
  levelIcon(level: RetentionLevel): string {
    return level === 'GREEN' ? '✓' : level === 'YELLOW' ? '!' : '✕';
  }
}
