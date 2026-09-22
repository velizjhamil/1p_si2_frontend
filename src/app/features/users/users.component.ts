import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from './users.service';
import { SucursalesService } from '../branches/branches.service';
import { RbacService } from '../../core/services/rbac.service';
import {
 RolCatalogo,
 UsuarioCreatePayload,
 UsuarioList,
 UsuarioUpdatePayload,
} from '../../core/models/usuario.model';
import { Sucursal } from '../../core/models/sucursal.model';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';

@Component({
 selector: 'app-usuarios',
 imports: [ReactiveFormsModule],
 templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit {
 private readonly fb = inject(FormBuilder);
 private readonly usuariosService = inject(UsuariosService);
 private readonly sucursalesService = inject(SucursalesService);
 private readonly rbacService = inject(RbacService);

 // ------------------------------------------------------------------ estado
 usuarios = signal<UsuarioList[]>([]);
 roles = signal<RolCatalogo[]>([]);
 sucursales = signal<Sucursal[]>([]);
 cargando = signal(true);
 guardando = signal(false);
 errorMessage = signal('');
 exitoMessage = signal('');

 busqueda = signal('');
 filtroEstado = signal<FiltroEstado>('todos');

 modalAbierto = signal(false);
 editandoId = signal<string | null>(null); // null = crear, id = editar

 readonly esGerente = computed(() => this.rbacService.esGerente());
 readonly titulo = computed(() =>
 this.esGerente() ? 'Personal de Sucursal' : 'Gestión de Usuarios',
 );
 readonly subtitulo = computed(() =>
 this.esGerente()
 ? 'Gestione el personal y vendedores asignados a su sucursal.'
 : 'Administre las cuentas de acceso, roles y estado del sistema.',
 );
 readonly botonNuevo = computed(() =>
 this.esGerente() ? '+ Nuevo Vendedor' : '+ Nuevo Usuario',
 );

 /** Roles disponibles en el select: el GS solo puede asignar rol Vendedor ('V'). */
 rolesDisponibles = computed(() => {
 const list = this.roles();
 if (this.esGerente()) {
 const rolesV = list.filter((r) => r.nombre_rol.toUpperCase() === 'V');
 if (rolesV.length > 0) {
 return rolesV;
 }
 return [
 {
 id_rol: 'V',
 nombre_rol: 'V',
 descripcion: 'Vendedor de Sucursal',
 fecha_creacion: '',
 permisos: [],
 cantidad_usuarios: 0,
 },
 ];
 }
 return list;
 });

 // Filtrado reactivo: texto (nombre, correo, rol) + estado + sucursal
 usuariosFiltrados = computed(() => {
 const term = this.busqueda().toLowerCase().trim();
 const filtro = this.filtroEstado();
 const esGerente = this.esGerente();

 return this.usuarios().filter((u) => {
 // Si es gerente de sucursal, solo ve y administra vendedores (V)
 if (esGerente && u.rol?.nombre_rol?.toUpperCase() !== 'V') {
 return false;
 }

 const nombreCompleto = `${u.nombre} ${u.apellido ?? ''}`.toLowerCase();
 const coincideTexto =
 !term ||
 nombreCompleto.includes(term) ||
 u.correo.toLowerCase().includes(term) ||
 u.rol.nombre_rol.toLowerCase().includes(term) ||
 (u.sucursal_nombre ?? '').toLowerCase().includes(term);
 const coincideEstado =
 filtro === 'todos' ||
 (filtro === 'activos' && u.estado) ||
 (filtro === 'inactivos' && !u.estado);
 return coincideTexto && coincideEstado;
 });
 });

 // ------------------------------------------------------------- formulario
 usuarioForm = this.fb.group({
 nombre: ['', Validators.required],
 apellido: [''],
 correo: ['', [Validators.required, Validators.email]],
 password: [''],
 rol: ['', Validators.required],
 id_sucursal: [''],
 });

 ngOnInit(): void {
 this.cargarUsuarios();
 this.cargarRoles();
 if (!this.esGerente()) {
 this.sucursalesService.getSucursales().subscribe({
 next: (resp) => this.sucursales.set(resp.data),
 error: () => console.error('Error al cargar sucursales'),
 });
 }
 }

 cargarRoles(): void {
 this.usuariosService.getRoles().subscribe({
 next: (resp) => {
 const datos = resp.data || [];
 this.roles.set(datos);
 },
 error: () => {
 if (this.esGerente()) {
 // Respaldo seguro para GS: evitar alerta roja y habilitar opción Vendedor
 const rolVExistente = this.usuarios().find((u) => u.rol?.nombre_rol?.toUpperCase() === 'V')?.rol;
 this.roles.set([
 {
 id_rol: rolVExistente?.id_rol ?? 'V',
 nombre_rol: 'V',
 descripcion: 'Vendedor de Sucursal',
 fecha_creacion: new Date().toISOString(),
 permisos: [],
 cantidad_usuarios: 0,
 },
 ]);
 } else {
 this.errorMessage.set('No se pudo cargar el catálogo de roles.');
 }
 },
 });
 }

 cargarUsuarios(): void {
 this.cargando.set(true);
 this.usuariosService.getUsuarios().subscribe({
 next: (resp) => {
 this.usuarios.set(resp.data);
 this.cargando.set(false);

 // Si es GS y el catálogo de roles está usando fallback sin id_rol real, intentar resolverlo desde los usuarios
 if (this.esGerente() && this.roles().some((r) => r.id_rol === 'V')) {
 const rolV = resp.data.find((u) => u.rol?.nombre_rol?.toUpperCase() === 'V')?.rol;
 if (rolV) {
 this.roles.set([
 {
 id_rol: rolV.id_rol,
 nombre_rol: 'V',
 descripcion: 'Vendedor de Sucursal',
 fecha_creacion: new Date().toISOString(),
 permisos: [],
 cantidad_usuarios: 0,
 },
 ]);
 }
 }
 },
 error: () => {
 this.errorMessage.set('No se pudo cargar la lista de usuarios.');
 this.cargando.set(false);
 },
 });
 }

 // ------------------------------------------------------------------ modal
 abrirModalCrear(): void {
 this.editandoId.set(null);
 let defaultRol = '';
 if (this.esGerente()) {
 const rolV = this.roles().find((r) => r.nombre_rol.toUpperCase() === 'V');
 defaultRol = rolV?.id_rol ??
 this.usuarios().find((u) => u.rol?.nombre_rol?.toUpperCase() === 'V')?.rol?.id_rol ??
 (this.roles().length > 0 ? this.roles()[0].id_rol : 'V');
 }
 this.usuarioForm.reset({
 nombre: '',
 apellido: '',
 correo: '',
 password: '',
 rol: defaultRol,
 id_sucursal: '',
 });
 // Password obligatorio SOLO al crear (mín. 6, igual que el backend)
 this.usuarioForm.controls.password.setValidators([
 Validators.required,
 Validators.minLength(6),
 ]);
 this.usuarioForm.controls.password.updateValueAndValidity();
 this.errorMessage.set('');
 this.modalAbierto.set(true);
 }

 abrirModalEditar(usuario: UsuarioList): void {
 this.editandoId.set(usuario.id_usuario);
 this.usuarioForm.reset({
 nombre: usuario.nombre,
 apellido: usuario.apellido ?? '',
 correo: usuario.correo,
 password: '', // vacío = no cambiar
 rol: usuario.rol_id,
 id_sucursal: usuario.id_sucursal ? String(usuario.id_sucursal) : '',
 });
 // En edición el password es opcional (solo se envía si se escribe)
 this.usuarioForm.controls.password.setValidators(Validators.minLength(6));
 this.usuarioForm.controls.password.updateValueAndValidity();
 this.errorMessage.set('');
 this.modalAbierto.set(true);
 }

 cerrarModal(): void {
 this.modalAbierto.set(false);
 this.errorMessage.set('');
 }

 // ---------------------------------------------------------------- acciones
 guardar(): void {
 if (this.usuarioForm.invalid || this.guardando()) {
 this.errorMessage.set('Complete todos los campos correctamente.');
 return;
 }

 const { nombre, apellido, correo, password, rol, id_sucursal } = this.usuarioForm.value;
 const rolId = rol!;
 this.guardando.set(true);
 this.errorMessage.set('');

 const sucursalNum = id_sucursal ? Number(id_sucursal) : undefined;

 if (this.editandoId()) {
 // Edición: PUT con campos parciales; password solo si se escribió
 const payload: UsuarioUpdatePayload = {
 nombre: nombre!,
 apellido: apellido || undefined,
 correo: correo!,
 rol_id: rolId,
 };
 if (password) payload.password = password;
 if (!this.esGerente()) {
 payload.id_sucursal = id_sucursal ? Number(id_sucursal) : 0; // 0 para desasignar en backend
 }

 this.usuariosService.updateUsuario(this.editandoId()!, payload).subscribe({
 next: () => this.finalizarGuardado('Usuario actualizado correctamente.'),
 error: (err) => this.mostrarError(err),
 });
 } else {
 // Creación: POST requiere nombre_rol (no id)
 let rolObj = this.roles().find((r) => r.id_rol === rolId);
 if (!rolObj && this.esGerente()) {
 rolObj = { id_rol: rolId, nombre_rol: 'V' } as RolCatalogo;
 }
 if (!rolObj) {
 this.errorMessage.set('Seleccione un rol válido.');
 this.guardando.set(false);
 return;
 }
 const payload: UsuarioCreatePayload = {
 nombre: nombre!,
 apellido: apellido || undefined,
 correo: correo!,
 password: password!,
 nombre_rol: rolObj.nombre_rol,
 id_sucursal: sucursalNum,
 };

 this.usuariosService.createUsuario(payload).subscribe({
 next: () => this.finalizarGuardado('Usuario creado correctamente.'),
 error: (err) => this.mostrarError(err),
 });
 }
 }

 private finalizarGuardado(mensaje: string): void {
 this.guardando.set(false);
 this.modalAbierto.set(false);
 this.exitoMessage.set(mensaje);
 this.cargarUsuarios();
 setTimeout(() => this.exitoMessage.set(''), 3000);
 }

 private mostrarError(err: { error?: { detail?: string } }): void {
 this.guardando.set(false);
 this.errorMessage.set(
 err?.error?.detail || 'Ocurrió un error. Verifique los datos e intente nuevamente.'
 );
 }

 /** PATCH /usuarios/{id}/toggle-status — activa/inactiva directo en la tabla. */
 toggleEstado(usuario: UsuarioList): void {
 this.usuariosService.toggleStatusUsuario(usuario.id_usuario).subscribe({
 next: (resp) => {
 this.usuarios.update((lista) =>
 lista.map((u) => (u.id_usuario === resp.data.id_usuario ? resp.data : u))
 );
 this.exitoMessage.set(
 resp.data.estado
 ? `Usuario ${resp.data.nombre} activado.`
 : `Usuario ${resp.data.nombre} desactivado.`
 );
 setTimeout(() => this.exitoMessage.set(''), 3000);
 },
 error: (err) => this.mostrarError(err),
 });
 }

 // ------------------------------------------------------------ UI helpers
 onBusqueda(event: Event): void {
 this.busqueda.set((event.target as HTMLInputElement).value);
 }

 filtroActivo(filtro: FiltroEstado): boolean {
 return this.filtroEstado() === filtro;
 }
}
