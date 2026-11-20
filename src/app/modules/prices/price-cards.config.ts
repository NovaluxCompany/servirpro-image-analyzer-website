import { AffiliateType, CardFilters, PlanPriceRow, PricesFilters, PricesOverview } from './interfaces/prices.interface';

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

export const PRICE_CARDS: PriceCardDefinition[] = [
  {
    key: 'planes',
    title: 'Planes',
    description: 'Precio de venta de cada plan: valor del primer mes y de la mensualidad.',
    source: 'Planes',
    generalFilters: ['search', 'affiliateType', 'plan', 'price'],
    // Búsqueda y rango ya están en los filtros de arriba; acá solo qué columna comparar.
    cardFilters: ['column'],
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
