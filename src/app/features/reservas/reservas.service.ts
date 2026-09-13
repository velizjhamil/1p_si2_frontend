import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
  EstadoReserva,
  PrendaReserva,
  Reserva,
  ReservaCreatePayload,
} from '../../core/models/reserva.model';

/**
 * CU14 — Gestionar Reserva de Prendas.
 *
 * Consume los endpoints reales del backend FastAPI:
 * - GET /api/v1/reservas (filtros: estado, búsqueda por cliente)
 * - POST /api/v1/reservas (crea y aparta stock)
 * - PATCH /api/v1/reservas/{id}/estado (CONFIRMADA | CANCELADA | COMPLETADA)
 * - DELETE /api/v1/reservas/{id} (anula y devuelve stock si corresponde)
 *
 * Mapea los DTOs del backend (id_reserva, cliente{...}, productos[...]) a
 * los modelos planos del componente (id, cliente_nombre, prendas[]) para
 * que la vista no conozca el contrato HTTP. El envelope {status, data,
 * message} se desempaqueta aquí; los 409/422/404 del backend llegan al
 * componente como errores HTTP con {error: {detail}}.
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
  cliente: ClienteDTO;
  fecha_reserva: string;
  fecha_expiracion: string;
  estado: EstadoReserva;
  total_estimado: number;
  motivo_cancelacion: string | null;
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

  /** GET /reservas — lista completa (limit alto: panel de gestión). */
  getReservas(estado?: EstadoReserva, q?: string): Observable<Reserva[]> {
    const params: string[] = ['limit=100'];
    if (estado) params.push(`estado=${estado}`);
    if (q) params.push(`q=${encodeURIComponent(q)}`);
    return this.api
      .get<PageEnvelope>(`/reservas?${params.join('&')}`)
      .pipe(map((resp) => resp.data.map((dto) => this.mapReserva(dto))));
  }

  /**
   * PATCH /reservas/{id}/estado — transiciones del ciclo de vida.
   * Backend valida la matriz: PENDIENTE→CONFIRMADA→COMPLETADA,
   * PENDIENTE/CONFIRMADA→CANCELADA (409 en el resto).
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

  /** POST /reservas — crea la reserva y aparta el stock. */
  crearReserva(payload: ReservaCreatePayload): Observable<Reserva> {
    // El frontend del panel usa {cliente_nombre, prendas, fecha_expiracion,
    // total_estimado}; el backend espera {fecha_expiracion, items[]}.
    // Las prendas del mock no tienen id_producto real — por ahora se mapea
    // el payload del modelo al contrato con los ids conocidos del catálogo.
    const items: ReservaItemBackend[] = payload.prendas
      .filter((p) => p.cantidad > 0)
      .map((p) => ({
        id_producto: (p as PrendaReserva & { id_producto?: number }).id_producto ?? 0,
        cantidad: p.cantidad,
        precio_unitario: payload.total_estimado > 0
          ? payload.total_estimado / payload.prendas.reduce((s, x) => s + x.cantidad, 0)
          : 0,
      }));

    return this.api
      .post<ApiResponse<ReservaDTO>>('/reservas', {
        fecha_expiracion: payload.fecha_expiracion,
        items,
      })
      .pipe(map((resp) => this.mapReserva(resp.data)));
  }

  /**
   * PATCH /reservas/{id}/estado con CANCELADA — devuelve el stock apartado.
   * (El DELETE físico queda para la anulación administrativa.)
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
    return {
      id: dto.id_reserva,
      cliente_nombre: `${dto.cliente.nombre} ${dto.cliente.apellido ?? ''}`.trim(),
      prendas: dto.productos.map(
        (p): PrendaReserva => ({ nombre: p.nombre, cantidad: p.cantidad }),
      ),
      fecha_reserva: dto.fecha_reserva,
      fecha_expiracion: dto.fecha_expiracion,
      estado: dto.estado,
      total_estimado: Number(dto.total_estimado),
    };
  }
}
