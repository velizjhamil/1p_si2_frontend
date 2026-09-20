import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import { Ciudad } from '../../core/models/sucursal.model';
import {
  Agencia,
  AgenciaCreatePayload,
  AgenciaDisponible,
  AgenciaUpdatePayload,
  AgenciasPage,
  AgenciasQuery,
  CiudadConsultada,
  Cotizacion,
  CotizacionQuery,
  Disponibles,
  Tarifa,
  TarifaCreatePayload,
  TarifaUpdatePayload,
  ZonaCobertura,
  ZonaPayload,
} from '../../core/models/agencia.model';

/**
 * CU19 — Gestión de Agencias de Reparto.
 *
 * Consume `/api/v1/agencias-reparto` desempacando el envelope estándar
 * { status, data, message }:
 * - GET/POST /agencias-reparto, GET/PUT/DELETE /{id}, PATCH /{id}/estado
 * - GET/POST /{id}/zonas, GET/PUT/DELETE /{id}/zonas/{zona}
 * - GET/POST /{id}/zonas/{zona}/tarifas, GET/PUT/DELETE .../{tarifa}
 * - GET /disponibles?ciudad=  (agencias habilitadas que cubren una ciudad)
 * - GET /{id}/cotizacion?ciudad=&peso_kg=&volumen_m3=  (solo lectura)
 *
 * Autorización (la valida el backend; la UI solo oculta lo que no aplica):
 * ASU/GS administran todo; D solo consulta agencias habilitadas (sin datos de
 * facturación); V/C reciben 403. Los errores 4xx llegan al componente como
 * HttpErrorResponse con `error.detail`; usar `mensajeErrorEnvio()` (genérico).
 */
@Injectable({ providedIn: 'root' })
export class AgenciasService {
  private readonly api = inject(ApiService);
  private readonly base = '/agencias-reparto';

  // ---------------------------------------------------------------- agencias
  /** GET /agencias-reparto — listado paginado (D solo ve las habilitadas). */
  listar(query: AgenciasQuery = {}): Observable<AgenciasPage> {
    const params: string[] = [];
    if (query.q) params.push(`q=${encodeURIComponent(query.q)}`);
    if (query.is_active !== undefined) params.push(`is_active=${query.is_active}`);
    params.push(`page=${query.page ?? 1}`);
    params.push(`limit=${query.limit ?? 10}`);
    return this.api.get<AgenciasPage>(`${this.base}?${params.join('&')}`);
  }

  /** GET /agencias-reparto/{id} — detalle (ASU/GS: con facturación y totales). */
  obtener(id: number): Observable<Agencia> {
    return this.api.get<ApiResponse<Agencia>>(`${this.base}/${id}`).pipe(map((r) => r.data));
  }

  /** POST /agencias-reparto — registra una agencia habilitada (ASU/GS). */
  crear(payload: AgenciaCreatePayload): Observable<Agencia> {
    return this.api.post<ApiResponse<Agencia>>(this.base, payload).pipe(map((r) => r.data));
  }

  /** PUT /agencias-reparto/{id} — actualiza solo lo enviado (ASU/GS). */
  actualizar(id: number, payload: AgenciaUpdatePayload): Observable<Agencia> {
    return this.api.put<ApiResponse<Agencia>>(`${this.base}/${id}`, payload).pipe(map((r) => r.data));
  }

  /** PATCH /agencias-reparto/{id}/estado — habilita/deshabilita (idempotente). */
  cambiarEstado(id: number, isActive: boolean): Observable<Agencia> {
    return this.api
      .patch<ApiResponse<Agencia>>(`${this.base}/${id}/estado`, { is_active: isActive })
      .pipe(map((r) => r.data));
  }

  /** DELETE /agencias-reparto/{id} — 409 si tiene envíos asociados. Devuelve el mensaje. */
  eliminar(id: number): Observable<string> {
    return this.api.delete<ApiResponse<null>>(`${this.base}/${id}`).pipe(map((r) => r.message));
  }

  // ------------------------------------------------------------------- zonas
  /** GET /{id}/zonas — zonas ordenadas por ciudad y subzona. */
  zonas(idAgencia: number): Observable<ZonaCobertura[]> {
    return this.api
      .get<ApiResponse<ZonaCobertura[]>>(`${this.base}/${idAgencia}/zonas`)
      .pipe(map((r) => r.data));
  }

  crearZona(idAgencia: number, payload: ZonaPayload): Observable<ZonaCobertura> {
    return this.api
      .post<ApiResponse<ZonaCobertura>>(`${this.base}/${idAgencia}/zonas`, payload)
      .pipe(map((r) => r.data));
  }

  actualizarZona(idAgencia: number, idZona: number, payload: ZonaPayload): Observable<ZonaCobertura> {
    return this.api
      .put<ApiResponse<ZonaCobertura>>(`${this.base}/${idAgencia}/zonas/${idZona}`, payload)
      .pipe(map((r) => r.data));
  }

  /** DELETE de zona — 409 si tiene tarifas (hay que eliminarlas primero). */
  eliminarZona(idAgencia: number, idZona: number): Observable<string> {
    return this.api
      .delete<ApiResponse<null>>(`${this.base}/${idAgencia}/zonas/${idZona}`)
      .pipe(map((r) => r.message));
  }

  // ----------------------------------------------------------------- tarifas
  tarifas(idAgencia: number, idZona: number): Observable<Tarifa[]> {
    return this.api
      .get<ApiResponse<Tarifa[]>>(`${this.base}/${idAgencia}/zonas/${idZona}/tarifas`)
      .pipe(map((r) => r.data));
  }

  crearTarifa(idAgencia: number, idZona: number, payload: TarifaCreatePayload): Observable<Tarifa> {
    return this.api
      .post<ApiResponse<Tarifa>>(`${this.base}/${idAgencia}/zonas/${idZona}/tarifas`, payload)
      .pipe(map((r) => r.data));
  }

  actualizarTarifa(
    idAgencia: number,
    idZona: number,
    idTarifa: number,
    payload: TarifaUpdatePayload,
  ): Observable<Tarifa> {
    return this.api
      .put<ApiResponse<Tarifa>>(`${this.base}/${idAgencia}/zonas/${idZona}/tarifas/${idTarifa}`, payload)
      .pipe(map((r) => r.data));
  }

  /** DELETE de tarifa — 409 si algún envío la usa (conviene desactivarla). */
  eliminarTarifa(idAgencia: number, idZona: number, idTarifa: number): Observable<string> {
    return this.api
      .delete<ApiResponse<null>>(`${this.base}/${idAgencia}/zonas/${idZona}/tarifas/${idTarifa}`)
      .pipe(map((r) => r.message));
  }

  // ------------------------------------------------- disponibilidad y cotización
  /**
   * GET /disponibles?ciudad= — agencias HABILITADAS con cobertura en la ciudad
   * (nombre normalizado: sin distinguir mayúsculas ni tildes). 404 si la ciudad
   * no existe, 409 si el nombre es ambiguo.
   */
  disponibles(ciudad: string): Observable<Disponibles> {
    return this.api
      .get<ApiResponse<AgenciaDisponible[]> & { ciudad: CiudadConsultada }>(
        `${this.base}/disponibles?ciudad=${encodeURIComponent(ciudad)}`,
      )
      .pipe(map((r) => ({ agencias: r.data, ciudad: r.ciudad })));
  }

  /**
   * GET /{id}/cotizacion — costo de agencia para una ciudad, peso y volumen.
   * Solo lectura. 404: sin cobertura o sin tarifa aplicable; 409: ciudad
   * ambigua o tarifas equivalentes; 400: agencia deshabilitada.
   */
  cotizar(idAgencia: number, q: CotizacionQuery): Observable<Cotizacion> {
    const params = [
      `ciudad=${encodeURIComponent(q.ciudad)}`,
      `peso_kg=${encodeURIComponent(q.peso_kg)}`,
      `volumen_m3=${encodeURIComponent(q.volumen_m3)}`,
    ];
    return this.api
      .get<ApiResponse<Cotizacion>>(`${this.base}/${idAgencia}/cotizacion?${params.join('&')}`)
      .pipe(map((r) => r.data));
  }

  /** GET /ciudades — catálogo para el formulario de zonas. */
  ciudades(): Observable<Ciudad[]> {
    return this.api.get<ApiResponse<Ciudad[]>>('/ciudades').pipe(map((r) => r.data));
  }
}
