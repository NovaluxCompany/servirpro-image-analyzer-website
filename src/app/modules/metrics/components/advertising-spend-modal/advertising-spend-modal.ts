import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../core/service/toast.service';
import { AdvertisingMonth } from '../../interfaces/metrics.interface';
import { MetricsService } from '../../services/metrics.service';
import { colombiaToday } from '../../services/metrics-filters.store';
import { MoneyPipe, MonthLabelPipe } from '../../utils/metrics-format';

/**
 * Modal "Publicidad por mes" (detalle de los gráficos 1, 2 y 4): se escoge el mes y se
 * digita lo invertido en Meta y en Web. Queda guardado en BD y los gráficos
 * 1, 2 y 4 lo usan para los meses que toca su rango de fechas.
 */
@Component({
  selector: 'app-advertising-spend-modal',
  standalone: true,
  imports: [FormsModule, MoneyPipe, MonthLabelPipe],
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" (click)="close()">
      <div class="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden" role="dialog" aria-modal="true"
        aria-labelledby="ad-modal-title" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
          <div class="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 id="ad-modal-title" class="text-base font-bold text-white">Publicidad por mes</h3>
            <p class="text-xs text-blue-100">Lo invertido en Meta y Web. Los gráficos suman los meses que toca su rango de fechas.</p>
          </div>
          <button type="button" (click)="close()" class="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white transition-colors" aria-label="Cerrar">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="px-6 py-5 max-h-[70vh] overflow-y-auto">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label for="ad-month" class="block mb-1 text-xs font-medium text-gray-600">Mes <span class="text-red-500">*</span></label>
              <input id="ad-month" type="month" [max]="maxMonth" [ngModel]="month()" (ngModelChange)="selectMonth($event)"
                class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label for="ad-meta" class="block mb-1 text-xs font-medium text-gray-600">Publicidad Meta</label>
              <div class="relative">
                <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">$</span>
                <input id="ad-meta" type="number" min="0" step="1000" [disabled]="!canEdit()" [ngModel]="meta()" (ngModelChange)="meta.set(toAmount($event))"
                  class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
              </div>
            </div>
            <div>
              <label for="ad-web" class="block mb-1 text-xs font-medium text-gray-600">Publicidad Web</label>
              <div class="relative">
                <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500">$</span>
                <input id="ad-web" type="number" min="0" step="1000" [disabled]="!canEdit()" [ngModel]="web()" (ngModelChange)="web.set(toAmount($event))"
                  class="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500" />
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <span class="text-sm font-medium text-blue-900">Total {{ month() ? (month() | monthLabel) : 'del mes' }}</span>
            <span class="text-lg font-bold text-blue-900 tabular-nums">{{ meta() + web() | money }}</span>
          </div>

          @if (!canEdit()) {
            <div class="mt-3 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              <svg class="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tu rol solo puede ver la publicidad; para registrarla necesitas el permiso "Editar" en Métricas.
            </div>
          }

          <h4 class="mt-6 mb-2 text-sm font-semibold text-gray-900">Registrado en {{ year() }}</h4>
          @if (loading()) {
            <div class="h-24 animate-pulse rounded-lg bg-gray-100"></div>
          } @else if (loadError()) {
            <p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{{ loadError() }}</p>
          } @else if (months().length === 0) {
            <p class="rounded-lg border border-dashed border-gray-300 py-4 text-center text-xs text-gray-500">Aún no hay publicidad registrada este año.</p>
          } @else {
            <div class="max-h-56 overflow-auto rounded-lg border border-gray-200">
              <table class="w-full text-sm text-left text-gray-600 tabular-nums">
                <thead class="sticky top-0 text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th class="px-3 py-2 font-semibold">Mes</th>
                    <th class="px-3 py-2 font-semibold text-right">Meta</th>
                    <th class="px-3 py-2 font-semibold text-right">Web</th>
                    <th class="px-3 py-2 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (m of months(); track m.month) {
                    <tr class="cursor-pointer transition-colors hover:bg-blue-50" [class.bg-blue-50]="m.month === month()" (click)="selectMonth(m.month)">
                      <td class="px-3 py-2 font-medium text-gray-900">{{ m.month | monthLabel }}</td>
                      <td class="px-3 py-2 text-right">{{ m.meta | money }}</td>
                      <td class="px-3 py-2 text-right">{{ m.web | money }}</td>
                      <td class="px-3 py-2 text-right font-semibold text-gray-900">{{ m.meta + m.web | money }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            <p class="mt-1 text-xs text-gray-400">Haz clic en un mes para editarlo.</p>
          }
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button type="button" (click)="close()" [disabled]="saving()"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50">
            {{ canEdit() ? 'Cancelar' : 'Cerrar' }}
          </button>
          @if (canEdit()) {
            <button type="button" (click)="save()" [disabled]="saving() || !month()"
              class="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              @if (saving()) {
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Guardando...
              } @else {
                {{ hasSaved() ? 'Editar precio' : 'Guardar precio' }}
              }
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class AdvertisingSpendModalComponent implements OnInit {
  private _service = inject(MetricsService);
  private _toast = inject(ToastService);

  /** Mes con el que abre (el del filtro "Desde"). */
  initialMonth = input<string>(colombiaToday().slice(0, 7));
  canEdit = input(false);

  closed = output<void>();
  /** Se emite tras guardar: el padre cierra el modal y recarga el gráfico. */
  saved = output<void>();

  readonly maxMonth = `${Number(colombiaToday().slice(0, 4)) + 1}-12`;
  month = signal('');
  meta = signal(0);
  web = signal(0);
  months = signal<AdvertisingMonth[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  saving = signal(false);
  year = computed(() => Number((this.month() || colombiaToday()).slice(0, 4)));
  /** El mes escogido ya tiene publicidad guardada: el botón pasa a "Editar precio". */
  hasSaved = computed(() => this.months().some((m) => m.month === this.month()));
  private loadedYear: number | null = null;

  ngOnInit(): void {
    this.selectMonth(this.initialMonth());
  }

  selectMonth(month: string): void {
    if (!/^\d{4}-\d{2}$/.test(month ?? '')) return;
    this.month.set(month);
    const year = Number(month.slice(0, 4));
    if (year !== this.loadedYear) {
      this.loadYear(year);
    } else {
      this.fillFromSaved();
    }
  }

  toAmount(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  save(): void {
    if (this.saving() || !this.month()) return;
    this.saving.set(true);
    this._service.saveAdvertisingMonth(this.month(), this.meta(), this.web()).subscribe({
      next: (saved) => {
        this.saving.set(false);
        const edited = this.hasSaved();
        this.months.update((list) =>
          [...list.filter((m) => m.month !== saved.month), saved].sort((a, b) => b.month.localeCompare(a.month)),
        );
        this._toast.showSuccess(edited ? 'Publicidad del mes actualizada' : 'Publicidad del mes guardada');
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        this._toast.showError(err?.message ?? 'No fue posible guardar la publicidad');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }

  private loadYear(year: number): void {
    this.loading.set(true);
    this.loadError.set(null);
    this._service.getAdvertisingMonths(year).subscribe({
      next: (months) => {
        this.loadedYear = year;
        this.months.set(months);
        this.loading.set(false);
        this.fillFromSaved();
      },
      error: (err) => {
        this.loadedYear = null;
        this.months.set([]);
        this.loading.set(false);
        this.loadError.set(err?.message ?? 'No fue posible cargar la publicidad registrada');
        this.fillFromSaved();
      },
    });
  }

  /** Al cambiar de mes, los campos muestran lo ya guardado (o 0). */
  private fillFromSaved(): void {
    const saved = this.months().find((m) => m.month === this.month());
    this.meta.set(saved?.meta ?? 0);
    this.web.set(saved?.web ?? 0);
  }
}
