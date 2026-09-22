import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../environments/environment';
import { authGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { CarritoService } from './services/carrito.service';
import { Usuario } from './models/usuario.model';

/**
 * Regla de negocio: SOLO el rol Cliente (C) usa el carrito y el checkout online.
 * (El POS de V/GS/ASU va por /ventas/pos con su propio carrito local.)
 */
const API = environment.apiUrl;

function usuario(rol: string, id = `id-${rol}`): Usuario {
 return { id_usuario: id, nombre: rol, correo: `${rol}@x.test`, estado: true, rol: { id_rol: 'r', nombre_rol: rol } };
}

function iniciarSesion(rol: string | null, id?: string): void {
 localStorage.clear();
 if (rol) {
 localStorage.setItem('auth_token', 'token-de-prueba');
 localStorage.setItem('auth_user', JSON.stringify(usuario(rol, id)));
 }
}

const item = { producto_id: 1, nombre: 'Camisa', talla: 'M', color: 'Azul', color_hex: '#000', precio: 100, cantidad: 2, imagen_url: null };
const entrega = { nombre_cliente: 'Cliente Demo', correo: 'c@x.com', telefono: '70000000', direccion: 'Av. 1 esq. 2', ciudad: 'SC' };

function configurar(): void {
 TestBed.resetTestingModule();
 TestBed.configureTestingModule({
 providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
 });
}

describe('AuthService.esCliente()', () => {
 for (const [rol, esperado] of [['C', true], ['c', true], ['ASU', false], ['GS', false], ['V', false], ['D', false]] as const) {
 it(`${rol} -> ${esperado}`, () => {
 iniciarSesion(rol);
 configurar();
 expect(TestBed.inject(AuthService).esCliente()).toBe(esperado);
 });
 }

 it('sin sesión -> false', () => {
 iniciarSesion(null);
 configurar();
 expect(TestBed.inject(AuthService).esCliente()).toBe(false);
 });
});

describe('authGuard con data.strict (rutas exclusivas de un rol)', () => {
 const state = { url: '/carrito' } as RouterStateSnapshot;
 const ruta = (data: Record<string, unknown>) => ({ data }) as unknown as ActivatedRouteSnapshot;

 function correr(rol: string | null, data: Record<string, unknown>) {
 iniciarSesion(rol);
 configurar();
 const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
 const permitido = TestBed.runInInjectionContext(() => authGuard(ruta(data), state));
 return { permitido, navigate };
 }

 it('Cliente entra a /carrito y /checkout', () => {
 expect(correr('C', { roles: ['C'], strict: true }).permitido).toBe(true);
 });

 it('ASU NO entra (ya no tiene pase libre) y vuelve a su inicio', () => {
 const { permitido, navigate } = correr('ASU', { roles: ['C'], strict: true });
 expect(permitido).toBe(false);
 expect(navigate).toHaveBeenCalledWith(['/admin/dashboard']);
 });

 it('V, GS y D tampoco entran', () => {
 for (const rol of ['V', 'GS', 'D']) {
 expect(correr(rol, { roles: ['C'], strict: true }).permitido).toBe(false);
 }
 });

 it('sin sesión va a /login', () => {
 const { permitido, navigate } = correr(null, { roles: ['C'], strict: true });
 expect(permitido).toBe(false);
 expect(navigate).toHaveBeenCalledWith(['/login']);
 });

 it('SIN strict el ASU conserva su pase libre (el resto de la app no cambia)', () => {
 expect(correr('ASU', { roles: ['GS'] }).permitido).toBe(true);
 });

 it('SIN strict un rol no listado sigue siendo rechazado', () => {
 expect(correr('V', { roles: ['GS'] }).permitido).toBe(false);
 });
});

describe('CarritoService: exclusivo del Cliente', () => {
 function servicio(rol: string | null, id?: string) {
 iniciarSesion(rol, id);
 configurar();
 return {
 carrito: TestBed.inject(CarritoService),
 auth: TestBed.inject(AuthService),
 http: TestBed.inject(HttpTestingController),
 };
 }

 it('el Cliente agrega al carrito y se guarda con SU id', () => {
 const { carrito } = servicio('C', 'cli-1');
 carrito.agregarAlCarrito(item);
 expect(carrito.contador()).toBe(2);
 expect(JSON.parse(localStorage.getItem('attention_carrito_cli-1') as string)).toHaveLength(1);
 });

 it('ASU, GS, V y D: agregar es un no-op (nada en memoria ni en localStorage)', () => {
 for (const rol of ['ASU', 'GS', 'V', 'D']) {
 const { carrito } = servicio(rol);
 carrito.agregarAlCarrito(item);
 expect(carrito.contador()).toBe(0);
 expect(Object.keys(localStorage).filter((k) => k.startsWith('attention_carrito'))).toEqual([]);
 }
 });

 it('procesarCompra (checkout online) por un no-Cliente: error 403 SIN llamar al backend', () => {
 const { carrito, http } = servicio('V');
 let error: { status?: number; error?: { detail?: string } } | undefined;
 carrito.procesarCompra('EFECTIVO', entrega).subscribe({ error: (e) => (error = e) });
 expect(error?.status).toBe(403);
 expect(error?.error?.detail).toContain('Cliente');
 http.expectNone(`${API}/ventas/checkout`);
 });

 it('procesarCompra del Cliente va a POST /ventas/checkout con tipo_venta ONLINE', () => {
 const { carrito, http } = servicio('C', 'cli-2');
 carrito.agregarAlCarrito(item);
 carrito.procesarCompra('EFECTIVO', entrega).subscribe({ error: () => undefined });
 const req = http.expectOne(`${API}/ventas/checkout`);
 expect(req.request.method).toBe('POST');
 expect(req.request.body.tipo_venta).toBe('ONLINE');
 expect(req.request.body.id_cliente_override).toBeUndefined();
 req.flush({ status: 'success', message: '', data: null }, { status: 500, statusText: 'x' });
 });

 it('la venta POS del Vendedor va a POST /ventas/pos (no a /checkout) y no usa el carrito global', () => {
 const { carrito, http } = servicio('V');
 carrito.procesarVentaPos([{ ...item, subtotal: 200 }], 'EFECTIVO', entrega, 'cliente-uuid').subscribe({ error: () => undefined });
 http.expectNone(`${API}/ventas/checkout`);
 const req = http.expectOne(`${API}/ventas/pos`);
 expect(req.request.body.tipo_venta).toBe('POS');
 expect(req.request.body.id_cliente_override).toBe('cliente-uuid');
 expect(carrito.contador()).toBe(0);
 req.flush({ status: 'success', message: '', data: null }, { status: 500, statusText: 'x' });
 });

 it('cada usuario ve SU carrito: al cambiar de sesión no se hereda el de otro', () => {
 const { carrito, auth } = servicio('C', 'cli-A');
 carrito.agregarAlCarrito(item);
 expect(carrito.contador()).toBe(2);
 const sesion = (auth as unknown as { _currentUser: BehaviorSubject<Usuario | null> })._currentUser;

 sesion.next(usuario('V', 'vend-1')); // entra un Vendedor en el mismo navegador
 expect(carrito.contador()).toBe(0);

 sesion.next(usuario('C', 'cli-B')); // otro Cliente
 expect(carrito.contador()).toBe(0);

 sesion.next(usuario('C', 'cli-A')); // vuelve el primero: recupera SU carrito
 expect(carrito.contador()).toBe(2);
 });

 it('al cerrar sesión el carrito en memoria queda vacío', () => {
 const { carrito, auth } = servicio('C', 'cli-3');
 carrito.agregarAlCarrito(item);
 (auth as unknown as { _currentUser: BehaviorSubject<Usuario | null> })._currentUser.next(null);
 expect(carrito.contador()).toBe(0);
 });

 it('elimina el carrito global de la versión anterior (clave sin usuario)', () => {
 iniciarSesion('C', 'cli-4');
 localStorage.setItem('attention_carrito', JSON.stringify([{ ...item, subtotal: 200 }]));
 configurar();
 const carrito = TestBed.inject(CarritoService);
 expect(carrito.contador()).toBe(0); // no lo hereda
 expect(localStorage.getItem('attention_carrito')).toBeNull();
 });
});
