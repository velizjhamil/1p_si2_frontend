import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  CarritoItem,
  DatosEntrega,
  MetodoPago,
  Venta,
} from '../models/carrito.model';

/** Latencia simulada de red (ms) para el checkout mock. */
const MOCK_DELAY = 800;

/** Clave de persistencia del carrito en localStorage. */
const STORAGE_KEY = 'attention_carrito';

/**
 * CU15 — Carrito de Compras (estado global con signals).
 *
 * Mantiene los ítems del carrito EN MEMORIA (mock), persistidos en
 * localStorage (SSR-safe con isPlatformBrowser) para que sobrevivan
 * recargas. Cuando llegue el backend del CU de ventas, este servicio
 * se conecta al ApiService sin tocar los componentes.
 */
@Injectable({ providedIn: 'root' })
export class CarritoService {
  private readonly platformId = inject(PLATFORM_ID);

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

  /** Costo fijo de envío mock (gratis sobre Bs. 300). */
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

  // ------------------------------------------------------------- CU21 mock
  /**
   * CU21 (mock): Procesa la compra con el método de pago elegido.
   * Simula latencia de pasarela y devuelve la Venta confirmada;
   * vacía el carrito solo si el pago es exitoso.
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

    const venta: Venta = {
      id: Math.floor(Math.random() * 1000) + 1,
      codigo: `ATT-${Date.now().toString().slice(-6)}`,
      items: [...this._items()],
      total: this.total(),
      metodo_pago,
      estado_pago: 'PAGADO', // mock: la pasarela siempre aprueba
      fecha: new Date().toISOString(),
      datos_entrega,
    };

    // Simula la respuesta de la pasarela y confirma
    return of(venta).pipe(
      delay(MOCK_DELAY),
      // Efecto: vaciar el carrito al confirmarse el pago
      // (se ejecuta al suscribirse el componente)
    );
  }

  /** Confirma la venta (callback del checkout): limpia el carrito. */
  confirmarVenta(): void {
    this.vaciarCarrito();
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
