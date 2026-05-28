import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TokenService } from '../service/token.service';
import { ToastService } from '../service/toast.service';

const normalizePath = (path: string): string => {
  const cleaned = (path ?? '').split('?')[0].split('#')[0].trim();
  if (!cleaned) return '/';

  const normalized = cleaned.startsWith('/') ? cleaned.toLowerCase() : `/${cleaned.toLowerCase()}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

/**
 * Guard basado en menuPaths (control desde la base de datos).
 *
 * Lógica:
 *   1. Si menuPaths: [] → modo bootstrap / sin restricciones configuradas → permite todo.
 *   2. Si menuPaths tiene rutas → solo permite acceder a rutas que el usuario tenga asignadas.
 *
 * La seguridad real se aplica en el backend (@Roles en los controladores NestJS).
 * Este guard solo maneja la UX: redirige al usuario si intenta acceder a una ruta
 * que no tiene asignada en su perfil.
 */
export const roleGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const tokenService = inject(TokenService);
  const toastService = inject(ToastService);
  const router = inject(Router);

  const user = tokenService.getUser();

  if (!user) {
    router.navigate(['/']);
    return false;
  }

  const menuPaths: string[] = user.menuPaths ?? [];

  // Sin menuPaths configurados → acceso total (bootstrap o admin sin restricciones aún)
  if (menuPaths.length === 0) return true;

  const currentPath = normalizePath(state.url);

  // 1º check: menuPaths de la BD
  const hasMenuAccess = menuPaths.some((p) => {
    const allowedPath = normalizePath(p);
    return currentPath === allowedPath || currentPath.startsWith(allowedPath + '/');
  });

  if (hasMenuAccess) return true;

  // Informar al usuario por qué no puede acceder a esta ruta
  toastService.showError('Tu rol no tiene acceso a esta sección.');

  // Intentar volver a la URL anterior donde el usuario ya estaba
  const previousUrl =
    router.getCurrentNavigation()?.previousNavigation?.finalUrl?.toString();

  if (previousUrl) {
    router.navigate([previousUrl]);
    return false;
  }

  // Si no hay URL anterior (primera carga), redirigir al primer menu permitido en BD
  const fallback = menuPaths
    .map((p) => normalizePath(p))
    .find((path) => path !== '/') ?? '/';
  router.navigate([fallback]);
  return false;
};
