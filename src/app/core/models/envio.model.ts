/**
 * Gestión de Envío: modelos del contrato backend.
 *
 * Coincide 1-a-1 con `app/api/v1/endpoints/envios.py` y
 * `app/modules/delivery/service.py` (envelope {status, data, message} +
 * metadatos de paginación en el listado). Las fechas llegan como ISO 8601
 * (string); las que se ENVÍAN deben ir con offset (ej. `toISOString()`):
 * el backend interpreta un datetime sin zona horaria como UTC.
 *
 * Ciclo de vida (CHECK en la DB, transiciones validadas por el backend):
 * PREPARANDO -> LISTO_ENVIO -> ASIGNADO -> EN_RUTA -> ENTREGADO
 * EN_RUTA -> INTENTO_FALLIDO -> REPROGRAMADO -> EN_RUTA (continúa)
 * CANCELADO: desde PREPARANDO, LISTO_ENVIO, ASIGNADO, INTENTO_FALLIDO o
 * REPROGRAMADO (nunca desde EN_RUTA). Solo cierra el flujo logístico: NO
 * cancela la venta, ni repone stock, ni genera devolución/reembolso.
 * ENTREGADO y CANCELADO son terminales; INTENTO_FALLIDO NO lo es.
 *
 * El frontend NO decide las transiciones: usa `Envio.transiciones_permitidas`,
 * que el backend calcula según estado actual Y rol del usuario.
 */
export type EstadoEnvio =
 | 'PREPARANDO'
 | 'LISTO_ENVIO'
 | 'ASIGNADO'
 | 'EN_RUTA'
 | 'ENTREGADO'
 | 'INTENTO_FALLIDO'
 | 'REPROGRAMADO'
 | 'CANCELADO';

/** Estados que acepta PATCH /envios/{id}/estado (el resto tiene endpoint propio). */
export type EstadoEnvioDirecto = 'EN_RUTA' | 'ENTREGADO' | 'CANCELADO';

/** Etiqueta legible de cada estado. */
export const ESTADO_ENVIO_LABEL: Record<EstadoEnvio, string> = {
 PREPARANDO: 'Preparando',
 LISTO_ENVIO: 'Listo para envío',
 ASIGNADO: 'Asignado',
 EN_RUTA: 'En ruta',
 ENTREGADO: 'Entregado',
 INTENTO_FALLIDO: 'Intento fallido',
 REPROGRAMADO: 'Reprogramado',
 CANCELADO: 'Cancelado',
};

/**
 * Texto de la ACCIÓN que lleva un envío a cada estado destino (botones de la
 * UI). PREPARANDO no es destino de ninguna acción: solo se llega al crear.
 */
export const ACCION_ENVIO_LABEL: Partial<Record<EstadoEnvio, string>> = {
 LISTO_ENVIO: 'Confirmar preparación',
 ASIGNADO: 'Asignar repartidor o agencia',
 EN_RUTA: 'Marcar en ruta',
 ENTREGADO: 'Marcar entregado',
 INTENTO_FALLIDO: 'Registrar intento fallido',
 REPROGRAMADO: 'Reprogramar entrega',
 CANCELADO: 'Cancelar envío',
};

/** Variante de `app-badge` (shared) para cada estado. */
export const ESTADO_ENVIO_VARIANT: Record<
 EstadoEnvio,
 'success' | 'info' | 'danger' | 'warning' | 'neutral' | 'accent'
> = {
 PREPARANDO: 'neutral',
 LISTO_ENVIO: 'info',
 ASIGNADO: 'accent',
 EN_RUTA: 'info',
 ENTREGADO: 'success',
 INTENTO_FALLIDO: 'warning',
 REPROGRAMADO: 'warning',
 CANCELADO: 'danger',
};

/** Datos de entrega: snapshot de la venta (no se duplican en el envío). */
export interface EnvioEntrega {
 nombre_cliente: string;
 correo: string;
 telefono: string;
 direccion: string;
 ciudad: string;
 referencia: string | null;
}

/** Prenda incluida en el paquete. */
export interface EnvioItem {
 producto_id: number;
 nombre: string;
 talla: string | null;
 color: string | null;
 cantidad: number;
}

/** Envío completo (GET /api/v1/envios/{id} y respuesta de cada PATCH). */
export interface Envio {
 id_envio: number;
 id_venta: number;
 codigo_venta: string;
 estado: EstadoEnvio;
 /** Destinos válidos desde el estado actual PARA el usuario autenticado. */
 transiciones_permitidas: EstadoEnvio[];

 cliente_id: string;
 cliente_nombre: string;
 total_venta: number;
 datos_entrega: EnvioEntrega;
 items: EnvioItem[];

 /** Sucursal responsable del despacho (null hasta confirmar la preparación). */
 codigo_sucursal: number | null;
 sucursal_nombre: string | null;
 repartidor_id: string | null;
 repartidor_nombre: string | null;

 /**
 * agencia de reparto (alternativa al repartidor propio; nunca ambos).
 * Todos opcionales: los envíos con repartidor no los traen con valor.
 */
 agencia_id?: number | null;
 agencia_nombre?: string | null;
 /**
 * Solo ASU/GS (el cliente y D no los reciben): costo INTERNO que se paga a la
 * agencia (no es ventas.costo_envio), tarifa aplicada y medidas usadas al asignar.
 */
 costo_agencia?: number | null;
 id_tarifa_aplicada?: number | null;
 peso_kg?: number | null;
 volumen_m3?: number | null;

 fecha_estimada_entrega: string | null;
 fecha_entrega_real: string | null;
 /** Motivo del ÚLTIMO intento fallido (el detalle de cada uno está en el historial). */
 motivo_fallo: string | null;
 fecha_reprogramacion: string | null;
 intentos_fallidos: number;
 fecha_creacion: string;
 fecha_actualizacion: string;
}

/** Fila de la bitácora (GET /api/v1/envios/{id}/historial, orden cronológico). */
export interface HistorialEnvio {
 id_historial: number;
 id_envio: number;
 estado_anterior: EstadoEnvio | null;
 estado_nuevo: EstadoEnvio;
 id_usuario: string | null;
 usuario_nombre: string | null;
 observacion: string | null;
 fecha: string;
}

/** Repartidor disponible para asignar (GET /api/v1/envios/repartidores). */
export interface Repartidor {
 id_usuario: string;
 nombre: string;
 correo: string;
 /** Envíos ASIGNADO / EN_RUTA / REPROGRAMADO que lleva actualmente. */
 envios_activos: number;
}

// ---------------------------------------------------------------- payloads
/** POST /envios — inicia el envío de una venta a domicilio que no lo tiene (ASU/GS). */
export interface IniciarEnvioPayload {
 id_venta: number;
 observacion?: string;
}

/** PATCH /envios/{id}/confirmar-preparacion — PREPARANDO -> LISTO_ENVIO. */
export interface ConfirmacionPreparacion {
 codigo_sucursal: number;
 observacion?: string;
}

/** PATCH /envios/{id}/asignar con repartidor propio — LISTO_ENVIO -> ASIGNADO. */
export interface AsignacionRepartidor {
 id_repartidor: string;
 /** ISO 8601 con offset; debe ser futura. */
 fecha_estimada_entrega?: string;
 observacion?: string;
}

/**
 * PATCH /envios/{id}/asignar con AGENCIA de reparto. Exclusivo con
 * `id_repartidor`. El backend cotiza con las tarifas vigentes y guarda la tarifa
 * aplicada, el costo de agencia y estas medidas en el envío.
 */
export interface AsignacionAgencia {
 id_agencia: number;
 /** Peso del envío en kg: > 0, hasta 3 decimales (string para no perder precisión). */
 peso_kg: string;
 /** Volumen del envío en m³: > 0, hasta 3 decimales. */
 volumen_m3: string;
 fecha_estimada_entrega?: string;
 observacion?: string;
}

/** PATCH /envios/{id}/asignar — repartidor propio O agencia (mutuamente excluyentes). */
export type AsignacionEnvio = AsignacionRepartidor | AsignacionAgencia;

/** PATCH /envios/{id}/estado — EN_RUTA | ENTREGADO | CANCELADO (CANCELADO exige observacion). */
export interface ActualizacionEstadoEnvio {
 estado: EstadoEnvioDirecto;
 observacion?: string;
}

/** PATCH /envios/{id}/intento-fallido — EN_RUTA -> INTENTO_FALLIDO (motivo 5..255). */
export interface IntentoFallidoEnvio {
 motivo: string;
 observacion?: string;
}

/** PATCH /envios/{id}/reprogramar — INTENTO_FALLIDO -> REPROGRAMADO. */
export interface ReprogramacionEnvio {
 /** ISO 8601 con offset; debe ser futura. */
 nueva_fecha_entrega: string;
 observacion?: string;
}

/** Filtros del GET /api/v1/envios. */
export interface EnvioFiltros {
 estado?: EstadoEnvio;
 /** Busca por código de venta o nombre del cliente. */
 q?: string;
 codigo_sucursal?: number;
 id_repartidor?: string;
 page?: number;
 limit?: number;
}

/** Respuesta normalizada del listado (items + metadata de paginación). */
export interface EnvioListado {
 items: Envio[];
 total: number;
 page: number;
 limit: number;
 pages: number;
}
