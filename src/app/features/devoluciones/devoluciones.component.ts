import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DevolucionesService } from './devoluciones.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import {
  AccionDevolucion,
  Devolucion,
  EstadoDevolucion,
} from '../../core/models/devolucion.model';

type FiltroEstado = 'todos' | EstadoDevolucion;

/**
 * CU13 — Gestión de Devoluciones (ASU/GS/V).
 *
 * Tabla paginada con filtros por estado, KPIs por estado, modal de detalle
 * y acciones de procesamiento (APROBAR / RECHAZAR / COMPLETAR) según el
 * estado actual:
 *
 *   SOLICITADA -> APROBAR | RECHAZAR
 *   APROBADA   -> COMPLETAR  (mueve stock vía CU22)
 *   RECHAZADA  -> (terminal)
 *   COMPLETADA -> (terminal)
 *
 * El cliente (rol C) tiene su propio flujo (solicitar) y NO usa esta
 * pantalla operativa: por eso el RBAC del item/ruta es solo ASU/GS/V.
 */
@Component({
  selector: 'app-devoluciones',
  imports: [
    FormsModule,
    DatePipe,
    DecimalPipe,
    BadgeComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './devoluciones.component.html',
})
export class DevolucionesComponent implements OnInit {
  private readonly devolucionesService = inject(DevolucionesService);

  // ------------------------------------------------------------------ estado
  devoluciones = signal<Devolucion[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  // Paginación server-side
  pagina = signal(1);
  total = signal(0);
  pages = signal(1);
  readonly limit = 10;

  // Filtros server-side
  filtroEstado = signal<FiltroEstado>('todos');

  // KPIs por estado (consultas livianas con limit=1 para conocer el total).
  totalSolicitadas = signal(0);
  totalAprobadas = signal(0);
  totalCompletadas = signal(0);
  totalRechazadas = signal(0);

  // Modal de detalle
  modalAbierto = signal(false);
  devolucionDetalle = signal<Devolucion | null>(null);
  motivoRechazo = signal('');

  // ConfirmDialog para acciones destructivas/terminales
  confirmarAccion = signal<{
    devolucion: Devolucion;
    accion: AccionDevolucion;
  } | null>(null);

  /** Estados disponibles como filtro (alineados con la DB). */
  protected readonly estados: FiltroEstado[] = [
    'todos',
    'SOLICITADA',
    'APROBADA',
    'COMPLETADA',
    'RECHAZADA',
  ];

  /** Etiqueta legible de cada estado para la UI en español. */
  protected readonly etiquetasEstado: Record<EstadoDevolucion, string> = {
    SOLICITADA: 'Solicitada',
    APROBADA: 'Aprobada',
    COMPLETADA: 'Completada',
    RECHAZADA: 'Rechazada',
  };

  /** Color del badge de estado (paleta del shared/BadgeComponent). */
  protected readonly badgeVariante: Record<
    EstadoDevolucion,
    'info' | 'success' | 'warning' | 'danger'
  > = {
    SOLICITADA: 'info',
    APROBADA: 'warning',
    COMPLETADA: 'success',
    RECHAZADA: 'danger',
  };

  /** Acciones disponibles según el estado (regla de transición). */
  protected readonly accionesPorEstado: Record<
    EstadoDevolucion,
    AccionDevolucion[]
  > = {
    SOLICITADA: ['APROBAR', 'RECHAZAR'],
    APROBADA: ['COMPLETAR'],
    RECHAZADA: [],
    COMPLETADA: [],
  };

  /** Total acumulado (recalculado derivado de pages*limit, fallback al total). */
  protected readonly totalAcumulado = computed(() => this.total());

  ngOnInit(): void {
    this.cargarDevoluciones();
    this.cargarKpis();
  }

  // ---------------------------------------------------------------- listado
  cargarDevoluciones(): void {
    this.cargando.set(true);
    const estadoFiltro = this.filtroEstado();
    this.devolucionesService
      .listar({
        estado: estadoFiltro === 'todos' ? undefined : estadoFiltro,
        page: this.pagina(),
        limit: this.limit,
      })
      .subscribe({
        next: (resp) => {
          this.devoluciones.set(resp.items);
          this.total.set(resp.total);
          this.pages.set(resp.pages);
          this.cargando.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar la lista de devoluciones.');
          this.cargando.set(false);
        },
      });
  }

  /**
   * KPIs por estado. Una consulta con limit=1 es lo más liviano que el
   * backend acepta para conocer el total filtrado (mismo patrón que
   * `SuppliersComponent` para activos/verificados).
   */
  private cargarKpis(): void {
    this.contarPorEstado('SOLICITADA', this.totalSolicitadas);
    this.contarPorEstado('APROBADA', this.totalAprobadas);
    this.contarPorEstado('COMPLETADA', this.totalCompletadas);
    this.contarPorEstado('RECHAZADA', this.totalRechazadas);
  }

  private contarPorEstado(
    estado: EstadoDevolucion,
    destino: { set: (v: number) => void },
  ): void {
    this.devolucionesService
      .listar({ estado, page: 1, limit: 1 })
      .subscribe({
        next: (r) => destino.set(r.total),
        error: () => destino.set(0),
      });
  }

  // ------------------------------------------------------------- UI helpers
  onFiltroEstado(estado: FiltroEstado): void {
    this.filtroEstado.set(estado);
    this.pagina.set(1);
    this.cargarDevoluciones();
  }

  paginaAnterior(): void {
    if (this.pagina() > 1) {
      this.pagina.update((p) => p - 1);
      this.cargarDevoluciones();
    }
  }

  paginaSiguiente(): void {
    if (this.pagina() < this.pages()) {
      this.pagina.update((p) => p + 1);
      this.cargarDevoluciones();
    }
  }

  // ----------------------------------------------------------------- detalle
  verDetalle(d: Devolucion): void {
    this.devolucionDetalle.set(d);
    this.motivoRechazo.set('');
    this.errorMessage.set('');
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.devolucionDetalle.set(null);
    this.motivoRechazo.set('');
    this.errorMessage.set('');
  }

  /** Lista de acciones permitidas para la devolución seleccionada. */
  accionesDisponibles(): AccionDevolucion[] {
    const d = this.devolucionDetalle();
    return d ? this.accionesPorEstado[d.estado] : [];
  }

  // --------------------------------------------------------------- procesar
  /**
   * Punto de entrada único para las tres acciones. La acción se decide
   * en el modal; COMPLETAR y APROBAR son irreversibles y pasan por
   * ConfirmDialog. RECHAZAR exige motivo_rechazo, validado en front
   * antes de salir.
   */
  ejecutarAccion(accion: AccionDevolucion): void {
    const d = this.devolucionDetalle();
    if (!d || this.guardando()) return;

    if (accion === 'RECHAZAR') {
      const motivo = this.motivoRechazo().trim();
      if (motivo.length < 10) {
        this.errorMessage.set(
          'Para rechazar una devolución debe indicar un motivo (mínimo 10 caracteres).',
        );
        return;
      }
    }

    this.errorMessage.set('');
    this.confirmarAccion.set({ devolucion: d, accion });
  }

  confirmarEjecucion(): void {
    const ctx = this.confirmarAccion();
    if (!ctx || this.guardando()) return;

    this.guardando.set(true);
    this.errorMessage.set('');

    const payload =
      ctx.accion === 'RECHAZAR'
        ? { accion: ctx.accion, motivo_rechazo: this.motivoRechazo().trim() }
        : { accion: ctx.accion };

    this.devolucionesService
      .procesar(ctx.devolucion.id_devolucion, payload)
      .subscribe({
        next: (resp) => {
          this.guardando.set(false);
          this.confirmarAccion.set(null);
          this.exitoMessage.set(this.mensajeExito(ctx.accion, resp));
          this.devolucionDetalle.set(resp); // refresca el modal con el nuevo estado
          this.cargarDevoluciones();
          this.cargarKpis();
          setTimeout(() => this.exitoMessage.set(''), 3500);
        },
        error: (err) => {
          this.guardando.set(false);
          this.confirmarAccion.set(null);
          this.mostrarError(err);
        },
      });
  }

  cancelarEjecucion(): void {
    this.confirmarAccion.set(null);
  }

  private mensajeExito(accion: AccionDevolucion, d: Devolucion): string {
    switch (accion) {
      case 'APROBAR':
        return `Devolución #${d.id_devolucion} aprobada. Pendiente de recepción.`;
      case 'RECHAZAR':
        return `Devolución #${d.id_devolucion} rechazada.`;
      case 'COMPLETAR':
        return `Devolución #${d.id_devolucion} completada. Stock reintegrado.`;
    }
  }

  private mostrarError(err: { error?: { detail?: string } }): void {
    this.guardando.set(false);
    this.errorMessage.set(
      err?.error?.detail ||
        'Ocurrió un error al procesar la devolución. Intente nuevamente.',
    );
  }

  protected accionLabel(accion: AccionDevolucion): string {
    switch (accion) {
      case 'APROBAR':
        return 'Aprobar';
      case 'RECHAZAR':
        return 'Rechazar';
      case 'COMPLETAR':
        return 'Completar';
    }
  }

  /**
   * Helper tipado para resolver la etiqueta de un estado desde el
   * template (los strings del filtro vienen como `FiltroEstado` y TS
   * no acepta el index directo sobre `Record<EstadoDevolucion, string>`).
   */
  protected etiquetaDe(estado: string): string {
    if (estado === 'todos') return 'Todas';
    return this.etiquetasEstado[estado as EstadoDevolucion];
  }
}
