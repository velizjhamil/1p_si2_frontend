import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api';
import { ApiResponse } from '../../../core/models/usuario.model';
import {
  Color,
  ColoresPage,
  ProductoCreatePayload,
  ProductoRopa,
  ProductoUpdatePayload,
  ProductosPage,
  Talla,
  TallasPage,
} from '../../../core/models/producto.model';

/** Parámetros de filtro del GET paginado. */
export interface ProductosQuery {
  q?: string;
  id_categoria?: number;
  estado?: string;
  page?: number;
  limit?: number;
}

/**
 * CU6 — Gestión de Productos de Ropa.
 * Consume /api/v1/productos (paginado con búsqueda, filtro por categoría
 * y estado) desempacando el envelope { status, data, message, total, ... }.
 * Los catálogos de tallas y colores salen de /api/v1/tallas y
 * /api/v1/colores (CU7) para poblar los selects del formulario.
 */
@Injectable({ providedIn: 'root' })
export class ProductosService {
  private readonly api = inject(ApiService);

  /** GET /api/v1/productos — lista paginada server-side. */
  getProductos(query: ProductosQuery = {}): Observable<ProductosPage> {
    const params = new URLSearchParams();
    if (query.q) params.set('q', query.q);
    if (query.id_categoria) params.set('id_categoria', String(query.id_categoria));
    if (query.estado) params.set('estado', query.estado);
    params.set('page', String(query.page ?? 1));
    params.set('limit', String(query.limit ?? 10));
    return this.api.get<ProductosPage>(`/productos?${params.toString()}`);
  }

  /** GET /api/v1/tallas — catálogo read-only (limit alto para el select). */
  getTallas(): Observable<Talla[]> {
    return this.api
      .get<TallasPage>('/tallas?limit=100')
      .pipe(map((resp) => resp.data));
  }

  /** GET /api/v1/colores — catálogo read-only (limit alto para el select). */
  getColores(): Observable<Color[]> {
    return this.api
      .get<ColoresPage>('/colores?limit=100')
      .pipe(map((resp) => resp.data));
  }

  /** POST /api/v1/productos — registra producto + relaciones N:M. */
  createProducto(
    payload: ProductoCreatePayload,
  ): Observable<ApiResponse<ProductoRopa>> {
    return this.api.post<ApiResponse<ProductoRopa>>('/productos', payload);
  }

  /** PUT /api/v1/productos/{id} — actualización parcial de datos y relaciones. */
  updateProducto(
    id: number,
    payload: ProductoUpdatePayload,
  ): Observable<ApiResponse<ProductoRopa>> {
    return this.api.put<ApiResponse<ProductoRopa>>(`/productos/${id}`, payload);
  }

  /** DELETE /api/v1/productos/{id} — elimina (409 si tiene movimientos). */
  eliminarProducto(id: number): Observable<ApiResponse<null>> {
    return this.api.delete<ApiResponse<null>>(`/productos/${id}`);
  }
}
