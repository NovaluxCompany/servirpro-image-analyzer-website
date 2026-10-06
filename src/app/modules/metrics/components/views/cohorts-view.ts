import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { CohortMonthRow, CohortsResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe, MonthLabelPipe, formatMonth } from '../../utils/metrics-format';
import { BAR_STYLE, SERIES_COLORS, baseOptions, seriesColor } from '../../utils/chart-theme';

/** Gráfico 7: cohortes (barras). Una serie por mes de entrada; máximo 8 en el gráfico. */
@Component({
  selector: 'app-cohorts-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe, MonthLabelPipe],
  template: `
    @if (data().cohorts.length === 0) {
      <p class="py-10 text-center text-sm text-gray-500">
        No hay afiliados nuevos entre {{ data().cohortFrom | monthLabel }} y {{ data().cohortTo | monthLabel }} con estos filtros.
      </p>
    } @else {
      <p class="mb-2 text-xs text-gray-500">
        Cohortes de {{ data().cohortFrom | monthLabel }} a {{ data().cohortTo | monthLabel }} · afiliados que siguen pagando cada mes.
      </p>
      <app-chart-canvas [config]="chartConfig()" [height]="detailed() ? '360px' : '240px'" ariaLabel="Afiliados que siguen pagando por cohorte" />
      @if (hiddenCohorts() > 0) {
        <p class="mt-1 text-xs text-gray-500">El gráfico muestra las primeras 8 cohortes; las {{ hiddenCohorts() }} restantes están en la tabla.</p>
      }

      @if (!detailed()) {
        <div class="mt-4 max-h-64 overflow-auto rounded-lg border border-gray-200">
          <table class="w-full text-xs text-left text-gray-700 tabular-nums">
            <thead class="sticky top-0 bg-gray-50 uppercase text-gray-600">
              <tr>
                <th class="px-3 py-2">Cohorte</th>
                <th class="px-3 py-2 text-right">Entraron</th>
                <th class="px-3 py-2 text-right">Siguen (último mes)</th>
                <th class="px-3 py-2 text-right">% que sigue</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (cohort of data().cohorts; track cohort.cohortMonth) {
                <tr>
                  <td class="px-3 py-1.5 font-medium">{{ cohort.cohortMonth | monthLabel }}</td>
                  <td class="px-3 py-1.5 text-right">{{ cohort.rows.length ? cohort.rows[0].affiliates : 0 }}</td>
                  <td class="px-3 py-1.5 text-right">{{ lastRow(cohort)?.affiliates ?? 0 }}</td>
                  <td class="px-3 py-1.5 text-right">{{ retained(cohort, lastRow(cohort)) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (detailed()) {
        <div class="mt-6 overflow-x-auto rounded-lg border border-gray-200">
          <table class="w-full text-sm text-left text-gray-700 tabular-nums">
            <thead class="bg-blue-700 text-xs uppercase text-white">
              <tr>
                <th class="px-3 py-2">Cohorte</th>
                <th class="px-3 py-2">Mes</th>
                <th class="px-3 py-2 text-right">Afiliados</th>
                <th class="px-3 py-2 text-right">% que sigue</th>
                <th class="px-3 py-2 text-right">Mensualidad</th>
                <th class="px-3 py-2 text-right">Planilla</th>
                <th class="px-3 py-2 text-right">P. Reti</th>
                <th class="px-3 py-2 text-right">I. Mora</th>
                <th class="px-3 py-2 text-right">Recaudo neto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @for (cohort of data().cohorts; track cohort.cohortMonth) {
                @for (row of cohort.rows; track row.month; let first = $first) {
                  <tr [class.font-semibold]="first">
                    <td class="px-3 py-2">{{ cohort.cohortMonth | monthLabel }}</td>
                    <td class="px-3 py-2">{{ row.month | monthLabel }}</td>
                    <td class="px-3 py-2 text-right">{{ row.affiliates }}</td>
                    <td class="px-3 py-2 text-right">{{ retained(cohort, row) }}</td>
                    <td class="px-3 py-2 text-right">{{ row.monthly | money }}</td>
                    <td class="px-3 py-2 text-right">{{ row.payroll | money }}</td>
                    <td class="px-3 py-2 text-right text-gray-400">{{ row.retirementPayment | money }}</td>
                    <td class="px-3 py-2 text-right">{{ row.lateFee | money }}</td>
                    <td class="px-3 py-2 text-right text-gray-400">{{ row.netCollection | money }}</td>
                  </tr>
                }
                <tr class="bg-gray-100 font-bold">
                  <td class="px-3 py-2">{{ cohort.cohortMonth | monthLabel }}</td>
                  <td class="px-3 py-2">Total general</td>
                  <td class="px-3 py-2"></td>
                  <td class="px-3 py-2"></td>
                  <td class="px-3 py-2 text-right">{{ cohort.total.monthly | money }}</td>
                  <td class="px-3 py-2 text-right">{{ cohort.total.payroll | money }}</td>
                  <td class="px-3 py-2 text-right text-gray-400">{{ cohort.total.retirementPayment | money }}</td>
                  <td class="px-3 py-2 text-right">{{ cohort.total.lateFee | money }}</td>
                  <td class="px-3 py-2 text-right text-gray-400">{{ cohort.total.netCollection | money }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-2 text-xs text-gray-500">
          % que sigue = afiliados del mes ÷ afiliados del primer mes de la cohorte. P. Reti y Recaudo neto no se manejan en el sistema y se muestran en 0.
        </p>
      }
    }
  `,
})
export class CohortsViewComponent {
  data = input.required<CohortsResponse>();
  detailed = input(false);

  lastRow(cohort: CohortsResponse['cohorts'][number]): CohortMonthRow | undefined {
    return cohort.rows[cohort.rows.length - 1];
  }

  /** Afiliados del mes frente a los que entraron en el primer mes de la cohorte. */
  retained(cohort: CohortsResponse['cohorts'][number], row: CohortMonthRow | undefined): string {
    const initial = cohort.rows.length ? cohort.rows[0].affiliates : 0;
    if (!row || initial === 0) return '—';
    return `${((row.affiliates / initial) * 100).toFixed(1)} %`;
  }

  hiddenCohorts = computed(() => Math.max(0, this.data().cohorts.length - SERIES_COLORS.length));

  chartConfig = computed<ChartConfiguration>(() => {
    const data = this.data();
    const cohorts = data.cohorts.slice(0, SERIES_COLORS.length);
    return {
      type: 'bar',
      data: {
        labels: data.months.map(formatMonth),
        datasets: cohorts.map((cohort, i) => ({
          label: `Cohorte ${formatMonth(cohort.cohortMonth)}`,
          data: data.months.map((m) => cohort.rows.find((r) => r.month === m)?.affiliates ?? null),
          backgroundColor: seriesColor(i),
          ...BAR_STYLE,
        })),
      },
      options: baseOptions('number', { legend: cohorts.length > 1, compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
