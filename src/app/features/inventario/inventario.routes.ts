import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Inventario (CU22 y futuros CUs de inventario).
 * Montadas bajo /inventario desde app.routes.ts.
 */
export const INVENTARIO_ROUTES: Routes = [
  {
    // CU22: Gestión de Inventario (FASE MOCK).
    path: 'stock',
    loadComponent: () =>
      import('./inventario.component').then((m) => m.InventarioComponent),
    canActivate: [authGuard],
    data: { roles: ['ASU', 'GS', 'V'] },
  },
];
