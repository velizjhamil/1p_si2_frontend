import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
 CarritoItem,
 DatosEntrega,
 EstadoPago,
 MetodoPago,
 Venta,
} from '../../core/models/carrito.model';

/**
 * Historial y Detalle de Ventas.
 *
 * Consume los endpoints reales del backend FastAPI:
 * - GET /api/v1/ventas/?q=&metodo_pago=&estado_pago=&page=&limit=
 * Historial paginado; el Cliente (rol C) solo ve sus ventas.
 * - GET /api/v1/ventas/{id_venta}
 * Detalle completo con items y datos de entrega.
 *
 * Mapea los DTOs del backend (id_venta, fecha_venta, items con
 * precio_unitario, datos_entrega anidado) al modelo `Venta` que ya
 * comparte el checkout (id, fecha, items, datos_entrega). El
 * envelope {status, data, message, total, page, limit, pages} se
 * desempaqueta acá; los 4xx del backend llegan al componente como
 * errores HTTP con {error: {detail}}.
 *
 * `Venta.items: CarritoItem[]` exige color_hex e imagen_url que el
 * backend no devuelve: se completan con valores neutros para que la
 * vista no rompa (mismo criterio que `CarritoService.mapVenta`).
 */

/** DTO de un ítem de la venta (contrato del backend). */
interface VentaItemDTO {
 id_detalle: number;
 producto_id: number;
 nombre: string;
 talla: string;
 color: string;
 cantidad: number;
 precio_unitario: number;
 subtotal: number;
}

/** DTO de los datos de entrega anidados en la venta. */
interface VentaEntregaDTO {
 nombre_cliente: string;
 correo: string;
 telefono: string;
 direccion: string;
 ciudad: string;
 referencia: string | null;
}

/** DTO completo de una venta (coincide con `_serializar_venta` backend). */
interface VentaDTO {
 id_venta: number;
 codigo: string;
 fecha_venta: string;
 total: number;
 costo_envio: number;
 metodo_pago: MetodoPago;
 estado_pago: EstadoPago;
 comprobante_url: string | null;
 items: VentaItemDTO[];
 datos_entrega: VentaEntregaDTO;
 cliente_id: string;
 /** id del vendedor que registró la venta (null en ONLINE). */
 vendedor_id: string | null;
 /** tipo de venta (ONLINE | POS). */
 tipo_venta: 'ONLINE' | 'POS';
 /** DOMICILIO (genera envío) | RETIRO. */
 tipo_entrega?: 'DOMICILIO' | 'RETIRO';
 id_sucursal?: number | null;
 sucursal_nombre?: string | null;
}

/** Envelope del GET paginado: lista en data + extras de paginación. */
interface VentasPageEnvelope extends ApiResponse<VentaDTO[]> {
 total: number;
 page: number;
 limit: number;
 pages: number;
}

/** Envelope de un GET unitario. */
type VentaEnvelope = ApiResponse<VentaDTO>;

/** Filtros de la pantalla de historial de ventas. */
export interface VentaFiltros {
 q?: string;
 metodo_pago?: MetodoPago;
 estado_pago?: EstadoPago;
 /** filtra por tipo de venta (ONLINE | POS). */
 tipo_venta?: 'ONLINE' | 'POS';
 /** Multi-sucursal: filtro por sucursal (para ASU). */
 sucursal_id?: number | null;
 /** rango de fechas (YYYY-MM-DD, inclusivo en ambos extremos). */
 fecha_desde?: string;
 fecha_hasta?: string;
 page?: number;
 limit?: number;
}

/** Respuesta normalizada del listado (items + metadata de paginación). */
export interface VentaListado {
 items: Venta[];
 total: number;
 page: number;
 limit: number;
 pages: number;
}

@Injectable({ providedIn: 'root' })
export class VentasService {
 private readonly api = inject(ApiService);

 /**
 * GET /ventas — historial paginado.
 * Devuelve el envelope completo mapeado a {items, total, page, limit, pages}
 * para que la vista pueda paginar sin re-procesar el contrato HTTP.
 */
 listar(filtros: VentaFiltros = {}): Observable<VentaListado> {
 const params: string[] = [];
 if (filtros.q) params.push(`q=${encodeURIComponent(filtros.q)}`);
 if (filtros.metodo_pago) params.push(`metodo_pago=${filtros.metodo_pago}`);
 if (filtros.estado_pago) params.push(`estado_pago=${filtros.estado_pago}`);
 if (filtros.tipo_venta) params.push(`tipo_venta=${filtros.tipo_venta}`);
 if (filtros.sucursal_id) params.push(`sucursal_id=${filtros.sucursal_id}`);
 if (filtros.fecha_desde) params.push(`fecha_desde=${filtros.fecha_desde}`);
 if (filtros.fecha_hasta) params.push(`fecha_hasta=${filtros.fecha_hasta}`);
 params.push(`page=${filtros.page ?? 1}`);
 params.push(`limit=${filtros.limit ?? 20}`);

 return this.api.get<VentasPageEnvelope>(`/ventas?${params.join('&')}`).pipe(
 map((resp) => ({
 items: resp.data.map((dto) => this.mapVenta(dto)),
 total: resp.total,
 page: resp.page,
 limit: resp.limit,
 pages: resp.pages,
 })),
 );
 }

 /** GET /ventas/{id} — detalle completo (items + datos de entrega). */
 obtener(id: number): Observable<Venta> {
 return this.api
 .get<VentaEnvelope>(`/ventas/${id}`)
 .pipe(map((resp) => this.mapVenta(resp.data)));
 }

 /** Liquidar cobro en efectivo en mostrador con generación de comprobante. */
 cobrarEnEfectivo(payload: {
 id_reserva?: number;
 id_venta?: number;
 monto_recibido?: number;
 }): Observable<{
 venta: Venta;
 reserva_liquidada_id?: number | null;
 monto_total: number;
 monto_recibido: number;
 cambio_devuelto: number;
 fecha_cobro: string;
 codigo_comprobante: string;
 vendedor_nombre: string;
 sucursal_nombre: string;
 }> {
 return this.api
 .post<ApiResponse<any>>('/ventas/cobrar-efectivo', payload)
 .pipe(
 map((resp) => {
 const data = resp.data;
 return {
 ...data,
 venta: this.mapVenta(data.venta),
 };
 }),
 );
 }

 // -------------------------------------------------------------- mapeo DTOs
 /** DTO backend -> modelo Venta compartido con el checkout. */
 private mapVenta(dto: VentaDTO): Venta {
 return {
 id: dto.id_venta,
 codigo: dto.codigo,
 fecha: dto.fecha_venta,
 total: dto.total,
 metodo_pago: dto.metodo_pago,
 estado_pago: dto.estado_pago,
 items: (dto.items ?? []).map((it) => this.mapItem(it)),
 datos_entrega: this.mapEntrega(dto.datos_entrega),
 vendedor_id: dto.vendedor_id ?? null,
 tipo_venta: dto.tipo_venta ?? 'ONLINE',
 tipo_entrega: dto.tipo_entrega,
 id_sucursal: dto.id_sucursal ?? null,
 sucursal_nombre: dto.sucursal_nombre ?? null,
 };
 }

 /** DTO backend -> CarritoItem (mapea precio_unitario -> precio). */
 private mapItem(dto: VentaItemDTO): CarritoItem {
 return {
 producto_id: dto.producto_id,
 nombre: dto.nombre,
 talla: dto.talla,
 color: dto.color,
 // El backend no expone color_hex ni imagen_url: se completan con
 // valores neutros para que la UI no rompa (mismo criterio del checkout).
 color_hex: '#1d528d',
 precio: dto.precio_unitario,
 cantidad: dto.cantidad,
 subtotal: dto.subtotal,
 imagen_url: null,
 };
 }

 /** DTO backend -> DatosEntrega. */
 private mapEntrega(dto: VentaEntregaDTO): DatosEntrega {
 return {
 nombre_cliente: dto.nombre_cliente,
 correo: dto.correo,
 telefono: dto.telefono,
 direccion: dto.direccion,
 ciudad: dto.ciudad,
 referencia: dto.referencia ?? undefined,
 };
 }
}
