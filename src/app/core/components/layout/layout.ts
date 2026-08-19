import { Component, inject, signal, computed, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { fromEvent, merge, timer } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { TokenService } from '../../service/token.service';
import { PermissionService } from '../../service/permission.service';
import { ToastService } from '../../service/toast.service';
import { AuthService } from '../../service/auth.service';

/** Cada cuánto se refrescan los permisos aunque el usuario no navegue a otra ruta. */
const PERMISSIONS_POLL_MS = 45_000;

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
  private _toastService = inject(ToastService);
  private _authService = inject(AuthService);

  isSidebarOpen = signal(true);
  currentRoute = signal('');

  /** Ruta previa a la actual (solo se pisa en navegaciones reales, ya validadas por el roleGuard). */
  private previousPath = '';

  // User info from session
  currentUser = computed(() => this._tokenService.getUser());
  userName = computed(() => this.currentUser()?.name ?? 'Usuario');
  userRole = computed(() => this.currentUser()?.roles?.[0] ?? 'Sin rol');

  // Menu visibility: muestra el item si está en menuPaths del usuario,
  // o si el rol tiene acceso según PermissionService (cubre rutas que el backend
  // no tiene correctamente configuradas, como /usuarios → /afiliados en Pagos).
  canSee = (path: string): boolean => {
    return this._permission.canAccessRoute(path);
  };

  constructor() {
    this.updateCurrentRoute();
    this.watchPermissionLoss();
    this.startPermissionPolling();
  }

  /**
   * Refresca los permisos cada PERMISSIONS_POLL_MS aunque el usuario se quede
   * quieto en la misma ruta sin navegar. Sin esto, un cambio de permisos hecho
   * en "asignar permisos" solo se detectaba en el próximo canActivate (roleGuard),
   * es decir, solo si el usuario cambiaba de ruta.
   *
   * Para no recargar el backend con pestañas abiertas en background (cada usuario
   * conectado pegándole al servidor cada X segundos aunque ni esté mirando la
   * pantalla), los ticks del timer se ignoran mientras la pestaña está oculta.
   * Al volver a foco se hace un refresh inmediato (catch-up) en vez de esperar
   * al próximo tick, para que no se sienta desactualizado justo al volver.
   */
  private startPermissionPolling(): void {
    const scheduledTicks$ = timer(PERMISSIONS_POLL_MS, PERMISSIONS_POLL_MS).pipe(
      filter(() => !document.hidden),
    );

    const becameVisible$ = fromEvent(document, 'visibilitychange').pipe(
      filter(() => document.visibilityState === 'visible'),
    );

    merge(scheduledTicks$, becameVisible$)
      .pipe(
        switchMap(() => this._authService.refreshUser()),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /**
   * Si el usuario pierde en caliente el permiso del módulo en el que está parado
   * (ej. un admin le quita el acceso mientras lo tiene abierto), el roleGuard no
   * se vuelve a ejecutar hasta la próxima navegación. Este effect() reacciona al
   * signal de usuario (que refreshUser() actualiza en background en cada
   * navegación) y saca al usuario apenas detecta que la ruta actual ya no está
   * en sus menuPaths, sin esperar a que él mismo navegue.
   */
  private watchPermissionLoss(): void {
    effect(() => {
      const user = this._tokenService.getUser();
      if (!user) return;

      const currentUrl = this._router.url.split('?')[0].split('#')[0];
      if (!currentUrl || currentUrl === '/' || currentUrl.startsWith('/login')) return;

      const menuPaths = user.menuPaths ?? [];
      const hasAccess = menuPaths.some((p) => {
        const allowedPath = (p ?? '').startsWith('/') ? p : `/${p}`;
        return currentUrl === allowedPath || currentUrl.startsWith(`${allowedPath}/`);
      });

      if (!hasAccess) {
        this._toastService.showError('Tu rol ya no tiene acceso a esta sección.');
        this._router.navigate([this.resolveFallbackPath(currentUrl, menuPaths)]);
      }
    });
  }

  /**
   * Encuentra a dónde mandar al usuario cuando pierde el acceso a la ruta actual:
   * 1) la ruta en la que estaba antes (si sigue teniendo acceso a ella), o
   * 2) el primer módulo raíz que sí tenga en menuPaths (excluyendo /menu, que es
   *    administrativo), o
   * 3) login, si no le quedó ningún módulo asignado.
   */
  private resolveFallbackPath(forbiddenPath: string, menuPaths: string[]): string {
    const normalized = menuPaths.map((p) => ((p ?? '').startsWith('/') ? p : `/${p}`));

    const previousStillValid =
      this.previousPath &&
      this.previousPath !== forbiddenPath &&
      normalized.some((p) => this.previousPath === p || this.previousPath.startsWith(`${p}/`));

    if (previousStillValid) return this.previousPath;

    const rootFallback = normalized.find(
      (p) => p !== '/' && p !== '/menu' && p.split('/').filter(Boolean).length === 1
    );

    return rootFallback ?? '/login';
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
    this._router.events.subscribe((event) => {
      if (!(event instanceof NavigationEnd)) return;

      const previous = this.currentRoute();
      if (previous && previous !== event.url) {
        this.previousPath = previous;
      }
      this.currentRoute.set(event.url);
    });
  }
}
