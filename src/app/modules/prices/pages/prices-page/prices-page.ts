import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../core/service/toast.service';
import { PriceCardComponent } from '../../components/price-card/price-card';
import { AffiliateType, EMPTY_PRICES_FILTERS, PricesFilters, PricesOverview } from '../../interfaces/prices.interface';
import { PRICE_CARDS, affiliateTypeLabel } from '../../price-cards.config';
import { PricesService } from '../../services/prices.service';

/**
 * Módulo Precios: muestra (solo lectura) todos los precios configurados,
 * una tarjeta desplegable por fuente. Los datos se cargan una vez y los
 * filtros se aplican en el navegador: los generales (aquí) afectan todas las
 * tarjetas y cada tarjeta tiene además los suyos.
 */
@Component({
  selector: 'app-prices-page',
  standalone: true,
  imports: [FormsModule, PriceCardComponent],
  templateUrl: './prices-page.html',
})
export class PricesPageComponent implements OnInit {
  private _service = inject(PricesService);
  private _toast = inject(ToastService);

  readonly cards = PRICE_CARDS;
  readonly affiliateTypeLabel = affiliateTypeLabel;

  data = signal<PricesOverview | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  filters = signal<PricesFilters>({ ...EMPTY_PRICES_FILTERS });
  expanded = signal<Record<string, boolean>>({});

  /**
   * Nombres de plan sin repetir: un mismo nombre agrupa Dependiente e
   * Independiente. Si hay tipo de afiliado elegido, solo los de ese tipo.
   */
  planOptions = computed(() => this.planNames(this.filters().affiliateType));

  invalidRange = computed(() => {
    const { minPrice, maxPrice } = this.filters();
    return minPrice != null && maxPrice != null && minPrice > maxPrice;
  });

  hasFilters = computed(() => JSON.stringify(this.filters()) !== JSON.stringify(EMPTY_PRICES_FILTERS));

  allExpanded = computed(() => this.cards.every((c) => this.expanded()[c.key]));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this._service.getOverview().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        const message = err?.message ?? 'No fue posible cargar los precios';
        this.loading.set(false);
        this.error.set(message);
        this._toast.showError(message);
      },
    });
  }

  update<K extends keyof PricesFilters>(field: K, value: PricesFilters[K]): void {
    this.filters.update((f) => {
      const next = { ...f, [field]: value };
      // Si el plan elegido no existe para el nuevo tipo de afiliado, se limpia.
      if (field === 'affiliateType' && next.planName && !this.planNames(next.affiliateType).includes(next.planName)) {
        next.planName = '';
      }
      return next;
    });
  }

  updatePrice(field: 'minPrice' | 'maxPrice', value: string | number | null): void {
    const n = value === '' || value == null ? null : Number(value);
    this.update(field, n == null || Number.isNaN(n) ? null : n);
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_PRICES_FILTERS });
  }

  setExpanded(key: string, value: boolean): void {
    this.expanded.update((e) => ({ ...e, [key]: value }));
  }

  toggleAll(): void {
    const value = !this.allExpanded();
    this.expanded.set(Object.fromEntries(this.cards.map((c) => [c.key, value])));
  }

  private planNames(type: AffiliateType | ''): string[] {
    const names = (this.data()?.plans ?? []).filter((p) => !type || p.affiliateType === type).map((p) => p.name);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'es'));
  }
}
