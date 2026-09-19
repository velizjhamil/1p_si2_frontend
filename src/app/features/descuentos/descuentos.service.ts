import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
  Descuento,
  DescuentoCreatePayload,
  DescuentoUpdatePayload,
  DescuentosPage,
  TipoDescuento,
} from '../../core/models/descuento.model';

/** Filtros del GET paginado de descuentos. */
export interface DescuentosQuery {
  q?: string;
  tipo?: TipoDescuento;
  activo?: boolean;
  vigente_hoy?: boolean;
  page?: number;
  limit?: number;
}

/**
 * CU12 — Gestión de Descuentos / Cupones.
 * Consume /api/v1/descuentos (paginado con búsqueda y filtros) y
 * desempaca el envelope { status, data, message, total, page, ... }.
 */
@Injectable({ providedIn: 'root' })
export class DescuentosService {
  private readonly api = inject(ApiService);

  /** GET /api/v1/descuentos — lista paginada server-side. */
  listar(query: DescuentosQuery = {}): Observable<DescuentosPage> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.tipo) params.set('tipo', query.tipo);
    if (query.activo !== undefined) {
      params.set('activo', String(query.activo));
    }
    if (query.vigente_hoy !== undefined) {
      params.set('vigente_hoy', String(query.vigente_hoy));
    }
    params.set('page', String(query.page ?? 1));
    params.set('limit', String(query.limit ?? 10));
    return this.api.get<DescuentosPage>(
      `/descuentos?${params.toString()}`,
    );
  }

  /** GET /api/v1/descuentos/{id} — detalle. */
  obtener(id: number): Observable<ApiResponse<Descuento>> {
    return this.api.get<ApiResponse<Descuento>>(`/descuentos/${id}`);
  }

  /** POST /api/v1/descuentos — registra descuento o cupon. */
  crear(payload: DescuentoCreatePayload): Observable<ApiResponse<Descuento>> {
    return this.api.post<ApiResponse<Descuento>>('/descuentos', payload);
  }

  /** PUT /api/v1/descuentos/{id} — actualización parcial. */
  actualizar(
    id: number,
    payload: DescuentoUpdatePayload,
  ): Observable<ApiResponse<Descuento>> {
    return this.api.put<ApiResponse<Descuento>>(
      `/descuentos/${id}`,
      payload,
    );
  }

  /** DELETE /api/v1/descuentos/{id} — elimina (409 si fue usado). */
  eliminar(id: number): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/descuentos/${id}`);
  }
}
