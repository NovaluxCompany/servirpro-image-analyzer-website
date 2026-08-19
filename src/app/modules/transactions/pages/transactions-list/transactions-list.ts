import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TransactionsService } from '../../services/transactions.service';
import { Transaction } from '../../interfaces/transaction.interface';
import { TransactionFilters } from '../../interfaces/transaction-filters.interface';
import { TransactionFiltersComponent } from '../../components/transaction-filters/transaction-filters';
import { TransactionTableComponent } from '../../components/transaction-table/transaction-table';
import { ExportExcelModalComponent } from '../../components/export-excel-modal/export-excel-modal';
import { PlansManagerModalComponent } from '../../components/plans-manager-modal/plans-manager-modal';
import { ToastService } from '../../../../core/service/toast.service';
import { PermissionService } from '../../../../core/service/permission.service';

@Component({
  selector: 'app-transactions-list',
  standalone: true,
  imports: [CommonModule, TransactionFiltersComponent, TransactionTableComponent, ExportExcelModalComponent, PlansManagerModalComponent],
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
  isDisablingTransaction = signal(false);
  disablingTransactionId = signal<string | null>(null);
  disabledTransactionId = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  isPermissionError = signal(false);
  currentFilters?: TransactionFilters;
  showExportModal = signal(false);
  showPlansModal = signal(false);

  currentPage = signal(1);
  totalPages = signal(0);
  totalItems = signal(0);

  transactionsLocked = signal(false);
  isTogglingLock = signal(false);

  ngOnInit(): void {
    this.loadTransactions();
    this.loadLockStatus();

    // Mostrar mensaje de éxito si viene de creación
    const navigation = this._router.getCurrentNavigation();
    const state = navigation?.extras?.state || history.state;
    if (state?.['successMessage']) {
      this._toastService.showSuccess(state['successMessage']);
    }
  }

  get canLockTransactions(): boolean {
    return this._permission.can('lock', '/transacciones');
  }

  loadLockStatus(): void {
    this._transactionsService.getLockStatus().subscribe({
      next: (res) => this.transactionsLocked.set(res.locked),
      // Si falla la consulta (ej. rol sin acceso al menú), se asume desbloqueado
      // para no ocultar el flujo normal a nadie por un error de red.
      error: () => this.transactionsLocked.set(false),
    });
  }

  toggleTransactionsLock(): void {
    if (!this.canLockTransactions) {
      this._toastService.showError('No tienes permiso para bloquear/desbloquear transacciones.');
      return;
    }

    const next = !this.transactionsLocked();
    this.isTogglingLock.set(true);

    this._transactionsService.setLockStatus(next).subscribe({
      next: (res) => {
        this.transactionsLocked.set(res.locked);
        this.isTogglingLock.set(false);
        this._toastService.showSuccess(
          res.locked
            ? 'Transacciones bloqueadas: nadie podrá crear nuevos pagos hasta que las desbloquees.'
            : 'Transacciones desbloqueadas.',
        );
      },
      error: (error) => {
        this.isTogglingLock.set(false);
        this._toastService.showError(error?.message ?? 'Error al cambiar el bloqueo de transacciones.');
      },
    });
  }

  loadTransactions(filters?: TransactionFilters, page: number = this.currentPage()): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.isPermissionError.set(false);

    this._transactionsService.getPaginatedTransactions(filters, page, this.pageSize).subscribe({
      next: (response) => {
        this.transactions.set(response.data);
        this.currentPage.set(response.page);
        this.totalPages.set(response.totalPages);
        this.totalItems.set(response.total);
        this.isLoading.set(false);
      },
      error: (error: Error & { status?: number }) => {
        if (error.status === 403) {
          this.isPermissionError.set(true);
        } else {
          this.errorMessage.set(error.message);
        }
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
    if (!this._permission.check('create', '/transacciones', 'Tu rol no tiene permiso para crear transacciones.')) return;
    if (this.transactionsLocked()) {
      this._toastService.showError('La creación de transacciones está bloqueada temporalmente por el administrador.');
      return;
    }
    this._router.navigate(['/transacciones/crear']);
  }

  onManagePlans(): void {
    if (!this._permission.check('edit', '/transacciones', 'Tu rol no tiene permiso para gestionar planes.')) return;
    this.showPlansModal.set(true);
  }

  downloadExcel(): void {
    if (!this._permission.check('export', undefined, 'Tu rol no tiene permiso para descargar reportes en Excel.')) return;
    this.showExportModal.set(true);
  }

  onExportCancelled(): void {
    this.showExportModal.set(false);
  }

  onExportConfirmed(range: { dateFrom: string; dateTo: string }): void {
    this.isDownloadingExcel.set(true);
    this.errorMessage.set(null);
    this._toastService.showInfo('Descarga en proceso...');

    const filters: TransactionFilters = { ...this.currentFilters, dateFrom: range.dateFrom, dateTo: range.dateTo };

    this._transactionsService.exportToExcel(filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;

        link.download = `transacciones_${range.dateFrom}_a_${range.dateTo}.xlsx`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        this.isDownloadingExcel.set(false);
        this.showExportModal.set(false);
        this._toastService.showSuccess('Excel descargado exitosamente');
      },
      error: (error) => {
        this.isDownloadingExcel.set(false);
        this._toastService.showError(error?.message ?? 'Error al descargar el Excel. Intenta de nuevo.');
      }
    });
  }

  onViewDetail(id: string): void {
    this._router.navigate(['/transacciones', id]);
  }

  get canDisableTransactions(): boolean {
    return this._permission.can('delete', '/transacciones');
  }

  onDisableTransaction(id: string): void {
    if (!this.canDisableTransactions) {
      this._toastService.showError('No tienes permiso para inhabilitar transacciones.');
      return;
    }

    this.isDisablingTransaction.set(true);
    this.disablingTransactionId.set(id);
    this.disabledTransactionId.set(null);

    this._transactionsService.setTransactionActive(id, false).subscribe({
      next: () => {
        this.isDisablingTransaction.set(false);
        this.disablingTransactionId.set(null);
        this.disabledTransactionId.set(id);
        this._toastService.showSuccess('Pago inhabilitado correctamente');
        this.loadTransactions(this.currentFilters, this.currentPage());
      },
      error: () => {
        this.isDisablingTransaction.set(false);
        this.disablingTransactionId.set(null);
        this.disabledTransactionId.set(null);
        this._toastService.showError('Error al inhabilitar el pago');
      }
    });
  }
}
