import { Component, computed, input, signal } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { MetricsCondition, NewAffiliationsResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, NEUTRAL_COLOR, baseOptions, seriesColor } from '../../utils/chart-theme';

const METRIC_LABELS = { affiliates: 'Afiliados', sales: 'Ventas', affiliationCost: 'Costo afiliación' } as const;

const CONDITION_LABELS: Record<MetricsCondition, string> = {
  NEW: 'Nuevos',
  MONTHLY: 'Mensualidades',
  WITHDRAWAL: 'Retiros',
};

/**
 * Gráfico 1: barras de Hanna, Sebas, Tatiana y el total del bot (Bot Meta /
 * Bot Web), igual que la tabla "Datos afiliaciones del bot de publicidad".
 */
@Component({
  selector: 'app-new-affiliations-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  templateUrl: './new-affiliations-view.html',
})
export class NewAffiliationsViewComponent {
  data = input.required<NewAffiliationsResponse>();
  detailed = input(false);
  /** Ids del catálogo de orígenes en su orden: fija el color de cada origen. */
  originCatalogIds = input<number[]>([]);

  metric = signal<'affiliates' | 'sales' | 'affiliationCost'>('affiliates');
  /** Canal del gráfico (en el tablero siempre Meta). */
  channel = signal<'META' | 'WEB'>('META');

  /** Tabla del bot del canal escogido: asesores + fila total. */
  botTable = computed(() => {
    const channel = this.detailed() ? this.channel() : 'META';
    return this.data().byChannel.find((t) => t.channel === channel) ?? this.data().byChannel[0];
  });

  conditionLabel = computed(() => CONDITION_LABELS[this.data().condition ?? 'NEW']);

  emptyMessage = computed(() => {
    switch (this.data().condition) {
      case 'MONTHLY':
        return 'No hay mensualidades aprobadas con estos filtros.';
      case 'WITHDRAWAL':
        return 'No hay retiros con estos filtros.';
      default:
        return 'No hay afiliados con fecha de ingreso en este rango con estos filtros.';
    }
  });

  /** Costo por afiliación aplicado (el del filtro): costo total ÷ afiliados. */
  unitCost = computed(() => {
    const totals = this.data().totals;
    return totals.affiliates > 0 ? totals.affiliationCost / totals.affiliates : 0;
  });

  // Una barra por asesor del bot y la del total (Bot Meta / Bot Web), en otro color.
  chartConfig = computed<ChartConfiguration>(() => {
    const table = this.botTable();
    const metric = this.detailed() ? this.metric() : 'affiliates';
    const labels = [...(table?.rows ?? []).map((r) => r.advisor), table?.label.toUpperCase() ?? 'BOT'];
    const values = [...(table?.rows ?? []).map((r) => r[metric]), table?.total[metric] ?? 0];

    return {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: METRIC_LABELS[metric],
            data: values,
            backgroundColor: labels.map((_, i) => (i === labels.length - 1 ? NEUTRAL_COLOR : seriesColor(0))),
            ...BAR_STYLE,
          },
        ],
      },
      options: baseOptions(metric === 'affiliates' ? 'number' : 'money', {
        compact: !this.detailed(),
        legend: false,
      }),
    } as ChartConfiguration;
  });
}
