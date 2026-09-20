import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { mensajeErrorEnvio } from '../envios/envios.service';
import { AgenciasService } from './agencias.service';
import {
  Agencia,
  AgenciaCreatePayload,
  AgenciaUpdatePayload,
} from '../../core/models/agencia.model';

/** Resultado de guardar: la agencia devuelta por el backend + mensaje para el banner. */
export interface AgenciaGuardada {
  agencia: Agencia;
  mensaje: string;
}

/** Quita espacios, guiones, puntos y barras (misma normalización del backend). */
function normalizarNit(nit: string): string {
  return (nit ?? '').replace(/[\s.\-/]/g, '');
}

/**
 * CU19 — Modal de alta/edición de una agencia de reparto (ASU/GS).
 *
 * Datos de facturación obligatorios: NIT, razón social, correo de facturación y
 * dirección fiscal. La validación del cliente es solo de forma; el backend
 * valida NIT (dígitos, 5–20), correo y unicidad de NIT/razón social (409) y
 * NO consulta al SIN: un NIT aceptado no está verificado fiscalmente.
 *
 * Al editar solo se envían los campos que cambiaron (el backend trata lo
 * ausente como "no cambiar"; por eso un campo opcional vaciado no se borra).
 */
@Component({
  selector: 'app-agencia-form',
  imports: [ReactiveFormsModule],
  templateUrl: './agencia-form.component.html',
})
export class AgenciaFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(AgenciasService);

  /** null = crear; una agencia = editar. */
  readonly agencia = input<Agencia | null>(null);
  readonly guardado = output<AgenciaGuardada>();
  readonly cancelado = output<void>();

  guardando = signal(false);
  errorMessage = signal('');

  form = this.fb.nonNullable.group({
    razon_social: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    nit: ['', [Validators.required, Validators.pattern(/^[0-9.\-/\s]+$/), Validators.maxLength(30)]],
    correo_facturacion: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    direccion_fiscal: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(255)]],
    contacto_operativo: ['', Validators.maxLength(150)],
    telefono: ['', Validators.maxLength(30)],
    correo: ['', [Validators.email, Validators.maxLength(150)]],
    direccion: ['', Validators.maxLength(255)],
  });

  constructor() {
    effect(() => {
      const a = this.agencia();
      untracked(() => {
        this.errorMessage.set('');
        this.form.reset({
          razon_social: a?.razon_social ?? '',
          nit: a?.nit ?? '',
          correo_facturacion: a?.correo_facturacion ?? '',
          direccion_fiscal: a?.direccion_fiscal ?? '',
          contacto_operativo: a?.contacto_operativo ?? '',
          telefono: a?.telefono ?? '',
          correo: a?.correo ?? '',
          direccion: a?.direccion ?? '',
        });
      });
    });
  }

  protected get editando(): boolean {
    return this.agencia() !== null;
  }

  /** Muestra el error de un campo solo si ya fue tocado. */
  protected invalido(campo: string): boolean {
    const c = this.form.get(campo);
    return !!c && c.invalid && (c.touched || c.dirty);
  }

  /** Campos que cambiaron respecto de la agencia original (solo edición). */
  private cambios(original: Agencia): AgenciaUpdatePayload {
    const v = this.form.getRawValue();
    const t = (s: string) => s.trim();
    const payload: AgenciaUpdatePayload = {};
    if (t(v.razon_social) !== original.razon_social) payload.razon_social = t(v.razon_social);
    if (normalizarNit(v.nit) !== normalizarNit(original.nit ?? '')) payload.nit = t(v.nit);
    if (t(v.correo_facturacion) !== (original.correo_facturacion ?? '')) {
      payload.correo_facturacion = t(v.correo_facturacion);
    }
    if (t(v.direccion_fiscal) !== (original.direccion_fiscal ?? '')) {
      payload.direccion_fiscal = t(v.direccion_fiscal);
    }
    // Opcionales: solo si quedaron con texto y distinto (vacío = "no cambiar" en el backend)
    const opcionales: (keyof Pick<AgenciaUpdatePayload, 'contacto_operativo' | 'telefono' | 'correo' | 'direccion'>)[] =
      ['contacto_operativo', 'telefono', 'correo', 'direccion'];
    for (const campo of opcionales) {
      const nuevo = t(v[campo]);
      if (nuevo && nuevo !== (original[campo] ?? '')) payload[campo] = nuevo;
    }
    return payload;
  }

  guardar(): void {
    if (this.guardando()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Complete los campos obligatorios (*) correctamente.');
      return;
    }
    this.errorMessage.set('');
    const original = this.agencia();

    if (original) {
      const payload = this.cambios(original);
      if (Object.keys(payload).length === 0) {
        this.errorMessage.set('No hay cambios para guardar.');
        return;
      }
      this.guardando.set(true);
      this.service.actualizar(original.id_agencia, payload).subscribe({
        next: (a) => this.terminar(a, 'Agencia actualizada correctamente.'),
        error: (err) => this.fallar(err),
      });
      return;
    }

    const v = this.form.getRawValue();
    const t = (s: string) => s.trim();
    const payload: AgenciaCreatePayload = {
      razon_social: t(v.razon_social),
      nit: t(v.nit),
      correo_facturacion: t(v.correo_facturacion),
      direccion_fiscal: t(v.direccion_fiscal),
      contacto_operativo: t(v.contacto_operativo) || undefined,
      telefono: t(v.telefono) || undefined,
      correo: t(v.correo) || undefined,
      direccion: t(v.direccion) || undefined,
    };
    this.guardando.set(true);
    this.service.crear(payload).subscribe({
      next: (a) => this.terminar(a, 'Agencia registrada y habilitada correctamente.'),
      error: (err) => this.fallar(err),
    });
  }

  private terminar(agencia: Agencia, mensaje: string): void {
    this.guardando.set(false);
    this.guardado.emit({ agencia, mensaje });
  }

  private fallar(err: unknown): void {
    this.guardando.set(false);
    this.errorMessage.set(mensajeErrorEnvio(err, 'No se pudo guardar la agencia. Verifique los datos.'));
  }
}
