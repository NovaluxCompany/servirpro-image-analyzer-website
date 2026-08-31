import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Control reutilizable para que el usuario elija cuántos registros ver por
// página en una tabla paginada. Es puramente local a la sesión del módulo:
// NO se persiste en base de datos. Al salir del módulo y volver a entrar,
// el tamaño vuelve al valor por defecto (REGISTROS_POR_PAGINA, mínimo 50).
export const REGISTROS_POR_PAGINA_KEY = 'REGISTROS_POR_PAGINA';
export const MIN_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

@Component({
  selector: 'app-page-size-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './page-size-control.html',
})
export class PageSizeControlComponent {
  pageSize = input.required<number>();
  pageSizeChange = output<number>();

  // El valor actual (ej. el default leído de param_config_general) puede no
  // coincidir con ninguna opción fija; se agrega para que el <select> siempre
  // tenga un valor válido seleccionado.
  readonly options = computed(() => {
    const current = this.pageSize();
    return PAGE_SIZE_OPTIONS.includes(current)
      ? PAGE_SIZE_OPTIONS
      : [...PAGE_SIZE_OPTIONS, current].sort((a, b) => a - b);
  });

  onChange(value: string): void {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed !== this.pageSize()) {
      this.pageSizeChange.emit(parsed);
    }
  }
}
