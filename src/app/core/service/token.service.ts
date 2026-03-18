import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TokenService {

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
