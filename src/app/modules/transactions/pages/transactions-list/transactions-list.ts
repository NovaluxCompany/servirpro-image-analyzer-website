import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TransactionsService } from '../../services/transactions.service';
import { Transaction } from '../../interfaces/transaction.interface';
import { TransactionFilters } from '../../interfaces/transaction-filters.interface';
import { TransactionFiltersComponent } from '../../components/transaction-filters/transaction-filters';
import { TransactionTableComponent } from '../../components/transaction-table/transaction-table';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';

@Component({
  selector: 'app-transactions-list',
  standalone: true,
  imports: [CommonModule, TransactionFiltersComponent, TransactionTableComponent],
  templateUrl: './transactions-list.html'
})
export class TransactionsListComponent {
  private _transactionsService = inject(TransactionsService);
  private _router = inject(Router);
  private _toastService = inject(ToastService);
  private _permission = inject(PermissionService);

  readonly pageSize = 10;

  transactions = signal<Transaction[]>([]);
  isLoading = signal(false);
  isDownloadingExcel = signal(false);
  errorMessage = signal<string | null>(null);
  currentFilters?: TransactionFilters;

  currentPage = signal(1);
  totalPages = signal(0);
  totalItems = signal(0);

  ngOnInit(): void {
    this.loadTransactions();

    // Mostrar mensaje de éxito si viene de creación
    const navigation = this._router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    if (state?.['successMessage']) {
      this._toastService.showSuccess(state['successMessage']);
    }
  }

  loadTransactions(filters?: TransactionFilters, page: number = this.currentPage()): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._transactionsService.getPaginatedTransactions(filters, page, this.pageSize).subscribe({
      next: (response) => {
        this.transactions.set(response.data);
        this.currentPage.set(response.page);
        this.totalPages.set(response.totalPages);
        this.totalItems.set(response.total);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.message);
        this.isLoading.set(false);
      }
    });
  }

  onFilterApplied(filters: TransactionFilters): void {
    this.currentFilters = filters;
    this.currentPage.set(1);
    this.loadTransactions(filters, 1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadTransactions(this.currentFilters, page);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const delta = 2;
    const range: number[] = [];
    const start = Math.max(1, current - delta);
    const end = Math.min(total, current + delta);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }

  onCreateTransaction(): void {
    if (!this._permission.check('transaction:create')) return;
    this._router.navigate(['/transacciones/crear']);
  }

  downloadExcel(): void {
    if (!this._permission.check('excel:download')) return;
    this.isDownloadingExcel.set(true);
    this.errorMessage.set(null);

    this._transactionsService.exportToExcel(this.currentFilters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `transacciones_${timestamp}.xlsx`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        this.isDownloadingExcel.set(false);
        this._toastService.showSuccess('Excel descargado exitosamente');
      },
      error: (error) => {
        this.isDownloadingExcel.set(false);
        if (error.status === 403) {
          this._toastService.showError('No tienes permiso para descargar el reporte en Excel. Contacta al administrador.');
        } else if (error.status === 401) {
          this._toastService.showError('Tu sesión ha expirado. Inicia sesión nuevamente.');
        } else {
          const msg = error?.error?.message ?? error?.error?.error ?? 'Error al descargar el Excel. Intenta de nuevo.';
          this._toastService.showError(msg);
        }
      }
    });
  }

  onViewDetail(id: string): void {
    this._router.navigate(['/transacciones', id]);
  }
}
