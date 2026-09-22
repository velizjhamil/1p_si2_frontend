/**
 * Carrito de Compras y Checkout: modelos del flujo de
 * ventas (fase MOCK en memoria; el backend llegará con su CU de ventas).
 */

/** Métodos de pago soportados por el checkout. */
export type MetodoPago = 'QR' | 'EFECTIVO' | 'TARJETA';

/** Estados de pago de una venta procesada. */
export type EstadoPago = 'PENDIENTE' | 'PAGADO' | 'RECHAZADO';

/** Ítem del carrito: variante específica (talla+color) de un producto. */
export interface CarritoItem {
 producto_id: number;
 nombre: string;
 talla: string;
 color: string;
 color_hex: string;
 precio: number;
 cantidad: number;
 subtotal: number;
 imagen_url: string | null;
 id_sucursal?: number | null;
 sucursal_nombre?: string | null;
}

/** Datos de facturación/entrega del checkout. */
export interface DatosEntrega {
 nombre_cliente: string;
 correo: string;
 telefono: string;
 direccion: string;
 ciudad: string;
 referencia?: string;
}

/** Venta procesada: la genera el backend. */
export interface Venta {
 id: number;
 codigo: string;
 items: CarritoItem[];
 total: number;
 metodo_pago: MetodoPago;
 estado_pago: EstadoPago;
 fecha: string;
 datos_entrega: DatosEntrega;
 /** id del vendedor que cobró (null en ventas online del Cliente). */
 vendedor_id?: string | null;
 /** tipo de venta (ONLINE para e-commerce, POS para mostrador). */
 tipo_venta?: 'ONLINE' | 'POS';
 /** DOMICILIO genera un envío (ver /envios); RETIRO es entrega en tienda. */
 tipo_entrega?: 'DOMICILIO' | 'RETIRO';
 id_sucursal?: number | null;
 sucursal_nombre?: string | null;
 stripe_id?: string;
 comprobante_fiscal?: {
 empresa: string;
 nit: string;
 nro_factura: string;
 nro_autorizacion: string;
 codigo_control: string;
 fecha_emision: string;
 total_bs: number;
 estado: string;
 metodo: string;
 leyenda: string;
 };
}

/** Tipo de venta para el checkout (default ONLINE). */
export type TipoVenta = 'ONLINE' | 'POS';

/** Disponibilidad por sucursal para la vista de tienda. */
export interface DisponibilidadTienda {
 id_sucursal: number;
 nombre_sucursal: string;
 ciudad?: string | null;
 stock: number;
 disponible: boolean;
}

/** Catálogo mock de la tienda para el home del cliente. */
export interface ProductoTienda {
 producto_id: number;
 nombre: string;
 categoria: string;
 precio: number;
 imagen_url: string | null;
 tallas: string[];
 colores: { nombre: string; hex: string }[];
 disponibilidad_sucursales?: DisponibilidadTienda[];
}

/** Formatea un monto en Bs. con 2 decimales (moneda local Bolivia). */
export function formatBs(monto: number): string {
 return `Bs. ${monto.toFixed(2)}`;
}

/** Datos de tarjeta de crédito/débito para procesar pago. */
export interface DatosTarjeta {
 titular: string;
 numero_tarjeta: string;
 expiracion: string;
 cvv: string;
}

/** Transacción generada en la pasarela de pagos. */
export interface TransaccionPago {
 id_transaccion: number;
 codigo_transaccion: string;
 pasarela: string;
 monto: number;
 moneda: string;
 metodo_pago: MetodoPago;
 estado: 'PENDIENTE' | 'PAGADO' | 'RECHAZADO';
 qr_data?: string | null;
 detalles_pago?: string | null;
 fecha_creacion: string;
 fecha_actualizacion?: string;
 id_venta?: number;
 codigo_venta?: string;
 estado_venta?: string;
}

/** Respuesta del endpoint POST /api/v1/pagos/procesar */
export interface ProcesarPagoResponse {
 id_venta: number;
 codigo_venta: string;
 total: number;
 costo_envio: number;
 metodo_pago: MetodoPago;
 estado_pago: EstadoPago;
 transaccion: TransaccionPago;
}

