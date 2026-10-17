import { Component, computed, input, signal } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { FidelizadorCollectionResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe, MonthLabelPipe } from '../../utils/metrics-format';
import { BAR_STYLE, STATUS_COLORS, baseOptions } from '../../utils/chart-theme';

/**
 * Gráfico 9: recaudo de mensualidades por el usuario que realizó los pagos
 * ("Realizado por" de Transacciones). No muestra nada hasta que se escoja al
 * menos un usuario en el filtro del detalle.
 */
@Component({
  selector: 'app-collection-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe, MonthLabelPipe],
  template: `
    @if (!data().filtered) {
      <div class="py-10 text-center text-sm text-gray-600">
        <p class="font-semibold">Escoge uno o más usuarios para ver su recaudo</p>
        <p class="mt-1 text-xs text-gray-500">
          @if (detailed()) {
            Selecciónalos en "Realizado por" y presiona "Aplicar filtros".
          } @else {
            El recaudo es por usuario. Abre este gráfico y escoge en "Realizado por".
          }
        </p>
      </div>
    } @else if (data().rows.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay mensualidades a cargo en {{ data().month | monthLabel }} para estos usuarios.</p>
    } @else {
      <div class="grid grid-cols-2 gap-3 mb-4 md:grid-cols-5">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Facturas del mes</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().totals.expected }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Recaudadas</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().totals.paid }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Faltan por pagar</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().totals.pending }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">% recaudo</p>
          <p class="text-lg font-semibold" [style.color]="data().totals.reachedGoal ? goalColors.GREEN : goalColors.RED">{{ rate(data().totals.rate) }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Meta</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().goal }} %</p>
        </div>
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="chartHeight()" ariaLabel="Porcentaje de recaudo por usuario frente a la meta" />

      @if (detailed()) {
        <div class="mt-6 overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Realizado por</th>
                <th class="px-3 py-2 text-right">Facturas</th>
                <th class="px-3 py-2 text-right">Recaudadas</th>
                <th class="px-3 py-2 text-right">Faltan</th>
                <th class="px-3 py-2 text-right">% recaudo</th>
                <th class="px-3 py-2 text-right">Valor esperado</th>
                <th class="px-3 py-2 text-right">Recaudado</th>
                <th class="px-3 py-2 text-center">Meta</th>
                <th class="px-3 py-2"><span class="sr-only">Detalle</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.userName) {
                <tr>
                  <td class="px-3 py-2 font-medium">{{ row.userName }}</td>
                  <td class="px-3 py-2 text-right">{{ row.expected }}</td>
                  <td class="px-3 py-2 text-right">{{ row.paid }}</td>
                  <td class="px-3 py-2 text-right">{{ row.pending }}</td>
                  <td class="px-3 py-2 text-right font-semibold">{{ rate(row.rate) }}</td>
                  <td class="px-3 py-2 text-right">{{ row.expectedAmount | money }}</td>
                  <td class="px-3 py-2 text-right">{{ row.collectedAmount | money }}</td>
                  <td class="px-3 py-2 text-center">
                    <span class="rounded-full px-2 py-0.5 text-xs font-medium"
                      [class]="row.reachedGoal ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
                      {{ row.reachedGoal ? '✓ Llegó' : '✗ No llegó' }}
                    </span>
                  </td>
                  <td class="px-3 py-2 text-right">
                    @if (row.pending > 0) {
                      <button type="button" (click)="toggle(row.userName)" class="text-xs font-medium text-blue-700 hover:underline"
                        [attr.aria-expanded]="expanded() === row.userName">
                        {{ expanded() === row.userName ? 'Ocultar' : 'Ver faltantes' }}
                      </button>
                    }
                  </td>
                </tr>
                @if (expanded() === row.userName) {
                  <tr>
                    <td colspan="9" class="bg-gray-50 px-3 py-3">
                      <p class="mb-2 text-xs font-semibold uppercase text-gray-500">Faltan por pagar ({{ row.pending }})</p>
                      <div class="max-h-80 overflow-auto rounded-lg border border-gray-200 bg-white">
                        <table class="w-full text-xs text-left text-gray-700 tabular-nums">
                          <thead class="sticky top-0 bg-gray-50 uppercase text-gray-600">
                            <tr>
                              <th class="px-3 py-2">Afiliado</th>
                              <th class="px-3 py-2">Documento</th>
                              <th class="px-3 py-2">WhatsApp</th>
                              <th class="px-3 py-2">Plan</th>
                              <th class="px-3 py-2 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-100">
                            @for (p of row.pendingAffiliates; track p.affiliationId) {
                              <tr>
                                <td class="px-3 py-1.5 font-medium">{{ p.fullName }}</td>
                                <td class="px-3 py-1.5">{{ p.documentNumber ?? '—' }}</td>
                                <td class="px-3 py-1.5">{{ p.phone ?? '—' }}</td>
                                <td class="px-3 py-1.5">{{ p.plan ?? '—' }}</td>
                                <td class="px-3 py-1.5 text-right">{{ p.amount | money }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
            <tfoot class="bg-gray-100 font-bold">
              <tr>
                <td class="px-3 py-2">Total</td>
                <td class="px-3 py-2 text-right">{{ data().totals.expected }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.paid }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.pending }}</td>
                <td class="px-3 py-2 text-right">{{ rate(data().totals.rate) }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.expectedAmount | money }}</td>
                <td class="px-3 py-2 text-right">{{ data().totals.collectedAmount | money }}</td>
                <td class="px-3 py-2 text-center">{{ data().totals.reachedGoal ? '✓' : '✗' }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="mt-1 text-xs text-gray-500">
          Facturas = afiliaciones activas al iniciar el mes cuyo último pago lo realizó ese usuario ("Sin usuario" = nunca han pagado o
          su pago no tiene usuario; las que entran en el mes son nuevas y no cuentan). Recaudada = tiene una transacción aprobada en el mes.
          Valor esperado = precio del plan. Meta = {{ data().goal }} % de recaudo.
        </p>
      }
    }
  `,
})
export class CollectionViewComponent {
  data = input.required<FidelizadorCollectionResponse>();
  detailed = input(false);

  readonly goalColors = { GREEN: STATUS_COLORS.GREEN, RED: STATUS_COLORS.RED };
  expanded = signal<string | null>(null);

  chartHeight = computed(() => `${Math.max(200, this.data().rows.length * 36 + 60)}px`);

  toggle(userName: string): void {
    this.expanded.update((current) => (current === userName ? null : userName));
  }

  rate(value: number | null): string {
    return value == null ? '—' : `${value} %`;
  }

  // Una sola serie (% recaudo): el color dice si llegó a la meta.
  chartConfig = computed<ChartConfiguration>(() => {
    const rows = this.data().rows;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.userName),
        datasets: [
          {
            label: '% recaudo',
            data: rows.map((r) => r.rate ?? 0),
            backgroundColor: rows.map((r) => (r.reachedGoal ? STATUS_COLORS.GREEN : STATUS_COLORS.RED)),
            ...BAR_STYLE,
          },
        ],
      },
      options: { ...baseOptions('percent', { horizontal: true, legend: false }) },
    } as ChartConfiguration;
  });
}
