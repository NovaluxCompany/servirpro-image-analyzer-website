import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { TokenService } from '../service/token.service';
import { ToastService } from '../service/toast.service';
import { AuthService } from '../service/auth.service';

const normalizePath = (path: string): string => {
  const cleaned = (path ?? '').split('?')[0].split('#')[0].trim();
  if (!cleaned) return '/';

  const normalized = cleaned.startsWith('/') ? cleaned.toLowerCase() : `/${cleaned.toLowerCase()}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

/**
 * Guard basado en menuPaths (control desde la base de datos).
 *
 * Lógica: solo permite acceder a rutas que el usuario tenga asignadas en menuPaths.
 * Si el usuario no tiene ningún menuPath (rol sin permisos configurados), no accede a nada.
 *
 * La seguridad real se aplica en el backend (@Roles en los controladores NestJS).
 * Este guard además maneja la UX: redirige al usuario si intenta acceder a una ruta
 * que no tiene asignada en su perfil.
 */
export const roleGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const tokenService = inject(TokenService);
  const toastService = inject(ToastService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!tokenService.getUser()) {
    router.navigate(['/']);
    return false;
  }

  // Refresca roles/menús/permisos contra el backend en background, sin bloquear
  // la navegación actual (que evalúa con lo que ya está en caché). Así, cambios
  // hechos en "asignar permisos" quedan reflejados desde la siguiente navegación,
  // sin requerir un nuevo login y sin que cada click espere una respuesta de red.
  authService.refreshUser().subscribe();

  return evaluateAccess(state, tokenService, toastService, router);
};

function evaluateAccess(
  state: RouterStateSnapshot,
  tokenService: TokenService,
  toastService: ToastService,
  router: Router
): boolean {
  const user = tokenService.getUser();

  if (!user) {
    router.navigate(['/']);
    return false;
  }

  const menuPaths: string[] = user.menuPaths ?? [];
  const currentPath = normalizePath(state.url);

  // check: menuPaths de la BD
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

  // Si no hay URL anterior (primera carga), redirigir a la primera ruta de nivel raíz
  // (un solo segmento) que el usuario tenga permitida en BD; /menu es administrativo
  // y nunca debe usarse como destino. Si no tiene ninguna ruta raíz navegable
  // (ej. solo tiene permisos en sub-rutas/hijos), se manda al login.
  const fallback = menuPaths
    .map((p) => normalizePath(p))
    .find((path) => path !== '/' && path !== '/menu' && path.split('/').filter(Boolean).length === 1)
    ?? '/login';
  router.navigate([fallback]);
  return false;
};
