import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { ConditionKind, ConditionsFidelizador, ConditionsResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

const CONDITION_ORDER: ConditionKind[] = ['MONTHLY', 'REENTRY', 'WITHDRAWAL'];
const CONDITION_LABELS: Record<ConditionKind, string> = { MONTHLY: 'Mensualidad', REENTRY: 'Reingreso', WITHDRAWAL: 'Retiro' };

/**
 * Gráfico 5: Mensualidad / Reingreso / Retiro por fidelizador, como la tabla
 * del Excel (ASESOR / CONDICIÓN / USUARIOS / MENSUALIDAD / PLANILLA / P. RETI /
 * I. MORA), con Vlr. administración, % de recaudo y % de retiro.
 */
@Component({
  selector: 'app-conditions-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  template: `
    @if (data().rows.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay mensualidades, reingresos ni retiros con estos filtros.</p>
    } @else {
      <div class="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Vendido en mensualidades</p>
          <p class="text-lg font-semibold text-gray-900">{{ condition(data().totals, 'MONTHLY').sold | money }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">% recaudo mensualidades</p>
          <p class="text-lg font-semibold text-gray-900">{{ rate(data().totals.monthlyCollection.rate) }}</p>
          <p class="text-[11px] text-gray-500">{{ data().totals.monthlyCollection.paid }} de {{ data().totals.monthlyCollection.expected }} pagaron</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">% retiro de la empresa</p>
          <p class="text-lg font-semibold text-gray-900">{{ data().companyWithdrawalRate }} %</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Mora (I. Mora)</p>
          <p class="text-lg font-semibold text-gray-900">{{ totalLateFee() | money }}</p>
        </div>
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="detailed() ? '360px' : '240px'"
        ariaLabel="Usuarios en mensualidad, reingreso y retiro por fidelizador" />

      @if (!detailed()) {
        <div class="mt-4 max-h-64 overflow-auto rounded-lg border border-gray-200">
          <table class="w-full text-xs text-left text-gray-700 tabular-nums">
            <thead class="sticky top-0 bg-gray-50 uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fidelizador</th>
                <th class="px-3 py-2 text-right">Mensualidad</th>
                <th class="px-3 py-2 text-right">Reingreso</th>
                <th class="px-3 py-2 text-right">Retiro</th>
                <th class="px-3 py-2 text-right">% retiro</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.fidelizador) {
                <tr>
                  <td class="px-3 py-1.5 font-medium">{{ row.fidelizador }}</td>
                  <td class="px-3 py-1.5 text-right">{{ condition(row, 'MONTHLY').users }}</td>
                  <td class="px-3 py-1.5 text-right">{{ condition(row, 'REENTRY').users }}</td>
                  <td class="px-3 py-1.5 text-right">{{ condition(row, 'WITHDRAWAL').users }}</td>
                  <td class="px-3 py-1.5 text-right">{{ row.withdrawalRate }} %</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <h3 class="mt-8 mb-2 text-base font-semibold text-gray-900">Detalle por fidelizador y condición</h3>
        <div class="overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-slate-600 text-xs uppercase text-white">
              <tr>
                <th class="px-3 py-2">Fidelizador</th>
                <th class="px-3 py-2">Condición</th>
                <th class="px-3 py-2 text-right">Usuarios</th>
                <th class="px-3 py-2 text-right">Mensualidad</th>
                <th class="px-3 py-2 text-right">Planilla</th>
                <th class="px-3 py-2 text-right">Vlr. administración</th>
                <th class="px-3 py-2 text-right">P. Retiro</th>
                <th class="px-3 py-2 text-right">I. Mora</th>
                <th class="px-3 py-2 text-right">% del recaudo</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.fidelizador) {
                @for (c of row.conditions; track c.condition; let first = $first) {
                  <tr>
                    <td class="px-3 py-2 font-medium">{{ first ? row.fidelizador : '' }}</td>
                    <td class="px-3 py-2">{{ c.label }}</td>
                    <td class="px-3 py-2 text-right">{{ c.users }}</td>
                    <td class="px-3 py-2 text-right">{{ money(c.sold) }}</td>
                    <td class="px-3 py-2 text-right">{{ money(c.payroll) }}</td>
                    <td class="px-3 py-2 text-right">{{ money(c.admin) }}</td>
                    <td class="px-3 py-2 text-right text-gray-400" title="Pendiente de definir">{{ c.retirementPayment | money }}</td>
                    <td class="px-3 py-2 text-right">{{ c.lateFee | money }}</td>
                    <td class="px-3 py-2 text-right">{{ c.collectionShare == null ? '—' : c.collectionShare + ' %' }}</td>
                  </tr>
                }
                <tr class="bg-gray-50 text-xs text-gray-600">
                  <td class="px-3 py-1.5" colspan="9">
                    Recaudo mensualidades: <span class="font-semibold text-gray-900">{{ rate(row.monthlyCollection.rate) }}</span>
                    ({{ row.monthlyCollection.paid }} de {{ row.monthlyCollection.expected }} pagaron) ·
                    % retiro: <span class="font-semibold text-gray-900">{{ row.withdrawalRate }} %</span>
                  </td>
                </tr>
              }
            </tbody>
            <tfoot class="bg-gray-100 font-bold">
              @for (c of data().totals.conditions; track c.condition; let first = $first) {
                <tr>
                  <td class="px-3 py-2">{{ first ? 'Suma total' : '' }}</td>
                  <td class="px-3 py-2">{{ c.label }}</td>
                  <td class="px-3 py-2 text-right">{{ c.users }}</td>
                  <td class="px-3 py-2 text-right">{{ money(c.sold) }}</td>
                  <td class="px-3 py-2 text-right">{{ money(c.payroll) }}</td>
                  <td class="px-3 py-2 text-right">{{ money(c.admin) }}</td>
                  <td class="px-3 py-2 text-right">{{ c.retirementPayment | money }}</td>
                  <td class="px-3 py-2 text-right">{{ c.lateFee | money }}</td>
                  <td class="px-3 py-2 text-right">{{ c.collectionShare == null ? '—' : c.collectionShare + ' %' }}</td>
                </tr>
              }
            </tfoot>
          </table>
        </div>
        <p class="mt-1 text-xs text-gray-500">
          Mensualidad: transacciones aprobadas no nuevas. Reingreso: transacciones nuevas con origen Reingreso. Retiro: afiliados
          inactivados en el rango. Planilla y Vlr. administración: regla de Siigo de cada afiliado. I. Mora: mora digitada al enviar
          la factura a Siigo. % del recaudo: lo vendido en la condición sobre lo vendido por el fidelizador. Recaudo mensualidades:
          afiliados activos al iniciar el rango que pagaron en él. % retiro: retiros ÷ usuarios totales (igual que el gráfico 6).
          P. Retiro: pendiente de definir.
        </p>
      }
    }
  `,
})
export class ConditionsViewComponent {
  data = input.required<ConditionsResponse>();
  detailed = input(false);

  totalLateFee = computed(() => this.data().totals.conditions.reduce((acc, c) => acc + c.lateFee, 0));

  condition(row: ConditionsFidelizador, kind: ConditionKind) {
    return row.conditions.find((c) => c.condition === kind) ?? { users: 0, sold: 0 };
  }

  money(value: number | null): string {
    return value == null ? '—' : new MoneyPipe().transform(value);
  }

  rate(value: number | null): string {
    return value == null ? '—' : `${value} %`;
  }

  // Tres series (las condiciones) por fidelizador: colores fijos y leyenda.
  chartConfig = computed<ChartConfiguration>(() => {
    const rows = this.data().rows;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.fidelizador),
        datasets: CONDITION_ORDER.map((kind, i) => ({
          label: CONDITION_LABELS[kind],
          data: rows.map((r) => this.condition(r, kind).users),
          backgroundColor: seriesColor(i),
          ...BAR_STYLE,
        })),
      },
      options: baseOptions('number', { legend: true, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
