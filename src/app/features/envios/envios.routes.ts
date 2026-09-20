import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Envíos (CU18 — Gestión de Envío).
 * Montadas bajo /envios desde app.routes.ts.
 *
 * Roles: GS y D (Encargado de Delivery); ASU pasa siempre por el authGuard.
 * El repartidor (D) solo recibe del backend los envíos asignados a él, y el
 * cliente (C) no accede a esta pantalla operativa. La autorización real de
 * cada operación la valida FastAPI; este guard es solo de navegación.
 */
export const ENVIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./envios.component').then((m) => m.EnviosComponent),
    canActivate: [authGuard],
    data: { roles: ['ASU', 'GS', 'D'] },
  },
];
