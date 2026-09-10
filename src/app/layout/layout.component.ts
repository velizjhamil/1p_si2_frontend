import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { Rol } from '../core/models/usuario.model';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

/** Página de inicio según el rol del usuario autenticado. */
const ROLE_HOME: Record<Rol, string> = {
  ASU: '/admin/dashboard',
  GS: '/gerente/dashboard',
  V: '/vendedor/dashboard',
  C: '/tienda/home',
};

/** Etiqueta legible del rol para la Navbar. */
const ROLE_LABELS: Record<Rol, string> = {
  ASU: 'Administrador Super Usuario',
  GS: 'Gerente de Sucursal',
  V: 'Vendedor',
  C: 'Cliente',
};

/** Opciones del menú; se filtran por rol al renderizar el Sidebar. */
const NAV_ITEMS: Array<{
  label: string;
  icon: string;
  route: string;
  roles: Rol[];
}> = [
  { label: 'Usuarios', icon: 'users', route: '/admin/usuarios', roles: ['ASU'] }, // CU3
  { label: 'Roles y Permisos', icon: 'shield', route: '/dashboard/roles-permisos', roles: ['ASU'] }, // CU4 + CU5
  { label: 'Empresa', icon: 'building', route: '/empresa', roles: ['ASU', 'GS'] }, // CU16
  { label: 'Sucursales', icon: 'pin', route: '/sucursales', roles: ['ASU', 'GS'] }, // CU17
  { label: 'Proveedores', icon: 'truck', route: '/proveedores', roles: ['ASU', 'GS'] }, // CU23
];

/** SVG path data (estilo Feather, 24x24, stroke) — un solo <path> por ícono. */
const ICON_PATHS: Record<string, string> = {
  home: 'M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22v-8h6v8',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
  building:
    'M4 22V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v19M16 8h3a1 1 0 0 1 1 1v13M8 6h3M8 10h3M8 14h3M8 18h3',
  pin: 'M12 22s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 15.8 12 22 12 22zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  truck:
    'M1 4h13v12H1zM14 9h4l4 4v3h-8zM5.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 6h18M3 12h18M3 18h18',
};

@Component({
  selector: 'app-layout',
  imports: [NgClass, RouterOutlet, RouterLink],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** Estado del Sidebar en pantallas pequeñas. */
  protected readonly sidebarOpen = signal(false);

  /** URL activa (para resaltar el enlace actual de forma determinista). */
  private readonly currentUrl = signal(this.router.url);

  /** Usuario autenticado reactivo (BehaviorSubject -> signal). */
  private readonly user = toSignal(this.authService.currentUser$, {
    initialValue: null,
  });

  protected readonly usuario = this.user;
  protected readonly iconPaths = ICON_PATHS;

  /** Rol actual ('ASU' | 'GS' | 'V' | 'C') o null si no hay sesión. */
  protected readonly rol = computed<Rol | null>(
    () => (this.user()?.rol?.nombre_rol as Rol) ?? null,
  );

  protected readonly rolLabel = computed(() => {
    const rol = this.rol();
    return rol ? ROLE_LABELS[rol] : '';
  });

  /** Inicial del nombre para el avatar del Navbar. */
  protected readonly inicial = computed(
    () => this.user()?.nombre?.charAt(0).toUpperCase() ?? 'U',
  );

  /** Menú visible según el rol del usuario autenticado. */
  protected readonly menu = computed<MenuItem[]>(() => {
    const rol = this.rol();
    if (!rol) return [];
    return [
      { label: 'Inicio', icon: 'home', route: ROLE_HOME[rol] },
      ...NAV_ITEMS.filter((item) => item.roles.includes(rol)),
    ];
  });

  constructor() {
    // Trackea la URL activa y cierra el Sidebar móvil al navegar.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set((event as NavigationEnd).urlAfterRedirects);
        this.sidebarOpen.set(false);
      });
  }

  /** True si el ítem del menú corresponde a la vista actual. */
  protected isActive(route: string): boolean {
    return this.currentUrl() === route;
  }

  protected toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  /** CU2: Cerrar sesión — limpia LocalStorage y redirige al login. */
  protected cerrarSesion(): void {
    this.authService.logout();
  }
}
