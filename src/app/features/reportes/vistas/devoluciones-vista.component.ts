import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DevolucionesReporte, EstadoDevolucion } from '../../../core/models/reporte.model';
import { BadgeComponent } from '../../../shared/badge/badge.component';
import { ReporteChartComponent } from '../reporte-chart.component';
import { ReporteKpiComponent } from '../reporte-kpi.component';
import { COLOR_ESTADO_DEVOLUCION, configBarras, configDona } from '../reporte-graficos';

const ETIQUETA_ESTADO: Record<EstadoDevolucion, string> = {
  SOLICITADA: 'Solicitada',
  APROBADA: 'Aprobada',
  COMPLETADA: 'Completada',
  RECHAZADA: 'Rechazada',
};

const VARIANTE_ESTADO: Record<EstadoDevolucion, 'info' | 'warning' | 'success' | 'danger'> = {
  SOLICITADA: 'info',
  APROBADA: 'warning',
  COMPLETADA: 'success',
  RECHAZADA: 'danger',
};

/**
 * CU20 — Vista del reporte de DEVOLUCIONES. Unidades e importes (y las series
 * por fecha/producto/categoría) excluyen las RECHAZADA; los conteos y
 * `por_estado` las incluyen. Todo viene calculado del backend.
 */
@Component({
  selector: 'app-devoluciones-vista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, BadgeComponent, ReporteChartComponent, ReporteKpiComponent],
  templateUrl: './devoluciones-vista.component.html',
})
export class DevolucionesVistaComponent {
  readonly datos = input.required<DevolucionesReporte>();

  protected readonly graficoEstado = computed(() => {
    const d = this.datos();
    return configDona(
      d.por_estado.map((e) => this.etiquetaEstado(e.estado)),
      d.por_estado.map((e) => e.num_devoluciones),
      'Devoluciones',
      d.por_estado.map((e) => COLOR_ESTADO_DEVOLUCION[e.estado]),
    );
  });

  protected readonly graficoFecha = computed(() => {
    const d = this.datos();
    return configBarras(
      d.por_fecha.map((p) => p.fecha),
      d.por_fecha.map((p) => p.importe),
      'Importe devuelto',
      { moneda: true },
    );
  });

  protected readonly graficoProducto = computed(() => {
    const d = this.datos();
    return {
      hayDatos: d.por_producto.length > 0,
      config: configBarras(
        d.por_producto.map((p) => p.producto),
        d.por_producto.map((p) => p.unidades),
        'Unidades devueltas',
        { horizontal: true },
      ),
      alto: Math.max(220, d.por_producto.length * 34 + 60),
    };
  });

  protected etiquetaEstado(estado: EstadoDevolucion): string {
    return ETIQUETA_ESTADO[estado];
  }

  protected varianteEstado(estado: EstadoDevolucion): 'info' | 'warning' | 'success' | 'danger' {
    return VARIANTE_ESTADO[estado];
  }
}
