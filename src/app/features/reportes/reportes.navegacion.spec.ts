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
  it('existe, usa authGuard y está limitada a ASU y GS', () => {
    const ruta = rutaReportes();
    expect(ruta.canActivate).toContain(authGuard);
    expect(ruta.data).toEqual({ roles: ['ASU', 'GS'] });
  });

  it('carga perezosamente ReportesComponent', async () => {
    const componente = await (rutaReportes().loadComponent as () => Promise<unknown>)();
    expect(componente).toBe(ReportesComponent);
  });

  for (const rol of ['ASU', 'GS']) {
    it(`${rol}: puede navegar`, () => {
      expect(correrGuard(rol).permitido).toBe(true);
    });
  }

  for (const rol of ['V', 'C', 'D']) {
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

  it('el ítem de CU20 apunta a /reportes (ya no al placeholder /proximamente)', () => {
    expect(item()?.item.route).toBe('/reportes');
    expect(item()?.item.route).not.toContain('proximamente');
  });

  it('solo lo ven ASU y GS, dentro de "Reportes e IA"', () => {
    expect(item()?.item.roles).toEqual(['ASU', 'GS']);
    expect(item()?.modulo.label).toBe('Reportes e IA');
  });

  it('no se tocó el ítem del Asistente IA (CU25)', () => {
    const cu25 = MODULES.flatMap((m) => m.items).find((i) => i.cus === 'CU25');
    expect(cu25?.route).toBe('/proximamente/asistente');
  });
});
