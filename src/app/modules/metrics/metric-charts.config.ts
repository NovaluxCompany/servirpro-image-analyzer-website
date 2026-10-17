import { MetricsFilterField } from './interfaces/metrics.interface';

export type MetricChartKey =
  | 'afiliaciones-nuevas'
  | 'resumen-fidelizadores'
  | 'nuevos-vs-reingresos'
  | 'publicidad'
  | 'ganancias-oficinas'
  | 'mensualidad-reingreso-retiro'
  | 'retencion'
  | 'cohortes'
  | 'linea-de-vida'
  | 'planes'
  | 'profesiones'
  | 'recaudo-fidelizadores';

export interface MetricChartDefinition {
  key: MetricChartKey;
  number: string;
  title: string;
  description: string;
  /** Campos del filtro general que afectan a este gráfico (los demás se ignoran). */
  filters: MetricsFilterField[];
  /**
   * Las fechas pueden quedar vacías (= toda la historia) y "Deshacer" las
   * limpia. Solo la línea de vida, que es por afiliado.
   */
  optionalDates?: boolean;
  /** Filtros propios del detalle, para la tarjeta del tablero (p. ej. el 9 no usa el filtro general). */
  ownFilters?: string;
}

export const ALL_FILTER_FIELDS: MetricsFilterField[] = [
  'dates',
  'fidelizadores',
  'advisors',
  'origins',
  'branches',
  'affiliationCost',
  'workerCost',
];

export const FILTER_FIELD_LABELS: Record<MetricsFilterField, string> = {
  dates: 'Fechas',
  fidelizadores: 'Fidelizadores',
  advisors: 'Asesores',
  origins: 'Orígenes',
  branches: 'Sedes',
  affiliationCost: 'Costo afiliación',
  workerCost: 'Costo trabajador',
};

/**
 * Gráficos del documento GRAFICOS.docx, en su orden. La publicidad (Meta y
 * Web) ya no es un filtro: se registra por mes con el botón "Publicidad por
 * mes" del detalle del gráfico 1 y la usan los gráficos 1, 2 y 4.
 */
export const METRIC_CHARTS: MetricChartDefinition[] = [
  {
    key: 'afiliaciones-nuevas',
    number: '1',
    title: 'Afiliaciones nuevas por asesor y origen',
    description: 'Por asesor (Hanna, Sebas, Tatiana...) con la fila total del Bot Meta / Bot Web: afiliados, publicidad del mes, costo de afiliación, ventas, ganancia neta y costo por cliente. Filtra Nuevos, Mensualidades o Retiros.',
    filters: ['dates', 'advisors', 'origins', 'branches', 'affiliationCost'],
  },
  {
    key: 'resumen-fidelizadores',
    number: '2',
    title: 'Resumen por fidelizador',
    description: 'Ventas, costo de afiliaciones, publicidad y costo del trabajador para la ganancia neta. Oficinas en fila aparte.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliationCost', 'workerCost'],
  },
  {
    key: 'nuevos-vs-reingresos',
    number: '3',
    title: 'Nuevos vs reingresos',
    description: 'Ventas de afiliaciones nuevas frente a las de afiliados con origen Reingreso.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'publicidad',
    number: '4',
    title: 'Gastos de publicidad',
    description: 'Por canal (Meta y Web): afiliados nuevos, recaudo, inversión en publicidad, costo de afiliaciones y costo por afiliado.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliationCost'],
  },
  {
    key: 'ganancias-oficinas',
    number: '4B',
    title: 'Ganancias por oficina',
    description: 'Ganancia de las afiliaciones nuevas hechas en oficina, agrupada por sede.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'mensualidad-reingreso-retiro',
    number: '5',
    title: 'Mensualidad / Reingreso / Retiro por fidelizador',
    description: 'Usuarios, lo vendido, planilla y Vlr. administración (regla de Siigo), mora digitada al facturar, % de recaudo y % de retiro por fidelizador y de la empresa.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'retencion',
    number: '6',
    title: 'Retención: % de retiro por fidelizador',
    description: 'Usuarios totales = todos los afiliados del fidelizador en el tiempo (activos o no). Verde < 20 %, amarillo 20–30 %, rojo > 30 %.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'cohortes',
    number: '7',
    title: 'Cohortes: cuántos afiliados quedan mes a mes',
    description: 'Afiliados que entraron en un mes y cuántos siguen afiliados al cierre de cada mes siguiente, incluidos los que se retiraron y volvieron (desde junio).',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'linea-de-vida',
    number: '8',
    title: 'Línea de vida del afiliado',
    description: 'Todo lo que le ha pasado a un afiliado: creación, reingresos, cambios, inactivaciones, desafiliación e incapacidades, con su resumen de pagos.',
    filters: ['dates'],
    optionalDates: true,
  },
  {
    key: 'planes',
    number: '8B',
    title: 'Planes con mayor número de ventas',
    description: 'Planes ordenados por cantidad de ventas aprobadas en el rango, con su ingreso.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'profesiones',
    number: '8C',
    title: 'Profesiones con más afiliados',
    description: 'Profesiones de los afiliados con transacciones aprobadas en el rango.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'recaudo-fidelizadores',
    number: '9',
    title: 'Recaudo de mensualidades por usuario',
    description: 'Por el usuario que realizó los pagos: mensualidades del mes, cuántas ya se recaudaron, cuáles faltan, % de recaudo y si llegó a la meta.',
    filters: [],
    ownFilters: 'Mes · Realizado por (en el detalle)',
  },
];

export function findMetricChart(key: string | null | undefined): MetricChartDefinition | undefined {
  return METRIC_CHARTS.find((chart) => chart.key === key);
}
