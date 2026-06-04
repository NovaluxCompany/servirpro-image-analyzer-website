import { Component, HostListener, effect, input, output, signal } from '@angular/core';
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
  canDisable = input<boolean>(false);
  disableInProgress = input<boolean>(false);
  disablingTransactionId = input<string | null>(null);
  disabledTransactionId = input<string | null>(null);
  viewDetail = output<string>();
  disableTransaction = output<string>();

  // ── Dropdown acciones ─────────────────────────────────────────────
  openDropdownId = signal<string | null>(null);
  dropdownPos = signal<{ top: number; left: number }>({ top: 0, left: 0 });

  constructor() {
    effect(() => {
      const disabledId = this.disabledTransactionId();
      const pendingId = this.pendingDisableId();

      if (disabledId && pendingId && disabledId === pendingId) {
        this.showConfirmModal.set(false);
        this.pendingDisableId.set(null);
      }
    });
  }

  toggleDropdown(id: string, buttonEl: HTMLElement): void {
    if (this.openDropdownId() === id) {
      this.openDropdownId.set(null);
      return;
    }
    const rect = buttonEl.getBoundingClientRect();
    this.dropdownPos.set({ top: rect.bottom + 4, left: rect.left });
    this.openDropdownId.set(id);
  }

  closeDropdown(): void {
    this.openDropdownId.set(null);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openDropdownId.set(null);
  }

  onViewDetail(id: string): void {
    this.closeDropdown();
    this.viewDetail.emit(id);
  }

  // ── Confirmación inhabilitar ──────────────────────────────────────
  showConfirmModal = signal(false);
  pendingDisableId = signal<string | null>(null);

  get pendingTransaction() {
    const id = this.pendingDisableId();
    if (!id) return null;
    return this.transactions().find(t => t._id === id) ?? null;
  }

  requestDisable(id: string): void {
    this.closeDropdown();
    this.pendingDisableId.set(id);
    this.showConfirmModal.set(true);
  }

  confirmDisable(): void {
    const id = this.pendingDisableId();
    if (!id) return;
    this.disableTransaction.emit(id);
  }

  cancelDisable(): void {
    this.showConfirmModal.set(false);
    this.pendingDisableId.set(null);
  }

  onDisableTransaction(id: string): void {
    this.closeDropdown();
    this.disableTransaction.emit(id);
  }

  get isPendingDisableLoading(): boolean {
    return this.disableInProgress() && this.disablingTransactionId() === this.pendingDisableId();
  }

  get actionLabel(): string {
    return 'deshabilitar';
  }

  get title(): string {
    return 'Desactivar Pago';
  }

  get confirmMessage(): string {
    const transaction = this.pendingTransaction;
    if (!transaction) return '';
    return `¿Está seguro de ${this.actionLabel} el pago con referencia ${transaction.reference}?`;
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
