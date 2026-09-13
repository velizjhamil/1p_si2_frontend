import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { CATALOGO_ROUTES } from './features/catalogo/catalogo.routes';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login-form.component').then(
        (m) => m.LoginFormComponent
      ),
  },
  {
    // Layout principal (Navbar + Sidebar + router-outlet) para usuarios autenticados.
    // Las URLs de los children NO cambian (contratos de navegación intactos).
    path: '',
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        // Dashboard de administración con métricas (ASU).
        path: 'admin/dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU'] },
      },
      {
        // CU3: Gestión de Usuarios (ASU).
        path: 'admin/usuarios',
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
        canActivate: [authGuard],
        data: { roles: ['ASU'] },
      },
      {
        // CU4 + CU5: vista unificada de Roles y Permisos (tabs).
        path: 'dashboard/roles-permisos',
        loadComponent: () =>
          import('./features/roles/roles-permisos.component').then(
            (m) => m.RolesPermisos
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU'] },
      },
      {
        // CU16: Perfil Institucional de la Empresa.
        path: 'empresa',
        loadComponent: () =>
          import('./features/company/company.component').then((m) => m.CompanyComponent),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
      },
      {
        // CU17: Gestión de Sucursales.
        path: 'sucursales',
        loadComponent: () =>
          import('./features/branches/branches.component').then((m) => m.BranchesComponent),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
      },
      {
        // CU23: Gestión de Proveedores.
        path: 'proveedores',
        loadComponent: () =>
          import('./features/suppliers/suppliers.component').then(
            (m) => m.SuppliersComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
      },
      {
        // CU9: Gestión de Categorías.
        path: 'categorias',
        loadComponent: () =>
          import('./features/categories/categories.component').then(
            (m) => m.CategoriesComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
      },
      {
        // Módulo Catálogo: rutas lazy children bajo /catalogo (CU6, CU7, CU24...).
        path: 'catalogo',
        children: CATALOGO_ROUTES,
      },
      {
        // Módulo Inventario: rutas lazy children bajo /inventario (CU22...).
        path: 'inventario',
        loadChildren: () =>
          import('./features/inventario/inventario.routes').then(
            (m) => m.INVENTARIO_ROUTES,
          ),
      },
      {
        // Módulo Reservas: rutas lazy children bajo /reservas (CU14...).
        path: 'reservas',
        loadChildren: () =>
          import('./features/reservas/reservas.routes').then(
            (m) => m.RESERVAS_ROUTES,
          ),
      },
      {
        // Módulo Probador Virtual AR (CU8): ruta lazy bajo /probador-virtual.
        path: 'probador-virtual',
        loadChildren: () =>
          import('./features/probador-virtual/probador.routes').then(
            (m) => m.PROBADOR_ROUTES,
          ),
      },
      {
        path: 'gerente/dashboard',
        loadComponent: () =>
          import('./features/gerente/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['GS'] },
      },
      {
        path: 'vendedor/dashboard',
        loadComponent: () =>
          import('./features/vendedor/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['V'] },
      },
      {
        path: 'tienda/home',
        loadComponent: () =>
          import('./features/tienda/home/home.component').then(
            (m) => m.HomeComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['C'] },
      },
      {
        // CU15: Carrito de Compras del Cliente (mock).
        path: 'carrito',
        loadComponent: () =>
          import('./features/tienda/carrito/carrito.component').then(
            (m) => m.CarritoComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['C', 'V', 'ASU', 'GS'] },
      },
      {
        // CU21: Checkout / Confirmación de compra (mock).
        path: 'checkout',
        loadComponent: () =>
          import('./features/tienda/checkout/checkout.component').then(
            (m) => m.CheckoutComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['C', 'V', 'ASU', 'GS'] },
      },
      {
        // Placeholder de módulos Ciclos 2+ (ítems del sidebar en desarrollo).
        path: 'proximamente/:modulo',
        loadComponent: () =>
          import('./features/proximamente/proximamente.component').then(
            (m) => m.ProximamenteComponent
          ),
        canActivate: [authGuard],
        // Ruta con params: se renderiza en el cliente, no en prerender.
        data: { renderMode: 'client' },
      },
    ],
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
