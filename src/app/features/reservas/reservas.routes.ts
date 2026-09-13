import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Reservas (CU14 y futuros CUs de reservas).
 * Montadas bajo /reservas desde app.routes.ts.
 */
export const RESERVAS_ROUTES: Routes = [
  {
    // CU14: Gestionar Reserva de Prendas (FASE MOCK).
    path: 'gestion',
    loadComponent: () =>
      import('./reservas.component').then((m) => m.ReservasComponent),
    canActivate: [authGuard],
    data: { roles: ['ASU', 'GS', 'C'] },
  },
];
