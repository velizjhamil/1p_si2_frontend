import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { VentasService, VentaFiltros } from './ventas.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { PosCheckoutDialogComponent } from './pos-checkout-dialog.component';
import { EstadoPago, MetodoPago, Venta, formatBs } from '../../core/models/carrito.model';
import { AuthService } from '../../core/services/auth.service';

type MetodoFiltro = 'TODOS' | MetodoPago;
type EstadoFiltro = 'TODOS' | EstadoPago;
type TipoFiltro = 'TODOS' | 'ONLINE' | 'POS';

/** Color del badge según método de pago (paleta del BadgeComponent). */
function badgeMetodo(m: MetodoPago): 'info' | 'success' | 'warning' {
  switch (m) {
    case 'QR':
      return 'info';
    case 'TARJETA':
      return 'success';
    case 'EFECTIVO':
      return 'warning';
  }
}

/** Color del badge según estado de pago. */
function badgeEstado(e: EstadoPago): 'success' | 'warning' | 'danger' {
  switch (e) {
    case 'PAGADO':
      return 'success';
    case 'PENDIENTE':
      return 'warning';
    case 'RECHAZADO':
      return 'danger';
  }
}

/** Etiqueta legible del método de pago para la tabla. */
function etiquetaMetodo(m: MetodoPago): string {
  return m.charAt(0) + m.slice(1).toLowerCase();
}

/**
 * CU15 + CU21 + CU11 — Gestión de Ventas (panel unificado por rol).
 *
 * Vista única compartida por ASU/GS/V/C. Cada rol ve una vista distinta
 * del MISMO backend, según:
 * - Filtros disponibles (tipo_venta y fechas solo para roles no-cliente).
 * - Columnas visibles (Tipo siempre para no-C; Vendedor para GS/ASU).
 * - Acciones (botón "Nueva venta POS" solo para V/GS/ASU).
 *
 * El aislamiento de VISIBILIDAD lo hace el backend:
 * - C: ve solo sus compras.
 * - V: ve solo las ventas POS que ÉL registró.
 * - GS/ASU: ven todas.
 * El frontend no replica esa lógica: la confía en el endpoint.
 */
@Component({
  selector: 'app-ventas',
  imports: [
    ReactiveFormsModule,
    BadgeComponent,
    DatePipe,
    PosCheckoutDialogComponent,
  ],
  templateUrl: './ventas.component.html',
})
export class VentasComponent implements OnInit {
  private readonly ventasService = inject(VentasService);
  private readonly auth = inject(AuthService);

  // ------------------------------------------------------------------ estado
  ventas = signal<Venta[]>([]);
  cargando = signal(true);
  errorMessage = signal('');
  vacio = computed(() => !this.cargando() && this.ventas().length === 0);

  // Paginación
  pagina = signal(1);
  limite = signal(20);
  total = signal(0);
  paginas = signal(1);

  // Modal de detalle
  modalAbierto = signal(false);
  cargandoDetalle = signal(false);
  errorDetalle = signal('');
  ventaDetalle = signal<Venta | null>(null);

  // Filtros como Reactive Forms para usar (input)/debounce limpio
  readonly controlBusqueda = new FormControl<string>('', { nonNullable: true });
  readonly controlMetodo = new FormControl<MetodoFiltro>('TODOS', {
    nonNullable: true,
  });
  readonly controlEstado = new FormControl<EstadoFiltro>('TODOS', {
    nonNullable: true,
  });
  readonly controlTipoVenta = new FormControl<TipoFiltro>('TODOS', {
    nonNullable: true,
  });
  // CU11: rango de fechas (inclusivo en ambos extremos).
  readonly controlFechaDesde = new FormControl<string>('', { nonNullable: true });
  readonly controlFechaHasta = new FormControl<string>('', { nonNullable: true });

  // Debounce de la búsqueda
  private debounceBusqueda: ReturnType<typeof setTimeout> | null = null;

  // ------------------------------------------------------------------- roles
  /** Rol actual del usuario autenticado (vacío si no hay sesión). */
  protected readonly rol = computed(() =>
    (this.auth.getRol() || '').toUpperCase(),
  );
  protected readonly esRolC = computed(() => this.rol() === 'C');
  protected readonly esRolV = computed(() => this.rol() === 'V');
  /** Solo V/GS/ASU pueden registrar ventas POS (CU11). */
  protected readonly puedeRegistrarPos = computed(() =>
    ['V', 'GS', 'ASU'].includes(this.rol()),
  );
  /** Solo GS/ASU ven la columna "Vendedor" (el V solo ve las suyas). */
  protected readonly puedeVerVendedor = computed(() =>
    ['GS', 'ASU'].includes(this.rol()),
  );

  // ------------------------------------------------------------------- KPIs
  /** Total de ventas registradas (de TODAS las páginas; el backend
   *  devuelve `total` ya agregado para esta query). */
  protected readonly totalVentas = computed(() => this.total());

  /** Suma de los totales de la página actual (proxy visible de ingresos). */
  protected readonly ingresosVisibles = computed(() =>
    this.ventas().reduce((suma, v) => suma + Number(v.total ?? 0), 0),
  );

  /** Cantidad de ventas de la página actual con fecha = hoy. */
  protected readonly ventasHoy = computed(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    return this.ventas().filter((v) => (v.fecha ?? '').startsWith(hoy)).length;
  });

  /** Ticket promedio de la página actual (total / cantidad). */
  protected readonly ticketPromedio = computed(() => {
    const items = this.ventas();
    if (items.length === 0) return 0;
    const suma = items.reduce((acc, v) => acc + Number(v.total ?? 0), 0);
    return suma / items.length;
  });

  ngOnInit(): void {
    // Reaccionar a cambios de filtros (cada filtro dispara recarga,
    // reseteando a la página 1). El input de búsqueda usa debounce.
    this.controlBusqueda.valueChanges.subscribe(() => this.alCambiarBusqueda());
    this.controlMetodo.valueChanges.subscribe(() => this.reiniciarYCargar());
    this.controlEstado.valueChanges.subscribe(() => this.reiniciarYCargar());
    this.controlTipoVenta.valueChanges.subscribe(() => this.reiniciarYCargar());
    this.controlFechaDesde.valueChanges.subscribe(() => this.reiniciarYCargar());
    this.controlFechaHasta.valueChanges.subscribe(() => this.reiniciarYCargar());

    this.cargar();
  }

  // ------------------------------------------------------------- data load
  private cargar(): void {
    this.cargando.set(true);
    this.errorMessage.set('');

    const filtros: VentaFiltros = {
      q: this.controlBusqueda.value.trim() || undefined,
      metodo_pago:
        this.controlMetodo.value === 'TODOS'
          ? undefined
          : (this.controlMetodo.value as MetodoPago),
      estado_pago:
        this.controlEstado.value === 'TODOS'
          ? undefined
          : (this.controlEstado.value as EstadoPago),
      tipo_venta:
        this.controlTipoVenta.value === 'TODOS' || this.esRolC()
          ? undefined
          : this.controlTipoVenta.value,
      fecha_desde: this.controlFechaDesde.value || undefined,
      fecha_hasta: this.controlFechaHasta.value || undefined,
      page: this.pagina(),
      limit: this.limite(),
    };

    this.ventasService.listar(filtros).subscribe({
      next: (resp) => {
        this.ventas.set(resp.items);
        this.total.set(resp.total);
        this.paginas.set(resp.pages);
        this.pagina.set(resp.page);
        this.cargando.set(false);
      },
      error: (err) => {
        this.errorMessage.set(
          err?.error?.detail || 'No se pudo cargar el historial de ventas.',
        );
        this.ventas.set([]);
        this.cargando.set(false);
      },
    });
  }

  private reiniciarYCargar(): void {
    this.pagina.set(1);
    this.cargar();
  }

  /** Debounce 400ms para no spammear el backend mientras se tipea. */
  private alCambiarBusqueda(): void {
    if (this.debounceBusqueda) clearTimeout(this.debounceBusqueda);
    this.debounceBusqueda = setTimeout(() => this.reiniciarYCargar(), 400);
  }

  // ------------------------------------------------------------ paginación
  protected irPaginaAnterior(): void {
    if (this.pagina() <= 1) return;
    this.pagina.update((p) => p - 1);
    this.cargar();
  }

  protected irPaginaSiguiente(): void {
    if (this.pagina() >= this.paginas()) return;
    this.pagina.update((p) => p + 1);
    this.cargar();
  }

  protected limpiarFiltros(): void {
    this.controlBusqueda.setValue('', { emitEvent: false });
    this.controlMetodo.setValue('TODOS', { emitEvent: false });
    this.controlEstado.setValue('TODOS', { emitEvent: false });
    this.controlTipoVenta.setValue('TODOS', { emitEvent: false });
    this.controlFechaDesde.setValue('', { emitEvent: false });
    this.controlFechaHasta.setValue('', { emitEvent: false });
    if (this.debounceBusqueda) clearTimeout(this.debounceBusqueda);
    this.pagina.set(1);
    this.cargar();
  }

  // --------------------------------------------------------- modal detalle
  protected abrirDetalle(venta: Venta): void {
    this.ventaDetalle.set(venta);
    this.modalAbierto.set(true);
    this.cargandoDetalle.set(true);
    this.errorDetalle.set('');

    this.ventasService.obtener(venta.id).subscribe({
      next: (completa) => {
        this.ventaDetalle.set(completa);
        this.cargandoDetalle.set(false);
      },
      error: (err) => {
        this.errorDetalle.set(
          err?.error?.detail || 'No se pudo cargar el detalle de la venta.',
        );
        this.cargandoDetalle.set(false);
      },
    });
  }

  protected cerrarDetalle(): void {
    this.modalAbierto.set(false);
    this.ventaDetalle.set(null);
    this.errorDetalle.set('');
  }

  protected imprimirDetalle(): void {
    window.print();
  }

  // -------------------------------------------------------- POS (CU11)
  /** Estado del modal POS (abierto/cerrado). */
  protected readonly posAbierto = signal(false);

  /**
   * CU11: abre el modal POS para registrar una venta en mostrador.
   * El modal maneja cliente + productos + cobro internamente y emite
   * un evento cuando la venta se registra con éxito.
   */
  protected abrirPos(): void {
    this.posAbierto.set(true);
  }

  /**
   * Callback del modal cuando se cierra.
   * Si registró una venta, recarga el listado para que aparezca.
   */
  protected onPosResultado(evento: { venta?: Venta }): void {
    this.posAbierto.set(false);
    if (evento && evento.venta) {
      // Recargar desde la primera página para que la venta nueva sea visible
      // (puede no entrar en la página actual si el filtro está muy fino).
      this.pagina.set(1);
      this.cargar();
    }
  }

  // --------------------------------------------------------- helpers vista
  protected badgeDeMetodo(m: MetodoPago) {
    return badgeMetodo(m);
  }
  protected badgeDeEstado(e: EstadoPago) {
    return badgeEstado(e);
  }
  protected etiquetaDeMetodo(m: MetodoPago) {
    return etiquetaMetodo(m);
  }
  protected formatoBs(monto: number) {
    return formatBs(monto);
  }
  protected nombreCliente(venta: Venta): string {
    return venta.datos_entrega?.nombre_cliente || '—';
  }
  protected correoCliente(venta: Venta): string {
    return venta.datos_entrega?.correo || '—';
  }
  /** Acorta un UUID a 8 chars para la columna Vendedor (sin perder unicidad visual). */
  protected acortarId(id: string): string {
    return id ? id.slice(0, 8) : '—';
  }
}
