import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, finalize } from 'rxjs';
import { CategoriasService } from '../categories/categories.service';
import { Categoria } from '../../core/models/categoria.model';
import { ApiResponse } from '../../core/models/usuario.model';
import {
  CanalVenta,
  DevolucionesReporte,
  EstadoDevolucion,
  FiltrosDevoluciones,
  FiltrosInventario,
  FiltrosProductosMasVendidos,
  FiltrosRendimientoVendedores,
  FiltrosReporteComunes,
  FormatoExportacion,
  InventarioSituacion,
  NivelStock,
  ProductosMasVendidos,
  RendimientoVendedores,
  TipoReporte,
  VentasPeriodo,
} from '../../core/models/reporte.model';
import {
  TipoErrorReporte,
  ReportesService,
  mensajeErrorReporte,
  nombreArchivoExportacion,
  tipoErrorReporte,
} from './reportes.service';
import { DescargaArchivoService } from './descarga-archivo.service';
import { DevolucionesVistaComponent } from './vistas/devoluciones-vista.component';
import { InventarioVistaComponent } from './vistas/inventario-vista.component';
import { RendimientoVistaComponent } from './vistas/rendimiento-vista.component';
import { TopVistaComponent } from './vistas/top-vista.component';
import { VentasVistaComponent } from './vistas/ventas-vista.component';

/** Texto de "sin datos" (el backend lo envía en `mensaje`; este es el respaldo). */
export const MENSAJE_SIN_DATOS = 'No se encontraron datos para los parámetros ingresados.';

/** Campos de filtro que existen en la pantalla; cada reporte muestra solo los que su endpoint soporta. */
type Campo = 'fechas' | 'categoria' | 'canal' | 'top' | 'nivel' | 'limite' | 'estado' | 'limiteDetalle';

interface PestanaReporte {
  tipo: TipoReporte;
  etiqueta: string;
  descripcion: string;
}

const PESTANAS: PestanaReporte[] = [
  { tipo: 'ventas', etiqueta: 'Ventas', descripcion: 'Ventas del período: indicadores, evolución diaria y desglose.' },
  { tipo: 'productos-mas-vendidos', etiqueta: 'Productos más vendidos', descripcion: 'Ranking de productos por unidades vendidas.' },
  { tipo: 'inventario', etiqueta: 'Inventario', descripcion: 'Situación actual del stock y rotación aproximada.' },
  { tipo: 'devoluciones', etiqueta: 'Devoluciones', descripcion: 'Devoluciones del período por estado, producto y categoría.' },
  { tipo: 'rendimiento-vendedores', etiqueta: 'Rendimiento de vendedores', descripcion: 'Ventas e ingresos por vendedor.' },
];

/** Filtros que soporta el endpoint de cada reporte (deben coincidir con el backend). */
const CAMPOS: Record<TipoReporte, readonly Campo[]> = {
  ventas: ['fechas', 'categoria', 'canal'],
  'productos-mas-vendidos': ['fechas', 'categoria', 'canal', 'top'],
  inventario: ['fechas', 'categoria', 'canal', 'nivel', 'limite'],
  devoluciones: ['fechas', 'categoria', 'canal', 'estado', 'top', 'limiteDetalle'],
  'rendimiento-vendedores': ['fechas', 'canal'],
};

type EstadoPantalla = 'inicial' | 'cargando' | 'datos' | 'sin-datos' | 'error';

interface ErrorPantalla {
  tipo: TipoErrorReporte;
  mensaje: string;
}

/** Resumen de los filtros que el backend aplicó (con sus valores por defecto). */
interface ResumenFiltros {
  periodo: string;
  categoria: string | null;
  canal: string | null;
  extras: string[];
}

const ETIQUETA_CANAL: Record<CanalVenta, string> = { ONLINE: 'Online', POS: 'POS (mostrador)' };

/**
 * CU20 — Gestión de Reportes (ASU/GS).
 *
 * Contenedor de la pantalla: selector de reporte, filtros (solo los que
 * soporta cada endpoint), estados de UI (cargando / datos / sin datos /
 * error 401-403-422-inesperado) y delegación de la presentación a las vistas.
 *
 * No calcula nada: consume los DTOs del backend. Los filtros se aplican con
 * el botón (o al cambiar de reporte): una sola solicitud por acción, y una
 * consulta nueva cancela la que esté en curso.
 *
 * Fechas: se envían como las eligió el usuario (`YYYY-MM-DD`); el backend las
 * interpreta como día UTC. Si se dejan vacías, el backend usa los últimos 30
 * días (UTC) y la pantalla muestra el período realmente aplicado.
 */
@Component({
  selector: 'app-reportes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    VentasVistaComponent,
    TopVistaComponent,
    InventarioVistaComponent,
    DevolucionesVistaComponent,
    RendimientoVistaComponent,
  ],
  templateUrl: './reportes.component.html',
})
export class ReportesComponent implements OnInit {
  private readonly reportes = inject(ReportesService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly descarga = inject(DescargaArchivoService);

  protected readonly pestanas = PESTANAS;
  protected readonly etiquetaCanal = ETIQUETA_CANAL;

  // ------------------------------------------------------------- selección
  protected readonly tipo = signal<TipoReporte>('ventas');
  protected readonly pestanaActual = computed(() => PESTANAS.find((p) => p.tipo === this.tipo())!);

  // ---------------------------------------------------------------- filtros
  // Se guardan como texto del formulario ('' = sin filtro) y se convierten al enviar.
  protected readonly fechaInicio = signal('');
  protected readonly fechaFin = signal('');
  protected readonly categoriaId = signal('');
  protected readonly canal = signal<'' | CanalVenta>('');
  protected readonly top = signal('');
  protected readonly nivelStock = signal<'' | NivelStock>('');
  protected readonly limite = signal('');
  protected readonly estadoDevolucion = signal<'' | EstadoDevolucion>('');
  protected readonly limiteDetalle = signal('');

  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly errorCategorias = signal(false);

  // ---------------------------------------------------------------- estado
  protected readonly estado = signal<EstadoPantalla>('inicial');
  protected readonly error = signal<ErrorPantalla | null>(null);
  protected readonly mensajeSinDatos = signal(MENSAJE_SIN_DATOS);
  protected readonly resumen = signal<ResumenFiltros | null>(null);
  /** Reporte cuyo resultado se muestra (puede diferir de `tipo` mientras carga). */
  protected readonly tipoMostrado = signal<TipoReporte | null>(null);

  protected readonly ventas = signal<VentasPeriodo | null>(null);
  protected readonly productos = signal<ProductosMasVendidos | null>(null);
  protected readonly inventario = signal<InventarioSituacion | null>(null);
  protected readonly devoluciones = signal<DevolucionesReporte | null>(null);
  protected readonly rendimiento = signal<RendimientoVendedores | null>(null);

  // ---------------------------------------------------------- exportación
  /**
   * Instantánea de la consulta que se está viendo (reporte + filtros EXACTOS
   * enviados). La exportación usa esto, no el formulario: si el usuario edita
   * un filtro y no pulsa "Aplicar", el archivo sigue siendo el de la pantalla.
   */
  private readonly consultaAplicada = signal<{ tipo: TipoReporte; filtros: object } | null>(null);
  /** Período que resolvió el backend (para el nombre del archivo). */
  private readonly periodoAplicado = signal<{ inicio: string; fin: string } | null>(null);
  protected readonly exportando = signal<FormatoExportacion | null>(null);
  protected readonly errorExportacion = signal<string | null>(null);
  /** Hay un reporte mostrado (con datos o "sin datos") que se puede exportar. */
  protected readonly puedeExportar = computed(
    () => (this.estado() === 'datos' || this.estado() === 'sin-datos') && this.consultaAplicada() !== null,
  );

  private consultaActual: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.consultaActual?.unsubscribe());
  }

  ngOnInit(): void {
    this.cargarCategorias();
    this.consultar();
  }

  // -------------------------------------------------------------- acciones
  protected muestra(campo: Campo): boolean {
    return CAMPOS[this.tipo()].includes(campo);
  }

  protected seleccionar(tipo: TipoReporte): void {
    if (tipo === this.tipo() && this.estado() !== 'error') return;
    this.tipo.set(tipo);
    this.consultar();
  }

  protected limpiar(): void {
    this.fechaInicio.set('');
    this.fechaFin.set('');
    this.categoriaId.set('');
    this.canal.set('');
    this.top.set('');
    this.nivelStock.set('');
    this.limite.set('');
    this.estadoDevolucion.set('');
    this.limiteDetalle.set('');
    this.consultar();
  }

  /** Ejecuta la consulta del reporte seleccionado con los filtros actuales (cancela la anterior). */
  protected consultar(): void {
    this.consultaActual?.unsubscribe();
    const tipo = this.tipo();
    const filtros = this.filtrosDe(tipo); // instantánea de lo que se envía
    this.estado.set('cargando');
    this.error.set(null);
    this.resumen.set(null);
    this.consultaAplicada.set(null);
    this.periodoAplicado.set(null);
    this.errorExportacion.set(null);

    this.consultaActual = this.solicitar(tipo, filtros).subscribe({
      next: (resp) => {
        this.limpiarResultados();
        this.tipoMostrado.set(tipo);
        this.consultaAplicada.set({ tipo, filtros });
        const sinDatos = this.guardarResultado(tipo, resp);
        this.estado.set(sinDatos ? 'sin-datos' : 'datos');
      },
      error: (err: unknown) => {
        this.limpiarResultados();
        this.error.set({ tipo: tipoErrorReporte(err), mensaje: mensajeErrorReporte(err) });
        this.estado.set('error');
      },
    });
  }

  /** Descarga el reporte mostrado en PDF o Excel, con los filtros aplicados en la última consulta. */
  protected exportar(formato: FormatoExportacion): void {
    const consulta = this.consultaAplicada();
    const periodo = this.periodoAplicado();
    if (!consulta || !periodo || this.exportando()) return;

    this.exportando.set(formato);
    this.errorExportacion.set(null);
    this.reportes
      .exportar(consulta.tipo, formato, consulta.filtros)
      .pipe(finalize(() => this.exportando.set(null)))
      .subscribe({
        next: (blob) =>
          this.descarga.descargar(blob, nombreArchivoExportacion(consulta.tipo, periodo.inicio, periodo.fin, formato)),
        // 401: el ErrorInterceptor cierra la sesión; 403/422/otros: mensaje junto a los botones
        error: (err: unknown) => this.errorExportacion.set(mensajeErrorReporte(err)),
      });
  }

  // ------------------------------------------------------------- privados
  private cargarCategorias(): void {
    // Mismo servicio del CU9 (límite máximo del backend = 100).
    this.categoriasService.getCategorias({ limit: 100 }).subscribe({
      next: (resp) => this.categorias.set(resp.data),
      error: () => this.errorCategorias.set(true),
    });
  }

  private filtrosComunes(): FiltrosReporteComunes {
    return {
      fecha_inicio: this.fechaInicio() || undefined,
      fecha_fin: this.fechaFin() || undefined,
      categoria_id: this.categoriaId() ? Number(this.categoriaId()) : undefined,
      canal_venta: this.canal() || undefined,
    };
  }

  private numero(valor: string): number | undefined {
    return valor === '' ? undefined : Number(valor);
  }

  /** Filtros que soporta el endpoint de cada reporte, tomados del formulario en este momento. */
  private filtrosDe(tipo: TipoReporte): object {
    switch (tipo) {
      case 'ventas':
        return this.filtrosComunes();
      case 'productos-mas-vendidos':
        return { ...this.filtrosComunes(), top: this.numero(this.top()) };
      case 'inventario':
        return {
          ...this.filtrosComunes(),
          nivel_stock: this.nivelStock() || undefined,
          limite: this.numero(this.limite()),
        };
      case 'devoluciones':
        return {
          ...this.filtrosComunes(),
          estado: this.estadoDevolucion() || undefined,
          top: this.numero(this.top()),
          limite_detalle: this.numero(this.limiteDetalle()),
        };
      case 'rendimiento-vendedores':
        return {
          fecha_desde: this.fechaInicio() || undefined,
          fecha_hasta: this.fechaFin() || undefined,
          tipo_venta: this.canal() || undefined,
        };
    }
  }

  /** Llama al endpoint del reporte con los filtros ya construidos. */
  private solicitar(tipo: TipoReporte, filtros: object): Observable<ApiResponse<unknown>> {
    switch (tipo) {
      case 'ventas':
        return this.reportes.getVentas(filtros as FiltrosReporteComunes);
      case 'productos-mas-vendidos':
        return this.reportes.getProductosMasVendidos(filtros as FiltrosProductosMasVendidos);
      case 'inventario':
        return this.reportes.getInventario(filtros as FiltrosInventario);
      case 'devoluciones':
        return this.reportes.getDevoluciones(filtros as FiltrosDevoluciones);
      case 'rendimiento-vendedores':
        return this.reportes.getRendimientoVendedores(filtros as FiltrosRendimientoVendedores);
    }
  }

  private limpiarResultados(): void {
    this.ventas.set(null);
    this.productos.set(null);
    this.inventario.set(null);
    this.devoluciones.set(null);
    this.rendimiento.set(null);
    this.tipoMostrado.set(null);
  }

  /** Guarda la respuesta en su señal y devuelve `true` si el backend indica "sin datos". */
  private guardarResultado(tipo: TipoReporte, resp: ApiResponse<unknown>): boolean {
    const nombreCategoria = (id: number | null) =>
      id === null ? null : (this.categorias().find((c) => c.id_categoria === id)?.nombre ?? `#${id}`);

    switch (tipo) {
      case 'ventas': {
        const d = resp.data as VentasPeriodo;
        this.ventas.set(d);
        this.resumen.set(this.resumenComun(d.filtros.fecha_inicio, d.filtros.fecha_fin, nombreCategoria(d.filtros.categoria_id), d.filtros.canal_venta, []));
        return this.sinDatos(d.sin_datos, d.mensaje);
      }
      case 'productos-mas-vendidos': {
        const d = resp.data as ProductosMasVendidos;
        this.productos.set(d);
        this.resumen.set(this.resumenComun(d.filtros.fecha_inicio, d.filtros.fecha_fin, nombreCategoria(d.filtros.categoria_id), d.filtros.canal_venta, [`Top ${d.top}`]));
        return this.sinDatos(d.sin_datos, d.mensaje);
      }
      case 'inventario': {
        const d = resp.data as InventarioSituacion;
        this.inventario.set(d);
        const extras = [
          ...(this.nivelStock() ? [`Nivel ${this.nivelStock()}`] : []),
          `Límite ${d.limite} filas`,
        ];
        this.resumen.set(this.resumenComun(d.filtros.fecha_inicio, d.filtros.fecha_fin, nombreCategoria(d.filtros.categoria_id), d.filtros.canal_venta, extras, 'Ventana de rotación'));
        return this.sinDatos(d.sin_datos, d.mensaje);
      }
      case 'devoluciones': {
        const d = resp.data as DevolucionesReporte;
        this.devoluciones.set(d);
        this.resumen.set(this.resumenComun(d.filtros.fecha_inicio, d.filtros.fecha_fin, nombreCategoria(d.filtros.categoria_id), d.filtros.canal_venta, d.estado ? [`Estado ${d.estado}`] : []));
        return this.sinDatos(d.sin_datos, d.mensaje);
      }
      case 'rendimiento-vendedores': {
        const d = resp.data as RendimientoVendedores;
        this.rendimiento.set(d);
        // Este endpoint no devuelve `sin_datos` ni los filtros de canal: sin vendedores = sin datos.
        this.resumen.set(this.resumenComun(d.fecha_desde, d.fecha_hasta, null, this.canal() || null, []));
        return this.sinDatos(d.items.length === 0, null);
      }
    }
  }

  private sinDatos(sinDatos: boolean, mensaje: string | null): boolean {
    this.mensajeSinDatos.set(mensaje || MENSAJE_SIN_DATOS);
    return sinDatos;
  }

  private resumenComun(
    inicio: string,
    fin: string,
    categoria: string | null,
    canal: CanalVenta | null,
    extras: string[],
    etiquetaPeriodo = 'Período',
  ): ResumenFiltros {
    this.periodoAplicado.set({ inicio, fin });
    return {
      periodo: `${etiquetaPeriodo}: ${inicio} → ${fin} (UTC)`,
      categoria,
      canal: canal ? ETIQUETA_CANAL[canal] : null,
      extras,
    };
  }
}
