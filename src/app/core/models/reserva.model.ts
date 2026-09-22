/**
 * Gestionar Reserva de Prendas: modelos del contrato.
 * Actualizado con ciclo de vida comercial automático:
 * - Anticipo obligatorio del 50% vía Stripe o QR para confirmar.
 * - Temporizador estricto de expiración de 48 horas (2 días).
 * - Política de expiración con reembolso del 50% y retención del 50% por penalización.
 */

/** Estados de la reserva (ciclo de vida ). */
export type EstadoReserva = 'PENDIENTE' | 'CONFIRMADA' | 'CANCELADA' | 'COMPLETADA';

/** Estados desde los que se permite CONFIRMAR una reserva pagando anticipo. */
export const ESTADOS_CONFIRMABLES: EstadoReserva[] = ['PENDIENTE'];

/** Estados desde los que se permite COMPLETAR la venta. */
export const ESTADOS_COMPLETAR_VENTA: EstadoReserva[] = ['CONFIRMADA'];

/** Estados desde los que se permite cancelar. */
export const ESTADOS_CANCELABLES: EstadoReserva[] = ['PENDIENTE', 'CONFIRMADA'];

/** Prenda incluida en la reserva (nombre + unidades reservadas). */
export interface PrendaReserva {
 id_producto?: number;
 nombre: string;
 cantidad: number;
 precio_unitario?: number;
}

/** Reserva de prendas del cliente con auditoría financiera y expiración. */
export interface Reserva {
 id: number;
 id_sucursal?: number | null;
 sucursal_nombre?: string | null;
 tipo_entrega?: 'RETIRO' | 'DOMICILIO';
 direccion_entrega?: string | null;
 telefono_entrega?: string | null;
 cliente_nombre: string;
 cliente_correo?: string;
 /** Prendas reservadas (chips en la tabla). */
 prendas: PrendaReserva[];
 fecha_reserva: string; // ISO datetime
 fecha_expiracion: string; // ISO date
 fecha_confirmacion?: string | null; // ISO datetime
 fecha_expiracion_dt?: string | null; // ISO datetime con temporizador de 48h
 estado: EstadoReserva;
 /** Total estimado de la reserva en Bs. */
 total_estimado: number;
 /** 50% del total requerido para confirmar */
 monto_anticipo: number;
 /** Monto efectivamente abonado por anticipo */
 monto_anticipo_pagado: number;
 /** Monto devuelto al cliente por expiración (50% del anticipo) */
 monto_reembolsado: number;
 /** Monto retenido como penalización de stock (50% del anticipo) */
 monto_penalizacion: number;
 metodo_pago_anticipo?: string | null;
 codigo_transaccion_anticipo?: string | null;
 motivo_cancelacion?: string | null;
 /** Minutos restantes hasta las 48h de expiración */
 minutos_restantes?: number | null;
 /** Flag si ya venció el plazo de 48h */
 es_expirada: boolean;
}

/** Payload de pago de anticipo (50%) */
export interface PagarAnticipoPayload {
 metodo_pago: 'QR' | 'TARJETA';
 referencia_pago?: string;
}

/** Payload de creación de reserva (modal). */
export interface ReservaCreatePayload {
 cliente_nombre?: string;
 id_cliente?: string;
 id_sucursal?: number;
 tipo_entrega?: 'RETIRO' | 'DOMICILIO';
 direccion_entrega?: string;
 telefono_entrega?: string;
 prendas: PrendaReserva[];
 fecha_expiracion?: string;
 total_estimado: number;
}
