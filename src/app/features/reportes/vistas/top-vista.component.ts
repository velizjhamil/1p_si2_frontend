import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ProductosMasVendidos } from '../../../core/models/reporte.model';
import { ReporteChartComponent } from '../reporte-chart.component';
import { ReporteKpiComponent } from '../reporte-kpi.component';
import { configBarras } from '../reporte-graficos';

/**
 * Vista de PRODUCTOS MÁS VENDIDOS: ranking por unidades (posición,
 * desempates y totales los entrega el backend).
 */
@Component({
 selector: 'app-top-vista',
 changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [DecimalPipe, ReporteChartComponent, ReporteKpiComponent],
 templateUrl: './top-vista.component.html',
})
export class TopVistaComponent {
 readonly datos = input.required<ProductosMasVendidos>();

 protected readonly grafico = computed(() => {
 const d = this.datos();
 return configBarras(
 d.items.map((i) => `${i.posicion}. ${i.producto}`),
 d.items.map((i) => i.cantidad_vendida),
 'Unidades vendidas',
 { horizontal: true },
 );
 });

 /** Alto del gráfico proporcional a la cantidad de filas (solo layout). */
 protected readonly alto = computed(() => Math.max(220, this.datos().items.length * 34 + 60));
}
