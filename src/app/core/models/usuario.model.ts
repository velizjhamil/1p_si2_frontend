export type Rol = 'ASU' | 'GS' | 'V' | 'C';

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
