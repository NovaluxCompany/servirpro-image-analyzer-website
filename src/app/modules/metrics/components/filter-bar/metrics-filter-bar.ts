import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AffiliateTypeFilter,
  DisaffiliationRequestStatus,
  InactivationsFilters,
  InactivationsOption,
  InactivationsView,
  MetricsFilterField,
  MetricsFilterOptions,
  MetricsFilters,
} from '../../interfaces/metrics.interface';
import { ALL_FILTER_FIELDS } from '../../metric-charts.config';
import { cloneFilters, colombiaToday, emptyInactivations } from '../../services/metrics-filters.store';
import { MetricsMultiSelectComponent, MultiSelectOption } from '../multi-select/multi-select';

function toMultiSelect(options: InactivationsOption[] | undefined): MultiSelectOption[] {
  return (options ?? []).map((o) => ({ value: o.id, label: o.name }));
}

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
  /**
   * Fechas opcionales (línea de vida): vacías = toda la historia, y
   * "Deshacer filtros" también limpia Desde y Hasta.
   */
  optionalDates = input(false);
  /**
   * Gráfico 10: el filtro general solo trae "Ver"; los filtros de la vista
   * escogida (motivo, tipo, estado...) solo se muestran en su detalle.
   */
  inactivationsDetail = input(false);

  applied = output<MetricsFilters>();
  /** Se emite al deshacer, para que el detalle limpie también sus filtros propios. */
  resetted = output<void>();

  draft = linkedSignal(() => cloneFilters(this.filters()));

  fidelizadorOptions = computed<MultiSelectOption[]>(() => [
    ...this.options().fidelizadores.map((f) => ({ value: f.id, label: f.name })),
    { value: 0, label: 'Sin fidelizador' },
  ]);
  // Solo los asesores del bot del gráfico 1 (Hanna, Sebas, Tatiana): el backend ya los filtra.
  advisorOptions = computed<MultiSelectOption[]>(() =>
    (this.options().advisors ?? []).map((a) => ({ value: a.id, label: a.name })),
  );
  originOptions = computed<MultiSelectOption[]>(() => [
    ...this.options().origins.map((o) => ({ value: o.id, label: o.name })),
    { value: 0, label: 'Sin origen' },
  ]);
  branchOptions = computed<MultiSelectOption[]>(() => [
    ...this.options().branches.map((b) => ({ value: b.id, label: b.name })),
    { value: 0, label: 'Sin sede' },
  ]);

  readonly affiliateTypeOptions: Array<{ value: AffiliateTypeFilter; label: string }> = [
    { value: '', label: 'Todos' },
    { value: 'DEPENDIENTE', label: 'Dependiente' },
    { value: 'INDEPENDIENTE', label: 'Independiente' },
  ];

  // ── Gráfico 10: "Ver" y los filtros de la vista escogida ─────────────
  readonly inactivationsViewOptions: Array<{ value: InactivationsView; label: string }> = [
    { value: 'DEACTIVATIONS', label: 'Inactivaciones' },
    { value: 'DISAFFILIATIONS', label: 'Solicitudes de desafiliación' },
  ];

  readonly requestStatusOptions: Array<{ value: DisaffiliationRequestStatus; label: string }> = [
    { value: 'PENDING', label: 'Pendiente' },
    { value: 'CONFIRMED', label: 'Confirmada' },
    { value: 'REJECTED', label: 'Rechazada' },
  ];

  private inactivationsOptions = computed(() => this.options().inactivations);
  deactivationReasonOptions = computed(() => toMultiSelect(this.inactivationsOptions()?.deactivationReasons));
  deactivationUserOptions = computed(() => toMultiSelect(this.inactivationsOptions()?.deactivationUsers));
  disaffiliationReasonOptions = computed(() => toMultiSelect(this.inactivationsOptions()?.disaffiliationReasons));
  companyOptions = computed(() => toMultiSelect(this.inactivationsOptions()?.companies));
  requesterOptions = computed(() => toMultiSelect(this.inactivationsOptions()?.requesters));

  /**
   * Submotivos de los motivos escogidos (todos si no hay motivo escogido).
   * Con más de un motivo en juego se antepone el motivo, porque hay
   * submotivos con el mismo nombre en motivos distintos.
   */
  subReasonOptions = computed<MultiSelectOption[]>(() => {
    const options = this.inactivationsOptions();
    if (!options) return [];
    const reasonIds = this.draft().inactivations.reasonIds;
    const reasonName = new Map(options.disaffiliationReasons.map((r) => [r.id, r.name]));
    const prefix = reasonIds.length !== 1;
    return options.disaffiliationSubReasons
      .filter((s) => s.reasonId == null || reasonIds.length === 0 || reasonIds.includes(s.reasonId))
      .map((s) => ({
        value: s.id,
        label: prefix && s.reasonId != null ? `${reasonName.get(s.reasonId) ?? ''} · ${s.name}` : s.name,
      }));
  });

  updateInactivations<K extends keyof InactivationsFilters>(key: K, value: InactivationsFilters[K]): void {
    this.draft.update((d) => ({ ...d, inactivations: { ...d.inactivations, [key]: value } }));
  }

  /** Al cambiar qué se ve se limpian sus filtros: los motivos y usuarios de una vista no son los de la otra. */
  setInactivationsView(view: InactivationsView | ''): void {
    this.draft.update((d) => ({ ...d, inactivations: emptyInactivations(view) }));
  }

  /** Los submotivos escogidos que ya no son de los motivos escogidos se quitan. */
  setDisaffiliationReasons(reasonIds: number[]): void {
    this.updateInactivations('reasonIds', reasonIds);
    const allowed = new Set(this.subReasonOptions().map((o) => o.value));
    this.updateInactivations('subReasonIds', this.draft().inactivations.subReasonIds.filter((id) => allowed.has(id)));
  }

  toggleRequestStatus(status: DisaffiliationRequestStatus): void {
    const current = this.draft().inactivations.statuses;
    this.updateInactivations('statuses', current.includes(status) ? current.filter((s) => s !== status) : [...current, status]);
  }

  shows(field: MetricsFilterField): boolean {
    return this.fields().includes(field);
  }

  showsAnyCost(): boolean {
    return this.shows('affiliationCost') || this.shows('workerCost');
  }

  update<K extends keyof MetricsFilters>(key: K, value: MetricsFilters[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  updateNumber(key: 'affiliationCost' | 'workerCost', value: unknown): void {
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
    if (this.optionalDates() && (!d.from || !d.to)) return true;
    return !!d.from && !!d.to && d.from <= d.to;
  }

  apply(): void {
    if (this.canApply()) this.applied.emit(cloneFilters(this.draft()));
  }

  reset(): void {
    const restored = cloneFilters(this.filters());
    this.draft.set(this.optionalDates() ? { ...restored, from: '', to: '' } : restored);
    this.resetted.emit();
  }
}
