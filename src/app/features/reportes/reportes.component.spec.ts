import { Component, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { ErrorInterceptor } from '../../core/interceptors/error.interceptor';
import { JwtInterceptor } from '../../core/interceptors/jwt.interceptor';
import {
  DevolucionesReporte,
  InventarioSituacion,
  ProductosMasVendidos,
  RendimientoVendedores,
  VentasPeriodo,
} from '../../core/models/reporte.model';
import { AuthService } from '../../core/services/auth.service';
import { DescargaArchivoService } from './descarga-archivo.service';
import { ReporteChartComponent } from './reporte-chart.component';
import { MENSAJE_SIN_DATOS, ReportesComponent } from './reportes.component';
import { DevolucionesVistaComponent } from './vistas/devoluciones-vista.component';
import { InventarioVistaComponent } from './vistas/inventario-vista.component';
import { RendimientoVistaComponent } from './vistas/rendimiento-vista.component';
import { TopVistaComponent } from './vistas/top-vista.component';
import { VentasVistaComponent } from './vistas/ventas-vista.component';

const API = environment.apiUrl;
const CATEGORIAS_URL = `${API}/categorias?page=1&limit=100`;

// --------------------------------------------------------------------------
// Doble del gráfico: Chart.js necesita canvas real (no existe en jsdom). Permite
// comprobar QUÉ series recibe cada gráfico (deben ser las del backend).
// --------------------------------------------------------------------------
@Component({ selector: 'app-reporte-chart', template: '<div data-testid="grafico"></div>' })
class GraficoDoble {
  readonly config = input.required<{ type: string; data: { labels: string[]; datasets: { data: number[] }[] } }>();
  readonly alto = input(0);
  readonly descripcion = input('');
}

// --------------------------------------------------------------------------
// Fixtures: mismos datos que el seed de la BD de pruebas (contrato real)
// --------------------------------------------------------------------------
const filtros = { fecha_inicio: '2025-12-01', fecha_fin: '2026-03-31', categoria_id: null, canal_venta: null };

const ventas = (extra: Partial<VentasPeriodo> = {}): VentasPeriodo => ({
  filtros, sin_datos: false, mensaje: null,
  num_ventas: 8, unidades_vendidas: 20, ingresos_productos: 2200, ticket_promedio: 275,
  total_facturado: 2260, total_envios: 60,
  por_fecha: [
    { fecha: '2025-12-30', ingresos: 280, unidades: 3, num_ventas: 1 },
    { fecha: '2025-12-31', ingresos: 0, unidades: 0, num_ventas: 0 },
    { fecha: '2026-01-01', ingresos: 650, unidades: 4, num_ventas: 2 },
  ],
  por_categoria: [
    { id_categoria: 9, categoria: 'Camisas', ingresos: 1260, unidades: 14 },
    { id_categoria: 10, categoria: 'Pantalones', ingresos: 690, unidades: 5 },
  ],
  por_canal: [{ canal: 'POS', ingresos: 1150, num_ventas: 4 }, { canal: 'ONLINE', ingresos: 1050, num_ventas: 4 }],
  por_metodo_pago: [{ metodo_pago: 'QR', ingresos: 1010, num_ventas: 3 }],
  ...extra,
});

const vacio = { sin_datos: true, mensaje: MENSAJE_SIN_DATOS };

const top = (extra: Partial<ProductosMasVendidos> = {}): ProductosMasVendidos => ({
  filtros, sin_datos: false, mensaje: null, top: 10, total_productos_vendidos: 6,
  items: [
    { posicion: 1, id_producto: 11, producto: 'Camisa Oxford', id_categoria: 9, categoria: 'Camisas', cantidad_vendida: 9, total_generado: 900, num_ventas: 5 },
    { posicion: 2, id_producto: 14, producto: 'Jean Slim', id_categoria: 10, categoria: 'Pantalones', cantidad_vendida: 3, total_generado: 450, num_ventas: 2 },
  ],
  ...extra,
});

const inventario = (extra: Partial<InventarioSituacion> = {}): InventarioSituacion => ({
  filtros, sin_datos: false, mensaje: null,
  total_productos: 8, stock_total_unidades: 109, valor_inventario: 13160, agotados: 1,
  por_nivel: { CRITICO: 3, BAJO: 2, OK: 3 }, total_filas: 8, limite: 200,
  items: [
    { id_producto: 14, producto: 'Jean Slim', id_categoria: 10, categoria: 'Pantalones', estado: 'Agotado', stock_actual: 0, precio_venta: 150, valor_stock: 0, nivel_stock: 'CRITICO', unidades_vendidas: 3, rotacion: null, rotacion_disponible: false },
    { id_producto: 11, producto: 'Camisa Oxford', id_categoria: 9, categoria: 'Camisas', estado: 'Activo', stock_actual: 50, precio_venta: 100, valor_stock: 5000, nivel_stock: 'OK', unidades_vendidas: 9, rotacion: 0.18, rotacion_disponible: true },
  ],
  ...extra,
});

const devoluciones = (extra: Partial<DevolucionesReporte> = {}): DevolucionesReporte => ({
  filtros, sin_datos: false, mensaje: null, estado: null,
  num_devoluciones: 7, unidades_devueltas: 7, importe_total: 730, importe_completado: 550,
  por_estado: [
    { estado: 'COMPLETADA', num_devoluciones: 4, unidades: 5, importe: 550 },
    { estado: 'RECHAZADA', num_devoluciones: 1, unidades: 1, importe: 100 },
  ],
  por_fecha: [{ fecha: '2026-03-12', num_devoluciones: 1, unidades: 1, importe: 120 }],
  por_producto: [{ id_producto: 11, producto: 'Camisa Oxford', categoria: 'Camisas', unidades: 3, importe: 300 }],
  por_categoria: [{ id_categoria: 9, categoria: 'Camisas', unidades: 5, importe: 460 }],
  detalle: [{ id_devolucion: 7, fecha_solicitud: '2026-03-12T10:00:00Z', estado: 'COMPLETADA', codigo_venta: 'ATT-T00010', motivo: 'Costura rota', unidades: 1, importe: 120 }],
  ...extra,
});

const rendimiento = (extra: Partial<RendimientoVendedores> = {}): RendimientoVendedores => ({
  items: [{
    id_vendedor: 'b90da8a7', nombre: 'Vera Vendedora', correo: 'v@cu20.test', total_ventas: 4,
    total_ingresos: '1150.00', ticket_promedio: '287.50',
    primera_venta: '2025-12-31T23:59:59Z', ultima_venta: '2026-03-15T15:00:00Z', tipos_venta: { POS: 4 },
  }],
  total_vendedores: 1, total_ingresos: '1150.00', total_operaciones: 4,
  fecha_desde: '2025-12-01', fecha_hasta: '2026-03-31',
  ...extra,
});

const ok = (data: unknown) => ({ status: 'success', message: 'Operacion exitosa', data });

// --------------------------------------------------------------------------
describe('ReportesComponent (CU20)', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ReportesComponent>;
  const descargaMock = { descargar: vi.fn() };

  const html = () => fixture.nativeElement as HTMLElement;
  const q = (id: string) => html().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const texto = () => html().textContent ?? '';

  async function estabilizar() {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Atiende las 2 peticiones del arranque: categorías y el primer reporte (ventas). */
  async function arrancar(respuestaVentas: VentasPeriodo | 'no-responder' = ventas()) {
    fixture = TestBed.createComponent(ReportesComponent);
    fixture.detectChanges();
    http.expectOne(CATEGORIAS_URL).flush({ status: 'success', message: '', data: [
      { id_categoria: 9, nombre: 'Camisas', linea: 'Hombre', descripcion: null, activo: true },
      { id_categoria: 10, nombre: 'Pantalones', linea: 'Hombre', descripcion: null, activo: true },
    ] });
    if (respuestaVentas !== 'no-responder') {
      http.expectOne(`${API}/reportes/ventas`).flush(ok(respuestaVentas));
      await estabilizar();
    }
  }

  /** Escribe un valor en un campo del formulario de filtros. */
  function escribir(id: string, valor: string, evento: 'input' | 'change' = 'input') {
    const el = q(id) as HTMLInputElement | HTMLSelectElement;
    el.value = valor;
    el.dispatchEvent(new Event(evento));
    fixture.detectChanges(); // el navegador ejecuta detección de cambios tras cada evento
  }

  async function aplicar() {
    (q('btn-consultar') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  async function elegirReporte(tipo: string) {
    (q(`tab-${tipo}`) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function graficos(): { type: string; labels: string[]; data: number[] }[] {
    return fixture.debugElement.queryAll(By.directive(GraficoDoble)).map((d) => {
      const c = (d.componentInstance as GraficoDoble).config();
      return { type: c.type, labels: c.data.labels, data: c.data.datasets[0].data };
    });
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [ReportesComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), { provide: DescargaArchivoService, useValue: descargaMock }],
    });
    descargaMock.descargar.mockReset();
    for (const vista of [VentasVistaComponent, TopVistaComponent, InventarioVistaComponent, DevolucionesVistaComponent, RendimientoVistaComponent]) {
      TestBed.overrideComponent(vista, { remove: { imports: [ReporteChartComponent] }, add: { imports: [GraficoDoble] } });
    }
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ------------------------------------------------------------------ carga
  describe('estados de la pantalla', () => {
    it('muestra "cargando" mientras espera y deshabilita el botón', async () => {
      await arrancar('no-responder');
      expect(q('estado-cargando')).not.toBeNull();
      expect((q('btn-consultar') as HTMLButtonElement).disabled).toBe(true);
      http.expectOne(`${API}/reportes/ventas`).flush(ok(ventas()));
      await estabilizar();
      expect(q('estado-cargando')).toBeNull();
      expect((q('btn-consultar') as HTMLButtonElement).disabled).toBe(false);
    });

    it('con datos: KPIs, gráficos y tablas del contrato (sin recalcular)', async () => {
      await arrancar();
      expect(q('estado-datos')).not.toBeNull();
      expect(q('estado-sin-datos')).toBeNull();
      const t = texto();
      expect(t).toContain('Bs. 2,200.00'); // ingresos_productos tal cual del backend
      expect(t).toContain('Bs. 2,260.00'); // total_facturado
      expect(t).toContain('Bs. 275.00'); // ticket_promedio
      // tabla por fecha: solo días con ventas (2 de 3 puntos)
      expect(q('tabla-por-fecha')!.querySelectorAll('tbody tr').length).toBe(2);
      expect(q('tabla-por-categoria')!.querySelectorAll('tbody tr').length).toBe(2);
      // gráficos: reciben las series del backend sin modificar
      const g = graficos();
      expect(g.length).toBe(4);
      expect(g[0]).toEqual({ type: 'line', labels: ['2025-12-30', '2025-12-31', '2026-01-01'], data: [280, 0, 650] });
      expect(g[1].data).toEqual([1260, 690]); // por categoría
      expect(g[2]).toMatchObject({ type: 'doughnut', data: [1150, 1050] }); // por canal
    });

    it('muestra los filtros aplicados (con el período que resolvió el backend)', async () => {
      await arrancar();
      const chips = q('filtros-aplicados')!.textContent!;
      expect(chips).toContain('2025-12-01 → 2026-03-31 (UTC)');
    });

    it('sin_datos=true NO es un error: mensaje informativo y sin gráficos ni tablas', async () => {
      await arrancar(ventas({ ...vacio, num_ventas: 0, unidades_vendidas: 0, ingresos_productos: 0, ticket_promedio: 0, por_fecha: [], por_categoria: [], por_canal: [], por_metodo_pago: [] }));
      expect(q('estado-sin-datos')!.textContent).toContain(MENSAJE_SIN_DATOS);
      expect(q('estado-datos')).toBeNull();
      expect(html().querySelector('[role="alert"]')).toBeNull(); // no se trata como error
      expect(graficos().length).toBe(0);
      expect(q('filtros-aplicados')).not.toBeNull(); // se siguen mostrando los filtros usados
    });

    it('usa el `mensaje` que envía el backend cuando existe', async () => {
      await arrancar(ventas({ sin_datos: true, mensaje: 'Sin datos (mensaje del backend).' }));
      expect(q('estado-sin-datos')!.textContent).toContain('Sin datos (mensaje del backend).');
    });
  });

  // ------------------------------------------------------------ errores HTTP
  describe('errores', () => {
    async function conError(status: number, cuerpo: object) {
      await arrancar('no-responder');
      http.expectOne(`${API}/reportes/ventas`).flush(cuerpo, { status, statusText: 'x' });
      await estabilizar();
    }

    it('401: mensaje de sesión no válida, sin reintento', async () => {
      await conError(401, { detail: 'Token de acceso requerido (Authorization: Bearer).' });
      expect(q('estado-error-no-autenticado')!.textContent).toContain('sesión');
      expect(q('btn-reintentar')).toBeNull();
      expect(q('estado-datos')).toBeNull();
    });

    it('403: acceso denegado con el detail del backend, sin reintento', async () => {
      await conError(403, { detail: 'Su rol no tiene acceso al panel de reportes.' });
      expect(q('estado-error-sin-permiso')!.textContent).toContain('Acceso denegado');
      expect(q('error-mensaje')!.textContent).toContain('Su rol no tiene acceso al panel de reportes.');
      expect(q('btn-reintentar')).toBeNull();
    });

    it('422 (regla de negocio): muestra el detail y conserva los filtros para corregirlos', async () => {
      await arrancar();
      escribir('filtro-fecha-inicio', '2026-03-01');
      escribir('filtro-fecha-fin', '2026-02-01');
      await aplicar();
      http.expectOne(`${API}/reportes/ventas?fecha_inicio=2026-03-01&fecha_fin=2026-02-01`).flush(
        { detail: 'fecha_inicio (2026-03-01) no puede ser posterior a fecha_fin (2026-02-01).' },
        { status: 422, statusText: 'Unprocessable' },
      );
      await estabilizar();
      expect(q('estado-error-filtros-invalidos')!.textContent).toContain('Revise los filtros');
      expect(q('error-mensaje')!.textContent).toContain('no puede ser posterior a fecha_fin');
      expect((q('filtro-fecha-inicio') as HTMLInputElement).value).toBe('2026-03-01'); // no se pierde lo escrito
      expect(q('btn-reintentar')).toBeNull();
    });

    it('422 (validación de FastAPI): muestra "Campo: mensaje" legible', async () => {
      await conError(422, { detail: [{ loc: ['query', 'categoria_id'], msg: 'Input should be greater than or equal to 1' }] });
      expect(q('error-mensaje')!.textContent).toContain('Categoría: Input should be greater than or equal to 1');
    });

    it('500: error inesperado con reintento, sin filtrar el detalle interno', async () => {
      await conError(500, { detail: 'traza interna secreta' });
      expect(q('estado-error-inesperado')).not.toBeNull();
      expect(texto()).not.toContain('traza interna secreta');
      (q('btn-reintentar') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectOne(`${API}/reportes/ventas`).flush(ok(ventas()));
      await estabilizar();
      expect(q('estado-datos')).not.toBeNull(); // se recuperó
    });

    it('error de red (status 0)', async () => {
      await arrancar('no-responder');
      http.expectOne(`${API}/reportes/ventas`).error(new ProgressEvent('error'), { status: 0 });
      await estabilizar();
      expect(q('error-mensaje')!.textContent).toContain('No hay conexión con el servidor.');
    });

    it('si falla el catálogo de categorías el reporte igual funciona', async () => {
      fixture = TestBed.createComponent(ReportesComponent);
      fixture.detectChanges();
      http.expectOne(CATEGORIAS_URL).flush({}, { status: 500, statusText: 'x' });
      http.expectOne(`${API}/reportes/ventas`).flush(ok(ventas()));
      await estabilizar();
      expect(texto()).toContain('el filtro por categoría no está disponible');
      expect(q('estado-datos')).not.toBeNull();
    });
  });

  // ---------------------------------------------------------------- filtros
  describe('filtros', () => {
    it('ventas: envía fecha_inicio, fecha_fin, categoria_id y canal_venta tal como se eligieron', async () => {
      await arrancar();
      escribir('filtro-fecha-inicio', '2026-01-01');
      escribir('filtro-fecha-fin', '2026-01-31');
      escribir('filtro-categoria', '9', 'change');
      escribir('filtro-canal', 'POS', 'change');
      await aplicar();
      http.expectOne(`${API}/reportes/ventas?fecha_inicio=2026-01-01&fecha_fin=2026-01-31&categoria_id=9&canal_venta=POS`)
        .flush(ok(ventas({ filtros: { fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31', categoria_id: 9, canal_venta: 'POS' } })));
      await estabilizar();
      const chips = q('filtros-aplicados')!.textContent!;
      expect(chips).toContain('Categoría: Camisas'); // nombre real, no id
      expect(chips).toContain('Canal: POS (mostrador)');
    });

    it('los selects de categoría se llenan con datos reales del API (no hardcodeados)', async () => {
      await arrancar();
      const opciones = Array.from((q('filtro-categoria') as HTMLSelectElement).options).map((o) => o.textContent!.trim());
      expect(opciones).toEqual(['Todas', 'Camisas (Hombre)', 'Pantalones (Hombre)']);
    });

    it('"Limpiar" vacía los filtros y vuelve a consultar con los defaults', async () => {
      await arrancar();
      escribir('filtro-fecha-inicio', '2026-01-01');
      (q('btn-limpiar') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectOne(`${API}/reportes/ventas`).flush(ok(ventas()));
      await estabilizar();
      expect((q('filtro-fecha-inicio') as HTMLInputElement).value).toBe('');
    });

    it('cada reporte muestra SOLO los filtros que su endpoint soporta', async () => {
      await arrancar();
      const visibles = () => ['fecha-inicio', 'fecha-fin', 'categoria', 'canal', 'nivel', 'estado', 'top', 'limite', 'limite-detalle']
        .filter((f) => q(`filtro-${f}`) !== null);
      expect(visibles()).toEqual(['fecha-inicio', 'fecha-fin', 'categoria', 'canal']);

      await elegirReporte('productos-mas-vendidos');
      http.expectOne(`${API}/reportes/productos-mas-vendidos`).flush(ok(top()));
      await estabilizar();
      expect(visibles()).toEqual(['fecha-inicio', 'fecha-fin', 'categoria', 'canal', 'top']);

      await elegirReporte('inventario');
      http.expectOne(`${API}/reportes/inventario`).flush(ok(inventario()));
      await estabilizar();
      expect(visibles()).toEqual(['fecha-inicio', 'fecha-fin', 'categoria', 'canal', 'nivel', 'limite']);

      await elegirReporte('devoluciones');
      http.expectOne(`${API}/reportes/devoluciones`).flush(ok(devoluciones()));
      await estabilizar();
      expect(visibles()).toEqual(['fecha-inicio', 'fecha-fin', 'categoria', 'canal', 'estado', 'top', 'limite-detalle']);

      await elegirReporte('rendimiento-vendedores');
      http.expectOne(`${API}/reportes/rendimiento-vendedores`).flush(ok(rendimiento()));
      await estabilizar();
      expect(visibles()).toEqual(['fecha-inicio', 'fecha-fin', 'canal']);
    });

    it('cambiar un filtro NO dispara solicitudes: solo "Aplicar filtros"', async () => {
      await arrancar();
      escribir('filtro-fecha-inicio', '2026-01-01');
      escribir('filtro-canal', 'ONLINE', 'change');
      http.expectNone((r) => r.url.includes('/reportes/')); // (http.verify() lo exige de todas formas)
    });

    it('una consulta nueva cancela la que sigue en curso', async () => {
      await arrancar();
      await aplicar();
      const primera = http.expectOne(`${API}/reportes/ventas`);
      await elegirReporte('inventario');
      expect(primera.cancelled).toBe(true);
      http.expectOne(`${API}/reportes/inventario`).flush(ok(inventario()));
    });
  });

  // ------------------------------------------------------------ exportación
  describe('exportación PDF / Excel', () => {
    const blobOk = (t = 'x') => new Blob([t]);
    const errBlob = (detail: unknown) => new Blob([JSON.stringify({ detail })], { type: 'application/json' });
    const boton = (f: 'pdf' | 'xlsx') => q('btn-exportar-' + f) as HTMLButtonElement;
    const esperar = () => new Promise((r) => setTimeout(r, 60)); // FileReader de los errores

    it('los botones solo existen con un reporte mostrado (datos o sin datos), no cargando ni con error', async () => {
      await arrancar('no-responder');
      expect(q('barra-exportar')).toBeNull(); // cargando
      http.expectOne(`${API}/reportes/ventas`).flush({ detail: 'x' }, { status: 500, statusText: 'x' });
      await estabilizar();
      expect(q('barra-exportar')).toBeNull(); // error
      (q('btn-reintentar') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectOne(`${API}/reportes/ventas`).flush(ok(ventas()));
      await estabilizar();
      expect(q('barra-exportar')).not.toBeNull(); // con datos
      expect(boton('pdf').textContent).toContain('Exportar PDF');
      expect(boton('xlsx').textContent).toContain('Exportar Excel');
    });

    it('también se puede exportar un reporte "sin datos" (el archivo trae el aviso)', async () => {
      await arrancar(ventas({ ...vacio, por_fecha: [], por_categoria: [], por_canal: [], por_metodo_pago: [] }));
      expect(q('estado-sin-datos')).not.toBeNull();
      boton('pdf').click();
      http.expectOne(`${API}/reportes/ventas?formato=pdf`).flush(blobOk());
      await estabilizar();
      expect(descargaMock.descargar).toHaveBeenCalledTimes(1);
      expect(descargaMock.descargar.mock.calls[0][1]).toBe('reporte-ventas_2025-12-01_2026-03-31.pdf');
    });

    it('descarga con el nombre del período aplicado y el blob recibido', async () => {
      await arrancar();
      boton('xlsx').click();
      fixture.detectChanges();
      const req = http.expectOne(`${API}/reportes/ventas?formato=xlsx`);
      expect(req.request.responseType).toBe('blob');
      const blob = blobOk('PK');
      req.flush(blob);
      await estabilizar();
      expect(descargaMock.descargar).toHaveBeenCalledWith(blob, 'reporte-ventas_2025-12-01_2026-03-31.xlsx');
      expect(q('error-exportacion')).toBeNull();
    });

    it('exporta con EXACTAMENTE los filtros aplicados en la consulta', async () => {
      await arrancar();
      escribir('filtro-fecha-inicio', '2026-01-01');
      escribir('filtro-fecha-fin', '2026-01-31');
      escribir('filtro-categoria', '9', 'change');
      escribir('filtro-canal', 'POS', 'change');
      await aplicar();
      http.expectOne(`${API}/reportes/ventas?fecha_inicio=2026-01-01&fecha_fin=2026-01-31&categoria_id=9&canal_venta=POS`)
        .flush(ok(ventas({ filtros: { fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31', categoria_id: 9, canal_venta: 'POS' } })));
      await estabilizar();
      boton('pdf').click();
      http.expectOne(`${API}/reportes/ventas?fecha_inicio=2026-01-01&fecha_fin=2026-01-31&categoria_id=9&canal_venta=POS&formato=pdf`)
        .flush(blobOk());
      await estabilizar();
      expect(descargaMock.descargar.mock.calls[0][1]).toBe('reporte-ventas_2026-01-01_2026-01-31.pdf');
    });

    it('el archivo es el del reporte VISIBLE: editar filtros sin aplicar no cambia lo que se exporta', async () => {
      await arrancar();
      escribir('filtro-fecha-inicio', '2026-01-01');
      escribir('filtro-fecha-fin', '2026-01-31');
      await aplicar();
      http.expectOne(`${API}/reportes/ventas?fecha_inicio=2026-01-01&fecha_fin=2026-01-31`).flush(ok(ventas({ filtros: { ...filtros, fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31' } })));
      await estabilizar();
      // el usuario cambia el formulario pero NO pulsa "Aplicar filtros"
      escribir('filtro-fecha-inicio', '2020-05-05');
      escribir('filtro-canal', 'ONLINE', 'change');
      boton('xlsx').click();
      http.expectOne(`${API}/reportes/ventas?fecha_inicio=2026-01-01&fecha_fin=2026-01-31&formato=xlsx`).flush(blobOk());
      await estabilizar();
      expect(descargaMock.descargar.mock.calls[0][1]).toBe('reporte-ventas_2026-01-01_2026-01-31.xlsx');
    });

    it('cada reporte exporta con SUS filtros (top, nivel, estado y límites)', async () => {
      await arrancar();
      // productos más vendidos
      await elegirReporte('productos-mas-vendidos');
      http.expectOne(`${API}/reportes/productos-mas-vendidos`).flush(ok(top()));
      await estabilizar();
      escribir('filtro-top', '2');
      await aplicar();
      http.expectOne(`${API}/reportes/productos-mas-vendidos?top=2`).flush(ok(top({ top: 2 })));
      await estabilizar();
      boton('pdf').click();
      http.expectOne(`${API}/reportes/productos-mas-vendidos?top=2&formato=pdf`).flush(blobOk());
      await estabilizar();
      // inventario (el top escrito antes NO viaja: no es un filtro de este reporte)
      await elegirReporte('inventario');
      http.expectOne(`${API}/reportes/inventario`).flush(ok(inventario()));
      await estabilizar();
      escribir('filtro-nivel', 'BAJO', 'change');
      escribir('filtro-limite', '50');
      await aplicar();
      http.expectOne(`${API}/reportes/inventario?nivel_stock=BAJO&limite=50`).flush(ok(inventario({ limite: 50 })));
      await estabilizar();
      boton('xlsx').click();
      http.expectOne(`${API}/reportes/inventario?nivel_stock=BAJO&limite=50&formato=xlsx`).flush(blobOk());
      await estabilizar();
      // devoluciones (comparte "top" con productos más vendidos: sigue en 2)
      await elegirReporte('devoluciones');
      http.expectOne(`${API}/reportes/devoluciones?top=2`).flush(ok(devoluciones()));
      await estabilizar();
      escribir('filtro-estado', 'COMPLETADA', 'change');
      escribir('filtro-limite-detalle', '20');
      await aplicar();
      http.expectOne(`${API}/reportes/devoluciones?estado=COMPLETADA&top=2&limite_detalle=20`).flush(ok(devoluciones({ estado: 'COMPLETADA' })));
      await estabilizar();
      boton('pdf').click();
      http.expectOne(`${API}/reportes/devoluciones?estado=COMPLETADA&top=2&limite_detalle=20&formato=pdf`).flush(blobOk());
      await estabilizar();
      expect(descargaMock.descargar.mock.calls.map((c) => c[1])).toEqual([
        'reporte-productos-mas-vendidos_2025-12-01_2026-03-31.pdf',
        'reporte-inventario_2025-12-01_2026-03-31.xlsx',
        'reporte-devoluciones_2025-12-01_2026-03-31.pdf',
      ]);
    });

    it('rendimiento de vendedores exporta con fecha_desde/fecha_hasta/tipo_venta y sin categoría', async () => {
      await arrancar();
      escribir('filtro-categoria', '9', 'change');
      await elegirReporte('rendimiento-vendedores');
      http.expectOne(`${API}/reportes/rendimiento-vendedores`).flush(ok(rendimiento()));
      await estabilizar();
      escribir('filtro-fecha-inicio', '2025-12-01');
      escribir('filtro-fecha-fin', '2026-03-31');
      escribir('filtro-canal', 'POS', 'change');
      await aplicar();
      http.expectOne(`${API}/reportes/rendimiento-vendedores?fecha_desde=2025-12-01&fecha_hasta=2026-03-31&tipo_venta=POS`).flush(ok(rendimiento()));
      await estabilizar();
      boton('xlsx').click();
      http.expectOne(`${API}/reportes/rendimiento-vendedores?fecha_desde=2025-12-01&fecha_hasta=2026-03-31&tipo_venta=POS&formato=xlsx`).flush(blobOk());
      await estabilizar();
      expect(descargaMock.descargar.mock.calls[0][1]).toBe('reporte-rendimiento-vendedores_2025-12-01_2026-03-31.xlsx');
    });

    it('mientras genera deshabilita ambos botones, muestra el progreso y ignora el segundo clic', async () => {
      await arrancar();
      boton('pdf').click();
      fixture.detectChanges();
      const req = http.expectOne(`${API}/reportes/ventas?formato=pdf`);
      expect(boton('pdf').disabled).toBe(true);
      expect(boton('xlsx').disabled).toBe(true);
      expect(boton('pdf').textContent).toContain('Generando PDF');
      boton('xlsx').click(); // ignorado: sigue habiendo una sola solicitud
      http.expectNone(`${API}/reportes/ventas?formato=xlsx`);
      req.flush(blobOk());
      await estabilizar();
      expect(boton('pdf').disabled).toBe(false);
      expect(boton('pdf').textContent).toContain('Exportar PDF');
      expect(descargaMock.descargar).toHaveBeenCalledTimes(1);
    });

    it('exportar no vuelve a consultar el reporte ni altera lo que se ve', async () => {
      await arrancar();
      const antes = q('estado-datos')!.textContent;
      boton('pdf').click();
      http.expectOne(`${API}/reportes/ventas?formato=pdf`).flush(blobOk());
      await estabilizar();
      http.expectNone(`${API}/reportes/ventas`);
      expect(q('estado-datos')!.textContent).toBe(antes);
    });

    for (const [status, detail, contiene] of [
      [403, 'Su rol no tiene acceso al panel de reportes.', 'Su rol no tiene acceso'],
      [422, 'fecha_inicio (2026-03-01) no puede ser posterior a fecha_fin (2026-02-01).', 'no puede ser posterior'],
      [422, [{ loc: ['query', 'formato'], msg: 'Input should be json, pdf or xlsx' }], 'Input should be'],
      [500, 'traza interna secreta', 'No se pudo cargar el reporte'],
    ] as const) {
      it(`${status}: muestra el error junto a los botones, no descarga y el reporte sigue visible`, async () => {
        await arrancar();
        boton('pdf').click();
        http.expectOne(`${API}/reportes/ventas?formato=pdf`).flush(errBlob(detail), { status, statusText: 'x' });
        await esperar();
        await estabilizar();
        expect(q('error-exportacion')!.textContent).toContain('No se pudo exportar.');
        expect(q('error-exportacion')!.textContent).toContain(contiene);
        expect(texto()).not.toContain('traza interna secreta');
        expect(descargaMock.descargar).not.toHaveBeenCalled();
        expect(q('estado-datos')).not.toBeNull(); // la pantalla no se rompe
        expect(boton('pdf').disabled).toBe(false); // se puede reintentar
      });
    }

    it('un error de exportación se limpia al reintentar con éxito', async () => {
      await arrancar();
      boton('pdf').click();
      http.expectOne(`${API}/reportes/ventas?formato=pdf`).flush(errBlob('x'), { status: 500, statusText: 'x' });
      await esperar();
      await estabilizar();
      expect(q('error-exportacion')).not.toBeNull();
      boton('pdf').click();
      fixture.detectChanges();
      expect(q('error-exportacion')).toBeNull();
      http.expectOne(`${API}/reportes/ventas?formato=pdf`).flush(blobOk());
      await estabilizar();
      expect(descargaMock.descargar).toHaveBeenCalledTimes(1);
    });

    it('cambiar de reporte oculta los botones hasta que llegue el nuevo resultado y exporta el nuevo', async () => {
      await arrancar();
      await elegirReporte('inventario');
      expect(q('barra-exportar')).toBeNull();
      http.expectOne(`${API}/reportes/inventario`).flush(ok(inventario()));
      await estabilizar();
      boton('pdf').click();
      http.expectOne(`${API}/reportes/inventario?formato=pdf`).flush(blobOk());
      await estabilizar();
      expect(descargaMock.descargar.mock.calls[0][1]).toBe('reporte-inventario_2025-12-01_2026-03-31.pdf');
    });
  });

  // -------------------------------------------------------- los 5 reportes
  describe('consumo y presentación de los 5 endpoints', () => {
    it('productos más vendidos: envía top y muestra ranking + gráfico', async () => {
      await arrancar();
      await elegirReporte('productos-mas-vendidos');
      http.expectOne(`${API}/reportes/productos-mas-vendidos`).flush(ok(top()));
      await estabilizar();
      escribir('filtro-top', '2');
      escribir('filtro-canal', 'POS', 'change');
      await aplicar();
      http.expectOne(`${API}/reportes/productos-mas-vendidos?canal_venta=POS&top=2`).flush(ok(top({ top: 2 })));
      await estabilizar();
      const filas = q('tabla-ranking')!.querySelectorAll('tbody tr');
      expect(filas.length).toBe(2);
      expect(filas[0].textContent).toContain('Camisa Oxford');
      expect(filas[0].textContent).toContain('Bs. 900.00');
      expect(graficos()[0]).toMatchObject({ type: 'bar', labels: ['1. Camisa Oxford', '2. Jean Slim'], data: [9, 3] });
      expect(q('filtros-aplicados')!.textContent).toContain('Top 2');
    });

    it('inventario: nivel_stock y limite, badges, rotación N/D con stock 0 y aviso de límite', async () => {
      await arrancar();
      await elegirReporte('inventario');
      http.expectOne(`${API}/reportes/inventario`).flush(ok(inventario()));
      await estabilizar();
      escribir('filtro-nivel', 'CRITICO', 'change');
      escribir('filtro-limite', '2');
      await aplicar();
      http.expectOne(`${API}/reportes/inventario?nivel_stock=CRITICO&limite=2`)
        .flush(ok(inventario({ limite: 2, total_filas: 5 }))); // 2 filas de 5
      await estabilizar();
      const celdas = Array.from(q('tabla-inventario')!.querySelectorAll('[data-testid="celda-rotacion"]')).map((c) => c.textContent!.trim());
      expect(celdas).toEqual(['N/D', '0.18']); // rotación_disponible=false -> N/D, sin dividir
      expect(q('aviso-limite')!.textContent).toContain('Mostrando 2 de 5 productos');
      expect(html().querySelectorAll('app-badge').length).toBe(2);
      const g = graficos();
      expect(g[0]).toMatchObject({ type: 'doughnut', data: [3, 2, 3] }); // por_nivel del backend, orden CRITICO/BAJO/OK
      expect(g[1].data).toEqual([0.18]); // solo productos con rotación calculable
    });

    it('devoluciones: estado, top y limite_detalle; fechas en UTC; rechazadas en el desglose', async () => {
      await arrancar();
      await elegirReporte('devoluciones');
      http.expectOne(`${API}/reportes/devoluciones`).flush(ok(devoluciones()));
      await estabilizar();
      escribir('filtro-estado', 'COMPLETADA', 'change');
      escribir('filtro-top', '3');
      escribir('filtro-limite-detalle', '20');
      await aplicar();
      http.expectOne(`${API}/reportes/devoluciones?estado=COMPLETADA&top=3&limite_detalle=20`)
        .flush(ok(devoluciones({ estado: 'COMPLETADA' })));
      await estabilizar();
      expect(texto()).toContain('Bs. 730.00');
      expect(q('tabla-por-estado')!.textContent).toContain('Rechazada');
      expect(q('tabla-detalle')!.textContent).toContain('12/03/2026 10:00'); // 10:00Z mostrado en UTC
      expect(q('filtros-aplicados')!.textContent).toContain('Estado COMPLETADA');
      const g = graficos();
      expect(g[0]).toMatchObject({ type: 'doughnut', data: [4, 1] });
      expect(g[1].data).toEqual([120]);
    });

    it('rendimiento: usa fecha_desde/fecha_hasta/tipo_venta y NO envía categoría', async () => {
      await arrancar();
      escribir('filtro-categoria', '9', 'change'); // se elige en ventas...
      await elegirReporte('rendimiento-vendedores');
      http.expectOne(`${API}/reportes/rendimiento-vendedores`).flush(ok(rendimiento())); // ...y no viaja aquí
      await estabilizar();
      escribir('filtro-fecha-inicio', '2025-12-01');
      escribir('filtro-fecha-fin', '2026-03-31');
      escribir('filtro-canal', 'POS', 'change');
      await aplicar();
      http.expectOne(`${API}/reportes/rendimiento-vendedores?fecha_desde=2025-12-01&fecha_hasta=2026-03-31&tipo_venta=POS`)
        .flush(ok(rendimiento()));
      await estabilizar();
      const fila = q('tabla-vendedores')!.querySelector('tbody tr')!.textContent!;
      expect(fila).toContain('Vera Vendedora');
      expect(fila).toContain('Bs. 1,150.00'); // string decimal formateado, no recalculado
      expect(fila).toContain('POS: 4');
      expect(graficos()[0].data).toEqual([1150]);
    });

    it('rendimiento sin vendedores => estado "sin datos" (este endpoint no trae sin_datos)', async () => {
      await arrancar();
      await elegirReporte('rendimiento-vendedores');
      http.expectOne(`${API}/reportes/rendimiento-vendedores`)
        .flush(ok(rendimiento({ items: [], total_vendedores: 0, total_ingresos: '0.00', total_operaciones: 0 })));
      await estabilizar();
      expect(q('estado-sin-datos')!.textContent).toContain(MENSAJE_SIN_DATOS);
      expect(html().querySelector('[role="alert"]')).toBeNull();
    });

    for (const [tipo, url, respuesta] of [
      ['productos-mas-vendidos', 'productos-mas-vendidos', top({ ...vacio, items: [], total_productos_vendidos: 0 })],
      ['inventario', 'inventario', inventario({ ...vacio, items: [], total_productos: 0 })],
      ['devoluciones', 'devoluciones', devoluciones({ ...vacio, num_devoluciones: 0, por_estado: [], por_fecha: [], por_producto: [], por_categoria: [], detalle: [] })],
    ] as const) {
      it(`${tipo}: sin_datos=true muestra el aviso y no es error`, async () => {
        await arrancar();
        await elegirReporte(tipo);
        http.expectOne(`${API}/reportes/${url}`).flush(ok(respuesta));
        await estabilizar();
        expect(q('estado-sin-datos')!.textContent).toContain(MENSAJE_SIN_DATOS);
        expect(q('estado-datos')).toBeNull();
        expect(html().querySelector('[role="alert"]')).toBeNull();
      });
    }

    it('cambiar de reporte no muestra datos del anterior', async () => {
      await arrancar();
      await elegirReporte('inventario');
      expect(q('estado-cargando')).not.toBeNull();
      expect(q('tabla-por-fecha')).toBeNull(); // la vista de ventas ya no está
      http.expectOne(`${API}/reportes/inventario`).flush(ok(inventario()));
      await estabilizar();
      expect(q('tabla-inventario')).not.toBeNull();
      expect(q('tabla-por-fecha')).toBeNull();
    });
  });
});

// --------------------------------------------------------------------------
describe('ReportesComponent con la cadena real de interceptores (401)', () => {
  it('un 401 del backend cierra la sesión (ErrorInterceptor) y la pantalla lo informa', async () => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'token-vencido');
    TestBed.configureTestingModule({
      imports: [ReportesComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
      ],
    });
    TestBed.overrideComponent(VentasVistaComponent, { remove: { imports: [ReporteChartComponent] }, add: { imports: [GraficoDoble] } });
    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout').mockImplementation(() => undefined);
    const http = TestBed.inject(HttpTestingController);

    const fixture = TestBed.createComponent(ReportesComponent);
    fixture.detectChanges();
    http.expectOne(CATEGORIAS_URL).flush({ status: 'success', message: '', data: [] });
    const req: TestRequest = http.expectOne(`${API}/reportes/ventas`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-vencido'); // el JWT viaja
    req.flush({ detail: 'Token expirado. Inicie sesión nuevamente.' }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(logout).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="estado-error-no-autenticado"]')).not.toBeNull();
    http.verify();
  });

  it('un 401 al EXPORTAR también cierra la sesión (ErrorInterceptor) y el JWT viaja al exportar', async () => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'token-vencido');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ReportesComponent],
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: HTTP_INTERCEPTORS, useClass: JwtInterceptor, multi: true },
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        { provide: DescargaArchivoService, useValue: { descargar: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(VentasVistaComponent, { remove: { imports: [ReporteChartComponent] }, add: { imports: [GraficoDoble] } });
    const logout = vi.spyOn(TestBed.inject(AuthService), 'logout').mockImplementation(() => undefined);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ReportesComponent);
    fixture.detectChanges();
    http.expectOne(CATEGORIAS_URL).flush({ status: 'success', message: '', data: [] });
    http.expectOne(`${API}/reportes/ventas`).flush(ok(ventas()));
    await fixture.whenStable();
    fixture.detectChanges();
    ((fixture.nativeElement as HTMLElement).querySelector('[data-testid="btn-exportar-pdf"]') as HTMLButtonElement).click();
    const req = http.expectOne(`${API}/reportes/ventas?formato=pdf`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-vencido');
    req.flush(new Blob([JSON.stringify({ detail: 'Token expirado.' })]), { status: 401, statusText: 'Unauthorized' });
    await new Promise((r) => setTimeout(r, 60));
    expect(logout).toHaveBeenCalledTimes(1);
    http.verify();
  });
});
