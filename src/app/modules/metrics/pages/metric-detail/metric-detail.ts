import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';
import { MetricsFilterBarComponent } from '../../components/filter-bar/metrics-filter-bar';
import { MissingDataComponent } from '../../components/missing-data/missing-data';
import { MetricChartViewComponent } from '../../components/views/metric-chart-view';
import { MetricsFilterOptions, MetricsFilters, MetricsSpecificFilters } from '../../interfaces/metrics.interface';
import { MetricChartDefinition, findMetricChart } from '../../metric-charts.config';
import { MetricsService } from '../../services/metrics.service';
import { MetricsFiltersStore, colombiaToday } from '../../services/metrics-filters.store';
import {
  filtersToQueryParams,
  hasFilterQueryParams,
  queryParamsToFilters,
  queryParamsToSpecific,
} from '../../utils/metrics-query-params';

/**
 * Detalle de un gráfico (/metricas/<grafico>). Arranca con una COPIA del
 * filtro general y agrega los filtros propios del gráfico; nada de lo que se
 * cambie acá escribe en MetricsFiltersStore, así que no afecta al tablero ni
 * a los demás gráficos. Los filtros aplicados quedan en la URL.
 */
@Component({
  selector: 'app-metric-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, MetricsFilterBarComponent, MissingDataComponent, MetricChartViewComponent],
  templateUrl: './metric-detail.html',
})
export class MetricDetailComponent implements OnInit {
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);
  private _service = inject(MetricsService);
  private _store = inject(MetricsFiltersStore);
  private _toast = inject(ToastService);
  private _permissions = inject(PermissionService);

  chart = signal<MetricChartDefinition | null>(null);
  options = signal<MetricsFilterOptions | null>(null);
  filters = signal<MetricsFilters | null>(null);

  /** Filtros propios: borrador (lo que se edita) y aplicado (lo consultado). */
  specificDraft = signal<MetricsSpecificFilters>({});
  specificApplied = signal<MetricsSpecificFilters>({});

  data = signal<any | null>(null);
  isLoading = signal(false);
  error = signal<string | null>(null);
  isExporting = signal(false);

  originCatalogIds = computed(() => (this.options()?.origins ?? []).map((o) => o.id));
  canExport = computed(() => this.chart()?.key === 'afiliaciones-nuevas' && this._permissions.can('export', '/metricas'));
  currentMonth = colombiaToday().slice(0, 7);

  ngOnInit(): void {
    const chart = findMetricChart(this._route.snapshot.paramMap.get('chart'));
    if (!chart) {
      this._toast.showError('El gráfico solicitado no existe.');
      this._router.navigate(['/metricas']);
      return;
    }
    this.chart.set(chart);

    const cached = this._store.options();
    if (cached) {
      this.init(cached);
      return;
    }
    this._service.getFilterOptions().subscribe({
      next: (options) => {
        this._store.setOptions(options);
        this.init(options);
      },
      error: (err) => this._toast.showError(err?.message ?? 'No fue posible cargar los filtros de métricas'),
    });
  }

  private init(options: MetricsFilterOptions): void {
    this.options.set(options);
    const params = this._route.snapshot.queryParams;
    const base = this._store.snapshot() ?? this._store.defaults(options);

    this.filters.set(hasFilterQueryParams(params) ? queryParamsToFilters(params, base) : base);
    const specific = hasFilterQueryParams(params) ? queryParamsToSpecific(params) : this.defaultSpecific(base, options);
    this.specificDraft.set({ ...specific });
    this.specificApplied.set({ ...specific });
    this.load();
  }

  private defaultSpecific(filters: MetricsFilters, options: MetricsFilterOptions): MetricsSpecificFilters {
    const from = filters.from.slice(0, 7);
    return {
      cohortFrom: from < options.minCohortMonth ? options.minCohortMonth : from,
      cohortTo: filters.to.slice(0, 7),
      includeNew: true,
      includeReentries: true,
      document: '',
    };
  }

  updateSpecific<K extends keyof MetricsSpecificFilters>(key: K, value: MetricsSpecificFilters[K]): void {
    this.specificDraft.update((s) => ({ ...s, [key]: value }));
  }

  onApply(filters: MetricsFilters): void {
    this.filters.set(filters);
    this.specificApplied.set({ ...this.specificDraft() });
    this._router.navigate([], {
      relativeTo: this._route,
      queryParams: filtersToQueryParams(filters, this.specificApplied()),
      replaceUrl: true,
    });
    this.load();
  }

  private load(): void {
    const chart = this.chart();
    const filters = this.filters();
    if (!chart || !filters) return;

    this.isLoading.set(true);
    this.error.set(null);
    this._service.getChart(chart.key, filters, this.specificApplied()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'No fue posible cargar el gráfico');
        this.isLoading.set(false);
      },
    });
  }

  downloadExcel(): void {
    const filters = this.filters();
    if (!filters) return;
    this.isExporting.set(true);
    this._toast.showInfo('Descarga en proceso...');
    this._service.exportNewAffiliations(filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `metricas-afiliaciones-nuevas_${filters.from}_${filters.to}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.isExporting.set(false);
        this._toast.showSuccess('Excel descargado exitosamente');
      },
      error: (err) => {
        this.isExporting.set(false);
        this._toast.showError(err?.message ?? 'No fue posible descargar el Excel');
      },
    });
  }
}
