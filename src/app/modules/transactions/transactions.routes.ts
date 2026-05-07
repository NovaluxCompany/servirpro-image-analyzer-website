import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { TransactionsListComponent } from './pages/transactions-list/transactions-list';
import { TransactionCreateComponent } from './pages/transaction-create/transaction-create';
import { TransactionDetailComponent } from './pages/transaction-detail/transaction-detail';

export const routes: Routes = [
  {
    path: '',
    component: TransactionsListComponent,
    canActivate: [LoginGuardian]
  },
  {
    path: 'crear',
    component: TransactionCreateComponent,
    canActivate: [LoginGuardian]
  },
  {
    path: ':id',
    component: TransactionDetailComponent,
    canActivate: [LoginGuardian]
  }
];
