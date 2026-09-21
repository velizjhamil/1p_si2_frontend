import { UpperCasePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../../environments/environment';
import { CarritoService } from '../../../core/services/carrito.service';
import { AuthService } from '../../../core/services/auth.service';
import { PasarelaService } from '../../../core/services/pasarela.service';
import {
  DatosEntrega,
  DatosTarjeta,
  MetodoPago,
  TransaccionPago,
  Venta,
  formatBs,
} from '../../../core/models/carrito.model';

/** Métodos de pago disponibles en el checkout (CU21). */
const METODOS_PAGO: { id: MetodoPago; label: string; icono: string; descripcion: string }[] = [
  { id: 'QR', label: 'QR Simple', icono: '📱', descripcion: 'Escanee el código interoperable con su app bancaria' },
  { id: 'TARJETA', label: 'Tarjeta (Stripe Checkout)', icono: '💳', descripcion: 'Pasarela oficial Stripe · Visa, Mastercard, Amex' },
  { id: 'EFECTIVO', label: 'Efectivo', icono: '💵', descripcion: 'Pague en efectivo contra entrega / en tienda' },
];

@Component({
  selector: 'app-checkout',
  imports: [ReactiveFormsModule, RouterLink, UpperCasePipe],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  protected readonly carrito = inject(CarritoService);
  private readonly auth = inject(AuthService);
  private readonly pasarela = inject(PasarelaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly formatBs = formatBs;
  protected readonly metodosPago = METODOS_PAGO;

  /** Método de pago seleccionado (QR por defecto). */
  protected readonly metodoSeleccionado = signal<MetodoPago>('QR');

  /** Procesando el pago / transacción. */
  protected readonly procesando = signal(false);

  /** Transacción activa generada en la pasarela (para QR o Tarjeta). */
  protected readonly transaccionIniciada = signal<TransaccionPago | null>(null);

  /** Segundos restantes de vigencia del QR. */
  protected readonly segundosRestantes = signal<number>(900);

  /** Venta confirmada: controla el modal de ticket. */
  protected readonly ventaConfirmada = signal<Venta | null>(null);

  /** Mensaje de error del proceso de pago. */
  protected readonly errorMessage = signal('');

  private pollingSub?: Subscription;
  private timerSub?: Subscription;

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

  /** Formulario de tarjeta de crédito/débito */
  protected readonly tarjetaForm = this.fb.group({
    titular: [
      (this.auth.getCurrentUser()?.nombre ?? '').toUpperCase(),
      [Validators.required, Validators.minLength(3)],
    ],
    numero_tarjeta: ['', [Validators.required, Validators.pattern(/^[0-9 ]{15,19}$/)]],
    expiracion: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)]],
    cvv: ['', [Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]],
  });

  ngOnInit(): void {
    // Precargar SDK oficial de Stripe en segundo plano
    if (environment.stripePublishableKey) {
      loadStripe(environment.stripePublishableKey).catch((err) => {
        console.warn('Advertencia al precargar Stripe SDK:', err);
      });
    }

    // Validar retorno exitoso de Stripe Checkout (success_url)
    const stripeSessionId = this.route.snapshot.queryParams['stripe_session_id'];
    if (stripeSessionId) {
      this.procesando.set(true);
      this.errorMessage.set('');
      this.pasarela.confirmarSesionStripe(stripeSessionId).subscribe({
        next: (resp) => {
          const data = resp.data;
          this.carrito.confirmarVenta();
          this.ventaConfirmada.set({
            id: data.id_venta,
            codigo: data.codigo_venta,
            items: this.carrito.items(),
            total: data.total,
            metodo_pago: 'TARJETA',
            estado_pago: data.estado_pago || 'PAGADO',
            fecha: data.fecha || new Date().toISOString(),
            datos_entrega: data.datos_entrega || {
              nombre_cliente: this.datosForm.value.nombre_cliente || 'Cliente',
              correo: this.datosForm.value.correo || '',
              telefono: this.datosForm.value.telefono || '',
              direccion: this.datosForm.value.direccion || '',
              ciudad: this.datosForm.value.ciudad || 'Santa Cruz',
            },
            stripe_id: stripeSessionId,
            comprobante_fiscal: data.comprobante_fiscal,
          });
          this.procesando.set(false);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
        },
        error: (err) => {
          this.errorMessage.set(
            err?.error?.detail ??
              'No se pudo confirmar la sesión oficial de Stripe Checkout.'
          );
          this.procesando.set(false);
          this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {},
            replaceUrl: true,
          });
        },
      });
    }

    // Validar cancelación de pago en Stripe Checkout (cancel_url)
    const cancelParam = this.route.snapshot.queryParams['cancel'];
    if (cancelParam === 'true') {
      this.errorMessage.set('El pago en Stripe Checkout fue cancelado por el usuario.');
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }
  }

  ngOnDestroy(): void {
    this.detenerPolling();
  }

  /** Selecciona un método de pago. */
  protected elegirMetodo(metodo: MetodoPago): void {
    this.metodoSeleccionado.set(metodo);
    this.transaccionIniciada.set(null);
    this.detenerPolling();
  }

  private detenerPolling(): void {
    this.pollingSub?.unsubscribe();
    this.pollingSub = undefined;
    this.timerSub?.unsubscribe();
    this.timerSub = undefined;
  }

  private iniciarPollingQR(codigoTxn: string, ventaInfo: Venta): void {
    this.detenerPolling();
    this.segundosRestantes.set(900);

    this.timerSub = interval(1000).subscribe(() => {
      const rest = this.segundosRestantes();
      if (rest > 0) {
        this.segundosRestantes.set(rest - 1);
      } else {
        this.detenerPolling();
      }
    });

    this.pollingSub = interval(3000).subscribe(() => {
      this.pasarela.consultarEstado(codigoTxn).subscribe({
        next: (resp) => {
          if (resp.data.estado === 'PAGADO') {
            this.detenerPolling();
            this.carrito.confirmarVenta();
            this.ventaConfirmada.set({
              ...ventaInfo,
              estado_pago: 'PAGADO',
            });
            this.procesando.set(false);
          } else if (resp.data.estado === 'RECHAZADO') {
            this.detenerPolling();
            this.errorMessage.set('El pago fue rechazado por la entidad emisora.');
            this.procesando.set(false);
          }
        },
      });
    });
  }

  /** Formatea número de tarjeta en bloques de 4 dígitos */
  protected onNumeroTarjetaInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 16);
    const blocks = clean.match(/.{1,4}/g) ?? [];
    input.value = blocks.join(' ');
    this.tarjetaForm.patchValue({ numero_tarjeta: input.value }, { emitEvent: false });
  }

  /** Formatea fecha de expiración MM/AA */
  protected onExpiracionInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\D/g, '').slice(0, 4);
    if (clean.length >= 3) {
      input.value = `${clean.slice(0, 2)}/${clean.slice(2)}`;
    } else {
      input.value = clean;
    }
    this.tarjetaForm.patchValue({ expiracion: input.value }, { emitEvent: false });
  }

  /** CU21: Confirma y procesa el pago a través de la pasarela */
  protected confirmarYpagar(): void {
    if (this.procesando()) return;

    if (this.datosForm.invalid) {
      this.errorMessage.set('Complete los datos de facturación/entrega (teléfono 7-8 dígitos).');
      return;
    }
    if (this.carrito.vacio()) {
      this.errorMessage.set('Su carrito está vacío.');
      return;
    }

    const metodo = this.metodoSeleccionado();

    const datos: DatosEntrega = {
      nombre_cliente: this.datosForm.value.nombre_cliente!.trim(),
      correo: this.datosForm.value.correo!.trim(),
      telefono: this.datosForm.value.telefono!.trim(),
      direccion: this.datosForm.value.direccion!.trim(),
      ciudad: this.datosForm.value.ciudad!,
      referencia: this.datosForm.value.referencia?.trim() || undefined,
    };

    const itemsPayload = this.carrito.items().map((i) => ({
      producto_id: i.producto_id,
      cantidad: i.cantidad,
      talla: i.talla,
      color: i.color,
    }));

    this.procesando.set(true);
    this.errorMessage.set('');

    if (metodo === 'TARJETA') {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
      const successUrl = `${origin}/tienda/checkout?stripe_session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/tienda/checkout?cancel=true`;

      this.pasarela
        .crearSesionStripe({
          items: itemsPayload,
          datos_entrega: datos,
          tipo_entrega: 'DOMICILIO',
          success_url: successUrl,
          cancel_url: cancelUrl,
        })
        .subscribe({
          next: (resp) => {
            if (resp?.data?.url) {
              window.location.href = resp.data.url;
            } else {
              this.errorMessage.set('No se obtuvo la URL de pago de Stripe Checkout.');
              this.procesando.set(false);
            }
          },
          error: (err) => {
            this.errorMessage.set(
              err?.error?.detail ??
                err?.error?.message ??
                'Error al inicializar la pasarela oficial de Stripe Checkout.'
            );
            this.procesando.set(false);
          },
        });
      return;
    }

    this.pasarela
      .iniciarPago({
        items: itemsPayload,
        metodo_pago: metodo,
        datos_entrega: datos,
        tipo_entrega: 'DOMICILIO',
        tipo_venta: 'ONLINE',
      })
      .subscribe({
        next: (resp) => {
          const transaccion = resp.data.transaccion;
          const ventaObj: Venta = {
            id: resp.data.id_venta,
            codigo: resp.data.codigo_venta,
            items: this.carrito.items(),
            total: resp.data.total,
            metodo_pago: resp.data.metodo_pago,
            estado_pago: resp.data.estado_pago,
            fecha: new Date().toISOString(),
            datos_entrega: datos,
          };

          if (metodo === 'EFECTIVO') {
            this.carrito.confirmarVenta();
            this.ventaConfirmada.set({
              ...ventaObj,
              estado_pago: 'PENDIENTE',
            });
            this.procesando.set(false);
            return;
          }

          if (metodo === 'QR' && transaccion) {
            this.transaccionIniciada.set(transaccion);
            this.iniciarPollingQR(transaccion.codigo_transaccion, ventaObj);
            this.procesando.set(false);
            return;
          }
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.detail ?? 'El pago no pudo procesarse.');
          this.procesando.set(false);
        },
      });
  }

  /** Confirma la validación del abono del QR institucional en tiempo real */
  protected confirmarAbonoManual(): void {
    const txn = this.transaccionIniciada();
    if (!txn) return;

    this.procesando.set(true);
    this.errorMessage.set('');

    this.pasarela.confirmarAbonoQR(txn.codigo_transaccion, 'Abono verificado por cliente').subscribe({
      next: (resp) => {
        this.detenerPolling();
        this.carrito.confirmarVenta();
        this.ventaConfirmada.set({
          id: resp.data.id_venta,
          codigo: resp.data.codigo_venta,
          items: this.carrito.items(),
          total: resp.data.total,
          metodo_pago: 'QR',
          estado_pago: 'PAGADO',
          fecha: resp.data.fecha,
          datos_entrega: {
            nombre_cliente: this.datosForm.value.nombre_cliente!,
            correo: this.datosForm.value.correo!,
            telefono: this.datosForm.value.telefono!,
            direccion: this.datosForm.value.direccion!,
            ciudad: this.datosForm.value.ciudad!,
          },
          comprobante_fiscal: resp.data.comprobante_fiscal,
        });
        this.procesando.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail ?? 'Error al validar el abono del QR.');
        this.procesando.set(false);
      },
    });
  }

  /** Simula la confirmación bancaria del pago QR (botón demo) */
  protected simularConfirmacionBancaria(): void {
    const txn = this.transaccionIniciada();
    if (!txn) return;

    this.procesando.set(true);
    this.pasarela.simularConfirmacion(txn.codigo_transaccion, true).subscribe({
      next: () => {
        // El polling detectará el cambio de inmediato, o lo forzamos:
        this.detenerPolling();
        this.carrito.confirmarVenta();
        this.ventaConfirmada.set({
          id: txn.id_venta ?? 0,
          codigo: txn.codigo_venta ?? 'ATT-000000',
          items: this.carrito.items(),
          total: txn.monto,
          metodo_pago: 'QR',
          estado_pago: 'PAGADO',
          fecha: new Date().toISOString(),
          datos_entrega: {
            nombre_cliente: this.datosForm.value.nombre_cliente!,
            correo: this.datosForm.value.correo!,
            telefono: this.datosForm.value.telefono!,
            direccion: this.datosForm.value.direccion!,
            ciudad: this.datosForm.value.ciudad!,
          },
        });
        this.procesando.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.detail ?? 'Error al simular confirmación bancaria.');
        this.procesando.set(false);
      },
    });
  }

  /** Cierra el ticket y vuelve al catálogo. */
  protected cerrarTicket(): void {
    this.ventaConfirmada.set(null);
    this.transaccionIniciada.set(null);
  }

  /** Fecha legible para el ticket. */
  protected fechaLegible(iso: string): string {
    return new Date(iso).toLocaleString('es-BO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  /** Tiempo formateado para el QR */
  protected tiempoRestanteQR(): string {
    const s = this.segundosRestantes();
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }

  // -------------------------------------------------------------- visuales mock
  /**
   * Celdas del QR (7x7): patrón determinístico con las tres "ojeras".
   */
  protected readonly qrCeldas = computed<boolean[]>(() => {
    const N = 7;
    const celdas: boolean[] = [];
    let semilla = 123456789;
    const rnd = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    for (let i = 0; i < N * N; i++) {
      celdas.push(rnd() > 0.5);
    }
    const ojera = (fila: number, col: number) => {
      const set = (r: number, c: number, v: boolean) => {
        celdas[r * N + c] = v;
      };
      for (let k = 0; k < 3; k++) {
        set(fila, col + k, true);
        set(fila + 2, col + k, true);
        set(fila + k, col, true);
        set(fila + k, col + 2, true);
      }
      set(fila + 1, col + 1, true);
      set(fila + 0, col + 0, true);
      set(fila + 2, col + 2, true);
    };
    ojera(0, 0);
    ojera(0, 4);
    ojera(4, 0);
    return celdas;
  });

  /** Alturas de las barras del código de barras */
  protected readonly barrasTicket = computed<number[]>(() => {
    let semilla = 987654321;
    const rnd = () => {
      semilla = (semilla * 1103515245 + 12345) % 2147483648;
      return semilla / 2147483648;
    };
    return Array.from({ length: 42 }, () => 16 + Math.floor(rnd() * 24));
  });

  /** Imprime solo el ticket (window.print). */
  protected imprimirTicket(): void {
    window.print();
  }
}
