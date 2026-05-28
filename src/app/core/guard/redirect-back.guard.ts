import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenService } from '../service/token.service';
import { PermissionService } from '../service/permission.service';

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
  const KNOWN_ROUTES = ['/transacciones', '/afiliados', '/menu', '/roles'];
  const menuPaths: string[] = user.menuPaths ?? [];

  const validFromMenu = menuPaths
    .map(p => '/' + p.split('/').filter(Boolean)[0])
    .find(seg => KNOWN_ROUTES.includes(seg));

  const validFromRole = KNOWN_ROUTES
    .find(r => permissionService.canAccessRoute(r.replace('/', '')));

  return router.createUrlTree([validFromMenu ?? validFromRole ?? '/']);
};
