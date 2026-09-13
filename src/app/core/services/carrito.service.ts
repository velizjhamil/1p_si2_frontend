import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, throwError } from 'rxjs';
import { ApiService } from './api';
import { ApiResponse } from '../models/usuario.model';
import {
  CarritoItem,
  DatosEntrega,
  MetodoPago,
  Venta,
} from '../models/carrito.model';

/** Clave de persistencia del carrito en localStorage. */
const STORAGE_KEY = 'attention_carrito';

/**
 * CU15 — Carrito de Compras (estado global con signals).
 *
 * Mantiene los ítems del carrito persistidos en localStorage (SSR-safe
 * con isPlatformBrowser) para que sobrevivan recargas. El checkout
 * (CU21) consume el endpoint real POST /api/v1/ventas/checkout del
 * backend FastAPI; el precio final lo calcula el SERVER con los
 * precios reales del catálogo (el carrito solo envía id+cantidad+variante).
 */

/** DTO de línea de venta que devuelve el backend. */
interface ItemVentaDTO {
  id_detalle: number;
  producto_id: number;
  nombre: string;
  talla: string | null;
  color: string | null;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

/** DTO completo de la venta procesada (contrato /api/v1/ventas). */
interface VentaDTO {
  id_venta: number;
  codigo: string;
  fecha_venta: string;
  total: number;
  costo_envio: number;
  metodo_pago: MetodoPago;
  estado_pago: Venta['estado_pago'];
  comprobante_url: string | null;
  items: ItemVentaDTO[];
  datos_entrega: DatosEntrega;
}

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(ApiService);

  /** Ítems actuales del carrito (señal raíz del estado). */
  private readonly _items = signal<CarritoItem[]>(this.leerStorage());

  /** Vista pública read-only de los ítems. */
  readonly items = this._items.asReadonly();

  /** Número total de unidades (badge del header). */
  readonly contador = computed(() =>
    this._items().reduce((acc, i) => acc + i.cantidad, 0),
  );

  /** Suma de subtotales (subtotal general del carrito). */
  readonly subtotal = computed(() =>
    this._items().reduce((acc, i) => acc + i.subtotal, 0),
  );

  /** Costo de envío (gratis sobre Bs. 300 — misma regla del backend). */
  readonly envio = computed(() => (this.subtotal() >= 300 ? 0 : 25));

  /** Total a pagar = subtotal + envío. */
  readonly total = computed(() => this.subtotal() + this.envio());

  /** True si el carrito está vacío. */
  readonly vacio = computed(() => this._items().length === 0);

  // ------------------------------------------------------------------- CRUD
  /**
   * CU15: Agrega una variante (producto+talla+color) al carrito.
   * Si ya existe la misma combinación, suma cantidades.
   */
  agregarAlCarrito(item: Omit<CarritoItem, 'subtotal'>): void {
    const nuevo: CarritoItem = {
      ...item,
      subtotal: item.precio * item.cantidad,
    };

    this._items.update((items) => {
      const idx = items.findIndex(
        (i) =>
          i.producto_id === item.producto_id &&
          i.talla === item.talla &&
          i.color === item.color,
      );
      if (idx >= 0) {
        // Misma variante: acumula cantidad y recalcula subtotal
        const copia = [...items];
        copia[idx] = {
          ...copia[idx],
          cantidad: copia[idx].cantidad + item.cantidad,
          subtotal: copia[idx].precio * (copia[idx].cantidad + item.cantidad),
        };
        return copia;
      }
      return [...items, nuevo];
    });
    this.persistir();
  }

  /** CU15: Elimina un ítem por variante (producto+talla+color). */
  eliminarItem(producto_id: number, talla: string, color: string): void {
    this._items.update((items) =>
      items.filter(
        (i) =>
          !(
            i.producto_id === producto_id &&
            i.talla === talla &&
            i.color === color
          ),
      ),
    );
    this.persistir();
  }

  /** CU15: Actualiza la cantidad de una variante (mínimo 1). */
  actualizarCantidad(
    producto_id: number,
    talla: string,
    color: string,
    cantidad: number,
  ): void {
    if (cantidad < 1) return; // usar eliminarItem para quitar del carrito
    this._items.update((items) =>
      items.map((i) =>
        i.producto_id === producto_id && i.talla === talla && i.color === color
          ? { ...i, cantidad, subtotal: i.precio * cantidad }
          : i,
      ),
    );
    this.persistir();
  }

  /** CU15: Vacía el carrito completo. */
  vaciarCarrito(): void {
    this._items.set([]);
    this.persistir();
  }

  // ------------------------------------------------------------- CU21 checkout
  /**
   * CU21: Procesa la compra contra el backend real.
   *
   * POST /api/v1/ventas/checkout — transacción atómica server-side:
   * valida stock, calcula el total con precios REALES de la DB, registra
   * venta + detalle, descuenta inventario y escribe el kardex. El JWT
   * lo agrega el interceptor. Los 409/422 del backend llegan como
   * {error: {detail}} (mismo contrato que el mock).
   */
  procesarCompra(
    metodo_pago: MetodoPago,
    datos_entrega: DatosEntrega,
  ): Observable<Venta> {
    if (this.vacio()) {
      return throwError(() => ({
        error: { detail: 'El carrito está vacío.' },
      }));
    }

    // El carrito NO envía precios: el server usa precio_venta de la DB
    // (anti-manipulación). Solo id + cantidad + variante.
    const items = this._items().map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      talla: i.talla,
      color: i.color,
    }));

    return this.api
      .post<ApiResponse<VentaDTO>>('/ventas/checkout', {
        items,
        metodo_pago,
        datos_entrega,
      })
      .pipe(map((resp) => this.mapVenta(resp.data)));
  }

  /** Confirma la venta (callback del checkout): limpia el carrito. */
  confirmarVenta(): void {
    this.vaciarCarrito();
  }

  // -------------------------------------------------------------- mapeo DTOs
  /** DTO backend -> modelo Venta del ticket (uso los items con precio real). */
  private mapVenta(dto: VentaDTO): Venta {
    return {
      id: dto.id_venta,
      codigo: dto.codigo,
      items: dto.items.map((i) => ({
        producto_id: i.producto_id,
        nombre: i.nombre,
        talla: i.talla ?? '—',
        color: i.color ?? '—',
        color_hex: '#1d528d',
        precio: Number(i.precio_unitario),
        cantidad: i.cantidad,
        subtotal: Number(i.subtotal),
        imagen_url: null,
      })),
      total: Number(dto.total),
      metodo_pago: dto.metodo_pago,
      estado_pago: dto.estado_pago,
      fecha: dto.fecha_venta,
      datos_entrega: dto.datos_entrega,
    };
  }

  // ------------------------------------------------------------ persistencia
  /** Guarda los ítems en localStorage (solo en el navegador). */
  private persistir(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._items()));
    } catch {
      // storage lleno/bloqueado: el carrito sigue vivo en memoria
    }
  }

  /** Restaura los ítems de localStorage (vacío en el servidor SSR). */
  private leerStorage(): CarritoItem[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const crudo = localStorage.getItem(STORAGE_KEY);
      return crudo ? (JSON.parse(crudo) as CarritoItem[]) : [];
    } catch {
      return [];
    }
  }
}
