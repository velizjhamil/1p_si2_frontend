import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import { ApiResponse } from '../../../core/models/usuario.model';

/**
 * Gestión de Tallas y Colores.
 *
 * Consume los endpoints reales del backend FastAPI:
 * - GET/POST /api/v1/tallas, PUT/DELETE /api/v1/tallas/{id}
 * - GET/POST /api/v1/colores, PUT/DELETE /api/v1/colores/{id}
 *
 * Mapea los DTOs del backend (id_talla, nombre_talla, codigo_hex) a los
 * modelos planos del componente (id, nombre, hex) para que la vista no
 * conozca el contrato HTTP. El envelope {status, data, message} se
 * desempaqueta aquí; los 409/404/422 del backend llegan al componente
 * como errores HTTP con {error: {detail}}.
 */

/** Talla del catálogo (ej: XS, S, M, L, XL). */
export interface Talla {
 id: number;
 nombre: string;
 descripcion: string | null;
 activo: boolean;
}

/** Color del catálogo con su código hexadecimal para la vista previa. */
export interface ColorVariante {
 id: number;
 nombre: string;
 hex: string;
 descripcion: string | null;
 activo: boolean;
}

/** Tipo discriminante de la pestaña activa (Tallas | Colores). */
export type PestaniaTallaColor = 'tallas' | 'colores';

/** Payload de creación/edición de talla. */
export interface TallaPayload {
 nombre: string;
 descripcion?: string;
 activo?: boolean;
}

/** Payload de creación/edición de color. */
export interface ColorPayload {
 nombre: string;
 hex?: string;
 descripcion?: string;
 activo?: boolean;
}

/** DTO de talla del backend (contrato /api/v1/tallas). */
interface TallaDTO {
 id_talla: number;
 nombre_talla: string;
 descripcion: string | null;
 activo: boolean;
}

/** DTO de color del backend (contrato /api/v1/colores). */
interface ColorDTO {
 id_color: number;
 nombre_color: string;
 codigo_hex: string;
 descripcion: string | null;
 activo: boolean;
}

/** Envelope del GET paginado: lista en data + extras de paginación. */
interface PageEnvelope<T> extends ApiResponse<T[]> {
 total: number;
 page: number;
 limit: number;
 pages: number;
}

@Injectable({ providedIn: 'root' })
export class TallasService {
 private readonly api = inject(ApiService);

 // ------------------------------------------------------------------ TALLAS
 /** GET /api/v1/tallas — lista de tallas (limit alto: catálogo pequeño). */
 getTallas(): Observable<Talla[]> {
 return this.api
 .get<PageEnvelope<TallaDTO>>('/tallas?limit=100')
 .pipe(map((resp) => resp.data.map(this.mapTalla)));
 }

 /** POST /api/v1/tallas — registra talla (409 si el nombre ya existe). */
 crearTalla(payload: TallaPayload): Observable<Talla> {
 return this.api
 .post<ApiResponse<TallaDTO>>('/tallas', {
 nombre_talla: payload.nombre.trim().toUpperCase(),
 descripcion: payload.descripcion ?? null,
 })
 .pipe(map((resp) => this.mapTalla(resp.data)));
 }

 /** PUT /api/v1/tallas/{id} — actualización parcial. */
 actualizarTalla(id: number, payload: TallaPayload): Observable<Talla> {
 return this.api
 .put<ApiResponse<TallaDTO>>(`/tallas/${id}`, {
 nombre_talla: payload.nombre.trim().toUpperCase(),
 descripcion: payload.descripcion ?? null,
 activo: payload.activo,
 })
 .pipe(map((resp) => this.mapTalla(resp.data)));
 }

 /** DELETE /api/v1/tallas/{id} — elimina (409 si tiene variantes). */
 eliminarTalla(id: number): Observable<ApiResponse<null>> {
 return this.api.delete<ApiResponse<null>>(`/tallas/${id}`);
 }

 // ----------------------------------------------------------------- COLORES
 /** GET /api/v1/colores — lista de colores (limit alto: catálogo pequeño). */
 getColores(): Observable<ColorVariante[]> {
 return this.api
 .get<PageEnvelope<ColorDTO>>('/colores?limit=100')
 .pipe(map((resp) => resp.data.map(this.mapColor)));
 }

 /** POST /api/v1/colores — registra color (409 por nombre o HEX duplicado). */
 crearColor(payload: ColorPayload): Observable<ColorVariante> {
 return this.api
 .post<ApiResponse<ColorDTO>>('/colores', {
 nombre_color: payload.nombre,
 codigo_hex: payload.hex ?? '#1d528d',
 descripcion: payload.descripcion ?? null,
 })
 .pipe(map((resp) => this.mapColor(resp.data)));
 }

 /** PUT /api/v1/colores/{id} — actualización parcial. */
 actualizarColor(id: number, payload: ColorPayload): Observable<ColorVariante> {
 return this.api
 .put<ApiResponse<ColorDTO>>(`/colores/${id}`, {
 nombre_color: payload.nombre,
 codigo_hex: payload.hex,
 descripcion: payload.descripcion ?? null,
 activo: payload.activo,
 })
 .pipe(map((resp) => this.mapColor(resp.data)));
 }

 /** DELETE /api/v1/colores/{id} — elimina (409 si tiene variantes). */
 eliminarColor(id: number): Observable<ApiResponse<null>> {
 return this.api.delete<ApiResponse<null>>(`/colores/${id}`);
 }

 // -------------------------------------------------------------- mapeo DTOs
 /** DTO backend -> modelo del componente. */
 private mapTalla(dto: TallaDTO): Talla {
 return {
 id: dto.id_talla,
 nombre: dto.nombre_talla,
 descripcion: dto.descripcion,
 activo: dto.activo,
 };
 }

 /** DTO backend -> modelo del componente. */
 private mapColor(dto: ColorDTO): ColorVariante {
 return {
 id: dto.id_color,
 nombre: dto.nombre_color,
 hex: dto.codigo_hex,
 descripcion: dto.descripcion,
 activo: dto.activo,
 };
 }
}
