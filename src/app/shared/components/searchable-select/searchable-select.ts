import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  forwardRef,
  inject,
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
export class SearchableSelectComponent implements ControlValueAccessor, OnInit, AfterViewInit, OnDestroy {
  private _elementRef = inject(ElementRef);

  @Input() options: SelectOption[] = [];
  @Input() placeholder = 'Seleccionar...';
  @Input() isInvalid = false;
  /** Combobox mode: the trigger IS a text input. Typing sets the value directly.
   *  A chevron button opens a filtered suggestions list. */
  @Input() allowFreeText = false;

  @ViewChild('inputRef') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('triggerRef') triggerRef!: ElementRef<HTMLElement>;
  @ViewChild('comboRef') comboRef!: ElementRef<HTMLInputElement>;

  searchText = '';
  isOpen = signal(false);
  selectedValue = signal<string>('');
  dropdownTop = signal(0);
  dropdownLeft = signal(0);
  dropdownWidth = signal(0);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  isDisabled = signal(false);

  // Only close on scroll events that originate OUTSIDE the dropdown panel
  private readonly closeOnScroll = (event: Event): void => {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    if (target.closest?.('.ss-dropdown-panel')) return;
    this.isOpen.set(false);
    this.searchText = '';
    this.onTouched();
  };

  selectedLabel = computed(() => {
    const val = this.selectedValue();
    if (!val) return '';
    return this.options.find((o) => o.value === val)?.label ?? val;
  });

  /** Options filtered by the search box (select mode) */
  get filteredOptions(): SelectOption[] {
    const text = this.searchText.toLowerCase().trim();
    if (!text) return this.options;
    return this.options.filter((o) => o.label.toLowerCase().includes(text));
  }

  /** Options filtered by what the user typed (combobox mode) */
  get comboFilteredOptions(): SelectOption[] {
    const text = this.selectedValue().toLowerCase().trim();
    if (!text) return this.options;
    return this.options.filter((o) => o.label.toLowerCase().includes(text));
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    window.addEventListener('scroll', this.closeOnScroll, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.closeOnScroll, true);
  }

  private updateDropdownPosition(): void {
    const el = this.triggerRef?.nativeElement;
    const rect = el?.getBoundingClientRect();
    if (rect) {
      this.dropdownTop.set(rect.bottom + 4);
      this.dropdownLeft.set(rect.left);
      this.dropdownWidth.set(rect.width);
    }
  }

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

  // ── Select mode ───────────────────────────────────────────────────────────

  openDropdown(): void {
    if (this.isDisabled()) return;
    this.updateDropdownPosition();
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

  // ── Combobox mode (allowFreeText) ─────────────────────────────────────────

  onComboInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.selectedValue.set(value);
    this.onChange(value);
    // Show suggestions while typing if there are options
    if (this.options.length > 0) {
      this.updateDropdownPosition();
      this.isOpen.set(true);
    }
  }

  onComboFocus(): void {
    if (this.isDisabled() || this.options.length === 0) return;
    this.updateDropdownPosition();
    this.isOpen.set(true);
  }

  onComboBlur(): void {
    // Delay so a click on a dropdown option registers before we close
    setTimeout(() => {
      this.isOpen.set(false);
      this.onTouched();
    }, 150);
  }

  toggleComboDropdown(): void {
    if (this.isDisabled() || this.options.length === 0) return;
    if (this.isOpen()) {
      this.isOpen.set(false);
    } else {
      this.updateDropdownPosition();
      this.isOpen.set(true);
    }
  }

  clearComboValue(): void {
    this.selectedValue.set('');
    this.onChange('');
    this.isOpen.set(false);
    this.onTouched();
    setTimeout(() => this.comboRef?.nativeElement?.focus(), 30);
  }

  selectComboOption(option: SelectOption): void {
    this.selectedValue.set(option.value);
    this.onChange(option.value);
    this.isOpen.set(false);
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
    const hostEl = this._elementRef.nativeElement as HTMLElement;
    if (!hostEl.contains(target)) {
      this.isOpen.set(false);
      this.searchText = '';
      this.onTouched();
    }
  }
}
