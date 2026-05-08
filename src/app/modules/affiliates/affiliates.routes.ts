import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { AffiliatesListComponent } from './pages/affiliates-list/affiliates-list';

export const affiliatesRoutes: Routes = [
  {
    path: '',
    component: AffiliatesListComponent,
    canActivate: [LoginGuardian],
  },
];
