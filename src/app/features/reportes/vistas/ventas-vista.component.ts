import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { VentasPeriodo } from '../../../core/models/reporte.model';
import { ReporteChartComponent } from '../reporte-chart.component';
import { ReporteKpiComponent } from '../reporte-kpi.component';
import { PALETA, configBarras, configDona, configLinea } from '../reporte-graficos';

/** Etiqueta legible del canal (derivado de id_vendedor en el backend). */
const ETIQUETA_CANAL: Record<string, string> = { ONLINE: 'Online', POS: 'POS (mostrador)' };

/**
 * Vista del reporte de VENTAS: KPIs, gráficos (por fecha, categoría,
 * canal y método de pago) y tablas. Presenta las series del backend tal cual.
 */
@Component({
 selector: 'app-ventas-vista',
 changeDetection: ChangeDetectionStrategy.OnPush,
 imports: [DecimalPipe, ReporteChartComponent, ReporteKpiComponent],
 templateUrl: './ventas-vista.component.html',
})
export class VentasVistaComponent {
 readonly datos = input.required<VentasPeriodo>();

 protected readonly graficoFecha = computed(() => {
 const d = this.datos();
 return configLinea(
 d.por_fecha.map((p) => p.fecha),
 d.por_fecha.map((p) => p.ingresos),
 'Ingresos',
 { moneda: true },
 );
 });

 protected readonly graficoCategoria = computed(() => {
 const d = this.datos();
 return configBarras(
 d.por_categoria.map((c) => c.categoria),
 d.por_categoria.map((c) => c.ingresos),
 'Ingresos',
 { moneda: true, horizontal: true },
 );
 });

 protected readonly graficoCanal = computed(() => {
 const d = this.datos();
 return configDona(
 d.por_canal.map((c) => this.etiquetaCanal(c.canal)),
 d.por_canal.map((c) => c.ingresos),
 'Ingresos',
 PALETA,
 { moneda: true },
 );
 });

 protected readonly graficoMetodo = computed(() => {
 const d = this.datos();
 return configDona(
 d.por_metodo_pago.map((m) => m.metodo_pago),
 d.por_metodo_pago.map((m) => m.ingresos),
 'Ingresos',
 PALETA,
 { moneda: true },
 );
 });

 /** La serie por fecha trae un punto por día (ceros incluidos); la tabla solo los días con ventas. */
 protected readonly diasConVentas = computed(() =>
 this.datos().por_fecha.filter((p) => p.num_ventas > 0),
 );

 protected etiquetaCanal(canal: string): string {
 return ETIQUETA_CANAL[canal] ?? canal;
 }
}
