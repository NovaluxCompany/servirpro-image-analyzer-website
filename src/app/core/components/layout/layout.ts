import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TokenService } from '../../service/token.service';
import { PermissionService } from '../../service/permission.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './layout.html'
})
export class LayoutComponent {
  private _router = inject(Router);
  private _tokenService = inject(TokenService);
  private _permission = inject(PermissionService);

  isSidebarOpen = signal(true);
  currentRoute = signal('');

  // User info from session
  currentUser = computed(() => this._tokenService.getUser());
  userName = computed(() => this.currentUser()?.name ?? 'Usuario');
  userRole = computed(() => this.currentUser()?.roles?.[0] ?? 'Sin rol');

  // Menu visibility: muestra el item si está en menuPaths del usuario,
  // o si el rol tiene acceso según PermissionService (cubre rutas que el backend
  // no tiene correctamente configuradas, como /usuarios → /afiliados en Pagos).
  canSee = (path: string): boolean => {
    const menuPaths = this.currentUser()?.menuPaths ?? [];
    if (menuPaths.length === 0) return true; // sin restricciones = mostrar todo
    return this._permission.canAccessRoute(path);
  };

  // Role-based visibility
  isAdmin = computed(() =>
    this.currentUser()?.roles?.some(r => r.toLowerCase() === 'administrador' || r.toLowerCase() === 'admin') ?? false
  );

  isPaymentsOrAdmin = computed(() => {
    const roles = this.currentUser()?.roles ?? [];
    const normalized = roles.map(r => r.toLowerCase().trim());
    return normalized.includes('pagos') || normalized.includes('administrador') || normalized.includes('admin');
  });

  constructor() {
    this.updateCurrentRoute();
  }

  toggleSidebar(): void {
    this.isSidebarOpen.set(!this.isSidebarOpen());
  }

  logout(): void {
    this._tokenService.removeToken();
    this._tokenService.clearUser();
    this._router.navigate(['/login']);
  }

  isActiveRoute(route: string): boolean {
    return this._router.url.includes(route);
  }

  private updateCurrentRoute(): void {
    this._router.events.subscribe(() => {
      this.currentRoute.set(this._router.url);
    });
  }
}
