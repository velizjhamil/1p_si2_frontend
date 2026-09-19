/**
 * CU13 — Gestión de Devoluciones: modelos del contrato backend.
 *
 * Coincide 1-a-1 con la respuesta de `app/api/v1/endpoints/devoluciones.py`
 * (envelope {status, data, message} + metadatos de paginación en el GET).
 *
 * Estados del CHECK en la DB:
 *   - SOLICITADA: cliente pidió la devolución; está a la espera.
 *   - APROBADA: V/GS/ASU aceptó la solicitud; aún no se mueve stock.
 *   - RECHAZADA: V/GS/ASU rechazó (motivo_rechazo obligatorio).
 *   - COMPLETADA: APROBADA -> COMPLETADA, devuelve stock al kardex (CU22).
 */
export type EstadoDevolucion = 'SOLICITADA' | 'APROBADA' | 'RECHAZADA' | 'COMPLETADA';

/** Acción que se envía al PATCH /api/v1/devoluciones/{id}/procesar. */
export type AccionDevolucion = 'APROBAR' | 'RECHAZAR' | 'COMPLETAR';

/** Ítem de la devolución (línea de detalle). */
export interface DevolucionItem {
  id_detalle: number;
  detalle_venta_id: number;
  id_producto: number;
  nombre_producto: string | null;
  cantidad_devuelta: number;
  precio_unitario: number;
  subtotal: number;
}

/** Devolución completa (GET /api/v1/devoluciones/{id}). */
export interface Devolucion {
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
  items: DevolucionItem[];
}

/** Filtros del GET /api/v1/devoluciones. */
export interface DevolucionFiltros {
  estado?: EstadoDevolucion;
  id_venta?: number;
  page?: number;
  limit?: number;
}

/** Respuesta normalizada del listado (items + metadata de paginación). */
export interface DevolucionListado {
  items: Devolucion[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/**
 * Payload PATCH /api/v1/devoluciones/{id}/procesar.
 * motivo_rechazo es obligatorio SOLO cuando accion === 'RECHAZAR'.
 */
export interface DevolucionProcesarPayload {
  accion: AccionDevolucion;
  motivo_rechazo?: string;
}
