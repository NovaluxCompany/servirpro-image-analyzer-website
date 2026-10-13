import { Component, input } from '@angular/core';

/** Deja en evidencia lo que el sistema no maneja o está incompleto. */
@Component({
  selector: 'app-missing-data',
  standalone: true,
  template: `
    @if (messages().length > 0) {
      <div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <p class="flex items-center gap-1.5 font-semibold">
          <svg class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Información que el sistema no maneja
        </p>
        @if (compact()) {
          <p class="mt-1 text-amber-800">{{ messages().length }} aviso(s). Abre el detalle para verlos.</p>
        } @else {
          <ul class="mt-1 list-disc space-y-0.5 pl-5">
            @for (message of messages(); track message) {
              <li>{{ message }}</li>
            }
          </ul>
        }
      </div>
    }
  `,
})
export class MissingDataComponent {
  messages = input<string[]>([]);
  compact = input(false);
}
