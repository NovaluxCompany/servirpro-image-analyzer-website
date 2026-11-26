import { Component, inject, input, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AffiliatesService } from '../../services/affiliates.service';
import { TransactionsService } from '../../services/transactions.service';
import { Affiliate } from '../../interfaces/affiliate.interface';

@Component({
  selector: 'app-affiliates-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './affiliates-form.html'
})
export class AffiliatesFormComponent {
  private _fb = inject(FormBuilder);
  private _affiliatesService = inject(AffiliatesService);
  private _transactionsService = inject(TransactionsService);

  searchForm = this._fb.group({
    reference: [''],
    fullName: ['']
  });

  affiliates = signal<Affiliate[]>([]);
  filteredAffiliates = signal<Affiliate[]>([]);
  selectedAffiliates = signal<Set<string>>(new Set());
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  tableFilter = signal('');
  /** idNumber -> mensaje de "ya tiene transacción este mes", detectado al seleccionar. */
  duplicateWarnings = signal<Map<string, string>>(new Map());

  /**
   * Bloqueo global de transacciones (param TRANSACCIONES_BLOQUEADAS, lo prende
   * el Administrador para el cierre de mes). Con el bloqueo encendido solo se
   * puede pagar a los afiliados INDEPENDIENTE y a los NUEVOS: los demás
   * (mensualidades de dependientes) sí se pueden seleccionar, pero al quedar
   * seleccionados se muestra el error y el botón de crear se bloquea
   * (TransactionsService.create valida lo mismo contra
   * `affiliations.affiliate_type` e `is_new`, que son la palabra final).
   */
  transactionsLocked = input<boolean>(false);

  affiliatesChanged = output<Affiliate[]>();

  /**
   * Estado del bloqueo consultado a la API en el momento de seleccionar (null
   * mientras no se haya consultado). Así la validación no depende solo de lo
   * que se leyó al abrir la página: si el Administrador bloquea mientras
   * alguien está llenando el formulario, al seleccionar ya se entera.
   */
  private lockCheckedOnSelect = signal<boolean | null>(null);

  /** Bloqueo vigente: el consultado al seleccionar manda sobre el de la página. */
  private isLockActive(): boolean {
    return this.lockCheckedOnSelect() ?? this.transactionsLocked();
  }

  /** Misma regla que TransactionsService.isAllowedWhileLocked en el backend. */
  private isAllowedWhileLocked(affiliate: Affiliate): boolean {
    return !!affiliate.isNew || (affiliate.affiliateType ?? '').toUpperCase() === 'INDEPENDIENTE';
  }

  /** Con el bloqueo encendido, este afiliado no puede pagarse por ser mensualidad de un dependiente. */
  isBlockedByLock(affiliate: Affiliate): boolean {
    return this.isLockActive() && !this.isAllowedWhileLocked(affiliate);
  }

  private showResults(data: Affiliate[]): void {
    this.affiliates.set(data);
    this.applyTableFilter();
    this.isLoading.set(false);
  }

  /**
   * Con el bloqueo encendido, las mensualidades de dependientes no llegan a
   * la tabla: no se pueden seleccionar y el único aviso es el de la búsqueda
   * (una sola vez). Si en el mismo resultado hay independientes o nuevos,
   * esos sí se muestran.
   */
  private showResultsWithLock(data: Affiliate[]): void {
    if (!this.isLockActive()) {
      this.showResults(data);
      return;
    }
    const allowed = data.filter((a) => this.isAllowedWhileLocked(a));
    const blocked = data.filter((a) => !this.isAllowedWhileLocked(a)).map((a) => a.fullName);
    this.showResults(allowed);
    const reason = 'las transacciones están bloqueadas y solo se pueden crear para afiliados independientes o nuevos';
    this.errorMessage.set(
      blocked.length === 1
        ? `${blocked[0]} es un afiliado dependiente en mensualidad: ${reason}, así que no se le puede crear una transacción.`
        : `${blocked.join(', ')} son afiliados dependientes en mensualidad: ${reason}, así que no se les puede crear una transacción.`,
    );
  }

  /** Igual que isBlockedByLock, pero solo para los ya seleccionados (el aviso sale al seleccionar). */
  isSelectedAndBlocked(affiliate: Affiliate): boolean {
    return this.isSelected(affiliate.idNumber) && this.isBlockedByLock(affiliate);
  }

  /** Consulta el bloqueo en la API; si falla se queda con el de la página (el backend valida igual al crear). */
  private refreshLockStatus(): void {
    this._transactionsService.getLockStatus().subscribe({
      next: (res) => this.lockCheckedOnSelect.set(res.locked),
      error: () => {},
    });
  }

  /**
   * Afiliados seleccionados que el bloqueo no permite pagar. Si hay alguno se
   * muestra el error bajo la tabla y la página deja el botón de crear
   * inhabilitado (ver TransactionCreate.isSubmitBlocked).
   */
  lockedSelectionNames(): string[] {
    return this.getSelectedAffiliates()
      .filter((a) => this.isBlockedByLock(a))
      .map((a) => a.fullName);
  }

  hasLockedSelection(): boolean {
    return this.lockedSelectionNames().length > 0;
  }

  onSearch(): void {
    const { reference, fullName } = this.searchForm.value;
    // Sin espacios: la API compara la cédula exacta y un espacio pegado al
    // copiarla daba "No se encontraron afiliados".
    const searchValue = (reference || fullName || '').trim();

    if (!searchValue) {
      this.errorMessage.set('Ingresa una referencia o cédula para buscar');
      return;
    }

    // Limpiar selecciones anteriores al hacer una nueva búsqueda
    this.selectedAffiliates.set(new Set());
    this.duplicateWarnings.set(new Map());
    this.affiliatesChanged.emit([]);

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._affiliatesService.searchAffiliates(searchValue).subscribe({
      next: (data) => {
        if (data.length === 0) {
          this.showResults([]);
          this.errorMessage.set('No se encontraron afiliados con los criterios de búsqueda');
          return;
        }
        if (data.every((a) => this.isAllowedWhileLocked(a))) {
          this.showResults(data);
          return;
        }
        // Hay mensualidades de dependientes: antes de mostrar nada se consulta el bloqueo en
        // este momento (si la consulta falla, vale el de la página).
        this._transactionsService.getLockStatus().subscribe({
          next: (res) => { this.lockCheckedOnSelect.set(res.locked); this.showResultsWithLock(data); },
          error: () => this.showResultsWithLock(data),
        });
      },
      error: (error) => {
        console.error('Error al buscar afiliados:', error);
        this.errorMessage.set(error.message);
        this.isLoading.set(false);
        this.affiliates.set([]);
        this.filteredAffiliates.set([]);
      }
    });
  }

  onTableFilterChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.tableFilter.set(input.value);
    this.applyTableFilter();
  }

  applyTableFilter(): void {
    const filter = this.tableFilter().toLowerCase();

    if (!filter) {
      this.filteredAffiliates.set(this.affiliates());
      return;
    }

    const filtered = this.affiliates().filter(affiliate =>
      affiliate.fullName.toLowerCase().includes(filter) ||
      affiliate.idNumber.includes(filter) ||
      affiliate.reference.toLowerCase().includes(filter) ||
      affiliate.plan.toLowerCase().includes(filter)
    );

    this.filteredAffiliates.set(filtered);
  }

  onClearSearch(): void {
    this.searchForm.reset();
    this.affiliates.set([]);
    this.filteredAffiliates.set([]);
    this.selectedAffiliates.set(new Set());
    this.duplicateWarnings.set(new Map());
    this.tableFilter.set('');
    this.errorMessage.set(null);
    this.affiliatesChanged.emit([]);
  }

  toggleAffiliate(idNumber: string): void {
    const selected = new Set(this.selectedAffiliates());

    if (selected.has(idNumber)) {
      selected.delete(idNumber);
      this.clearDuplicateWarning(idNumber);
    } else {
      selected.add(idNumber);
      this.checkDuplicateForAffiliate(idNumber);
      this.refreshLockStatus();
    }

    this.selectedAffiliates.set(selected);
    this.affiliatesChanged.emit(this.getSelectedAffiliates());
  }

  isSelected(idNumber: string): boolean {
    return this.selectedAffiliates().has(idNumber);
  }

  duplicateWarningFor(idNumber: string): string | null {
    return this.duplicateWarnings().get(idNumber) ?? null;
  }

  private checkDuplicateForAffiliate(idNumber: string): void {
    this._affiliatesService.checkDuplicate(idNumber).subscribe({
      next: (res) => {
        if (!res.duplicate) return;
        const warnings = new Map(this.duplicateWarnings());
        warnings.set(idNumber, res.message ?? 'Ya tiene una transacción registrada este mes.');
        this.duplicateWarnings.set(warnings);
      },
      // Si el chequeo falla no bloqueamos la selección: el backend igual valida al enviar.
      error: () => {},
    });
  }

  private clearDuplicateWarning(idNumber: string): void {
    if (!this.duplicateWarnings().has(idNumber)) return;
    const warnings = new Map(this.duplicateWarnings());
    warnings.delete(idNumber);
    this.duplicateWarnings.set(warnings);
  }

  selectAll(): void {
    // Con el bloqueo encendido también entran los que no son independientes ni nuevos:
    // así aparece el error y el botón de crear se bloquea, igual que al
    // marcarlos uno por uno.
    const allIds = this.filteredAffiliates().map((a) => a.idNumber);
    this.selectedAffiliates.set(new Set(allIds));
    allIds.forEach((idNumber) => this.checkDuplicateForAffiliate(idNumber));
    if (allIds.length > 0) this.refreshLockStatus();
    this.affiliatesChanged.emit(this.getSelectedAffiliates());
  }

  deselectAll(): void {
    this.selectedAffiliates.set(new Set());
    this.duplicateWarnings.set(new Map());
    this.affiliatesChanged.emit([]);
  }

  /** true si algún afiliado seleccionado ya tiene una transacción este mes.
   *  Bloquea el botón de crear transacción como respaldo por si el usuario
   *  no ve el aviso inline en la fila. */
  hasDuplicates(): boolean {
    return this.duplicateWarnings().size > 0;
  }

  getSelectedAffiliates(): Affiliate[] {
    const selected = this.selectedAffiliates();
    return this.affiliates().filter(a => selected.has(a.idNumber));
  }

  getSelectedCount(): number {
    return this.selectedAffiliates().size;
  }

  getReference(): string {
    return this.searchForm.value.reference || '';
  }

  isValid(): boolean {
    return this.selectedAffiliates().size > 0;
  }

  /** Cuántos resultados hay a la vista para seleccionar. */
  selectableCount(): number {
    return this.filteredAffiliates().length;
  }

  markAllAsTouched(): void {
    // No-op para mantener compatibilidad
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }
}
