/**
 * CU22 — Gestión de Inventario: modelos del contrato.
 * FASE MOCK: el service consume datos en memoria; cuando llegue el
 * backend real (/api/v1/inventario/...), solo cambia la implementación
 * del service — este contrato no se mueve.
 */

/** Tipos de movimiento de stock del kardex (CU22). */
export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

/** Registro de movimiento de inventario (kardex). */
export interface MovimientoInventario {
  id: number;
  producto_id: number;
  producto_nombre: string;
  tipo: TipoMovimiento;
  /**
   * Unidades del movimiento: ENTRADA/SALIDA registran la cantidad
   * movida (positiva); AJUSTE registra la delta con signo entre el
   * stock anterior y el valor al que se ajustó.
   */
  cantidad: number;
  stock_anterior: number;
  stock_nuevo: number;
  /** Fecha ISO del movimiento. */
  fecha: string;
  motivo: string;
  id_sucursal?: number | null;
  sucursal_nombre?: string | null;
}

/** Stock actual por producto (tabla principal del CU22). */
export interface StockProducto {
  id: number;
  nombre: string;
  categoria: string;
  stock_actual: number;
  id_sucursal?: number | null;
  sucursal_nombre?: string | null;
}

/** Payload del modal "+ Registrar Movimiento de Stock". */
export interface MovimientoPayload {
  producto_id: number;
  cantidad: number;
  motivo: string;
  id_sucursal?: number | null;
}

/** Umbrales de alerta visual del CU22 (badges de stock). */
export const STOCK_CRITICO = 5; // stock < 5 → crítico (rojo)
export const STOCK_MEDIO = 15; // stock < 15 → medio (amarillo); >= 15 → OK (verde)
