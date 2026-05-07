import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Transaction } from '../../interfaces/transaction.interface';
import { TransactionStatusBadgeComponent } from '../transaction-status-badge/transaction-status-badge';

@Component({
  selector: 'app-transaction-table',
  standalone: true,
  imports: [CommonModule, TransactionStatusBadgeComponent],
  templateUrl: './transaction-table.html'
})
export class TransactionTableComponent {
  transactions = input.required<Transaction[]>();
  isLoading = input<boolean>(false);
  viewDetail = output<string>();

  onViewDetail(id: string): void {
    this.viewDetail.emit(id);
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });
  }

  getAffiliatesCount(transaction: Transaction): number {
    return transaction.affiliates.length;
  }

  getAverageVeracity(transaction: Transaction): number {
    const receiptsWithVeracity = transaction.receipts.filter(r => r.veracityPercentage !== undefined);
    if (receiptsWithVeracity.length === 0) return 0;
    
    const sum = receiptsWithVeracity.reduce((acc, r) => acc + (r.veracityPercentage || 0), 0);
    return Math.round(sum / receiptsWithVeracity.length);
  }
}
