import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  ViewChild,
  forwardRef,
  signal,
  computed,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  templateUrl: './searchable-select.html',
})
export class SearchableSelectComponent implements ControlValueAccessor, OnInit {
  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Seleccionar...';
  @Input() isInvalid = false;

  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;

  /** Plain string for ngModel two-way binding */
  searchText = '';
  isOpen = signal(false);
  selectedValue = signal<string>('');

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  isDisabled = signal(false);

  selectedLabel = computed(() => {
    const val = this.selectedValue();
    if (!val) return '';
    return this.options.find((o) => o.value === val)?.label ?? '';
  });

  get filteredOptions(): SelectOption[] {
    const text = this.searchText.toLowerCase().trim();
    if (!text) return this.options;
    return this.options.filter((o) => o.label.toLowerCase().includes(text));
  }

  ngOnInit(): void {}

  writeValue(value: string): void {
    this.selectedValue.set(value ?? '');
    this.searchText = '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  openDropdown(): void {
    if (this.isDisabled()) return;
    this.isOpen.set(true);
    this.searchText = '';
    setTimeout(() => this.inputRef?.nativeElement?.focus(), 50);
  }

  selectOption(option: SelectOption): void {
    this.selectedValue.set(option.value);
    this.searchText = '';
    this.isOpen.set(false);
    this.onChange(option.value);
    this.onTouched();
  }

  clearSelection(): void {
    this.selectedValue.set('');
    this.searchText = '';
    this.isOpen.set(false);
    this.onChange('');
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as Node;
    const hostEl = (this.inputRef?.nativeElement?.closest('.searchable-select-host') as HTMLElement);
    if (hostEl && !hostEl.contains(target)) {
      this.isOpen.set(false);
      this.searchText = '';
      this.onTouched();
    }
  }
}
