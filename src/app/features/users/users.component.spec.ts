import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { signal } from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersComponent } from './users.component';
import { UsuariosService } from './users.service';
import { AuthService } from '../../core/services/auth.service';
import { RbacService } from '../../core/services/rbac.service';
import { RolCatalogo, UsuarioList } from '../../core/models/usuario.model';

describe('UsersComponent — Carga de Roles y Fallback para Gerente de Sucursal (GS)', () => {
 let usuariosServiceMock: any;
 let authServiceMock: any;
 let esGerenteSig = signal(false);
 let esAdminSig = signal(false);

 const mockRoles: RolCatalogo[] = [
 { id_rol: 'rol-1', nombre_rol: 'ASU', descripcion: 'Admin', fecha_creacion: '2026-01-01', permisos: [], cantidad_usuarios: 1 },
 { id_rol: 'rol-2', nombre_rol: 'GS', descripcion: 'Gerente', fecha_creacion: '2026-01-01', permisos: [], cantidad_usuarios: 1 },
 { id_rol: 'rol-3', nombre_rol: 'V', descripcion: 'Vendedor', fecha_creacion: '2026-01-01', permisos: [], cantidad_usuarios: 2 },
 ];

 const mockUsuarios: UsuarioList[] = [
 {
 id_usuario: 'u-1',
 nombre: 'Carlos',
 apellido: 'Ventas',
 correo: 'carlos@tienda.com',
 estado: true,
 rol: { id_rol: 'rol-3', nombre_rol: 'V' },
 rol_id: 'rol-3',
 },
 ];

 beforeEach(() => {
 usuariosServiceMock = {
 getUsuarios: vi.fn().mockReturnValue(of({ data: mockUsuarios })),
 getRoles: vi.fn().mockReturnValue(of({ data: mockRoles })),
 createUsuario: vi.fn().mockReturnValue(of({ data: mockUsuarios[0] })),
 updateUsuario: vi.fn().mockReturnValue(of({ data: mockUsuarios[0] })),
 toggleStatusUsuario: vi.fn().mockReturnValue(of({ data: mockUsuarios[0] })),
 };

 authServiceMock = {
 currentUserSignal: vi.fn(),
 };
 });

 function setupComponent(rolActual: 'ASU' | 'GS') {
 esGerenteSig.set(rolActual === 'GS');
 esAdminSig.set(rolActual === 'ASU');

 const rbacServiceMock = {
 esGerente: esGerenteSig,
 esAdmin: esAdminSig,
 rol: signal(rolActual),
 getRol: () => rolActual,
 };

 TestBed.configureTestingModule({
 imports: [UsersComponent],
 providers: [
 { provide: UsuariosService, useValue: usuariosServiceMock },
 { provide: AuthService, useValue: authServiceMock },
 { provide: RbacService, useValue: rbacServiceMock },
 ],
 });

 const fixture = TestBed.createComponent(UsersComponent);
 const component = fixture.componentInstance;
 return { fixture, component };
 }

 it('GS carga roles normalmente y rolesDisponibles filtra únicamente el rol V', () => {
 const { component } = setupComponent('GS');
 component.ngOnInit();

 expect(component.esGerente()).toBe(true);
 expect(component.roles().length).toBe(3);
 expect(component.rolesDisponibles().length).toBe(1);
 expect(component.rolesDisponibles()[0].nombre_rol).toBe('V');
 expect(component.errorMessage()).toBe('');
 });

 it('GS con fallo en getRoles aplica fallback seguro de rol V sin mostrar error rojo', () => {
 usuariosServiceMock.getRoles.mockReturnValue(throwError(() => new Error('403 Forbidden')));
 const { component } = setupComponent('GS');
 component.ngOnInit();

 expect(component.esGerente()).toBe(true);
 // No debe mostrar la alerta roja al usuario
 expect(component.errorMessage()).toBe('');
 // Debe tener disponible el rol Vendedor por fallback
 expect(component.rolesDisponibles().length).toBe(1);
 expect(component.rolesDisponibles()[0].nombre_rol).toBe('V');
 });

 it('ASU con fallo en getRoles muestra mensaje de error correspondiente', () => {
 usuariosServiceMock.getRoles.mockReturnValue(throwError(() => new Error('500 Error')));
 const { component } = setupComponent('ASU');
 component.ngOnInit();

 expect(component.esGerente()).toBe(false);
 expect(component.errorMessage()).toBe('No se pudo cargar el catálogo de roles.');
 });
});
