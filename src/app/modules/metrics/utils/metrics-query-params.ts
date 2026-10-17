import { Params } from '@angular/router';
import { MetricsFilters, MetricsSpecificFilters } from '../interfaces/metrics.interface';

/**
 * Filtros del detalle en la URL: así el detalle de un gráfico con sus filtros
 * se puede recargar o compartir. Solo se usan en /metricas/<grafico>; el
 * tablero no escribe en la URL.
 */
export function filtersToQueryParams(filters: MetricsFilters, specific: MetricsSpecificFilters): Params {
  return {
    from: filters.from || null,
    to: filters.to || null,
    fid: filters.fidelizadorIds.join(',') || null,
    ases: filters.advisorIds?.join(',') || null,
    orig: filters.originIds.join(',') || null,
    sede: filters.branchIds.join(',') || null,
    costoAfil: filters.affiliationCost,
    costoTrab: filters.workerCost,
    cohorteDesde: specific.cohortFrom || null,
    cohorteHasta: specific.cohortTo || null,
    nuevos: specific.includeNew === false ? 'false' : null,
    reingresos: specific.includeReentries === false ? 'false' : null,
    doc: specific.document?.trim() || null,
    // Nuevos es el valor por defecto: solo se escribe Mensualidades o Retiros.
    cond: specific.condition && specific.condition !== 'NEW' ? specific.condition : null,
    mes: specific.collectionMonth || null,
    usuarios: specific.userIds?.join(',') || null,
  };
}

/** El detalle siempre escribe costoAfil; las fechas pueden faltar en la línea de vida (= toda la historia). */
export function hasFilterQueryParams(params: Params): boolean {
  return (!!params['from'] && !!params['to']) || params['costoAfil'] != null;
}

export function queryParamsToFilters(params: Params, base: MetricsFilters): MetricsFilters {
  const ids = (value: unknown): number[] =>
    typeof value === 'string' && value
      ? value.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0)
      : [];
  const num = (value: unknown, fallback: number): number => {
    const n = Number(value);
    return value != null && Number.isFinite(n) && n >= 0 ? n : fallback;
  };
  const date = (value: unknown, fallback: string): string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;

  return {
    from: date(params['from'], base.from),
    to: date(params['to'], base.to),
    fidelizadorIds: ids(params['fid']),
    advisorIds: ids(params['ases']),
    originIds: ids(params['orig']),
    branchIds: ids(params['sede']),
    affiliationCost: num(params['costoAfil'], base.affiliationCost),
    workerCost: num(params['costoTrab'], base.workerCost),
  };
}

export function queryParamsToSpecific(params: Params): MetricsSpecificFilters {
  const month = (value: unknown): string | undefined =>
    typeof value === 'string' && /^\d{4}-\d{2}$/.test(value) ? value : undefined;
  return {
    cohortFrom: month(params['cohorteDesde']),
    cohortTo: month(params['cohorteHasta']),
    includeNew: params['nuevos'] !== 'false',
    includeReentries: params['reingresos'] !== 'false',
    document: typeof params['doc'] === 'string' ? params['doc'] : '',
    condition: params['cond'] === 'MONTHLY' || params['cond'] === 'WITHDRAWAL' ? params['cond'] : 'NEW',
    collectionMonth: month(params['mes']),
    userIds:
      typeof params['usuarios'] === 'string' && params['usuarios']
        ? params['usuarios'].split(',').map(Number).filter((n: number) => Number.isInteger(n) && n >= 0)
        : [],
  };
}
