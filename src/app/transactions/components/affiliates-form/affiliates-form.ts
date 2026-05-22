import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AffiliatesService } from '../../services/affiliates.service';
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

  affiliatesChanged = output<Affiliate[]>();

  onSearch(): void {
    const { reference, fullName } = this.searchForm.value;
    const searchValue = reference || fullName;

    if (!searchValue) {
      this.errorMessage.set('Ingresa una referencia o cédula para buscar');
      return;
    }

    // Limpiar selecciones anteriores al hacer una nueva búsqueda
    this.selectedAffiliates.set(new Set());
    this.affiliatesChanged.emit([]);

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._affiliatesService.searchAffiliates(searchValue).subscribe({
      next: (data) => {
        this.affiliates.set(data);
        this.applyTableFilter();
        this.isLoading.set(false);

        if (data.length === 0) {
          this.errorMessage.set('No se encontraron afiliados con los criterios de búsqueda');
        }
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
      affiliate.reference?.toLowerCase().includes(filter) ||
      affiliate.plan.toLowerCase().includes(filter)
    );

    this.filteredAffiliates.set(filtered);
  }

  onClearSearch(): void {
    this.searchForm.reset();
    this.affiliates.set([]);
    this.filteredAffiliates.set([]);
    this.selectedAffiliates.set(new Set());
    this.tableFilter.set('');
    this.errorMessage.set(null);
    this.affiliatesChanged.emit([]);
  }

  toggleAffiliate(idNumber: string): void {
    const selected = new Set(this.selectedAffiliates());

    if (selected.has(idNumber)) {
      selected.delete(idNumber);
    } else {
      selected.add(idNumber);
    }

    this.selectedAffiliates.set(selected);
    this.affiliatesChanged.emit(this.getSelectedAffiliates());
  }

  isSelected(idNumber: string): boolean {
    return this.selectedAffiliates().has(idNumber);
  }

  selectAll(): void {
    const allIds = new Set(this.filteredAffiliates().map(a => a.idNumber));
    this.selectedAffiliates.set(allIds);
    this.affiliatesChanged.emit(this.getSelectedAffiliates());
  }

  deselectAll(): void {
    this.selectedAffiliates.set(new Set());
    this.affiliatesChanged.emit([]);
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
