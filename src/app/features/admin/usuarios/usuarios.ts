import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsuariosService } from './usuarios.service';
import {
  RolCatalogo,
  UsuarioCreatePayload,
  UsuarioList,
  UsuarioUpdatePayload,
} from '../../../core/models/usuario.model';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';

@Component({
  selector: 'app-usuarios',
  imports: [ReactiveFormsModule],
  templateUrl: './usuarios.html',
})
export class Usuarios implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usuariosService = inject(UsuariosService);

  // ------------------------------------------------------------------ estado
  usuarios = signal<UsuarioList[]>([]);
  roles = signal<RolCatalogo[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  busqueda = signal('');
  filtroEstado = signal<FiltroEstado>('todos');

  modalAbierto = signal(false);
  editandoId = signal<string | null>(null); // null = crear, id = editar

  // Filtrado reactivo: texto (nombre, correo, rol) + estado
  usuariosFiltrados = computed(() => {
    const term = this.busqueda().toLowerCase().trim();
    const filtro = this.filtroEstado();
    return this.usuarios().filter((u) => {
      const nombreCompleto = `${u.nombre} ${u.apellido ?? ''}`.toLowerCase();
      const coincideTexto =
        !term ||
        nombreCompleto.includes(term) ||
        u.correo.toLowerCase().includes(term) ||
        u.rol.nombre_rol.toLowerCase().includes(term);
      const coincideEstado =
        filtro === 'todos' ||
        (filtro === 'activos' && u.estado) ||
        (filtro === 'inactivos' && !u.estado);
      return coincideTexto && coincideEstado;
    });
  });

  // ------------------------------------------------------------- formulario
  // `rol` siempre guarda el id_rol; el payload de creación lo traduce a
  // nombre_rol (POST usa nombre, PUT usa id — contrato del backend).
  usuarioForm = this.fb.group({
    nombre: ['', Validators.required],
    apellido: [''],
    correo: ['', [Validators.required, Validators.email]],
    password: [''],
    rol: ['', Validators.required],
  });

  ngOnInit(): void {
    this.cargarUsuarios();
    this.usuariosService.getRoles().subscribe({
      next: (resp) => this.roles.set(resp.data),
      error: () => this.errorMessage.set('No se pudo cargar el catálogo de roles.'),
    });
  }

  cargarUsuarios(): void {
    this.cargando.set(true);
    this.usuariosService.getUsuarios().subscribe({
      next: (resp) => {
        this.usuarios.set(resp.data);
        this.cargando.set(false);
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
    this.usuarioForm.reset({ nombre: '', apellido: '', correo: '', password: '', rol: '' });
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

    const { nombre, apellido, correo, password, rol } = this.usuarioForm.value;
    const rolId = rol!;
    this.guardando.set(true);
    this.errorMessage.set('');

    if (this.editandoId()) {
      // Edición: PUT con campos parciales; password solo si se escribió
      const payload: UsuarioUpdatePayload = {
        nombre: nombre!,
        apellido: apellido || undefined,
        correo: correo!,
        rol_id: rolId,
      };
      if (password) payload.password = password;

      this.usuariosService.updateUsuario(this.editandoId()!, payload).subscribe({
        next: () => this.finalizarGuardado('Usuario actualizado correctamente.'),
        error: (err) => this.mostrarError(err),
      });
    } else {
      // Creación: POST requiere nombre_rol (no id)
      const rolObj = this.roles().find((r) => r.id_rol === rolId);
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
