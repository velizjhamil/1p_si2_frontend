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

/** Resumen del Gerente Titular asignado a la sucursal. */
export interface GerenteResumen {
  id_usuario: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  estado?: boolean;
}

/** Candidato a Gerente (usuarios con rol GS) para asignación 1 a 1. */
export interface CandidatoGerente {
  id_usuario: string;
  nombre: string;
  apellido: string | null;
  correo: string;
  sucursal_asignada_codigo: number | null;
  sucursal_asignada_nombre: string | null;
  disponible: boolean;
}

/** Sucursal con ciudad, gerente titular y conteo de personal. */
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
  id_gerente?: string | null;
  gerente?: GerenteResumen | null;
  total_personal?: number;
  fecha_actualizacion?: string | null;
}

/** Payload POST /api/v1/sucursales. */
export interface SucursalCreatePayload {
  nombre: string;
  id_ciudad: number;
  direccion?: string;
  telefono?: string;
  horario_atencion?: string;
  id_gerente?: string | null;
}

/** Payload parcial PUT /api/v1/sucursales/{codigo} (null = no cambiar). */
export interface SucursalUpdatePayload {
  nombre?: string;
  id_ciudad?: number;
  direccion?: string;
  telefono?: string;
  horario_atencion?: string;
  id_gerente?: string | null;
}
