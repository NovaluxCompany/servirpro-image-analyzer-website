import { inject, Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { ToastService } from './toast.service';

/**
 * Permisos de acción disponibles en la aplicación.
 */
export type Permission =
  | 'affiliate:create'
  | 'affiliate:edit-active'
  | 'affiliate:edit-inactive'
  | 'affiliate:enable'
  | 'affiliate:disable'
  | 'transaction:create'
  | 'transaction:edit'
  | 'transaction:disable'
  | 'excel:download';

/**
 * Acceso a rutas por rol (independiente de menuPaths en BD).
 * Garantiza que cada rol pueda acceder a sus módulos incluso si
 * la BD no tiene la ruta configurada en menuPaths.
 */
const ROUTE_ACCESS_BY_ROLE: Record<string, string[]> = {
  admin:             ['transacciones', 'afiliados', 'menu', 'roles'],
  administrador:     ['transacciones', 'afiliados', 'menu', 'roles'],
  asesor:            ['transacciones', 'afiliados'], // visualiza afiliados (sin modificar)
  pagos:             ['transacciones'],          // solo módulo de pagos; /afiliados está bloqueado
  'cargar-afiliados':['afiliados'],
};

/**
 * Mapa de permisos por rol (comparación en minúsculas).
 *
 * Roles:
 *   admin / administrador → acceso total
 *   asesor               → solo crear transacciones (cargar pagos)
 *   pagos                → activar/desactivar afiliados; ver y exportar transacciones
 *   cargar-afiliados     → crear/editar afiliados inactivos y activarlos
 */
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'affiliate:create',
    'affiliate:edit-active',
    'affiliate:edit-inactive',
    'affiliate:enable',
    'affiliate:disable',
    'transaction:create',
    'transaction:edit',
    'transaction:disable',
    'excel:download',
  ],
  administrador: [
    'affiliate:create',
    'affiliate:edit-active',
    'affiliate:edit-inactive',
    'affiliate:enable',
    'affiliate:disable',
    'transaction:create',
    'transaction:edit',
    'transaction:disable',
    'excel:download',
  ],
  // Asesor: carga pagos (Excel) y visualiza afiliados. No puede modificar nada.
  asesor: [
    'excel:download',
  ],
  // Pagos: solo deshabilitar afiliados activos + ver/descargar transacciones.
  pagos: [
    'affiliate:disable',
    'excel:download',
  ],
  // Cargar afiliados: crear, editar inactivos y habilitarlos. Sin deshabilitar ni Excel.
  'cargar-afiliados': [
    'affiliate:create',
    'affiliate:edit-inactive',
    'affiliate:enable',
  ],
};

/**
 * Mensajes de error descriptivos para el usuario cuando no tiene permiso.
 */
const PERMISSION_MESSAGES: Record<Permission, string> = {
  'affiliate:create':       'Tu rol no tiene permiso para crear afiliados.',
  'affiliate:edit-active':  'Solo el Administrador puede editar afiliados que ya están activos.',
  'affiliate:edit-inactive':'Tu rol no tiene permiso para editar afiliados inactivos.',
  'affiliate:enable':       'Tu rol no tiene permiso para activar afiliados.',
  'affiliate:disable':      'Tu rol no tiene permiso para desactivar afiliados.',
  'transaction:create':     'Tu rol no tiene permiso para crear transacciones.',
  'transaction:edit':       'Solo el Administrador puede editar o revertir transacciones.',
  'transaction:disable':    'Solo el Administrador puede inhabilitar transacciones.',
  'excel:download':         'Tu rol no tiene permiso para descargar reportes en Excel.',
};

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private _tokenService = inject(TokenService);
  private _toastService = inject(ToastService);

  /**
   * Devuelve true si el usuario tiene el permiso solicitado.
   * Si el usuario no tiene roles asignados (modo bootstrap), concede todo.
   */
  can(permission: Permission): boolean {
    const user = this._tokenService.getUser();
    if (!user) return false;

    // Sin roles configurados → acceso total (modo bootstrap / admin sin restricciones)
    const roles: string[] = user.roles ?? [];
    if (roles.length === 0) return true;

    return roles.some((role) => {
      const normalized = role.toLowerCase().trim().replace(/[\s_]+/g, '-');
      return ROLE_PERMISSIONS[normalized]?.includes(permission) ?? false;
    });
  }

  /**
   * Verifica el permiso y muestra un toast de error si no lo tiene.
   * Retorna true si tiene acceso, false en caso contrario.
   */
  check(permission: Permission): boolean {
    if (this.can(permission)) return true;
    this._toastService.showError(PERMISSION_MESSAGES[permission]);
    return false;
  }

  /**
   * Verifica si el rol del usuario puede acceder a una ruta (primer segmento de URL).
   * Se usa como fallback en el roleGuard cuando menuPaths no cubre la ruta.
   */
  canAccessRoute(urlSegment: string): boolean {
    const user = this._tokenService.getUser();
    if (!user) return false;
    const roles: string[] = user.roles ?? [];
    if (roles.length === 0) return true;

    return roles.some((role) => {
      const normalized = role.toLowerCase().trim().replace(/[\s_]+/g, '-');
      return ROUTE_ACCESS_BY_ROLE[normalized]?.includes(urlSegment) ?? false;
    });
  }
}
