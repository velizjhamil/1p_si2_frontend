import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { authGuard } from '../../core/guards/auth.guard';
import { CATALOGO_ROUTES } from './catalogo.routes';

/**
 * CU24 (Gestionar temporadas y colecciones): la ruta es exclusiva del rol ASU.
 * El backend es la autoridad; esto verifica que el frontend refleja la misma regla.
 */
const rutaCu24 = CATALOGO_ROUTES.find((r) => r.path === 'temporadas')!;
const state = { url: '/catalogo/temporadas' } as RouterStateSnapshot;

function correr(rol: string | null) {
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
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const snapshot = { data: rutaCu24.data } as unknown as ActivatedRouteSnapshot;
  const permitido = TestBed.runInInjectionContext(() => authGuard(snapshot, state));
  return { permitido, navigate };
}

describe('CU24 - ruta /catalogo/temporadas exclusiva de ASU', () => {
  it('está protegida por authGuard con roles ["ASU"] estrictos', () => {
    expect(rutaCu24.canActivate).toContain(authGuard);
    expect(rutaCu24.data?.['roles']).toEqual(['ASU']);
    expect(rutaCu24.data?.['strict']).toBe(true);
  });

  it('ASU accede', () => {
    expect(correr('ASU').permitido).toBe(true);
  });

  for (const rol of ['GS', 'V', 'D', 'C', 'ADMIN']) {
    it(`${rol} es rechazado`, () => {
      expect(correr(rol).permitido).toBe(false);
    });
  }

  it('sin sesión redirige a /login', () => {
    const { permitido, navigate } = correr(null);
    expect(permitido).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
