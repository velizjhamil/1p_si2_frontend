import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { Envio, HistorialEnvio, Repartidor } from '../../core/models/envio.model';
import { EnviosService, mensajeErrorEnvio } from './envios.service';

const BASE = `${environment.apiUrl}/envios`;

function envioDemo(parcial: Partial<Envio> = {}): Envio {
  return {
    id_envio: 7,
    id_venta: 3,
    codigo_venta: 'ATT-000003',
    estado: 'PREPARANDO',
    transiciones_permitidas: ['LISTO_ENVIO', 'CANCELADO'],
    cliente_id: 'c1',
    cliente_nombre: 'Cliente Demo',
    total_venta: 120.5,
    datos_entrega: {
      nombre_cliente: 'Cliente Demo',
      correo: 'c@x.com',
      telefono: '70000000',
      direccion: 'Av. 1',
      ciudad: 'Santa Cruz',
      referencia: null,
    },
    items: [],
    codigo_sucursal: null,
    sucursal_nombre: null,
    repartidor_id: null,
    repartidor_nombre: null,
    fecha_estimada_entrega: null,
    fecha_entrega_real: null,
    motivo_fallo: null,
    fecha_reprogramacion: null,
    intentos_fallidos: 0,
    fecha_creacion: '2026-09-19T10:00:00Z',
    fecha_actualizacion: '2026-09-19T10:00:00Z',
    ...parcial,
  };
}

describe('EnviosService (CU18)', () => {
  let service: EnviosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EnviosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listar arma la query con filtros y normaliza la paginación', () => {
    let resultado: unknown;
    service
      .listar({ estado: 'EN_RUTA', q: 'ATT 01', codigo_sucursal: 2, page: 2, limit: 5 })
      .subscribe((r) => (resultado = r));

    const req = http.expectOne(
      `${BASE}?estado=EN_RUTA&q=ATT%2001&codigo_sucursal=2&page=2&limit=5`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      status: 'success',
      message: 'ok',
      data: [envioDemo()],
      total: 11,
      page: 2,
      limit: 5,
      pages: 3,
    });
    expect(resultado).toEqual({ items: [envioDemo()], total: 11, page: 2, limit: 5, pages: 3 });
  });

  it('listar sin filtros usa page=1 y limit=20', () => {
    service.listar().subscribe();
    http.expectOne(`${BASE}?page=1&limit=20`).flush({
      status: 'success', message: '', data: [], total: 0, page: 1, limit: 20, pages: 0,
    });
  });

  it('obtener, obtenerPorVenta e historial desempaquetan el envelope', () => {
    let envio: Envio | undefined;
    let porVenta: Envio | undefined;
    let hist: HistorialEnvio[] | undefined;
    service.obtener(7).subscribe((e) => (envio = e));
    service.obtenerPorVenta(3).subscribe((e) => (porVenta = e));
    service.historial(7).subscribe((h) => (hist = h));

    http.expectOne(`${BASE}/7`).flush({ status: 'success', message: '', data: envioDemo() });
    http.expectOne(`${BASE}/por-venta/3`).flush({ status: 'success', message: '', data: envioDemo() });
    const fila: HistorialEnvio = {
      id_historial: 1, id_envio: 7, estado_anterior: null, estado_nuevo: 'PREPARANDO',
      id_usuario: null, usuario_nombre: null, observacion: null, fecha: '2026-09-19T10:00:00Z',
    };
    http.expectOne(`${BASE}/7/historial`).flush({ status: 'success', message: '', data: [fila] });

    expect(envio?.id_envio).toBe(7);
    expect(porVenta?.id_venta).toBe(3);
    expect(hist).toEqual([fila]);
  });

  it('repartidores consume /envios/repartidores (sin datos hardcodeados)', () => {
    let reps: Repartidor[] | undefined;
    service.repartidores().subscribe((r) => (reps = r));
    const datos: Repartidor[] = [
      { id_usuario: 'u1', nombre: 'Rep Uno', correo: 'r@x.com', envios_activos: 2 },
    ];
    http.expectOne(`${BASE}/repartidores`).flush({ status: 'success', message: '', data: datos });
    expect(reps).toEqual(datos);
  });

  it('cada acción usa el método, la URL y el cuerpo correctos y devuelve el envío actualizado', () => {
    const casos: { llamar: () => void; url: string; body: unknown }[] = [
      {
        llamar: () => service.confirmarPreparacion(7, { codigo_sucursal: 1, observacion: 'ok' }).subscribe(),
        url: `${BASE}/7/confirmar-preparacion`,
        body: { codigo_sucursal: 1, observacion: 'ok' },
      },
      {
        llamar: () =>
          service
            .asignar(7, { id_repartidor: 'u1', fecha_estimada_entrega: '2030-01-01T12:00:00.000Z' })
            .subscribe(),
        url: `${BASE}/7/asignar`,
        body: { id_repartidor: 'u1', fecha_estimada_entrega: '2030-01-01T12:00:00.000Z' },
      },
      {
        llamar: () => service.actualizarEstado(7, { estado: 'EN_RUTA' }).subscribe(),
        url: `${BASE}/7/estado`,
        body: { estado: 'EN_RUTA' },
      },
      {
        llamar: () => service.registrarIntentoFallido(7, { motivo: 'Cliente no responde' }).subscribe(),
        url: `${BASE}/7/intento-fallido`,
        body: { motivo: 'Cliente no responde' },
      },
      {
        llamar: () =>
          service.reprogramar(7, { nueva_fecha_entrega: '2030-01-02T12:00:00.000Z' }).subscribe(),
        url: `${BASE}/7/reprogramar`,
        body: { nueva_fecha_entrega: '2030-01-02T12:00:00.000Z' },
      },
    ];
    for (const c of casos) {
      c.llamar();
      const req = http.expectOne(c.url);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(c.body);
      req.flush({ status: 'success', message: 'ok', data: envioDemo({ estado: 'ASIGNADO' }) });
    }
  });

  it('actualizarEstado devuelve el Envio (no el envelope)', () => {
    let e: Envio | undefined;
    service.actualizarEstado(7, { estado: 'ENTREGADO' }).subscribe((r) => (e = r));
    http
      .expectOne(`${BASE}/7/estado`)
      .flush({ status: 'success', message: '', data: envioDemo({ estado: 'ENTREGADO' }) });
    expect(e?.estado).toBe('ENTREGADO');
  });

  it('iniciar hace POST /envios', () => {
    service.iniciar({ id_venta: 3 }).subscribe();
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ id_venta: 3 });
    req.flush({ status: 'success', message: '', data: envioDemo() });
  });

  it('propaga los errores HTTP al componente (sin tragarlos)', () => {
    let status = 0;
    service.actualizarEstado(7, { estado: 'ENTREGADO' }).subscribe({ error: (e) => (status = e.status) });
    http.expectOne(`${BASE}/7/estado`).flush(
      { detail: 'Transicion invalida: PREPARANDO -> ENTREGADO.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(status).toBe(409);
  });
});

describe('mensajeErrorEnvio', () => {
  it('usa el detail string del backend (400/403/404/409)', () => {
    expect(mensajeErrorEnvio({ status: 409, error: { detail: 'Transicion invalida.' } })).toBe(
      'Transicion invalida.',
    );
  });

  it('une los errores de validación 422 como campo: mensaje', () => {
    const err = {
      status: 422,
      error: {
        detail: [
          { loc: ['body', 'motivo'], msg: 'String should have at least 5 characters' },
          { loc: ['body', 'observacion'], msg: 'muy largo' },
        ],
      },
    };
    expect(mensajeErrorEnvio(err)).toBe(
      'motivo: String should have at least 5 characters · observacion: muy largo',
    );
  });

  it('mensajes por defecto para red caída o error sin detail', () => {
    expect(mensajeErrorEnvio({ status: 0 })).toBe('No hay conexión con el servidor.');
    expect(mensajeErrorEnvio({ status: 500, error: {} })).toBe('No se pudo completar la operación.');
    expect(mensajeErrorEnvio(null, 'Falló X')).toBe('Falló X');
  });
});
