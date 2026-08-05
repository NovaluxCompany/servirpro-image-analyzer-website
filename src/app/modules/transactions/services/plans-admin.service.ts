import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TokenService } from '../../../core/service/token.service';
import { PlanAdmin, CreatePlanPayload, UpdatePlanPayload } from '../interfaces/plan-admin.interface';

@Injectable({
  providedIn: 'root',
})
export class PlansAdminService {
  private _http = inject(HttpClient);
  private _tokenService = inject(TokenService);
  private baseUrl = environment.urlBD + '/plans';

  private getHeaders(): HttpHeaders {
    const token = this._tokenService.getToken();
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  findAll(): Observable<PlanAdmin[]> {
    return this._http.get<PlanAdmin[]>(this.baseUrl, { headers: this.getHeaders() });
  }

  create(payload: CreatePlanPayload): Observable<PlanAdmin> {
    return this._http.post<PlanAdmin>(this.baseUrl, payload, { headers: this.getHeaders() });
  }

  update(id: number, payload: UpdatePlanPayload): Observable<PlanAdmin> {
    return this._http.patch<PlanAdmin>(`${this.baseUrl}/${id}`, payload, { headers: this.getHeaders() });
  }
}
