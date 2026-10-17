export type AffiliateType = 'INDEPENDIENTE' | 'DEPENDIENTE';

export interface PlanPriceRow {
  id: number;
  name: string;
  affiliateType: AffiliateType;
  salePrice: number;
  firstMonthPrice: number | null;
}

export interface PricesOverview {
  plans: PlanPriceRow[];
}

/**
 * Filtros generales: aplican a todas las tarjetas. Se aplican en el
 * navegador sobre lo ya cargado.
 */
export interface PricesFilters {
  search: string;
  affiliateType: AffiliateType | '';
  /** Nombre del plan (sin tipo): un mismo nombre agrupa Dependiente e Independiente. */
  planName: string;
  minPrice: number | null;
  maxPrice: number | null;
}

export const EMPTY_PRICES_FILTERS: PricesFilters = {
  search: '',
  affiliateType: '',
  planName: '',
  minPrice: null,
  maxPrice: null,
};

/** Filtros propios de una tarjeta: solo la afectan a ella. */
export interface CardFilters {
  search: string;
  grouper: string;
  category: string;
  /** Etiqueta de la columna de precio a comparar; '' = todas las columnas de precio. */
  column: string;
  minPrice: number | null;
  maxPrice: number | null;
  hideZero: boolean;
}

export const EMPTY_CARD_FILTERS: CardFilters = {
  search: '',
  grouper: '',
  category: '',
  column: '',
  minPrice: null,
  maxPrice: null,
  hideZero: false,
};
