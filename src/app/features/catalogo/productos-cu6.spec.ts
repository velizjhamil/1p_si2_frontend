import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from '../../core/guards/auth.guard';
import { CATALOGO_ROUTES } from './catalogo.routes';
import { ProductosComponent } from './productos/productos.component';

/**
 * CU6 (Gestionar productos): la GESTIÓN web es solo del ASU; el Cliente conserva la
 * CONSULTA del catálogo. El backend es la autoridad (403); esto verifica el frontend.
 */
const rutaProductos = CATALOGO_ROUTES.find((r) => r.path === 'productos')!;
const state = { url: '/catalogo/productos' } as RouterStateSnapshot;

function sesion(rol: string | null) {
  localStorage.clear();
  if (rol) {
    localStorage.setItem('auth_token', 'token-de-prueba');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id_usuario: 'u', nombre: rol, correo: `${rol}@x.test`, estado: true, rol: { id_rol: 'r', nombre_rol: rol } }),
    );
  }
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
}

function guard(rol: string | null) {
  sesion(rol);
  vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const snapshot = { data: rutaProductos.data } as unknown as ActivatedRouteSnapshot;
  return TestBed.runInInjectionContext(() => authGuard(snapshot, state));
}

function montar(rol: string) {
  sesion(rol);
  const fixture = TestBed.createComponent(ProductosComponent);
  fixture.detectChanges();
  return fixture;
}

describe('CU6 - ruta de consulta /catalogo/productos', () => {
  it('sigue protegida por authGuard y accesible al Cliente (consulta)', () => {
    expect(rutaProductos.canActivate).toContain(authGuard);
    expect(guard('C')).toBe(true);
    expect(guard('ASU')).toBe(true);
  });

  it('rechaza roles fuera de la lista (D)', () => {
    expect(guard('D')).toBe(false);
  });
});

describe('CU6 - gestión de productos solo ASU', () => {
  it('ASU ve las opciones de gestión', () => {
    const f = montar('ASU');
    expect(f.componentInstance.puedeGestionar).toBe(true);
    expect(f.nativeElement.textContent).toContain('Nuevo Producto');
  });

  for (const rol of ['C', 'GS', 'V']) {
    it(`${rol} no ve botones de gestión y no puede abrir los modales`, () => {
      const f = montar(rol);
      const c = f.componentInstance;
      expect(c.puedeGestionar).toBe(false);
      const texto = f.nativeElement.textContent as string;
      expect(texto).not.toContain('Nuevo Producto');
      expect(texto).not.toContain('Editar');
      expect(texto).not.toContain('Eliminar');
      c.abrirModalCrear();
      expect(c.modalAbierto()).toBe(false);
    });
  }
});
