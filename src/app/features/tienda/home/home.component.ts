import { Component, OnInit, inject, signal } from '@angular/core';
import { CatalogoTiendaService } from '../../../core/services/catalogo-tienda.service';
import { CarritoService } from '../../../core/services/carrito.service';
import {
  ProductoTienda,
  formatBs,
} from '../../../core/models/carrito.model';

/** Opción de talla/color seleccionada por producto (UI del card). */
interface SeleccionVariante {
  talla: string;
  color: string;
  color_hex: string;
}

/**
 * CU15 (fase mock) — Home de la tienda del Cliente.
 * Catálogo visual en cards con selección de talla/color y botón
 * "Agregar al Carrito" por variante. La paleta es la de Attention.
 */
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly catalogoService = inject(CatalogoTiendaService);
  protected readonly carritoService = inject(CarritoService);

  /** Catálogo visible del cliente (mock). */
  protected readonly productos = signal<ProductoTienda[]>([]);
  protected readonly cargando = signal(true);

  /** Variante seleccionada por producto (producto_id -> selección). */
  protected readonly seleccion = signal<Record<number, SeleccionVariante>>({});

  /** Toast breve al agregar al carrito. */
  protected readonly agregado = signal<string | null>(null);
  private temporizador?: ReturnType<typeof setTimeout>;

  protected readonly formatBs = formatBs;

  ngOnInit(): void {
    this.catalogoService.getCatalogo().subscribe({
      next: (productos) => {
        // Selección por defecto: primera talla y primer color de cada card
        const inicial: Record<number, SeleccionVariante> = {};
        for (const p of productos) {
          inicial[p.producto_id] = {
            talla: p.tallas[0],
            color: p.colores[0].nombre,
            color_hex: p.colores[0].hex,
          };
        }
        this.seleccion.set(inicial);
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  /** Cambia la talla seleccionada de un producto. */
  protected elegirTalla(producto: ProductoTienda, talla: string): void {
    this.seleccion.update((sel) => ({
      ...sel,
      [producto.producto_id]: { ...sel[producto.producto_id], talla },
    }));
  }

  /** Cambia el color seleccionado de un producto. */
  protected elegirColor(
    producto: ProductoTienda,
    color: { nombre: string; hex: string },
  ): void {
    this.seleccion.update((sel) => ({
      ...sel,
      [producto.producto_id]: {
        ...sel[producto.producto_id],
        color: color.nombre,
        color_hex: color.hex,
      },
    }));
  }

  /** CU15: Agrega la variante seleccionada del producto al carrito. */
  protected agregarAlCarrito(producto: ProductoTienda): void {
    const sel = this.seleccion()[producto.producto_id];
    if (!sel) return;

    this.carritoService.agregarAlCarrito({
      producto_id: producto.producto_id,
      nombre: producto.nombre,
      talla: sel.talla,
      color: sel.color,
      color_hex: sel.color_hex,
      precio: producto.precio,
      cantidad: 1,
      imagen_url: producto.imagen_url,
    });

    this.mostrarToast(`${producto.nombre} (${sel.talla}, ${sel.color}) agregado`);
  }

  private mostrarToast(mensaje: string): void {
    this.agregado.set(mensaje);
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.agregado.set(null), 2500);
  }
}
