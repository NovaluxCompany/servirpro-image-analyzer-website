import { Injectable, signal } from '@angular/core';
import { UserInfo } from '../interfaces/Response-login';

@Injectable({
  providedIn: 'root',
})
export class TokenService {

  private _currentUser = signal<UserInfo | null>(this._loadUserFromStorage());

  // ── Token ────────────────────────────────────────────────────────────────
  saveToken(token: string){
    localStorage.setItem('token', token)
  }

  getToken(): string | null{
    const token = localStorage.getItem('token')
    return token
  }

  removeToken(){
    localStorage.removeItem('token')
  }

  // ── User / Session ───────────────────────────────────────────────────────
  saveUser(user: UserInfo): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this._currentUser.set(user);
  }

  getUser(): UserInfo | null {
    return this._currentUser();
  }

  clearUser(): void {
    localStorage.removeItem('currentUser');
    this._currentUser.set(null);
  }

  hasRole(role: string): boolean {
    return this._currentUser()?.roles.includes(role) ?? false;
  }

  hasMenuAccess(path: string): boolean {
    const menuPaths = this._currentUser()?.menuPaths ?? [];
    return menuPaths.length === 0 || menuPaths.some(p => path.startsWith(p) || p.includes(path));
  }

  private _loadUserFromStorage(): UserInfo | null {
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ── Token validation ─────────────────────────────────────────────────────
  isTokenExpired(): boolean {
    const token = this.getToken();

    if (!token) {
      return true;
    }

    try {
      const payload = this.decodeToken(token);

      if (!payload || !payload.exp) {
        return true;
      }

      // exp está en segundos, Date.now() está en milisegundos
      const expirationDate = payload.exp * 1000;
      const currentDate = Date.now();

      return currentDate >= expirationDate;
    } catch (error) {
      console.error('Error al validar token:', error);
      return true;
    }
  }

  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        throw new Error('Token JWT inválido');
      }

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));

      return JSON.parse(decoded);
    } catch (error) {
      console.error('Error al decodificar token:', error);
      return null;
    }
  }

  getTokenExpirationDate(): Date | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    try {
      const payload = this.decodeToken(token);

      if (!payload || !payload.exp) {
        return null;
      }

      return new Date(payload.exp * 1000);
    } catch (error) {
      return null;
    }
  }
}

