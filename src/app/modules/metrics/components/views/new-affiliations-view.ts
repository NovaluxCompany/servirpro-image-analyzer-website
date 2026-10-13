import { Component, computed, input, signal } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { NewAffiliationsResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { STACKED_BAR_STYLE, baseOptions, originColor } from '../../utils/chart-theme';

/** Gráfico 1: afiliados nuevos por fidelizador, apilados por origen. */
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

  /** Costo por afiliación aplicado (el del filtro): costo total ÷ afiliados. */
  unitCost = computed(() => {
    const totals = this.data().totals;
    return totals.affiliates > 0 ? totals.affiliationCost / totals.affiliates : 0;
  });

  chartConfig = computed<ChartConfiguration>(() => {
    const data = this.data();
    const metric = this.detailed() ? this.metric() : 'affiliates';
    const fidelizadores = data.byFidelizador.map((f) => f.fidelizador);

    return {
      type: 'bar',
      data: {
        labels: fidelizadores,
        datasets: data.byOrigin.map((origin) => ({
          label: origin.origin,
          data: fidelizadores.map((fid) => {
            const row = origin.rows.find((r) => r.fidelizador === fid);
            return row ? row[metric] : 0;
          }),
          backgroundColor: originColor(origin.originId, this.originCatalogIds()),
          ...STACKED_BAR_STYLE,
        })),
      },
      options: baseOptions(metric === 'affiliates' ? 'number' : 'money', {
        stacked: true,
        compact: !this.detailed(),
        legend: data.byOrigin.length > 1,
      }),
    } as ChartConfiguration;
  });
}
