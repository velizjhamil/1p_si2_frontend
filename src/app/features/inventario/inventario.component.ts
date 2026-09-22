import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventarioService } from './inventario.service';
import { AuthService } from '../../core/services/auth.service';
import { RbacService } from '../../core/services/rbac.service';
import { SucursalesService } from '../branches/branches.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import {
 MovimientoInventario,
 STOCK_CRITICO,
 STOCK_MEDIO,
 StockProducto,
 TipoMovimiento,
} from '../../core/models/inventario.model';
import { Sucursal } from '../../core/models/sucursal.model';
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
 * Gestión de Inventario.
 * KPIs de stock, tabla de stock actual con alertas visuales por umbral,
 * aislamiento multi-sucursal y kardex.
 */
@Component({
 selector: 'app-inventario',
 imports: [ReactiveFormsModule, BadgeComponent, DatePipe],
 templateUrl: './inventario.component.html',
})
export class InventarioComponent implements OnInit {
 private readonly fb = inject(FormBuilder);
 private readonly inventarioService = inject(InventarioService);
 private readonly authService = inject(AuthService);
 private readonly rbacService = inject(RbacService);
 private readonly sucursalesService = inject(SucursalesService);

 // ------------------------------------------------------------------ estado
 stock = signal<StockProducto[]>([]);
 movimientos = signal<MovimientoInventario[]>([]);
 sucursales = signal<Sucursal[]>([]);
 cargando = signal(true);
 guardando = signal(false);
 errorMessage = signal('');
 exitoMessage = signal('');

 // Filtros del inventario y kardex
 filtroTipo = signal<FiltroTipo>('todos');
 filtroFecha = signal('');
 filtroSucursal = signal<number | null>(null);

 modalAbierto = signal(false);

 readonly esAdmin = computed(() => this.rbacService.esAdmin());
 readonly esGerente = computed(() => this.rbacService.esGerente());
 readonly esOperativoSucursal = computed(
 () => this.rbacService.esGerente() || this.rbacService.esVendedor(),
 );
 readonly usuarioActual = computed(() => this.authService.usuario());
 readonly sucursalAsignadaNombre = computed(
 () => this.usuarioActual()?.sucursal_nombre ?? null,
 );

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
 id_sucursal: [''],
 });

 ngOnInit(): void {
 if (this.esAdmin()) {
 this.sucursalesService.getSucursales().subscribe({
 next: (resp) => this.sucursales.set(resp.data),
 error: () => console.error('Error al cargar sucursales en inventario'),
 });
 } else if (this.esOperativoSucursal()) {
 const sucId = this.usuarioActual()?.id_sucursal;
 if (sucId) {
 this.filtroSucursal.set(sucId);
 }
 }
 this.cargarDatos();
 }

 cargarDatos(): void {
 this.cargando.set(true);
 const sucId = this.filtroSucursal();
 this.inventarioService.getStockActual(sucId).subscribe({
 next: (stock) => {
 this.stock.set(stock);
 this.cargando.set(false);
 },
 error: () => {
 this.errorMessage.set('No se pudo cargar el stock actual.');
 this.cargando.set(false);
 },
 });
 this.inventarioService.getHistorialMovimientos(sucId).subscribe({
 next: (movs) => this.movimientos.set(movs),
 error: () => this.errorMessage.set('No se pudo cargar el historial.'),
 });
 }

 onCambioSucursal(event: Event): void {
 const val = (event.target as HTMLSelectElement).value;
 this.filtroSucursal.set(val ? Number(val) : null);
 this.cargarDatos();
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
 const sucursalDefault = this.esAdmin()
 ? (this.filtroSucursal() ? String(this.filtroSucursal()) : '')
 : String(this.usuarioActual()?.id_sucursal ?? '');

 this.movimientoForm.reset({
 producto_id: '',
 tipo: 'ENTRADA',
 cantidad: '',
 motivo: '',
 id_sucursal: sucursalDefault,
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
 const sucIdFinal = this.esAdmin()
 ? (form.id_sucursal ? Number(form.id_sucursal) : undefined)
 : (this.usuarioActual()?.id_sucursal ?? undefined);

 const payload = {
 producto_id: Number(form.producto_id),
 cantidad: Number(form.cantidad),
 motivo: form.motivo || '',
 id_sucursal: sucIdFinal,
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
