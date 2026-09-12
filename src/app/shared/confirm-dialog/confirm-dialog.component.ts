import { Component, input, output } from '@angular/core';

/**
 * ConfirmDialog — modal de confirmación reutilizable (shared/).
 * Reemplaza el window.confirm nativo: mismo propósito, pero con la
 * paleta Attention y sin bloquear el hilo del navegador.
 *
 * Uso:
 *   <app-confirm-dialog
 *     titulo="Desactivar Sucursal"
 *     [mensaje]="'¿Desactivar ' + nombre + '?'"
 *     textoConfirmar="Desactivar"
 *     [peligro]="true"
 *     (confirmado)="onConfirmar()"
 *     (cancelado)="onCancelar()"
 *   ></app-confirm-dialog>
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent {
  /** Título del diálogo (opcional — por defecto "Confirmar acción"). */
  readonly titulo = input('Confirmar acción');
  /** Mensaje/cuerpo del diálogo. */
  readonly mensaje = input('');
  /** Texto del botón de confirmación (por defecto "Confirmar"). */
  readonly textoConfirmar = input('Confirmar');
  /** Si es true, el botón de confirmación se pinta en rojo (destructivo). */
  readonly peligro = input(false);

  /** Se emite cuando el usuario confirma la acción. */
  readonly confirmado = output<void>();
  /** Se emite cuando el usuario cancela o cierra el diálogo. */
  readonly cancelado = output<void>();
}
