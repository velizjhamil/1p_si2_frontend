import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import {
  ApiResponse,
} from '../../core/models/usuario.model';
import {
  Empresa,
  EmpresaUpdatePayload,
} from '../../core/models/empresa.model';

/**
 * CU16 — Gestión de Empresa (perfil institucional).
 * Consume GET/PUT /api/v1/empresa desempacando el envelope {status,data,message}.
 */
@Injectable({ providedIn: 'root' })
export class EmpresaService {
  private readonly api = inject(ApiService);

  /** GET /api/v1/empresa/ — datos de la empresa (data null si no hay registro). */
  getEmpresa(): Observable<ApiResponse<Empresa | null>> {
    return this.api.get<ApiResponse<Empresa | null>>('/empresa/');
  }

  /** PUT /api/v1/empresa/ — actualiza (o crea) la información de la empresa. */
  updateEmpresa(
    payload: EmpresaUpdatePayload
  ): Observable<ApiResponse<Empresa>> {
    return this.api.put<ApiResponse<Empresa>>('/empresa/', payload);
  }
}
