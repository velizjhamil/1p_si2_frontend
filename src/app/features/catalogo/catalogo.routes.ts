import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Rutas del módulo Catálogo (features/catalogo).
 * Se montan como children del layout principal bajo el prefijo /catalogo,
 * con el mismo patrón de lazy loading + authGuard por rol del resto de CUs.
 */
export const CATALOGO_ROUTES: Routes = [
  {
    // CU6: Gestión de Productos de Ropa (vista + catálogo visual, FASE MOCK).
    path: 'productos',
    loadComponent: () =>
      import('./productos/productos.component').then((m) => m.ProductosComponent),
    canActivate: [authGuard],
    data: { roles: ['ASU', 'GS', 'V', 'C'] },
  },
  {
    // CU7: Gestión de Tallas y Colores (mock en memoria, sin backend aún).
    path: 'tallas',
    loadComponent: () =>
      import('./tallas/tallas.component').then((m) => m.TallasComponent),
    canActivate: [authGuard],
    data: { roles: ['ASU', 'GS'] },
  },
  {
    // CU24: Gestión de Temporadas y Colecciones (backend real FastAPI).
    path: 'temporadas',
    loadComponent: () =>
      import('./temporadas/temporadas.component').then(
        (m) => m.TemporadasComponent,
      ),
    canActivate: [authGuard],
    data: { roles: ['ASU', 'GS'] },
  },
];
