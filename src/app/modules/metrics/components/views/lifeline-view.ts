import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { LifelineMonthRow, LifelineResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe, MonthLabelPipe, formatMoney, formatMonth } from '../../utils/metrics-format';
import { BAR_STYLE, INK, LINE_STYLE, NEUTRAL_COLOR, baseOptions, seriesColor } from '../../utils/chart-theme';

/** Planes en la torta: los 5 con más ingreso y el resto agrupado en "Otros". */
const TOP_PLANS_IN_PIE = 5;

/** Gráfico 8: línea de vida (ingresos por mes), plan con más ingreso y profesión con más afiliados. */
@Component({
  selector: 'app-lifeline-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe, MonthLabelPipe],
  templateUrl: './lifeline-view.html',
})
export class LifelineViewComponent {
  data = input.required<LifelineResponse>();
  detailed = input(false);

  hasMovements = computed(() =>
    this.data().months.some((m) => m.createdCount + m.reentryCount + m.monthlyCount > 0),
  );

  /** Suma de todos los meses; los conteos son movimientos (un afiliado cuenta en cada mes que paga). */
  totals = computed(() =>
    this.data().months.reduce(
      (acc, m) => ({
        createdAmount: acc.createdAmount + m.createdAmount,
        reentryAmount: acc.reentryAmount + m.reentryAmount,
        monthlyAmount: acc.monthlyAmount + m.monthlyAmount,
        createdCount: acc.createdCount + m.createdCount,
        reentryCount: acc.reentryCount + m.reentryCount,
        monthlyCount: acc.monthlyCount + m.monthlyCount,
      }),
      { createdAmount: 0, reentryAmount: 0, monthlyAmount: 0, createdCount: 0, reentryCount: 0, monthlyCount: 0 },
    ),
  );

  rowAmount(row: Pick<LifelineMonthRow, 'createdAmount' | 'reentryAmount' | 'monthlyAmount'>): number {
    return row.createdAmount + row.reentryAmount + row.monthlyAmount;
  }

  lineConfig = computed<ChartConfiguration>(() => {
    const months = this.data().months;
    const series = [
      { label: 'Creados (nuevos)', key: 'createdAmount' as const },
      { label: 'Reingresos', key: 'reentryAmount' as const },
      { label: 'Mensualidades', key: 'monthlyAmount' as const },
    ];
    return {
      type: 'line',
      data: {
        labels: months.map((m) => formatMonth(m.month)),
        datasets: series.map((s, i) => ({
          label: s.label,
          data: months.map((m) => m[s.key]),
          borderColor: seriesColor(i),
          backgroundColor: seriesColor(i),
          pointBackgroundColor: seriesColor(i),
          ...LINE_STYLE,
        })),
      },
      options: baseOptions('money', { compact: !this.detailed() }),
    } as ChartConfiguration;
  });

  plansConfig = computed<ChartConfiguration>(() => {
    const plans = this.data().topPlans;
    const top = plans.slice(0, TOP_PLANS_IN_PIE);
    const rest = plans.slice(TOP_PLANS_IN_PIE).reduce((acc, p) => acc + p.sales, 0);
    const labels = [...top.map((p) => p.plan), ...(rest > 0 ? ['Otros'] : [])];
    const values = [...top.map((p) => p.sales), ...(rest > 0 ? [rest] : [])];
    const colors = [...top.map((_, i) => seriesColor(i)), ...(rest > 0 ? [NEUTRAL_COLOR] : [])];
    return {
      type: 'pie',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: INK.surface, borderWidth: 2 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: INK.secondary, boxWidth: 10, boxHeight: 10 } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(Number(ctx.raw))}` } },
        },
      },
    } as ChartConfiguration;
  });

  // Una sola serie (afiliados por profesión): un color, sin leyenda.
  professionsConfig = computed<ChartConfiguration>(() => {
    const professions = this.data().topProfessions;
    return {
      type: 'bar',
      data: {
        labels: professions.map((p) => p.profession),
        datasets: [{ label: 'Afiliados', data: professions.map((p) => p.affiliates), backgroundColor: seriesColor(0), ...BAR_STYLE }],
      },
      options: baseOptions('number', { horizontal: true, legend: false }),
    } as ChartConfiguration;
  });

  topPlan = computed(() => this.data().topPlans[0] ?? null);
  topProfession = computed(() => this.data().topProfessions.find((p) => p.profession !== 'Sin profesión') ?? null);
}
