import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../../../core/service/toast.service';
import { MetricsFilterBarComponent } from '../../components/filter-bar/metrics-filter-bar';
import { MissingDataComponent } from '../../components/missing-data/missing-data';
import { MetricChartViewComponent } from '../../components/views/metric-chart-view';
import { MetricsFilterField, MetricsFilters } from '../../interfaces/metrics.interface';
import { ALL_FILTER_FIELDS, FILTER_FIELD_LABELS, METRIC_CHARTS, MetricChartDefinition, MetricChartKey } from '../../metric-charts.config';
import { MetricsService } from '../../services/metrics.service';
import { MetricsFiltersStore } from '../../services/metrics-filters.store';

interface CardState {
  loading: boolean;
  data: any | null;
  error: string | null;
}

/**
 * Tablero de Métricas: un filtro general arriba que aplica a todos los
 * gráficos (cada tarjeta indica qué filtros le afectan) y una tarjeta por
 * gráfico; clic en el título o en el gráfico abre su detalle.
 */
@Component({
  selector: 'app-metrics-dashboard',
  standalone: true,
  imports: [MetricsFilterBarComponent, MissingDataComponent, MetricChartViewComponent],
  templateUrl: './metrics-dashboard.html',
})
export class MetricsDashboardComponent implements OnInit {
  private _service = inject(MetricsService);
  private _store = inject(MetricsFiltersStore);
  private _toast = inject(ToastService);
  private _router = inject(Router);

  readonly charts = METRIC_CHARTS;
  readonly options = this._store.options;
  readonly filters = this._store.filters;

  states = signal<Partial<Record<MetricChartKey, CardState>>>({});
  loadingOptions = signal(false);

  isLoadingAny = computed(() => Object.values(this.states()).some((s) => s?.loading));
  originCatalogIds = computed(() => (this.options()?.origins ?? []).map((o) => o.id));

  /** Todos los avisos de datos faltantes, sin repetir, con el gráfico que los reporta. */
  allMissing = computed(() => {
    const byMessage = new Map<string, string[]>();
    for (const chart of this.charts) {
      for (const message of this.states()[chart.key]?.data?.missingData ?? []) {
        byMessage.set(message, [...(byMessage.get(message) ?? []), chart.number]);
      }
    }
    return [...byMessage.entries()].map(([message, numbers]) => `Gráfico ${numbers.join(', ')}: ${message}`);
  });

  ngOnInit(): void {
    if (this.options()) {
      this.loadAll();
      return;
    }
    this.loadingOptions.set(true);
    this._service.getFilterOptions().subscribe({
      next: (options) => {
        this._store.setOptions(options);
        this.loadingOptions.set(false);
        this.loadAll();
      },
      error: (err) => {
        this.loadingOptions.set(false);
        this._toast.showError(err?.message ?? 'No fue posible cargar los filtros de métricas');
      },
    });
  }

  onApply(filters: MetricsFilters): void {
    this._store.filters.set(filters);
    this.loadAll();
  }

  openDetail(chart: MetricChartDefinition): void {
    this._router.navigate(['/metricas', chart.key]);
  }

  state(key: MetricChartKey): CardState | undefined {
    return this.states()[key];
  }

  appliedFilters(chart: MetricChartDefinition): string {
    return chart.filters.map((f) => FILTER_FIELD_LABELS[f]).join(' · ');
  }

  ignoredFilters(chart: MetricChartDefinition): string {
    return ALL_FILTER_FIELDS.filter((f: MetricsFilterField) => !chart.filters.includes(f))
      .map((f) => FILTER_FIELD_LABELS[f])
      .join(' · ');
  }

  private loadAll(): void {
    const filters = this.filters();
    if (!filters) return;

    for (const chart of this.charts) {
      // Se conserva el resultado anterior mientras carga (sin parpadeo).
      this.patch(chart.key, { loading: true, error: null });
      this._service.getChart(chart.key, filters).subscribe({
        next: (data) => this.patch(chart.key, { loading: false, data, error: null }),
        error: (err) => this.patch(chart.key, { loading: false, error: err?.message ?? 'No fue posible cargar el gráfico' }),
      });
    }
  }

  private patch(key: MetricChartKey, change: Partial<CardState>): void {
    this.states.update((states) => ({
      ...states,
      [key]: { loading: false, data: null, error: null, ...states[key], ...change },
    }));
  }
}
