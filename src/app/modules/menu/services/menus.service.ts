import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { Menu, Permission, PaginatedMenus } from '../interfaces/menu.interface';

@Injectable({
  providedIn: 'root',
})
export class MenusService {
  private http = inject(HttpClient);
  private tokenService = inject(TokenService);
  private apiUrl = `${environment.urlBD}/menus`;

  private getHeaders(): HttpHeaders {
    const token = this.tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  findAll(page: number = 1, limit: number = 10): Observable<PaginatedMenus> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedMenus>(this.apiUrl, { headers: this.getHeaders(), params });
  }

  findOne(id: number): Observable<Menu> {
    return this.http.get<Menu>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  create(menu: any): Observable<Menu> {
    return this.http.post<Menu>(this.apiUrl, menu, { headers: this.getHeaders() });
  }

  update(id: number, menu: any): Observable<Menu> {
    return this.http.patch<Menu>(`${this.apiUrl}/${id}`, menu, { headers: this.getHeaders() });
  }

  remove(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  getPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.apiUrl}/permissions`, { headers: this.getHeaders() });
  }
}
