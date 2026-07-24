import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { BillingPeriodsListComponent } from './pages/billing-periods-list/billing-periods-list';

export const billingPeriodsRoutes: Routes = [
  {
    path: '',
    component: BillingPeriodsListComponent,
    canActivate: [LoginGuardian, roleGuard]
  },
];
