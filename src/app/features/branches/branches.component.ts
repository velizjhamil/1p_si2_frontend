import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SucursalesService } from './branches.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import {
  CandidatoGerente,
  Ciudad,
  Sucursal,
  SucursalCreatePayload,
  SucursalUpdatePayload,
} from '../../core/models/sucursal.model';
import { UsuarioList } from '../../core/models/usuario.model';

/**
 * CU17 — Gestión de Sucursales (ASU/GS).
 * Tarjetas agrupadas por ciudad, asignación de Gerente Titular (1 a 1),
 * conteo e inspección de personal, y alta/edición de sucursales.
 */
@Component({
  selector: 'app-branches',
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './branches.component.html',
})
export class BranchesComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly sucursalesService = inject(SucursalesService);

  // ------------------------------------------------------------------ estado
  sucursales = signal<Sucursal[]>([]);
  ciudades = signal<Ciudad[]>([]);
  candidatosGerentes = signal<CandidatoGerente[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  busqueda = signal('');
  /** 'todas' | id de ciudad como string (para el select del filtro). */
  filtroCiudad = signal<string>('todas');

  modalAbierto = signal(false);
  editandoCodigo = signal<number | null>(null); // null = crear, código = editar

  // Modal para ver personal de la sucursal
  modalPersonal = signal<{ sucursal: Sucursal; personal: UsuarioList[] } | null>(null);
  cargandoPersonal = signal(false);

  // ConfirmDialog de desactivación (reemplaza window.confirm)
  confirmarDesactivar = signal<Sucursal | null>(null);

  /** Sucursales tras búsqueda + filtro por ciudad. */
  sucursalesFiltradas = computed(() => {
    const term = this.busqueda().toLowerCase().trim();
    const filtro = this.filtroCiudad();
    return this.sucursales().filter((s) => {
      const coincideTexto =
        !term ||
        s.nombre.toLowerCase().includes(term) ||
        (s.direccion ?? '').toLowerCase().includes(term) ||
        s.ciudad.nombre.toLowerCase().includes(term) ||
        (s.gerente?.nombre ?? '').toLowerCase().includes(term);
      const coincideCiudad =
        filtro === 'todas' || String(s.ciudad.id) === filtro;
      return coincideTexto && coincideCiudad;
    });
  });

  /** Agrupación por ciudad para render: [{ciudad, sucursales}]. */
  gruposPorCiudad = computed(() => {
    const grupos: { ciudad: Ciudad; sucursales: Sucursal[] }[] = [];
    for (const s of this.sucursalesFiltradas()) {
      const existing = grupos.find((g) => g.ciudad.id === s.ciudad.id);
      if (existing) {
        existing.sucursales.push(s);
      } else {
        grupos.push({ ciudad: s.ciudad, sucursales: [s] });
      }
    }
    return grupos;
  });

  /** Ciudades con al menos una sucursal (opciones del filtro). */
  ciudadesConSucursales = computed(() => {
    const ids = new Set(this.sucursales().map((s) => s.ciudad.id));
    return this.ciudades().filter((c) => ids.has(c.id));
  });

  /** Candidatos disponibles para el modal actual (disponibles o asignados a la sucursal editada). */
  candidatosParaModal = computed(() => {
    const editCodigo = this.editandoCodigo();
    return this.candidatosGerentes().filter(
      (c) => c.disponible || (editCodigo !== null && c.sucursal_asignada_codigo === editCodigo)
    );
  });

  // ------------------------------------------------------------- formulario
  sucursalForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    id_ciudad: ['', Validators.required],
    direccion: [''],
    telefono: [''],
    horario_atencion: [''],
    id_gerente: [''],
  });

  ngOnInit(): void {
    this.cargarSucursales();
    this.cargarCandidatos();
    this.sucursalesService.getCiudades().subscribe({
      next: (resp) => this.ciudades.set(resp.data),
      error: () => this.errorMessage.set('No se pudo cargar el catálogo de ciudades.'),
    });
  }

  cargarSucursales(): void {
    this.cargando.set(true);
    this.sucursalesService.getSucursales().subscribe({
      next: (resp) => {
        this.sucursales.set(resp.data);
        this.cargando.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la lista de sucursales.');
        this.cargando.set(false);
      },
    });
  }

  cargarCandidatos(): void {
    this.sucursalesService.getCandidatosGerente().subscribe({
      next: (resp) => this.candidatosGerentes.set(resp.data),
      error: () => console.error('No se pudo cargar candidatos a gerente'),
    });
  }

  // ------------------------------------------------------------------ modal
  abrirModalCrear(): void {
    this.editandoCodigo.set(null);
    this.cargarCandidatos();
    this.sucursalForm.reset({
      nombre: '',
      id_ciudad: '',
      direccion: '',
      telefono: '',
      horario_atencion: '',
      id_gerente: '',
    });
    this.errorMessage.set('');
    this.modalAbierto.set(true);
  }

  abrirModalEditar(sucursal: Sucursal): void {
    this.editandoCodigo.set(sucursal.codigo_sucursal);
    this.cargarCandidatos();
    this.sucursalForm.reset({
      nombre: sucursal.nombre,
      id_ciudad: String(sucursal.ciudad.id),
      direccion: sucursal.direccion ?? '',
      telefono: sucursal.telefono ?? '',
      horario_atencion: sucursal.horario_atencion ?? '',
      id_gerente: sucursal.id_gerente ?? '',
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
    if (this.sucursalForm.invalid || this.guardando()) {
      this.errorMessage.set('Complete los campos obligatorios (*) correctamente.');
      return;
    }

    const { nombre, id_ciudad, direccion, telefono, horario_atencion, id_gerente } =
      this.sucursalForm.value;
    this.guardando.set(true);
    this.errorMessage.set('');

    const idGerenteLimpio = id_gerente ? id_gerente : null;

    if (this.editandoCodigo() !== null) {
      // Edición: PUT parcial (incluyendo gerente titular)
      const payload: SucursalUpdatePayload = {
        nombre: nombre!,
        id_ciudad: Number(id_ciudad),
        direccion: direccion || undefined,
        telefono: telefono || undefined,
        horario_atencion: horario_atencion || undefined,
        id_gerente: idGerenteLimpio,
      };
      this.sucursalesService
        .updateSucursal(this.editandoCodigo()!, payload)
        .subscribe({
          next: () => this.finalizarGuardado('Sucursal actualizada correctamente.'),
          error: (err) => this.mostrarError(err),
        });
    } else {
      // Creación: POST con ciudad y gerente asignados
      const payload: SucursalCreatePayload = {
        nombre: nombre!,
        id_ciudad: Number(id_ciudad),
        direccion: direccion || undefined,
        telefono: telefono || undefined,
        horario_atencion: horario_atencion || undefined,
        id_gerente: idGerenteLimpio,
      };
      this.sucursalesService.createSucursal(payload).subscribe({
        next: () => this.finalizarGuardado('Sucursal creada correctamente.'),
        error: (err) => this.mostrarError(err),
      });
    }
  }

  verPersonal(sucursal: Sucursal): void {
    this.cargandoPersonal.set(true);
    this.modalPersonal.set({ sucursal, personal: [] });
    this.sucursalesService.getPersonalSucursal(sucursal.codigo_sucursal).subscribe({
      next: (resp) => {
        this.modalPersonal.set({ sucursal, personal: resp.data });
        this.cargandoPersonal.set(false);
      },
      error: () => {
        this.cargandoPersonal.set(false);
      },
    });
  }

  cerrarModalPersonal(): void {
    this.modalPersonal.set(null);
  }

  /** Abre el ConfirmDialog de desactivación (soft delete). */
  pedirDesactivar(sucursal: Sucursal): void {
    this.confirmarDesactivar.set(sucursal);
  }

  /** DELETE = soft delete. El backend responde 409 si hay dependencias. */
  confirmarDesactivacion(): void {
    const sucursal = this.confirmarDesactivar();
    if (!sucursal) {
      return;
    }
    this.confirmarDesactivar.set(null);
    this.sucursalesService.desactivarSucursal(sucursal.codigo_sucursal).subscribe({
      next: (resp) => {
        this.sucursales.update((lista) =>
          lista.map((s) =>
            s.codigo_sucursal === resp.data.codigo_sucursal ? resp.data : s
          )
        );
        this.exitoMessage.set(`Sucursal "${resp.data.nombre}" desactivada.`);
        setTimeout(() => this.exitoMessage.set(''), 3000);
      },
      // 409 con detail: "reservas o inventario activo" o "ya está desactivada"
      error: (err) => this.mostrarError(err),
    });
  }

  private finalizarGuardado(mensaje: string): void {
    this.guardando.set(false);
    this.modalAbierto.set(false);
    this.exitoMessage.set(mensaje);
    this.cargarSucursales();
    setTimeout(() => this.exitoMessage.set(''), 3000);
  }

  private mostrarError(err: { error?: { detail?: string } }): void {
    this.guardando.set(false);
    this.errorMessage.set(
      err?.error?.detail ||
        'Ocurrió un error. Verifique los datos e intente nuevamente.'
    );
  }

  // ------------------------------------------------------------ UI helpers
  onBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
  }

  onFiltroCiudad(event: Event): void {
    this.filtroCiudad.set((event.target as HTMLSelectElement).value);
  }
}
