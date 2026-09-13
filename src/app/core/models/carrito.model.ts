/**
 * CU15 + CU21 — Carrito de Compras y Checkout: modelos del flujo de
 * ventas (fase MOCK en memoria; el backend llegará con su CU de ventas).
 */

/** Métodos de pago soportados por el checkout (CU21). */
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
}

/** Datos de facturación/entrega del checkout (CU21). */
export interface DatosEntrega {
  nombre_cliente: string;
  correo: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  referencia?: string;
}

/** Venta procesada (mock): la genera procesarCompra(). */
export interface Venta {
  id: number;
  codigo: string;
  items: CarritoItem[];
  total: number;
  metodo_pago: MetodoPago;
  estado_pago: EstadoPago;
  fecha: string;
  datos_entrega: DatosEntrega;
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
}

/** Formatea un monto en Bs. con 2 decimales (moneda local Bolivia). */
export function formatBs(monto: number): string {
  return `Bs. ${monto.toFixed(2)}`;
}
