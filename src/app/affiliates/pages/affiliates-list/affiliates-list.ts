import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AffiliateMembersService } from '../../services/affiliate-members.service';
import { AffiliateMember } from '../../interfaces/affiliate-member.interface';
import { AffiliateFormModalComponent } from '../../components/affiliate-form-modal/affiliate-form-modal';
import { AffiliateStatusModalComponent } from '../../components/affiliate-status-modal/affiliate-status-modal';
import { ToastService } from '../../../core/service/toast.service';

@Component({
  selector: 'app-affiliates-list',
  standalone: true,
  imports: [CommonModule, AffiliateFormModalComponent, AffiliateStatusModalComponent],
  templateUrl: './affiliates-list.html',
})
export class AffiliatesListComponent implements OnInit {
  private _service = inject(AffiliateMembersService);
  private _toast = inject(ToastService);

  readonly pageSize = 10;

  fullAffiliates = signal<AffiliateMember[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  currentPage = signal(1);
  pageSizeSignal = signal(10);

  // Paginación local calculada
  affiliates = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSizeSignal();
    const end = start + this.pageSizeSignal();
    return this.fullAffiliates().slice(start, end);
  });

  totalPages = computed(() => Math.ceil(this.fullAffiliates().length / this.pageSizeSignal()));
  totalItems = computed(() => this.fullAffiliates().length);

  // Modales
  showFormModal = signal(false);
  showStatusModal = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  selectedAffiliate = signal<AffiliateMember | null>(null);

  ngOnInit(): void {
    this.loadAffiliates();
  }

  loadAffiliates(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this._service.getAffiliates().subscribe({
      next: (data) => {
        const sorted = [...data].sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          if (dateB !== dateA) return dateB - dateA;
          // Desempate por id descendente (mayor id = más reciente)
          return Number(b.id ?? 0) - Number(a.id ?? 0);
        });
        this.fullAffiliates.set(sorted);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message);
        this.isLoading.set(false);
      },
    });
  }

  // ── Paginación ────────────────────────────────────────────────────
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
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
  formatDate(date?: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  }

  formatCurrency(value?: number): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency', currency: 'COP', minimumFractionDigits: 0,
    }).format(value);
  }
}
