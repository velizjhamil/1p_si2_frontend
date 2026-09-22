import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { EnviosService, mensajeErrorEnvio } from './envios.service';
import { EnvioActualizado, EnvioDetalleComponent } from './envio-detalle.component';
import { SucursalesService } from '../branches/branches.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { Sucursal } from '../../core/models/sucursal.model';
import {
 ACCION_ENVIO_LABEL,
 ESTADO_ENVIO_LABEL,
 ESTADO_ENVIO_VARIANT,
 Envio,
 EstadoEnvio,
} from '../../core/models/envio.model';

type FiltroEstado = 'todos' | EstadoEnvio;

/**
 * Gestión de Envíos (GS / Encargado de Delivery / ASU).
 *
 * Tabla paginada con filtros (estado, búsqueda, sucursal), KPIs, y modal de
 * detalle con las acciones del flujo de despacho. Qué ve cada rol lo decide
 * el backend: GS/ASU todos los envíos; el repartidor (D) solo los que le
 * asignaron. La sucursal es un filtro de conveniencia y un dato del envío,
 * NO una restricción de seguridad (Usuario no está asociado a sucursal).
 *
 * Deep-link desde una venta: /envios?q=ATT-000123 precarga la búsqueda.
 */
@Component({
 selector: 'app-envios',
 imports: [FormsModule, DatePipe, BadgeComponent, EnvioDetalleComponent],
 templateUrl: './envios.component.html',
})
export class EnviosComponent implements OnInit, OnDestroy {
 private readonly enviosService = inject(EnviosService);
 private readonly sucursalesService = inject(SucursalesService);
 private readonly route = inject(ActivatedRoute);

 // ------------------------------------------------------------------ estado
 envios = signal<Envio[]>([]);
 cargando = signal(true);
 errorMessage = signal('');
 exitoMessage = signal('');

 pagina = signal(1);
 total = signal(0);
 pages = signal(1);
 readonly limit = 10;

 filtroEstado = signal<FiltroEstado>('todos');
 busqueda = signal('');
 filtroSucursal = signal<number | null>(null);
 sucursales = signal<Sucursal[]>([]);

 // KPIs (consultas livianas con limit=1; respetan la visibilidad del rol)
 kpiPreparando = signal(0);
 kpiEnRuta = signal(0);
 kpiFallidos = signal(0);
 kpiEntregados = signal(0);

 detalle = signal<Envio | null>(null);

 protected readonly estados: FiltroEstado[] = [
 'todos',
 'PREPARANDO',
 'LISTO_ENVIO',
 'ASIGNADO',
 'EN_RUTA',
 'INTENTO_FALLIDO',
 'REPROGRAMADO',
 'ENTREGADO',
 'CANCELADO',
 ];
 protected readonly estadoLabel = ESTADO_ENVIO_LABEL;
 protected readonly estadoVariant = ESTADO_ENVIO_VARIANT;

 private debounce: ReturnType<typeof setTimeout> | null = null;
 private avisoTimer: ReturnType<typeof setTimeout> | null = null;

 ngOnInit(): void {
 const q = this.route.snapshot.queryParamMap.get('q');
 if (q) this.busqueda.set(q);
 // El filtro por sucursal usa el catálogo real de (solo lectura).
 this.sucursalesService.getSucursales().subscribe({
 next: (r) => this.sucursales.set(r.data),
 error: () => this.sucursales.set([]),
 });
 this.cargarEnvios();
 this.cargarKpis();
 }

 ngOnDestroy(): void {
 if (this.debounce) clearTimeout(this.debounce);
 if (this.avisoTimer) clearTimeout(this.avisoTimer);
 }

 // ---------------------------------------------------------------- listado
 cargarEnvios(): void {
 this.cargando.set(true);
 this.errorMessage.set('');
 const estado = this.filtroEstado();
 this.enviosService
 .listar({
 estado: estado === 'todos' ? undefined : estado,
 q: this.busqueda().trim() || undefined,
 codigo_sucursal: this.filtroSucursal() ?? undefined,
 page: this.pagina(),
 limit: this.limit,
 })
 .subscribe({
 next: (resp) => {
 this.envios.set(resp.items);
 this.total.set(resp.total);
 this.pages.set(Math.max(resp.pages, 1));
 this.cargando.set(false);
 },
 error: (err) => {
 this.errorMessage.set(mensajeErrorEnvio(err, 'No se pudo cargar la lista de envíos.'));
 this.cargando.set(false);
 },
 });
 }

 private cargarKpis(): void {
 this.contar('PREPARANDO', this.kpiPreparando);
 this.contar('EN_RUTA', this.kpiEnRuta);
 this.contar('INTENTO_FALLIDO', this.kpiFallidos);
 this.contar('ENTREGADO', this.kpiEntregados);
 }

 private contar(estado: EstadoEnvio, destino: { set: (v: number) => void }): void {
 this.enviosService.listar({ estado, page: 1, limit: 1 }).subscribe({
 next: (r) => destino.set(r.total),
 error: () => destino.set(0),
 });
 }

 // ------------------------------------------------------------- filtros UI
 onFiltroEstado(estado: FiltroEstado): void {
 this.filtroEstado.set(estado);
 this.pagina.set(1);
 this.cargarEnvios();
 }

 onBusqueda(texto: string): void {
 this.busqueda.set(texto);
 if (this.debounce) clearTimeout(this.debounce);
 this.debounce = setTimeout(() => {
 this.pagina.set(1);
 this.cargarEnvios();
 }, 350);
 }

 onFiltroSucursal(valor: number | null): void {
 this.filtroSucursal.set(valor);
 this.pagina.set(1);
 this.cargarEnvios();
 }

 limpiarFiltros(): void {
 this.filtroEstado.set('todos');
 this.busqueda.set('');
 this.filtroSucursal.set(null);
 this.pagina.set(1);
 this.cargarEnvios();
 }

 paginaAnterior(): void {
 if (this.pagina() > 1) {
 this.pagina.update((p) => p - 1);
 this.cargarEnvios();
 }
 }

 paginaSiguiente(): void {
 if (this.pagina() < this.pages()) {
 this.pagina.update((p) => p + 1);
 this.cargarEnvios();
 }
 }

 protected etiquetaFiltro(estado: FiltroEstado): string {
 return estado === 'todos' ? 'Todos' : ESTADO_ENVIO_LABEL[estado];
 }

 /**
 * Próximos pasos disponibles para el usuario en ese envío (texto de ayuda
 * en la tabla). Sale de `transiciones_permitidas` (backend), sin repetir
 * la máquina de estados aquí; la cancelación no se sugiere como "siguiente".
 */
 protected siguientePaso(e: Envio): string {
 return e.transiciones_permitidas
 .filter((d) => d !== 'CANCELADO')
 .map((d) => ACCION_ENVIO_LABEL[d] ?? d)
 .join(' · ');
 }

 // ----------------------------------------------------------------- detalle
 verDetalle(e: Envio): void {
 this.detalle.set(e);
 }

 cerrarDetalle(): void {
 this.detalle.set(null);
 }

 /** Una acción del detalle terminó: refresca el modal, la tabla y los KPIs. */
 onActualizado(ev: EnvioActualizado): void {
 this.detalle.set(ev.envio);
 this.envios.update((lista) =>
 lista.map((e) => (e.id_envio === ev.envio.id_envio ? ev.envio : e)),
 );
 this.exitoMessage.set(ev.mensaje);
 if (this.avisoTimer) clearTimeout(this.avisoTimer);
 this.avisoTimer = setTimeout(() => this.exitoMessage.set(''), 4500);
 this.cargarEnvios();
 this.cargarKpis();
 }
}
