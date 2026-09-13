import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import { ApiResponse } from '../../../core/models/usuario.model';
import {
  Coleccion,
  ColeccionCreatePayload,
  ColeccionUpdatePayload,
  Temporada,
  TemporadaCreatePayload,
  TemporadaUpdatePayload,
  TemporadasPage,
} from '../../../core/models/temporada.model';

/** Parámetros de filtro del GET paginado de temporadas. */
export interface TemporadasQuery {
  q?: string;
  id_coleccion?: number;
  vigente?: boolean;
  page?: number;
  limit?: number;
}

/**
 * CU24 — Temporadas y Colecciones.
 * Consume /api/v1/temporadas (paginado, búsqueda y filtro por vigencia)
 * y /api/v1/colecciones (lista simple para el dropdown), desempacando el
 * envelope { status, data, message, total, page, ... }.
 */
@Injectable({ providedIn: 'root' })
export class TemporadasService {
  private readonly api = inject(ApiService);

  // ------------------------------------------------------------- temporadas
  /** GET /api/v1/temporadas — lista paginada server-side. */
  getTemporadas(query: TemporadasQuery = {}): Observable<TemporadasPage> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.id_coleccion !== undefined && query.id_coleccion !== null) {
      params.set('id_coleccion', String(query.id_coleccion));
    }
    if (query.vigente !== undefined && query.vigente !== null) {
      params.set('vigente', String(query.vigente));
    }
    params.set('page', String(query.page ?? 1));
    params.set('limit', String(query.limit ?? 10));
    return this.api.get<TemporadasPage>(`/temporadas?${params.toString()}`);
  }

  /** POST /api/v1/temporadas — registra temporada (rango de fechas validado). */
  createTemporada(
    payload: TemporadaCreatePayload,
  ): Observable<ApiResponse<Temporada>> {
    return this.api.post<ApiResponse<Temporada>>('/temporadas', payload);
  }

  /** PUT /api/v1/temporadas/{id} — actualización parcial. */
  updateTemporada(
    id: number,
    payload: TemporadaUpdatePayload,
  ): Observable<ApiResponse<Temporada>> {
    return this.api.put<ApiResponse<Temporada>>(`/temporadas/${id}`, payload);
  }

  /** DELETE /api/v1/temporadas/{id} — elimina temporada. */
  eliminarTemporada(id: number): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/temporadas/${id}`);
  }

  // ------------------------------------------------------------ colecciones
  /** GET /api/v1/colecciones — lista completa (dropdown del modal). */
  getColecciones(): Observable<ApiResponse<Coleccion[]>> {
    return this.api.get<ApiResponse<Coleccion[]>>('/colecciones');
  }

  /** POST /api/v1/colecciones — registra colección (nombre único). */
  createColeccion(
    payload: ColeccionCreatePayload,
  ): Observable<ApiResponse<Coleccion>> {
    return this.api.post<ApiResponse<Coleccion>>('/colecciones', payload);
  }

  /** PUT /api/v1/colecciones/{id} — renombra colección. */
  updateColeccion(
    id: number,
    payload: ColeccionUpdatePayload,
  ): Observable<ApiResponse<Coleccion>> {
    return this.api.put<ApiResponse<Coleccion>>(`/colecciones/${id}`, payload);
  }

  /** DELETE /api/v1/colecciones/{id} — elimina (409 si tiene temporadas). */
  eliminarColeccion(id: number): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/colecciones/${id}`);
  }
}
