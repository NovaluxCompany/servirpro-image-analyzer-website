import { Component, input } from '@angular/core';

/**
 * Rueda de carga del área de un gráfico. Sin datos ocupa el alto del gráfico;
 * con `overlay` se pone encima del resultado anterior mientras recarga, para
 * que el usuario no confunda esos datos con los del filtro nuevo.
 */
@Component({
  selector: 'app-metrics-loading-spinner',
  standalone: true,
  template: `
    <div
      class="flex flex-col items-center justify-center gap-3"
      [class]="overlay() ? 'absolute inset-0 z-10 rounded-lg bg-white/60' : height()"
      role="status"
      aria-live="polite"
    >
      <svg class="h-10 w-10 animate-spin text-blue-700" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span class="text-sm font-medium text-gray-600">{{ label() }}</span>
    </div>
  `,
})
export class MetricsLoadingSpinnerComponent {
  label = input('Cargando gráfico...');
  overlay = input(false);
  /** Alto cuando no hay datos todavía (clase de Tailwind). */
  height = input('h-60');
}
