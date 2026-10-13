import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

export interface SelectOption {
  value: string;
  label: string;
}

/** Espera antes de consultar al servidor, para no pegarle en cada tecla. */
const SERVER_SEARCH_DEBOUNCE_MS = 300;

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
export class SearchableSelectComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private _elementRef = inject(ElementRef);

  // ── Entradas ──────────────────────────────────────────────────────────────
  // Signal inputs: `options` se reasigna de forma asíncrona (los municipios
  // llegan después de elegir departamento; los resultados de una búsqueda al
  // servidor, después de escribir). Como signal, `selectedLabel` reacciona
  // sola — antes hacía falta un contador de versión manual para forzar el
  // recálculo del computed.
  options = input<SelectOption[]>([]);
  placeholder = input('Seleccionar...');
  isInvalid = input(false);
  /** Combobox mode: the trigger IS a text input. Typing sets the value directly.
   *  A chevron button opens a filtered suggestions list. */
  allowFreeText = input(false);

  // ── Modo servidor ─────────────────────────────────────────────────────────
  // Para catálogos que no caben en memoria (ej. CIE-10, ~14.000 filas): en vez
  // de recibir todas las opciones y filtrarlas en el navegador, el componente
  // emite lo que el usuario escribe y el padre le devuelve solo los resultados.

  /** true = `options` ya viene filtrado por el servidor; no se filtra de nuevo acá. */
  serverSearch = input(false);
  /** Muestra "Buscando..." mientras el padre resuelve la consulta. */
  isLoading = input(false);
  /** Mínimo de caracteres antes de consultar. Debajo de eso no se pega al servidor. */
  minSearchLength = input(3);
  /**
   * Opción ya seleccionada cuando el valor viene precargado (ej. al editar).
   * Sin esto el trigger mostraría el id crudo: `options` está vacío hasta que
   * el usuario busca, así que no hay dónde resolver la etiqueta.
   */
  selectedOption = input<SelectOption | null>(null);

  /** Texto escrito en el buscador, ya con debounce y sin repetidos. */
  searchChange = output<string>();

  // ── Referencias al DOM ────────────────────────────────────────────────────
  private inputRef = viewChild<ElementRef<HTMLInputElement>>('inputRef');
  private triggerRef = viewChild<ElementRef<HTMLElement>>('triggerRef');
  private comboRef = viewChild<ElementRef<HTMLInputElement>>('comboRef');

  // ── Estado ────────────────────────────────────────────────────────────────
  searchText = signal('');
  isOpen = signal(false);
  selectedValue = signal<string>('');
  isDisabled = signal(false);
  dropdownTop = signal(0);
  dropdownLeft = signal(0);
  dropdownWidth = signal(0);
  dropdownOpenUpward = signal(false);

  private searchInput$ = new Subject<string>();
  /** Última opción elegida: sobrevive a que `options` se reemplace por otra búsqueda. */
  private lastSelected = signal<SelectOption | null>(null);
  /** Reference to the panel element while it lives in document.body */
  private _bodyPanelEl: Element | null = null;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.searchInput$
      .pipe(debounceTime(SERVER_SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((text) => this.searchChange.emit(text));
  }

  // ── Derivados ─────────────────────────────────────────────────────────────

  selectedLabel = computed(() => {
    const val = this.selectedValue();
    if (!val) return '';

    // En modo servidor `options` se reemplaza en cada búsqueda, así que la
    // etiqueta de lo ya elegido no se puede resolver ahí: se cae a la última
    // opción seleccionada y, si el valor vino precargado, a `selectedOption`.
    const fromOptions = this.options().find((o) => o.value === val)?.label;
    if (fromOptions) return fromOptions;

    const remembered = this.lastSelected();
    if (remembered?.value === val) return remembered.label;

    const preloaded = this.selectedOption();
    if (preloaded?.value === val) return preloaded.label;

    return val;
  });

  /** Options filtered by the search box (select mode) */
  filteredOptions = computed(() => {
    // En modo servidor el filtrado ya lo hizo el backend: volver a filtrar acá
    // escondería resultados que hicieron match por un campo que no es el label
    // (ej. un CIE-10 encontrado por descripción y mostrado como "J00 — ...").
    if (this.serverSearch()) return this.options();

    const text = this.searchText().toLowerCase().trim();
    if (!text) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(text));
  });

  /** Options filtered by what the user typed (combobox mode) */
  comboFilteredOptions = computed(() => {
    const text = this.selectedValue().toLowerCase().trim();
    if (!text) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(text));
  });

  /** Qué mostrar en el panel cuando no hay opciones que listar (modo servidor). */
  serverSearchHint = computed(() => {
    if (!this.serverSearch()) return null;
    if (this.searchText().trim().length < this.minSearchLength()) {
      return `Escribe al menos ${this.minSearchLength()} caracteres para buscar`;
    }
    if (this.isLoading()) return 'Buscando...';
    return null;
  });

  // ── Ciclo de vida ─────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    window.addEventListener('scroll', this.closeOnScroll, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.closeOnScroll, true);
    this.closeDropdownPanel(false);
  }

  // Only close on scroll events that originate OUTSIDE the dropdown panel
  private readonly closeOnScroll = (event: Event): void => {
    if (!this.isOpen()) return;
    const target = event.target as HTMLElement;
    if (target.closest?.('.ss-dropdown-panel')) return;
    this.closeDropdownPanel();
  };

  private closeDropdownPanel(resetSearch = true): void {
    this.isOpen.set(false);
    if (this._bodyPanelEl) {
      this._bodyPanelEl.remove();
      this._bodyPanelEl = null;
    }
    if (resetSearch) {
      this.searchText.set('');
    }
    this.onTouched();
  }

  /**
   * After Angular renders the panel inside the component host, move it to
   * document.body so that position:fixed is relative to the real viewport
   * even when this component lives inside a CSS-transformed modal.
   */
  private moveDropdownToBody(): void {
    // Microtasks flush Angular's signal rendering; setTimeout(0) runs after.
    setTimeout(() => {
      const host = this._elementRef.nativeElement as HTMLElement;
      const panel = host.querySelector('.ss-dropdown-panel');
      if (panel) {
        document.body.appendChild(panel);
        this._bodyPanelEl = panel;
      }
    }, 0);
  }

  private updateDropdownPosition(): void {
    const el = this.triggerRef()?.nativeElement;
    const rect = el?.getBoundingClientRect();
    if (!rect) return;

    const PANEL_MAX_HEIGHT = 244; // search box (~44px) + options list (max-h-48 = 192px) + border
    const MIN_WIDTH = 220;
    const MARGIN = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Width: at least MIN_WIDTH, capped to viewport minus margins
    const width = Math.min(Math.max(rect.width, MIN_WIDTH), vw - MARGIN * 2);

    // Left: align to trigger, but clamp so panel stays within viewport
    let left = rect.left;
    if (left + width > vw - MARGIN) {
      left = vw - width - MARGIN;
    }
    if (left < MARGIN) left = MARGIN;

    // Vertical: open downward unless there's not enough space below
    const spaceBelow = vh - rect.bottom - MARGIN;
    const openUpward = spaceBelow < PANEL_MAX_HEIGHT && rect.top > spaceBelow;

    this.dropdownTop.set(openUpward ? rect.top - 4 : rect.bottom + 4);
    this.dropdownOpenUpward.set(openUpward);
    this.dropdownLeft.set(left);
    this.dropdownWidth.set(width);
  }

  // ── ControlValueAccessor ──────────────────────────────────────────────────

  writeValue(value: string): void {
    const next = value ?? '';
    this.selectedValue.set(next);
    // Si el formulario cambia el valor por fuera (reset, precarga), la opción
    // recordada ya no corresponde y no debe seguir prestando su etiqueta.
    if (this.lastSelected()?.value !== next) this.lastSelected.set(null);
    this.searchText.set('');
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

  onSearchTextChange(text: string): void {
    this.searchText.set(text);
    if (!this.serverSearch()) return;

    const trimmed = text.trim();
    // Por debajo del mínimo se avisa al padre con '' para que limpie resultados
    // viejos, en vez de dejar en pantalla los de la búsqueda anterior.
    this.searchInput$.next(trimmed.length >= this.minSearchLength() ? trimmed : '');
  }

  openDropdown(): void {
    if (this.isDisabled()) return;
    if (this.isOpen()) {
      this.closeDropdownPanel();
      return;
    }
    this.updateDropdownPosition();
    this.isOpen.set(true);
    this.searchText.set('');
    this.moveDropdownToBody();
    setTimeout(() => this.inputRef()?.nativeElement?.focus(), 50);
  }

  selectOption(option: SelectOption): void {
    this.selectedValue.set(option.value);
    this.lastSelected.set(option);
    this.searchText.set('');
    this.closeDropdownPanel(false);
    this.onChange(option.value);
  }

  clearSelection(): void {
    this.selectedValue.set('');
    this.lastSelected.set(null);
    this.searchText.set('');
    this.closeDropdownPanel(false);
    this.onChange('');
  }

  // ── Combobox mode (allowFreeText) ─────────────────────────────────────────

  onComboInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.selectedValue.set(value);
    this.onChange(value);
    // Show suggestions while typing if there are options
    if (this.options().length > 0) {
      this.updateDropdownPosition();
      if (!this.isOpen()) {
        this.isOpen.set(true);
        this.moveDropdownToBody();
      }
    }
  }

  onComboFocus(): void {
    if (this.isDisabled() || this.options().length === 0) return;
    this.updateDropdownPosition();
    if (!this.isOpen()) {
      this.isOpen.set(true);
      this.moveDropdownToBody();
    }
  }

  onComboBlur(): void {
    // Delay so a click on a dropdown option registers before we close
    setTimeout(() => {
      this.closeDropdownPanel(false);
    }, 150);
  }

  toggleComboDropdown(): void {
    if (this.isDisabled() || this.options().length === 0) return;
    if (this.isOpen()) {
      this.closeDropdownPanel(false);
    } else {
      this.updateDropdownPosition();
      this.isOpen.set(true);
      this.moveDropdownToBody();
    }
  }

  clearComboValue(): void {
    this.selectedValue.set('');
    this.onChange('');
    this.closeDropdownPanel(false);
    setTimeout(() => this.comboRef()?.nativeElement?.focus(), 30);
  }

  selectComboOption(option: SelectOption): void {
    this.selectedValue.set(option.value);
    this.onChange(option.value);
    this.closeDropdownPanel(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isOpen()) return;
    const target = event.target as Node;
    const hostEl = this._elementRef.nativeElement as HTMLElement;
    // Also check the panel that was moved to document.body
    if (!hostEl.contains(target) && !this._bodyPanelEl?.contains(target)) {
      this.closeDropdownPanel();
    }
  }
}
