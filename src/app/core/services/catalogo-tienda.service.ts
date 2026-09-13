import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ProductoTienda } from '../models/carrito.model';

/**
 * Catálogo MOCK de la tienda (CU15 fase mock).
 *
 * Cuando el backend de productos esté expuesto al cliente (hoy el
 * endpoint /api/v1/productos es interno ASU/GS), este servicio se
 * reemplaza por llamadas reales; el home y el carrito no cambian.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoTiendaService {
  /** Catálogo demo en memoria (6 prendas con tallas y colores de CU7). */
  private readonly catalogo: ProductoTienda[] = [
    {
      producto_id: 1,
      nombre: 'Camisa Oxford Clásica',
      categoria: 'Camisas',
      precio: 189.9,
      imagen_url: null,
      tallas: ['S', 'M', 'L', 'XL'],
      colores: [
        { nombre: 'Blanco', hex: '#ffffff' },
        { nombre: 'Azul', hex: '#1d528d' },
      ],
    },
    {
      producto_id: 2,
      nombre: 'Polera Básica Algodón',
      categoria: 'Poleras',
      precio: 89.9,
      imagen_url: null,
      tallas: ['XS', 'S', 'M', 'L'],
      colores: [
        { nombre: 'Negro', hex: '#000000' },
        { nombre: 'Blanco', hex: '#ffffff' },
        { nombre: 'Rojo', hex: '#dc2626' },
      ],
    },
    {
      producto_id: 3,
      nombre: 'Vestido Flor Gala',
      categoria: 'Vestidos',
      precio: 349.5,
      imagen_url: null,
      tallas: ['S', 'M'],
      colores: [
        { nombre: 'Rojo', hex: '#dc2626' },
        { nombre: 'Azul', hex: '#1d528d' },
      ],
    },
    {
      producto_id: 4,
      nombre: 'Jean Slim Fit',
      categoria: 'Pantalones',
      precio: 259.0,
      imagen_url: null,
      tallas: ['M', 'L', 'XL'],
      colores: [
        { nombre: 'Negro', hex: '#000000' },
        { nombre: 'Azul', hex: '#1d528d' },
      ],
    },
    {
      producto_id: 5,
      nombre: 'Chaqueta de Temporada',
      categoria: 'Chaquetas',
      precio: 429.9,
      imagen_url: null,
      tallas: ['M', 'L', 'XL'],
      colores: [
        { nombre: 'Negro', hex: '#000000' },
        { nombre: 'Rojo', hex: '#dc2626' },
      ],
    },
    {
      producto_id: 6,
      nombre: 'Blusa Seda Office',
      categoria: 'Blusas',
      precio: 219.0,
      imagen_url: null,
      tallas: ['S', 'M', 'L'],
      colores: [{ nombre: 'Blanco', hex: '#ffffff' }],
    },
  ];

  /** GET mock — lista del catálogo visible para el cliente. */
  getCatalogo(): Observable<ProductoTienda[]> {
    return of(this.catalogo).pipe(delay(250));
  }
}
