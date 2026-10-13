import { Injectable, signal } from '@angular/core';
import { MetricsFilterOptions, MetricsFilters } from '../interfaces/metrics.interface';

/**
 * Filtro GENERAL del tablero de Métricas. Vive en un servicio raíz para
 * sobrevivir a la navegación tablero -> detalle -> tablero durante la
 * sesión (la publicidad es digitable y no se guarda en BD).
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
      originIds: [],
      branchIds: [],
      adMeta: 0,
      adWeb: 0,
      affiliationCost: options.defaults.affiliationCost,
      workerCost: options.defaults.workerCost,
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
    originIds: [...filters.originIds],
    branchIds: [...filters.branchIds],
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
