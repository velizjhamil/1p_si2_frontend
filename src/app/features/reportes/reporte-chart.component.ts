import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { Chart } from 'chart.js';
import { ConfigGrafico } from './reporte-graficos';

/**
 * CU20 — Lienzo de un gráfico Chart.js.
 *
 * Recibe la configuración ya armada (`reporte-graficos.ts`) y la dibuja con
 * los datos del backend. Chart.js se importa dinámicamente y solo se ejecuta
 * en el navegador (`afterRenderEffect` no corre en SSR/prerender). Al cambiar
 * `config` destruye el gráfico anterior y crea uno nuevo; al destruirse el
 * componente libera el canvas.
 */
@Component({
  selector: 'app-reporte-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative w-full" [style.height.px]="alto()">
      <canvas #lienzo role="img" [attr.aria-label]="descripcion()"></canvas>
    </div>
  `,
})
export class ReporteChartComponent {
  readonly config = input.required<ConfigGrafico>();
  readonly alto = input(260);
  /** Texto alternativo del gráfico (accesibilidad). */
  readonly descripcion = input('Gráfico del reporte');

  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private chart: Chart | null = null;
  /** Descarta importaciones tardías si cambió la config o se destruyó el componente. */
  private version = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.version++;
      this.chart?.destroy();
      this.chart = null;
    });

    afterRenderEffect(() => {
      const cfg = this.config();
      const canvas = this.lienzo().nativeElement;
      const version = ++this.version;
      void import('chart.js/auto').then(({ Chart }) => {
        if (version !== this.version) return;
        this.chart?.destroy();
        this.chart = new Chart(canvas, {
          ...cfg,
          options: { responsive: true, maintainAspectRatio: false, ...cfg.options },
        });
      });
    });
  }
}
