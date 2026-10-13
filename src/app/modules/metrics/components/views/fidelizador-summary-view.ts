import { Component, computed, input, linkedSignal } from '@angular/core';
import { ActiveElement, ChartConfiguration, ChartEvent } from 'chart.js';
import { ChartCanvasComponent } from '../chart-canvas/chart-canvas';
import { FidelizadorSummaryResponse, FidelizadorSummaryRow } from '../../interfaces/metrics.interface';
import { MoneyPipe } from '../../utils/metrics-format';
import { BAR_STYLE, baseOptions, seriesColor } from '../../utils/chart-theme';

/**
 * Gráfico 2: resumen por fidelizador (ventas, costo afiliación, ganancia neta).
 * Clic en una fila de la tabla o en una barra selecciona ese fidelizador y el
 * gráfico muestra solo los seleccionados, sin tocar el filtro general.
 */
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

  /** Fidelizadores elegidos desde la tabla o el gráfico; al recargar se conservan los que sigan existiendo. */
  selected = linkedSignal<FidelizadorSummaryRow[], Set<string>>({
    source: this.allRows,
    computation: (rows, previous) => {
      const names = new Set(rows.map((r) => r.fidelizador));
      return new Set([...(previous?.value ?? [])].filter((name) => names.has(name)));
    },
  });

  hasSelection = computed(() => this.selected().size > 0);

  visibleRows = computed(() => {
    const selected = this.selected();
    return selected.size > 0 ? this.allRows().filter((r) => selected.has(r.fidelizador)) : this.allRows();
  });

  /** Totales de la selección (suma de filas; la publicidad general no se reparte por fidelizador). */
  selectionTotals = computed(() =>
    this.visibleRows().reduce(
      (acc, r) => ({ affiliates: acc.affiliates + r.affiliates, sales: acc.sales + r.sales, netProfit: acc.netProfit + r.netProfit }),
      { affiliates: 0, sales: 0, netProfit: 0 },
    ),
  );

  isSelected(name: string): boolean {
    return this.selected().has(name);
  }

  toggle(name: string, event?: Event): void {
    // En el tablero la tarjeta abre el detalle al hacer clic: la selección no debe navegar.
    event?.stopPropagation();
    this.selected.update((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  clearSelection(event?: Event): void {
    event?.stopPropagation();
    this.selected.set(new Set());
  }

  chartConfig = computed<ChartConfiguration>(() => {
    const rows = this.visibleRows();
    const options = baseOptions('money', { compact: !this.detailed() });
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
      options: {
        ...options,
        // Clic en una barra = seleccionar/quitar ese fidelizador.
        onClick: (event: ChartEvent, elements: ActiveElement[]) => {
          if (elements.length === 0) return;
          const row = rows[elements[0].index];
          if (row) this.toggle(row.fidelizador, event.native ?? undefined);
        },
        onHover: (event: ChartEvent, elements: ActiveElement[]) => {
          const target = event.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length ? 'pointer' : 'default';
        },
      },
    } as ChartConfiguration;
  });
}
