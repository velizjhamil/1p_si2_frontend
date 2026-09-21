import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { CheckoutComponent } from './checkout.component';
import { PasarelaService } from '../../../core/services/pasarela.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { AuthService } from '../../../core/services/auth.service';

describe('CheckoutComponent - Integración Oficial Stripe Checkout (CU21)', () => {
  let pasarelaMock: {
    crearSesionStripe: ReturnType<typeof vi.fn>;
    confirmarSesionStripe: ReturnType<typeof vi.fn>;
    iniciarPago: ReturnType<typeof vi.fn>;
    consultarEstado: ReturnType<typeof vi.fn>;
  };

  let queryParams: Record<string, string> = {};

  beforeEach(() => {
    queryParams = {};
    pasarelaMock = {
      crearSesionStripe: vi.fn(),
      confirmarSesionStripe: vi.fn(),
      iniciarPago: vi.fn(),
      consultarEstado: vi.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PasarelaService, useValue: pasarelaMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParams,
            },
          },
        },
      ],
    });
  });

  it('se crea exitosamente e inicializa con QR y opción Stripe Checkout', () => {
    const fixture = TestBed.createComponent(CheckoutComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp).toBeTruthy();
    const metodos = comp['metodosPago'];
    const stripeMetodo = metodos.find((m) => m.id === 'TARJETA');
    expect(stripeMetodo).toBeDefined();
    expect(stripeMetodo?.label).toContain('Stripe Checkout');
  });

  it('detecta retorno con stripe_session_id y confirma la venta automáticamente', () => {
    queryParams['stripe_session_id'] = 'cs_test_mock_12345';
    pasarelaMock.confirmarSesionStripe.mockReturnValue(
      of({
        status: 'success',
        data: {
          id_venta: 88,
          codigo_venta: 'ATT-998877',
          total: 250,
          estado_pago: 'PAGADO',
          comprobante_fiscal: { nro_factura: 'ATT-998877' },
        },
      })
    );

    const fixture = TestBed.createComponent(CheckoutComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(pasarelaMock.confirmarSesionStripe).toHaveBeenCalledWith('cs_test_mock_12345');
    expect(comp['ventaConfirmada']()?.id).toBe(88);
    expect(comp['ventaConfirmada']()?.estado_pago).toBe('PAGADO');
  });

  it('detecta cancel=true de Stripe Checkout y muestra aviso amigable al usuario', () => {
    queryParams['cancel'] = 'true';

    const fixture = TestBed.createComponent(CheckoutComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    expect(comp['errorMessage']()).toContain('cancelado');
  });

  it('al pulsar confirmar con TARJETA solicita sesión de Stripe y prepara redirección', () => {
    const fixture = TestBed.createComponent(CheckoutComponent);
    const comp = fixture.componentInstance;
    const carrito = TestBed.inject(CarritoService);

    // Mock cart items
    vi.spyOn(carrito, 'vacio').mockReturnValue(false);
    vi.spyOn(carrito, 'items').mockReturnValue([
      {
        producto_id: 10,
        nombre: 'Polera Test',
        precio: 100,
        cantidad: 2,
        subtotal: 200,
        talla: 'M',
        color: 'Negro',
        color_hex: '#000000',
        imagen_url: null,
      },
    ]);
    vi.spyOn(carrito, 'total').mockReturnValue(200);

    // Fill form
    comp['datosForm'].patchValue({
      nombre_cliente: 'Juan Perez',
      correo: 'juan@example.com',
      telefono: '77889900',
      direccion: 'Av. Siempre Viva 123',
      ciudad: 'Santa Cruz',
    });

    comp['metodoSeleccionado'].set('TARJETA');

    pasarelaMock.crearSesionStripe.mockReturnValue(
      of({
        status: 'success',
        data: {
          session_id: 'cs_test_created_999',
          url: 'https://checkout.stripe.com/c/pay/cs_test_created_999',
          codigo_venta: 'ATT-112233',
          id_venta: 50,
          total: 200,
        },
      })
    );

    comp['confirmarYpagar']();

    expect(pasarelaMock.crearSesionStripe).toHaveBeenCalled();
    const payloadSent = pasarelaMock.crearSesionStripe.mock.calls[0][0];
    expect(payloadSent.items.length).toBe(1);
    expect(payloadSent.success_url).toContain('stripe_session_id=');
    expect(payloadSent.cancel_url).toContain('cancel=true');
  });
});
