import {
 Component,
 EventEmitter,
 Output,
 computed,
 inject,
 signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormBuilder, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CarritoService } from '../../core/services/carrito.service';
import {
 CarritoItem,
 DatosEntrega,
 MetodoPago,
 Venta,
 formatBs,
} from '../../core/models/carrito.model';
import {
 ApiResponse,
 UsuarioList,
} from '../../core/models/usuario.model';
import {
 ProductoRopa,
 ProductosPage,
} from '../../core/models/producto.model';
import { ApiService } from '../../core/services/api';

/** Métodos de pago del POS (mismas opciones que el checkout del Cliente). */
const METODOS_PAGO: { id: MetodoPago; label: string; icono: string; descripcion: string }[] = [
 { id: 'EFECTIVO', label: 'Efectivo', icono: '💵', descripcion: 'Pago en caja al retirar' },
 { id: 'QR', label: 'QR Simple', icono: '📱', descripcion: 'Cobro por QR' },
 { id: 'TARJETA', label: 'Tarjeta', icono: '💳', descripcion: 'Posnet / datáfono' },
];

/** Pasos del wizard del POS. */
type Paso = 'cliente' | 'productos' | 'cobro';

/**
 * Modal Punto de Venta (POS) del Vendedor/GS/ASU.
 *
 * Wizard de 3 pasos:
 * 1. Cliente: buscar y seleccionar un cliente registrado (rol C).
 * 2. Productos: buscar productos activos y agregarlos al carrito local
 * con variante (talla + color) y cantidad.
 * 3. Cobro: completar datos de entrega (precargados del cliente),
 * elegir método de pago, y registrar la venta.
 *
 * El carrito es LOCAL al modal (no toca el CarritoService global) para
 * no contaminar el carrito del Cliente si el Vendedor/Admin también
 * navega por la tienda. El POST se hace via
 * `CarritoService.procesarVentaPos()` que ya arma el payload con
 * `tipo_venta: 'POS'` y `id_cliente_override`.
 *
 * Al cerrarse con éxito emite `ventaRegistrada` para que la pantalla
 * de Gestión de Ventas refresque el listado.
 */
@Component({
 selector: 'app-pos-checkout-dialog',
 imports: [ReactiveFormsModule, DatePipe],
 templateUrl: './pos-checkout-dialog.component.html',
})
export class PosCheckoutDialogComponent {
 private readonly api = inject(ApiService);
 private readonly carrito = inject(CarritoService);
 private readonly fb = inject(FormBuilder);

 // Outputs
 /** Emite al cerrarse. Si hay venta, se incluye para que el padre recargue. */
 @Output() readonly resultado = new EventEmitter<{ venta?: Venta }>();

 // ----------------------------- estado del wizard ----------------------------
 readonly paso = signal<Paso>('cliente');

 // ----------------------------- estado del paso 1 ----------------------------
 readonly busquedaCliente = new FormControl<string>('', { nonNullable: true });
 readonly clientes = signal<UsuarioList[]>([]);
 readonly cargandoClientes = signal(false);
 readonly clienteSeleccionado = signal<UsuarioList | null>(null);

 // ----------------------------- estado del paso 2 ----------------------------
 readonly busquedaProducto = new FormControl<string>('', { nonNullable: true });
 readonly productos = signal<ProductoRopa[]>([]);
 readonly cargandoProductos = signal(false);
 readonly productosTotal = signal(0);
 readonly productosPagina = signal(1);
 readonly productosLimite = signal(10);
 /** Producto cuyo inline-expander de variante está abierto. */
 readonly productoExpandido = signal<number | null>(null);
 /** Items agregados al carrito del POS (estado local del modal). */
 readonly carritoPos = signal<CarritoItem[]>([]);
 /** Producto+variante que se está agregando (controla el form inline). */
 readonly formVariante = this.fb.group({
 talla: ['', Validators.required],
 color: ['', Validators.required],
 cantidad: [1, [Validators.required, Validators.min(1)]],
 });

 // ----------------------------- estado del paso 3 ----------------------------
 readonly metodoPagoSeleccionado = signal<MetodoPago>('EFECTIVO');
 readonly procesando = signal(false);
 readonly errorCobro = signal('');
 readonly ventaExitosa = signal<Venta | null>(null);
 readonly datosEntregaForm = this.fb.group({
 nombre_cliente: ['', [Validators.required, Validators.minLength(3)]],
 correo: ['', [Validators.required, Validators.email]],
 telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
 direccion: ['', [Validators.required, Validators.minLength(5)]],
 ciudad: ['', Validators.required],
 referencia: [''],
 });

 // ----------------------------- helpers de vista ----------------------------
 protected readonly formatBs = formatBs;
 protected readonly metodos = METODOS_PAGO;

 /** Subtotal del carrito del POS. */
 protected readonly subtotalPos = computed(() =>
 this.carritoPos().reduce((acc, i) => acc + i.subtotal, 0),
 );

 /** Cantidad de unidades en el carrito. */
 protected readonly contadorPos = computed(() =>
 this.carritoPos().reduce((acc, i) => acc + i.cantidad, 0),
 );

 /** Total a pagar (sin envío: el POS es pago en tienda, no hay delivery). */
 protected readonly totalPos = computed(() => this.subtotalPos());

 // ----------------------------- lifecycle -----------------------------------
 constructor() {
 // Búsqueda de clientes con debounce
 this.busquedaCliente.valueChanges
 .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
 .subscribe(() => this.buscarClientes());

 // Búsqueda de productos con debounce
 this.busquedaProducto.valueChanges
 .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
 .subscribe(() => {
 this.productosPagina.set(1);
 this.buscarProductos();
 });
 }

 // ===========================================================================
 // Paso 1: clientes
 // ===========================================================================
 protected buscarClientes(): void {
 this.cargandoClientes.set(true);
 // GET /usuarios sin filtro server-side por rol; filtramos client-side
 // por rol.nombre_rol === 'C' (única vía hasta que se agregue query param).
 this.api.get<ApiResponse<UsuarioList[]>>('/usuarios').subscribe({
 next: (resp) => {
 const term = this.busquedaCliente.value.trim().toLowerCase();
 const todos = resp.data.filter(
 (u) => u.rol?.nombre_rol === 'C' && u.estado,
 );
 const filtrados = term
 ? todos.filter(
 (u) =>
 u.nombre.toLowerCase().includes(term) ||
 u.correo.toLowerCase().includes(term) ||
 (u.apellido || '').toLowerCase().includes(term),
 )
 : todos;
 this.clientes.set(filtrados.slice(0, 20));
 this.cargandoClientes.set(false);
 },
 error: () => {
 this.clientes.set([]);
 this.cargandoClientes.set(false);
 },
 });
 }

 protected elegirCliente(cliente: UsuarioList): void {
 this.clienteSeleccionado.set(cliente);
 // Pre-cargar los datos de entrega con la info del cliente
 this.datosEntregaForm.patchValue({
 nombre_cliente:
 `${cliente.nombre} ${cliente.apellido ?? ''}`.trim() || cliente.nombre,
 correo: cliente.correo,
 });
 this.paso.set('productos');
 this.buscarProductos();
 }

 // ===========================================================================
 // Paso 2: productos
 // ===========================================================================
 protected buscarProductos(): void {
 this.cargandoProductos.set(true);
 const term = this.busquedaProducto.value.trim();
 const params = new URLSearchParams();
 if (term) params.set('q', term);
 params.set('estado', 'Activo');
 params.set('page', String(this.productosPagina()));
 params.set('limit', String(this.productosLimite()));
 this.api
 .get<ProductosPage>(`/productos?${params.toString()}`)
 .subscribe({
 next: (resp) => {
 this.productos.set(resp.data);
 this.productosTotal.set(resp.total);
 this.cargandoProductos.set(false);
 },
 error: () => {
 this.productos.set([]);
 this.cargandoProductos.set(false);
 },
 });
 }

 protected toggleExpandirProducto(id: number): void {
 const actual = this.productoExpandido();
 if (actual === id) {
 this.productoExpandido.set(null);
 } else {
 this.productoExpandido.set(id);
 // Reset del form con la primera variante disponible
 const p = this.productos().find((x) => x.id_producto === id);
 if (p) {
 this.formVariante.reset({
 talla: p.tallas[0]?.nombre_talla ?? '',
 color: p.colores[0]?.nombre_color ?? '',
 cantidad: 1,
 });
 }
 }
 }

 protected agregarAlCarritoPos(producto: ProductoRopa): void {
 const f = this.formVariante.value;
 if (!f.talla || !f.color || !f.cantidad || f.cantidad < 1) return;
 if (f.cantidad > producto.stock_total) return;

 const nuevo: CarritoItem = {
 producto_id: producto.id_producto,
 nombre: producto.nombre,
 talla: f.talla,
 color: f.color,
 color_hex:
 producto.colores.find((c) => c.nombre_color === f.color)?.codigo_hex ||
 '#1d528d',
 precio: Number(producto.precio_venta),
 cantidad: f.cantidad,
 subtotal: Number(producto.precio_venta) * f.cantidad,
 imagen_url: producto.imagen_url,
 };

 this.carritoPos.update((items) => {
 // Si ya existe la misma variante, acumula cantidad
 const idx = items.findIndex(
 (i) =>
 i.producto_id === nuevo.producto_id &&
 i.talla === nuevo.talla &&
 i.color === nuevo.color,
 );
 if (idx >= 0) {
 const copia = [...items];
 const nuevaCant = copia[idx].cantidad + nuevo.cantidad;
 copia[idx] = {
 ...copia[idx],
 cantidad: nuevaCant,
 subtotal: copia[idx].precio * nuevaCant,
 };
 return copia;
 }
 return [...items, nuevo];
 });

 this.productoExpandido.set(null);
 }

 protected eliminarDelCarritoPos(idx: number): void {
 this.carritoPos.update((items) => items.filter((_, i) => i !== idx));
 }

 protected irCobro(): void {
 if (this.carritoPos().length === 0) return;
 this.paso.set('cobro');
 }

 // ===========================================================================
 // Paso 3: cobro
 // ===========================================================================
 protected elegirMetodoPago(m: MetodoPago): void {
 this.metodoPagoSeleccionado.set(m);
 }

 protected cobrar(): void {
 if (this.procesando()) return;
 const cliente = this.clienteSeleccionado();
 if (!cliente) return;
 if (this.datosEntregaForm.invalid) {
 this.errorCobro.set(
 'Complete los datos de entrega (teléfono 7-8 dígitos, email válido).',
 );
 return;
 }
 if (this.carritoPos().length === 0) {
 this.errorCobro.set('El carrito está vacío.');
 return;
 }

 const datos: DatosEntrega = {
 nombre_cliente: this.datosEntregaForm.value.nombre_cliente!.trim(),
 correo: this.datosEntregaForm.value.correo!.trim(),
 telefono: this.datosEntregaForm.value.telefono!.trim(),
 direccion: this.datosEntregaForm.value.direccion!.trim(),
 ciudad: this.datosEntregaForm.value.ciudad!,
 referencia:
 this.datosEntregaForm.value.referencia?.trim() || undefined,
 };

 this.procesando.set(true);
 this.errorCobro.set('');

 this.carrito
 .procesarVentaPos(
 this.carritoPos(),
 this.metodoPagoSeleccionado(),
 datos,
 cliente.id_usuario,
 )
 .subscribe({
 next: (venta) => {
 this.procesando.set(false);
 this.ventaExitosa.set(venta);
 },
 error: (err: { error?: { detail?: string } }) => {
 this.errorCobro.set(
 err?.error?.detail ??
 'La venta no pudo procesarse. Intente nuevamente.',
 );
 this.procesando.set(false);
 },
 });
 }

 protected cerrarExito(): void {
 const v = this.ventaExitosa();
 this.ventaExitosa.set(null);
 this.resultado.emit(v ? { venta: v } : {});
 }

 // ===========================================================================
 // Navegación del wizard
 // ===========================================================================
 protected volverAProductos(): void {
 this.paso.set('productos');
 }
 protected volverAClientes(): void {
 this.paso.set('cliente');
 }

 protected cerrar(): void {
 this.resultado.emit({});
 }

 // ===========================================================================
 // Helpers visuales
 // ===========================================================================
 protected nombreCompleto(u: UsuarioList): string {
 return u.apellido
 ? `${u.nombre} ${u.apellido}`
 : u.nombre;
 }
}
