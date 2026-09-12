/**
 * CU17 — Gestión de Sucursales: modelos del contrato backend.
 * Envelope estándar: { status, data, message }.
 */

/** Catálogo GET /api/v1/ciudades — dropdown del modal. */
export interface Ciudad {
  id: number;
  nombre: string;
  departamento: string | null;
}

/** Sucursal con ciudad anidada (GET/POST/PUT/DELETE /api/v1/sucursales). */
export interface Sucursal {
  codigo_sucursal: number;
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  horario_atencion: string | null;
  /** estado Activo/Inactivo. */
  is_active: boolean;
  ciudad: Ciudad;
  empresa_id: number;
  fecha_actualizacion?: string | null;
}

/** Payload POST /api/v1/sucursales. */
export interface SucursalCreatePayload {
  nombre: string;
  id_ciudad: number;
  direccion?: string;
  telefono?: string;
  horario_atencion?: string;
}

/** Payload parcial PUT /api/v1/sucursales/{codigo} (null = no cambiar). */
export interface SucursalUpdatePayload {
  nombre?: string;
  id_ciudad?: number;
  direccion?: string;
  telefono?: string;
  horario_atencion?: string;
}
