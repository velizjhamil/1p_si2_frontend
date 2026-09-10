import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import {
  ApiResponse,
  PermisoRead,
  RolCatalogo,
  RolCreatePayload,
  RolPermisosPayload,
} from '../../../core/models/usuario.model';

/**
 * CU4 + CU5 — Roles y Permisos (vista unificada).
 * Consume los endpoints de catálogo montados bajo /api/v1 y desempaca
 * el envelope estándar { status, data, message }.
 */
@Injectable({ providedIn: 'root' })
export class RolesPermisosService {
  private readonly api = inject(ApiService);

  /** GET /api/v1/roles — roles con permisos heredados y conteo de usuarios. */
  getRoles(): Observable<ApiResponse<RolCatalogo[]>> {
    return this.api.get<ApiResponse<RolCatalogo[]>>('/roles');
  }

  /** POST /api/v1/roles — crea un rol con sus permisos. */
  createRol(payload: RolCreatePayload): Observable<ApiResponse<RolCatalogo>> {
    return this.api.post<ApiResponse<RolCatalogo>>('/roles', payload);
  }

  /** PUT /api/v1/roles/{id}/permisos — reemplaza los permisos del rol. */
  updateRolPermisos(
    idRol: string,
    payload: RolPermisosPayload
  ): Observable<ApiResponse<RolCatalogo>> {
    return this.api.put<ApiResponse<RolCatalogo>>(
      `/roles/${idRol}/permisos`,
      payload
    );
  }

  /** GET /api/v1/permisos — permisos agrupados por módulo. */
  getPermisosPorModulo(): Observable<ApiResponse<Record<string, PermisoRead[]>>> {
    return this.api.get<ApiResponse<Record<string, PermisoRead[]>>>('/permisos');
  }
}
