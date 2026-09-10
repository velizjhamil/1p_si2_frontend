import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

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
    // Las URLs de los children no cambian: /admin/dashboard sigue siendo /admin/dashboard.
    path: '',
    loadComponent: () =>
      import('./layout/layout.component').then((m) => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'admin/dashboard',
        loadComponent: () =>
          import('./features/admin/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU'] },
      },
      {
        path: 'admin/usuarios',
        loadComponent: () =>
          import('./features/admin/usuarios/usuarios').then((m) => m.Usuarios),
        canActivate: [authGuard],
        data: { roles: ['ASU'] },
      },
      {
        // CU4 + CU5: vista unificada de Roles y Permisos (tabs).
        path: 'dashboard/roles-permisos',
        loadComponent: () =>
          import('./features/admin/roles-permisos/roles-permisos').then(
            (m) => m.RolesPermisos
          ),
        canActivate: [authGuard],
        data: { roles: ['ASU'] },
      },
      {
        path: 'empresa',
        loadComponent: () =>
          import('./features/empresa/empresa/empresa').then((m) => m.Empresa),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
      },
      {
        path: 'sucursales',
        loadComponent: () =>
          import('./features/sucursales/lista/lista').then((m) => m.Lista),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
      },
      {
        path: 'proveedores',
        loadComponent: () =>
          import('./features/proveedores/lista/lista').then((m) => m.Lista),
        canActivate: [authGuard],
        data: { roles: ['ASU', 'GS'] },
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
