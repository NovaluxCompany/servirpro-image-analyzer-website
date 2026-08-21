import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, tap } from 'rxjs/operators'
import { Observable, of, shareReplay } from 'rxjs'
import { TokenService} from './token.service'
import { ResponseLogin, UserInfo } from '../interfaces/Response-login'
import { environment } from '../../../environments/environment';

/**
 * Ventana mínima entre llamadas reales al backend en /auth/me.
 * El refresh ahora corre en background (no bloquea la navegación), así que este
 * valor no afecta la "sensación" de velocidad: solo evita disparar una request
 * nueva por cada evento de router (NavigationStart, GuardsCheckStart, etc.) que
 * ocurren varias veces por cada navegación real.
 */
const REFRESH_USER_TTL_MS = 3_000;

@Injectable({
  providedIn: 'root',
})

export class AuthService{
  private _http = inject(HttpClient)
  private _tokenService = inject(TokenService)
  private _router = inject(Router)
  _env = environment

  private url = this._env.urlBD + "/auth/login"
  private meUrl = this._env.urlBD + "/auth/me"

  private lastRefreshAt = 0;
  private pendingRefresh: Observable<UserInfo | null> | null = null;

  loginDB(email: string, password: string) {

      return this._http.post<ResponseLogin>(this.url,
        {
          email,
          password
        })
        .pipe(
          tap(Response => {
            this._tokenService.saveToken(Response.access_token);
            this._tokenService.saveUser(Response.user);
          })
        )
  }

  /**
   * Refresca el UserInfo (roles/menús/permisos) contra el backend usando el JWT actual
   * y actualiza el signal en TokenService. Se usa desde el roleGuard en cada navegación
   * para que los cambios de permisos (ej. "asignar permisos" a un rol) se reflejen sin
   * necesidad de volver a hacer login.
   * Si falla (sin red, backend caído, etc.) no rompe la navegación: se mantiene el user cacheado.
   *
   * Para no pegarle al backend en cada click de navegación, solo se refresca de verdad
   * si pasaron más de REFRESH_USER_TTL_MS desde el último refresh (o si se fuerza).
   * Si hay un refresh en curso, las llamadas concurrentes (guards de rutas hijas) se
   * enganchan a esa misma request en vez de disparar una nueva.
   */
  refreshUser(force = false) {
    const now = Date.now();

    if (!force && now - this.lastRefreshAt < REFRESH_USER_TTL_MS) {
      return of(this._tokenService.getUser());
    }

    if (this.pendingRefresh) {
      return this.pendingRefresh;
    }

    this.pendingRefresh = this._http.get<UserInfo>(this.meUrl).pipe(
      tap((user) => {
        this._tokenService.saveUser(user);
        this.lastRefreshAt = Date.now();
      }),
      catchError(() => of(this._tokenService.getUser())),
      finalize(() => {
        this.pendingRefresh = null;
      }),
      shareReplay(1),
    );

    return this.pendingRefresh;
  }

  logout(): void {
    this._tokenService.removeToken();
    this._tokenService.clearUser();
    this.lastRefreshAt = 0;
    this._router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !this._tokenService.isTokenExpired();
  }
}




