import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
  Devolucion,
  DevolucionCrearPayload,
  DevolucionFiltros,
  DevolucionItem,
  DevolucionListado,
  DevolucionProcesarPayload,
  EstadoDevolucion,
  VentaBusquedaResumen,
  VentaElegiblesDevolucion,
} from '../../core/models/devolucion.model';

/**
 * Gestión de Devoluciones.
 *
 * Consume los endpoints reales del backend FastAPI:
 * - GET /api/v1/devoluciones?estado=&id_venta=&page=&limit=
 * Listado paginado. Visibilidad por rol: C solo ve las suyas;
 * V/GS/ASU ven todas (regla server-side, no bypaseable).
 * - GET /api/v1/devoluciones/{id} — detalle con líneas.
 * - PATCH /api/v1/devoluciones/{id}/procesar — APROBAR | RECHAZAR | COMPLETAR.
 * Solo V/GS/ASU (rol C es 403). Rechazar exige motivo_rechazo.
 *
 * El envelope {status, data, message, total, page, limit, pages} se
 * desempaqueta acá; los 4xx del backend llegan al componente como
 * errores HTTP con {error: {detail}}.
 */

/** DTO de un ítem de la devolución (contrato del backend). */
interface DevolucionItemDTO {
 id_detalle: number;
 detalle_venta_id: number;
 id_producto: number;
 nombre_producto: string | null;
 cantidad_devuelta: number;
 precio_unitario: number;
 subtotal: number;
}

/** DTO completo de la devolución (coincide con `_serializar_devolucion` backend). */
interface DevolucionDTO {
 id_devolucion: number;
 id_venta: number;
 codigo_venta: string | null;
 estado: EstadoDevolucion;
 motivo: string;
 motivo_rechazo: string | null;
 fecha_solicitud: string;
 fecha_procesado: string | null;
 monto_total_devuelto: number;
 cliente_id: string;
 cliente_nombre: string | null;
 solicitante_id: string;
 procesador_id: string | null;
 procesador_nombre: string | null;
 items: DevolucionItemDTO[];
}

/** Envelope del GET paginado: lista en data + extras de paginación. */
interface DevolucionesPageEnvelope extends ApiResponse<DevolucionDTO[]> {
 total: number;
 page: number;
 limit: number;
 pages: number;
}

/** Envelope de un GET unitario o un PATCH. */
type DevolucionEnvelope = ApiResponse<DevolucionDTO>;

@Injectable({ providedIn: 'root' })
export class DevolucionesService {
 private readonly api = inject(ApiService);

 /**
 * GET /devoluciones — listado paginado con visibilidad por rol.
 * Devuelve el envelope mapeado a {items, total, page, limit, pages}.
 */
 listar(filtros: DevolucionFiltros = {}): Observable<DevolucionListado> {
 const params: string[] = [];
 if (filtros.estado) params.push(`estado=${filtros.estado}`);
 if (filtros.id_venta) params.push(`id_venta=${filtros.id_venta}`);
 if (filtros.q) params.push(`q=${encodeURIComponent(filtros.q)}`);
 params.push(`page=${filtros.page ?? 1}`);
 params.push(`limit=${filtros.limit ?? 20}`);

 return this.api
 .get<DevolucionesPageEnvelope>(`/devoluciones?${params.join('&')}`)
 .pipe(
 map((resp) => ({
 items: resp.data.map((dto) => this.mapDevolucion(dto)),
 total: resp.total,
 page: resp.page,
 limit: resp.limit,
 pages: resp.pages,
 })),
 );
 }

 /** GET /devoluciones/{id} — detalle completo con líneas. */
 obtener(id: number): Observable<Devolucion> {
 return this.api
 .get<DevolucionEnvelope>(`/devoluciones/${id}`)
 .pipe(map((resp) => this.mapDevolucion(resp.data)));
 }

 /**
 * GET /ventas?q=... — buscador de ventas para iniciar una devolución.
 * Filtra transacciones pagadas por código (ATT-XXXXXX) o cliente.
 */
 buscarVentas(q: string, limit = 8): Observable<VentaBusquedaResumen[]> {
 const query = encodeURIComponent(q.trim());
 return this.api
 .get<ApiResponse<any[]>>(`/ventas?q=${query}&estado_pago=PAGADO&limit=${limit}`)
 .pipe(
 map((resp) =>
 (resp.data ?? []).map((v) => ({
 id_venta: v.id_venta,
 codigo: v.codigo,
 fecha_venta: v.fecha_venta,
 total: Number(v.total),
 estado_pago: v.estado_pago,
 metodo_pago: v.metodo_pago,
 nombre_cliente:
 v.datos_entrega?.nombre_cliente || v.nombre_cliente || 'Cliente',
 correo: v.datos_entrega?.correo || v.correo || '',
 tipo_venta: v.tipo_venta || (v.vendedor_id ? 'POS' : 'ONLINE'),
 items_count: Array.isArray(v.items) ? v.items.length : 0,
 })),
 ),
 );
 }

 /** GET /devoluciones/venta/{id_venta}/elegibles — líneas disponibles para devolver. */
 obtenerElegiblesVenta(idVenta: number): Observable<VentaElegiblesDevolucion> {
 return this.api
 .get<ApiResponse<VentaElegiblesDevolucion>>(
 `/devoluciones/venta/${idVenta}/elegibles`,
 )
 .pipe(map((resp) => resp.data));
 }

 /** POST /devoluciones — registra una nueva devolución (cliente o personal de tienda). */
 crear(payload: DevolucionCrearPayload): Observable<Devolucion> {
 return this.api
 .post<DevolucionEnvelope>('/devoluciones', payload)
 .pipe(map((resp) => this.mapDevolucion(resp.data)));
 }

 /**
 * PATCH /devoluciones/{id}/procesar — APROBAR | RECHAZAR | COMPLETAR.
 * Devuelve la devolución actualizada (con su nuevo estado).
 */
 procesar(
 id: number,
 payload: DevolucionProcesarPayload,
 ): Observable<Devolucion> {
 return this.api
 .patch<DevolucionEnvelope>(`/devoluciones/${id}/procesar`, payload)
 .pipe(map((resp) => this.mapDevolucion(resp.data)));
 }

 // -------------------------------------------------------------- mapeo DTOs
 /** DTO backend -> modelo Devolucion compartido con la vista. */
 private mapDevolucion(dto: DevolucionDTO): Devolucion {
 return {
 id_devolucion: dto.id_devolucion,
 id_venta: dto.id_venta,
 codigo_venta: dto.codigo_venta,
 estado: dto.estado,
 motivo: dto.motivo,
 motivo_rechazo: dto.motivo_rechazo,
 fecha_solicitud: dto.fecha_solicitud,
 fecha_procesado: dto.fecha_procesado,
 monto_total_devuelto: dto.monto_total_devuelto,
 cliente_id: dto.cliente_id,
 cliente_nombre: dto.cliente_nombre,
 solicitante_id: dto.solicitante_id,
 procesador_id: dto.procesador_id,
 procesador_nombre: dto.procesador_nombre,
 items: (dto.items ?? []).map((it) => this.mapItem(it)),
 };
 }

 /** DTO backend -> DevolucionItem. */
 private mapItem(dto: DevolucionItemDTO): DevolucionItem {
 return {
 id_detalle: dto.id_detalle,
 detalle_venta_id: dto.detalle_venta_id,
 id_producto: dto.id_producto,
 nombre_producto: dto.nombre_producto,
 cantidad_devuelta: dto.cantidad_devuelta,
 precio_unitario: dto.precio_unitario,
 subtotal: dto.subtotal,
 };
 }
}
