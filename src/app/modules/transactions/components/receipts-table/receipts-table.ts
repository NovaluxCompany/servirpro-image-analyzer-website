import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Receipt } from '../../interfaces/receipt.interface';

@Component({
  selector: 'app-receipts-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './receipts-table.html'
})
export class ReceiptsTableComponent {
  receipts = input.required<Receipt[]>();
  
  averageVeracity = computed(() => {
    const receiptsWithVeracity = this.receipts().filter(r => r.veracityPercentage !== undefined);
    if (receiptsWithVeracity.length === 0) return 0;
    
    const sum = receiptsWithVeracity.reduce((acc, r) => acc + (r.veracityPercentage || 0), 0);
    return Math.round(sum / receiptsWithVeracity.length);
  });

  formatCurrency(amount?: number): string {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  }
}
