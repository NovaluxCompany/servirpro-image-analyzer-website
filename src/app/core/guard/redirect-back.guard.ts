import { inject } from '@angular/core';
import { CanActivateFn, Route, Router } from '@angular/router';
import { TokenService } from '../service/token.service';
import { PermissionService } from '../service/permission.service';

const normalizePath = (path: string): string => {
  const cleaned = (path ?? '').trim();
  if (!cleaned) return '';

  const normalized = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized;
};

const collectConfiguredRoutes = (routes: readonly Route[], prefix = ''): string[] => {
  return routes.flatMap((route) => {
    const routePath = (route.path ?? '').trim();
    const nextPrefix = routePath && routePath !== '**'
      ? normalizePath(`${prefix}/${routePath}`)
      : prefix;

    const childRoutes = route.children?.length
      ? collectConfiguredRoutes(route.children, nextPrefix)
      : [];

    if (!routePath || routePath === '**') {
      return childRoutes;
    }

    return [nextPrefix, ...childRoutes];
  });
};

/**
 * Guard para rutas no encontradas (wildcard **).
 * Redirige al usuario a la URL anterior en lugar de mostrar una página en blanco.
 * Si no hay URL anterior pero el usuario está autenticado, lo lleva a la primera
 * ruta válida dentro del sistema. Solo va al login si no está autenticado.
 */
export const redirectBackGuard: CanActivateFn = () => {
  const router = inject(Router);
  const tokenService = inject(TokenService);
  const permissionService = inject(PermissionService);

  const previousUrl =
    router.getCurrentNavigation()?.previousNavigation?.finalUrl?.toString();

  if (previousUrl) {
    return router.createUrlTree([previousUrl]);
  }

  const user = tokenService.getUser();

  if (!user) {
    return router.createUrlTree(['/']);
  }

  // El usuario está autenticado pero llegó directo a una URL inválida:
  // redirigir a la primera ruta accesible dentro del sistema.
  const configuredRoutes = Array.from(new Set(
    collectConfiguredRoutes(router.config)
      .filter((path) => path !== '/' && path !== '/login')
  ));

  const candidatePaths = Array.from(new Set(
    [
      ...(user.menus ?? []).map((menu) => normalizePath(menu.path)),
      ...(user.menuPaths ?? []).map((path) => normalizePath(path)),
    ].filter(Boolean)
  ));

  const validFromMenu = candidatePaths
    .find((path) => configuredRoutes.includes(path) && permissionService.canAccessRoute(path));

  const validFromRole = configuredRoutes
    .find((path) => permissionService.canAccessRoute(path));

  return router.createUrlTree([validFromMenu ?? validFromRole ?? '/']);
};
