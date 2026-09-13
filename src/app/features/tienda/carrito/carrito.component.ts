import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CarritoService } from '../../../core/services/carrito.service';
import { formatBs } from '../../../core/models/carrito.model';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';

/**
 * CU15 — Vista del Carrito de Compras (Cliente).
 * Lista de ítems con control de cantidades (+/-), eliminar ítem,
 * vaciar carrito (ConfirmDialog), resumen subtotal/envío/total y
 * botón "Proceder al Pago" que lleva al checkout (CU21).
 */
@Component({
  selector: 'app-carrito',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './carrito.component.html',
})
export class CarritoComponent {
  protected readonly carrito = inject(CarritoService);
  protected readonly formatBs = formatBs;

  /** ConfirmDialog de vaciado completo. */
  protected confirmandoVaciado = false;

  /** Incrementa la cantidad de un ítem (máx. 99 por variante). */
  protected incrementar(
    producto_id: number,
    talla: string,
    color: string,
    cantidad: number,
  ): void {
    if (cantidad < 99) {
      this.carrito.actualizarCantidad(producto_id, talla, color, cantidad + 1);
    }
  }

  /** Decrementa la cantidad; en 0 se elimina el ítem del carrito. */
  protected decrementar(
    producto_id: number,
    talla: string,
    color: string,
    cantidad: number,
  ): void {
    if (cantidad <= 1) {
      this.eliminar(producto_id, talla, color);
    } else {
      this.carrito.actualizarCantidad(producto_id, talla, color, cantidad - 1);
    }
  }

  /** Elimina una variante del carrito. */
  protected eliminar(producto_id: number, talla: string, color: string): void {
    this.carrito.eliminarItem(producto_id, talla, color);
  }

  /** Vacía todo el carrito (tras confirmar el diálogo). */
  protected confirmarVaciado(): void {
    this.carrito.vaciarCarrito();
    this.confirmandoVaciado = false;
  }
}
