import { inject } from '@angular/core';
import { Routes, Router } from '@angular/router';
import { LoginGuardian } from '../../core/guard/login-guard';
import { roleGuard } from '../../core/guard/role.guard';
import { ToastService } from '../../core/service/toast.service';
import { TokenService } from '../../core/service/token.service';
import { DeactivateAffiliatesList } from './pages/deactivate-affiliates-list';

const canAccessDeactivateAffiliates = () => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const userRoles = tokenService.getUser()?.roles ?? [];
  const normalizedRoles = userRoles.map((role) => role.trim().toLowerCase());
  const hasAccess = normalizedRoles.includes('pagos') || normalizedRoles.includes('administrador') || normalizedRoles.includes('admin');

  if (hasAccess) return true;

  toast.showError('Solo los roles Pagos y Administrador pueden acceder a esta sección.');
  router.navigate(['/']);
  return false;
};

export const deactivateAffiliatesRoutes: Routes = [
  {
    path: '',
    component: DeactivateAffiliatesList,
    canActivate: [LoginGuardian, roleGuard, canAccessDeactivateAffiliates],
  },
];
