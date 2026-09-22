/**
 * Gestión de Notificaciones: modelos del contrato backend.
 *
 * Coincide 1-a-1 con `app/api/v1/endpoints/notificaciones.py` (envelope
 * estándar {status, data, message} + metadatos de paginación).
 *
 * Los `tipo` válidos están alineados con el CHECK de la DB y son los
 * que el `BadgeComponent` debe colorear de manera distinta.
 */
export type TipoNotificacion =
 | 'INFO'
 | 'WARNING'
 | 'ERROR'
 | 'SUCCESS'
 | 'STOCK'
 | 'PEDIDO'
 | 'DEVOLUCION'
 | 'SISTEMA';

/** Notificación (GET/POST /api/v1/notificaciones). */
export interface Notificacion {
 id_notificacion: number;
 id_usuario: string;
 titulo: string;
 mensaje: string;
 tipo: TipoNotificacion;
 leida: boolean;
 fecha_creacion: string;
 /** Tipo de recurso para deep-link (ej: 'venta', 'devolucion'). Opcional. */
 referencia_tipo: string | null;
 /** Id del recurso para deep-link (ej: '42'). Opcional. */
 referencia_id: string | null;
}

/** Filtros del GET /api/v1/notificaciones. */
export interface NotificacionFiltros {
 solo_no_leidas?: boolean;
 page?: number;
 limit?: number;
}

/** Respuesta normalizada del listado. */
export interface NotificacionListado {
 items: Notificacion[];
 total: number;
 total_no_leidas: number;
 page: number;
 limit: number;
 pages: number;
}

/** Payload POST /api/v1/notificaciones (solo ASU/GS vía HTTP). */
export interface NotificacionCreatePayload {
 id_usuario: string;
 titulo: string;
 mensaje: string;
 tipo?: TipoNotificacion;
 referencia_tipo?: string | null;
 referencia_id?: string | null;
}
