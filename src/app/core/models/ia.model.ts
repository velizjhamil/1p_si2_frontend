/**
 * Asistente Virtual y Recomendaciones con Inteligencia Artificial (Attention AI).
 * Modelos de datos para el frontend web de comercio electrónico.
 */

export interface ColorResumenIA {
 nombre_color: string;
 codigo_hex?: string | null;
}

export interface StockSucursalResumenIA {
 sucursal: string;
 stock: number;
}

export interface ProductoResumenIA {
 id_producto: number;
 nombre: string;
 precio_venta: number;
 imagen_url?: string | null;
 categoria?: string | null;
 linea?: string | null;
 tallas: string[];
 colores: ColorResumenIA[];
 stock_total: number;
 temporada?: string | null;
 stock_sucursales?: StockSucursalResumenIA[];
}

export interface ChatMessage {
 id?: string;
 rol: 'usuario' | 'asistente' | 'sistema';
 contenido: string;
 fecha?: string;
 productos_recomendados?: number[];
 productos_detalle?: ProductoResumenIA[];
 sugerencias?: string[];
 esError?: boolean;
}

export interface ChatRequestPayload {
 mensaje: string;
 historial?: {
 rol: string;
 contenido: string;
 }[];
 id_sucursal?: number | null;
 nombre_sucursal?: string | null;
 genero_usuario?: string | null;
 nombre_usuario?: string | null;
}

export interface ChatResponseData {
 respuesta: string;
 productos_recomendados: number[];
 productos_detalle: ProductoResumenIA[];
 sugerencias: string[];
}

export interface IAStatusData {
 servicio: string;
 gemini_configurado: boolean;
 gemini_api_key: string;
 modelo_principal: string;
 database_online: boolean;
 capacidades: string[];
}
