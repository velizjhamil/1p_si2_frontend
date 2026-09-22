import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatIaWidgetComponent } from './chat-ia-widget.component';
import { IaService } from '../../../core/services/ia.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { AuthService } from '../../../core/services/auth.service';
import { ProductoResumenIA } from '../../../core/models/ia.model';

describe('ChatIaWidgetComponent - Asistente Virtual IA', () => {
 let iaServiceMock: {
 enviarMensaje: ReturnType<typeof vi.fn>;
 verificarEstado: ReturnType<typeof vi.fn>;
 };

 let carritoServiceMock: {
 agregarAlCarrito: ReturnType<typeof vi.fn>;
 };

 let authServiceMock: {
 getCurrentUser: ReturnType<typeof vi.fn>;
 };

 beforeEach(() => {
 iaServiceMock = {
 enviarMensaje: vi.fn(),
 verificarEstado: vi.fn(),
 };

 carritoServiceMock = {
 agregarAlCarrito: vi.fn(),
 };

 authServiceMock = {
 getCurrentUser: vi.fn().mockReturnValue({
 id_usuario: 'usr-123',
 nombre: 'Valeria',
 correo: 'valeria@example.com',
 rol: { nombre_rol: 'C' },
 }),
 };

 TestBed.resetTestingModule();
 TestBed.configureTestingModule({
 imports: [ChatIaWidgetComponent],
 providers: [
 provideHttpClient(),
 provideHttpClientTesting(),
 provideRouter([]),
 { provide: IaService, useValue: iaServiceMock },
 { provide: CarritoService, useValue: carritoServiceMock },
 { provide: AuthService, useValue: authServiceMock },
 ],
 });
 });

 it('se crea exitosamente y genera el saludo inicial para el Cliente', () => {
 const fixture = TestBed.createComponent(ChatIaWidgetComponent);
 const comp = fixture.componentInstance;
 fixture.detectChanges();

 expect(comp).toBeTruthy();
 expect(comp.abierto()).toBe(false);
 expect(comp.mensajes().length).toBeGreaterThan(0);
 expect(comp.mensajes()[0].contenido).toContain('Valeria');
 expect(comp.mensajes()[0].contenido).toContain('Attention AI');
 });

 it('toggleChat() alterna entre minimizado y expandido', () => {
 const fixture = TestBed.createComponent(ChatIaWidgetComponent);
 const comp = fixture.componentInstance;
 fixture.detectChanges();

 expect(comp.abierto()).toBe(false);
 comp.toggleChat();
 expect(comp.abierto()).toBe(true);
 comp.toggleChat();
 expect(comp.abierto()).toBe(false);
 });

 it('envía mensaje a la IA y renderiza la respuesta con productos recomendados', () => {
 const mockProducto: ProductoResumenIA = {
 id_producto: 5,
 nombre: 'Vestido de Gala Seda',
 precio_venta: 280,
 tallas: ['S', 'M'],
 colores: [{ nombre_color: 'Rojo', codigo_hex: '#FF0000' }],
 stock_total: 10,
 stock_sucursales: [{ sucursal: 'Sucursal Norte', stock: 6 }],
 };

 iaServiceMock.enviarMensaje.mockReturnValue(
 of({
 status: 'success',
 data: {
 respuesta: 'Te recomiendo este elegante vestido para tu evento.',
 productos_recomendados: [5],
 productos_detalle: [mockProducto],
 sugerencias: ['¿En qué colores viene?', '¿Tienen probador virtual?'],
 },
 })
 );

 const fixture = TestBed.createComponent(ChatIaWidgetComponent);
 const comp = fixture.componentInstance;
 fixture.detectChanges();

 comp.inputTexto = 'Busco un vestido para una boda';
 comp.enviarMensaje();

 expect(comp.escribiendo()).toBe(false);
 expect(iaServiceMock.enviarMensaje).toHaveBeenCalled();

 const mensajes = comp.mensajes();
 expect(mensajes.length).toBe(3); // bienvenida + usuario + respuesta asistente
 expect(mensajes[1].rol).toBe('usuario');
 expect(mensajes[1].contenido).toBe('Busco un vestido para una boda');
 expect(mensajes[2].rol).toBe('asistente');
 expect(mensajes[2].productos_detalle?.length).toBe(1);
 expect(mensajes[2].productos_detalle?.[0].nombre).toBe('Vestido de Gala Seda');
 });

 it('permite añadir un producto recomendado directamente al carrito', () => {
 const fixture = TestBed.createComponent(ChatIaWidgetComponent);
 const comp = fixture.componentInstance;
 fixture.detectChanges();

 const mockProducto: ProductoResumenIA = {
 id_producto: 8,
 nombre: 'Blusa Ejecutiva',
 precio_venta: 120,
 tallas: ['M'],
 colores: [{ nombre_color: 'Blanco', codigo_hex: '#FFFFFF' }],
 stock_total: 4,
 };

 comp.agregarAlCarrito(mockProducto);

 expect(carritoServiceMock.agregarAlCarrito).toHaveBeenCalledWith(
 expect.objectContaining({
 producto_id: 8,
 nombre: 'Blusa Ejecutiva',
 precio: 120,
 talla: 'M',
 color: 'Blanco',
 })
 );
 expect(comp.productoAgregadoId()).toBe(8);
 });

 it('permite redirigir al probador virtual con la prenda recomendada', () => {
 const fixture = TestBed.createComponent(ChatIaWidgetComponent);
 const comp = fixture.componentInstance;
 const router = TestBed.inject(Router);
 const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
 fixture.detectChanges();

 const mockProducto: ProductoResumenIA = {
 id_producto: 12,
 nombre: 'Falda Plisada',
 precio_venta: 95,
 tallas: ['S'],
 colores: [],
 stock_total: 2,
 };

 comp.probarConIA(mockProducto);

 expect(comp.abierto()).toBe(false);
 expect(navigateSpy).toHaveBeenCalledWith(['/probador-virtual'], {
 queryParams: { prenda_id: 12 },
 });
 });

 it('maneja errores del servicio de IA amigablemente sin quebrar la UI', () => {
 iaServiceMock.enviarMensaje.mockReturnValue(
 throwError(() => ({ error: { detail: 'Servicio de IA temporalmente no disponible.' } }))
 );

 const fixture = TestBed.createComponent(ChatIaWidgetComponent);
 const comp = fixture.componentInstance;
 fixture.detectChanges();

 comp.enviarMensaje('Pregunta de prueba');

 expect(comp.escribiendo()).toBe(false);
 const ultimoMensaje = comp.mensajes()[comp.mensajes().length - 1];
 expect(ultimoMensaje.esError).toBe(true);
 expect(ultimoMensaje.contenido).toContain('temporalmente no disponible');
 });
});
