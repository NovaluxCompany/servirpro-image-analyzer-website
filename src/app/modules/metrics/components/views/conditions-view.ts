import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { ConditionKind, ConditionRow, ConditionsFidelizador, ConditionsResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, STATUS_COLORS, baseOptions, seriesColor } from '../../utils/chart-theme';

/**
 * Colores con significado (pedido del cliente): verde = lo que entra
 * (mensualidad de ordinarios), rojo = lo que se pierde (retiros y lo que falta
 * por cobrar), azul = no ordinarios, morado = resolución. El
 * mismo color en la barra, la leyenda y la tabla; siempre con su etiqueta.
 */
const CONDITION_COLORS: Record<ConditionKind, string> = {
  MONTHLY: STATUS_COLORS.GREEN,
  NON_ORDINARY: seriesColor(0),
  RESOLUTION: seriesColor(6),
  WITHDRAWAL: STATUS_COLORS.RED,
};

/**
 * Gráfico 5: Mensualidad (Ordinarios) / No ordinario / Retiro
 * por fidelizador, como la tabla del Excel (ASESOR / CONDICIÓN / USUARIOS /
 * MENSUALIDAD / PLANILLA / P. RETI / I. MORA), con Vlr. administración,
 * % de recaudo, lo que falta por cobrar y % de retiro. Las condiciones y su
 * orden vienen del backend (Resolución solo sale si hay afiliados en ella).
 */
@Component({
  selector: 'app-conditions-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  template: `
    @if (data().rows.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">No hay mensualidades, no ordinarios ni retiros con estos filtros.</p>
    } @else {
      <div class="grid grid-cols-2 gap-3 mb-4 md:grid-cols-3 xl:grid-cols-5">
        <div class="rounded-lg border-l-4 bg-gray-50 px-3 py-2" [style.border-left-color]="color('MONTHLY')">
          <p class="text-xs text-gray-500">Vendido en mensualidades (ordinarios)</p>
          <p class="text-lg font-semibold text-gray-900">{{ condition(data().totals, 'MONTHLY').sold | money }}</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">% recaudo mensualidades</p>
          <p class="text-lg font-semibold text-gray-900">{{ rate(data().totals.monthlyCollection.rate) }}</p>
          <p class="text-[11px] text-gray-500">{{ data().totals.monthlyCollection.paid }} de {{ data().totals.monthlyCollection.expected }} pagaron</p>
        </div>
        <div class="rounded-lg border-l-4 bg-gray-50 px-3 py-2" [style.border-left-color]="color('WITHDRAWAL')">
          <p class="text-xs text-gray-500">Faltan por cobrar</p>
          <p class="text-lg font-semibold" [style.color]="color('WITHDRAWAL')">{{ data().totals.monthlyCollection.pendingAmount | money }}</p>
          <p class="text-[11px] text-gray-500">{{ data().totals.monthlyCollection.pending }} afiliado(s) sin pagar</p>
        </div>
        <div class="rounded-lg border-l-4 bg-gray-50 px-3 py-2" [style.border-left-color]="color('WITHDRAWAL')">
          <p class="text-xs text-gray-500">% retiro de la empresa</p>
          <p class="text-lg font-semibold" [style.color]="color('WITHDRAWAL')">{{ data().companyWithdrawalRate }} %</p>
        </div>
        <div class="rounded-lg bg-gray-50 px-3 py-2">
          <p class="text-xs text-gray-500">Mora (I. Mora)</p>
          <p class="text-lg font-semibold text-gray-900">{{ totalLateFee() | money }}</p>
        </div>
      </div>

      <app-chart-canvas [config]="chartConfig()" [height]="detailed() ? '360px' : '240px'"
        ariaLabel="Usuarios en mensualidad (ordinarios), no ordinario y retiro por fidelizador" />

      @if (!detailed()) {
        <div class="mt-4 max-h-64 overflow-auto rounded-lg border border-gray-200">
          <table class="w-full text-xs text-left text-gray-700 tabular-nums">
            <thead class="sticky top-0 bg-gray-50 uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Fidelizador</th>
                @for (kind of kinds(); track kind) {
                  <th class="px-3 py-2 text-right">
                    <span class="inline-flex items-center gap-1.5">
                      <span class="h-2 w-2 rounded-full" [style.background-color]="color(kind)"></span>{{ shortLabel(kind) }}
                    </span>
                  </th>
                }
                <th class="px-3 py-2 text-right">Por cobrar</th>
                <th class="px-3 py-2 text-right">% retiro</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (row of data().rows; track row.fidelizador) {
                <tr>
                  <td class="px-3 py-1.5 font-medium">{{ row.fidelizador }}</td>
                  @for (kind of kinds(); track kind) {
                    <td class="px-3 py-1.5 text-right" [style.color]="kind === 'WITHDRAWAL' ? color(kind) : null">{{ condition(row, kind).users }}</td>
                  }
                  <td class="px-3 py-1.5 text-right" [style.color]="color('WITHDRAWAL')">{{ row.monthlyCollection.pending }}</td>
                  <td class="px-3 py-1.5 text-right">{{ row.withdrawalRate }} %</td>
                </tr>
              }
            </tbody>
            <tfoot class="sticky bottom-0 bg-gray-100 font-semibold">
              <tr>
                <td class="px-3 py-1.5">Suma total</td>
                @for (kind of kinds(); track kind) {
                  <td class="px-3 py-1.5 text-right" [style.color]="kind === 'WITHDRAWAL' ? color(kind) : null">{{ condition(data().totals, kind).users }}</td>
                }
                <td class="px-3 py-1.5 text-right" [style.color]="color('WITHDRAWAL')">{{ data().totals.monthlyCollection.pending }}</td>
                <td class="px-3 py-1.5 text-right">{{ data().totals.withdrawalRate }} %</td>
              </tr>
            </tfoot>
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
                    <td class="border-l-4 px-3 py-2 font-medium" [style.border-left-color]="color(c.condition)" [style.color]="color(c.condition)">{{ c.label }}</td>
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
                    Faltan por cobrar:
                    <span class="font-semibold" [style.color]="color('WITHDRAWAL')">
                      {{ row.monthlyCollection.pending }} afiliado(s), {{ row.monthlyCollection.pendingAmount | money }}
                    </span> ·
                    % retiro: <span class="font-semibold text-gray-900">{{ row.withdrawalRate }} %</span>
                  </td>
                </tr>
              }
            </tbody>
            <tfoot class="bg-gray-100 font-bold">
              @for (c of data().totals.conditions; track c.condition; let first = $first) {
                <tr>
                  <td class="px-3 py-2">{{ first ? 'Suma total' : '' }}</td>
                  <td class="border-l-4 px-3 py-2" [style.border-left-color]="color(c.condition)" [style.color]="color(c.condition)">{{ c.label }}</td>
                  <td class="px-3 py-2 text-right">{{ c.users }}</td>
                  <td class="px-3 py-2 text-right">{{ money(c.sold) }}</td>
                  <td class="px-3 py-2 text-right">{{ money(c.payroll) }}</td>
                  <td class="px-3 py-2 text-right">{{ money(c.admin) }}</td>
                  <td class="px-3 py-2 text-right">{{ c.retirementPayment | money }}</td>
                  <td class="px-3 py-2 text-right">{{ c.lateFee | money }}</td>
                  <td class="px-3 py-2 text-right">{{ c.collectionShare == null ? '—' : c.collectionShare + ' %' }}</td>
                </tr>
              }
              <tr class="border-t border-gray-300">
                <td class="px-3 py-2"></td>
                <td class="border-l-4 px-3 py-2" [style.border-left-color]="color('WITHDRAWAL')" [style.color]="color('WITHDRAWAL')">Faltan por cobrar</td>
                <td class="px-3 py-2 text-right" [style.color]="color('WITHDRAWAL')">{{ data().totals.monthlyCollection.pending }}</td>
                <td class="px-3 py-2 text-right" [style.color]="color('WITHDRAWAL')">{{ data().totals.monthlyCollection.pendingAmount | money }}</td>
                <td class="px-3 py-2 text-xs font-normal text-gray-600" colspan="5">
                  de {{ data().totals.monthlyCollection.expected }} afiliados que debían pagar
                  (recaudo {{ rate(data().totals.monthlyCollection.rate) }})
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p class="mt-1 text-xs text-gray-500">
          No se cuentan las afiliaciones nuevas ni los reingresos (van en "Nuevos" del gráfico 1). Mensualidad: pagos aprobados del
          rango de afiliados Ordinarios. No ordinario: pagos aprobados de afiliados No ordinarios (menores de la edad límite por género,
          sin AFP ni documento extranjero: la regla de Actualizar empresa). La categoría es la de la afiliación; si no la tiene guardada se calcula con la regla del sistema (edad por género, plan con
          AFP, documento extranjero). Retiro: afiliados inactivados en el rango. Planilla y Vlr. administración: regla de Siigo de
          cada afiliado. I. Mora: mora digitada al enviar la factura a Siigo. % del recaudo: lo vendido en la condición sobre lo
          vendido por el fidelizador. Recaudo mensualidades: afiliados activos al iniciar el rango que pagaron en él; faltan por
          cobrar: los que no, con el precio de venta de su plan. % retiro: retiros ÷ usuarios totales (igual que el gráfico 6).
          P. Retiro: pendiente de definir.
        </p>
      }
    }
  `,
})
export class ConditionsViewComponent {
  data = input.required<ConditionsResponse>();
  detailed = input(false);

  /** Condiciones que manda el backend, en su orden. */
  kinds = computed<ConditionKind[]>(() => this.data().totals.conditions.map((c) => c.condition));

  totalLateFee = computed(() => this.data().totals.conditions.reduce((acc, c) => acc + c.lateFee, 0));

  condition(row: ConditionsFidelizador, kind: ConditionKind): Pick<ConditionRow, 'users' | 'sold'> {
    return row.conditions.find((c) => c.condition === kind) ?? { users: 0, sold: 0 };
  }

  color(kind: ConditionKind): string {
    return CONDITION_COLORS[kind];
  }

  /** Etiqueta corta para las columnas de la tabla compacta. */
  shortLabel(kind: ConditionKind): string {
    return this.data().totals.conditions.find((c) => c.condition === kind)?.label.replace(/ \(.*\)$/, '') ?? kind;
  }

  money(value: number | null): string {
    return value == null ? '—' : new MoneyPipe().transform(value);
  }

  rate(value: number | null): string {
    return value == null ? '—' : `${value} %`;
  }

  // Una serie por condición, con el color de su significado y leyenda.
  chartConfig = computed<ChartConfiguration>(() => {
    const rows = this.data().rows;
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.fidelizador),
        datasets: this.data().totals.conditions.map((c) => ({
          label: c.label,
          data: rows.map((r) => this.condition(r, c.condition).users),
          backgroundColor: this.color(c.condition),
          ...BAR_STYLE,
        })),
      },
      options: baseOptions('number', { legend: true, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
