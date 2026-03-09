import { inject, Injectable } from '@angular/core';
import { TokenService } from './token.service';

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private _tokenService = inject(TokenService)

  isAuthenticated(){
    const valorToken = this._tokenService.getToken()

    return valorToken != null && valorToken != ''
  }
}
