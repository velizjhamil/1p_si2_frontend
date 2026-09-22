/**
 * Gestión de Devoluciones: modelos del contrato backend.
 *
 * Coincide 1-a-1 con la respuesta de `app/api/v1/endpoints/devoluciones.py`
 * (envelope {status, data, message} + metadatos de paginación en el GET).
 *
 * Estados del CHECK en la DB:
 * - SOLICITADA: cliente pidió la devolución; está a la espera.
 * - APROBADA: V/GS/ASU aceptó la solicitud; aún no se mueve stock.
 * - RECHAZADA: V/GS/ASU rechazó (motivo_rechazo obligatorio).
 * - COMPLETADA: APROBADA -> COMPLETADA, devuelve stock al kardex.
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
  q?: string;
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

/** Ítem elegible para devolución de una venta (GET /api/v1/devoluciones/venta/{id}/elegibles). */
export interface ItemElegibleDevolucion {
  detalle_venta_id: number;
  id_producto: number;
  nombre: string;
  talla: string | null;
  color: string | null;
  cantidad_original: number;
  ya_devuelto: number;
  disponible_para_devolver: number;
  precio_unitario: number;
}

/** Detalle de venta con líneas elegibles para formular la devolución. */
export interface VentaElegiblesDevolucion {
  id_venta: number;
  codigo: string;
  fecha_venta: string;
  en_ventana: boolean;
  items: ItemElegibleDevolucion[];
}

/** Línea a devolver en la creación de una devolución (POST /api/v1/devoluciones). */
export interface DevolucionCrearItemPayload {
  detalle_venta_id: number;
  cantidad_devuelta: number;
}

/** Payload completo de creación de devolución (POST /api/v1/devoluciones). */
export interface DevolucionCrearPayload {
  id_venta: number;
  motivo: string;
  items: DevolucionCrearItemPayload[];
}

/** Resumen de venta retornado por el buscador. */
export interface VentaBusquedaResumen {
  id_venta: number;
  codigo: string;
  fecha_venta: string;
  total: number;
  estado_pago: string;
  metodo_pago: string;
  nombre_cliente: string;
  correo: string;
  tipo_venta: string;
  items_count?: number;
}
