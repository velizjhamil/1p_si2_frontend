import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Route, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { routes } from '../../app.routes';
import { authGuard } from '../../core/guards/auth.guard';
import { CategoriasService } from './categories.service';

/**
 * CU9: la GESTIÓN web de categorías es exclusiva de ASU.
 * La CONSULTA (GET /categorias) no cambia y sigue disponible para el Cliente.
 */
function usuario(rol: string) {
  return { id_usuario: `id-${rol}`, nombre: rol, correo: `${rol}@x.test`, estado: true, rol: { id_rol: 'r', nombre_rol: rol } };
}

function iniciarSesion(rol: string | null): void {
  localStorage.clear();
  if (rol) {
    localStorage.setItem('auth_token', 'token-de-prueba');
    localStorage.setItem('auth_user', JSON.stringify(usuario(rol)));
  }
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
}

function rutaCategorias(): Route {
  const layout = routes.find((r) => r.path === '' && r.children);
  const ruta = layout?.children?.find((r) => r.path === 'categorias');
  expect(ruta).toBeTruthy();
  return ruta as Route;
}

describe('CU9 — ruta de gestión /categorias (solo ASU)', () => {
  const state = { url: '/categorias' } as RouterStateSnapshot;

  function entrar(rol: string | null) {
    iniciarSesion(rol);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const snapshot = { data: rutaCategorias().data } as unknown as ActivatedRouteSnapshot;
    const permitido = TestBed.runInInjectionContext(() => authGuard(snapshot, state));
    return { permitido, navigate };
  }

  it('la ruta declara únicamente el rol ASU', () => {
    expect(rutaCategorias().data?.['roles']).toEqual(['ASU']);
  });

  it('ASU accede a la gestión', () => {
    expect(entrar('ASU').permitido).toBe(true);
  });

  it('Cliente NO accede por URL directa y es redirigido', () => {
    const { permitido, navigate } = entrar('C');
    expect(permitido).toBe(false);
    expect(navigate).toHaveBeenCalled();
  });

  it('GS, V y D tampoco acceden', () => {
    for (const rol of ['GS', 'V', 'D']) {
      expect(entrar(rol).permitido).toBe(false);
    }
  });

  it('sin sesión va a /login', () => {
    const { permitido, navigate } = entrar(null);
    expect(permitido).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});

describe('CU9 — consulta de categorías (sin cambios)', () => {
  it('el Cliente sigue consultando GET /categorias con paginación y filtros', () => {
    iniciarSesion('C');
    const service = TestBed.inject(CategoriasService);
    const http = TestBed.inject(HttpTestingController);
    let recibido: unknown;
    service.getCategorias({ linea: 'Mujer', limit: 100 }).subscribe((r) => (recibido = r));
    const req = http.expectOne(`${environment.apiUrl}/categorias?linea=Mujer&page=1&limit=100`);
    expect(req.request.method).toBe('GET');
    req.flush({ status: 'success', data: [], message: 'ok', total: 0, page: 1, limit: 100, pages: 0 });
    expect(recibido).toBeTruthy();
    http.verify();
  });
});
