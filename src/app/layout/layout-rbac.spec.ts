import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../core/services/auth.service';
import { RbacService } from '../core/services/rbac.service';
import { MODULES, LayoutComponent } from './layout.component';
import { Usuario } from '../core/models/usuario.model';

function crearUsuario(rol: string): Usuario {
  return {
    id_usuario: `usr-${rol.toLowerCase()}`,
    nombre: `Usuario ${rol}`,
    correo: `${rol.toLowerCase()}@attention.test`,
    estado: true,
    rol: { id_rol: `rol-${rol.toLowerCase()}`, nombre_rol: rol },
  };
}

describe('RBAC y Menú Lateral Dinámico (LayoutComponent)', () => {
  let rbacService: RbacService;
  let authService: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    rbacService = TestBed.inject(RbacService);
    authService = TestBed.inject(AuthService);
  });

  const simularSesion = (rol: string | null) => {
    if (rol) {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('auth_user', JSON.stringify(crearUsuario(rol)));
    } else {
      localStorage.clear();
    }
    const internalSubject = (authService as unknown as { _currentUser: BehaviorSubject<Usuario | null> })._currentUser;
    internalSubject.next(rol ? crearUsuario(rol) : null);
  };

  describe('RbacService - Autorización y visibilidad', () => {
    it('detecta correctamente el rol activo y helpers booleanos', () => {
      simularSesion('ASU');
      expect(rbacService.getRol()).toBe('ASU');
      expect(rbacService.esAdmin()).toBe(true);
      expect(rbacService.esCliente()).toBe(false);

      simularSesion('GS');
      expect(rbacService.getRol()).toBe('GS');
      expect(rbacService.esGerente()).toBe(true);

      simularSesion('V');
      expect(rbacService.getRol()).toBe('V');
      expect(rbacService.esVendedor()).toBe(true);

      simularSesion('C');
      expect(rbacService.getRol()).toBe('C');
      expect(rbacService.esCliente()).toBe(true);

      simularSesion('D');
      expect(rbacService.getRol()).toBe('D');
      expect(rbacService.esDelivery()).toBe(true);
    });

    it('canAccess() respeta reglas estrictas y comodín de administrador', () => {
      simularSesion('ASU');
      // ASU pasa rutas comunes sin strict
      expect(rbacService.canAccess(['GS'])).toBe(true);
      // ASU NO entra a rutas strict exclusivas del cliente (ej. carrito)
      expect(rbacService.canAccess(['C'], true)).toBe(false);

      simularSesion('C');
      expect(rbacService.canAccess(['C'], true)).toBe(true);
      expect(rbacService.canAccess(['ASU'])).toBe(false);
    });
  });

  describe('Matriz de visibilidad del Sidebar por Rol', () => {
    it('ASU: ve enlaces directos (Dashboard, Empresa) y grupos Seguridad y Catálogo y Configuración', () => {
      simularSesion('ASU');
      const fixture = TestBed.createComponent(LayoutComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      // Enlaces superiores directos
      const topLinks = (comp as unknown as { topLinks: () => { label: string; route: string }[] }).topLinks();
      expect(topLinks.map((l) => l.label)).toEqual(['Dashboard', 'Empresa']);
      expect(topLinks.map((l) => l.route)).toEqual(['/admin/dashboard', '/empresa']);

      const menuAsu = rbacService.filterMenu(MODULES, 'ASU');
      const categorias = menuAsu.map((m) => m.label);
      const todosLosCus = menuAsu.flatMap((m) => m.items.map((i) => i.cus));
      const etiquetas = menuAsu.flatMap((m) => m.items.map((i) => i.label));
      const rutas = menuAsu.flatMap((m) => m.items.map((i) => i.route));

      // Módulos exactos permitidos para ASU
      expect(categorias).toEqual([
        'Seguridad',
        'Catálogo y Configuración',
      ]);

      // Nombres cortos y profesionales sin códigos CU en las etiquetas
      expect(etiquetas).toEqual([
        'Usuarios',
        'Roles y Permisos',
        'Sucursales',
        'Temporadas',
        'Productos',
        'Categorías',
        'Tallas',
      ]);

      // Casos de uso de ASU
      expect(todosLosCus).toEqual([
        'CU3',        // Usuarios
        'CU4, CU5',   // Roles y Permisos
        'CU17',       // Sucursales
        'CU24',       // Temporadas
        'CU6',        // Productos
        'CU9',        // Categorías
        'CU7',        // Tallas
      ]);

      // Módulos operativos estrictamente ocultos para ASU
      expect(categorias).not.toContain('Operativa Local');
      expect(categorias).not.toContain('Operaciones');
      expect(categorias).not.toContain('Logística');
      expect(categorias).not.toContain('Tienda');

      expect(rutas).not.toContain('/ventas');
      expect(rutas).not.toContain('/devoluciones');
      expect(rutas).not.toContain('/inventario');
      expect(rutas).not.toContain('/proveedores');
      expect(rutas).not.toContain('/descuentos');
      expect(rutas).not.toContain('/envios');
      expect(rutas).not.toContain('/agencias');
      expect(rutas).not.toContain('/reportes');
      expect(rutas).not.toContain('/carrito');
      expect(rutas).not.toContain('/checkout');
    });

    it('GS (Gerente de Sucursal): ve Dashboard Sucursal y Operativa Local completa', () => {
      simularSesion('GS');
      const fixture = TestBed.createComponent(LayoutComponent);
      fixture.detectChanges();
      const comp = fixture.componentInstance;

      const topLinks = (comp as unknown as { topLinks: () => { label: string; route: string }[] }).topLinks();
      expect(topLinks.map((l) => l.label)).toEqual(['Dashboard Sucursal']);
      expect(topLinks.map((l) => l.route)).toEqual(['/gerente/dashboard']);

      const menuGs = rbacService.filterMenu(MODULES, 'GS');
      const categorias = menuGs.map((m) => m.label);
      const etiquetas = menuGs.flatMap((m) => m.items.map((i) => i.label));
      const rutas = menuGs.flatMap((m) => m.items.map((i) => i.route));
      const cus = menuGs.flatMap((m) => m.items.map((i) => i.cus));

      expect(categorias).toEqual(['Operativa Local']);

      // Nombres cortos de la operativa local
      expect(etiquetas).toEqual([
        'Personal',
        'Proveedores',
        'Inventario',
        'Descuentos',
        'Devoluciones',
        'Ventas',
        'Reservas',
        'Envíos',
        'Agencias Reparto',
        'Reportes',
        'Notificaciones',
      ]);

      expect(cus).toEqual([
        'CU3',  // Personal / Usuarios
        'CU23', // Proveedores
        'CU22', // Inventario
        'CU12', // Descuentos
        'CU13', // Devoluciones
        'CU11', // Ventas
        'CU14', // Reservas
        'CU18', // Envíos
        'CU19', // Agencias Reparto
        'CU20', // Reportes
        'CU10', // Notificaciones
      ]);

      // Casos de uso restringidos para GS (solo ASU)
      expect(rutas).not.toContain('/admin/roles'); // Roles/Permisos
      expect(rutas).not.toContain('/sucursales'); // Sucursales
      expect(rutas).not.toContain('/categorias'); // Categorias
      expect(rutas).not.toContain('/catalogo/temporadas'); // Temporadas
      expect(rutas).not.toContain('/empresa');
      expect(rutas).not.toContain('/carrito');
    });

    it('V (Vendedor): ve Operaciones (Ventas, Devoluciones, Reservas, Checkout)', () => {
      const menuV = rbacService.filterMenu(MODULES, 'V');
      const categorias = menuV.map((m) => m.label);
      const etiquetas = menuV.flatMap((m) => m.items.map((i) => i.label));
      const cus = menuV.flatMap((m) => m.items.map((i) => i.cus));
      const rutas = menuV.flatMap((m) => m.items.map((i) => i.route));

      expect(categorias).toEqual(['Operaciones']);
      expect(etiquetas).toEqual(['Ventas', 'Devoluciones', 'Reservas', 'Checkout']);
      expect(cus).toEqual(['CU11', 'CU13', 'CU14', 'CU21']);
      expect(rutas).toEqual(['/ventas', '/devoluciones', '/reservas/gestion', '/checkout']);

      // Módulos administrativos y de logística totalmente ocultos
      expect(rutas).not.toContain('/admin/usuarios');
      expect(rutas).not.toContain('/admin/roles');
      expect(rutas).not.toContain('/envios');
      expect(rutas).not.toContain('/reportes');
    });

    it('D (Delivery): solo ve Logística (Envíos y Agencias)', () => {
      const menuD = rbacService.filterMenu(MODULES, 'D');
      const categorias = menuD.map((m) => m.label);
      const etiquetas = menuD.flatMap((m) => m.items.map((i) => i.label));
      const cus = menuD.flatMap((m) => m.items.map((i) => i.cus));
      const rutas = menuD.flatMap((m) => m.items.map((i) => i.route));

      expect(categorias).toEqual(['Logística']);
      expect(etiquetas).toEqual(['Envíos', 'Agencias']);
      expect(cus).toEqual(['CU18', 'CU19']);
      expect(rutas).toEqual(['/envios', '/agencias']);

      expect(rutas).not.toContain('/catalogo/productos');
      expect(rutas).not.toContain('/ventas');
      expect(rutas).not.toContain('/admin/usuarios');
      expect(rutas).not.toContain('/reportes');
    });

    it('C (Cliente): ve Tienda (Catálogo, Asistente IA, Carrito, Checkout, Reservas, Probador, Notificaciones)', () => {
      const menuC = rbacService.filterMenu(MODULES, 'C');
      const categorias = menuC.map((m) => m.label);
      const etiquetas = menuC.flatMap((m) => m.items.map((i) => i.label));
      const rutas = menuC.flatMap((m) => m.items.map((i) => i.route));

      expect(categorias).toEqual(['Tienda']);
      expect(etiquetas).toEqual([
        'Catálogo',
        'Asistente IA',
        'Carrito',
        'Checkout',
        'Reservas',
        'Probador Virtual',
        'Notificaciones',
      ]);
      expect(rutas).toEqual([
        '/catalogo/productos',
        '/asistente-ia',
        '/carrito',
        '/checkout',
        '/reservas/gestion',
        '/probador-virtual',
        '/notificaciones',
      ]);

      expect(rutas).not.toContain('/admin/usuarios');
      expect(rutas).not.toContain('/reportes');
      expect(rutas).not.toContain('/inventario');
      expect(rutas).not.toContain('/envios');
    });
  });
});
