import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TransactionsService } from '../../services/transactions.service';
import { Transaction } from '../../interfaces/transaction.interface';
import { TransactionFilters } from '../../interfaces/transaction-filters.interface';
import { TransactionFiltersComponent } from '../../components/transaction-filters/transaction-filters';
import { TransactionTableComponent } from '../../components/transaction-table/transaction-table';
import { ToastService } from '../../../core/service/toast.service';

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

  transactions = signal<Transaction[]>([]);
  isLoading = signal(false);
  isDownloadingExcel = signal(false);
  errorMessage = signal<string | null>(null);
  currentFilters?: TransactionFilters;

  ngOnInit(): void {
    this.loadTransactions();
    
    // Mostrar mensaje de éxito si viene de creación
    const navigation = this._router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    if (state?.['successMessage']) {
      this._toastService.showSuccess(state['successMessage']);
    }
  }

  loadTransactions(filters?: TransactionFilters): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._transactionsService.getTransactions(filters).subscribe({
      next: (data) => {
        this.transactions.set(data);
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
    this.loadTransactions(filters);
  }

  downloadExcel(): void {
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
        this.errorMessage.set(error.message);
        this.isDownloadingExcel.set(false);
        this._toastService.showError('Error al descargar el Excel');
      }
    });
  }

  onViewDetail(id: string): void {
    this._router.navigate(['/transacciones', id]);
  }

  onCreateTransaction(): void {
    this._router.navigate(['/transacciones/crear']);
  }
}
