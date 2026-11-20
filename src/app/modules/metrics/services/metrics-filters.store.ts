import { Injectable, signal } from '@angular/core';
import { InactivationsFilters, MetricsFilterOptions, MetricsFilters } from '../interfaces/metrics.interface';

/**
 * Filtro GENERAL del tablero de Métricas. Vive en un servicio raíz para
 * sobrevivir a la navegación tablero -> detalle -> tablero durante la
 * sesión (los costos son digitables y no se guardan en BD; la publicidad sí
 * se guarda, por mes, y el backend la lee de ahí).
 *
 * El detalle NO escribe acá: arranca con una copia (ver MetricDetailPage),
 * así sus filtros propios nunca afectan a los demás gráficos.
 */
@Injectable({ providedIn: 'root' })
export class MetricsFiltersStore {
  readonly filters = signal<MetricsFilters | null>(null);
  readonly options = signal<MetricsFilterOptions | null>(null);

  setOptions(options: MetricsFilterOptions): void {
    this.options.set(options);
    if (!this.filters()) this.filters.set(this.defaults(options));
  }

  defaults(options: MetricsFilterOptions): MetricsFilters {
    const today = colombiaToday();
    return {
      from: `${today.slice(0, 7)}-01`,
      to: today,
      fidelizadorIds: [],
      advisorIds: [],
      originIds: [],
      branchIds: [],
      affiliateType: '',
      affiliationCost: options.defaults.affiliationCost,
      workerCost: options.defaults.workerCost,
      inactivations: emptyInactivations(),
    };
  }

  snapshot(): MetricsFilters | null {
    const current = this.filters();
    return current ? cloneFilters(current) : null;
  }
}

export function cloneFilters(filters: MetricsFilters): MetricsFilters {
  return {
    ...filters,
    fidelizadorIds: [...filters.fidelizadorIds],
    advisorIds: [...(filters.advisorIds ?? [])],
    originIds: [...filters.originIds],
    branchIds: [...filters.branchIds],
    // Un filtro guardado antes de existir el campo queda en "todos".
    affiliateType: filters.affiliateType ?? '',
    inactivations: cloneInactivations(filters.inactivations ?? emptyInactivations()),
  };
}

/** Gráfico 10 sin nada escogido: el gráfico no se muestra. */
export function emptyInactivations(view: InactivationsFilters['view'] = ''): InactivationsFilters {
  return { view, reasonIds: [], userIds: [], statuses: [], subReasonIds: [], companyIds: [] };
}

function cloneInactivations(f: InactivationsFilters): InactivationsFilters {
  return {
    ...f,
    reasonIds: [...f.reasonIds],
    userIds: [...f.userIds],
    statuses: [...f.statuses],
    subReasonIds: [...f.subReasonIds],
    companyIds: [...f.companyIds],
  };
}

export function colombiaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
