import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
 EstadoProveedor,
 Proveedor,
 ProveedorCreatePayload,
 ProveedorUpdatePayload,
 ProveedoresPage,
} from '../../core/models/proveedor.model';

/** Parámetros de filtro del GET paginado. */
export interface ProveedoresQuery {
 q?: string;
 categoria?: string;
 estado?: EstadoProveedor;
 ciudad?: string;
 page?: number;
 limit?: number;
}

/**
 * Gestión de Proveedores.
 * Consume /api/v1/proveedores (paginado con filtros) desempacando el
 * envelope estándar { status, data, message, total, page, limit, pages }.
 */
@Injectable({ providedIn: 'root' })
export class ProveedoresService {
 private readonly api = inject(ApiService);

 /** GET /api/v1/proveedores — lista paginada con filtros server-side. */
 getProveedores(query: ProveedoresQuery = {}): Observable<ProveedoresPage> {
 const params = new URLSearchParams();
 if (query.q) params.set('q', query.q);
 if (query.categoria) params.set('categoria', query.categoria);
 if (query.estado) params.set('estado', query.estado);
 if (query.ciudad) params.set('ciudad', query.ciudad);
 params.set('page', String(query.page ?? 1));
 params.set('limit', String(query.limit ?? 10));
 return this.api.get<ProveedoresPage>(`/proveedores?${params.toString()}`);
 }

 /** POST /api/v1/proveedores — registra proveedor. */
 createProveedor(payload: ProveedorCreatePayload): Observable<ApiResponse<Proveedor>> {
 return this.api.post<ApiResponse<Proveedor>>('/proveedores', payload);
 }

 /** PUT /api/v1/proveedores/{id} — actualiza contacto/razón social/estado. */
 updateProveedor(id: number, payload: ProveedorUpdatePayload): Observable<ApiResponse<Proveedor>> {
 return this.api.put<ApiResponse<Proveedor>>(`/proveedores/${id}`, payload);
 }

 /** DELETE /api/v1/proveedores/{id} — elimina (409 si tiene productos). */
 eliminarProveedor(id: number): Observable<ApiResponse<null>> {
 return this.api.delete<ApiResponse<null>>(`/proveedores/${id}`);
 }
}
