import { Component, computed, input } from '@angular/core';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { FidelizadorSummaryResponse } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

/** Gráfico 2: resumen por fidelizador (ventas, costo afiliación, ganancia neta). */
@Component({
  selector: 'app-fidelizador-summary-view',
  standalone: true,
  imports: [ChartCanvasComponent, MoneyPipe],
  templateUrl: './fidelizador-summary-view.html',
})
export class FidelizadorSummaryViewComponent {
  data = input.required<FidelizadorSummaryResponse>();
  detailed = input(false);

  allRows = computed(() => {
    const data = this.data();
    return data.offices ? [...data.rows, data.offices] : data.rows;
  });

  chartConfig = computed<ChartConfiguration>(() => {
    const rows = this.allRows();
    return {
      type: 'bar',
      data: {
        labels: rows.map((r) => r.fidelizador),
        datasets: [
          { label: 'Ventas afiliaciones', data: rows.map((r) => r.sales), backgroundColor: seriesColor(0), ...BAR_STYLE },
          { label: 'Costo afiliaciones', data: rows.map((r) => r.affiliationCost), backgroundColor: seriesColor(1), ...BAR_STYLE },
          { label: 'Ganancia neta', data: rows.map((r) => r.netProfit), backgroundColor: seriesColor(2), ...BAR_STYLE },
        ],
      },
      options: baseOptions('money', { compact: !this.detailed() }),
    } as ChartConfiguration;
  });
}
