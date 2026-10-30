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
  | 'recaudo-fidelizadores'
  | 'desactivaciones';

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
  'affiliateType',
  'affiliationCost',
  'workerCost',
  'inactivations',
];

/**
 * Campos del filtro general que son de UN solo gráfico: en las demás
 * tarjetas no se listan en "No aplica", para no repetirlo en todas.
 */
export const SINGLE_CHART_FILTER_FIELDS: MetricsFilterField[] = ['inactivations'];

export const FILTER_FIELD_LABELS: Record<MetricsFilterField, string> = {
  dates: 'Fechas',
  fidelizadores: 'Fidelizadores',
  advisors: 'Asesores',
  origins: 'Orígenes',
  branches: 'Sedes',
  affiliateType: 'Tipo de afiliado',
  affiliationCost: 'Costo afiliación',
  workerCost: 'Costo trabajador',
  inactivations: 'Ver (sus filtros, en el detalle)',
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
    description: 'Por asesor (Hanna, Sebas, Tatiana...) con la fila total del Bot Meta / Bot Web: afiliados, publicidad del mes, costo de afiliación, ventas, ganancia neta y costo por cliente. Nuevos incluye los reingresos (personas que pagaban, dejaron de pagar y se volvieron a afiliar), mostrados aparte. Filtra Nuevos, Mensualidades o Retiros.',
    filters: ['dates', 'advisors', 'origins', 'branches', 'affiliateType', 'affiliationCost'],
  },
  {
    key: 'resumen-fidelizadores',
    number: '2',
    title: 'Resumen por fidelizador',
    description: 'Ventas, costo de afiliaciones, publicidad y costo del trabajador para la ganancia neta. Oficinas en fila aparte.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType', 'affiliationCost', 'workerCost'],
  },
  {
    key: 'nuevos-vs-reingresos',
    number: '3',
    title: 'Nuevos vs reingresos',
    description: 'Ventas de afiliaciones nuevas frente a las de afiliados con origen Reingreso.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType'],
  },
  {
    key: 'publicidad',
    number: '4',
    title: 'Gastos de publicidad',
    description: 'Por canal (Meta y Web): afiliados nuevos, recaudo, inversión en publicidad, costo de afiliaciones y costo por afiliado.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType', 'affiliationCost'],
  },
  {
    key: 'ganancias-oficinas',
    number: '4B',
    title: 'Ganancias por oficina',
    description: 'Ganancia de las afiliaciones nuevas hechas en oficina, agrupada por sede.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType'],
  },
  {
    key: 'mensualidad-reingreso-retiro',
    number: '5',
    title: 'Mensualidad / No ordinario / Retiro por fidelizador',
    description: 'Mensualidad = Ordinarios, No ordinario = menores de la edad límite, sin AFP ni documento extranjero (regla de Actualizar empresa); sin las afiliaciones nuevas ni los reingresos, que van en el gráfico 1. Usuarios, lo vendido, planilla y Vlr. administración (regla de Siigo), mora digitada al facturar, % de recaudo, lo que falta por cobrar y % de retiro por fidelizador y de la empresa.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType'],
  },
  {
    key: 'retencion',
    number: '6',
    title: 'Retención: % de retiro por fidelizador',
    description: 'Usuarios totales = todos los afiliados del fidelizador en el tiempo (activos o no). Verde < 20 %, amarillo 20–30 %, rojo > 30 %.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType'],
  },
  {
    key: 'cohortes',
    number: '7',
    title: 'Cohortes: cuántos afiliados quedan mes a mes',
    description: 'Afiliados que entraron en un mes y cuántos siguen afiliados al cierre de cada mes siguiente, incluidos los que se retiraron y volvieron (desde junio).',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType'],
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
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType'],
  },
  {
    key: 'profesiones',
    number: '8C',
    title: 'Profesiones con más afiliados',
    description: 'Profesiones de los afiliados con transacciones aprobadas en el rango.',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType'],
  },
  {
    key: 'recaudo-fidelizadores',
    number: '9',
    title: 'Recaudo de mensualidades por usuario',
    description: 'Por el usuario que realizó los pagos: mensualidades del mes, cuántas ya se recaudaron, cuáles faltan, % de recaudo y si llegó a la meta.',
    filters: [],
    ownFilters: 'Mes · Realizado por (en el detalle)',
  },
  {
    key: 'desactivaciones',
    number: '10',
    title: 'Inactivaciones y solicitudes de desafiliación',
    description: 'Métrica doble: escoge en el filtro general (Gráfico 10 · Ver) qué mostrar; sin escoger no se puede abrir. Inactivaciones: afiliados desactivados (Error en digitación, No se logró tramitar, etc.) por motivo y fidelizador; no cuentan en los gráficos 1 al 9 y, si se reactivan, vuelven a contar allá. Solicitudes de desafiliación: por motivo, submotivo y estado (pendiente, confirmada o rechazada).',
    filters: ['dates', 'fidelizadores', 'origins', 'branches', 'affiliateType', 'inactivations'],
  },
];

/**
 * Gráficos que el tablero carga juntos. Cada grupo corre en el backend la
 * misma consulta pesada, que se ejecuta una sola vez solo si las peticiones
 * llegan al mismo tiempo (sharedQuery en el API): 2, 3, 4 y 4B el mismo
 * agregado; 5 y 6 la misma retención. Por eso, cuando una tarjeta del grupo
 * entra en pantalla, se cargan todas las del grupo. Los gráficos que no
 * aparecen aquí se cargan solos.
 */
export const CHART_LOAD_GROUPS: MetricChartKey[][] = [
  ['resumen-fidelizadores', 'nuevos-vs-reingresos', 'publicidad', 'ganancias-oficinas'],
  ['mensualidad-reingreso-retiro', 'retencion'],
];

/** Grupo de carga de un gráfico: el suyo de CHART_LOAD_GROUPS, o él solo. */
export function chartLoadGroup(key: MetricChartKey): MetricChartKey[] {
  return CHART_LOAD_GROUPS.find((group) => group.includes(key)) ?? [key];
}

export function findMetricChart(key: string | null | undefined): MetricChartDefinition | undefined {
  return METRIC_CHARTS.find((chart) => chart.key === key);
}
