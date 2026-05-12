import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { Role, PaginatedRoles } from '../interfaces/role.interface';

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  private http = inject(HttpClient);
  private tokenService = inject(TokenService);
  private apiUrl = `${environment.urlBD}/roles`;

  private getHeaders(): HttpHeaders {
    const token = this.tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  findAll(page: number = 1, limit: number = 10): Observable<PaginatedRoles> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString());
    return this.http.get<PaginatedRoles>(this.apiUrl, { headers: this.getHeaders(), params });
  }

  findOne(id: number): Observable<Role> {
    return this.http.get<Role>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }

  create(role: any): Observable<Role> {
    return this.http.post<Role>(this.apiUrl, role, { headers: this.getHeaders() });
  }

  update(id: number, role: any): Observable<Role> {
    return this.http.patch<Role>(`${this.apiUrl}/${id}`, role, { headers: this.getHeaders() });
  }

  remove(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() });
  }
}
