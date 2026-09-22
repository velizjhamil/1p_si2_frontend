import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
 MovimientoInventario,
 MovimientoPayload,
 StockProducto,
 TipoMovimiento,
} from '../../core/models/inventario.model';

/**
 * Gestión de Inventario.
 *
 * Consume los endpoints reales del backend FastAPI:
 * - GET /api/v1/inventario/stock (stock por producto con nivel de alerta)
 * - GET /api/v1/inventario/movimientos (kardex con filtros tipo/fecha)
 * - POST /api/v1/inventario/movimientos (ENTRADA/SALIDA/AJUSTE atómico)
 *
 * Mapea los DTOs del backend (id_producto, stock_total, nivel,
 * id_movimiento, fecha_movimiento, usuario{...}) a los modelos planos del
 * componente (id, nombre, stock_actual, fecha, producto_nombre) para que
 * la vista no conozca el contrato HTTP. El envelope {status, data,
 * message} se desempaqueta aquí; los 409/422 del backend llegan al
 * componente como errores HTTP con {error: {detail}}.
 */

/** DTO de fila del GET /stock (contrato /api/v1/inventario/stock). */
interface StockFilaDTO {
 id_producto: number;
 nombre: string;
 categoria: string | null;
 estado: string;
 stock_total: number;
 umbral_minimo: number;
 nivel: 'CRITICO' | 'BAJO' | 'OK';
 id_sucursal?: number | null;
 sucursal_nombre?: string | null;
}

/** DTO de usuario embebido en el movimiento. */
interface UsuarioMovDTO {
 id_usuario: string;
 nombre: string;
 apellido: string | null;
 correo: string;
}

/** DTO de producto embebido en el movimiento. */
interface ProductoMovDTO {
 id_producto: number;
 nombre: string;
 categoria: string | null;
 estado: string;
 stock_total: number;
}

/** DTO del GET/POST /movimientos (contrato /api/v1/inventario/movimientos). */
interface MovimientoDTO {
 id_movimiento: number;
 tipo: TipoMovimiento;
 cantidad: number;
 stock_anterior: number;
 stock_nuevo: number;
 motivo: string | null;
 fecha_movimiento: string;
 id_sucursal?: number | null;
 sucursal_nombre?: string | null;
 producto: ProductoMovDTO;
 usuario: UsuarioMovDTO;
}

/** Envelope del GET paginado: lista en data + extras. */
interface PageEnvelope extends ApiResponse<MovimientoDTO[]> {
 total: number;
 page: number;
 limit: number;
 pages: number;
}

@Injectable({ providedIn: 'root' })
export class InventarioService {
 private readonly api = inject(ApiService);

 /** GET /inventario/stock — stock actual por producto con filtro opcional de sucursal. */
 getStockActual(sucursalId?: number | null): Observable<StockProducto[]> {
 const params = sucursalId ? `?limit=100&sucursal_id=${sucursalId}` : '?limit=100';
 return this.api
 .get<ApiResponse<StockFilaDTO[]> & { total: number }>(`/inventario/stock${params}`)
 .pipe(map((resp) => resp.data.map((dto) => this.mapStock(dto))));
 }

 /** GET /inventario/movimientos — kardex completo (fecha desc). */
 getHistorialMovimientos(sucursalId?: number | null): Observable<MovimientoInventario[]> {
 const params = sucursalId ? `?limit=100&sucursal_id=${sucursalId}` : '?limit=100';
 return this.api
 .get<PageEnvelope>(`/inventario/movimientos${params}`)
 .pipe(map((resp) => resp.data.map((dto) => this.mapMovimiento(dto))));
 }

 /** POST /inventario/movimientos con tipo ENTRADA (suma unidades). */
 registrarEntrada(payload: MovimientoPayload): Observable<MovimientoInventario> {
 return this.registrar('ENTRADA', payload);
 }

 /** POST /inventario/movimientos con tipo SALIDA (descuenta; 409 si no alcanza). */
 registrarSalida(payload: MovimientoPayload): Observable<MovimientoInventario> {
 return this.registrar('SALIDA', payload);
 }

 /** POST /inventario/movimientos con tipo AJUSTE (fija stock total). */
 registrarAjuste(payload: MovimientoPayload): Observable<MovimientoInventario> {
 return this.registrar('AJUSTE', payload);
 }

 /** POST real: el backend calcula stock_anterior/nuevo y valida todo. */
 private registrar(
 tipo: TipoMovimiento,
 payload: MovimientoPayload,
 ): Observable<MovimientoInventario> {
 return this.api
 .post<ApiResponse<MovimientoDTO>>('/inventario/movimientos', {
 id_producto: payload.producto_id,
 tipo,
 cantidad: Math.floor(payload.cantidad),
 motivo: payload.motivo?.trim() || null,
 id_sucursal: payload.id_sucursal || undefined,
 })
 .pipe(map((resp) => this.mapMovimiento(resp.data)));
 }

 // -------------------------------------------------------------- mapeo DTOs
 /** DTO backend -> modelo del componente (stock). */
 private mapStock(dto: StockFilaDTO): StockProducto {
 return {
 id: dto.id_producto,
 nombre: dto.nombre,
 categoria: dto.categoria ?? 'Sin categoría',
 stock_actual: dto.stock_total,
 id_sucursal: dto.id_sucursal,
 sucursal_nombre: dto.sucursal_nombre,
 };
 }

 /** DTO backend -> modelo del componente (movimiento). */
 private mapMovimiento(dto: MovimientoDTO): MovimientoInventario {
 const delta = dto.stock_nuevo - dto.stock_anterior;
 return {
 id: dto.id_movimiento,
 producto_id: dto.producto.id_producto,
 producto_nombre: dto.producto.nombre,
 tipo: dto.tipo,
 // Kardex: ENTRADA/SALIDA muestran lo movido; AJUSTE la delta con signo
 cantidad: dto.tipo === 'AJUSTE' ? delta : Math.abs(dto.cantidad) * (dto.tipo === 'SALIDA' ? -1 : 1),
 stock_anterior: dto.stock_anterior,
 stock_nuevo: dto.stock_nuevo,
 fecha: dto.fecha_movimiento,
 motivo: dto.motivo ?? 'Sin motivo registrado',
 id_sucursal: dto.id_sucursal,
 sucursal_nombre: dto.sucursal_nombre,
 };
 }
}
