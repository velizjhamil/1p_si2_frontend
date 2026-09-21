/**
 * CU6 — Gestión de Productos de Ropa: modelos del contrato backend
 * (/api/v1/productos — FastAPI + SQLAlchemy).
 */

/** Estados del producto (ciclo de vida comercial, no stock del CU22). */
export type EstadoProducto = 'Activo' | 'Inactivo' | 'Agotado';

/** Categoría embebida en la respuesta del producto. */
export interface CategoriaDetalle {
  id_categoria: number;
  nombre: string;
  linea: string;
}

/** Talla embebida en la respuesta del producto (N:M producto_tallas). */
export interface TallaDetalle {
  id_talla: number;
  nombre_talla: string;
}

/** Color embebido en la respuesta del producto (N:M producto_colores). */
export interface ColorDetalle {
  id_color: number;
  nombre_color: string;
  codigo_hex: string;
}

/** Disponibilidad por sucursal física (CU6 / CU22). */
export interface DisponibilidadSucursal {
  id_sucursal: number;
  nombre_sucursal: string;
  ciudad?: string | null;
  stock: number;
  disponible: boolean;
}

/** Prenda de vestir del catálogo (GET/POST/PUT /api/v1/productos). */
export interface ProductoRopa {
  id_producto: number;
  nombre: string;
  id_categoria: number;
  categoria: CategoriaDetalle | null;
  id_proveedor: number | null;
  nombre_proveedor: string | null;
  precio_venta: number;
  stock_total: number;
  imagen_url: string | null;
  descripcion: string | null;
  estado: EstadoProducto;
  tallas: TallaDetalle[];
  colores: ColorDetalle[];
  disponibilidad_sucursales?: DisponibilidadSucursal[];
  fecha_creacion?: string | null;
}

/** Payload POST /api/v1/productos (IDs de catálogos FK). */
export interface ProductoCreatePayload {
  nombre: string;
  id_categoria: number;
  id_proveedor: number | null;
  precio_venta: number;
  stock_total: number;
  imagen_url?: string | null;
  descripcion?: string | null;
  tallas: number[]; // ids de /api/v1/tallas
  colores: number[]; // ids de /api/v1/colores
}

/** Payload parcial PUT /api/v1/productos/{id} (undefined = no cambiar). */
export interface ProductoUpdatePayload extends Partial<ProductoCreatePayload> {
  estado?: EstadoProducto;
}

/** Envelope del GET paginado: extras total/page/limit/pages al nivel raíz. */
export interface ProductosPage {
  status: string;
  data: ProductoRopa[];
  message: string;
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Registro del catálogo /api/v1/tallas (read-only para selects de CU6). */
export interface Talla {
  id_talla: number;
  nombre_talla: string;
  descripcion: string | null;
  activo: boolean;
}

/** Envelope del GET paginado de tallas. */
export interface TallasPage {
  status: string;
  data: Talla[];
  message: string;
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Registro del catálogo /api/v1/colores (read-only para selects de CU6). */
export interface Color {
  id_color: number;
  nombre_color: string;
  codigo_hex: string;
  descripcion: string | null;
  activo: boolean;
}

/** Envelope del GET paginado de colores. */
export interface ColoresPage {
  status: string;
  data: Color[];
  message: string;
  total: number;
  page: number;
  limit: number;
  pages: number;
}
