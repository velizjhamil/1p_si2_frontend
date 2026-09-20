import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import {
  ReportesService,
  mensajeErrorReporte,
  nombreArchivoExportacion,
  queryString,
  tipoErrorReporte,
} from './reportes.service';

const API = `${environment.apiUrl}/reportes`;
const ok = (data: unknown) => ({ status: 'success', message: 'Operacion exitosa', data });

describe('queryString (CU20)', () => {
  it('omite parámetros vacíos, undefined y null', () => {
    expect(queryString({ a: undefined, b: null, c: '', d: 0 })).toBe('?d=0');
    expect(queryString({})).toBe('');
    expect(queryString({ fecha_inicio: undefined })).toBe('');
  });

  it('conserva las fechas exactamente como se eligieron (sin conversión de zona)', () => {
    expect(queryString({ fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31' })).toBe(
      '?fecha_inicio=2026-01-01&fecha_fin=2026-01-31',
    );
  });
});

describe('ReportesService (CU20): consume los 5 endpoints', () => {
  let servicio: ReportesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ReportesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /reportes/ventas sin filtros no envía query (el backend usa sus defaults)', () => {
    let resp: unknown;
    servicio.getVentas().subscribe((r) => (resp = r));
    const req = http.expectOne(`${API}/ventas`);
    expect(req.request.method).toBe('GET');
    req.flush(ok({ num_ventas: 8 }));
    expect(resp).toEqual(ok({ num_ventas: 8 }));
  });

  it('GET /reportes/ventas con fecha_inicio, fecha_fin, categoria_id y canal_venta', () => {
    servicio
      .getVentas({ fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31', categoria_id: 9, canal_venta: 'POS' })
      .subscribe();
    http
      .expectOne(`${API}/ventas?fecha_inicio=2026-01-01&fecha_fin=2026-01-31&categoria_id=9&canal_venta=POS`)
      .flush(ok({}));
  });

  it('GET /reportes/productos-mas-vendidos con top', () => {
    servicio.getProductosMasVendidos({ canal_venta: 'ONLINE', top: 5 }).subscribe();
    http.expectOne(`${API}/productos-mas-vendidos?canal_venta=ONLINE&top=5`).flush(ok({}));
  });

  it('GET /reportes/inventario con nivel_stock y limite', () => {
    servicio.getInventario({ categoria_id: 3, nivel_stock: 'BAJO', limite: 50 }).subscribe();
    http.expectOne(`${API}/inventario?categoria_id=3&nivel_stock=BAJO&limite=50`).flush(ok({}));
  });

  it('GET /reportes/devoluciones con estado, top y limite_detalle', () => {
    servicio
      .getDevoluciones({ fecha_fin: '2026-03-31', estado: 'COMPLETADA', top: 3, limite_detalle: 20 })
      .subscribe();
    http
      .expectOne(`${API}/devoluciones?fecha_fin=2026-03-31&estado=COMPLETADA&top=3&limite_detalle=20`)
      .flush(ok({}));
  });

  it('GET /reportes/rendimiento-vendedores usa fecha_desde / fecha_hasta / tipo_venta', () => {
    servicio
      .getRendimientoVendedores({ fecha_desde: '2026-01-01', fecha_hasta: '2026-03-31', tipo_venta: 'POS' })
      .subscribe();
    http
      .expectOne(`${API}/rendimiento-vendedores?fecha_desde=2026-01-01&fecha_hasta=2026-03-31&tipo_venta=POS`)
      .flush(ok({}));
  });
});

describe('Errores de reportes (401 / 403 / 422 / inesperado)', () => {
  it('401 -> no-autenticado, mensaje de sesión', () => {
    const err = { status: 401, error: { detail: 'Token de acceso requerido (Authorization: Bearer).' } };
    expect(tipoErrorReporte(err)).toBe('no-autenticado');
    expect(mensajeErrorReporte(err)).toContain('sesión');
  });

  it('403 -> sin-permiso, usa el detail del backend', () => {
    const err = { status: 403, error: { detail: 'Su rol no tiene acceso al panel de reportes.' } };
    expect(tipoErrorReporte(err)).toBe('sin-permiso');
    expect(mensajeErrorReporte(err)).toBe('Su rol no tiene acceso al panel de reportes.');
  });

  it('403 sin detail -> mensaje por defecto', () => {
    expect(mensajeErrorReporte({ status: 403, error: {} })).toBe('Su rol no tiene acceso al panel de reportes.');
  });

  it('422 con detail string (regla de negocio) se muestra tal cual', () => {
    const detail = 'fecha_inicio (2026-03-01) no puede ser posterior a fecha_fin (2026-02-01).';
    const err = { status: 422, error: { detail } };
    expect(tipoErrorReporte(err)).toBe('filtros-invalidos');
    expect(mensajeErrorReporte(err)).toBe(detail);
  });

  it('422 con lista de validación de FastAPI -> "Etiqueta: mensaje"', () => {
    const err = {
      status: 422,
      error: {
        detail: [
          { loc: ['query', 'categoria_id'], msg: 'Input should be greater than or equal to 1' },
          { loc: ['query', 'top'], msg: 'Input should be less than or equal to 100' },
        ],
      },
    };
    expect(mensajeErrorReporte(err)).toBe(
      'Categoría: Input should be greater than or equal to 1 · Top: Input should be less than or equal to 100',
    );
  });

  it('422 sin detalle usable -> mensaje genérico de filtros', () => {
    expect(mensajeErrorReporte({ status: 422, error: {} })).toBe('Los filtros ingresados no son válidos.');
  });

  it('0 (sin red) y 5xx -> inesperado con mensajes distintos', () => {
    expect(tipoErrorReporte({ status: 0 })).toBe('inesperado');
    expect(mensajeErrorReporte({ status: 0 })).toBe('No hay conexión con el servidor.');
    expect(tipoErrorReporte({ status: 500 })).toBe('inesperado');
    expect(mensajeErrorReporte({ status: 500, error: { detail: 'boom interno' } })).toBe(
      'No se pudo cargar el reporte. Intente nuevamente.',
    ); // el detalle interno de un 5xx no se muestra al usuario
  });

  it('valores nulos no rompen', () => {
    expect(tipoErrorReporte(null)).toBe('inesperado');
    expect(mensajeErrorReporte(null)).toBe('No se pudo cargar el reporte. Intente nuevamente.');
  });
});

describe('ReportesService.exportar (CU20): descarga PDF / Excel', () => {
  let servicio: ReportesService;
  let http: HttpTestingController;
  const err = (detail: unknown) => new Blob([JSON.stringify({ detail })], { type: 'application/json' });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(ReportesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el MISMO endpoint del reporte con los mismos filtros + formato, como blob', () => {
    let recibido: Blob | undefined;
    servicio
      .exportar('ventas', 'xlsx', { fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31', categoria_id: 9, canal_venta: 'POS' })
      .subscribe((b) => (recibido = b));
    const req = http.expectOne(`${API}/ventas?fecha_inicio=2026-01-01&fecha_fin=2026-01-31&categoria_id=9&canal_venta=POS&formato=xlsx`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['PK'], { type: 'application/octet-stream' }));
    expect(recibido).toBeInstanceOf(Blob);
    expect(recibido!.size).toBe(2);
  });

  it('cada reporte exporta desde su propio endpoint (sin rutas nuevas)', () => {
    servicio.exportar('productos-mas-vendidos', 'pdf', { top: 3 }).subscribe();
    http.expectOne(`${API}/productos-mas-vendidos?top=3&formato=pdf`).flush(new Blob(['x']));
    servicio.exportar('inventario', 'pdf', { nivel_stock: 'BAJO', limite: 5 }).subscribe();
    http.expectOne(`${API}/inventario?nivel_stock=BAJO&limite=5&formato=pdf`).flush(new Blob(['x']));
    servicio.exportar('devoluciones', 'xlsx', { estado: 'COMPLETADA', limite_detalle: 20 }).subscribe();
    http.expectOne(`${API}/devoluciones?estado=COMPLETADA&limite_detalle=20&formato=xlsx`).flush(new Blob(['x']));
    servicio.exportar('rendimiento-vendedores', 'xlsx', { fecha_desde: '2026-01-01', fecha_hasta: '2026-01-31', tipo_venta: 'POS' }).subscribe();
    http.expectOne(`${API}/rendimiento-vendedores?fecha_desde=2026-01-01&fecha_hasta=2026-01-31&tipo_venta=POS&formato=xlsx`).flush(new Blob(['x']));
  });

  it('sin filtros solo envía el formato (el backend usa sus defaults)', () => {
    servicio.exportar('ventas', 'pdf').subscribe();
    http.expectOne(`${API}/ventas?formato=pdf`).flush(new Blob(['x']));
  });

  for (const [status, detail, tipo, contiene] of [
    [403, 'Su rol no tiene acceso al panel de reportes.', 'sin-permiso', 'Su rol no tiene acceso'],
    [422, 'fecha_inicio (2026-03-01) no puede ser posterior a fecha_fin (2026-02-01).', 'filtros-invalidos', 'no puede ser posterior'],
    [422, [{ loc: ['query', 'formato'], msg: 'Input should be json, pdf or xlsx' }], 'filtros-invalidos', 'Input should be'],
    [401, 'Token expirado. Inicie sesión nuevamente.', 'no-autenticado', 'sesión'],
  ] as const) {
    it(`${status}: el cuerpo JSON llega como Blob y se convierte en un error legible`, async () => {
      let error: unknown;
      servicio.exportar('ventas', 'pdf', {}).subscribe({ error: (e) => (error = e) });
      http.expectOne(`${API}/ventas?formato=pdf`).flush(err(detail), { status, statusText: 'x' });
      await new Promise((r) => setTimeout(r, 50)); // FileReader es asíncrono
      expect((error as { status: number }).status).toBe(status);
      expect(tipoErrorReporte(error)).toBe(tipo);
      expect(mensajeErrorReporte(error)).toContain(contiene);
    });
  }

  it('500 con cuerpo que no es JSON -> mensaje genérico (sin filtrar el detalle)', async () => {
    let error: unknown;
    servicio.exportar('ventas', 'pdf').subscribe({ error: (e) => (error = e) });
    http.expectOne(`${API}/ventas?formato=pdf`).flush(new Blob(['<html>boom</html>']), { status: 500, statusText: 'x' });
    await new Promise((r) => setTimeout(r, 50));
    expect(mensajeErrorReporte(error)).toBe('No se pudo cargar el reporte. Intente nuevamente.');
  });
});

describe('nombreArchivoExportacion (CU20)', () => {
  it('reporte-<tipo>_<inicio>_<fin>.<formato>', () => {
    expect(nombreArchivoExportacion('ventas', '2026-01-01', '2026-01-31', 'pdf')).toBe('reporte-ventas_2026-01-01_2026-01-31.pdf');
    expect(nombreArchivoExportacion('rendimiento-vendedores', '2025-12-01', '2026-03-31', 'xlsx')).toBe(
      'reporte-rendimiento-vendedores_2025-12-01_2026-03-31.xlsx',
    );
  });
});
