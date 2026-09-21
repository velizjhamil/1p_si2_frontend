export type Rol = 'ASU' | 'GS' | 'V' | 'C' | 'D';

export interface RolResponse {
  id_rol: string;
  nombre_rol: string;
}

export interface Usuario {
  id_usuario: string;
  nombre: string;
  correo: string;
  estado: boolean;
  rol: RolResponse;
  id_sucursal?: number | null;
  sucursal_nombre?: string | null;
}

/** Usuario completo (GET/PUT /usuarios): agrega apellido, rol_id y auditoría. */
export interface UsuarioList {
  id_usuario: string;
  nombre: string;
  apellido?: string | null;
  correo: string;
  estado: boolean;
  rol: RolResponse;
  rol_id: string;
  id_sucursal?: number | null;
  sucursal_nombre?: string | null;
  fecha_creacion?: string | null;
  ultima_conexion?: string | null;
}

/** Payload para crear usuario (POST /usuarios): rol por NOMBRE, no por id. */
export interface UsuarioCreatePayload {
  nombre: string;
  apellido?: string;
  correo: string;
  password: string;
  nombre_rol: string;
  estado?: boolean;
  id_sucursal?: number | null;
}

/** Payload parcial para editar (PUT /usuarios/{id}): None = no cambiar. */
export interface UsuarioUpdatePayload {
  nombre?: string;
  apellido?: string;
  correo?: string;
  password?: string;
  rol_id?: string;
  estado?: boolean;
  id_sucursal?: number | null;
}

/** Rol del catálogo GET /roles (CU4 lectura): permisos heredados + conteo. */
export interface RolCatalogo {
  id_rol: string;
  nombre_rol: string;
  descripcion?: string | null;
  fecha_creacion: string;
  permisos: PermisoRead[];
  cantidad_usuarios: number;
}

/** Permiso embebido en respuestas (rol.permisos, GET /permisos). */
export interface PermisoRead {
  id: number;
  nombre: string;
  descripcion?: string | null;
  modulo: string;
  fecha_creacion: string;
}

/** Payload para crear un rol con sus permisos (POST /roles). */
export interface RolCreatePayload {
  nombre_rol: string;
  descripcion?: string;
  permiso_ids: number[];
}

/** Payload para actualizar un rol (PUT /roles/{id}). */
export interface RolUpdatePayload {
  nombre_rol?: string;
  descripcion?: string;
  permiso_ids?: number[];
}

/** Payload para reemplazar los permisos de un rol (PUT /roles/{id}/permisos). */
export interface RolPermisosPayload {
  permiso_ids: number[];
}

/** Envelope estándar del backend: {"status", "data", "message"} */
export interface ApiResponse<T> {
  status: string;
  data: T;
  message: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: Usuario;
}
