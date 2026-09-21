import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, throwError } from 'rxjs';
import { ApiService } from './api';
import { AuthService } from './auth.service';
import { ApiResponse } from '../models/usuario.model';
import {
  CarritoItem,
  DatosEntrega,
  MetodoPago,
  TipoVenta,
  Venta,
} from '../models/carrito.model';

/**
 * Prefijo de la clave del carrito en localStorage. La clave real lleva el id del
 * usuario (`attention_carrito_<id>`): el carrito es de UN Cliente, no del navegador.
 * La clave sin sufijo es la versión anterior (global) y se elimina al leer.
 */
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
  /** CU11: id del vendedor que registró la venta (null en ONLINE). */
  vendedor_id: string | null;
  /** CU11: tipo de venta (ONLINE | POS). Default ONLINE. */
  tipo_venta: 'ONLINE' | 'POS';
}

@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  /** Ítems actuales del carrito (señal raíz del estado). */
  private readonly _items = signal<CarritoItem[]>(this.leerStorage());

  constructor() {
    // Regla de negocio: el carrito es exclusivo del Cliente y de SU sesión. Al cambiar de
    // usuario (login/logout) se recarga el carrito de ese usuario (vacío si no es Cliente):
    // nadie hereda el carrito de otra sesión abierta en el mismo navegador.
    this.auth.currentUser$.subscribe((u) => {
      this._items.set(this.leerStorage());
      if (u && this.auth.esCliente()) {
        this.sincronizarConBackend();
      }
    });
  }

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
    // Solo el Cliente agrega al carrito (defensa además del botón oculto en la UI).
    if (!this.auth.esCliente()) return;
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

    // Sincronizar en segundo plano con el backend de base de datos
    this.api
      .post('/carrito/items', {
        id_producto: item.producto_id,
        cantidad: item.cantidad,
        talla: item.talla,
        color: item.color,
      })
      .subscribe({ error: () => {} });
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
    if (this.auth.esCliente()) {
      this.api.delete('/carrito').subscribe({ error: () => {} });
    }
  }

  /** CU15: Sincroniza el carrito local con el backend persistente de base de datos. */
  sincronizarConBackend(): void {
    if (!this.auth.esCliente() || !isPlatformBrowser(this.platformId)) return;
    const items = this._items();
    if (items.length > 0) {
      const payload = {
        items: items.map((i) => ({
          id_producto: i.producto_id,
          cantidad: i.cantidad,
          talla: i.talla,
          color: i.color,
        })),
        reemplazar: false,
      };
      this.api.post('/carrito/sincronizar', payload).subscribe({
        error: () => {},
      });
    } else {
      // Si está vacío localmente, cargar del backend
      this.api.get<ApiResponse<any>>('/carrito').subscribe({
        next: (resp) => {
          if (resp?.data?.items && resp.data.items.length > 0) {
            const mapped: CarritoItem[] = resp.data.items.map((it: any) => ({
              producto_id: it.id_producto,
              nombre: it.nombre_producto,
              talla: it.talla ?? '—',
              color: it.color ?? '—',
              color_hex: '#1d528d',
              precio: it.precio_unitario,
              cantidad: it.cantidad,
              subtotal: it.subtotal,
              imagen_url: it.imagen_url ?? null,
            }));
            this._items.set(mapped);
            this.persistir();
          }
        },
        error: () => {},
      });
    }
  }

  // ------------------------------------------------------------- CU21 checkout
  /**
   * CU21: Procesa la compra contra el backend real (flujo ONLINE del
   * Cliente). El id_cliente se toma del token; el backend ignora cualquier
   * id_cliente_override que venga en el payload.
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
    // El checkout online es solo del Cliente; el backend además responde 403 a los demás roles.
    if (!this.auth.esCliente()) {
      return throwError(() => ({
        status: 403,
        error: { detail: 'Solo el rol Cliente puede comprar desde el carrito.' },
      }));
    }
    return this.procesarVenta(
      this._items(),
      metodo_pago,
      datos_entrega,
      'ONLINE',
      undefined,
    );
  }

  /**
   * CU11: Procesa una venta POS (mostrador) por POST /api/v1/ventas/pos
   * (solo V/GS/ASU). El id del cliente lo elige el Vendedor en el modal POS;
   * el id del vendedor lo toma el backend del token. NO toca el carrito
   * global del Cliente (usa el array `items` que recibe como argumento).
   */
  procesarVentaPos(
    items: CarritoItem[],
    metodo_pago: MetodoPago,
    datos_entrega: DatosEntrega,
    id_cliente: string,
  ): Observable<Venta> {
    return this.procesarVenta(
      items,
      metodo_pago,
      datos_entrega,
      'POS',
      id_cliente,
    );
  }

  /**
   * Implementación única de checkout usada por procesarCompra (online)
   * y procesarVentaPos (POS). Valida carrito vacío, arma el payload
   * con la forma extendida de CU11 y delega al endpoint.
   */
  private procesarVenta(
    items: CarritoItem[],
    metodo_pago: MetodoPago,
    datos_entrega: DatosEntrega,
    tipo_venta: TipoVenta,
    id_cliente_override: string | undefined,
  ): Observable<Venta> {
    if (!items || items.length === 0) {
      return throwError(() => ({
        error: { detail: 'El carrito está vacío.' },
      }));
    }

    // El carrito NO envía precios: el server usa precio_venta de la DB
    // (anti-manipulación). Solo id + cantidad + variante.
    const itemsPayload = items.map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      talla: i.talla,
      color: i.color,
    }));

    const body: Record<string, unknown> = {
      items: itemsPayload,
      metodo_pago,
      datos_entrega,
      tipo_venta,
    };
    if (id_cliente_override) {
      body['id_cliente_override'] = id_cliente_override;
    }

    // Compra online del Cliente -> /ventas/checkout (solo C); mostrador -> /ventas/pos (V/GS/ASU).
    const endpoint = tipo_venta === 'POS' ? '/ventas/pos' : '/ventas/checkout';

    return this.api
      .post<ApiResponse<VentaDTO>>(endpoint, body)
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
      vendedor_id: dto.vendedor_id ?? null,
      tipo_venta: dto.tipo_venta ?? 'ONLINE',
    };
  }

  // ------------------------------------------------------------ persistencia
  /** Clave de localStorage del carrito del Cliente actual (null si no es Cliente). */
  private storageKey(): string | null {
    const id = this.auth.getCurrentUser()?.id_usuario;
    return this.auth.esCliente() && id ? `${STORAGE_KEY}_${id}` : null;
  }

  /** Guarda los ítems en localStorage (solo en el navegador y solo para el Cliente). */
  private persistir(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const clave = this.storageKey();
    if (!clave) return;
    try {
      localStorage.setItem(clave, JSON.stringify(this._items()));
    } catch {
      // storage lleno/bloqueado: el carrito sigue vivo en memoria
    }
  }

  /** Restaura los ítems de localStorage (vacío en el servidor SSR). */
  private leerStorage(): CarritoItem[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      localStorage.removeItem(STORAGE_KEY); // carrito global de la versión anterior
      const clave = this.storageKey();
      if (!clave) return [];
      const crudo = localStorage.getItem(clave);
      return crudo ? (JSON.parse(crudo) as CarritoItem[]) : [];
    } catch {
      return [];
    }
  }
}
