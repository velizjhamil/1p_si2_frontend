import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
 CandidatoGerente,
 Ciudad,
 Sucursal,
 SucursalCreatePayload,
 SucursalUpdatePayload,
} from '../../core/models/sucursal.model';
import { UsuarioList } from '../../core/models/usuario.model';

/**
 * Gestión de Sucursales.
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

 /** Atajo para obtener el arreglo directo de sucursales. */
 listar(): Observable<Sucursal[]> {
 return this.getSucursales().pipe(map((resp) => resp.data));
 }

 /** GET /api/v1/sucursales/candidatos-gerentes — gerentes disponibles o asignados. */
 getCandidatosGerente(): Observable<ApiResponse<CandidatoGerente[]>> {
 return this.api.get<ApiResponse<CandidatoGerente[]>>('/sucursales/candidatos-gerentes');
 }

 /** GET /api/v1/sucursales/{codigo}/personal — personal asignado a la sucursal. */
 getPersonalSucursal(codigo: number): Observable<ApiResponse<UsuarioList[]>> {
 return this.api.get<ApiResponse<UsuarioList[]>>(`/sucursales/${codigo}/personal`);
 }

 /** POST /api/v1/sucursales — crea sucursal asignando ciudad y gerente opcional. */
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
