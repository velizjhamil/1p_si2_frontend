import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Inventario.
 * Montadas bajo /inventario desde app.routes.ts.
 */
export const INVENTARIO_ROUTES: Routes = [
 {
 // Vista unificada (Stock + Kardex).
 path: '',
 loadComponent: () =>
 import('./inventario.component').then((m) => m.InventarioComponent),
 canActivate: [authGuard],
 data: { roles: ['ASU', 'GS', 'V'] },
 },
 {
 // Vista de Stock Actual.
 path: 'stock',
 loadComponent: () =>
 import('./inventario.component').then((m) => m.InventarioComponent),
 canActivate: [authGuard],
 data: { roles: ['ASU', 'GS', 'V'] },
 },
 {
 // Kardex y Movimientos de Inventario.
 path: 'movimientos',
 loadComponent: () =>
 import('./inventario.component').then((m) => m.InventarioComponent),
 canActivate: [authGuard],
 data: { roles: ['ASU', 'GS', 'V'] },
 },
];
