import { MetricsFilterField } from './interfaces/metrics.interface';

export type MetricChartKey =
  | 'afiliaciones-nuevas'
  | 'resumen-fidelizadores'
  | 'nuevos-vs-reingresos'
  | 'publicidad'
  | 'ganancias-oficinas'
  | 'retencion'
  | 'cohortes'
  | 'linea-de-vida'
  | 'planes'
  | 'profesiones';

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
    title: 'Gastos de publicidad',
    description: 'Publicidad digitada de Meta y Web y su participación en el total.',
    filters: ['advertising'],
  },
  {
    key: 'ganancias-oficinas',
    number: '4B',
    title: 'Ganancias por oficina',
    description: 'Ganancia de las afiliaciones nuevas hechas en oficina, agrupada por sede.',
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
];

export function findMetricChart(key: string | null | undefined): MetricChartDefinition | undefined {
  return METRIC_CHARTS.find((chart) => chart.key === key);
}
