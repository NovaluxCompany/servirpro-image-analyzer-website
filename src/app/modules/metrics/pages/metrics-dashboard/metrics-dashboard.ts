import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from '../../../../core/service/toast.service';
import { MetricsFilterBarComponent } from '../../components/filter-bar/metrics-filter-bar';
import { MetricsLoadingSpinnerComponent } from '../../components/loading-spinner/loading-spinner';
import { MissingDataComponent } from '../../components/missing-data/missing-data';
import { MetricChartViewComponent } from '../../components/views/metric-chart-view';
import { MetricsFilterField, MetricsFilters } from '../../interfaces/metrics.interface';
import {
  ALL_FILTER_FIELDS,
  FILTER_FIELD_LABELS,
  METRIC_CHARTS,
  MetricChartDefinition,
  MetricChartKey,
  SINGLE_CHART_FILTER_FIELDS,
  chartLoadGroup,
} from '../../metric-charts.config';
import { MetricsService } from '../../services/metrics.service';
import { MetricsFiltersStore } from '../../services/metrics-filters.store';

interface CardState {
  loading: boolean;
  /**
   * Los filtros cambiaron pero la tarjeta está fuera de pantalla: se recarga
   * cuando el usuario llega a ella. No cuenta como "cargando", para no
   * bloquear el botón Aplicar del filtro.
   */
  pending: boolean;
  data: any | null;
  error: string | null;
}

/**
 * Tablero de Métricas: un filtro general arriba que aplica a todos los
 * gráficos (cada tarjeta indica qué filtros le afectan) y una tarjeta por
 * gráfico; clic en el título o en el gráfico abre su detalle.
 *
 * Cada tarjeta pide sus datos cuando entra en pantalla (o está por entrar),
 * no todas al abrir: así el tablero no satura las conexiones de la base de
 * datos y no frena a los demás módulos. Se carga por grupos
 * (CHART_LOAD_GROUPS) para que los gráficos que comparten consulta la pidan
 * a la vez.
 */
@Component({
  selector: 'app-metrics-dashboard',
  standalone: true,
  imports: [MetricsFilterBarComponent, MissingDataComponent, MetricChartViewComponent, MetricsLoadingSpinnerComponent],
  templateUrl: './metrics-dashboard.html',
})
export class MetricsDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private _service = inject(MetricsService);
  private _store = inject(MetricsFiltersStore);
  private _toast = inject(ToastService);
  private _router = inject(Router);

  readonly charts = METRIC_CHARTS;
  readonly options = this._store.options;
  readonly filters = this._store.filters;

  states = signal<Partial<Record<MetricChartKey, CardState>>>({});
  loadingOptions = signal(false);

  @ViewChildren('card') private cards!: QueryList<ElementRef<HTMLElement>>;
  private observer?: IntersectionObserver;
  /** Tarjetas en pantalla (o a menos del margen del observer). */
  private visibleKeys = new Set<MetricChartKey>();
  /** Grupos ya pedidos con los filtros vigentes; se vacía al aplicar filtros. */
  private loadedGroups = new Set<string>();

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

  /**
   * Gráfico 10 sin "Ver" escogido en el filtro general (aplicado): no se
   * muestra ni se puede abrir su detalle.
   */
  isBlocked(chart: MetricChartDefinition): boolean {
    return chart.key === 'desactivaciones' && !this.filters()?.inactivations?.view;
  }

  openDetail(chart: MetricChartDefinition): void {
    if (this.isBlocked(chart)) {
      this._toast.showWarning('Escoge en el filtro general (Gráfico 10 · Ver) qué quieres ver y presiona "Aplicar filtros".');
      return;
    }
    this._router.navigate(['/metricas', chart.key]);
  }

  state(key: MetricChartKey): CardState | undefined {
    return this.states()[key];
  }

  appliedFilters(chart: MetricChartDefinition): string {
    return chart.ownFilters ?? chart.filters.map((f) => FILTER_FIELD_LABELS[f]).join(' · ');
  }

  ignoredFilters(chart: MetricChartDefinition): string {
    return ALL_FILTER_FIELDS.filter((f: MetricsFilterField) => !chart.filters.includes(f) && !SINGLE_CHART_FILTER_FIELDS.includes(f))
      .map((f) => FILTER_FIELD_LABELS[f])
      .join(' · ');
  }

  ngAfterViewInit(): void {
    // Sin IntersectionObserver (navegador muy viejo) se cargan todos, como antes.
    if (typeof IntersectionObserver === 'undefined') {
      this.charts.forEach((chart) => this.visibleKeys.add(chart.key));
      this.loadAll();
      return;
    }
    // Se adelanta un margen para que la tarjeta ya venga cargando cuando el
    // usuario llega a ella.
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset['chartKey'] as MetricChartKey;
          if (entry.isIntersecting) {
            this.visibleKeys.add(key);
            this.loadGroupOf(key);
          } else {
            this.visibleKeys.delete(key);
          }
        }
      },
      { rootMargin: '300px 0px' },
    );
    this.cards.forEach((card) => this.observer!.observe(card.nativeElement));
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  /**
   * Con filtros nuevos: los gráficos en pantalla se recargan ya; los demás
   * quedan pendientes (con su resultado anterior atenuado) hasta que el
   * usuario baje hasta ellos.
   */
  private loadAll(): void {
    if (!this.filters()) return;
    this.loadedGroups.clear();
    for (const chart of this.charts) {
      if (this.states()[chart.key]) this.patch(chart.key, { pending: true });
    }
    for (const key of [...this.visibleKeys]) this.loadGroupOf(key);
  }

  /** Carga el grupo de `key` (ver CHART_LOAD_GROUPS) si no se cargó ya con los filtros vigentes. */
  private loadGroupOf(key: MetricChartKey): void {
    const filters = this.filters();
    const group = chartLoadGroup(key);
    const groupId = group.join('|');
    if (!filters || this.loadedGroups.has(groupId)) return;
    this.loadedGroups.add(groupId);

    for (const chartKey of group) {
      // Se conserva el resultado anterior mientras carga (sin parpadeo).
      this.patch(chartKey, { loading: true, pending: false, error: null });
      this._service.getChart(chartKey, filters).subscribe({
        next: (data) => this.patch(chartKey, { loading: false, data, error: null }),
        error: (err) => this.patch(chartKey, { loading: false, error: err?.message ?? 'No fue posible cargar el gráfico' }),
      });
    }
  }

  private patch(key: MetricChartKey, change: Partial<CardState>): void {
    this.states.update((states) => ({
      ...states,
      [key]: { loading: false, pending: false, data: null, error: null, ...states[key], ...change },
    }));
  }
}
