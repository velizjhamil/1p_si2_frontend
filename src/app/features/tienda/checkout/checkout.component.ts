import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CarritoService } from '../../../core/services/carrito.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  DatosEntrega,
  MetodoPago,
  Venta,
  formatBs,
} from '../../../core/models/carrito.model';

/** Métodos de pago disponibles en el checkout (CU21). */
const METODOS_PAGO: { id: MetodoPago; label: string; icono: string; descripcion: string }[] = [
  { id: 'QR', label: 'QR Simple', icono: '📱', descripcion: 'Escáinee el código con su app bancaria' },
  { id: 'TARJETA', label: 'Tarjeta', icono: '💳', descripcion: 'Crédito o débito (Visa/Mastercard)' },
  { id: 'EFECTIVO', label: 'Efectivo', icono: '💵', descripcion: 'Pague en tienda al recibir su pedido' },
];

/**
 * CU21 — Gestión de Compra / Checkout (Cliente).
 * Resumen final de la orden, selección de método de pago (QR con
 * imagen mock, Tarjeta, Efectivo), datos de facturación/entrega y
 * "Confirmar y Pagar". Al procesar, genera la Venta mock y muestra el
 * ticket/comprobante visual.
 */
@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  protected readonly carrito = inject(CarritoService);
  private readonly auth = inject(AuthService);

  protected readonly formatBs = formatBs;
  protected readonly metodosPago = METODOS_PAGO;

  /** Método de pago seleccionado (QR por defecto). */
  protected readonly metodoSeleccionado = signal<MetodoPago>('QR');

  /** Procesando el pago (simula la pasarela). */
  protected readonly procesando = signal(false);

  /** Venta confirmada: controla el modal de ticket. */
  protected readonly ventaConfirmada = signal<Venta | null>(null);

  /** Mensaje de error del proceso de pago. */
  protected readonly errorMessage = signal('');

  /** Datos de facturación/entrega (precargados del usuario autenticado). */
  protected readonly datosForm = this.fb.group({
    nombre_cliente: [
      this.auth.getCurrentUser()?.nombre ?? '',
      [Validators.required, Validators.minLength(3)],
    ],
    correo: [
      this.auth.getCurrentUser()?.correo ?? '',
      [Validators.required, Validators.email],
    ],
    telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
    direccion: ['', [Validators.required, Validators.minLength(5)]],
    ciudad: ['', Validators.required],
    referencia: [''],
  });

  /** Selecciona un método de pago. */
  protected elegirMetodo(metodo: MetodoPago): void {
    this.metodoSeleccionado.set(metodo);
  }

  /** CU21: Confirma y paga — procesa la compra mock y abre el ticket. */
  protected confirmarYpagar(): void {
    if (this.procesando()) return;

    if (this.datosForm.invalid) {
      this.errorMessage.set(
        'Complete los datos de facturación/entrega (teléfono 7-8 dígitos).'
      );
      return;
    }
    if (this.carrito.vacio()) {
      this.errorMessage.set('Su carrito está vacío.');
      return;
    }

    const datos: DatosEntrega = {
      nombre_cliente: this.datosForm.value.nombre_cliente!.trim(),
      correo: this.datosForm.value.correo!.trim(),
      telefono: this.datosForm.value.telefono!.trim(),
      direccion: this.datosForm.value.direccion!.trim(),
      ciudad: this.datosForm.value.ciudad!,
      referencia: this.datosForm.value.referencia?.trim() || undefined,
    };

    this.procesando.set(true);
    this.errorMessage.set('');

    this.carrito
      .procesarCompra(this.metodoSeleccionado(), datos)
      .subscribe({
        next: (venta) => {
          this.carrito.confirmarVenta(); // vacía el carrito
          this.ventaConfirmada.set(venta);
          this.procesando.set(false);
        },
        error: (err: { error?: { detail?: string } }) => {
          this.errorMessage.set(err?.error?.detail ?? 'El pago no pudo procesarse.');
          this.procesando.set(false);
        },
      });
  }

  /** Cierra el ticket y vuelve al catálogo. */
  protected cerrarTicket(): void {
    this.ventaConfirmada.set(null);
  }

  /** Fecha legible para el ticket. */
  protected fechaLegible(iso: string): string {
    return new Date(iso).toLocaleString('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // -------------------------------------------------------------- visuales mock
  /**
   * Celdas del QR mock (7x7): patrón pseudoaleatorio determinístico
   * con las tres "ojeras" de posicionamiento en las esquinas.
   */
  protected readonly qrCeldas = computed<boolean[]>(() => {
    const N = 7; // grid 7x7 = 49 celdas
    const celdas: boolean[] = [];
    // Semilla fija: el QR se ve igual en cada render (evita parpadeo CSR)
    let semilla = 123456789;
    const rnd = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    for (let i = 0; i < N * N; i++) {
      celdas.push(rnd() > 0.5);
    }
    // Ojeras de posicionamiento (esquinas): patrones fijos del QR
    const ojera = (fila: number, col: number) => {
      const set = (r: number, c: number, v: boolean) => {
        celdas[r * N + c] = v;
      };
      // borde exterior completo + centro
      for (let k = 0; k < 3; k++) {
        set(fila, col + k, true);
        set(fila + 2, col + k, true);
        set(fila + k, col, true);
        set(fila + k, col + 2, true);
      }
      set(fila + 1, col + 1, true);
      // limpiar interiores falsos
      set(fila, col + 0, true);
      set(fila + 2, col + 2, true);
    };
    ojera(0, 0);
    ojera(0, 4);
    ojera(4, 0);
    return celdas;
  });

  /** Alturas de las barras del "barcode" del ticket (visual mock). */
  protected readonly barrasTicket = computed<number[]>(() => {
    let semilla = 987654321;
    const rnd = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    return Array.from({ length: 42 }, () => 16 + Math.floor(rnd() * 24));
  });

  /** Imprime solo el ticket (window.print del navegador). */
  protected imprimirTicket(): void {
    window.print();
  }
}
