import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Ventas.
 * Montadas bajo /ventas desde app.routes.ts.
 * El Cliente (rol C) ve el mismo listado pero solo con sus ventas
 * (el backend ya filtra por id_cliente para ese rol).
 */
export const VENTAS_ROUTES: Routes = [
 {
 // Vista unificada: KPIs + tabla + filtros + modal de detalle.
 path: '',
 loadComponent: () =>
 import('./ventas.component').then((m) => m.VentasComponent),
 canActivate: [authGuard],
 data: { roles: ['ASU', 'GS', 'V', 'C'] },
 },
 {
 // Detalle dedicado (deep-link a /ventas/{id}).
 // La ruta con param se excluye del prerender en app.routes.server.ts
 // (RenderMode.Client) porque el id llega en runtime.
 path: ':id',
 loadComponent: () =>
 import('./venta-detalle.component').then((m) => m.VentaDetalleComponent),
 canActivate: [authGuard],
 data: { roles: ['ASU', 'GS', 'V', 'C'] },
 },
];
