/**
 * CU14 — Gestionar Reserva de Prendas: modelos del contrato.
 * FASE MOCK: el service consume datos en memoria; cuando llegue el
 * backend real (/api/v1/reservas...), solo cambia la implementación
 * del service — este contrato no se mueve.
 */

/** Estados de la reserva (ciclo de vida CU14). */
export type EstadoReserva = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA';

/** Estados desde los que se permite CONFIRMAR una reserva. */
export const ESTADOS_CONFIRMABLES: EstadoReserva[] = ['PENDIENTE'];

/** Estados desde los que se permite COMPLETAR la venta. */
export const ESTADOS_COMPLETAR_VENTA: EstadoReserva[] = ['CONFIRMADA'];

/** Estados desde los que se permite cancelar. */
export const ESTADOS_CANCELABLES: EstadoReserva[] = ['PENDIENTE', 'CONFIRMADA'];

/** Prenda incluida en la reserva (nombre + unidades reservadas). */
export interface PrendaReserva {
  nombre: string;
  cantidad: number;
}

/** Reserva de prendas del cliente (CU14). */
export interface Reserva {
  id: number;
  cliente_nombre: string;
  /** Prendas reservadas (chips en la tabla). */
  prendas: PrendaReserva[];
  fecha_reserva: string; // ISO datetime
  fecha_expiracion: string; // ISO date
  estado: EstadoReserva;
  /** Total estimado de la reserva en Bs. */
  total_estimado: number;
}

/** Payload de creación de reserva (modal). */
export interface ReservaCreatePayload {
  cliente_nombre: string;
  prendas: PrendaReserva[];
  fecha_expiracion: string;
  total_estimado: number;
}
