import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TokenService } from '../service/token.service';
import { ToastService } from '../service/toast.service';
import { PermissionService } from '../service/permission.service';

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
  const permissionService = inject(PermissionService);
  const router = inject(Router);

  const user = tokenService.getUser();

  if (!user) {
    router.navigate(['/']);
    return false;
  }

  const menuPaths: string[] = user.menuPaths ?? [];

  // Sin menuPaths configurados → acceso total (bootstrap o admin sin restricciones aún)
  if (menuPaths.length === 0) return true;

  // Extraer el primer segmento del path de la URL actual
  const segment = state.url.split('/')[1]?.split('?')[0] ?? '';
  const currentBase = '/' + segment;

  // 1º check: menuPaths de la BD
  // Normalizamos cada path al primer segmento para comparar solo la raíz,
  // independientemente de si la BD guarda '/afiliados', 'afiliados' o '/afiliados/lista'.
  const hasMenuAccess = menuPaths.some((p) => {
    const pBase = '/' + p.replace(/^\//, '').split('/')[0];
    return currentBase === pBase || currentBase.startsWith(pBase + '/');
  });

  // 2º check: acceso por rol definido en PermissionService (fallback si BD no está configurada)
  const hasRoleAccess = permissionService.canAccessRoute(segment);

  if (hasMenuAccess || hasRoleAccess) return true;

  // Informar al usuario por qué no puede acceder a esta ruta
  toastService.showError('Tu rol no tiene acceso a esta sección.');

  // Redirigir al primer path válido (existe en el router Angular + accesible para el rol)
  const KNOWN_ROUTES = ['/transacciones', '/afiliados', '/menu', '/roles'];

  const validFromMenu = menuPaths
    .map(p => '/' + p.split('/').filter(Boolean)[0])
    .find(seg => KNOWN_ROUTES.includes(seg));

  const validFromRole = KNOWN_ROUTES
    .find(r => permissionService.canAccessRoute(r.replace('/', '')));

  const fallback = validFromMenu ?? validFromRole ?? '/';
  router.navigate([fallback]);
  return false;
};
