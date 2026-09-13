import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { ReservasService } from './reservas.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { EstadoReserva, Reserva } from '../../core/models/reserva.model';

type FiltroEstado = 'todas' | EstadoReserva;

/** Badge y etiqueta según el estado de la reserva. */
function badgeEstado(estado: EstadoReserva): 'warning' | 'info' | 'danger' | 'success' {
  switch (estado) {
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
 * CU14 — Gestionar Reserva de Prendas (FASE MOCK).
 * Datatable de reservas con chips de prendas, badges de estado por color,
 * acciones rápidas por ciclo de vida (Confirmar PENDIENTE, Completar Venta
 * CONFIRMADA, Cancelar PENDIENTE/CONFIRMADA), filtros por estado y
 * buscador por cliente, y ConfirmDialog para cancelaciones.
 */
@Component({
  selector: 'app-reservas',
  imports: [BadgeComponent, ConfirmDialogComponent, DatePipe, CurrencyPipe],
  templateUrl: './reservas.component.html',
})
export class ReservasComponent implements OnInit {
  private readonly reservasService = inject(ReservasService);

  // ------------------------------------------------------------------ estado
  reservas = signal<Reserva[]>([]);
  cargando = signal(true);
  errorMessage = signal('');
  exitoMessage = signal('');

  // Filtros
  busqueda = signal('');
  filtroEstado = signal<FiltroEstado>('todas');

  // ConfirmDialog de cancelación
  confirmarCancelar = signal<Reserva | null>(null);

  // ----------------------------------------------------------- lista filtrada
  protected readonly reservasFiltradas = computed(() => {
    const q = this.busqueda().toLowerCase().trim();
    const estado = this.filtroEstado();
    return this.reservas().filter((r) => {
      if (estado !== 'todas' && r.estado !== estado) return false;
      if (q && !r.cliente_nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  ngOnInit(): void {
    this.cargarReservas();
  }

  private cargarReservas(): void {
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

  protected badgeDeEstado(estado: EstadoReserva) {
    return badgeEstado(estado);
  }

  // --------------------------------------------------------------- acciones
  /** PENDIENTE -> CONFIRMADA. */
  confirmar(reserva: Reserva): void {
    this.reservasService.cambiarEstadoReserva(reserva.id, 'CONFIRMADA').subscribe({
      next: () => {
        this.exitoMessage.set(`Reserva de ${reserva.cliente_nombre} confirmada.`);
        this.cargarReservas();
        setTimeout(() => this.exitoMessage.set(''), 3000);
      },
      error: (err) => this.mostrarError(err),
    });
  }

  /** CONFIRMADA -> COMPLETADA (venta finalizada). */
  completarVenta(reserva: Reserva): void {
    this.reservasService
      .cambiarEstadoReserva(reserva.id, 'COMPLETADA')
      .subscribe({
        next: () => {
          this.exitoMessage.set(
            `Venta completada para ${reserva.cliente_nombre}.`,
          );
          this.cargarReservas();
          setTimeout(() => this.exitoMessage.set(''), 3000);
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
        this.exitoMessage.set(`Reserva de ${reserva.cliente_nombre} cancelada.`);
        this.cargarReservas();
        setTimeout(() => this.exitoMessage.set(''), 3000);
      },
      error: (err) => this.mostrarError(err),
    });
  }

  private mostrarError(err: { error?: { detail?: string } }): void {
    this.errorMessage.set(
      err?.error?.detail ||
        'Ocurrió un error. Verifique los datos e intente nuevamente.',
    );
    setTimeout(() => this.errorMessage.set(''), 4000);
  }
}
