import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Agencias de Reparto. Montadas bajo /agencias desde
 * app.routes.ts.
 *
 * Roles: ASU y GS administran; D (Encargado de Delivery) solo consulta. V y C no
 * acceden. La autorización real de cada operación la valida FastAPI; este guard
 * es solo de navegación.
 */
export const AGENCIAS_ROUTES: Routes = [
 {
 path: '',
 loadComponent: () => import('./agencias.component').then((m) => m.AgenciasComponent),
 canActivate: [authGuard],
 data: { roles: ['ASU', 'GS', 'D'] },
 },
 {
 path: ':id',
 loadComponent: () => import('./agencia-detalle.component').then((m) => m.AgenciaDetalleComponent),
 canActivate: [authGuard],
 data: { roles: ['ASU', 'GS', 'D'] },
 },
];
