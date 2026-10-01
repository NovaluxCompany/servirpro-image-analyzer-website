import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetricsFilterField, MetricsFilterOptions, MetricsFilters } from '../../interfaces/metrics.interface';
import { ALL_FILTER_FIELDS } from '../../metric-charts.config';
import { cloneFilters, colombiaToday } from '../../services/metrics-filters.store';
import { MetricsMultiSelectComponent, MultiSelectOption } from '../multi-select/multi-select';

/**
 * Barra de filtros de Métricas. La usan el tablero (filtro general) y cada
 * detalle (su copia local): edita un borrador y solo emite al presionar
 * "Aplicar", así cambiar un campo no dispara una consulta por tecla.
 */
@Component({
  selector: 'app-metrics-filter-bar',
  standalone: true,
  imports: [FormsModule, MetricsMultiSelectComponent],
  templateUrl: './metrics-filter-bar.html',
})
export class MetricsFilterBarComponent {
  filters = input.required<MetricsFilters>();
  options = input.required<MetricsFilterOptions>();
  /** Campos a mostrar; en el detalle, solo los que afectan a ese gráfico. */
  fields = input<MetricsFilterField[]>(ALL_FILTER_FIELDS);
  isLoading = input(false);

  applied = output<MetricsFilters>();

  draft = linkedSignal(() => cloneFilters(this.filters()));

  fidelizadorOptions = computed<MultiSelectOption[]>(() => [
    ...this.options().fidelizadores.map((f) => ({ value: f.id, label: f.name })),
    { value: 0, label: 'Sin fidelizador' },
  ]);
  originOptions = computed<MultiSelectOption[]>(() => [
    ...this.options().origins.map((o) => ({ value: o.id, label: o.name })),
    { value: 0, label: 'Sin origen' },
  ]);
  branchOptions = computed<MultiSelectOption[]>(() => [
    ...this.options().branches.map((b) => ({ value: b.id, label: b.name })),
    { value: 0, label: 'Sin sede' },
  ]);

  adTotal = computed(() => Number(this.draft().adMeta || 0) + Number(this.draft().adWeb || 0));

  shows(field: MetricsFilterField): boolean {
    return this.fields().includes(field);
  }

  showsAnyCost(): boolean {
    return this.shows('advertising') || this.shows('affiliationCost') || this.shows('workerCost');
  }

  update<K extends keyof MetricsFilters>(key: K, value: MetricsFilters[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  updateNumber(key: 'adMeta' | 'adWeb' | 'affiliationCost' | 'workerCost', value: unknown): void {
    const n = Number(value);
    this.update(key, Number.isFinite(n) && n >= 0 ? n : 0);
  }

  setPreset(preset: 'current' | 'previous' | 'year'): void {
    const today = colombiaToday();
    const [year, month] = today.split('-').map(Number);
    if (preset === 'current') {
      this.draft.update((d) => ({ ...d, from: `${today.slice(0, 7)}-01`, to: today }));
    } else if (preset === 'previous') {
      const prevYear = month === 1 ? year - 1 : year;
      const prevMonth = month === 1 ? 12 : month - 1;
      const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      const mm = String(prevMonth).padStart(2, '0');
      this.draft.update((d) => ({ ...d, from: `${prevYear}-${mm}-01`, to: `${prevYear}-${mm}-${lastDay}` }));
    } else {
      this.draft.update((d) => ({ ...d, from: `${year}-01-01`, to: today }));
    }
  }

  canApply(): boolean {
    const d = this.draft();
    return !!d.from && !!d.to && d.from <= d.to;
  }

  apply(): void {
    if (this.canApply()) this.applied.emit(cloneFilters(this.draft()));
  }

  reset(): void {
    this.draft.set(cloneFilters(this.filters()));
  }
}
