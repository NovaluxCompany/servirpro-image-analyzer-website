import { Component, computed, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CardFilters, EMPTY_CARD_FILTERS, PricesFilters, PricesOverview } from '../../interfaces/prices.interface';
import {
  ALL_GENERAL_FILTERS,
  CardFilterField,
  GENERAL_FILTER_LABELS,
  PriceCardDefinition,
  PriceColumn,
  buildCardView,
  facetOptions,
  pricedColumns,
} from '../../price-cards.config';

const MONEY = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/**
 * Tarjeta desplegable de solo lectura con la tabla de precios de una fuente.
 * Recibe los filtros generales y tiene además sus propios filtros, que solo
 * la afectan a ella.
 */
@Component({
  selector: 'app-price-card',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './price-card.html',
})
export class PriceCardComponent {
  definition = input.required<PriceCardDefinition>();
  data = input.required<PricesOverview>();
  generalFilters = input.required<PricesFilters>();
  expanded = model(false);

  own = signal<CardFilters>({ ...EMPTY_CARD_FILTERS });

  view = computed(() => buildCardView(this.definition(), this.data(), this.generalFilters(), this.own()));

  grouperOptions = computed(() => facetOptions(this.definition(), this.data(), 'grouper'));
  categoryOptions = computed(() => facetOptions(this.definition(), this.data(), 'category'));
  priceColumnOptions = computed(() => pricedColumns(this.definition()).map((c) => c.label));

  ownFilterCount = computed(() => {
    const f = this.own();
    return [f.search.trim(), f.grouper, f.category, f.column, f.minPrice != null || f.maxPrice != null, f.hideZero]
      .filter(Boolean).length;
  });

  invalidRange = computed(() => {
    const { minPrice, maxPrice } = this.own();
    return minPrice != null && maxPrice != null && minPrice > maxPrice;
  });

  appliedGeneral = computed(() => this.definition().generalFilters.map((f) => GENERAL_FILTER_LABELS[f]).join(' · '));
  ignoredGeneral = computed(() =>
    ALL_GENERAL_FILTERS.filter((f) => !this.definition().generalFilters.includes(f))
      .map((f) => GENERAL_FILTER_LABELS[f])
      .join(' · '),
  );

  has(field: CardFilterField): boolean {
    return this.definition().cardFilters.includes(field);
  }

  toggle(): void {
    this.expanded.update((v) => !v);
  }

  update<K extends keyof CardFilters>(field: K, value: CardFilters[K]): void {
    this.own.update((f) => ({ ...f, [field]: value }));
  }

  updatePrice(field: 'minPrice' | 'maxPrice', value: string | number | null): void {
    const n = value === '' || value == null ? null : Number(value);
    this.update(field, n == null || Number.isNaN(n) ? null : n);
  }

  clearOwn(): void {
    this.own.set({ ...EMPTY_CARD_FILTERS });
  }

  money(value: number | null): string {
    if (value == null) return '—';
    return `${value < 0 ? '-' : ''}$${MONEY.format(Math.abs(value))}`;
  }

  cell(column: PriceColumn<any>, row: any): string {
    const value = column.value(row);
    if (column.money) return this.money(typeof value === 'number' ? value : null);
    return value == null || value === '' ? '—' : String(value);
  }

  /** Resalta solo las columnas de precio que se están comparando. */
  isCompared(column: PriceColumn<any>): boolean {
    return !!column.priced && (!this.own().column || this.own().column === column.label);
  }
}
