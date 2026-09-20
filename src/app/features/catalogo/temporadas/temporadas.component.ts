import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TemporadasService } from './temporadas.service';
import { BadgeComponent } from '../../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import {
  Coleccion,
  Temporada,
  TemporadaCreatePayload,
  TemporadaUpdatePayload,
} from '../../../core/models/temporada.model';

type FiltroVigencia = 'todas' | 'vigentes' | 'finalizadas';

/** Estado de la temporada derivado del rango de fechas contra hoy. */
type EstadoTemporada = 'vigente' | 'programada' | 'finalizada';

/** Validador cruzado del form: fecha_fin >= fecha_inicio (422 backend). */
function rangoFechasValido(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('fecha_inicio')?.value;
  const fin = group.get('fecha_fin')?.value;
  if (inicio && fin && fin < inicio) {
    return { rangoInvalido: true };
  }
  return null;
}

/** yyyy-MM-dd (ISO del input date) -> dd/mm/yyyy legible. */
function formatoFecha(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Hoy en ISO yyyy-MM-dd (referencia local del navegador). */
function hoyISO(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/**
 * CU24 — Gestión de Temporadas y Colecciones (Administrador super usuario, ASU).
 * Datatable paginado server-side de temporadas con búsqueda por nombre,
 * tabs de vigencia (Vigentes/Finalizadas), badges de estado derivados
 * (Vigente/Programada/Finalizada), modal registrar/editar temporada con
 * selector de colección y fechas, y modal de nueva colección. DELETE de
 * colección con temporadas asociadas responde 409 (restricción de negocio).
 */
@Component({
  selector: 'app-temporadas',
  imports: [ReactiveFormsModule, BadgeComponent, ConfirmDialogComponent],
  templateUrl: './temporadas.component.html',
})
export class TemporadasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly temporadasService = inject(TemporadasService);

  // ------------------------------------------------------------------ estado
  temporadas = signal<Temporada[]>([]);
  colecciones = signal<Coleccion[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  // Paginación server-side
  pagina = signal(1);
  total = signal(0);
  pages = signal(1);
  readonly limit = 10;

  // Filtros server-side
  busqueda = signal('');
  filtroVigencia = signal<FiltroVigencia>('todas');

  // Modal temporada
  modalTemporadaAbierto = signal(false);
  editandoTemporadaId = signal<number | null>(null); // null = crear, id = editar

  // Modal colección
  modalColeccionAbierto = signal(false);
  guardandoColeccion = signal(false);
  errorColeccion = signal('');

  // ConfirmDialog de eliminación
  confirmarEliminar = signal<Temporada | null>(null);

  // ------------------------------------------------------------- formularios
  temporadaForm = this.fb.group(
    {
      nombre_temporada: ['', [Validators.required, Validators.minLength(2)]],
      id_coleccion: [''], // '' = sin colección (temporada general)
      fecha_inicio: ['', Validators.required],
      fecha_fin: ['', Validators.required],
    },
    { validators: [rangoFechasValido] },
  );

  coleccionForm = this.fb.group({
    nombre_coleccion: ['', [Validators.required, Validators.minLength(2)]],
  });

  ngOnInit(): void {
    this.cargarTemporadas();
    this.cargarColecciones();
  }

  // ------------------------------------------------------------------ cargas
  cargarTemporadas(): void {
    this.cargando.set(true);
    const vigencia = this.filtroVigencia();
    this.temporadasService
      .getTemporadas({
        q: this.busqueda() || undefined,
        vigente:
          vigencia === 'todas'
            ? undefined
            : vigencia === 'vigentes'
              ? true
              : false,
        page: this.pagina(),
        limit: this.limit,
      })
      .subscribe({
        next: (resp) => {
          this.temporadas.set(resp.data);
          this.total.set(resp.total);
          this.pages.set(resp.pages);
          this.cargando.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar la lista de temporadas.');
          this.cargando.set(false);
        },
      });
  }

  /** Dropdown del modal de temporadas (lista completa de colecciones). */
  private cargarColecciones(): void {
    this.temporadasService.getColecciones().subscribe({
      next: (resp) => this.colecciones.set(resp.data ?? []),
      error: () => this.colecciones.set([]),
    });
  }

  // -------------------------------------------------------------- UI helpers
  onBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
    this.pagina.set(1);
    this.cargarTemporadas();
  }

  onFiltroVigencia(filtro: FiltroVigencia): void {
    this.filtroVigencia.set(filtro);
    this.pagina.set(1);
    this.cargarTemporadas();
  }

  paginaAnterior(): void {
    if (this.pagina() > 1) {
      this.pagina.update((p) => p - 1);
      this.cargarTemporadas();
    }
  }

  paginaSiguiente(): void {
    if (this.pagina() < this.pages()) {
      this.pagina.update((p) => p + 1);
      this.cargarTemporadas();
    }
  }

  /** Fecha ISO -> dd/mm/yyyy para la tabla. */
  protected fecha(iso: string): string {
    return formatoFecha(iso);
  }

  /** Estado derivado: Vigente | Programada | Finalizada (contra hoy). */
  protected estado(t: Temporada): EstadoTemporada {
    const hoy = hoyISO();
    if (t.fecha_inicio > hoy) return 'programada';
    return t.vigente ? 'vigente' : 'finalizada';
  }

  protected badgeEstado(t: Temporada): 'success' | 'info' | 'neutral' {
    switch (this.estado(t)) {
      case 'vigente':
        return 'success';
      case 'programada':
        return 'info';
      default:
        return 'neutral';
    }
  }

  protected textoEstado(t: Temporada): string {
    switch (this.estado(t)) {
      case 'vigente':
        return 'Vigente';
      case 'programada':
        return 'Programada';
      default:
        return 'Finalizada';
    }
  }

  // -------------------------------------------------------- modal temporada
  abrirModalCrear(): void {
    this.editandoTemporadaId.set(null);
    this.temporadaForm.reset({
      nombre_temporada: '',
      id_coleccion: '',
      fecha_inicio: '',
      fecha_fin: '',
    });
    this.errorMessage.set('');
    this.modalTemporadaAbierto.set(true);
  }

  abrirModalEditar(temporada: Temporada): void {
    this.editandoTemporadaId.set(temporada.id_temporada);
    this.temporadaForm.reset({
      nombre_temporada: temporada.nombre_temporada,
      id_coleccion:
        temporada.id_coleccion !== null ? String(temporada.id_coleccion) : '',
      fecha_inicio: temporada.fecha_inicio,
      fecha_fin: temporada.fecha_fin,
    });
    this.errorMessage.set('');
    this.modalTemporadaAbierto.set(true);
  }

  cerrarModalTemporada(): void {
    this.modalTemporadaAbierto.set(false);
    this.errorMessage.set('');
  }

  // -------------------------------------------------------- modal colección
  abrirModalColeccion(): void {
    this.coleccionForm.reset({ nombre_coleccion: '' });
    this.errorColeccion.set('');
    this.modalColeccionAbierto.set(true);
  }

  cerrarModalColeccion(): void {
    this.modalColeccionAbierto.set(false);
    this.errorColeccion.set('');
  }

  /** Registra la colección y refresca el dropdown del modal de temporadas. */
  guardarColeccion(): void {
    if (this.coleccionForm.invalid || this.guardandoColeccion()) {
      this.errorColeccion.set('Ingrese un nombre de colección válido (mín. 2 caracteres).');
      return;
    }
    const nombre = this.coleccionForm.value.nombre_coleccion!;
    this.guardandoColeccion.set(true);
    this.errorColeccion.set('');

    this.temporadasService.createColeccion({ nombre_coleccion: nombre }).subscribe({
      next: () => {
        this.guardandoColeccion.set(false);
        this.modalColeccionAbierto.set(false);
        this.exitoMessage.set(`Colección "${nombre}" registrada correctamente.`);
        this.cargarColecciones(); // dropdown actualizado en tiempo real
        setTimeout(() => this.exitoMessage.set(''), 4000);
      },
      error: (err) => {
        this.guardandoColeccion.set(false);
        this.errorColeccion.set(
          err?.error?.detail ||
            'Ocurrió un error al registrar la colección. Intente nuevamente.',
        );
      },
    });
  }

  // --------------------------------------------------------------- acciones
  guardarTemporada(): void {
    if (this.temporadaForm.invalid || this.guardando()) {
      const errors: string[] = [];
      if (this.temporadaForm.hasError('rangoInvalido')) {
        errors.push('La fecha de fin no puede ser anterior a la fecha de inicio.');
      } else {
        errors.push('Complete los campos obligatorios (*) correctamente.');
      }
      this.errorMessage.set(errors.join(' '));
      return;
    }

    const form = this.temporadaForm.value;
    const idColeccion = form.id_coleccion ? Number(form.id_coleccion) : null;

    this.guardando.set(true);
    this.errorMessage.set('');

    if (this.editandoTemporadaId() !== null) {
      const payload: TemporadaUpdatePayload = {
        nombre_temporada: form.nombre_temporada!,
        id_coleccion: idColeccion,
        fecha_inicio: form.fecha_inicio!,
        fecha_fin: form.fecha_fin!,
      };
      this.temporadasService
        .updateTemporada(this.editandoTemporadaId()!, payload)
        .subscribe({
          next: () =>
            this.finalizarGuardado('Temporada actualizada correctamente.'),
          error: (err) => this.mostrarError(err),
        });
    } else {
      const payload: TemporadaCreatePayload = {
        nombre_temporada: form.nombre_temporada!,
        id_coleccion: idColeccion,
        fecha_inicio: form.fecha_inicio!,
        fecha_fin: form.fecha_fin!,
      };
      this.temporadasService.createTemporada(payload).subscribe({
        next: () => this.finalizarGuardado('Temporada registrada correctamente.'),
        error: (err) => this.mostrarError(err),
      });
    }
  }

  /** Abre el ConfirmDialog de eliminación de temporada. */
  pedirEliminar(temporada: Temporada): void {
    this.confirmarEliminar.set(temporada);
  }

  confirmarEliminacion(): void {
    const temporada = this.confirmarEliminar();
    if (!temporada) {
      return;
    }
    this.confirmarEliminar.set(null);
    this.temporadasService.eliminarTemporada(temporada.id_temporada).subscribe({
      next: (resp) => {
        this.exitoMessage.set(resp.message || 'Temporada eliminada correctamente.');
        this.cargarTemporadas();
        setTimeout(() => this.exitoMessage.set(''), 4000);
      },
      error: (err) => this.mostrarError(err),
    });
  }

  private finalizarGuardado(mensaje: string): void {
    this.guardando.set(false);
    this.modalTemporadaAbierto.set(false);
    this.exitoMessage.set(mensaje);
    this.cargarTemporadas();
    setTimeout(() => this.exitoMessage.set(''), 3000);
  }

  private mostrarError(err: { error?: { detail?: string } }): void {
    this.guardando.set(false);
    this.errorMessage.set(
      err?.error?.detail ||
        'Ocurrió un error. Verifique los datos e intente nuevamente.',
    );
  }
}
