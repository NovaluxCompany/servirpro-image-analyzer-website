import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { TransactionsService } from '../../services/transactions.service';
import { Transaction } from '../../interfaces/transaction.interface';
import { TransactionStatusBadgeComponent } from '../../components/transaction-status-badge/transaction-status-badge';
import { ReceiptsTableComponent } from '../../components/receipts-table/receipts-table';

@Component({
  selector: 'app-transaction-detail',
  standalone: true,
  imports: [CommonModule, TransactionStatusBadgeComponent, ReceiptsTableComponent],
  templateUrl: './transaction-detail.html'
})
export class TransactionDetailComponent implements OnDestroy {
  private _transactionsService = inject(TransactionsService);
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);

  transaction = signal<Transaction | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  selectedImageUrl = signal<string | null>(null);
  showImageModal = signal(false);

  private pollingSubscription?: Subscription;

  ngOnInit(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTransaction(id);
    } else {
      this.errorMessage.set('ID de transacción no válido');
      this.isLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  loadTransaction(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this._transactionsService.getTransactionById(id).subscribe({
      next: (data) => {
        this.transaction.set(data);
        this.isLoading.set(false);

        // Iniciar polling si está pendiente
        if (data.status === 'pending') {
          this.startPolling(id);
        } else {
          this.stopPolling();
        }
      },
      error: (error) => {
        this.errorMessage.set(error.message);
        this.isLoading.set(false);
      }
    });
  }

  private startPolling(id: string): void {
    // Evitar múltiples suscripciones
    this.stopPolling();

    // Polling cada 5 segundos mientras esté pendiente
    this.pollingSubscription = interval(5000)
      .pipe(
        switchMap(() => this._transactionsService.getTransactionById(id)),
        takeWhile(transaction => transaction.status === 'pending', true)
      )
      .subscribe({
        next: (data) => {
          this.transaction.set(data);
          if (data.status === 'processed') {
            this.stopPolling();
          }
        },
        error: (error) => {
          console.error('Error en polling:', error);
          this.stopPolling();
        }
      });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }

  refreshTransaction(): void {
    const id = this._route.snapshot.paramMap.get('id');
    if (id) {
      this.loadTransaction(id);
    }
  }

  goBack(): void {
    this._router.navigate(['/transacciones']);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  openImageModal(imageBase64: string): void {
    this.selectedImageUrl.set(`data:image/jpeg;base64,${imageBase64}`);
    this.showImageModal.set(true);
  }

  closeImageModal(): void {
    this.showImageModal.set(false);
    this.selectedImageUrl.set(null);
  }

  getTotalPrice(): number {
    const transaction = this.transaction();
    if (!transaction) return 0;
    return transaction.affiliates.reduce((sum, aff) => sum + aff.price, 0);
  }
}
