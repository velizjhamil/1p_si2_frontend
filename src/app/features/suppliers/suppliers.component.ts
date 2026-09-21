import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProveedoresService } from './suppliers.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { Ciudad, Sucursal } from '../../core/models/sucursal.model';
import {
  EstadoProveedor,
  Proveedor,
  ProveedorCreatePayload,
  ProveedorUpdatePayload,
} from '../../core/models/proveedor.model';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import { AuthService } from '../../core/services/auth.service';
import { RbacService } from '../../core/services/rbac.service';
import { SucursalesService } from '../branches/branches.service';

type FiltroEstado = 'todos' | EstadoProveedor;

/**
 * CU23 — Gestión de Proveedores (ASU/GS).
 * KPI cards (activos/verificados/órdenes vigentes), buscador + filtros
 * server-side (categoría, estado, ciudad), tabla paginada con badges de
 * estado y modal registrar/editar. DELETE muestra la advertencia del
 * backend (409: productos asociados) como alerta de riesgo.
 */
@Component({
  selector: 'app-suppliers',
  imports: [ReactiveFormsModule, BadgeComponent, ConfirmDialogComponent],
  templateUrl: './suppliers.component.html',
})
export class SuppliersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly api = inject(ApiService);
  private readonly authService = inject(AuthService);
  private readonly rbacService = inject(RbacService);
  private readonly sucursalesService = inject(SucursalesService);

  // ------------------------------------------------------------------ estado
  proveedores = signal<Proveedor[]>([]);
  ciudades = signal<Ciudad[]>([]);
  sucursales = signal<Sucursal[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  readonly esAdmin = computed(() => this.rbacService.esAdmin());
  readonly esGerente = computed(() => this.rbacService.esGerente());
  readonly usuarioActual = computed(() => this.authService.usuario());
  readonly sucursalAsignadaNombre = computed(
    () => this.usuarioActual()?.sucursal_nombre ?? null,
  );

  // ConfirmDialog de eliminación (reemplaza window.confirm)
  confirmarEliminar = signal<Proveedor | null>(null);

  // Paginación server-side
  pagina = signal(1);
  total = signal(0);
  pages = signal(1);
  readonly limit = 10;

  // Filtros server-side
  busqueda = signal('');
  filtroCategoria = signal('');
  filtroEstado = signal<FiltroEstado>('todos');
  filtroCiudad = signal('');

  // KPI cards
  totalActivos = signal(0);
  totalVerificados = signal(0);

  modalAbierto = signal(false);
  editandoId = signal<number | null>(null); // null = crear, id = editar

  // ------------------------------------------------------------- formulario
  proveedorForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    nit_rut: ['', [Validators.required, Validators.minLength(5)]],
    contacto_operativo: [''],
    telefono: [''],
    correo: ['', Validators.email],
    categoria: [''],
    direccion: [''],
    sucursal_id: [null as number | null],
  });

  ngOnInit(): void {
    this.cargarProveedores();
    if (this.esAdmin()) {
      this.sucursalesService.listar().subscribe({
        next: (resp: Sucursal[]) => this.sucursales.set(resp),
        error: () => {},
      });
    }
    // Catálogo de ciudades para el filtro de ubicación
    this.api.get<ApiResponse<Ciudad[]>>('/ciudades').subscribe({
      next: (resp) => this.ciudades.set(resp.data),
      error: () => this.errorMessage.set('No se pudo cargar el catálogo de ciudades.'),
    });
  }

  cargarProveedores(): void {
    this.cargando.set(true);
    const estado = this.filtroEstado();
    this.proveedoresService
      .getProveedores({
        q: this.busqueda() || undefined,
        categoria: this.filtroCategoria() || undefined,
        estado: estado === 'todos' ? undefined : (estado as EstadoProveedor),
        ciudad: this.filtroCiudad() || undefined,
        page: this.pagina(),
        limit: this.limit,
      })
      .subscribe({
        next: (resp) => {
          this.proveedores.set(resp.data);
          this.total.set(resp.total);
          this.pages.set(resp.pages);
          // KPIs derivados del total (cuenta completa sin filtros de estado)
          this.proveedoresService
            .getProveedores({ estado: 'Activo', limit: 1 })
            .subscribe((r) => this.totalActivos.set(r.total));
          this.proveedoresService
            .getProveedores({ estado: 'Verificado', limit: 1 })
            .subscribe((r) => this.totalVerificados.set(r.total));
          this.cargando.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar la lista de proveedores.');
          this.cargando.set(false);
        },
      });
  }

  // ------------------------------------------------------------ UI helpers
  onBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
    this.pagina.set(1);
    this.cargarProveedores();
  }

  onFiltroCategoria(event: Event): void {
    this.filtroCategoria.set((event.target as HTMLSelectElement).value);
    this.pagina.set(1);
    this.cargarProveedores();
  }

  onFiltroEstado(estado: FiltroEstado): void {
    this.filtroEstado.set(estado);
    this.pagina.set(1);
    this.cargarProveedores();
  }

  onFiltroCiudad(event: Event): void {
    this.filtroCiudad.set((event.target as HTMLSelectElement).value);
    this.pagina.set(1);
    this.cargarProveedores();
  }

  paginaAnterior(): void {
    if (this.pagina() > 1) {
      this.pagina.update((p) => p - 1);
      this.cargarProveedores();
    }
  }

  paginaSiguiente(): void {
    if (this.pagina() < this.pages()) {
      this.pagina.update((p) => p + 1);
      this.cargarProveedores();
    }
  }

  // ------------------------------------------------------------------ modal
  abrirModalCrear(): void {
    this.editandoId.set(null);
    const sucursalDefecto = this.esGerente()
      ? (this.usuarioActual()?.id_sucursal ?? null)
      : null;
    this.proveedorForm.reset({
      nombre: '',
      nit_rut: '',
      contacto_operativo: '',
      telefono: '',
      correo: '',
      categoria: '',
      direccion: '',
      sucursal_id: sucursalDefecto,
    });
    this.errorMessage.set('');
    this.modalAbierto.set(true);
  }

  abrirModalEditar(proveedor: Proveedor): void {
    this.editandoId.set(proveedor.id_proveedor);
    this.proveedorForm.reset({
      nombre: proveedor.nombre,
      nit_rut: proveedor.nit_rut,
      contacto_operativo: proveedor.contacto_operativo ?? '',
      telefono: proveedor.telefono ?? '',
      correo: proveedor.correo ?? '',
      categoria: proveedor.categoria ?? '',
      direccion: proveedor.direccion ?? '',
      sucursal_id: proveedor.sucursal_id ?? null,
    });
    this.errorMessage.set('');
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.errorMessage.set('');
  }

  // ---------------------------------------------------------------- acciones
  guardar(): void {
    if (this.proveedorForm.invalid || this.guardando()) {
      this.errorMessage.set('Complete los campos obligatorios (*) correctamente.');
      return;
    }

    const {
      nombre,
      nit_rut,
      contacto_operativo,
      telefono,
      correo,
      categoria,
      direccion,
      sucursal_id,
    } = this.proveedorForm.value;
    this.guardando.set(true);
    this.errorMessage.set('');

    const sucursalFinal = this.esGerente()
      ? (this.usuarioActual()?.id_sucursal ?? null)
      : (sucursal_id ? Number(sucursal_id) : null);

    if (this.editandoId() !== null) {
      const payload: ProveedorUpdatePayload = {
        nombre: nombre!,
        nit_rut: nit_rut!,
        contacto_operativo: contacto_operativo || undefined,
        telefono: telefono || undefined,
        correo: correo || undefined,
        categoria: categoria || undefined,
        direccion: direccion || undefined,
        sucursal_id: sucursalFinal,
      };
      this.proveedoresService.updateProveedor(this.editandoId()!, payload).subscribe({
        next: () => this.finalizarGuardado('Proveedor actualizado correctamente.'),
        error: (err) => this.mostrarError(err),
      });
    } else {
      const payload: ProveedorCreatePayload = {
        nombre: nombre!,
        nit_rut: nit_rut!,
        contacto_operativo: contacto_operativo || undefined,
        telefono: telefono || undefined,
        correo: correo || undefined,
        categoria: categoria || undefined,
        direccion: direccion || undefined,
        sucursal_id: sucursalFinal,
      };
      this.proveedoresService.createProveedor(payload).subscribe({
        next: () => this.finalizarGuardado('Proveedor registrado correctamente.'),
        error: (err) => this.mostrarError(err),
      });
    }
  }

  /** Abre el ConfirmDialog de eliminación. */
  pedirEliminar(proveedor: Proveedor): void {
    this.confirmarEliminar.set(proveedor);
  }

  /**
   * DELETE físico. El backend responde 409 con la RESTRICCIÓN DE NEGOCIO
   * (productos asociados) — se muestra como alerta de advertencia sugiriendo
   * desactivar al proveedor en su lugar.
   */
  confirmarEliminacion(): void {
    const proveedor = this.confirmarEliminar();
    if (!proveedor) {
      return;
    }
    this.confirmarEliminar.set(null);
    this.proveedoresService.eliminarProveedor(proveedor.id_proveedor).subscribe({
      next: (resp) => {
        this.exitoMessage.set(resp.message || 'Proveedor eliminado correctamente.');
        this.cargarProveedores();
        setTimeout(() => this.exitoMessage.set(''), 4000);
      },
      error: (err) => this.mostrarError(err),
    });
  }

  /** PUT rápido: marca al proveedor como Inactivo (salida de la 409). */
  desactivar(proveedor: Proveedor): void {
    this.proveedoresService
      .updateProveedor(proveedor.id_proveedor, { estado: 'Inactivo' })
      .subscribe({
        next: () => {
          this.exitoMessage.set(`Proveedor "${proveedor.nombre}" marcado como Inactivo.`);
          this.cargarProveedores();
          setTimeout(() => this.exitoMessage.set(''), 4000);
        },
        error: (err) => this.mostrarError(err),
      });
  }

  private finalizarGuardado(mensaje: string): void {
    this.guardando.set(false);
    this.modalAbierto.set(false);
    this.exitoMessage.set(mensaje);
    this.cargarProveedores();
    setTimeout(() => this.exitoMessage.set(''), 3000);
  }

  private mostrarError(err: { error?: { detail?: string } }): void {
    this.guardando.set(false);
    this.errorMessage.set(
      err?.error?.detail ||
        'Ocurrió un error. Verifique los datos e intente nuevamente.'
    );
  }
}
