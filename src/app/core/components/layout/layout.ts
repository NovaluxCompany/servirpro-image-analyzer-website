import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { TokenService } from '../../service/token.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './layout.html'
})
export class LayoutComponent {
  private _router = inject(Router);
  private _tokenService = inject(TokenService);

  isSidebarOpen = signal(true);
  currentRoute = signal('');

  // User info from session
  currentUser = computed(() => this._tokenService.getUser());
  userName = computed(() => this.currentUser()?.name ?? 'Usuario');
  userRole = computed(() => this.currentUser()?.roles?.[0] ?? 'Sin rol');

  // Menu visibility: show item if user has access to that path, OR if user has no menuPaths (admin fallback)
  canSee = (path: string): boolean => {
    const menuPaths = this.currentUser()?.menuPaths ?? [];
    if (menuPaths.length === 0) return true; // no restrictions = show all
    return menuPaths.some(p => p === path || p.startsWith(path) || path.startsWith(p));
  };

  // Role-based visibility
  isAdmin = computed(() =>
    this.currentUser()?.roles?.some(r => r.toLowerCase() === 'administrador' || r.toLowerCase() === 'admin') ?? false
  );

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
