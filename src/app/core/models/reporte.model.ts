import { EstadoDevolucion } from './devolucion.model';

/**
 * CU20 — Gestión de Reportes: modelos del contrato backend
 * (GET /api/v1/reportes/*). Espejo de app/schemas/reporte.py.
 *
 * Convenciones del contrato:
 * - Los 4 reportes nuevos traen `filtros` (ya con los valores por defecto),
 *   `sin_datos` y `mensaje`. Sin resultados el backend responde 200 con
 *   `sin_datos = true`: NO es un error.
 * - Importes de los 4 reportes nuevos: número JSON.
 * - `rendimiento-vendedores` conserva su contrato original: importes como
 *   string decimal ("1150.00"), sin `filtros`/`sin_datos`/`mensaje`, y los
 *   parámetros se llaman fecha_desde / fecha_hasta / tipo_venta.
 * - Fechas `YYYY-MM-DD` = día calendario UTC; los `datetime` son ISO 8601.
 */

export type { EstadoDevolucion };

export type TipoReporte =
  | 'ventas'
  | 'productos-mas-vendidos'
  | 'inventario'
  | 'devoluciones'
  | 'rendimiento-vendedores';

export type CanalVenta = 'ONLINE' | 'POS';
export type NivelStock = 'CRITICO' | 'BAJO' | 'OK';

// ---------------------------------------------------------------------------
// Parámetros de consulta (nombres exactos de los query params del backend)
// ---------------------------------------------------------------------------
/** Filtros comunes de ventas, productos más vendidos, inventario y devoluciones. */
export interface FiltrosReporteComunes {
  fecha_inicio?: string;
  fecha_fin?: string;
  categoria_id?: number;
  canal_venta?: CanalVenta;
}

export type FiltrosVentas = FiltrosReporteComunes;

export interface FiltrosProductosMasVendidos extends FiltrosReporteComunes {
  top?: number;
}

export interface FiltrosInventario extends FiltrosReporteComunes {
  nivel_stock?: NivelStock;
  limite?: number;
}

export interface FiltrosDevoluciones extends FiltrosReporteComunes {
  estado?: EstadoDevolucion;
  top?: number;
  limite_detalle?: number;
}

/** rendimiento-vendedores usa otros nombres y solo estos 3 filtros. */
export interface FiltrosRendimientoVendedores {
  fecha_desde?: string;
  fecha_hasta?: string;
  tipo_venta?: CanalVenta;
}

// ---------------------------------------------------------------------------
// Respuestas (campo `data` del envelope { status, data, message })
// ---------------------------------------------------------------------------
export interface FiltrosAplicados {
  fecha_inicio: string;
  fecha_fin: string;
  categoria_id: number | null;
  canal_venta: CanalVenta | null;
}

/** Cabecera común de los 4 reportes nuevos. */
export interface ReporteBase {
  filtros: FiltrosAplicados;
  sin_datos: boolean;
  mensaje: string | null;
}

// ---- Ventas ---------------------------------------------------------------
export interface PuntoDiaVentas {
  fecha: string;
  ingresos: number;
  unidades: number;
  num_ventas: number;
}

export interface FilaCategoriaVentas {
  id_categoria: number;
  categoria: string;
  ingresos: number;
  unidades: number;
}

export interface FilaCanalVentas {
  canal: CanalVenta;
  ingresos: number;
  num_ventas: number;
}

export interface FilaMetodoPagoVentas {
  metodo_pago: string;
  ingresos: number;
  num_ventas: number;
}

export interface VentasPeriodo extends ReporteBase {
  num_ventas: number;
  unidades_vendidas: number;
  ingresos_productos: number;
  ticket_promedio: number;
  /** null cuando hay filtro de categoría (el envío no es atribuible). */
  total_facturado: number | null;
  total_envios: number | null;
  /** Un punto por día del rango (ceros incluidos). */
  por_fecha: PuntoDiaVentas[];
  por_categoria: FilaCategoriaVentas[];
  por_canal: FilaCanalVentas[];
  por_metodo_pago: FilaMetodoPagoVentas[];
}

// ---- Productos más vendidos -------------------------------------------------
export interface ProductoMasVendido {
  posicion: number;
  id_producto: number;
  producto: string;
  id_categoria: number;
  categoria: string;
  cantidad_vendida: number;
  total_generado: number;
  num_ventas: number;
}

export interface ProductosMasVendidos extends ReporteBase {
  top: number;
  total_productos_vendidos: number;
  items: ProductoMasVendido[];
}

// ---- Inventario -------------------------------------------------------------
export interface ProductoInventario {
  id_producto: number;
  producto: string;
  id_categoria: number;
  categoria: string;
  estado: string;
  stock_actual: number;
  precio_venta: number;
  valor_stock: number;
  nivel_stock: NivelStock;
  unidades_vendidas: number;
  /** APROXIMACIÓN: unidades vendidas / stock actual. null si stock = 0. */
  rotacion: number | null;
  rotacion_disponible: boolean;
}

export interface InventarioSituacion extends ReporteBase {
  total_productos: number;
  stock_total_unidades: number;
  valor_inventario: number;
  agotados: number;
  /** Siempre con las claves CRITICO, BAJO y OK. */
  por_nivel: Record<NivelStock, number>;
  total_filas: number;
  limite: number;
  items: ProductoInventario[];
}

// ---- Devoluciones -----------------------------------------------------------
export interface DevolucionesPorFecha {
  fecha: string;
  num_devoluciones: number;
  unidades: number;
  importe: number;
}

export interface DevolucionesPorProducto {
  id_producto: number;
  producto: string;
  categoria: string;
  unidades: number;
  importe: number;
}

export interface DevolucionesPorCategoria {
  id_categoria: number;
  categoria: string;
  unidades: number;
  importe: number;
}

export interface DevolucionesPorEstado {
  estado: EstadoDevolucion;
  num_devoluciones: number;
  unidades: number;
  /** Incluye RECHAZADA (monto solicitado). */
  importe: number;
}

export interface DevolucionDetalleItem {
  id_devolucion: number;
  fecha_solicitud: string;
  estado: EstadoDevolucion;
  codigo_venta: string;
  motivo: string;
  unidades: number;
  /** Monto solicitado (todas las líneas). */
  importe: number;
}

/**
 * `unidades_devueltas`, `importe_total` y las series por fecha/producto/
 * categoría EXCLUYEN las RECHAZADA; `num_devoluciones` y `por_estado` las incluyen.
 */
export interface DevolucionesReporte extends ReporteBase {
  estado: EstadoDevolucion | null;
  num_devoluciones: number;
  unidades_devueltas: number;
  importe_total: number;
  importe_completado: number;
  por_estado: DevolucionesPorEstado[];
  por_fecha: DevolucionesPorFecha[];
  por_producto: DevolucionesPorProducto[];
  por_categoria: DevolucionesPorCategoria[];
  detalle: DevolucionDetalleItem[];
}

// ---- Rendimiento de vendedores (contrato original) ---------------------------
export interface VendedorRendimiento {
  id_vendedor: string;
  nombre: string;
  correo: string;
  total_ventas: number;
  /** Decimal serializado como string, p. ej. "1150.00". */
  total_ingresos: string;
  ticket_promedio: string;
  primera_venta: string | null;
  ultima_venta: string | null;
  tipos_venta: Record<string, number>;
}

export interface RendimientoVendedores {
  items: VendedorRendimiento[];
  total_vendedores: number;
  total_ingresos: string;
  total_operaciones: number;
  fecha_desde: string;
  fecha_hasta: string;
}

// ---------------------------------------------------------------------------
// Exportación (mismo endpoint con `formato`; ver backend reportes._respuesta)
// ---------------------------------------------------------------------------
export type FormatoExportacion = 'pdf' | 'xlsx';
