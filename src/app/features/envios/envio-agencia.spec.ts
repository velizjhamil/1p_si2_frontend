import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { Envio, EstadoEnvio } from '../../core/models/envio.model';
import { EnvioActualizado, EnvioDetalleComponent } from './envio-detalle.component';

const API = environment.apiUrl;
const ok = (data: unknown) => ({ status: 'success', message: '', data });

function envio(estado: EstadoEnvio, transiciones: EstadoEnvio[], extra: Partial<Envio> = {}): Envio {
 return {
 id_envio: 7, id_venta: 3, codigo_venta: 'ATT-000003', estado, transiciones_permitidas: transiciones,
 cliente_id: 'c1', cliente_nombre: 'Cliente Demo', total_venta: 120.5,
 datos_entrega: {
 nombre_cliente: 'Cliente Demo', correo: 'c@x.com', telefono: '70000000',
 direccion: 'Av. Smoke 123', ciudad: 'La Paz', referencia: null,
 },
 items: [], codigo_sucursal: null, sucursal_nombre: null, repartidor_id: null, repartidor_nombre: null,
 fecha_estimada_entrega: null, fecha_entrega_real: null, motivo_fallo: null, fecha_reprogramacion: null,
 intentos_fallidos: 0, fecha_creacion: '2026-09-19T10:00:00Z', fecha_actualizacion: '2026-09-19T10:00:00Z',
 ...extra,
 } as Envio;
}

const AGENCIA = { id_agencia: 4, razon_social: 'Andes Express', is_active: true };
const COTIZACION = {
 costo_agencia: 12.5, criterio: 'PESO', agencia: { id_agencia: 4, razon_social: 'Andes Express' },
 ciudad: { id_ciudad: 1, nombre: 'La Paz', departamento: 'La Paz' }, peso_kg: 2.5, volumen_m3: 0.05,
 fecha_referencia: '2026-09-20T12:00:00Z',
 tarifa: { id_tarifa: 3, id_zona: 9, nombre_zona: null, criterio: 'PESO', rango_min: 0, rango_max: 5, costo: 12.5, vigente_desde: '2026-01-01', vigente_hasta: null },
 candidatas: [{ id_tarifa: 3, criterio: 'PESO', costo: 12.5, nombre_zona: null, seleccionada: true }],
};

describe('Asignación de agencia en el detalle del envío', () => {
 let http: HttpTestingController;
 let fixture: ComponentFixture<EnvioDetalleComponent>;
 let emitidos: EnvioActualizado[];
 const html = () => fixture.nativeElement as HTMLElement;
 const boton = (t: string) =>
 Array.from(html().querySelectorAll('button')).find((b) => b.textContent?.trim() === t) as HTMLButtonElement;

 async function montar(e: Envio) {
 fixture = TestBed.createComponent(EnvioDetalleComponent);
 emitidos = [];
 fixture.componentInstance.actualizado.subscribe((ev) => emitidos.push(ev));
 fixture.componentRef.setInput('envio', e);
 fixture.detectChanges();
 http.expectOne(`${API}/envios/${e.id_envio}/historial`).flush(ok([]));
 await fixture.whenStable();
 fixture.detectChanges();
 }

 async function abrirModoAgencia() {
 await montar(envio('LISTO_ENVIO', ['ASIGNADO', 'CANCELADO']));
 boton('Asignar repartidor o agencia').click();
 http.expectOne(`${API}/envios/repartidores`).flush(ok([]));
 fixture.componentInstance.cambiarModoAsignacion('agencia');
 const req = http.expectOne(`${API}/agencias-reparto/disponibles?ciudad=La%20Paz`);
 req.flush({ status: 'success', message: '', data: [AGENCIA], total: 1, ciudad: { id_ciudad: 1, nombre: 'La Paz', departamento: 'La Paz' } });
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

 it('modo agencia consulta /disponibles con la ciudad del envío y muestra las agencias', async () => {
 await abrirModoAgencia();
 expect(html().querySelector('[data-testid="asignacion-agencia"]')).not.toBeNull();
 expect(html().textContent).toContain('Andes Express');
 });

 it('valida agencia, peso y volumen en cliente sin llamar al backend', async () => {
 await abrirModoAgencia();
 const c = fixture.componentInstance;
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('agencia');
 c.agenciaSel.set(4);
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('peso');
 c.pesoKg.set('2,5');
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('volumen');
 c.volumenM3.set('0');
 c.confirmarAccion();
 expect(c.errorAccion()).toContain('volumen');
 http.expectNone(`${API}/envios/7/asignar`);
 });

 it('cotizar llama a /cotizacion con ciudad, peso y volumen normalizados y muestra el costo', async () => {
 await abrirModoAgencia();
 const c = fixture.componentInstance;
 c.agenciaSel.set(4);
 c.pesoKg.set('2,5');
 c.volumenM3.set('0.05');
 c.cotizar();
 const req = http.expectOne(`${API}/agencias-reparto/4/cotizacion?ciudad=La%20Paz&peso_kg=2.5&volumen_m3=0.05`);
 req.flush(ok(COTIZACION));
 await fixture.whenStable();
 fixture.detectChanges();
 expect(html().querySelector('[data-testid="costo-agencia"]')?.textContent).toContain('12.50');
 // cambiar un dato invalida la cotización mostrada
 c.pesoKg.set('3');
 (c as unknown as { alCambiarDatosAgencia(): void }).alCambiarDatosAgencia();
 expect(c.cotizacion()).toBeNull();
 });

 it('un 404 de cotización se muestra con el mensaje del backend', async () => {
 await abrirModoAgencia();
 const c = fixture.componentInstance;
 c.agenciaSel.set(4);
 c.pesoKg.set('99');
 c.volumenM3.set('1');
 c.cotizar();
 http
 .expectOne(`${API}/agencias-reparto/4/cotizacion?ciudad=La%20Paz&peso_kg=99&volumen_m3=1`)
 .flush({ detail: 'No hay tarifa aplicable' }, { status: 404, statusText: 'Not Found' });
 expect(c.errorCotizacion()).toContain('tarifa');
 expect(c.cotizacion()).toBeNull();
 });

 it('asignar con agencia envía {id_agencia, peso_kg, volumen_m3} y emite el envío', async () => {
 await abrirModoAgencia();
 const c = fixture.componentInstance;
 c.agenciaSel.set(4);
 c.pesoKg.set('2,5');
 c.volumenM3.set('0.05');
 c.confirmarAccion();
 const req = http.expectOne(`${API}/envios/7/asignar`);
 expect(req.request.method).toBe('PATCH');
 expect(req.request.body).toEqual({ id_agencia: 4, peso_kg: '2.5', volumen_m3: '0.05' });
 expect('id_repartidor' in req.request.body).toBe(false);
 req.flush(ok(envio('ASIGNADO', ['EN_RUTA', 'CANCELADO'], { agencia_id: 4, agencia_nombre: 'Andes Express', costo_agencia: 12.5 })));
 expect(emitidos[0].envio.agencia_nombre).toBe('Andes Express');
 expect(emitidos[0].mensaje).toContain('Andes Express');
 });

 it('el costo interno y las medidas se muestran en el despacho cuando el backend los envía', async () => {
 await montar(
 envio('ASIGNADO', ['EN_RUTA'], { agencia_id: 4, agencia_nombre: 'Andes Express', costo_agencia: 12.5, peso_kg: 2.5, volumen_m3: 0.05 }),
 );
 expect(html().querySelector('[data-testid="despacho-agencia"]')?.textContent).toContain('Andes Express');
 expect(html().querySelector('[data-testid="despacho-costo-agencia"]')?.textContent).toContain('12.50');
 expect(html().querySelector('[data-testid="despacho-medidas"]')).not.toBeNull();
 });

 it('sin costo_agencia (rol D) no aparece el costo interno', async () => {
 await montar(envio('ASIGNADO', [], { agencia_id: 4, agencia_nombre: 'Andes Express' }));
 expect(html().querySelector('[data-testid="despacho-agencia"]')).not.toBeNull();
 expect(html().querySelector('[data-testid="despacho-costo-agencia"]')).toBeNull();
 });
});
