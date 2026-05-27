import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { PermissionService } from '../../core/service/permission.service';
import { ToastService } from '../../core/service/toast.service';
import { TransactionsListComponent } from './pages/transactions-list/transactions-list';
import { TransactionCreateComponent } from './pages/transaction-create/transaction-create';
import { TransactionDetailComponent } from './pages/transaction-detail/transaction-detail';

const canCreateTransaction = () => {
  const permission = inject(PermissionService);
  const router = inject(Router);
  const toast = inject(ToastService);
  if (permission.can('create')) return true;
  toast.showError('Tu rol no tiene permiso para crear transacciones.');
  router.navigate(['/transacciones']);
  return false;
};

export const routes: Routes = [
  {
    path: '',
    component: TransactionsListComponent,
    canActivate: [LoginGuardian, roleGuard]
  },
  {
    path: 'crear',
    component: TransactionCreateComponent,
    canActivate: [LoginGuardian, roleGuard, canCreateTransaction]
  },
  {
    path: ':id',
    component: TransactionDetailComponent,
    canActivate: [LoginGuardian, roleGuard]
  }
];
