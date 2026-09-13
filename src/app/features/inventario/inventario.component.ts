import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventarioService } from './inventario.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import {
  MovimientoInventario,
  STOCK_CRITICO,
  STOCK_MEDIO,
  StockProducto,
  TipoMovimiento,
} from '../../core/models/inventario.model';
type FiltroTipo = 'todos' | TipoMovimiento;

/** Badge de stock según umbrales: crítico (<5) rojo, medio (<15) ámbar, OK verde. */
function badgeStock(stock: number): 'success' | 'warning' | 'danger' {
  if (stock < STOCK_CRITICO) return 'danger';
  if (stock < STOCK_MEDIO) return 'warning';
  return 'success';
}

/** Etiqueta legible del nivel de stock. */
function nivelStock(stock: number): string {
  if (stock < STOCK_CRITICO) return 'Crítico';
  if (stock < STOCK_MEDIO) return 'Bajo';
  return 'OK';
}

/**
 * CU22 — Gestión de Inventario (FASE MOCK).
 * KPIs de stock, tabla de stock actual con alertas visuales por umbral
 * (crítico <5 rojo, medio <15 ámbar, OK verde), historial de movimientos
 * (kardex) filtrable por tipo y fecha, y modal "+ Registrar Movimiento
 * de Stock" con ENTRADA/SALIDA/AJUSTE.
 */
@Component({
  selector: 'app-inventario',
  imports: [ReactiveFormsModule, BadgeComponent, DatePipe],
  templateUrl: './inventario.component.html',
})
export class InventarioComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inventarioService = inject(InventarioService);

  // ------------------------------------------------------------------ estado
  stock = signal<StockProducto[]>([]);
  movimientos = signal<MovimientoInventario[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  errorMessage = signal('');
  exitoMessage = signal('');

  // Filtros del historial
  filtroTipo = signal<FiltroTipo>('todos');
  filtroFecha = signal('');

  modalAbierto = signal(false);

  // ---------------------------------------------------------------- KPIs top
  /** Unidades totales sumadas de todos los productos. */
  protected readonly stockTotal = computed(() =>
    this.stock().reduce((suma, p) => suma + p.stock_actual, 0),
  );

  /** Productos con stock crítico (< 5 unidades). */
  protected readonly productosCriticos = computed(
    () => this.stock().filter((p) => p.stock_actual < STOCK_CRITICO).length,
  );

  /** SKUs distintos gestionados. */
  protected readonly totalProductos = computed(() => this.stock().length);

  // Historial filtrado (tipo + fecha, cliente-side sobre el kardex).
  protected readonly movimientosFiltrados = computed(() => {
    const tipo = this.filtroTipo();
    const fecha = this.filtroFecha();
    return this.movimientos().filter((m) => {
      if (tipo !== 'todos' && m.tipo !== tipo) return false;
      if (fecha && !m.fecha.startsWith(fecha)) return false;
      return true;
    });
  });

  // ------------------------------------------------------------- formulario
  movimientoForm = this.fb.group({
    producto_id: ['', Validators.required],
    tipo: ['ENTRADA', Validators.required],
    cantidad: ['', [Validators.required, Validators.min(0)]],
    motivo: [''],
  });

  ngOnInit(): void {
    this.cargarDatos();
  }

  private cargarDatos(): void {
    this.cargando.set(true);
    this.inventarioService.getStockActual().subscribe({
      next: (stock) => {
        this.stock.set(stock);
        this.cargando.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el stock actual.');
        this.cargando.set(false);
      },
    });
    this.inventarioService.getHistorialMovimientos().subscribe({
      next: (movs) => this.movimientos.set(movs),
      error: () => this.errorMessage.set('No se pudo cargar el historial.'),
    });
  }

  // -------------------------------------------------------------- UI helpers
  onFiltroTipo(tipo: FiltroTipo): void {
    this.filtroTipo.set(tipo);
  }

  onFiltroFecha(event: Event): void {
    this.filtroFecha.set((event.target as HTMLInputElement).value);
  }

  protected badgeDeStock(stock: number): 'success' | 'warning' | 'danger' {
    return badgeStock(stock);
  }

  protected nivelDeStock(stock: number): string {
    return nivelStock(stock);
  }

  protected badgeTipo(tipo: TipoMovimiento): 'success' | 'danger' | 'info' {
    switch (tipo) {
      case 'ENTRADA':
        return 'success';
      case 'SALIDA':
        return 'danger';
      default:
        return 'info';
    }
  }

  // ------------------------------------------------------------------ modal
  abrirModal(): void {
    this.movimientoForm.reset({
      producto_id: '',
      tipo: 'ENTRADA',
      cantidad: '',
      motivo: '',
    });
    this.errorMessage.set('');
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.errorMessage.set('');
  }

  /** Registra el movimiento según el tipo seleccionado y refresca todo. */
  guardar(): void {
    if (this.movimientoForm.invalid || this.guardando()) {
      this.errorMessage.set(
        'Complete producto, tipo y una cantidad válida (>= 0).',
      );
      return;
    }

    const form = this.movimientoForm.value;
    const payload = {
      producto_id: Number(form.producto_id),
      cantidad: Number(form.cantidad),
      motivo: form.motivo || '',
    };

    this.guardando.set(true);
    this.errorMessage.set('');

    const operacion$ =
      form.tipo === 'SALIDA'
        ? this.inventarioService.registrarSalida(payload)
        : form.tipo === 'AJUSTE'
          ? this.inventarioService.registrarAjuste(payload)
          : this.inventarioService.registrarEntrada(payload);

    operacion$.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalAbierto.set(false);
        this.exitoMessage.set('Movimiento registrado correctamente.');
        this.cargarDatos();
        setTimeout(() => this.exitoMessage.set(''), 3000);
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorMessage.set(
          err?.error?.detail ||
            'Ocurrió un error al registrar el movimiento. Intente nuevamente.',
        );
      },
    });
  }
}
