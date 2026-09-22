import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ProductoTienda } from '../models/carrito.model';
import { ProductosPage } from '../models/producto.model';

/**
 * Catálogo de la tienda online.
 * Consume /api/v1/productos del backend para mostrar productos reales con imágenes
 * y disponibilidad por sucursal física, con fallback a catálogo de respaldo.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoTiendaService {
 private readonly http = inject(HttpClient);

 /** Catálogo demo de respaldo con disponibilidad multi-sucursal y stock local. */
 private readonly catalogo: ProductoTienda[] = [
 {
 producto_id: 1,
 nombre: 'Camisa Oxford Clásica',
 categoria: 'Camisas',
 precio: 189.9,
 imagen_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
 tallas: ['S', 'M', 'L', 'XL'],
 colores: [
 { nombre: 'Blanco', hex: '#ffffff' },
 { nombre: 'Azul', hex: '#1d528d' },
 ],
 disponibilidad_sucursales: [
 { id_sucursal: 1, nombre_sucursal: 'Sucursal Central', ciudad: 'Santa Cruz', stock: 12, disponible: true },
 { id_sucursal: 2, nombre_sucursal: 'Sucursal Equipetrol', ciudad: 'Santa Cruz', stock: 4, disponible: true },
 ],
 },
 {
 producto_id: 2,
 nombre: 'Polera Básica Algodón',
 categoria: 'Poleras',
 precio: 89.9,
 imagen_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
 tallas: ['XS', 'S', 'M', 'L'],
 colores: [
 { nombre: 'Negro', hex: '#000000' },
 { nombre: 'Blanco', hex: '#ffffff' },
 { nombre: 'Rojo', hex: '#dc2626' },
 ],
 disponibilidad_sucursales: [
 { id_sucursal: 1, nombre_sucursal: 'Sucursal Central', ciudad: 'Santa Cruz', stock: 20, disponible: true },
 { id_sucursal: 3, nombre_sucursal: 'Sucursal Calacoto', ciudad: 'La Paz', stock: 2, disponible: true },
 ],
 },
 {
 producto_id: 3,
 nombre: 'Vestido Flor Gala',
 categoria: 'Vestidos',
 precio: 349.5,
 imagen_url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
 tallas: ['S', 'M'],
 colores: [
 { nombre: 'Rojo', hex: '#dc2626' },
 { nombre: 'Azul', hex: '#1d528d' },
 ],
 disponibilidad_sucursales: [
 { id_sucursal: 1, nombre_sucursal: 'Sucursal Central', ciudad: 'Santa Cruz', stock: 5, disponible: true },
 { id_sucursal: 2, nombre_sucursal: 'Sucursal Equipetrol', ciudad: 'Santa Cruz', stock: 0, disponible: false },
 ],
 },
 {
 producto_id: 4,
 nombre: 'Jean Slim Fit',
 categoria: 'Pantalones',
 precio: 259.0,
 imagen_url: 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=600&q=80',
 tallas: ['M', 'L', 'XL'],
 colores: [
 { nombre: 'Negro', hex: '#000000' },
 { nombre: 'Azul', hex: '#1d528d' },
 ],
 disponibilidad_sucursales: [
 { id_sucursal: 2, nombre_sucursal: 'Sucursal Equipetrol', ciudad: 'Santa Cruz', stock: 8, disponible: true },
 { id_sucursal: 3, nombre_sucursal: 'Sucursal Calacoto', ciudad: 'La Paz', stock: 15, disponible: true },
 ],
 },
 {
 producto_id: 5,
 nombre: 'Chaqueta de Temporada',
 categoria: 'Chaquetas',
 precio: 429.9,
 imagen_url: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=600&q=80',
 tallas: ['M', 'L', 'XL'],
 colores: [
 { nombre: 'Negro', hex: '#000000' },
 { nombre: 'Rojo', hex: '#dc2626' },
 ],
 disponibilidad_sucursales: [
 { id_sucursal: 1, nombre_sucursal: 'Sucursal Central', ciudad: 'Santa Cruz', stock: 3, disponible: true },
 ],
 },
 {
 producto_id: 6,
 nombre: 'Blusa Seda Office',
 categoria: 'Blusas',
 precio: 219.0,
 imagen_url: 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=600&q=80',
 tallas: ['S', 'M', 'L'],
 colores: [{ nombre: 'Blanco', hex: '#ffffff' }],
 disponibilidad_sucursales: [
 { id_sucursal: 1, nombre_sucursal: 'Sucursal Central', ciudad: 'Santa Cruz', stock: 9, disponible: true },
 { id_sucursal: 2, nombre_sucursal: 'Sucursal Equipetrol', ciudad: 'Santa Cruz', stock: 6, disponible: true },
 ],
 },
 ];

 /** Obtiene productos reales del backend o recurre al catálogo de respaldo. */
 getCatalogo(): Observable<ProductoTienda[]> {
 return this.http.get<ProductosPage>(`${environment.apiUrl}/productos?limit=50`).pipe(
 map((res) => {
 if (!res || !res.data || res.data.length === 0) {
 return this.catalogo;
 }
 return res.data.map((p) => ({
 producto_id: p.id_producto,
 nombre: p.nombre,
 categoria: p.categoria?.nombre || 'General',
 precio: p.precio_venta,
 imagen_url: p.imagen_url,
 tallas: p.tallas && p.tallas.length > 0 ? p.tallas.map((t) => t.nombre_talla) : ['Única'],
 colores:
 p.colores && p.colores.length > 0
 ? p.colores.map((c) => ({ nombre: c.nombre_color, hex: c.codigo_hex || '#000000' }))
 : [{ nombre: 'Estándar', hex: '#000000' }],
 disponibilidad_sucursales:
 p.disponibilidad_sucursales?.map((d) => ({
 id_sucursal: d.id_sucursal,
 nombre_sucursal: d.nombre_sucursal,
 ciudad: d.ciudad,
 stock: d.stock,
 disponible: d.disponible,
 })) || [],
 }));
 }),
 catchError(() => of(this.catalogo)),
 );
 }

 /** Descuenta stock en memoria del catálogo demo de respaldo para pruebas interactivas. */
 descontarStockLocal(producto_id: number, id_sucursal: number | null, cantidad: number): void {
 const prod = this.catalogo.find((p) => p.producto_id === producto_id);
 if (!prod || !prod.disponibilidad_sucursales) return;

 if (id_sucursal) {
 const suc = prod.disponibilidad_sucursales.find((s) => s.id_sucursal === id_sucursal);
 if (suc) {
 suc.stock = Math.max(0, suc.stock - cantidad);
 suc.disponible = suc.stock > 0;
 }
 } else {
 const suc =
 prod.disponibilidad_sucursales.find((s) => s.stock >= cantidad) ||
 prod.disponibilidad_sucursales[0];
 if (suc) {
 suc.stock = Math.max(0, suc.stock - cantidad);
 suc.disponible = suc.stock > 0;
 }
 }
 }
}
