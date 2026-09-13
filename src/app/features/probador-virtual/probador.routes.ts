import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Probador Virtual (CU8).
 * Montadas bajo /probador-virtual desde app.routes.ts.
 */
export const PROBADOR_ROUTES: Routes = [
  {
    // CU8: Probador Virtual AR (FASE MOCK).
    path: '',
    loadComponent: () =>
      import('./probador-virtual.component').then(
        (m) => m.ProbadorVirtualComponent,
      ),
    canActivate: [authGuard],
    data: { roles: ['ASU', 'GS', 'C'] },
  },
];
