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
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-medium';
      case 'info':
        return 'bg-blue-50 text-blue-700 border border-blue-200/60 font-medium';
      case 'danger':
        return 'bg-rose-50 text-rose-700 border border-rose-200/60 font-medium';
      case 'warning':
        return 'bg-amber-50 text-amber-800 border border-amber-200/60 font-medium';
      case 'accent':
        return 'bg-accent/80 text-primary border border-primary/15 font-medium';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200/60 font-medium';
    }
  }
}
