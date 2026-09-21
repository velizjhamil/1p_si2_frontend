import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { authGuard } from '../../core/guards/auth.guard';
import { MODULES } from '../../layout/layout.component';
import { ReportesComponent } from './reportes.component';

/**
 * CU20 — Navegación al módulo de Reportes: ruta, menú y guard (RBAC de
 * navegación; la autorización real la valida FastAPI).
 *   ASU, GS: acceso · V, C, D: rechazados · sin sesión: /login
 */
function rutaReportes(): Route {
  const layout = routes.find((r) => r.path === '' && r.children);
  const ruta = layout?.children?.find((r) => r.path === 'reportes');
  expect(ruta).toBeDefined();
  return ruta as Route;
}

function iniciarSesion(rol: string | null): void {
  localStorage.clear();
  if (rol) {
    localStorage.setItem('auth_token', 'token-de-prueba');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({ id_usuario: `id-${rol}`, nombre: rol, correo: `${rol}@x.test`, estado: true, rol: { id_rol: 'r', nombre_rol: rol } }),
    );
  }
}

function correrGuard(rol: string | null) {
  iniciarSesion(rol);
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const snapshot = { data: rutaReportes().data } as unknown as ActivatedRouteSnapshot;
  const permitido = TestBed.runInInjectionContext(() => authGuard(snapshot, { url: '/reportes' } as RouterStateSnapshot));
  return { permitido, navigate };
}

describe('Ruta /reportes (CU20)', () => {
  it('existe, usa authGuard y está limitada estrictamente a GS', () => {
    const ruta = rutaReportes();
    expect(ruta.canActivate).toContain(authGuard);
    expect(ruta.data).toEqual({ roles: ['GS'], strict: true });
  });

  it('carga perezosamente ReportesComponent', async () => {
    const componente = await (rutaReportes().loadComponent as () => Promise<unknown>)();
    expect(componente).toBe(ReportesComponent);
  });

  it('GS: puede navegar', () => {
    expect(correrGuard('GS').permitido).toBe(true);
  });

  for (const rol of ['ASU', 'V', 'C', 'D']) {
    it(`${rol}: el guard lo rechaza y lo lleva a su inicio`, () => {
      const { permitido, navigate } = correrGuard(rol);
      expect(permitido).toBe(false);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(navigate).not.toHaveBeenCalledWith(['/reportes']);
    });
  }

  it('sin sesión: va a /login', () => {
    const { permitido, navigate } = correrGuard(null);
    expect(permitido).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});

describe('Menú lateral (CU20)', () => {
  const item = () =>
    MODULES.flatMap((m) => m.items.map((i) => ({ modulo: m, item: i }))).find((x) => x.item.cus === 'CU20');

  it('el ítem de CU20 apunta a /reportes con nombre corto Reportes', () => {
    expect(item()?.item.route).toBe('/reportes');
    expect(item()?.item.label).toBe('Reportes');
  });

  it('solo lo ve GS, dentro de "Operativa Local"', () => {
    expect(item()?.item.roles).toEqual(['GS']);
    expect(item()?.modulo.label).toBe('Operativa Local');
  });
});
