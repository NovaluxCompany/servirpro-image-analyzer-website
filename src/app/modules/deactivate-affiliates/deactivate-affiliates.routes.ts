import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { DeactivateAffiliatesList } from './pages/deactivate-affiliates-list';

export const deactivateAffiliatesRoutes: Routes = [
  {
    path: '',
    component: DeactivateAffiliatesList,
    canActivate: [LoginGuardian, roleGuard],
  },
];
