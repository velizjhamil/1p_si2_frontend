import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RendimientoVendedores } from '../../../core/models/reporte.model';
import { ReporteChartComponent } from '../reporte-chart.component';
import { ReporteKpiComponent } from '../reporte-kpi.component';
import { configBarras } from '../reporte-graficos';

/**
 * CU20 — Vista del reporte de RENDIMIENTO DE VENDEDORES (contrato original:
 * los importes llegan como string decimal; el `number` pipe los formatea y
 * `Number()` solo convierte el tipo para Chart.js, sin operar con ellos).
 */
@Component({
  selector: 'app-rendimiento-vista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ReporteChartComponent, ReporteKpiComponent],
  templateUrl: './rendimiento-vista.component.html',
})
export class RendimientoVistaComponent {
  readonly datos = input.required<RendimientoVendedores>();

  protected readonly grafico = computed(() => {
    const d = this.datos();
    return configBarras(
      d.items.map((v) => v.nombre),
      d.items.map((v) => Number(v.total_ingresos)),
      'Ingresos',
      { moneda: true, horizontal: true },
    );
  });

  protected readonly alto = computed(() => Math.max(220, this.datos().items.length * 34 + 60));

  /** "POS: 4 · ONLINE: 2" a partir de `tipos_venta` (solo formato de texto). */
  protected tipos(tipos: Record<string, number>): string {
    return Object.entries(tipos)
      .map(([tipo, n]) => `${tipo}: ${n}`)
      .join(' · ');
  }
}
