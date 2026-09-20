import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
  ActualizacionEstadoEnvio,
  AsignacionEnvio,
  ConfirmacionPreparacion,
  Envio,
  EnvioFiltros,
  EnvioListado,
  HistorialEnvio,
  IniciarEnvioPayload,
  IntentoFallidoEnvio,
  ReprogramacionEnvio,
  Repartidor,
} from '../../core/models/envio.model';

/**
 * CU18 — Gestión de Envío.
 *
 * Consume los endpoints reales del backend FastAPI (`/api/v1/envios`):
 * - GET   /envios?estado=&q=&codigo_sucursal=&id_repartidor=&page=&limit=
 *   Listado paginado. Visibilidad por rol (server-side): ASU/GS ven todo,
 *   D solo lo asignado a él, C solo lo de sus ventas, V recibe 403.
 * - POST  /envios — inicia el envío de una venta a domicilio sin envío (ASU/GS).
 * - GET   /envios/repartidores — usuarios rol D activos + carga (ASU/GS).
 * - GET   /envios/por-venta/{id_venta} — envío de un pedido.
 * - GET   /envios/{id} y /envios/{id}/historial
 * - PATCH /envios/{id}/confirmar-preparacion | asignar | estado |
 *         intento-fallido | reprogramar
 *
 * Los PATCH devuelven el envío ACTUALIZADO (con su nuevo estado y sus
 * `transiciones_permitidas`), así la vista se refresca sin volver a pedirlo.
 * El envelope {status, data, message, total, page, limit, pages} se
 * desempaqueta acá; los 4xx (400/403/404/409/422) llegan al componente como
 * errores HTTP con {error: {detail}} — usar `mensajeErrorEnvio()`.
 *
 * Las respuestas del backend ya tienen la forma exacta de los modelos, por
 * eso no hay capa de mapeo DTO. Las fechas que se envían deben ser ISO 8601
 * con offset (`Date.toISOString()`); el backend asume UTC si no hay offset.
 */

/** Envelope del GET paginado: lista en data + extras de paginación. */
interface EnviosPageEnvelope extends ApiResponse<Envio[]> {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class EnviosService {
  private readonly api = inject(ApiService);

  /** GET /envios — listado paginado con visibilidad por rol. */
  listar(filtros: EnvioFiltros = {}): Observable<EnvioListado> {
    const params: string[] = [];
    if (filtros.estado) params.push(`estado=${filtros.estado}`);
    if (filtros.q) params.push(`q=${encodeURIComponent(filtros.q)}`);
    if (filtros.codigo_sucursal) params.push(`codigo_sucursal=${filtros.codigo_sucursal}`);
    if (filtros.id_repartidor) params.push(`id_repartidor=${filtros.id_repartidor}`);
    params.push(`page=${filtros.page ?? 1}`);
    params.push(`limit=${filtros.limit ?? 20}`);

    return this.api.get<EnviosPageEnvelope>(`/envios?${params.join('&')}`).pipe(
      map((resp) => ({
        items: resp.data,
        total: resp.total,
        page: resp.page,
        limit: resp.limit,
        pages: resp.pages,
      })),
    );
  }

  /** GET /envios/{id} — detalle completo. */
  obtener(id: number): Observable<Envio> {
    return this.api.get<ApiResponse<Envio>>(`/envios/${id}`).pipe(map((r) => r.data));
  }

  /** GET /envios/por-venta/{id_venta} — envío de un pedido (404 si no tiene). */
  obtenerPorVenta(idVenta: number): Observable<Envio> {
    return this.api
      .get<ApiResponse<Envio>>(`/envios/por-venta/${idVenta}`)
      .pipe(map((r) => r.data));
  }

  /** GET /envios/{id}/historial — bitácora en orden cronológico. */
  historial(id: number): Observable<HistorialEnvio[]> {
    return this.api
      .get<ApiResponse<HistorialEnvio[]>>(`/envios/${id}/historial`)
      .pipe(map((r) => r.data));
  }

  /** GET /envios/repartidores — repartidores (rol D activos) con su carga. Solo ASU/GS. */
  repartidores(): Observable<Repartidor[]> {
    return this.api
      .get<ApiResponse<Repartidor[]>>('/envios/repartidores')
      .pipe(map((r) => r.data));
  }

  /** POST /envios — inicia el envío de una venta a domicilio sin envío (ASU/GS). */
  iniciar(payload: IniciarEnvioPayload): Observable<Envio> {
    return this.api.post<ApiResponse<Envio>>('/envios', payload).pipe(map((r) => r.data));
  }

  /** PATCH /envios/{id}/confirmar-preparacion — PREPARANDO -> LISTO_ENVIO (ASU/GS). */
  confirmarPreparacion(id: number, payload: ConfirmacionPreparacion): Observable<Envio> {
    return this.patch(id, 'confirmar-preparacion', payload);
  }

  /** PATCH /envios/{id}/asignar — LISTO_ENVIO -> ASIGNADO (ASU/GS). */
  asignar(id: number, payload: AsignacionEnvio): Observable<Envio> {
    return this.patch(id, 'asignar', payload);
  }

  /** PATCH /envios/{id}/estado — EN_RUTA | ENTREGADO | CANCELADO. */
  actualizarEstado(id: number, payload: ActualizacionEstadoEnvio): Observable<Envio> {
    return this.patch(id, 'estado', payload);
  }

  /** PATCH /envios/{id}/intento-fallido — EN_RUTA -> INTENTO_FALLIDO. */
  registrarIntentoFallido(id: number, payload: IntentoFallidoEnvio): Observable<Envio> {
    return this.patch(id, 'intento-fallido', payload);
  }

  /** PATCH /envios/{id}/reprogramar — INTENTO_FALLIDO -> REPROGRAMADO. */
  reprogramar(id: number, payload: ReprogramacionEnvio): Observable<Envio> {
    return this.patch(id, 'reprogramar', payload);
  }

  /** PATCH genérico que desempaqueta el envelope y devuelve el envío actualizado. */
  private patch(id: number, accion: string, payload: unknown): Observable<Envio> {
    return this.api
      .patch<ApiResponse<Envio>>(`/envios/${id}/${accion}`, payload)
      .pipe(map((r) => r.data));
  }
}

/** Forma del error HTTP de HttpClient para los 4xx del backend. */
interface ErrorHttpEnvio {
  status?: number;
  error?: { detail?: string | { loc?: (string | number)[]; msg?: string }[] };
}

/**
 * Mensaje legible para el usuario a partir de un error HTTP del backend.
 * - 400/403/404/409: `detail` es un string ya redactado por el backend.
 * - 422 (validación Pydantic): `detail` es una lista; se une `campo: mensaje`.
 * - Sin respuesta (red caída) o error inesperado: mensaje genérico.
 */
export function mensajeErrorEnvio(err: unknown, porDefecto = 'No se pudo completar la operación.'): string {
  const e = err as ErrorHttpEnvio | null;
  if (e?.status === 0) return 'No hay conexión con el servidor.';
  const detail = e?.error?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d) => {
        const campo = d.loc?.filter((p) => p !== 'body').join('.');
        return campo ? `${campo}: ${d.msg ?? 'valor inválido'}` : (d.msg ?? 'valor inválido');
      })
      .join(' · ');
  }
  return porDefecto;
}
