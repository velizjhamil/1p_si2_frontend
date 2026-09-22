/** Empresa — perfil institucional de la tienda. */
export interface Empresa {
 id: number;
 razon_social: string;
 nit: string;
 direccion?: string | null;
 telefono?: string | null;
 email?: string | null;
 ciudad?: string | null;
 logo_url?: string | null;
 fecha_actualizacion?: string | null;
}

/** Payload parcial para PUT /empresa: solo campos a cambiar. */
export interface EmpresaUpdatePayload {
 razon_social?: string;
 nit?: string;
 direccion?: string;
 telefono?: string;
 email?: string;
 ciudad?: string;
 logo_url?: string;
}
