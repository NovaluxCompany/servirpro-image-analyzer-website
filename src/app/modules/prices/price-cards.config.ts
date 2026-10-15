import {
  AffiliateType,
  DiscountPriceRow,
  CardFilters,
  PlanPriceRow,
  PriceParameterRow,
  PricesFilters,
  PricesOverview,
  PricingRuleRow,
} from './interfaces/prices.interface';

/** Filtros generales (barra superior) que pueden aplicar a una tarjeta. */
export type GeneralFilterField = 'search' | 'affiliateType' | 'plan' | 'price';

export const GENERAL_FILTER_LABELS: Record<GeneralFilterField, string> = {
  search: 'Búsqueda',
  affiliateType: 'Tipo de afiliado',
  plan: 'Plan',
  price: 'Rango de precio',
};

export const ALL_GENERAL_FILTERS: GeneralFilterField[] = ['search', 'affiliateType', 'plan', 'price'];

/** Filtros propios que ofrece cada tarjeta dentro de ella. */
export type CardFilterField = 'search' | 'grouper' | 'category' | 'column' | 'range' | 'hideZero';

export interface PriceColumn<T> {
  label: string;
  value: (row: T) => string | number | null;
  money?: boolean;
  /** Columna que se compara contra el rango de precio (se resalta en la tabla). */
  priced?: boolean;
}

/** Datos comunes de cada fila para poder filtrarla sin conocer su tipo. */
interface RowFacets {
  text: string;
  affiliateType?: AffiliateType;
  planName?: string;
  grouper?: string | null;
  category?: string;
}

export interface PriceCardDefinition<T = any> {
  key: string;
  title: string;
  description: string;
  source: string;
  generalFilters: GeneralFilterField[];
  cardFilters: CardFilterField[];
  /** Qué se puede escribir en el buscador propio de la tarjeta. */
  searchPlaceholder: string;
  columns: PriceColumn<T>[];
  rows: (data: PricesOverview) => T[];
  facets: (row: T) => RowFacets;
}

export interface PriceCardView {
  rows: any[];
  total: number;
  /** Menor y mayor valor de las columnas de precio de las filas visibles. */
  min: number | null;
  max: number | null;
}

const AFFILIATE_TYPE_LABELS: Record<AffiliateType, string> = {
  DEPENDIENTE: 'Dependiente',
  INDEPENDIENTE: 'Independiente',
};

export const affiliateTypeLabel = (type: AffiliateType | null | undefined): string =>
  type ? AFFILIATE_TYPE_LABELS[type] ?? type : '';

const ruleFacets = (r: PricingRuleRow): RowFacets => ({
  text: `${r.grouperName} ${r.categoryName} ${r.planName}`,
  affiliateType: r.affiliateType,
  planName: r.planName,
  grouper: r.grouperName,
  category: r.categoryName,
});

/**
 * Planilla, administración, reserva y ganancia salen de la misma regla de
 * precio (agrupador + categoría + tipo + plan); cada concepto tiene su
 * tarjeta con el valor para afiliación nueva y para mensualidad.
 */
function ruleCard(
  key: string,
  title: string,
  description: string,
  newValue: (r: PricingRuleRow) => number,
  monthlyValue: (r: PricingRuleRow) => number,
): PriceCardDefinition<PricingRuleRow> {
  return {
    key,
    title,
    description,
    source: 'Reglas de precio',
    generalFilters: ['search', 'affiliateType', 'plan', 'price'],
    cardFilters: ['search', 'grouper', 'category', 'column', 'range', 'hideZero'],
    searchPlaceholder: 'Agrupador, categoría o plan',
    rows: (data) => data.pricingRules,
    facets: ruleFacets,
    columns: [
      { label: 'Agrupador', value: (r) => r.grouperName },
      { label: 'Categoría', value: (r) => r.categoryName },
      { label: 'Tipo', value: (r) => affiliateTypeLabel(r.affiliateType) },
      { label: 'Plan', value: (r) => r.planName },
      { label: 'Valor plan', value: (r) => r.planSalePrice, money: true },
      { label: 'Nuevo', value: newValue, money: true, priced: true },
      { label: 'Mensualidad', value: monthlyValue, money: true, priced: true },
    ],
  };
}

export const PRICE_CARDS: PriceCardDefinition[] = [
  {
    key: 'planes',
    title: 'Planes',
    description: 'Precio de venta de cada plan: valor del primer mes y de la mensualidad.',
    source: 'Planes',
    generalFilters: ['search', 'affiliateType', 'plan', 'price'],
    cardFilters: ['search', 'column', 'range'],
    searchPlaceholder: 'Nombre del plan',
    rows: (data) => data.plans,
    facets: (p: PlanPriceRow) => ({ text: p.name, affiliateType: p.affiliateType, planName: p.name }),
    columns: [
      { label: 'Plan', value: (p: PlanPriceRow) => p.name },
      { label: 'Tipo', value: (p: PlanPriceRow) => affiliateTypeLabel(p.affiliateType) },
      { label: 'Primer mes', value: (p: PlanPriceRow) => p.firstMonthPrice, money: true, priced: true },
      { label: 'Mensualidad', value: (p: PlanPriceRow) => p.salePrice, money: true, priced: true },
    ],
  },
  ruleCard('planilla', 'Planilla', 'Valor de planilla por agrupador, categoría, tipo y plan.', (r) => r.payrollNew, (r) => r.payrollMonthly),
  ruleCard('administracion', 'Administración', 'Valor de administración por agrupador, categoría, tipo y plan.', (r) => r.adminNew, (r) => r.adminMonthly),
  ruleCard('reserva', 'Reserva', 'Valor de reserva por agrupador, categoría, tipo y plan.', (r) => r.reserveNew, (r) => r.reserveMonthly),
  ruleCard('ganancia', 'Ganancia', 'Ganancia por agrupador, categoría, tipo y plan (base de lo que se factura en Siigo).', (r) => r.profitNew, (r) => r.profitMonthly),
  {
    key: 'descuentos',
    title: 'Descuentos especiales',
    description: 'Descuentos vigentes sobre el plan (precios extraordinarios) y cuántos afiliados activos tienen cada uno.',
    source: 'Afiliaciones activas',
    generalFilters: ['search', 'affiliateType', 'plan', 'price'],
    cardFilters: ['search', 'grouper', 'range'],
    searchPlaceholder: 'Plan o agrupador',
    rows: (data) => data.discounts,
    facets: (d: DiscountPriceRow) => ({
      text: `${d.planName} ${d.grouperName ?? ''}`,
      affiliateType: d.affiliateType,
      planName: d.planName,
      grouper: d.grouperName,
    }),
    columns: [
      { label: 'Plan', value: (d: DiscountPriceRow) => d.planName },
      { label: 'Tipo', value: (d: DiscountPriceRow) => affiliateTypeLabel(d.affiliateType) },
      { label: 'Agrupador', value: (d: DiscountPriceRow) => d.grouperName },
      { label: 'Valor plan', value: (d: DiscountPriceRow) => d.planSalePrice, money: true },
      { label: 'Descuento', value: (d: DiscountPriceRow) => d.discount, money: true, priced: true },
      { label: 'Afiliados', value: (d: DiscountPriceRow) => d.affiliates },
    ],
  },
  {
    key: 'parametros',
    title: 'Costos de referencia',
    description: 'Parámetros generales con valor en pesos (por ejemplo, los costos que usa Métricas).',
    source: 'Parámetros generales',
    generalFilters: ['search', 'price'],
    cardFilters: ['search', 'range'],
    searchPlaceholder: 'Nombre o descripción del parámetro',
    rows: (data) => data.parameters,
    facets: (p: PriceParameterRow) => ({ text: `${p.key} ${p.description ?? ''}` }),
    columns: [
      { label: 'Parámetro', value: (p: PriceParameterRow) => p.key },
      { label: 'Descripción', value: (p: PriceParameterRow) => p.description },
      { label: 'Valor', value: (p: PriceParameterRow) => p.value, money: true, priced: true },
    ],
  },
];

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Columnas de precio que se comparan: todas, o solo la elegida en la tarjeta. */
export function pricedColumns(card: PriceCardDefinition, column = ''): PriceColumn<any>[] {
  return card.columns.filter((c) => c.priced && (!column || c.label === column));
}

function pricedValues(columns: PriceColumn<any>[], row: any): number[] {
  return columns
    .map((c) => c.value(row))
    .filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
}

const inRange = (values: number[], min: number | null, max: number | null): boolean =>
  (min == null && max == null) || values.some((v) => (min == null || v >= min) && (max == null || v <= max));

/**
 * Aplica los filtros generales que tienen sentido para la tarjeta (los demás
 * se ignoran y la tarjeta lo indica) y luego los propios de la tarjeta. Un
 * rango de precio acepta la fila si alguna de las columnas de precio
 * comparadas cae dentro de él.
 */
export function buildCardView(
  card: PriceCardDefinition,
  data: PricesOverview,
  general: PricesFilters,
  own: CardFilters,
): PriceCardView {
  const all = card.rows(data);
  const appliesGeneral = (field: GeneralFilterField) => card.generalFilters.includes(field);
  const generalSearch = normalize(general.search.trim());
  const ownSearch = normalize(own.search.trim());
  const columns = pricedColumns(card, own.column);

  const rows = all.filter((row) => {
    const f = card.facets(row);
    const text = normalize(f.text);
    const values = pricedValues(columns, row);

    if (appliesGeneral('search') && generalSearch && !text.includes(generalSearch)) return false;
    if (appliesGeneral('affiliateType') && general.affiliateType && f.affiliateType !== general.affiliateType) return false;
    if (appliesGeneral('plan') && general.planName && f.planName !== general.planName) return false;
    if (appliesGeneral('price') && !inRange(values, general.minPrice, general.maxPrice)) return false;

    if (ownSearch && !text.includes(ownSearch)) return false;
    if (own.grouper && f.grouper !== own.grouper) return false;
    if (own.category && f.category !== own.category) return false;
    if (!inRange(values, own.minPrice, own.maxPrice)) return false;
    if (own.hideZero && values.every((v) => v === 0)) return false;
    return true;
  });

  const values = rows.flatMap((row) => pricedValues(columns, row));
  return {
    rows,
    total: all.length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  };
}

/** Valores distintos de una faceta en todas las filas de la tarjeta (para los selectores propios). */
export function facetOptions(card: PriceCardDefinition, data: PricesOverview, facet: 'grouper' | 'category'): string[] {
  const set = new Set<string>();
  for (const row of card.rows(data)) {
    const value = card.facets(row)[facet];
    if (value) set.add(value);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}
