import { MetricsFilterField } from './interfaces/metrics.interface';

export type MetricChartKey =
  | 'afiliaciones-nuevas'
  | 'resumen-fidelizadores'
  | 'nuevos-vs-reingresos'
  | 'publicidad'
  | 'retencion'
  | 'cohortes'
  | 'linea-de-vida';

export interface MetricChartDefinition {
  key: MetricChartKey;
  number: string;
  title: string;
  description: string;
  /** Campos del filtro general que afectan a este gráfico (los demás se ignoran). */
  filters: MetricsFilterField[];
}

export const ALL_FILTER_FIELDS: MetricsFilterField[] = [
  'dates',
  'fidelizadores',
  'origins',
  'branches',
  'advertising',
  'affiliationCost',
  'workerCost',
];

export const FILTER_FIELD_LABELS: Record<MetricsFilterField, string> = {
  dates: 'Fechas',
  fidelizadores: 'Fidelizadores',
  origins: 'Orígenes',
  branches: 'Sedes',
  advertising: 'Publicidad',
  affiliationCost: 'Costo afiliación',
  workerCost: 'Costo trabajador',
};

/**
 * Gráficos del documento GRAFICOS.docx, en su orden. El 5 (Mensualidad /
 * Reingreso / Retiro por fidelizador) quedó pendiente a pedido del cliente y
 * se muestra como tarjeta informativa en el tablero, sin detalle.
 */
export const METRIC_CHARTS: MetricChartDefinition[] = [
  {
    key: 'afiliaciones-nuevas',
    number: '1',
    title: 'Afiliaciones nuevas por fidelizador y origen',
    description: 'Afiliados con transacción nueva, publicidad, costo de afiliación, ventas, ganancia neta y costo por cliente.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'advertising', 'affiliationCost'],
  },
  {
    key: 'resumen-fidelizadores',
    number: '2',
    title: 'Resumen por fidelizador',
    description: 'Ventas, costo de afiliaciones, publicidad y costo del trabajador para la ganancia neta. Oficinas en fila aparte.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'advertising', 'affiliationCost', 'workerCost'],
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
    title: 'Gastos de publicidad y ganancias por oficina',
    description: 'Publicidad digitada de Meta y Web, y ganancia de las afiliaciones hechas en oficina por sede.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'advertising'],
  },
  {
    key: 'retencion',
    number: '6',
    title: 'Retención: % de retiro por fidelizador',
    description: 'Usuarios totales = mensualidad + nuevos + retiros. Verde < 20 %, amarillo 20–30 %, rojo > 30 %.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'cohortes',
    number: '7',
    title: 'Cohortes: cuántos afiliados quedan mes a mes',
    description: 'Afiliados que entraron como nuevos en un mes y cuántos siguen pagando en los meses siguientes (desde junio).',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
  {
    key: 'linea-de-vida',
    number: '8',
    title: 'Línea de vida, planes y profesiones',
    description: 'Ingresos por mes (creados, reingresos, mensualidades), plan que más ingreso genera y profesión con más afiliados.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches'],
  },
];

export function findMetricChart(key: string | null | undefined): MetricChartDefinition | undefined {
  return METRIC_CHARTS.find((chart) => chart.key === key);
}
