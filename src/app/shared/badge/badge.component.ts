import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Badge — badge de estado reutilizable (shared/).
 * Variantes de la paleta Attention: success (verde suave), info (azul
 * claro de contenedor), danger (rojo suave), warning (ámbar suave),
 * neutral (gris) y accent (rosa Attention).
 *
 * Uso: <app-badge variant="success" [texto]="'Activo'" />
 */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-block px-2.5 py-1 rounded-full text-xs font-semibold"
      [class]="classes()"
    >
      {{ texto() }}
    </span>
  `,
})
export class BadgeComponent {
  /** Variante visual del badge. */
  readonly variant = input.required<
    'success' | 'info' | 'danger' | 'warning' | 'neutral' | 'accent'
  >();
  /** Texto visible del badge. */
  readonly texto = input.required<string>();

  protected classes(): string {
    switch (this.variant()) {
      case 'success':
        return 'bg-green-100 text-green-700';
      case 'info':
        return 'bg-container text-primary';
      case 'danger':
        return 'bg-red-100 text-red-600';
      case 'warning':
        return 'bg-amber-100 text-amber-700';
      case 'accent':
        return 'bg-accent text-primary';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }
}
