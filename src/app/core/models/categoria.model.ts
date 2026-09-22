/**
 * Gestión de Categorías: modelos del contrato backend.
 */

/** Líneas de prenda válidas . */
export type LineaCategoria = 'Hombre' | 'Mujer' | 'Unisex';

/** Categoría (GET/POST/PUT /api/v1/categorias). */
export interface Categoria {
 id_categoria: number;
 nombre: string;
 linea: LineaCategoria;
 descripcion: string | null;
 activo: boolean;
 fecha_creacion?: string | null;
}

/** Payload POST /api/v1/categorias. */
export interface CategoriaCreatePayload {
 nombre: string;
 linea: LineaCategoria;
 descripcion?: string;
}

/** Payload parcial PUT /api/v1/categorias/{id} (undefined = no cambiar). */
export interface CategoriaUpdatePayload {
 nombre?: string;
 linea?: LineaCategoria;
 descripcion?: string;
 activo?: boolean;
}

/** Envelope del GET paginado: extras total/page/limit/pages al nivel raíz. */
export interface CategoriasPage {
 status: string;
 data: Categoria[];
 message: string;
 total: number;
 page: number;
 limit: number;
 pages: number;
}
