/**
 * Temporadas y Colecciones: modelos del contrato backend.
 * Tablas ya materializadas en la DB (migración e5f8a3b7c2d9 junto a ).
 */

/** Colección (GET/POST/PUT /api/v1/colecciones). */
export interface Coleccion {
 id_coleccion: number;
 nombre_coleccion: string;
 fecha_creacion?: string | null;
}

/** Payload POST /api/v1/colecciones. */
export interface ColeccionCreatePayload {
 nombre_coleccion: string;
}

/** Payload parcial PUT /api/v1/colecciones/{id} (undefined = no cambiar). */
export interface ColeccionUpdatePayload {
 nombre_coleccion?: string;
}

/** Temporada (GET/POST/PUT /api/v1/temporadas) con vigencia derivada. */
export interface Temporada {
 id_temporada: number;
 id_coleccion: number | null;
 nombre_temporada: string;
 fecha_inicio: string; // ISO yyyy-MM-dd
 fecha_fin: string; // ISO yyyy-MM-dd
 /** Nombre aplanado de la colección (JOIN del backend; null = general). */
 nombre_coleccion: string | null;
 /** Calculado por el backend: fecha_inicio <= hoy <= fecha_fin. */
 vigente: boolean;
}

/** Payload POST /api/v1/temporadas. */
export interface TemporadaCreatePayload {
 id_coleccion?: number | null;
 nombre_temporada: string;
 fecha_inicio: string;
 fecha_fin: string;
}

/** Payload parcial PUT /api/v1/temporadas/{id} (undefined = no cambiar). */
export interface TemporadaUpdatePayload {
 id_coleccion?: number | null;
 nombre_temporada?: string;
 fecha_inicio?: string;
 fecha_fin?: string;
}

/** Envelope del GET paginado de temporadas: extras al nivel raíz. */
export interface TemporadasPage {
 status: string;
 data: Temporada[];
 message: string;
 total: number;
 page: number;
 limit: number;
 pages: number;
}
