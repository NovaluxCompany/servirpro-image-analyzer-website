import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators'
import { TokenService} from './token.service'
import { ResponseLogin } from '../interfaces/Response-login'
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})

export class AuthService{ 
  private _http = inject(HttpClient)
  private _tokenService = inject(TokenService)
  private _router = inject(Router)
  _env = environment

  private url = this._env.urlBD + "/auth/login"

  loginDB(email: string, password: string) {
    
      return this._http.post<ResponseLogin>(this.url,
        {
          email,
          password
        })
        .pipe(
          tap(Response => {
            this._tokenService.saveToken(Response.access_token)
          })
        )
  }

  logout(): void {
    this._tokenService.removeToken();
    this._router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !this._tokenService.isTokenExpired();
  }
}




