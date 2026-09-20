import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AgenciasService } from './agencias.service';

const API = `${environment.apiUrl}/agencias-reparto`;
const ok = (data: unknown, extra: object = {}) => ({ status: 'success', message: 'ok', data, ...extra });

describe('AgenciasService (contrato con /api/v1/agencias-reparto)', () => {
  let service: AgenciasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AgenciasService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('listar: página, límite, búsqueda codificada y filtro de estado', () => {
    const pagina = { status: 'success', message: '', data: [], total: 0, page: 2, limit: 5, pages: 0 };
    let recibido: unknown;
    service.listar({ q: 'Andes & Cía', is_active: false, page: 2, limit: 5 }).subscribe((r) => (recibido = r));
    const req = http.expectOne(`${API}?q=Andes%20%26%20C%C3%ADa&is_active=false&page=2&limit=5`);
    expect(req.request.method).toBe('GET');
    req.flush(pagina);
    expect(recibido).toEqual(pagina);
  });

  it('listar: por defecto página 1, límite 10 y sin filtros', () => {
    service.listar().subscribe();
    http.expectOne(`${API}?page=1&limit=10`).flush({});
  });

  it('obtener / crear / actualizar desempacan el envelope', () => {
    const agencia = { id_agencia: 4, razon_social: 'Andes' };
    const res: unknown[] = [];
    service.obtener(4).subscribe((a) => res.push(a));
    http.expectOne(`${API}/4`).flush(ok(agencia));

    service.crear({ razon_social: 'Andes', nit: '1020304050', correo_facturacion: 'f@a.com', direccion_fiscal: 'Av 1' }).subscribe((a) => res.push(a));
    const post = http.expectOne(API);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ razon_social: 'Andes', nit: '1020304050', correo_facturacion: 'f@a.com', direccion_fiscal: 'Av 1' });
    post.flush(ok(agencia));

    service.actualizar(4, { telefono: '7000' }).subscribe((a) => res.push(a));
    const put = http.expectOne(`${API}/4`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ telefono: '7000' });
    put.flush(ok(agencia));
    expect(res).toEqual([agencia, agencia, agencia]);
  });

  it('cambiarEstado usa PATCH /{id}/estado con is_active', () => {
    service.cambiarEstado(4, false).subscribe();
    const req = http.expectOne(`${API}/4/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ is_active: false });
    req.flush(ok({ id_agencia: 4, is_active: false }));
  });

  it('eliminar devuelve el mensaje del backend', () => {
    let mensaje = '';
    service.eliminar(4).subscribe((m) => (mensaje = m));
    const req = http.expectOne(`${API}/4`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ status: 'success', data: null, message: "Agencia 'Andes' eliminada correctamente." });
    expect(mensaje).toBe("Agencia 'Andes' eliminada correctamente.");
  });

  it('zonas: listar, crear (por id_ciudad), editar y eliminar', () => {
    service.zonas(4).subscribe();
    http.expectOne(`${API}/4/zonas`).flush(ok([]));
    service.crearZona(4, { id_ciudad: 2, nombre_zona: 'Sopocachi' }).subscribe();
    const post = http.expectOne(`${API}/4/zonas`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ id_ciudad: 2, nombre_zona: 'Sopocachi' });
    post.flush(ok({}));
    service.actualizarZona(4, 9, { nombre_zona: 'Norte' }).subscribe();
    const put = http.expectOne(`${API}/4/zonas/9`);
    expect(put.request.method).toBe('PUT');
    put.flush(ok({}));
    service.eliminarZona(4, 9).subscribe();
    const del = http.expectOne(`${API}/4/zonas/9`);
    expect(del.request.method).toBe('DELETE');
    del.flush({ status: 'success', data: null, message: 'x' });
  });

  it('tarifas: rutas anidadas y null explícito en rango_max / vigente_hasta', () => {
    service.tarifas(4, 9).subscribe();
    http.expectOne(`${API}/4/zonas/9/tarifas`).flush(ok([]));
    service
      .crearTarifa(4, 9, { criterio: 'PESO', rango_min: '5', rango_max: null, costo: '12.50', vigente_desde: '2026-01-01', vigente_hasta: null, is_active: true })
      .subscribe();
    const post = http.expectOne(`${API}/4/zonas/9/tarifas`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body.rango_max).toBeNull();
    expect(post.request.body.vigente_hasta).toBeNull();
    post.flush(ok({}));
    service.actualizarTarifa(4, 9, 3, { rango_max: null }).subscribe();
    const put = http.expectOne(`${API}/4/zonas/9/tarifas/3`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ rango_max: null });
    expect('vigente_hasta' in put.request.body).toBe(false);
    put.flush(ok({}));
    service.eliminarTarifa(4, 9, 3).subscribe();
    http.expectOne(`${API}/4/zonas/9/tarifas/3`).flush({ status: 'success', data: null, message: 'x' });
  });

  it('disponibles: ciudad codificada y respuesta con la ciudad resuelta', () => {
    let r: unknown;
    service.disponibles('Santa Cruz de la Sierra').subscribe((x) => (r = x));
    const req = http.expectOne(`${API}/disponibles?ciudad=Santa%20Cruz%20de%20la%20Sierra`);
    expect(req.request.method).toBe('GET');
    req.flush(ok([{ id_agencia: 4 }], { total: 1, ciudad: { id_ciudad: 1, nombre: 'Santa Cruz de la Sierra', departamento: 'Santa Cruz' } }));
    expect(r).toEqual({
      agencias: [{ id_agencia: 4 }],
      ciudad: { id_ciudad: 1, nombre: 'Santa Cruz de la Sierra', departamento: 'Santa Cruz' },
    });
  });

  it('cotizar: ciudad, peso_kg y volumen_m3 como query (strings, sin perder precisión)', () => {
    let r: unknown;
    service.cotizar(4, { ciudad: 'La Paz', peso_kg: '2.500', volumen_m3: '0.05' }).subscribe((x) => (r = x));
    const req = http.expectOne(`${API}/4/cotizacion?ciudad=La%20Paz&peso_kg=2.500&volumen_m3=0.05`);
    expect(req.request.method).toBe('GET');
    req.flush(ok({ costo_agencia: 12.5 }));
    expect(r).toEqual({ costo_agencia: 12.5 });
  });

  it('ciudades usa el catálogo existente', () => {
    service.ciudades().subscribe();
    http.expectOne(`${environment.apiUrl}/ciudades`).flush(ok([]));
  });
});
