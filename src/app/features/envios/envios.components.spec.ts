import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Envio, EstadoEnvio, HistorialEnvio } from '../../core/models/envio.model';
import { EnvioActualizado, EnvioDetalleComponent } from './envio-detalle.component';
import { EnviosComponent } from './envios.component';

const API = environment.apiUrl;

function envio(estado: EstadoEnvio, transiciones: EstadoEnvio[], extra: Partial<Envio> = {}): Envio {
 return {
 id_envio: 7,
 id_venta: 3,
 codigo_venta: 'ATT-000003',
 estado,
 transiciones_permitidas: transiciones,
 cliente_id: 'c1',
 cliente_nombre: 'Cliente Demo',
 total_venta: 120.5,
 datos_entrega: {
 nombre_cliente: 'Cliente Demo', correo: 'c@x.com', telefono: '70000000',
 direccion: 'Av. Smoke 123', ciudad: 'Santa Cruz', referencia: 'Casa azul',
 },
 items: [{ producto_id: 1, nombre: 'Camisa', talla: 'M', color: 'Azul', cantidad: 2 }],
 codigo_sucursal: null, sucursal_nombre: null, repartidor_id: null, repartidor_nombre: null,
 fecha_estimada_entrega: null, fecha_entrega_real: null, motivo_fallo: null,
 fecha_reprogramacion: null, intentos_fallidos: 0,
 fecha_creacion: '2026-09-19T10:00:00Z', fecha_actualizacion: '2026-09-19T10:00:00Z',
 ...extra,
 };
}

const ok = (data: unknown) => ({ status: 'success', message: '', data });

describe('EnvioDetalleComponent', () => {
 let http: HttpTestingController;
 let fixture: ComponentFixture<EnvioDetalleComponent>;
 let emitidos: EnvioActualizado[];

 const html = () => fixture.nativeElement as HTMLElement;
 const botones = () => Array.from(html().querySelectorAll('button')).map((b) => b.textContent?.trim());
 const boton = (texto: string) =>
 Array.from(html().querySelectorAll('button')).find((b) => b.textContent?.trim() === texto) as HTMLButtonElement;

 async function montar(e: Envio, historial: Partial<HistorialEnvio>[] = []) {
 fixture = TestBed.createComponent(EnvioDetalleComponent);
 emitidos = [];
 fixture.componentInstance.actualizado.subscribe((ev) => emitidos.push(ev));
 fixture.componentRef.setInput('envio', e);
 fixture.detectChanges();
 http.expectOne(`${API}/envios/${e.id_envio}/historial`).flush(ok(historial));
 await fixture.whenStable();
 fixture.detectChanges();
 }

 beforeEach(() => {
 TestBed.configureTestingModule({
 imports: [EnvioDetalleComponent],
 providers: [provideHttpClient(), provideHttpClientTesting()],
 });
 http = TestBed.inject(HttpTestingController);
 });
 afterEach(() => http.verify());

 it('ofrece SOLO las acciones de transiciones_permitidas (repartidor: no cancela ni asigna)', async () => {
 await montar(envio('ASIGNADO', ['EN_RUTA']));
 expect(botones()).toContain('Marcar en ruta');
 expect(botones()).not.toContain('Cancelar envío');
 expect(botones()).not.toContain('Asignar repartidor');
 expect(botones()).not.toContain('Marcar entregado');
 });

 it('muestra datos de pedido, entrega, despacho y el historial cronológico', async () => {
 await montar(envio('ENTREGADO', [], { sucursal_nombre: 'Sucursal Central', repartidor_nombre: 'Rep Uno' }), [
 { id_historial: 1, estado_anterior: null, estado_nuevo: 'PREPARANDO', usuario_nombre: null, observacion: null, fecha: '2026-09-19T10:00:00Z' },
 { id_historial: 2, estado_anterior: 'EN_RUTA', estado_nuevo: 'INTENTO_FALLIDO', usuario_nombre: 'Rep Uno', observacion: 'Cliente no responde', fecha: '2026-09-19T11:00:00Z' },
 { id_historial: 3, estado_anterior: 'INTENTO_FALLIDO', estado_nuevo: 'REPROGRAMADO', usuario_nombre: 'GS', observacion: 'Nueva fecha', fecha: '2026-09-19T12:00:00Z' },
 ]);
 const t = html().textContent ?? '';
 for (const esperado of ['ATT-000003', 'Av. Smoke 123, Santa Cruz', 'Casa azul', 'Camisa', 'M · Azul',
 'Sucursal Central', 'Rep Uno', 'Cliente no responde', '1 reprogramación(es)']) {
 expect(t).toContain(esperado);
 }
 // orden cronológico: Preparando antes que Intento fallido antes que Reprogramado
 const orden = ['Preparando', 'Intento fallido', 'Reprogramado'].map((s) => t.lastIndexOf(s));
 expect(orden[0]).toBeLessThan(orden[1]);
 expect(orden[1]).toBeLessThan(orden[2]);
 });

 it('tras un intento fallido habilita "Reprogramar entrega" y avisa; GS además puede cancelar', async () => {
 await montar(envio('INTENTO_FALLIDO', ['REPROGRAMADO', 'CANCELADO'], { motivo_fallo: 'Dirección no encontrada', intentos_fallidos: 1 }));
 expect(botones()).toContain('Reprogramar entrega');
 expect(botones()).toContain('Cancelar envío');
 expect(html().textContent).toContain('Reprograme la entrega para continuar');
 expect(html().textContent).toContain('Dirección no encontrada');
 });

 it('EN_RUTA tras reprogramar se etiqueta como "Retomar entrega"', async () => {
 await montar(envio('REPROGRAMADO', ['EN_RUTA', 'CANCELADO']));
 expect(botones()).toContain('Retomar entrega (en ruta)');
 });

 it('estados terminales no ofrecen acciones', async () => {
 await montar(envio('ENTREGADO', []));
 expect(botones()).toEqual(['×', 'Cerrar']);
 });

 it('intento fallido: motivo corto se rechaza en cliente y NO llama al backend', async () => {
 await montar(envio('EN_RUTA', ['ENTREGADO', 'INTENTO_FALLIDO']));
 boton('Registrar intento fallido').click();
 fixture.detectChanges();
 fixture.componentInstance.motivo.set('no');
 boton('Confirmar').click();
 fixture.detectChanges();
 expect(html().textContent).toContain('mínimo 5 caracteres');
 http.expectNone(`${API}/envios/7/intento-fallido`);
 });

 it('intento fallido válido: PATCH con motivo y emite el envío actualizado', async () => {
 await montar(envio('EN_RUTA', ['ENTREGADO', 'INTENTO_FALLIDO']));
 boton('Registrar intento fallido').click();
 fixture.detectChanges();
 fixture.componentInstance.motivo.set('Cliente no responde');
 fixture.componentInstance.observacion.set(' Se llamó 3 veces ');
 fixture.componentInstance.confirmarAccion();
 const req = http.expectOne(`${API}/envios/7/intento-fallido`);
 expect(req.request.method).toBe('PATCH');
 expect(req.request.body).toEqual({ motivo: 'Cliente no responde', observacion: 'Se llamó 3 veces' });
 req.flush(ok(envio('INTENTO_FALLIDO', ['REPROGRAMADO', 'CANCELADO'], { intentos_fallidos: 1 })));
 expect(emitidos).toHaveLength(1);
 expect(emitidos[0].envio.estado).toBe('INTENTO_FALLIDO');
 expect(emitidos[0].mensaje).toContain('reprogramar');
 expect(fixture.componentInstance.accion()).toBeNull();
 });

 it('reprogramar: exige fecha, rechaza pasadas y envía ISO 8601 con offset (UTC)', async () => {
 await montar(envio('INTENTO_FALLIDO', ['REPROGRAMADO', 'CANCELADO']));
 boton('Reprogramar entrega').click();
 fixture.detectChanges();
 const c = fixture.componentInstance;

 c.confirmarAccion();
 expect(c.errorAccion()).toContain('nueva fecha');

 c.fechaLocal.set('2020-01-01T10:00');
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('futura');
 http.expectNone(`${API}/envios/7/reprogramar`);

 const futura = new Date(Date.now() + 2 * 86400000);
 futura.setMinutes(futura.getMinutes() - futura.getTimezoneOffset());
 const local = futura.toISOString().slice(0, 16);
 c.fechaLocal.set(local);
 c.confirmarAccion();
 const req = http.expectOne(`${API}/envios/7/reprogramar`);
 expect(req.request.method).toBe('PATCH');
 const enviada = req.request.body.nueva_fecha_entrega as string;
 expect(enviada).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
 expect(new Date(enviada).getTime()).toBe(new Date(local).getTime());
 req.flush(ok(envio('REPROGRAMADO', ['EN_RUTA', 'CANCELADO'])));
 expect(emitidos[0].envio.estado).toBe('REPROGRAMADO');
 });

 it('asignar: los repartidores salen de la API (no hardcodeados) y se envía el elegido', async () => {
 await montar(envio('LISTO_ENVIO', ['ASIGNADO', 'CANCELADO']));
 boton('Asignar repartidor o agencia').click();
 http.expectOne(`${API}/envios/repartidores`).flush(
 ok([
 { id_usuario: 'u1', nombre: 'Rep Uno', correo: 'r1@x.com', envios_activos: 2 },
 { id_usuario: 'u2', nombre: 'Rep Dos', correo: 'r2@x.com', envios_activos: 0 },
 ]),
 );
 await fixture.whenStable();
 fixture.detectChanges();
 expect(html().textContent).toContain('Rep Uno — 2 envío(s) activo(s)');
 expect(html().textContent).toContain('Rep Dos — 0 envío(s) activo(s)');

 const c = fixture.componentInstance;
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('repartidor');

 c.repartidorSel.set('u2');
 c.confirmarAccion();
 const req = http.expectOne(`${API}/envios/7/asignar`);
 expect(req.request.body).toEqual({ id_repartidor: 'u2' });
 req.flush(ok(envio('ASIGNADO', ['EN_RUTA', 'CANCELADO'], { repartidor_id: 'u2', repartidor_nombre: 'Rep Dos' })));
 expect(emitidos[0].envio.repartidor_nombre).toBe('Rep Dos');
 });

 it('confirmar preparación: sucursales reales (solo activas) y sucursal obligatoria', async () => {
 await montar(envio('PREPARANDO', ['LISTO_ENVIO', 'CANCELADO']));
 boton('Confirmar preparación').click();
 http.expectOne(`${API}/sucursales`).flush(
 ok([
 { codigo_sucursal: 1, nombre: 'Sucursal Central', is_active: true, ciudad: { id: 1, nombre: 'Santa Cruz' } },
 { codigo_sucursal: 9, nombre: 'Sucursal Cerrada', is_active: false, ciudad: { id: 1, nombre: 'Santa Cruz' } },
 ]),
 );
 await fixture.whenStable();
 fixture.detectChanges();
 expect(html().textContent).toContain('Sucursal Central');
 expect(html().textContent).not.toContain('Sucursal Cerrada');

 const c = fixture.componentInstance;
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('sucursal');
 c.sucursalSel.set(1);
 c.confirmarAccion();
 const req = http.expectOne(`${API}/envios/7/confirmar-preparacion`);
 expect(req.request.body).toEqual({ codigo_sucursal: 1 });
 req.flush(ok(envio('LISTO_ENVIO', ['ASIGNADO', 'CANCELADO'], { codigo_sucursal: 1, sucursal_nombre: 'Sucursal Central' })));
 expect(emitidos[0].mensaje).toContain('Preparación confirmada');
 });

 it('cancelar: exige motivo y advierte que no repone stock ni reembolsa', async () => {
 await montar(envio('LISTO_ENVIO', ['ASIGNADO', 'CANCELADO'], { codigo_sucursal: 1 }));
 boton('Cancelar envío').click();
 fixture.detectChanges();
 expect(html().textContent).toContain('no repone stock');
 const c = fixture.componentInstance;
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('motivo');
 c.observacion.set('El cliente desistió');
 c.confirmarAccion();
 const req = http.expectOne(`${API}/envios/7/estado`);
 expect(req.request.body).toEqual({ estado: 'CANCELADO', observacion: 'El cliente desistió' });
 req.flush(ok(envio('CANCELADO', [])));
 });

 it('muestra el mensaje del backend cuando la operación falla (409) y no cierra el panel', async () => {
 await montar(envio('ASIGNADO', ['EN_RUTA']));
 boton('Marcar en ruta').click();
 fixture.detectChanges();
 fixture.componentInstance.confirmarAccion();
 http.expectOne(`${API}/envios/7/estado`).flush(
 { detail: 'Transicion invalida: ASIGNADO -> EN_RUTA.' },
 { status: 409, statusText: 'Conflict' },
 );
 fixture.detectChanges();
 expect(html().textContent).toContain('Transicion invalida');
 expect(fixture.componentInstance.accion()).toBe('EN_RUTA');
 expect(fixture.componentInstance.guardando()).toBe(false);
 expect(emitidos).toHaveLength(0);
 });
});

describe('EnviosComponent', () => {
 let http: HttpTestingController;

 beforeEach(() => {
 TestBed.configureTestingModule({
 imports: [EnviosComponent],
 providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
 });
 http = TestBed.inject(HttpTestingController);
 });
 afterEach(() => http.verify());

 it('carga listado, KPIs y sucursales desde la API y abre el detalle al gestionar', async () => {
 const fixture = TestBed.createComponent(EnviosComponent);
 fixture.detectChanges();

 http.expectOne(`${API}/sucursales`).flush(
 ok([{ codigo_sucursal: 1, nombre: 'Sucursal Central', is_active: true, ciudad: { id: 1, nombre: 'SC' } }]),
 );
 const paginado = (data: Envio[], total = data.length) => ({
 status: 'success', message: '', data, total, page: 1, limit: 10, pages: 1,
 });
 const lista = [
 envio('LISTO_ENVIO', ['ASIGNADO', 'CANCELADO'], { codigo_sucursal: 1, sucursal_nombre: 'Sucursal Central' }),
 envio('ENTREGADO', [], { id_envio: 8, codigo_venta: 'ATT-000004' }),
 ];
 http.expectOne(`${API}/envios?page=1&limit=10`).flush(paginado(lista));
 for (const estado of ['PREPARANDO', 'EN_RUTA', 'INTENTO_FALLIDO', 'ENTREGADO']) {
 http.expectOne(`${API}/envios?estado=${estado}&page=1&limit=1`).flush(paginado([], estado === 'EN_RUTA' ? 4 : 0));
 }
 await fixture.whenStable();
 fixture.detectChanges();

 const el = fixture.nativeElement as HTMLElement;
 expect(el.textContent).toContain('ATT-000003');
 expect(el.textContent).toContain('Av. Smoke 123, Santa Cruz');
 expect(el.textContent).toContain('Listo para envío');
 expect(el.textContent).toContain('Sucursal Central');
 // ayuda contextual sale de las transiciones del backend, sin cancelar
 expect(el.textContent).toContain('Asignar repartidor');
 // solo el envío con transiciones es "Gestionar"; el terminal es "Ver detalle"
 const acciones = Array.from(el.querySelectorAll('tbody button')).map((b) => b.textContent?.trim());
 expect(acciones).toEqual(['Gestionar', 'Ver detalle']);

 (el.querySelector('tbody button') as HTMLButtonElement).click();
 fixture.detectChanges();
 http.expectOne(`${API}/envios/7/historial`).flush(ok([]));
 fixture.detectChanges();
 expect(el.textContent).toContain('Envío #7');
 });

 it('filtro por estado consulta el backend con el estado elegido', async () => {
 const fixture = TestBed.createComponent(EnviosComponent);
 fixture.detectChanges();
 const vacio = { status: 'success', message: '', data: [], total: 0, page: 1, limit: 10, pages: 0 };
 http.expectOne(`${API}/sucursales`).flush(ok([]));
 http.expectOne(`${API}/envios?page=1&limit=10`).flush(vacio);
 for (const estado of ['PREPARANDO', 'EN_RUTA', 'INTENTO_FALLIDO', 'ENTREGADO']) {
 http.expectOne(`${API}/envios?estado=${estado}&page=1&limit=1`).flush(vacio);
 }
 fixture.componentInstance.onFiltroEstado('INTENTO_FALLIDO');
 http.expectOne(`${API}/envios?estado=INTENTO_FALLIDO&page=1&limit=10`).flush(vacio);
 await fixture.whenStable();
 fixture.detectChanges();
 expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay envíos con el filtro actual');
 });

 it('muestra el mensaje del backend si el listado falla (403)', async () => {
 const fixture = TestBed.createComponent(EnviosComponent);
 fixture.detectChanges();
 http.expectOne(`${API}/sucursales`).flush(ok([]));
 http.expectOne(`${API}/envios?page=1&limit=10`).flush(
 { detail: 'No tiene acceso a los envios.' }, { status: 403, statusText: 'Forbidden' },
 );
 for (const estado of ['PREPARANDO', 'EN_RUTA', 'INTENTO_FALLIDO', 'ENTREGADO']) {
 http.expectOne(`${API}/envios?estado=${estado}&page=1&limit=1`).flush({ detail: 'x' }, { status: 403, statusText: 'Forbidden' });
 }
 await fixture.whenStable();
 fixture.detectChanges();
 expect((fixture.nativeElement as HTMLElement).textContent).toContain('No tiene acceso a los envios.');
 });
});
