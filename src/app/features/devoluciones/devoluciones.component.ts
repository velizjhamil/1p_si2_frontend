import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { DevolucionesService } from './devoluciones.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import {
  AccionDevolucion,
  Devolucion,
  DevolucionCrearPayload,
  EstadoDevolucion,
  ItemElegibleDevolucion,
  VentaBusquedaResumen,
  VentaElegiblesDevolucion,
} from '../../core/models/devolucion.model';

type FiltroEstado = 'todos' | EstadoDevolucion;

interface ItemDevolucionSeleccion {
  seleccionado: boolean;
  cantidad: number;
  item: ItemElegibleDevolucion;
}

/**
 * Gestión de Devoluciones (ASU/GS/V).
 *
 * Flujo operativo completo:
 * 1. Buscador de ventas / órdenes por código o cliente.
 * 2. Modal interactivo de creación de devolución con selección de prendas, cantidades y motivo.
 * 3. Gestión del ciclo de vida (SOLICITADA -> APROBADA -> COMPLETADA / RECHAZADA) con
 *    reintegración automática de stock al inventario de sucursal y registro en Kardex.
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
  busquedaTabla = signal('');

  // KPIs por estado
  totalSolicitadas = signal(0);
  totalAprobadas = signal(0);
  totalCompletadas = signal(0);
  totalRechazadas = signal(0);

  // Modal de detalle y procesamiento
  modalAbierto = signal(false);
  devolucionDetalle = signal<Devolucion | null>(null);
  motivoRechazo = signal('');

  // Modal de Nueva Devolución
  modalNuevaDevolucion = signal(false);
  busquedaVentaQuery = signal('');
  buscandoVentas = signal(false);
  ventasEncontradas = signal<VentaBusquedaResumen[]>([]);
  busquedaRealizada = signal(false);
  errorNuevaDevolucion = signal('');

  ventaSeleccionada = signal<VentaBusquedaResumen | null>(null);
  cargandoElegibles = signal(false);
  elegiblesVenta = signal<VentaElegiblesDevolucion | null>(null);
  itemsSeleccionados = signal<Record<number, ItemDevolucionSeleccion>>({});
  motivoCategoria = signal('Talla no adecuada / No le quedó');
  motivoDetalle = signal('');
  creandoDevolucion = signal(false);

  // ConfirmDialog para acciones de cambio de estado
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
    SOLICITADA: ['APROBAR', 'COMPLETAR', 'RECHAZAR'],
    APROBADA: ['COMPLETAR', 'RECHAZAR'],
    RECHAZADA: [],
    COMPLETADA: [],
  };

  /** Motivos predefinidos para la selección rápida. */
  protected readonly motivosPredefinidos: string[] = [
    'Talla no adecuada / No le quedó',
    'Defecto de confección o prenda dañada',
    'Producto no coincide con la descripción',
    'Cambio de opinión / No le gustó',
    'Color o modelo incorrecto entregado',
    'Otro motivo',
  ];

  /** Total acumulado. */
  protected readonly totalAcumulado = computed(() => this.total());

  /** Total de prendas seleccionadas para devolver. */
  readonly totalPrendasADevolver = computed(() => {
    const sel = this.itemsSeleccionados();
    return Object.values(sel).reduce((acc, curr) => {
      return curr.seleccionado ? acc + curr.cantidad : acc;
    }, 0);
  });

  /** Monto total estimado a devolver en la nueva devolución. */
  readonly montoTotalEstimadoDevolucion = computed(() => {
    const sel = this.itemsSeleccionados();
    return Object.values(sel).reduce((acc, curr) => {
      return curr.seleccionado
        ? acc + curr.cantidad * curr.item.precio_unitario
        : acc;
    }, 0);
  });

  /** Indica si el formulario de nueva devolución es válido para registrar. */
  readonly puedeCrearDevolucion = computed(() => {
    if (this.creandoDevolucion()) return false;
    if (this.totalPrendasADevolver() <= 0) return false;
    const cat = this.motivoCategoria();
    if (cat === 'Otro motivo' && this.motivoDetalle().trim().length < 5) {
      return false;
    }
    return true;
  });

  ngOnInit(): void {
    this.cargarDevoluciones();
    this.cargarKpis();
  }

  // ---------------------------------------------------------------- listado
  cargarDevoluciones(): void {
    this.cargando.set(true);
    const estadoFiltro = this.filtroEstado();
    const q = this.busquedaTabla().trim();
    this.devolucionesService
      .listar({
        estado: estadoFiltro === 'todos' ? undefined : estadoFiltro,
        q: q || undefined,
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

  buscarEnTabla(): void {
    this.pagina.set(1);
    this.cargarDevoluciones();
  }

  limpiarBusquedaTabla(): void {
    this.busquedaTabla.set('');
    this.pagina.set(1);
    this.cargarDevoluciones();
  }

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

  // ------------------------------------------------------------- nueva devolución
  abrirModalNuevaDevolucion(): void {
    this.modalNuevaDevolucion.set(true);
    this.busquedaVentaQuery.set('');
    this.buscandoVentas.set(false);
    this.ventasEncontradas.set([]);
    this.busquedaRealizada.set(false);
    this.errorNuevaDevolucion.set('');
    this.ventaSeleccionada.set(null);
    this.elegiblesVenta.set(null);
    this.itemsSeleccionados.set({});
    this.motivoCategoria.set('Talla no adecuada / No le quedó');
    this.motivoDetalle.set('');
  }

  cerrarModalNuevaDevolucion(): void {
    this.modalNuevaDevolucion.set(false);
    this.ventaSeleccionada.set(null);
    this.elegiblesVenta.set(null);
    this.itemsSeleccionados.set({});
  }

  buscarVentas(): void {
    const q = this.busquedaVentaQuery().trim();
    if (!q) return;

    this.buscandoVentas.set(true);
    this.busquedaRealizada.set(true);
    this.errorNuevaDevolucion.set('');

    this.devolucionesService.buscarVentas(q).subscribe({
      next: (ventas) => {
        this.ventasEncontradas.set(ventas);
        this.buscandoVentas.set(false);
      },
      error: () => {
        this.errorNuevaDevolucion.set('Error al buscar ventas en la base de datos.');
        this.buscandoVentas.set(false);
      },
    });
  }

  seleccionarVenta(venta: VentaBusquedaResumen): void {
    this.ventaSeleccionada.set(venta);
    this.cargandoElegibles.set(true);
    this.errorNuevaDevolucion.set('');

    this.devolucionesService.obtenerElegiblesVenta(venta.id_venta).subscribe({
      next: (elegibles) => {
        this.elegiblesVenta.set(elegibles);
        // Inicializar selección
        const sel: Record<number, ItemDevolucionSeleccion> = {};
        for (const item of elegibles.items) {
          sel[item.detalle_venta_id] = {
            seleccionado: item.disponible_para_devolver > 0,
            cantidad: item.disponible_para_devolver > 0 ? 1 : 0,
            item,
          };
        }
        this.itemsSeleccionados.set(sel);
        this.cargandoElegibles.set(false);
      },
      error: (err) => {
        this.cargandoElegibles.set(false);
        this.errorNuevaDevolucion.set(
          err?.error?.detail || 'No se pudieron cargar los artículos de la venta.',
        );
      },
    });
  }

  cambiarVenta(): void {
    this.ventaSeleccionada.set(null);
    this.elegiblesVenta.set(null);
    this.itemsSeleccionados.set({});
    this.errorNuevaDevolucion.set('');
  }

  toggleItemSeleccionado(detalleVentaId: number): void {
    const sel = { ...this.itemsSeleccionados() };
    const actual = sel[detalleVentaId];
    if (!actual || actual.item.disponible_para_devolver <= 0) return;

    const nuevoEstado = !actual.seleccionado;
    sel[detalleVentaId] = {
      ...actual,
      seleccionado: nuevoEstado,
      cantidad: nuevoEstado && actual.cantidad === 0 ? 1 : actual.cantidad,
    };
    this.itemsSeleccionados.set(sel);
  }

  modificarCantidad(detalleVentaId: number, delta: number): void {
    const sel = { ...this.itemsSeleccionados() };
    const actual = sel[detalleVentaId];
    if (!actual) return;

    const max = actual.item.disponible_para_devolver;
    const nuevaCant = Math.max(1, Math.min(max, actual.cantidad + delta));

    sel[detalleVentaId] = {
      ...actual,
      seleccionado: true,
      cantidad: nuevaCant,
    };
    this.itemsSeleccionados.set(sel);
  }

  registrarDevolucion(): void {
    const venta = this.ventaSeleccionada();
    if (!venta || !this.puedeCrearDevolucion()) return;

    const itemsADevolver = Object.values(this.itemsSeleccionados())
      .filter((s) => s.seleccionado && s.cantidad > 0)
      .map((s) => ({
        detalle_venta_id: s.item.detalle_venta_id,
        cantidad_devuelta: s.cantidad,
      }));

    if (itemsADevolver.length === 0) {
      this.errorNuevaDevolucion.set('Debe seleccionar al menos una prenda para devolver.');
      return;
    }

    const motivo = this.motivoDetalle().trim()
      ? `${this.motivoCategoria()}: ${this.motivoDetalle().trim()}`
      : this.motivoCategoria();

    const payload: DevolucionCrearPayload = {
      id_venta: venta.id_venta,
      motivo,
      items: itemsADevolver,
    };

    this.creandoDevolucion.set(true);
    this.errorNuevaDevolucion.set('');

    this.devolucionesService.crear(payload).subscribe({
      next: (nuevaDevolucion) => {
        this.creandoDevolucion.set(false);
        this.cerrarModalNuevaDevolucion();
        this.exitoMessage.set(
          `Devolución #${nuevaDevolucion.id_devolucion} registrada exitosamente para la venta ${venta.codigo}. Estado: Solicitada.`,
        );
        this.cargarDevoluciones();
        this.cargarKpis();
        setTimeout(() => this.exitoMessage.set(''), 4500);
      },
      error: (err) => {
        this.creandoDevolucion.set(false);
        this.errorNuevaDevolucion.set(
          err?.error?.detail || 'No se pudo registrar la devolución. Verifique los datos.',
        );
      },
    });
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

  accionesDisponibles(): AccionDevolucion[] {
    const d = this.devolucionDetalle();
    return d ? this.accionesPorEstado[d.estado] : [];
  }

  // --------------------------------------------------------------- procesar
  ejecutarAccion(accion: AccionDevolucion, devolucionDirecta?: Devolucion): void {
    const d = devolucionDirecta || this.devolucionDetalle();
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
          if (this.devolucionDetalle()?.id_devolucion === resp.id_devolucion) {
            this.devolucionDetalle.set(resp);
          }
          this.cargarDevoluciones();
          this.cargarKpis();
          setTimeout(() => this.exitoMessage.set(''), 4000);
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
        return `Devolución #${d.id_devolucion} aprobada. Lista para recepción de prendas.`;
      case 'RECHAZAR':
        return `Devolución #${d.id_devolucion} rechazada.`;
      case 'COMPLETAR':
        return `Devolución #${d.id_devolucion} completada. Stock reintegrado automáticamente al inventario de la sucursal y registrado en Kardex.`;
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
        return 'Completar y Reintegrar Stock';
    }
  }

  protected etiquetaDe(estado: string): string {
    if (estado === 'todos') return 'Todas';
    return this.etiquetasEstado[estado as EstadoDevolucion];
  }
}
