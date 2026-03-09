import { inject, Injectable } from '@angular/core';
import { CanActivate, Router,} from '@angular/router';
import { LoginService } from '../service/login.service';

@Injectable({
  providedIn: 'root',
})
export class LoginGuardian implements CanActivate{
  private _loginService = inject(LoginService)
  private _router = inject(Router)

  canActivate(): boolean {
    if(this._loginService.isAuthenticated()){
      return true
    } else {
      this._router.navigate(['login'])
      return false
    }
  }
}