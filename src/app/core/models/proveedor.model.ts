/**
 * CU23 — Gestión de Proveedores: modelos del contrato backend.
 * Envelope estándar: { status, data, message } + metadatos de paginación.
 */

/** Estados válidos del proveedor (badge de color en la tabla). */
export type EstadoProveedor = 'Activo' | 'Verificado' | 'Inactivo';

/** Proveedor (GET/POST/PUT /api/v1/proveedores). */
export interface Proveedor {
  id_proveedor: number;
  /** Razón social / nombre. */
  nombre: string;
  nit_rut: string;
  contacto_operativo: string | null;
  telefono: string | null;
  correo: string | null;
  /** Línea/categoría que abastece (ej: Textiles, Calzado). */
  categoria: string | null;
  estado: EstadoProveedor;
  direccion: string | null;
  sucursal_id: number | null;
  sucursal_nombre?: string | null;
  fecha_actualizacion?: string | null;
}

/** Payload POST /api/v1/proveedores. */
export interface ProveedorCreatePayload {
  nombre: string;
  nit_rut: string;
  contacto_operativo?: string;
  telefono?: string;
  correo?: string;
  categoria?: string;
  estado?: EstadoProveedor;
  direccion?: string;
  sucursal_id?: number | null;
}

/** Payload parcial PUT /api/v1/proveedores/{id} (undefined = no cambiar). */
export interface ProveedorUpdatePayload {
  nombre?: string;
  nit_rut?: string;
  contacto_operativo?: string;
  telefono?: string;
  correo?: string;
  categoria?: string;
  estado?: EstadoProveedor;
  direccion?: string;
  sucursal_id?: number | null;
}

/** Envelope del GET paginado: extras total/page/limit/pages al nivel raíz. */
export interface ProveedoresPage {
  status: string;
  data: Proveedor[];
  message: string;
  total: number;
  page: number;
  limit: number;
  pages: number;
}
