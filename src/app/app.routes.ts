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
    path: 'admin/dashboard',
    loadComponent: () =>
      import('./features/admin/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
    canActivate: [authGuard],
    data: { roles: ['ASU'] },
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
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];