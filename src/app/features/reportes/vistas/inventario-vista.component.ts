import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { InventarioSituacion, NivelStock } from '../../../core/models/reporte.model';
import { BadgeComponent } from '../../../shared/badge/badge.component';
import { ReporteChartComponent } from '../reporte-chart.component';
import { ReporteKpiComponent } from '../reporte-kpi.component';
import { COLOR_NIVEL_STOCK, configBarras, configDona } from '../reporte-graficos';

/** Orden fijo de los niveles (el backend siempre envía las 3 claves). */
const NIVELES: NivelStock[] = ['CRITICO', 'BAJO', 'OK'];

/**
 * CU20 — Vista del reporte de INVENTARIO: situación actual del stock (global),
 * nivel por producto y rotación APROXIMADA (unidades vendidas del período /
 * stock actual; el backend la entrega, incluido `rotacion_disponible`).
 */
@Component({
  selector: 'app-inventario-vista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, BadgeComponent, ReporteChartComponent, ReporteKpiComponent],
  templateUrl: './inventario-vista.component.html',
})
export class InventarioVistaComponent {
  readonly datos = input.required<InventarioSituacion>();

  protected readonly graficoNiveles = computed(() => {
    const d = this.datos();
    return configDona(
      NIVELES.map((n) => this.etiquetaNivel(n)),
      NIVELES.map((n) => d.por_nivel[n]),
      'Productos',
      NIVELES.map((n) => COLOR_NIVEL_STOCK[n]),
    );
  });

  /** Solo productos con rotación calculable (stock > 0); los demás figuran en la tabla como N/D. */
  protected readonly graficoRotacion = computed(() => {
    const filas = this.datos().items.filter((i) => i.rotacion_disponible && i.rotacion !== null);
    return {
      hayDatos: filas.length > 0,
      config: configBarras(
        filas.map((i) => i.producto),
        filas.map((i) => i.rotacion as number),
        'Rotación (aprox.)',
        { horizontal: true },
      ),
      alto: Math.max(220, filas.length * 34 + 60),
    };
  });

  protected etiquetaNivel(nivel: NivelStock): string {
    return { CRITICO: 'Crítico (< 5)', BAJO: 'Bajo (< 15)', OK: 'OK' }[nivel];
  }

  protected varianteNivel(nivel: NivelStock): 'danger' | 'warning' | 'success' {
    return { CRITICO: 'danger', BAJO: 'warning', OK: 'success' }[nivel] as 'danger' | 'warning' | 'success';
  }
}
