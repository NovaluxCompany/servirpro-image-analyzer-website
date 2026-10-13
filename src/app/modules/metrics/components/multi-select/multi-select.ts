import { Component, ElementRef, HostListener, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface MultiSelectOption {
  value: number;
  label: string;
}

/** Selección múltiple con buscador. Vacío = "Todos" (sin filtro). */
@Component({
  selector: 'app-metrics-multi-select',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './multi-select.html',
})
export class MetricsMultiSelectComponent {
  private _elementRef = inject(ElementRef);

  label = input.required<string>();
  options = input<MultiSelectOption[]>([]);
  selected = input<number[]>([]);
  selectedChange = output<number[]>();

  isOpen = signal(false);
  search = signal('');

  filteredOptions = computed(() => {
    const text = this.search().toLowerCase().trim();
    return text ? this.options().filter((o) => o.label.toLowerCase().includes(text)) : this.options();
  });

  summary = computed(() => {
    const selected = this.selected();
    if (selected.length === 0) return 'Todos';
    if (selected.length === 1) return this.options().find((o) => o.value === selected[0])?.label ?? '1 seleccionado';
    return `${selected.length} seleccionados`;
  });

  isSelected(value: number): boolean {
    return this.selected().includes(value);
  }

  toggle(value: number): void {
    const current = this.selected();
    this.selectedChange.emit(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  clear(): void {
    this.selectedChange.emit([]);
  }

  toggleOpen(): void {
    this.isOpen.update((open) => !open);
    this.search.set('');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this._elementRef.nativeElement.contains(event.target)) this.isOpen.set(false);
  }
}
