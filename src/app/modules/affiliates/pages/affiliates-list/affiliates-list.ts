import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AffiliateMembersService, AffiliateFilters } from '../../services/affiliate-members.service';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';
import { AffiliateFormModalComponent } from '../../components/affiliate-form-modal/affiliate-form-modal';
import { AffiliateStatusModalComponent } from '../../components/affiliate-status-modal/affiliate-status-modal';
import { ToastService } from '../../../../core/service/toast.service';
import { SearchableSelectComponent, SelectOption } from '../../../../shared/components/searchable-select/searchable-select';
import { debounceTime, Subject } from 'rxjs';

@Component({
  selector: 'app-affiliates-list',
  standalone: true,
  imports: [CommonModule, FormsModule, AffiliateFormModalComponent, AffiliateStatusModalComponent, SearchableSelectComponent],
  templateUrl: './affiliates-list.html',
})
export class AffiliatesListComponent implements OnInit {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  // ── Datos ─────────────────────────────────────────────────────────
  affiliates = signal<AffiliateMember[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // ── Paginación backend ────────────────────────────────────────────
  currentPage = signal(1);
  pageSize = signal(10);
  totalItems = signal(0);
  totalPages = signal(0);

  // ── Filtros ───────────────────────────────────────────────────────
  filterName = '';
  filterCedula = '';
  filterReference = '';
  filterAdvisor = '';
  advisorOptions = signal<SelectOption[]>([]);
  referenceOptions = signal<SelectOption[]>([]);

  private filterSubject = new Subject<void>();

  // ── Modales ───────────────────────────────────────────────────────
  showFormModal = signal(false);
  showStatusModal = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  selectedAffiliate = signal<AffiliateMember | null>(null);

  ngOnInit(): void {
    // debounce text filter changes
    this.filterSubject.pipe(debounceTime(400)).subscribe(() => {
      this.currentPage.set(1);
      this.loadAffiliates();
    });
    this.loadAffiliates();
    this.loadFilterOptions();
  }

  private buildFilters(): AffiliateFilters {
    return {
      page: this.currentPage(),
      limit: this.pageSize(),
      name: this.filterName || undefined,
      cedula: this.filterCedula || undefined,
      reference: this.filterReference || undefined,
      advisor: this.filterAdvisor || undefined,
    };
  }

  loadAffiliates(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._service.getAffiliates(this.buildFilters()).subscribe({
      next: (res) => {
        this.affiliates.set(res.data);
        this.totalItems.set(res.total);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      },
    });
  }

  private loadFilterOptions(): void {
    this._service.getAdvisors().subscribe((list) => {
      this.advisorOptions.set(list.map((a) => ({ value: a.name, label: a.name })));
    });
    this._service.getReferences().subscribe((list) => {
      this.referenceOptions.set(list.map((r) => ({ value: r, label: r })));
    });
  }

  // Triggered by text filter inputs (debounced)
  onTextFilterChange(): void {
    this.filterSubject.next();
  }

  // Triggered by dropdown filter changes (immediate)
  onDropdownFilterChange(): void {
    this.currentPage.set(1);
    this.loadAffiliates();
  }

  clearFilters(): void {
    this.filterName = '';
    this.filterCedula = '';
    this.filterReference = '';
    this.filterAdvisor = '';
    this.currentPage.set(1);
    this.loadAffiliates();
  }

  get hasActiveFilters(): boolean {
    return !!(this.filterName || this.filterCedula || this.filterReference || this.filterAdvisor);
  }

  // ── Paginación ────────────────────────────────────────────────────
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadAffiliates();
  }
  nextPage(): void { this.goToPage(this.currentPage() + 1); }
  previousPage(): void { this.goToPage(this.currentPage() - 1); }

  get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
      range.push(i);
    }
    return range;
  }

  // ── Acciones de la tabla ──────────────────────────────────────────
  openCreate(): void {
    this.formMode.set('create');
    this.selectedAffiliate.set(null);
    this.showFormModal.set(true);
  }

  openEdit(affiliate: AffiliateMember): void {
    this.formMode.set('edit');
    this.selectedAffiliate.set(affiliate);
    this.showFormModal.set(true);
  }

  openStatusToggle(affiliate: AffiliateMember): void {
    this.selectedAffiliate.set(affiliate);
    this.showStatusModal.set(true);
  }

  onFormSaved(): void {
    this.showFormModal.set(false);
    this.selectedAffiliate.set(null);
    this.loadAffiliates();
  }

  onFormClosed(): void {
    this.showFormModal.set(false);
    this.selectedAffiliate.set(null);
  }

  onStatusConfirmed(): void {
    this.showStatusModal.set(false);
    this.selectedAffiliate.set(null);
    this.loadAffiliates();
  }

  onStatusCancelled(): void {
    this.showStatusModal.set(false);
    this.selectedAffiliate.set(null);
  }

  // ── Utilidades ────────────────────────────────────────────────────
  formatDate(date?: string | Date): string {
    if (!date) return '—';
    if (typeof date === 'string') {
      const datePart = date.split('T')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return new Date(date).toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      timeZone: 'America/Bogota',
    });
  }

  get allAffiliatesForModal(): AffiliateMember[] {
    return this.affiliates();
  }
}
