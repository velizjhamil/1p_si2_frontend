/**
 * Gestión de Agencias de Reparto: modelos del contrato backend.
 *
 * Coinciden 1-a-1 con `/api/v1/agencias-reparto` (agencias, zonas, tarifas,
 * disponibles y cotización). Envelope estándar { status, data, message } +
 * extras de paginación/total en el nivel raíz. Los decimales (rangos, costos,
 * peso, volumen) llegan como `number`; al ENVIAR se usan strings para no perder
 * precisión (el backend acepta ambos y valida hasta 3 decimales en rangos y
 * medidas, 2 en costos).
 *
 * Privacidad: el rol D (Encargado de Delivery) solo recibe la vista de consulta
 * (sin NIT, correo ni dirección fiscal); por eso esos campos son opcionales.
 */

/** Criterio por el que cobra una tarifa (uno solo por tarifa). */
export type CriterioTarifa = 'PESO' | 'VOLUMEN';

export const CRITERIO_LABEL: Record<CriterioTarifa, string> = {
 PESO: 'Peso (kg)',
 VOLUMEN: 'Volumen (m³)',
};

export const CRITERIO_UNIDAD: Record<CriterioTarifa, string> = {
 PESO: 'kg',
 VOLUMEN: 'm³',
};

// ---------------------------------------------------------------- agencias
/** Agencia (lista y detalle). Los campos de facturación solo llegan a ASU/GS. */
export interface Agencia {
 id_agencia: number;
 razon_social: string;
 contacto_operativo: string | null;
 telefono: string | null;
 /** Habilitada (true) o deshabilitada (false). */
 is_active: boolean;

 // Solo ASU/GS:
 nit?: string;
 correo?: string | null;
 direccion?: string | null;
 correo_facturacion?: string;
 direccion_fiscal?: string;
 fecha_creacion?: string;
 fecha_actualizacion?: string;
 /** Solo en el detalle (GET /{id}) y las mutaciones. */
 total_zonas?: number;
 total_envios?: number;
}

/** POST /agencias-reparto — los 4 primeros son obligatorios. */
export interface AgenciaCreatePayload {
 razon_social: string;
 nit: string;
 correo_facturacion: string;
 direccion_fiscal: string;
 contacto_operativo?: string;
 telefono?: string;
 correo?: string;
 direccion?: string;
}

/** PUT /agencias-reparto/{id} — parcial: lo ausente no cambia. */
export type AgenciaUpdatePayload = Partial<AgenciaCreatePayload>;

/** Filtros del GET /agencias-reparto. */
export interface AgenciasQuery {
 q?: string;
 is_active?: boolean;
 page?: number;
 limit?: number;
}

/** Envelope del listado paginado. */
export interface AgenciasPage {
 status: string;
 data: Agencia[];
 message: string;
 total: number;
 page: number;
 limit: number;
 pages: number;
}

// ------------------------------------------------------------------- zonas
/** Zona de cobertura: ciudad del catálogo + subzona opcional. */
export interface ZonaCobertura {
 id_zona: number;
 id_agencia: number;
 id_ciudad: number;
 ciudad: string;
 departamento: string | null;
 /** null = cubre toda la ciudad. */
 nombre_zona: string | null;
 total_tarifas: number;
 fecha_creacion: string;
}

/** POST/PUT de zona: la ciudad va por `id_ciudad` (recomendado) o por nombre. */
export interface ZonaPayload {
 id_ciudad?: number;
 ciudad?: string;
 nombre_zona?: string;
}

// ----------------------------------------------------------------- tarifas
/**
 * Tarifa de una zona. Rango [rango_min, rango_max): el mínimo se incluye y el
 * máximo no; `rango_max = null` es el último tramo abierto. Vigencia
 * [vigente_desde, vigente_hasta] (ambas incluidas; `vigente_hasta = null` = sin fin).
 */
export interface Tarifa {
 id_tarifa: number;
 id_zona: number;
 id_agencia: number;
 criterio: CriterioTarifa;
 rango_min: number;
 rango_max: number | null;
 /** Costo INTERNO que se paga a la agencia (no es lo que paga el cliente). */
 costo: number;
 vigente_desde: string;
 vigente_hasta: string | null;
 is_active: boolean;
 /** Activa y con la fecha de hoy (UTC) dentro de su vigencia. */
 vigente: boolean;
 fecha_creacion: string;
 fecha_actualizacion: string;
}

/** POST /zonas/{id}/tarifas. */
export interface TarifaCreatePayload {
 criterio: CriterioTarifa;
 rango_min: string;
 /** null = tramo abierto (sin tope). */
 rango_max: string | null;
 costo: string;
 vigente_desde: string;
 /** null = sin fin. */
 vigente_hasta: string | null;
 is_active: boolean;
}

/**
 * PUT /zonas/{id}/tarifas/{id}: solo se envían los campos que cambian. En
 * `rango_max` y `vigente_hasta`, `null` explícito significa "abierto"/"sin fin".
 */
export type TarifaUpdatePayload = Partial<TarifaCreatePayload>;

// ------------------------------------------------------------ disponibilidad
/** Agencia habilitada que cubre la ciudad consultada. */
export interface AgenciaDisponible {
 id_agencia: number;
 razon_social: string;
 contacto_operativo: string | null;
 telefono: string | null;
 is_active: boolean;
 cubre_ciudad: boolean;
 /** true = tiene una zona de ciudad completa; false = solo subzonas. */
 cobertura_completa: boolean;
 zonas_en_ciudad: number;
}

export interface CiudadConsultada {
 id_ciudad: number;
 nombre: string;
 departamento: string | null;
}

export interface Disponibles {
 agencias: AgenciaDisponible[];
 ciudad: CiudadConsultada;
}

// -------------------------------------------------------------- cotización
export interface TarifaAplicada {
 id_tarifa: number;
 id_zona: number;
 nombre_zona: string | null;
 criterio: CriterioTarifa;
 rango_min: number;
 rango_max: number | null;
 costo: number;
 vigente_desde: string;
 vigente_hasta: string | null;
}

/** Tarifa que aplicaba (elegida o descartada), en orden de preferencia. */
export interface CandidataCotizacion {
 id_tarifa: number;
 criterio: CriterioTarifa;
 costo: number;
 nombre_zona: string | null;
 seleccionada: boolean;
}

/**
 * GET /agencias-reparto/{id}/cotizacion. Solo lectura: no asigna ni guarda nada.
 * Regla de selección: mayor costo; empate → PESO antes que VOLUMEN; empate →
 * zona de ciudad completa antes que subzona (si aún hay empate el backend
 * responde 409).
 */
export interface Cotizacion {
 agencia: { id_agencia: number; razon_social: string };
 ciudad: CiudadConsultada;
 peso_kg: number;
 volumen_m3: number;
 fecha_referencia: string;
 criterio: CriterioTarifa;
 /** Costo interno de agencia (no es ventas.costo_envio). */
 costo_agencia: number;
 tarifa: TarifaAplicada;
 candidatas: CandidataCotizacion[];
}

export interface CotizacionQuery {
 ciudad: string;
 peso_kg: string;
 volumen_m3: string;
}
