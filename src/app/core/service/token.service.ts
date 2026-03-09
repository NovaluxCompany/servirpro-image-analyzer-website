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
}
