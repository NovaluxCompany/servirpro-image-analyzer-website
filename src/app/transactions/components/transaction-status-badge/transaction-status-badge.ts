import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-transaction-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (status() === 'pending') {
      <span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 rounded-full">
        <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
        Procesando
      </span>
    } @else if (status() === 'processed') {
      <span class="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
        Completado
      </span>
    }
  `
})
export class TransactionStatusBadgeComponent {
  status = input.required<'pending' | 'processed'>();
}
