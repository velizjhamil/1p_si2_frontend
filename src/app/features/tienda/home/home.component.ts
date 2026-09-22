import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CatalogoTiendaService } from '../../../core/services/catalogo-tienda.service';
import { CarritoService } from '../../../core/services/carrito.service';
import {
 DisponibilidadTienda,
 ProductoTienda,
 formatBs,
} from '../../../core/models/carrito.model';

/**
 * Catálogo de la Tienda Online Attention.
 * Grid minimalista mostrando exclusivamente: Imagen, Nombre y Precio.
 * Al hacer clic en un producto se abre el modal de detalle con selección
 * independiente de color, tallas disponibles y stock por sucursales en tiempo real.
 */
@Component({
 selector: 'app-home',
 imports: [CommonModule],
 templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
 private readonly catalogoService = inject(CatalogoTiendaService);
 protected readonly carritoService = inject(CarritoService);

 /** Catálogo visible del cliente. */
 protected readonly productos = signal<ProductoTienda[]>([]);
 protected readonly cargando = signal(true);

 /** Modal de detalle del producto seleccionado. */
 protected readonly modalAbierto = signal(false);
 protected readonly productoSeleccionado = signal<ProductoTienda | null>(null);

 /** Opciones elegidas en el modal. */
 protected readonly colorSeleccionado = signal<{ nombre: string; hex: string } | null>(null);
 protected readonly tallaSeleccionada = signal<string>('');
 protected readonly sucursalSeleccionada = signal<DisponibilidadTienda | null>(null);
 protected readonly cantidadSeleccionada = signal<number>(1);

 /** Mensajes y alertas. */
 protected readonly agregado = signal<string | null>(null);
 protected readonly errorStock = signal<string | null>(null);
 private temporizador?: ReturnType<typeof setTimeout>;

 protected readonly formatBs = formatBs;

 /** Stock disponible para la combinación de sucursal seleccionada en el modal. */
 protected readonly stockDisponible = computed(() => {
 const prod = this.productoSeleccionado();
 if (!prod) return 0;

 const suc = this.sucursalSeleccionada();
 if (suc) {
 return suc.stock;
 }

 // Si no seleccionó sucursal específica (compra general), suma el stock total de sucursales
 if (prod.disponibilidad_sucursales && prod.disponibilidad_sucursales.length > 0) {
 return prod.disponibilidad_sucursales.reduce((acc, s) => acc + s.stock, 0);
 }

 return 99; // Fallback razonable si no hay desglose
 });

 /** Subtotal calculado en el modal (precio * cantidad). */
 protected readonly subtotalModal = computed(() => {
 const prod = this.productoSeleccionado();
 if (!prod) return 0;
 return prod.precio * this.cantidadSeleccionada();
 });

 ngOnInit(): void {
 this.catalogoService.getCatalogo().subscribe({
 next: (productos) => {
 this.productos.set(productos);
 this.cargando.set(false);
 },
 error: () => this.cargando.set(false),
 });
 }

 /** Abre el modal de detalle limpio al hacer clic en cualquier tarjeta del catálogo. */
 protected abrirDetalle(producto: ProductoTienda): void {
 this.productoSeleccionado.set(producto);
 this.colorSeleccionado.set(producto.colores?.[0] || { nombre: 'Estándar', hex: '#000000' });
 this.tallaSeleccionada.set(producto.tallas?.[0] || 'Única');

 // Por defecto, sugerir la primera sucursal con stock disponible (o null para despacho inteligente)
 const sucConStock = producto.disponibilidad_sucursales?.find((s) => s.stock > 0) || null;
 this.sucursalSeleccionada.set(sucConStock);

 this.cantidadSeleccionada.set(1);
 this.errorStock.set(null);
 this.modalAbierto.set(true);
 }

 /** Cierra el modal de detalle del producto. */
 protected cerrarDetalle(): void {
 this.modalAbierto.set(false);
 this.productoSeleccionado.set(null);
 this.errorStock.set(null);
 }

 /** Cambia el color activo en el modal. */
 protected elegirColor(color: { nombre: string; hex: string }): void {
 this.colorSeleccionado.set(color);
 }

 /** Cambia la talla activa en el modal. */
 protected elegirTalla(talla: string): void {
 this.tallaSeleccionada.set(talla);
 }

 /** Cambia la sucursal de abastecimiento en el modal. */
 protected elegirSucursal(sucursal: DisponibilidadTienda | null): void {
 this.sucursalSeleccionada.set(sucursal);
 this.cantidadSeleccionada.set(1);
 this.errorStock.set(null);
 }

 /** Incrementa la cantidad a comprar respetando el stock disponible. */
 protected incrementarCantidad(): void {
 const max = this.stockDisponible();
 if (this.cantidadSeleccionada() < max) {
 this.cantidadSeleccionada.update((c) => c + 1);
 this.errorStock.set(null);
 } else {
 this.errorStock.set(`Stock máximo disponible alcanzado (${max} unidades).`);
 }
 }

 /** Decrementa la cantidad a comprar (mínimo 1). */
 protected decrementarCantidad(): void {
 if (this.cantidadSeleccionada() > 1) {
 this.cantidadSeleccionada.update((c) => c - 1);
 this.errorStock.set(null);
 }
 }

 /**
 * Agrega el producto al carrito descontando automáticamente del inventario
 * de la sucursal activa en tiempo real.
 */
 protected agregarAlCarritoModal(): void {
 const prod = this.productoSeleccionado();
 if (!prod) return;

 const cant = this.cantidadSeleccionada();
 const stockMax = this.stockDisponible();

 if (stockMax < cant || cant <= 0) {
 this.errorStock.set('No hay suficiente stock en la sucursal seleccionada.');
 return;
 }

 const suc = this.sucursalSeleccionada();
 const color = this.colorSeleccionado();
 const talla = this.tallaSeleccionada();

 // 1. Agregar al carrito persistente
 this.carritoService.agregarAlCarrito({
 producto_id: prod.producto_id,
 nombre: prod.nombre,
 talla,
 color: color?.nombre || 'Estándar',
 color_hex: color?.hex || '#000000',
 precio: prod.precio,
 cantidad: cant,
 imagen_url: prod.imagen_url,
 id_sucursal: suc?.id_sucursal ?? null,
 sucursal_nombre: suc?.nombre_sucursal ?? null,
 });

 // 2. Descontar en tiempo real del inventario local de la sucursal
 this.catalogoService.descontarStockLocal(prod.producto_id, suc?.id_sucursal ?? null, cant);
 this.descontarStockEnVista(prod.producto_id, suc?.id_sucursal ?? null, cant);

 // 3. Notificación toast y cierre del modal
 const destinoStr = suc ? `Sucursal ${suc.nombre_sucursal}` : 'Despacho inteligente';
 this.mostrarToast(
 `${prod.nombre} (${cant}x - ${talla} / ${color?.nombre || 'Estándar'}) agregado desde ${destinoStr}`
 );
 this.cerrarDetalle();
 }

 /** Actualiza el stock de la sucursal en la señal reactiva `productos()` de la vista. */
 private descontarStockEnVista(
 producto_id: number,
 id_sucursal: number | null,
 cantidad: number,
 ): void {
 this.productos.update((lista) =>
 lista.map((p) => {
 if (p.producto_id !== producto_id || !p.disponibilidad_sucursales) return p;

 const sucursalesActualizadas = p.disponibilidad_sucursales.map((s) => {
 const coincide = id_sucursal ? s.id_sucursal === id_sucursal : s.stock >= cantidad;
 if (coincide) {
 const nuevoStock = Math.max(0, s.stock - cantidad);
 return {
 ...s,
 stock: nuevoStock,
 disponible: nuevoStock > 0,
 };
 }
 return s;
 });

 return {
 ...p,
 disponibilidad_sucursales: sucursalesActualizadas,
 };
 }),
 );
 }

 private mostrarToast(mensaje: string): void {
 this.agregado.set(mensaje);
 if (this.temporizador) clearTimeout(this.temporizador);
 this.temporizador = setTimeout(() => this.agregado.set(null), 3000);
 }
}
