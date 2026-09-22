import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
 EstadoReserva,
 PagarAnticipoPayload,
 PrendaReserva,
 Reserva,
 ReservaCreatePayload,
} from '../../core/models/reserva.model';

/**
 * Gestionar Reserva de Prendas.
 *
 * Consume los endpoints del backend FastAPI:
 * - GET /api/v1/reservas (filtros: estado, búsqueda por cliente, auto-expiración 48h)
 * - POST /api/v1/reservas (crea, calcula 50% de anticipo y aparta stock)
 * - POST /api/v1/reservas/{id}/pagar-anticipo (pago del 50% vía Stripe o QR -> CONFIRMADA con timer 48h)
 * - POST /api/v1/reservas/procesar-expiraciones (gatillo de expiraciones con reembolso del 50%)
 * - PATCH /api/v1/reservas/{id}/estado (CONFIRMADA | CANCELADA | COMPLETADA)
 * - DELETE /api/v1/reservas/{id} (anula y devuelve stock si corresponde)
 */

/** DTO de cliente embebido en la respuesta del backend. */
interface ClienteDTO {
 id_usuario: string;
 nombre: string;
 apellido: string | null;
 correo: string;
}

/** DTO de producto reservado (línea de detalle). */
interface ProductoReservadoDTO {
 id_detalle: number;
 id_producto: number;
 nombre: string;
 cantidad: number;
 precio_unitario: number;
}

/** DTO completo de la reserva (contrato /api/v1/reservas). */
interface ReservaDTO {
 id_reserva: number;
 id_sucursal: number | null;
 sucursal_nombre: string | null;
 tipo_entrega?: 'RETIRO' | 'DOMICILIO';
 direccion_entrega?: string | null;
 telefono_entrega?: string | null;
 cliente: ClienteDTO;
 fecha_reserva: string;
 fecha_expiracion: string;
 fecha_confirmacion: string | null;
 fecha_expiracion_dt: string | null;
 estado: EstadoReserva;
 total_estimado: number;
 monto_anticipo: number;
 monto_anticipo_pagado: number;
 monto_reembolsado: number;
 monto_penalizacion: number;
 metodo_pago_anticipo: string | null;
 codigo_transaccion_anticipo: string | null;
 motivo_cancelacion: string | null;
 minutos_restantes: number | null;
 es_expirada: boolean;
 productos: ProductoReservadoDTO[];
}

/** Envelope del GET paginado: lista en data + extras de paginación. */
interface PageEnvelope extends ApiResponse<ReservaDTO[]> {
 total: number;
 page: number;
 limit: number;
 pages: number;
}

/** Payload de creación en el contrato del backend. */
interface ReservaItemBackend {
 id_producto: number;
 cantidad: number;
 precio_unitario: number;
}

@Injectable({ providedIn: 'root' })
export class ReservasService {
 private readonly api = inject(ApiService);

 /** GET /reservas — lista completa con verificación automática de 48h. */
 getReservas(estado?: EstadoReserva, q?: string): Observable<Reserva[]> {
 const params: string[] = ['limit=100'];
 if (estado) params.push(`estado=${estado}`);
 if (q) params.push(`q=${encodeURIComponent(q)}`);
 return this.api
 .get<PageEnvelope>(`/reservas?${params.join('&')}`)
 .pipe(map((resp) => (resp.data || []).map((dto) => this.mapReserva(dto))));
 }

 /**
 * POST /reservas/{id}/pagar-anticipo — Pago del 50% de anticipo (Stripe o QR).
 * Pasa la reserva de PENDIENTE a CONFIRMADA y activa el temporizador estricto de 48h.
 */
 pagarAnticipo(id: number, payload: PagarAnticipoPayload): Observable<Reserva> {
 return this.api
 .post<ApiResponse<ReservaDTO>>(`/reservas/${id}/pagar-anticipo`, payload)
 .pipe(map((resp) => this.mapReserva(resp.data)));
 }

 /**
 * POST /reservas/procesar-expiraciones — Verifica y ejecuta la regla comercial
 * de 48 horas: reembolso del 50%, retención del 50% y devolución de prendas al inventario.
 */
 procesarExpiraciones(
 idSucursal?: number,
 ): Observable<{ procesadas: number; reservas: Reserva[] }> {
 const query = idSucursal ? `?id_sucursal=${idSucursal}` : '';
 return this.api
 .post<ApiResponse<{ procesadas: number; reservas: ReservaDTO[] }>>(
 `/reservas/procesar-expiraciones${query}`,
 {},
 )
 .pipe(
 map((resp) => ({
 procesadas: resp.data?.procesadas ?? 0,
 reservas: (resp.data?.reservas || []).map((dto) => this.mapReserva(dto)),
 })),
 );
 }

 /**
 * PATCH /reservas/{id}/estado — transiciones del ciclo de vida.
 * CONFIRMADA (manual) | COMPLETADA (venta finalizada).
 */
 cambiarEstadoReserva(
 id: number,
 nuevoEstado: Extract<EstadoReserva, 'CONFIRMADA' | 'COMPLETADA'>,
 ): Observable<Reserva> {
 return this.api
 .patch<ApiResponse<ReservaDTO>>(`/reservas/${id}/estado`, {
 estado: nuevoEstado,
 })
 .pipe(map((resp) => this.mapReserva(resp.data)));
 }

 /** POST /reservas — crea la reserva, calcula 50% anticipo y aparta el stock. */
 crearReserva(payload: ReservaCreatePayload): Observable<Reserva> {
 const items: ReservaItemBackend[] = payload.prendas
 .filter((p) => p.cantidad > 0)
 .map((p) => ({
 id_producto: p.id_producto ?? 0,
 cantidad: p.cantidad,
 precio_unitario:
 p.precio_unitario ??
 (payload.total_estimado > 0
 ? payload.total_estimado / payload.prendas.reduce((s, x) => s + x.cantidad, 0)
 : 0),
 }));

 return this.api
 .post<ApiResponse<ReservaDTO>>('/reservas', {
 id_cliente: payload.id_cliente,
 id_sucursal: payload.id_sucursal,
 fecha_expiracion: payload.fecha_expiracion,
 tipo_entrega: payload.tipo_entrega || 'RETIRO',
 direccion_entrega: payload.direccion_entrega,
 telefono_entrega: payload.telefono_entrega,
 items,
 })
 .pipe(map((resp) => this.mapReserva(resp.data)));
 }

 /**
 * PATCH /reservas/{id}/estado con CANCELADA — devuelve el stock apartado.
 */
 cancelarReserva(id: number, motivo?: string): Observable<Reserva> {
 return this.api
 .patch<ApiResponse<ReservaDTO>>(`/reservas/${id}/estado`, {
 estado: 'CANCELADA',
 motivo_cancelacion: motivo ?? 'Cancelada desde el panel de gestión.',
 })
 .pipe(map((resp) => this.mapReserva(resp.data)));
 }

 /** DELETE /reservas/{id} — anula físicamente (devuelve stock si apartado). */
 eliminarReserva(id: number): Observable<ApiResponse<null>> {
 return this.api.delete<ApiResponse<null>>(`/reservas/${id}`);
 }

 // -------------------------------------------------------------- mapeo DTOs
 /** DTO backend -> modelo del componente. */
 private mapReserva(dto: ReservaDTO): Reserva {
 const clienteNombre = dto.cliente
 ? `${dto.cliente.nombre || ''} ${dto.cliente.apellido || ''}`.trim()
 : 'Cliente';

 return {
 id: dto.id_reserva,
 id_sucursal: dto.id_sucursal,
 sucursal_nombre: dto.sucursal_nombre,
 tipo_entrega: dto.tipo_entrega || 'RETIRO',
 direccion_entrega: dto.direccion_entrega,
 telefono_entrega: dto.telefono_entrega,
 cliente_nombre: clienteNombre || 'Cliente Anónimo',
 cliente_correo: dto.cliente?.correo,
 prendas: (dto.productos || []).map(
 (p): PrendaReserva => ({
 id_producto: p.id_producto,
 nombre: p.nombre,
 cantidad: p.cantidad,
 precio_unitario: Number(p.precio_unitario || 0),
 }),
 ),
 fecha_reserva: dto.fecha_reserva,
 fecha_expiracion: dto.fecha_expiracion,
 fecha_confirmacion: dto.fecha_confirmacion,
 fecha_expiracion_dt: dto.fecha_expiracion_dt,
 estado: dto.estado,
 total_estimado: Number(dto.total_estimado || 0),
 monto_anticipo: Number(dto.monto_anticipo || 0),
 monto_anticipo_pagado: Number(dto.monto_anticipo_pagado || 0),
 monto_reembolsado: Number(dto.monto_reembolsado || 0),
 monto_penalizacion: Number(dto.monto_penalizacion || 0),
 metodo_pago_anticipo: dto.metodo_pago_anticipo,
 codigo_transaccion_anticipo: dto.codigo_transaccion_anticipo,
 motivo_cancelacion: dto.motivo_cancelacion,
 minutos_restantes: dto.minutos_restantes,
 es_expirada: !!dto.es_expirada,
 };
 }
}
