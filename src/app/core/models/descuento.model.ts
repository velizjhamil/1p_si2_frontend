/**
 * Gestión de Descuentos / Cupones: modelos del contrato backend
 * (/api/v1/descuentos — FastAPI + SQLAlchemy).
 */

/** Tipos de descuento: PORCENTAJE (0-100) o MONTO_FIJO (Bs.). */
export type TipoDescuento = 'PORCENTAJE' | 'MONTO_FIJO';

/** Descuento o cupon registrado. */
export interface Descuento {
 id_descuento: number;
 /** Codigo del cupon (unico, en MAYUSCULAS). NULL para reglas automaticas. */
 codigo: string | null;
 nombre: string;
 descripcion: string | null;
 tipo: TipoDescuento;
 valor: number;
 /** Fecha de inicio de vigencia (YYYY-MM-DD). */
 fecha_inicio: string;
 /** Fecha de fin de vigencia (null = sin vencimiento). */
 fecha_fin: string | null;
 activo: boolean;
 /** Limite total de usos (null = ilimitado). */
 usos_maximos: number | null;
 /** Contador de veces que se aplico el descuento. */
 usos_actuales: number;
 /** Compra minima requerida para aplicar (null = sin minimo). */
 monto_minimo_compra: number | null;
 fecha_creacion: string;
}

/** Payload POST /api/v1/descuentos. */
export interface DescuentoCreatePayload {
 codigo?: string | null;
 nombre: string;
 descripcion?: string | null;
 tipo: TipoDescuento;
 valor: number;
 fecha_inicio: string;
 fecha_fin?: string | null;
 activo?: boolean;
 usos_maximos?: number | null;
 monto_minimo_compra?: number | null;
}

/** Payload parcial PUT /api/v1/descuentos/{id}. */
export interface DescuentoUpdatePayload {
 codigo?: string | null;
 nombre?: string;
 descripcion?: string | null;
 tipo?: TipoDescuento;
 valor?: number;
 fecha_inicio?: string;
 fecha_fin?: string | null;
 activo?: boolean;
 usos_maximos?: number | null;
 monto_minimo_compra?: number | null;
}

/** Envelope del GET paginado. */
export interface DescuentosPage {
 status: string;
 data: Descuento[];
 message: string;
 total: number;
 page: number;
 limit: number;
 pages: number;
}
