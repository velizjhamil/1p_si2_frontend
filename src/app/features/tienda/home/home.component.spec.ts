import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HomeComponent } from './home.component';
import { CatalogoTiendaService } from '../../../core/services/catalogo-tienda.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { ProductoTienda } from '../../../core/models/carrito.model';

describe('HomeComponent', () => {
 let component: HomeComponent;
 let catalogoMock: any;
 let carritoMock: any;

 const mockProductos: ProductoTienda[] = [
 {
 producto_id: 101,
 nombre: 'Vestido de Gala Seda',
 categoria: 'Vestidos',
 precio: 350.0,
 imagen_url: 'http://test.com/vestido.jpg',
 tallas: ['S', 'M', 'L'],
 colores: [
 { nombre: 'Negro', hex: '#000000' },
 { nombre: 'Rojo', hex: '#dc2626' },
 ],
 disponibilidad_sucursales: [
 {
 id_sucursal: 1,
 nombre_sucursal: 'Sucursal Central',
 ciudad: 'Santa Cruz',
 stock: 10,
 disponible: true,
 },
 {
 id_sucursal: 2,
 nombre_sucursal: 'Sucursal Equipetrol',
 ciudad: 'Santa Cruz',
 stock: 3,
 disponible: true,
 },
 ],
 },
 ];

 beforeEach(async () => {
 catalogoMock = {
 getCatalogo: vi.fn().mockReturnValue(of(mockProductos)),
 descontarStockLocal: vi.fn(),
 };

 carritoMock = {
 agregarAlCarrito: vi.fn(),
 };

 await TestBed.configureTestingModule({
 imports: [HomeComponent],
 providers: [
 { provide: CatalogoTiendaService, useValue: catalogoMock },
 { provide: CarritoService, useValue: carritoMock },
 ],
 }).compileComponents();

 const fixture = TestBed.createComponent(HomeComponent);
 component = fixture.componentInstance;
 fixture.detectChanges();
 });

 it('debe cargar los productos y mantener el modal cerrado inicialmente', () => {
 expect(component['productos']().length).toBe(1);
 expect(component['modalAbierto']()).toBe(false);
 });

 it('al abrirDetalle de un producto, inicializa opciones y abre el modal', () => {
 const prod = mockProductos[0];
 component['abrirDetalle'](prod);

 expect(component['modalAbierto']()).toBe(true);
 expect(component['productoSeleccionado']()).toEqual(prod);
 expect(component['colorSeleccionado']()?.nombre).toBe('Negro');
 expect(component['tallaSeleccionada']()).toBe('S');
 expect(component['sucursalSeleccionada']()?.id_sucursal).toBe(1);
 expect(component['stockDisponible']()).toBe(10);
 });

 it('permite cambiar la sucursal seleccionada y actualiza el stock disponible', () => {
 const prod = mockProductos[0];
 component['abrirDetalle'](prod);

 // Cambiar a Sucursal Equipetrol (stock: 3)
 component['elegirSucursal'](prod.disponibilidad_sucursales![1]);
 expect(component['sucursalSeleccionada']()?.nombre_sucursal).toBe('Sucursal Equipetrol');
 expect(component['stockDisponible']()).toBe(3);

 // Cambiar a Despacho automático (suma total: 10 + 3 = 13)
 component['elegirSucursal'](null);
 expect(component['sucursalSeleccionada']()).toBeNull();
 expect(component['stockDisponible']()).toBe(13);
 });

 it('descuenta inventario de la sucursal activa y agrega al carrito en tiempo real', () => {
 const prod = mockProductos[0];
 component['abrirDetalle'](prod);

 // Seleccionar Sucursal Equipetrol (id: 2, stock: 3)
 component['elegirSucursal'](prod.disponibilidad_sucursales![1]);
 component['incrementarCantidad'](); // cantidad = 2

 component['agregarAlCarritoModal']();

 // 1. Debe llamar a carritoService con la sucursal asociada
 expect(carritoMock.agregarAlCarrito).toHaveBeenCalledWith(
 expect.objectContaining({
 producto_id: 101,
 cantidad: 2,
 id_sucursal: 2,
 sucursal_nombre: 'Sucursal Equipetrol',
 })
 );

 // 2. Debe descontar en catalogoService
 expect(catalogoMock.descontarStockLocal).toHaveBeenCalledWith(101, 2, 2);

 // 3. El stock local en la señal reactiva debe haberse actualizado (3 - 2 = 1)
 const prodActualizado = component['productos']().find((p) => p.producto_id === 101);
 const sucEquipetrol = prodActualizado?.disponibilidad_sucursales?.find((s) => s.id_sucursal === 2);
 expect(sucEquipetrol?.stock).toBe(1);

 // 4. Modal cerrado
 expect(component['modalAbierto']()).toBe(false);
 });

 it('no permite agregar al carrito si la cantidad supera el stock disponible', () => {
 const prod = mockProductos[0];
 component['abrirDetalle'](prod);
 component['elegirSucursal'](prod.disponibilidad_sucursales![1]); // stock = 3

 // Forzar cantidad excesiva
 component['cantidadSeleccionada'].set(10);
 component['agregarAlCarritoModal']();

 expect(carritoMock.agregarAlCarrito).not.toHaveBeenCalled();
 expect(component['errorStock']()).toBeTruthy();
 expect(component['modalAbierto']()).toBe(true);
 });
});
