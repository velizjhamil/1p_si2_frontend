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
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { AuthService } from '../core/services/auth.service';
import { Rol } from '../core/models/usuario.model';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
}

/** Ítem de navegación dentro de un módulo (acordeón del sidebar). */
interface ModuleItem extends MenuItem {
  /** CU(s) que implementa — solo documentación. */
  cus?: string;
}

/** Módulo del sistema: grupo desplegable con sus ítems. */
interface MenuModule {
  label: string;
  icon: string;
  /** Ruta "home" del módulo: el ítem activo dentro expande el acordeón. */
  items: ModuleItem[];
  /** Roles que pueden ver este módulo (vacío = todos los autenticados). */
  roles: Rol[];
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

/**
 * Módulos del sistema según la documentación oficial de Attention.
 * Los ítems cuyo módulo aún no está implementado (Ciclos 2+) navegan a
 * una ruta placeholder bajo /proximamente que muestra "en desarrollo".
 */
const MODULES: MenuModule[] = [
  {
    label: 'Usuarios, Roles y Sucursales',
    icon: 'users',
    roles: ['ASU'],
    items: [
      { label: 'Usuarios', icon: 'users', route: '/admin/usuarios', cus: 'CU3' },
      { label: 'Roles y Permisos', icon: 'shield', route: '/dashboard/roles-permisos', cus: 'CU4, CU5' },
      { label: 'Empresa', icon: 'building', route: '/empresa', cus: 'CU16' },
      { label: 'Sucursales', icon: 'pin', route: '/sucursales', cus: 'CU17' },
    ],
  },
  {
    label: 'Catálogo de Productos',
    icon: 'shirt',
    roles: ['ASU', 'GS'],
    items: [
      { label: 'Productos de Ropa', icon: 'shirt', route: '/proximamente/productos', cus: 'CU6' },
      { label: 'Tallas, Colores y Categorías', icon: 'tag', route: '/proximamente/variantes', cus: 'CU7, CU9' },
      { label: 'Proveedores', icon: 'truck', route: '/proveedores', cus: 'CU23' },
      { label: 'Temporadas y Colecciones', icon: 'calendar', route: '/proximamente/temporadas', cus: 'CU24' },
    ],
  },
  {
    label: 'Disponibilidad e Inventario',
    icon: 'boxes',
    roles: ['ASU', 'GS', 'V'],
    items: [
      { label: 'Consultar Disponibilidad y Stock', icon: 'boxes', route: '/proximamente/stock', cus: 'CU22' },
      { label: 'Movimientos de Inventario (Kardex)', icon: 'list', route: '/proximamente/kardex' },
    ],
  },
  {
    label: 'Reservas y Vestidor Virtual',
    icon: 'sparkles',
    roles: ['ASU', 'GS', 'C'],
    items: [
      { label: 'Gestión de Reservas', icon: 'clock', route: '/proximamente/reservas', cus: 'CU14' },
      { label: 'Configuración AR Probador', icon: 'camera', route: '/proximamente/ar-probador', cus: 'CU8' },
    ],
  },
  {
    label: 'Ventas y Pagos',
    icon: 'cart',
    roles: ['ASU', 'GS', 'V', 'C'],
    items: [
      { label: 'Carrito de Compras', icon: 'cart', route: '/proximamente/carrito', cus: 'CU15' },
      { label: 'Ventas Presenciales / Caja', icon: 'register', route: '/proximamente/caja', cus: 'CU11' },
      { label: 'Pasarela de Pago / Transacciones', icon: 'card', route: '/proximamente/pagos', cus: 'CU21' },
    ],
  },
  {
    label: 'Inteligencia Artificial y Reportes',
    icon: 'brain',
    roles: ['ASU', 'GS'],
    items: [
      { label: 'Reportes y Dashboards', icon: 'chart', route: '/proximamente/reportes', cus: 'CU20' },
      { label: 'Recomendaciones / Asistente IA', icon: 'sparkles', route: '/proximamente/asistente', cus: 'CU25' },
    ],
  },
];

/** SVG path data (estilo Feather, 24x24, stroke) — un <path> por ícono. */
const ICON_PATHS: Record<string, string> = {
  home: 'M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22v-8h6v8',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  building:
    'M4 22V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v19M16 8h3a1 1 0 0 1 1 1v13M8 6h3M8 10h3M8 14h3M8 18h3',
  pin: 'M12 22s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 15.8 12 22 12 22zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  truck:
    'M1 4h13v12H1zM14 9h4l4 4v3h-8zM5.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.5 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 6h18M3 12h18M3 18h18',
  chevron: 'M9 18l6-6-6-6',
  panel: 'M3 3h18v18H3zM9 3v18',
  shirt:
    'M20.4 6.6 16 4l-4 2-4-2L3.6 6.6 6 10l-2 2v9h7v-6h6v6h7v-9l-2-2 2.4-3.4z',
  tag: 'M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
  calendar:
    'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM16 3v4M8 3v4M3 11h18',
  boxes:
    'M21 8.5 12 3 3 8.5v7L12 21l9-5.5zM12 13 3 8.5M12 13l9-4.5M12 13v8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  clock: 'M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  camera:
    'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  cart:
    'M9 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM20 22a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6',
  register:
    'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7v10M16 7v10M8 12h8',
  card:
    'M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM2 10h20',
  chart: 'M18 20V10M12 20V4M6 20v-6',
  brain:
    'M12 4a3 3 0 0 0-3 3v0a3 3 0 0 0-3 3v1a3 3 0 0 0 1 5.8V18a3 3 0 0 0 4 2.8V22M12 4a3 3 0 0 1 3 3v0a3 3 0 0 1 3 3v1a3 3 0 0 1-1 5.8V18a3 3 0 0 1-4 2.8V22',
  sparkles:
    'M12 3l1.9 5.8L20 10l-5.1 2.6L12 18l-2.9-5.4L4 10l6.1-1.2zM19 15l.9 2.6L22 18l-2.1 1.4L19 22l-.9-2.6L16 18l2.1-1.4z',
};

@Component({
  selector: 'app-layout',
  imports: [NgClass, RouterOutlet, RouterLink],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  /** Usuario autenticado reactivo (BehaviorSubject -> signal). */
  private readonly user = toSignal(this.authService.currentUser$, {
    initialValue: null,
  });

  protected readonly usuario = this.user;
  protected readonly iconPaths = ICON_PATHS;
  protected readonly modules = MODULES;

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

  /** Ruta de inicio según rol (botón INICIO del sidebar). */
  protected readonly inicio = computed(
    () => ROLE_HOME[this.rol() ?? 'C'] ?? '/login',
  );

  // ------------------------------------------------------------- sidebar UI
  /** Drawer abierto en móvil/tablet (< 1024px). */
  protected readonly sidebarOpen = signal(false);

  /** Sidebar colapsado en desktop (solo iconos). Persistido en localStorage. */
  protected readonly sidebarCollapsed = signal(this.leerColapso());

  /** URL activa (resalta el ítem actual y expande su módulo). */
  private readonly currentUrl = signal(this.router.url);

  /** Módulo cuyo acordeón está abierto (por índice; null = todos cerrados). */
  protected readonly moduloExpandido = signal<number | null>(null);

  constructor() {
    // Trackea la URL activa, cierra el drawer móvil al navegar y sincroniza
    // el acordeón con la vista actual.
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        const url = (event as NavigationEnd).urlAfterRedirects;
        this.currentUrl.set(url);
        this.sidebarOpen.set(false); // drawer móvil se cierra al elegir ruta
        this.expandirModuloActivo(url);
      });

    // Estado inicial: expandir el módulo que contiene la ruta actual.
    this.expandirModuloActivo(this.router.url);
  }

  /** Módulos visibles según el rol del usuario autenticado. */
  protected readonly menu = computed<MenuModule[]>(() => {
    const rol = this.rol();
    if (!rol) return [];
    return MODULES.filter(
      (mod) => mod.roles.length === 0 || mod.roles.includes(rol),
    );
  });

  /** True si el ítem corresponde a la vista actual. */
  protected isActive(route: string): boolean {
    return this.currentUrl() === route;
  }

  /** True si algún ítem del módulo es la ruta activa. */
  protected moduloActivo(mod: MenuModule): boolean {
    return mod.items.some((item) => this.isActive(item.route));
  }

  /** Alterna el acordeón de un módulo (cierro los demás: acordeón exclusivo). */
  protected toggleModulo(index: number): void {
    // En modo colapsado el acordeón no aplica (los grupos navegan por tooltip)
    if (this.sidebarCollapsed()) return;
    this.moduloExpandido.update((actual) => (actual === index ? null : index));
  }

  /** Expande el acordeón del módulo que contiene la URL dada. */
  private expandirModuloActivo(url: string): void {
    const idx = MODULES.findIndex((mod) =>
      mod.items.some((item) => item.route === url),
    );
    this.moduloExpandido.set(idx >= 0 ? idx : null);
  }

  /** Abre/cierra el drawer en móvil o colapsa/expande en desktop. */
  protected toggleSidebar(): void {
    if (this.esDesktop()) {
      this.sidebarCollapsed.update((v) => !v);
      this.persistirColapso(!this.sidebarCollapsed());
    } else {
      this.sidebarOpen.update((v) => !v);
    }
  }

  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private esDesktop(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
    );
  }

  private leerColapso(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return localStorage.getItem('sidebar_collapsed') === 'true';
  }

  private persistirColapso(colapsado: boolean): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.setItem('sidebar_collapsed', String(colapsado));
  }

  /** CU2: Cerrar sesión — limpia LocalStorage y redirige al login. */
  protected cerrarSesion(): void {
    this.authService.logout();
  }
}
