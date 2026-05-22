import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { AffiliatesListComponent } from './pages/affiliates-list/affiliates-list';

export const affiliatesRoutes: Routes = [
  {
    path: '',
    component: AffiliatesListComponent,
    canActivate: [LoginGuardian, roleGuard]
  },
];
