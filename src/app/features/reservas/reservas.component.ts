import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservasService } from './reservas.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { EstadoReserva, Reserva } from '../../core/models/reserva.model';

export type FiltroEstado =
 | 'todas'
 | 'PENDIENTE'
 | 'CONFIRMADA'
 | 'PROXIMAS_VENCER'
 | 'CANCELADA'
 | 'COMPLETADA';

/** Badge y etiqueta según el estado de la reserva. */
function badgeEstado(
 reserva: Reserva,
): 'warning' | 'info' | 'danger' | 'success' {
 if (reserva.es_expirada || (reserva.estado === 'CANCELADA' && reserva.motivo_cancelacion?.toLowerCase().includes('expirad'))) {
 return 'danger';
 }
 switch (reserva.estado) {
 case 'PENDIENTE':
 return 'warning';
 case 'CONFIRMADA':
 return 'info';
 case 'CANCELADA':
 return 'danger';
 default:
 return 'success'; // COMPLETADA
 }
}

/**
 * Gestión de Reservas Simplificadas: Pago en Efectivo, Descuento de Stock por Sucursal y Temporizador de 48h.
 *
 * Reglas de negocio automatizadas:
 * 1. Confirmación Automática: Se registra en efectivo (Retiro en Tienda o Envío a Domicilio) sin anticipos.
 * 2. Plazo de Expiración (48 Horas): Temporizador visible en el panel.
 * 3. Política de Expiración: Restitución inmediata al inventario de la sucursal si expira.
 * 4. Métricas e interactividad completa en el dashboard de sucursal.
 */
@Component({
 selector: 'app-reservas',
 imports: [
 CommonModule,
 FormsModule,
 BadgeComponent,
 ConfirmDialogComponent,
 DatePipe,
 CurrencyPipe,
 ],
 templateUrl: './reservas.component.html',
})
export class ReservasComponent implements OnInit {
 private readonly reservasService = inject(ReservasService);

 // ------------------------------------------------------------------ estado
 reservas = signal<Reserva[]>([]);
 cargando = signal(true);
 verificandoExpiraciones = signal(false);
 errorMessage = signal('');
 exitoMessage = signal('');

 // Filtros
 busqueda = signal('');
 filtroEstado = signal<FiltroEstado>('todas');

 // Modales
 confirmarCancelar = signal<Reserva | null>(null);
 modalDetalle = signal<Reserva | null>(null);

 // -------------------------------------------------------- contadores resumen
 readonly totalReservas = computed(() => this.reservas().length);
 readonly totalPendientes = computed(
 () => this.reservas().filter((r) => r.estado === 'PENDIENTE').length,
 );
 readonly totalConfirmadas = computed(
 () =>
 this.reservas().filter((r) => r.estado === 'CONFIRMADA' && !r.es_expirada)
 .length,
 );
 readonly totalProximasVencer = computed(
 () =>
 this.reservas().filter(
 (r) =>
 r.estado === 'CONFIRMADA' &&
 r.minutos_restantes !== null &&
 r.minutos_restantes !== undefined &&
 r.minutos_restantes <= 1440 &&
 !r.es_expirada,
 ).length,
 );
 readonly totalExpiradas = computed(
 () =>
 this.reservas().filter(
 (r) =>
 r.es_expirada ||
 (r.estado === 'CANCELADA' &&
 r.motivo_cancelacion?.toLowerCase().includes('expirad')),
 ).length,
 );
 readonly totalCompletadas = computed(
 () => this.reservas().filter((r) => r.estado === 'COMPLETADA').length,
 );

 // ----------------------------------------------------------- lista filtrada
 readonly reservasFiltradas = computed(() => {
 const q = this.busqueda().toLowerCase().trim();
 const filtro = this.filtroEstado();

 return this.reservas().filter((r) => {
 // Filtro de búsqueda por cliente o código
 if (
 q &&
 !r.cliente_nombre.toLowerCase().includes(q) &&
 !r.id.toString().includes(q) &&
 !(r.cliente_correo && r.cliente_correo.toLowerCase().includes(q))
 ) {
 return false;
 }

 // Filtro por estado/pestaña
 if (filtro === 'todas') return true;
 if (filtro === 'PROXIMAS_VENCER') {
 return (
 r.estado === 'CONFIRMADA' &&
 r.minutos_restantes !== null &&
 r.minutos_restantes !== undefined &&
 r.minutos_restantes <= 1440 &&
 !r.es_expirada
 );
 }
 if (filtro === 'CANCELADA') {
 return r.estado === 'CANCELADA' || r.es_expirada;
 }
 return r.estado === filtro;
 });
 });

 ngOnInit(): void {
 this.cargarReservas();
 }

 cargarReservas(): void {
 this.cargando.set(true);
 this.reservasService.getReservas().subscribe({
 next: (reservas) => {
 this.reservas.set(reservas);
 this.cargando.set(false);
 },
 error: () => {
 this.errorMessage.set('No se pudo cargar la lista de reservas.');
 this.cargando.set(false);
 },
 });
 }

 // -------------------------------------------------------------- UI helpers
 onBusqueda(event: Event): void {
 this.busqueda.set((event.target as HTMLInputElement).value);
 }

 onFiltroEstado(estado: FiltroEstado): void {
 this.filtroEstado.set(estado);
 }

 badgeDeEstado(reserva: Reserva) {
 return badgeEstado(reserva);
 }

 textoBadgeEstado(reserva: Reserva): string {
 if (reserva.es_expirada || (reserva.estado === 'CANCELADA' && reserva.motivo_cancelacion?.toLowerCase().includes('expirad'))) {
 return 'EXPIRADA (48H)';
 }
 return reserva.estado;
 }

 formatoTiempoRestante(minutos: number | null | undefined): string {
 if (minutos === null || minutos === undefined) return '—';
 if (minutos <= 0) return 'Vencido (0h)';
 const horas = Math.floor(minutos / 60);
 const mins = minutos % 60;
 if (horas >= 24) {
 const dias = Math.floor(horas / 24);
 const horasRest = horas % 24;
 return `${dias}d ${horasRest}h restantes`;
 }
 if (horas > 0) {
 return `${horas}h ${mins}m restantes`;
 }
 return `${mins}m restantes`;
 }

 esUrgente(reserva: Reserva): boolean {
 return (
 reserva.estado === 'CONFIRMADA' &&
 reserva.minutos_restantes !== null &&
 reserva.minutos_restantes !== undefined &&
 reserva.minutos_restantes <= 360 &&
 !reserva.es_expirada
 );
 }

 esProximo(reserva: Reserva): boolean {
 return (
 reserva.estado === 'CONFIRMADA' &&
 reserva.minutos_restantes !== null &&
 reserva.minutos_restantes !== undefined &&
 reserva.minutos_restantes <= 1440 &&
 reserva.minutos_restantes > 360 &&
 !reserva.es_expirada
 );
 }

 // ---------------------------------------------------- Acciones comerciales
 /** Ejecuta la verificación y procesamiento manual de expiraciones de 48 horas. */
 procesarExpiracionesManual(): void {
 this.verificandoExpiraciones.set(true);
 this.reservasService.procesarExpiraciones().subscribe({
 next: (resp) => {
 this.verificandoExpiraciones.set(false);
 this.exitoMessage.set(
 `Verificación de 48h completada: ${resp.procesadas} reserva(s) expirada(s) procesadas y prendas devueltas al inventario de la sucursal.`,
 );
 this.cargarReservas();
 setTimeout(() => this.exitoMessage.set(''), 5000);
 },
 error: (err) => {
 this.verificandoExpiraciones.set(false);
 this.mostrarError(err);
 },
 });
 }

 /** CONFIRMADA -> COMPLETADA (venta finalizada). */
 completarVenta(reserva: Reserva): void {
 this.reservasService
 .cambiarEstadoReserva(reserva.id, 'COMPLETADA')
 .subscribe({
 next: () => {
 this.exitoMessage.set(
 `Venta finalizada con éxito para ${reserva.cliente_nombre}. Reserva #${reserva.id} completada.`,
 );
 this.cargarReservas();
 setTimeout(() => this.exitoMessage.set(''), 4000);
 },
 error: (err) => this.mostrarError(err),
 });
 }

 /** Abre el ConfirmDialog antes de cancelar. */
 pedirCancelar(reserva: Reserva): void {
 this.confirmarCancelar.set(reserva);
 }

 /** CANCELADA confirmada por el diálogo. */
 confirmarCancelacion(): void {
 const reserva = this.confirmarCancelar();
 if (!reserva) return;
 this.confirmarCancelar.set(null);

 this.reservasService.cancelarReserva(reserva.id).subscribe({
 next: () => {
 this.exitoMessage.set(
 `Reserva #${reserva.id} cancelada. Las prendas apartadas fueron devueltas al inventario de la sucursal.`,
 );
 this.cargarReservas();
 setTimeout(() => this.exitoMessage.set(''), 4000);
 },
 error: (err) => this.mostrarError(err),
 });
 }

 verDetalle(reserva: Reserva): void {
 this.modalDetalle.set(reserva);
 }

 cerrarModalDetalle(): void {
 this.modalDetalle.set(null);
 }

 private mostrarError(err: { error?: { detail?: string } }): void {
 this.errorMessage.set(
 err?.error?.detail ||
 'Ocurrió un error. Verifique los datos e intente nuevamente.',
 );
 setTimeout(() => this.errorMessage.set(''), 5000);
 }
}
