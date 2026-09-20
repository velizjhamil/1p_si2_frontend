import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * CU20 — Tarjeta de indicador (KPI). Muestra un valor ya calculado por el
 * backend; mismo estilo que las tarjetas de Devoluciones (CU13).
 */
@Component({
  selector: 'app-reporte-kpi',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bg-container rounded-xl p-4 border border-primary/10 h-full">
      <p class="text-xs font-semibold text-primary/70 uppercase tracking-wide">{{ etiqueta() }}</p>
      <p class="text-xl sm:text-2xl font-bold text-primary mt-1 break-words">{{ valor() ?? '—' }}</p>
      @if (nota()) {
        <p class="text-xs text-gray-500 mt-1">{{ nota() }}</p>
      }
    </div>
  `,
})
export class ReporteKpiComponent {
  readonly etiqueta = input.required<string>();
  readonly valor = input.required<string | number | null>();
  readonly nota = input<string>('');
}
