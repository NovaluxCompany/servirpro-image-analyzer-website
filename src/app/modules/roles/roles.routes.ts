import { Routes } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { RoleListComponent } from './pages/role-list/role-list.component';

export const rolesRoutes: Routes = [
  {
    path: '',
    component: RoleListComponent,
    canActivate: [LoginGuardian, roleGuard]
  }
];
