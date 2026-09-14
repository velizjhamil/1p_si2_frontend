import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RolesPermisosService } from './roles-permisos.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import {
  PermisoRead,
  RolCatalogo,
  RolCreatePayload,
} from '../../core/models/usuario.model';

type TabActiva = 'roles' | 'matriz';

@Component({
  selector: 'app-roles-permisos',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './roles-permisos.component.html',
})
export class RolesPermisos implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(RolesPermisosService);

  // ------------------------------------------------------------------ estado
  roles = signal<RolCatalogo[]>([]);
  permisosPorModulo = signal<Record<string, PermisoRead[]>>({});
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  tabActiva = signal<TabActiva>('roles');

  // Rol seleccionado en la matriz de permisos
  rolSeleccionadoId = signal<string | null>(null);

  // IDs de permisos marcados en la matriz (estado de trabajo del selector)
  permisosSeleccionados = signal<Set<number>>(new Set());

  modalRolAbierto = signal(false);
  rolEnEdicion = signal<RolCatalogo | null>(null);
  rolAEliminar = signal<RolCatalogo | null>(null);

  rolSeleccionado = computed<RolCatalogo | null>(() => {
    const id = this.rolSeleccionadoId();
    if (!id) return null;
    return this.roles().find((r) => r.id_rol === id) ?? null;
  });

  modulos = computed<string[]>(() => Object.keys(this.permisosPorModulo()));

  rolForm = this.fb.group({
    nombre_rol: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);
    this.service.getRoles().subscribe({
      next: (resp) => {
        this.roles.set(resp.data);
        this.cargando.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la lista de roles.');
        this.cargando.set(false);
      },
    });
    this.service.getPermisosPorModulo().subscribe({
      next: (resp) => this.permisosPorModulo.set(resp.data),
      error: () => this.errorMessage.set('No se pudo cargar el catálogo de permisos.'),
    });
  }

  // ------------------------------------------------------------------- tabs
  cambiarTab(tab: TabActiva): void {
    this.tabActiva.set(tab);
    this.errorMessage.set('');
  }

  tabActivaEs(tab: TabActiva): boolean {
    return this.tabActiva() === tab;
  }

  // ------------------------------------------------------------- tab roles
  abrirModalCrearRol(): void {
    this.rolEnEdicion.set(null);
    this.rolForm.reset({ nombre_rol: '', descripcion: '' });
    this.errorMessage.set('');
    this.modalRolAbierto.set(true);
  }

  abrirModalEditarRol(rol: RolCatalogo): void {
    this.rolEnEdicion.set(rol);
    this.rolForm.reset({
      nombre_rol: rol.nombre_rol,
      descripcion: rol.descripcion || '',
    });
    this.errorMessage.set('');
    this.modalRolAbierto.set(true);
  }

  cerrarModalRol(): void {
    this.modalRolAbierto.set(false);
    this.rolEnEdicion.set(null);
    this.errorMessage.set('');
  }

  guardarRol(): void {
    if (this.rolForm.invalid || this.guardando()) {
      this.errorMessage.set('Complete el nombre del rol (mínimo 2 caracteres).');
      return;
    }
    const { nombre_rol, descripcion } = this.rolForm.value;
    const rolActual = this.rolEnEdicion();

    this.guardando.set(true);
    this.errorMessage.set('');

    if (rolActual) {
      // Edición de rol existente
      this.service
        .updateRol(rolActual.id_rol, {
          nombre_rol: nombre_rol!,
          descripcion: descripcion || undefined,
        })
        .subscribe({
          next: (resp) => {
            this.guardando.set(false);
            this.modalRolAbierto.set(false);
            this.rolEnEdicion.set(null);
            this.exitoMessage.set(`Rol '${resp.data.nombre_rol}' actualizado correctamente.`);
            setTimeout(() => this.exitoMessage.set(''), 3000);
            this.service.getRoles().subscribe({
              next: (r) => this.roles.set(r.data),
            });
          },
          error: (err) => this.mostrarError(err),
        });
    } else {
      // Creación de nuevo rol
      const payload: RolCreatePayload = {
        nombre_rol: nombre_rol!,
        descripcion: descripcion || undefined,
        permiso_ids: [], // se asignan luego desde la matriz
      };
      this.service.createRol(payload).subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalRolAbierto.set(false);
          this.exitoMessage.set('Rol creado. Asigne permisos desde la matriz.');
          setTimeout(() => this.exitoMessage.set(''), 3000);
          this.service.getRoles().subscribe({
            next: (resp) => this.roles.set(resp.data),
          });
        },
        error: (err) => this.mostrarError(err),
      });
    }
  }

  // ---------------------------------------------------- eliminación y protección
  esRolProtegido(rol: RolCatalogo | null | undefined): boolean {
    if (!rol) return false;
    const nombre = rol.nombre_rol.toUpperCase().trim();
    return ['ASU', 'ADMIN', 'ADMINISTRADOR'].includes(nombre);
  }

  iniciarEliminarRol(rol: RolCatalogo): void {
    if (this.esRolProtegido(rol)) {
      this.errorMessage.set(
        `No se puede eliminar el rol esencial del sistema '${rol.nombre_rol}'.`
      );
      setTimeout(() => this.errorMessage.set(''), 4000);
      return;
    }
    this.errorMessage.set('');
    this.rolAEliminar.set(rol);
  }

  cancelarEliminarRol(): void {
    this.rolAEliminar.set(null);
  }

  confirmarEliminarRol(): void {
    const rol = this.rolAEliminar();
    if (!rol) return;

    if (this.esRolProtegido(rol)) {
      this.errorMessage.set(
        `No se puede eliminar el rol esencial del sistema '${rol.nombre_rol}'.`
      );
      this.rolAEliminar.set(null);
      return;
    }

    this.guardando.set(true);
    this.service.deleteRol(rol.id_rol).subscribe({
      next: () => {
        this.guardando.set(false);
        this.rolAEliminar.set(null);
        this.exitoMessage.set(`Rol '${rol.nombre_rol}' eliminado correctamente.`);
        setTimeout(() => this.exitoMessage.set(''), 3000);
        this.roles.update((lista) => lista.filter((r) => r.id_rol !== rol.id_rol));
      },
      error: (err) => {
        this.rolAEliminar.set(null);
        this.mostrarError(err);
      },
    });
  }

  verPermisosDelRol(rol: RolCatalogo): void {
    // Salta a la matriz con el rol cargado (ver asignados y editar)
    this.rolSeleccionadoId.set(rol.id_rol);
    this.permisosSeleccionados.set(new Set(rol.permisos.map((p) => p.id)));
    this.tabActiva.set('matriz');
  }

  // ------------------------------------------------------------ tab matriz
  onSeleccionarRol(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.rolSeleccionadoId.set(id || null);
    const rol = this.roles().find((r) => r.id_rol === id);
    this.permisosSeleccionados.set(
      new Set(rol?.permisos.map((p) => p.id) ?? [])
    );
    this.errorMessage.set('');
  }

  togglePermiso(idPermiso: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.permisosSeleccionados.update((set) => {
      const nuevo = new Set(set);
      checked ? nuevo.add(idPermiso) : nuevo.delete(idPermiso);
      return nuevo;
    });
  }

  permisoMarcado(idPermiso: number): boolean {
    return this.permisosSeleccionados().has(idPermiso);
  }

  moduloCompleto(permisos: PermisoRead[]): boolean {
    return permisos.every((p) => this.permisosSeleccionados().has(p.id));
  }

  toggleModulo(permisos: PermisoRead[], event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.permisosSeleccionados.update((set) => {
      const nuevo = new Set(set);
      permisos.forEach((p) => (checked ? nuevo.add(p.id) : nuevo.delete(p.id)));
      return nuevo;
    });
  }

  guardarMatriz(): void {
    const rol = this.rolSeleccionado();
    if (!rol || this.guardando()) {
      this.errorMessage.set('Seleccione un rol antes de guardar.');
      return;
    }
    this.guardando.set(true);
    this.errorMessage.set('');
    this.service
      .updateRolPermisos(rol.id_rol, {
        permiso_ids: [...this.permisosSeleccionados()],
      })
      .subscribe({
        next: (resp) => {
          this.guardando.set(false);
          // Actualiza el rol en la lista local con la respuesta del backend
          this.roles.update((lista) =>
            lista.map((r) => (r.id_rol === resp.data.id_rol ? resp.data : r))
          );
          this.exitoMessage.set(
            `Permisos de '${resp.data.nombre_rol}' actualizados (${resp.data.permisos.length}).`
          );
          setTimeout(() => this.exitoMessage.set(''), 3000);
        },
        error: (err) => this.mostrarError(err),
      });
  }

  // ---------------------------------------------------------------- común
  private mostrarError(err: { error?: { detail?: string } }): void {
    this.guardando.set(false);
    this.errorMessage.set(
      err?.error?.detail || 'Ocurrió un error. Verifique los datos e intente nuevamente.'
    );
  }
}
