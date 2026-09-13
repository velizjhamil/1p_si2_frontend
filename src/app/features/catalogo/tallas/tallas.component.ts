import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { BadgeComponent } from '../../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import {
  ColorPayload,
  ColorVariante,
  PestaniaCU7,
  Talla,
  TallaPayload,
  TallasService,
} from './tallas.service';

/** Ítem genérico que alimenta el ConfirmDialog (talla o color). */
interface ItemConfirmar {
  tipo: PestaniaCU7;
  id: number;
  nombre: string;
}

/**
 * CU7 — Gestión de Tallas y Colores (ASU/GS).
 * Vista con dos pestañas (Tallas | Colores) sobre un mock service en
 * memoria: datatable con acciones Editar/Eliminar, modal "+ Nueva Talla"
 * y "+ Nuevo Color" (con vista previa del color), y ConfirmDialog para
 * eliminación. La paleta es la de Attention (primary, accent, container).
 */
@Component({
  selector: 'app-tallas',
  imports: [ReactiveFormsModule, BadgeComponent, ConfirmDialogComponent],
  templateUrl: './tallas.component.html',
})
export class TallasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tallasService = inject(TallasService);

  // ------------------------------------------------------------------ estado
  pestania = signal<PestaniaCU7>('tallas');
  tallas = signal<Talla[]>([]);
  colores = signal<ColorVariante[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  modalAbierto = signal(false);
  editandoId = signal<number | null>(null); // null = crear, id = editar

  // ConfirmDialog de eliminación (talla o color)
  confirmarEliminar = signal<ItemConfirmar | null>(null);

  // ------------------------------------------------------------- formularios
  tallaForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(1)]],
    descripcion: [''],
  });

  colorForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    hex: ['#1d528d', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    descripcion: [''],
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  /** Carga ambos catálogos del mock service en paralelo. */
  cargarDatos(): void {
    this.cargando.set(true);
    this.tallasService.getTallas().subscribe({
      next: (tallas) => {
        this.tallas.set(tallas);
        this.tallasService.getColores().subscribe({
          next: (colores) => {
            this.colores.set(colores);
            this.cargando.set(false);
          },
          error: () => {
            this.errorMessage.set('No se pudo cargar la lista de colores.');
            this.cargando.set(false);
          },
        });
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar la lista de tallas.');
        this.cargando.set(false);
      },
    });
  }

  // ------------------------------------------------------------ UI helpers
  /** Cambia de pestaña y limpia mensajes de la pestaña anterior. */
  cambiarPestania(pestania: PestaniaCU7): void {
    if (this.pestania() === pestania) return;
    this.pestania.set(pestania);
    this.errorMessage.set('');
  }

  /** Hex del preview del modal color (fallback al primario Attention). */
  previewHex(): string {
    return this.colorForm.value.hex || '#1d528d';
  }

  // ------------------------------------------------------------------ modal
  abrirModalCrear(): void {
    this.editandoId.set(null);
    this.errorMessage.set('');
    if (this.pestania() === 'tallas') {
      this.tallaForm.reset({ nombre: '', descripcion: '' });
    } else {
      this.colorForm.reset({ nombre: '', hex: '#1d528d', descripcion: '' });
    }
    this.modalAbierto.set(true);
  }

  abrirModalEditarTalla(talla: Talla): void {
    this.pestania.set('tallas');
    this.editandoId.set(talla.id);
    this.errorMessage.set('');
    this.tallaForm.reset({
      nombre: talla.nombre,
      descripcion: talla.descripcion ?? '',
    });
    this.modalAbierto.set(true);
  }

  abrirModalEditarColor(color: ColorVariante): void {
    this.pestania.set('colores');
    this.editandoId.set(color.id);
    this.errorMessage.set('');
    this.colorForm.reset({
      nombre: color.nombre,
      hex: color.hex,
      descripcion: color.descripcion ?? '',
    });
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.errorMessage.set('');
  }

  // ---------------------------------------------------------------- acciones
  /** Save dispatcher: valida y delega según la pestaña activa. */
  guardar(): void {
    if (this.guardando()) return;

    if (this.pestania() === 'tallas') {
      if (this.tallaForm.invalid) {
        this.errorMessage.set('Ingrese el nombre de la talla (obligatorio *).');
        return;
      }
      const payload: TallaPayload = {
        nombre: this.tallaForm.value.nombre!.trim(),
        descripcion: this.tallaForm.value.descripcion?.trim() || undefined,
      };
      this.guardando.set(true);
      if (this.editandoId() !== null) {
        this.tallasService
          .actualizarTalla(this.editandoId()!, payload)
          .subscribe({
            next: () => this.finalizarGuardado('Talla actualizada correctamente.'),
            error: (err) => this.mostrarError(err),
          });
      } else {
        this.tallasService.crearTalla(payload).subscribe({
          next: () => this.finalizarGuardado('Talla registrada correctamente.'),
          error: (err) => this.mostrarError(err),
        });
      }
    } else {
      if (this.colorForm.invalid) {
        this.errorMessage.set(
          'Complete nombre (mín. 2 caracteres) y un código hexadecimal válido (#RRGGBB).'
        );
        return;
      }
      const payload: ColorPayload = {
        nombre: this.colorForm.value.nombre!.trim(),
        hex: this.colorForm.value.hex ?? undefined,
        descripcion: this.colorForm.value.descripcion?.trim() || undefined,
      };
      this.guardando.set(true);
      if (this.editandoId() !== null) {
        this.tallasService
          .actualizarColor(this.editandoId()!, payload)
          .subscribe({
            next: () => this.finalizarGuardado('Color actualizado correctamente.'),
            error: (err) => this.mostrarError(err),
          });
      } else {
        this.tallasService.crearColor(payload).subscribe({
          next: () => this.finalizarGuardado('Color registrado correctamente.'),
          error: (err) => this.mostrarError(err),
        });
      }
    }
  }

  /** Abre el ConfirmDialog de eliminación (talla o color). */
  pedirEliminar(item: ItemConfirmar): void {
    this.confirmarEliminar.set(item);
  }

  /** DELETE confirmado: elimina según el tipo del ítem. */
  confirmarEliminacion(): void {
    const item = this.confirmarEliminar();
    if (!item) return;
    this.confirmarEliminar.set(null);

    if (item.tipo === 'tallas') {
      this.tallasService.eliminarTalla(item.id).subscribe({
        next: () => {
          this.exitoMessage.set(`Talla "${item.nombre}" eliminada.`);
          this.cargarDatos();
          setTimeout(() => this.exitoMessage.set(''), 3000);
        },
        error: (err) => this.mostrarError(err),
      });
    } else {
      this.tallasService.eliminarColor(item.id).subscribe({
        next: () => {
          this.exitoMessage.set(`Color "${item.nombre}" eliminado.`);
          this.cargarDatos();
          setTimeout(() => this.exitoMessage.set(''), 3000);
        },
        error: (err) => this.mostrarError(err),
      });
    }
  }

  private finalizarGuardado(mensaje: string): void {
    this.guardando.set(false);
    this.modalAbierto.set(false);
    this.exitoMessage.set(mensaje);
    this.cargarDatos();
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
