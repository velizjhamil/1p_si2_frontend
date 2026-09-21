import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { CATALOGO_ROUTES } from './features/catalogo/catalogo.routes';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
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
        // CU3: Gestión de Usuarios (ASU / GS sucursal).
        path: 'admin/usuarios',
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
      },
      {
        // CU4 + CU5: vista unificada de Roles y Permisos (tabs).
        path: 'admin/roles',
        loadComponent: () =>
          import('./features/roles/roles-permisos.component').then(
            (m) => m.RolesPermisos
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU'] },
      },
      {
        path: 'dashboard/roles-permisos',
        redirectTo: 'admin/roles',
        pathMatch: 'full',
      },
      {
        // CU16: Perfil Institucional de la Empresa (ASU).
        path: 'empresa',
        loadComponent: () =>
          import('./features/company/company.component').then((m) => m.CompanyComponent),
        canActivate: [authGuard],
        data: { roles: ['ASU'], strict: true },
      },
      {
        // CU17: Gestión de Sucursales (ASU).
        path: 'sucursales',
        loadComponent: () =>
          import('./features/branches/branches.component').then((m) => m.BranchesComponent),
        canActivate: [authGuard],
        data: { roles: ['ASU'], strict: true },
      },
      {
        // CU23: Gestión de Proveedores (GS).
        path: 'proveedores',
        loadComponent: () =>
          import('./features/suppliers/suppliers.component').then(
            (m) => m.SuppliersComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['GS'], strict: true },
      },
      {
        // CU9: Gestión de Categorías (ASU).
        path: 'categorias',
        loadComponent: () =>
          import('./features/categories/categories.component').then(
            (m) => m.CategoriesComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU'], strict: true },
      },
      {
        // Módulo Catálogo: rutas lazy children bajo /catalogo (CU6, CU7, CU24...).
        path: 'catalogo',
        children: CATALOGO_ROUTES,
      },
      {
        // Módulo Inventario: rutas lazy children bajo /inventario (CU22...).
        path: 'inventario',
        canActivate: [authGuard],
        data: { roles: ['GS', 'V'], strict: true },
        loadChildren: () =>
          import('./features/inventario/inventario.routes').then(
            (m) => m.INVENTARIO_ROUTES,
          ),
      },
      {
        // Módulo Reservas: rutas lazy children bajo /reservas (CU14...).
        path: 'reservas',
        canActivate: [authGuard],
        data: { roles: ['GS', 'V', 'C'], strict: true },
        loadChildren: () =>
          import('./features/reservas/reservas.routes').then(
            (m) => m.RESERVAS_ROUTES,
          ),
      },
      {
        // Módulo Ventas: rutas lazy children bajo /ventas (CU11...).
        path: 'ventas',
        canActivate: [authGuard],
        data: { roles: ['GS', 'V'], strict: true },
        loadChildren: () =>
          import('./features/ventas/ventas.routes').then(
            (m) => m.VENTAS_ROUTES,
          ),
      },
      {
        // CU13: Gestión de Devoluciones (vista operativa GS/V).
        path: 'devoluciones',
        loadComponent: () =>
          import('./features/devoluciones/devoluciones.component').then(
            (m) => m.DevolucionesComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['GS', 'V'], strict: true },
      },
      {
        // CU10: Vista dedicada de Notificaciones (bandeja completa).
        path: 'notificaciones',
        loadComponent: () =>
          import('./features/notificaciones/notificaciones.component').then(
            (m) => m.NotificacionesComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['GS', 'V', 'C', 'D'], strict: true },
      },
      {
        // CU12: Gestión de Descuentos / Cupones (GS).
        path: 'descuentos',
        loadComponent: () =>
          import('./features/descuentos/descuentos.component').then(
            (m) => m.DescuentosComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['GS'], strict: true },
      },
      {
        // CU20: Gestión de Reportes (GS).
        path: 'reportes',
        loadComponent: () =>
          import('./features/reportes/reportes.component').then(
            (m) => m.ReportesComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['GS'], strict: true },
      },
      {
        // Módulo Probador Virtual AR (CU8): ruta lazy bajo /probador-virtual.
        path: 'probador-virtual',
        canActivate: [authGuard],
        data: { roles: ['C'], strict: true },
        loadChildren: () =>
          import('./features/probador-virtual/probador.routes').then(
            (m) => m.PROBADOR_ROUTES,
          ),
      },
      {
        // CU25: Asistente Virtual Inteligente y Recomendaciones de Moda IA (Cliente).
        path: 'asistente-ia',
        loadComponent: () =>
          import('./features/tienda/chat-ia-widget/chat-ia-page.component').then(
            (m) => m.ChatIaPageComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['C'], strict: true },
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
        // Solo el Cliente compra: strict = ni siquiera el ASU entra por el pase libre del guard.
        data: { roles: ['C'], strict: true },
      },
      {
        // CU21: Checkout / Confirmación de compra (mock).
        path: 'checkout',
        loadComponent: () =>
          import('./features/tienda/checkout/checkout.component').then(
            (m) => m.CheckoutComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['V', 'C'], strict: true },
      },
      {
        // Módulo Envíos (CU18): GS y D.
        path: 'envios',
        canActivate: [authGuard],
        data: { roles: ['GS', 'D'], strict: true },
        loadChildren: () =>
          import('./features/envios/envios.routes').then((m) => m.ENVIOS_ROUTES),
      },
      {
        // Módulo Agencias de Reparto (CU19): GS y D.
        path: 'agencias',
        canActivate: [authGuard],
        data: { roles: ['GS', 'D'], strict: true },
        loadChildren: () =>
          import('./features/agencias/agencias.routes').then((m) => m.AGENCIAS_ROUTES),
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
