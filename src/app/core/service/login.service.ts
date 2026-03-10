import { inject, Injectable } from '@angular/core';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private _tokenService = inject(TokenService)

  isAuthenticated(){
    const valorToken = this._tokenService.getToken()

    // Verificar que el token exista y no esté expirado
    return valorToken != null && valorToken != '' && !this._tokenService.isTokenExpired()
  }
}
