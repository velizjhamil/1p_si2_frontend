import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import {
  ApiResponse,
  RolCatalogo,
  UsuarioCreatePayload,
  UsuarioList,
  UsuarioUpdatePayload,
} from '../../core/models/usuario.model';

/**
 * CU3 — Gestión de Usuarios.
 * Consume los endpoints del paquete "usuarios" del backend FastAPI y
 * desempaca el envelope estándar { status, data, message }.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly api = inject(ApiService);

  /** GET /api/v1/usuarios — lista todos los usuarios. */
  getUsuarios(): Observable<ApiResponse<UsuarioList[]>> {
    return this.api.get<ApiResponse<UsuarioList[]>>('/usuarios');
  }

  /** POST /api/v1/usuarios — crea un usuario (rol por nombre). */
  createUsuario(payload: UsuarioCreatePayload): Observable<ApiResponse<UsuarioList>> {
    return this.api.post<ApiResponse<UsuarioList>>('/usuarios', payload);
  }

  /** PUT /api/v1/usuarios/{id} — actualiza campos (None = no cambiar). */
  updateUsuario(id: string, payload: UsuarioUpdatePayload): Observable<ApiResponse<UsuarioList>> {
    return this.api.put<ApiResponse<UsuarioList>>(`/usuarios/${id}`, payload);
  }

  /** PATCH /api/v1/usuarios/{id}/toggle-status — activa/inactiva. */
  toggleStatusUsuario(id: string): Observable<ApiResponse<UsuarioList>> {
    return this.api.patch<ApiResponse<UsuarioList>>(`/usuarios/${id}/toggle-status`, null);
  }

  /** GET /api/v1/roles — catálogo de roles con permisos (para el dropdown). */
  getRoles(): Observable<ApiResponse<RolCatalogo[]>> {
    return this.api.get<ApiResponse<RolCatalogo[]>>('/roles');
  }
}
