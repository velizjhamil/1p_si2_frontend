import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
  Ciudad,
  Sucursal,
  SucursalCreatePayload,
  SucursalUpdatePayload,
} from '../../core/models/sucursal.model';

/**
 * CU17 — Gestión de Sucursales.
 * Consume /api/v1/sucursales y /api/v1/ciudades desempacando el
 * envelope estándar { status, data, message }.
 */
@Injectable({ providedIn: 'root' })
export class SucursalesService {
  private readonly api = inject(ApiService);

  /** GET /api/v1/sucursales — lista con ciudad asociada. */
  getSucursales(): Observable<ApiResponse<Sucursal[]>> {
    return this.api.get<ApiResponse<Sucursal[]>>('/sucursales');
  }

  /** POST /api/v1/sucursales — crea sucursal asignando ciudad existente. */
  createSucursal(payload: SucursalCreatePayload): Observable<ApiResponse<Sucursal>> {
    return this.api.post<ApiResponse<Sucursal>>('/sucursales', payload);
  }

  /** PUT /api/v1/sucursales/{codigo} — edición parcial. */
  updateSucursal(
    codigo: number,
    payload: SucursalUpdatePayload
  ): Observable<ApiResponse<Sucursal>> {
    return this.api.put<ApiResponse<Sucursal>>(`/sucursales/${codigo}`, payload);
  }

  /** DELETE /api/v1/sucursales/{codigo} — soft delete (desactiva). */
  desactivarSucursal(codigo: number): Observable<ApiResponse<Sucursal>> {
    return this.api.delete<ApiResponse<Sucursal>>(`/sucursales/${codigo}`);
  }

  /** GET /api/v1/ciudades — catálogo para el dropdown del modal. */
  getCiudades(): Observable<ApiResponse<Ciudad[]>> {
    return this.api.get<ApiResponse<Ciudad[]>>('/ciudades');
  }
}
