import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
 Categoria,
 CategoriaCreatePayload,
 CategoriaUpdatePayload,
 CategoriasPage,
} from '../../core/models/categoria.model';

/** Parámetros de filtro del GET paginado. */
export interface CategoriasQuery {
 q?: string;
 linea?: string;
 page?: number;
 limit?: number;
}

/**
 * Gestión de Categorías.
 * Consume /api/v1/categorias (paginado con búsqueda y filtro por línea)
 * desempacando el envelope { status, data, message, total, page, ... }.
 */
@Injectable({ providedIn: 'root' })
export class CategoriasService {
 private readonly api = inject(ApiService);

 /** GET /api/v1/categorias — lista paginada server-side. */
 getCategorias(query: CategoriasQuery = {}): Observable<CategoriasPage> {
 const params = new URLSearchParams();
 if (query.q) params.set('q', query.q);
 if (query.linea) params.set('linea', query.linea);
 params.set('page', String(query.page ?? 1));
 params.set('limit', String(query.limit ?? 10));
 return this.api.get<CategoriasPage>(`/categorias?${params.toString()}`);
 }

 /** POST /api/v1/categorias — registra categoría (nombre + línea). */
 createCategoria(payload: CategoriaCreatePayload): Observable<ApiResponse<Categoria>> {
 return this.api.post<ApiResponse<Categoria>>('/categorias', payload);
 }

 /** PUT /api/v1/categorias/{id} — actualización parcial. */
 updateCategoria(id: number, payload: CategoriaUpdatePayload): Observable<ApiResponse<Categoria>> {
 return this.api.put<ApiResponse<Categoria>>(`/categorias/${id}`, payload);
 }

 /** DELETE /api/v1/categorias/{id} — elimina (409 si tiene productos). */
 eliminarCategoria(id: number): Observable<ApiResponse<null>> {
 return this.api.delete<ApiResponse<null>>(`/categorias/${id}`);
 }
}
