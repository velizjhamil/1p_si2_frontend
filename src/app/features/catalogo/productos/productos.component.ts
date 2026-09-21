import { DecimalPipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ProductosService, ProductosQuery } from './productos.service';
import { CategoriasService } from '../../categories/categories.service';
import { ProveedoresService } from '../../suppliers/suppliers.service';
import { BadgeComponent } from '../../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { AuthService } from '../../../core/services/auth.service';
import { ApiResponse } from '../../../core/models/usuario.model';
import {
  Categoria,
  CategoriasPage,
} from '../../../core/models/categoria.model';
import { ProveedoresPage, Proveedor } from '../../../core/models/proveedor.model';
import {
  Color,
  EstadoProducto,
  ProductoRopa,
  Talla,
} from '../../../core/models/producto.model';

/**
 * CU6 — Gestión de Productos de Ropa (solo ASU gestiona) — BACKEND REAL.
 * Los demás roles (p. ej. Cliente) solo consultan el catálogo: sin crear/editar/eliminar.
 * Catálogo visual en grid de tarjetas con búsqueda, filtros por categoría
 * y estado, paginación server-side. Modal "+ Nuevo Producto" con selección
 * de tallas/colores (chips clickeables por id de catálogo), categoría y
 * proveedor. DELETE con verificación 409 (movimientos de inventario).
 */
@Component({
  selector: 'app-productos',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    BadgeComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './productos.component.html',
})
export class ProductosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productosService = inject(ProductosService);
  private readonly categoriasService = inject(CategoriasService);
  private readonly proveedoresService = inject(ProveedoresService);
  private readonly auth = inject(AuthService);

  /** Solo el ASU gestiona productos; el resto de roles solo consulta. */
  readonly puedeGestionar = (this.auth.getRol() || '').toUpperCase() === 'ASU';

  // ------------------------------------------------------------------ estado
  productos = signal<ProductoRopa[]>([]);
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
  busqueda = signal('');
  filtroCategoriaId = signal<number | 'todas'>('todas');
  filtroEstado = signal<'todos' | EstadoProducto>('todos');

  /** Vista activa: grid de tarjetas o tabla compacta. */
  vista = signal<'grid' | 'tabla'>('grid');

  modalAbierto = signal(false);
  editandoId = signal<number | null>(null); // null = crear, id = editar

  confirmarEliminar = signal<ProductoRopa | null>(null);

  // Catálogos FK (cargados una vez para selects/chips del formulario)
  categorias = signal<Categoria[]>([]);
  tallas = signal<Talla[]>([]);
  colores = signal<Color[]>([]);
  proveedores = signal<Proveedor[]>([]);

  // ------------------------------------------------------------- formulario
  productoForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(3)]],
    id_categoria: this.fb.control<number | null>(null, Validators.required),
    id_proveedor: this.fb.control<number | null>(null),
    precio_venta: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01),
    ]),
    stock_total: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0),
    ]),
    imagen_url: [''],
    descripcion: [''],
    tallas: [[] as number[], Validators.required],
    colores: [[] as number[], Validators.required],
  });

  ngOnInit(): void {
    this.cargarCatalogos();
    this.cargarProductos();
  }

  /** Catálogos FK: categorías (CU9), tallas/colores (CU7), proveedores (CU23). */
  cargarCatalogos(): void {
    // Categorías (mismo servicio del CU9)
    this.categoriasService
      .getCategorias({ limit: 100 })
      .subscribe({
        next: (resp: CategoriasPage) => this.categorias.set(resp.data),
        error: () => this.errorMessage.set('No se pudieron cargar las categorías.'),
      });
    // Proveedores (CU23): solo alimentan el formulario de gestión
    if (this.puedeGestionar) {
      this.proveedoresService
        .getProveedores({ limit: 100 })
        .subscribe({
          next: (resp: ProveedoresPage) => this.proveedores.set(resp.data),
          error: () => this.errorMessage.set('No se pudieron cargar los proveedores.'),
        });
    }
    // Tallas y colores (CU7)
    this.productosService.getTallas().subscribe({
      next: (data) => this.tallas.set(data),
      error: () => this.errorMessage.set('No se pudieron cargar las tallas.'),
    });
    this.productosService.getColores().subscribe({
      next: (data) => this.colores.set(data),
      error: () => this.errorMessage.set('No se pudieron cargar los colores.'),
    });
  }

  cargarProductos(): void {
    this.cargando.set(true);
    const query: ProductosQuery = {
      q: this.busqueda() || undefined,
      id_categoria:
        this.filtroCategoriaId() === 'todas'
          ? undefined
          : (this.filtroCategoriaId() as number),
      estado: this.filtroEstado() === 'todos' ? undefined : this.filtroEstado(),
      page: this.pagina(),
      limit: this.limit,
    };
    this.productosService.getProductos(query).subscribe({
      next: (resp) => {
        this.productos.set(resp.data);
        this.total.set(resp.total);
        this.pages.set(resp.pages);
        this.cargando.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el catálogo de productos.');
        this.cargando.set(false);
      },
    });
  }

  // -------------------------------------------------- UI helpers (paginación)
  onBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
    this.pagina.set(1);
    this.cargarProductos();
  }

  onFiltroCategoria(id: number | 'todas'): void {
    this.filtroCategoriaId.set(id);
    this.pagina.set(1);
    this.cargarProductos();
  }

  onFiltroEstado(estado: 'todos' | EstadoProducto): void {
    this.filtroEstado.set(estado);
    this.pagina.set(1);
    this.cargarProductos();
  }

  paginaAnterior(): void {
    if (this.pagina() > 1) {
      this.pagina.update((p) => p - 1);
      this.cargarProductos();
    }
  }

  paginaSiguiente(): void {
    if (this.pagina() < this.pages()) {
      this.pagina.update((p) => p + 1);
      this.cargarProductos();
    }
  }

  /** Variante del badge según el estado del producto. */
  badgeEstado(estado: string): 'success' | 'danger' | 'neutral' {
    switch (estado) {
      case 'Activo':
        return 'success';
      case 'Agotado':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  // -------------------------------------------------- chips tallas / colores
  /** Alterna un ID en el arreglo del FormControl (chips multi-select). */
  protected toggleChip(control: 'tallas' | 'colores', id: number): void {
    const actual = this.productoForm.controls[control].value ?? [];
    const nuevo = actual.includes(id)
      ? actual.filter((v) => v !== id)
      : [...actual, id];
    this.productoForm.controls[control].setValue(nuevo);
    this.productoForm.controls[control].markAsDirty();
  }

  /** True si el chip está seleccionado. */
  protected chipActivo(control: 'tallas' | 'colores', id: number): boolean {
    return (this.productoForm.controls[control].value ?? []).includes(id);
  }

  // ------------------------------------------------------------------ modal
  abrirModalCrear(): void {
    if (!this.puedeGestionar) return;
    this.editandoId.set(null);
    this.productoForm.reset({
      nombre: '',
      id_categoria: null,
      id_proveedor: null,
      precio_venta: null,
      stock_total: null,
      imagen_url: '',
      descripcion: '',
      tallas: [],
      colores: [],
    });
    this.errorMessage.set('');
    this.modalAbierto.set(true);
  }

  abrirModalEditar(producto: ProductoRopa): void {
    if (!this.puedeGestionar) return;
    this.editandoId.set(producto.id_producto);
    this.productoForm.reset({
      nombre: producto.nombre,
      id_categoria: producto.id_categoria,
      id_proveedor: producto.id_proveedor ?? null,
      precio_venta: Number(producto.precio_venta),
      stock_total: producto.stock_total,
      imagen_url: producto.imagen_url ?? '',
      descripcion: producto.descripcion ?? '',
      tallas: producto.tallas.map((t) => t.id_talla),
      colores: producto.colores.map((c) => c.id_color),
    });
    this.errorMessage.set('');
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.errorMessage.set('');
  }

  // ---------------------------------------------------------------- acciones
  guardar(): void {
    if (!this.puedeGestionar) return;
    if (this.productoForm.invalid || this.guardando()) {
      this.errorMessage.set(
        'Complete los campos obligatorios (*) y seleccione al menos una talla y un color.',
      );
      this.productoForm.markAllAsTouched();
      return;
    }

    const { nombre, id_categoria, id_proveedor, precio_venta, stock_total, imagen_url, descripcion, tallas, colores } =
      this.productoForm.value;

    this.guardando.set(true);
    this.errorMessage.set('');

    if (this.editandoId() !== null) {
      const payload = {
        nombre: nombre!.trim(),
        id_categoria: id_categoria!,
        id_proveedor: id_proveedor ?? null,
        precio_venta: Number(precio_venta),
        stock_total: Number(stock_total),
        imagen_url: imagen_url?.trim() || null,
        descripcion: descripcion?.trim() || null,
        tallas: tallas ?? [],
        colores: colores ?? [],
      };
      this.productosService
        .updateProducto(this.editandoId()!, payload)
        .subscribe({
          next: () => this.finalizarGuardado('Producto actualizado correctamente.'),
          error: (err: ApiError) => this.mostrarError(err),
        });
    } else {
      const payload = {
        nombre: nombre!.trim(),
        id_categoria: id_categoria!,
        id_proveedor: id_proveedor ?? null,
        precio_venta: Number(precio_venta),
        stock_total: Number(stock_total),
        imagen_url: imagen_url?.trim() || null,
        descripcion: descripcion?.trim() || null,
        tallas: tallas ?? [],
        colores: colores ?? [],
      };
      this.productosService.createProducto(payload).subscribe({
        next: () => this.finalizarGuardado('Producto registrado correctamente.'),
        error: (err: ApiError) => this.mostrarError(err),
      });
    }
  }

  pedirEliminar(producto: ProductoRopa): void {
    if (!this.puedeGestionar) return;
    this.confirmarEliminar.set(producto);
  }

  /** Mensaje del ConfirmDialog de eliminación (armado en el TS). */
  protected mensajeEliminar(producto: ProductoRopa): string {
    return `¿Eliminar "${producto.nombre}" del catálogo? Si tiene movimientos de inventario, el sistema impedirá la eliminación.`;
  }

  confirmarEliminacion(): void {
    if (!this.puedeGestionar) return;
    const producto = this.confirmarEliminar();
    if (!producto) return;
    this.confirmarEliminar.set(null);
    this.productosService.eliminarProducto(producto.id_producto).subscribe({
      next: (resp: ApiResponse<null>) => {
        this.exitoMessage.set(resp.message || 'Producto eliminado correctamente.');
        this.cargarProductos();
        setTimeout(() => this.exitoMessage.set(''), 4000);
      },
      error: (err: ApiError) => this.mostrarError(err),
    });
  }

  private finalizarGuardado(mensaje: string): void {
    this.guardando.set(false);
    this.modalAbierto.set(false);
    this.exitoMessage.set(mensaje);
    this.cargarProductos();
    setTimeout(() => this.exitoMessage.set(''), 3000);
  }

  /** Desempaca el detail del error HTTP (envelope FastAPI). */
  private mostrarError(err: ApiError): void {
    this.guardando.set(false);
    const detail = err?.error?.detail;
    this.errorMessage.set(
      (typeof detail === 'string' ? detail : undefined) ||
        'Ocurrió un error. Verifique los datos e intente nuevamente.'
    );
  }
}

/** Forma del error HTTP de HttpClient (detail puede ser string o array). */
interface ApiError {
  error?: { detail?: string | unknown };
}
