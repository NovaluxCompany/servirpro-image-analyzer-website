import { inject, Injectable } from '@angular/core';
import { TokenService } from './token.service';
import { ToastService } from './toast.service';
import { UserMenu } from '../interfaces/Response-login';

export type PermissionCode = string;

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private _tokenService = inject(TokenService);
  private _toastService = inject(ToastService);

  private normalize(value: string): string {
    return (value ?? '').toString().trim().toLowerCase();
  }

  private normalizePath(path: string): string {
    const p = (path ?? '').trim();
    if (!p) return '';
    return p.startsWith('/') ? p.toLowerCase() : `/${p.toLowerCase()}`;
  }

  private getUserMenus(): UserMenu[] {
    return this._tokenService.getUser()?.menus ?? [];
  }

  private hasPermissionOnPath(path: string, permissionCodes: PermissionCode[]): boolean {
    const targetPath = this.normalizePath(path);
    const targetPermissions = new Set(permissionCodes.map((p) => this.normalize(p)));
    const menus = this.getUserMenus();

    return menus.some((menu) => {
      const menuPath = this.normalizePath(menu.path);
      if (!(menuPath === targetPath || menuPath.startsWith(`${targetPath}/`))) return false;

      return (menu.permissions ?? []).some((perm) => targetPermissions.has(this.normalize(perm)));
    });
  }

  private getPathFromCurrentRoute(): string | null {
    const currentUrl = window.location.pathname || '/';
    const segment = currentUrl.split('/').filter(Boolean)[0];
    if (!segment) return null;
    return `/${segment}`;
  }

  private hasPathAccess(path: string): boolean {
    const targetPath = this.normalizePath(path);
    const user = this._tokenService.getUser();
    if (!user) return false;

    const menuPaths = (user.menuPaths ?? []).map((p) => this.normalizePath(p));
    if (menuPaths.some((p) => p === targetPath || p.startsWith(`${targetPath}/`))) {
      return true;
    }

    return this.getUserMenus().some((menu) => {
      const menuPath = this.normalizePath(menu.path);
      return menuPath === targetPath || menuPath.startsWith(`${targetPath}/`);
    });
  }

  /**
   * Evalua si el usuario tiene permiso sobre un menu/path.
   * Si no se envia path, usa el segmento actual de la ruta.
   */
  can(permission: PermissionCode | PermissionCode[], path?: string): boolean {
    const user = this._tokenService.getUser();
    if (!user) return false;

    const targetPath = path ? this.normalizePath(path) : this.getPathFromCurrentRoute();
    if (!targetPath) return false;

    const codes = Array.isArray(permission) ? permission : [permission];

    // Si backend ya envia menus con permissions, ese es el source of truth.
    if (this.getUserMenus().length > 0) {
      return this.hasPermissionOnPath(targetPath, codes);
    }

    // Fallback temporal: sin menus en payload, al menos valida acceso al modulo por menuPaths.
    return this.hasPathAccess(targetPath);
  }

  private buildDefaultMessage(codes: PermissionCode | PermissionCode[], path?: string): string {
    const action = Array.isArray(codes) ? codes.join(' / ') : codes;
    const location = path ? ` en ${path}` : '';
    return `No tienes permiso (${action})${location}.`;
  }

  /**
   * Verifica el permiso y muestra un toast de error si no lo tiene.
   * Retorna true si tiene acceso, false en caso contrario.
   */
  check(permission: PermissionCode | PermissionCode[], path?: string, message?: string): boolean {
    if (this.can(permission, path)) return true;
    this._toastService.showError(message ?? this.buildDefaultMessage(permission, path));
    return false;
  }

  /**
   * Verifica si el rol del usuario puede acceder a una ruta (primer segmento de URL).
   * Se usa como fallback en el roleGuard cuando menuPaths no cubre la ruta.
   */
  canAccessRoute(urlSegment: string): boolean {
    const currentBase = this.normalizePath(urlSegment);
    if (!currentBase) return false;
    return this.hasPathAccess(currentBase);
  }
}
