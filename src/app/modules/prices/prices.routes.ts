import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { PricesPageComponent } from './pages/prices-page/prices-page';

export const pricesRoutes: Routes = [
  {
    path: '',
    component: PricesPageComponent,
    canActivate: [LoginGuardian, roleGuard],
  },
];
