import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenService } from '../service/token.service';
import { AuthService } from '../service/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar si el token existe y no ha expirado
  const token = tokenService.getToken();
  
  if (token) {
    // Validar si el token está expirado
    if (tokenService.isTokenExpired()) {
      authService.logout();
      return throwError(() => new Error('Sesión expirada. Por favor, inicia sesión nuevamente.'));
    }

    // Si el token es válido, agregarlo al header
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // Continuar con la petición y manejar errores
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si recibimos un 401 (Unauthorized), el token puede estar inválido
      if (error.status === 401) {
        authService.logout();
      }
      
      return throwError(() => error);
    })
  );
};
