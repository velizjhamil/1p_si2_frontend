import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriasService } from './categories.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import {
 Categoria,
 CategoriaCreatePayload,
 CategoriaUpdatePayload,
 LineaCategoria,
} from '../../core/models/categoria.model';

type FiltroLinea = 'todas' | LineaCategoria;

/**
 * Gestión de Categorías (ASU/GS).
 * Datatable paginado server-side con búsqueda por nombre, tabs por línea
 * (Hombre/Mujer/Unisex), badges suaves de línea y estado, modal
 * registrar/editar y ConfirmDialog para eliminar. El backend responde 409
 * si la categoría tiene productos: solo se permite desactivar.
 */
@Component({
 selector: 'app-categories',
 imports: [ReactiveFormsModule, BadgeComponent, ConfirmDialogComponent],
 templateUrl: './categories.component.html',
})
export class CategoriesComponent implements OnInit {
 private readonly fb = inject(FormBuilder);
 private readonly categoriasService = inject(CategoriasService);

 // ------------------------------------------------------------------ estado
 categorias = signal<Categoria[]>([]);
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
 filtroLinea = signal<FiltroLinea>('todas');

 modalAbierto = signal(false);
 editandoId = signal<number | null>(null); // null = crear, id = editar

 // ConfirmDialog de eliminación (reemplaza window.confirm)
 confirmarEliminar = signal<Categoria | null>(null);

 // ------------------------------------------------------------- formulario
 categoriaForm = this.fb.group({
 nombre: ['', [Validators.required, Validators.minLength(2)]],
 linea: ['', Validators.required],
 descripcion: [''],
 });

 ngOnInit(): void {
 this.cargarCategorias();
 }

 cargarCategorias(): void {
 this.cargando.set(true);
 const linea = this.filtroLinea();
 this.categoriasService
 .getCategorias({
 q: this.busqueda() || undefined,
 linea: linea === 'todas' ? undefined : (linea as LineaCategoria),
 page: this.pagina(),
 limit: this.limit,
 })
 .subscribe({
 next: (resp) => {
 this.categorias.set(resp.data);
 this.total.set(resp.total);
 this.pages.set(resp.pages);
 this.cargando.set(false);
 },
 error: () => {
 this.errorMessage.set('No se pudo cargar la lista de categorías.');
 this.cargando.set(false);
 },
 });
 }

 // ------------------------------------------------------------ UI helpers
 onBusqueda(event: Event): void {
 this.busqueda.set((event.target as HTMLInputElement).value);
 this.pagina.set(1);
 this.cargarCategorias();
 }

 onFiltroLinea(linea: FiltroLinea): void {
 this.filtroLinea.set(linea);
 this.pagina.set(1);
 this.cargarCategorias();
 }

 paginaAnterior(): void {
 if (this.pagina() > 1) {
 this.pagina.update((p) => p - 1);
 this.cargarCategorias();
 }
 }

 paginaSiguiente(): void {
 if (this.pagina() < this.pages()) {
 this.pagina.update((p) => p + 1);
 this.cargarCategorias();
 }
 }

 /** Variante del badge según la línea (badges suaves de color). */
 badgeLinea(linea: string): 'info' | 'accent' | 'neutral' {
 switch (linea) {
 case 'Hombre':
 return 'info';
 case 'Mujer':
 return 'accent';
 default:
 return 'neutral';
 }
 }

 // ------------------------------------------------------------------ modal
 abrirModalCrear(): void {
 this.editandoId.set(null);
 this.categoriaForm.reset({ nombre: '', linea: '', descripcion: '' });
 this.errorMessage.set('');
 this.modalAbierto.set(true);
 }

 abrirModalEditar(categoria: Categoria): void {
 this.editandoId.set(categoria.id_categoria);
 this.categoriaForm.reset({
 nombre: categoria.nombre,
 linea: categoria.linea,
 descripcion: categoria.descripcion ?? '',
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
 if (this.categoriaForm.invalid || this.guardando()) {
 this.errorMessage.set('Complete los campos obligatorios (*) correctamente.');
 return;
 }

 const { nombre, linea, descripcion } = this.categoriaForm.value;
 this.guardando.set(true);
 this.errorMessage.set('');

 if (this.editandoId() !== null) {
 const payload: CategoriaUpdatePayload = {
 nombre: nombre!,
 linea: linea as LineaCategoria,
 descripcion: descripcion || undefined,
 };
 this.categoriasService.updateCategoria(this.editandoId()!, payload).subscribe({
 next: () => this.finalizarGuardado('Categoría actualizada correctamente.'),
 error: (err) => this.mostrarError(err),
 });
 } else {
 const payload: CategoriaCreatePayload = {
 nombre: nombre!,
 linea: linea as LineaCategoria,
 descripcion: descripcion || undefined,
 };
 this.categoriasService.createCategoria(payload).subscribe({
 next: () => this.finalizarGuardado('Categoría registrada correctamente.'),
 error: (err) => this.mostrarError(err),
 });
 }
 }

 /** Abre el ConfirmDialog de eliminación. */
 pedirEliminar(categoria: Categoria): void {
 this.confirmarEliminar.set(categoria);
 }

 /**
 * DELETE físico. El backend responde 409 con la RESTRICCIÓN DE NEGOCIO
 * (productos asociados) — se muestra como advertencia indicando que solo
 * puede desactivarse.
 */
 confirmarEliminacion(): void {
 const categoria = this.confirmarEliminar();
 if (!categoria) {
 return;
 }
 this.confirmarEliminar.set(null);
 this.categoriasService.eliminarCategoria(categoria.id_categoria).subscribe({
 next: (resp) => {
 this.exitoMessage.set(resp.message || 'Categoría eliminada correctamente.');
 this.cargarCategorias();
 setTimeout(() => this.exitoMessage.set(''), 4000);
 },
 error: (err) => this.mostrarError(err),
 });
 }

 /** PUT rápido: desactiva (salida de la 409 del DELETE). */
 desactivar(categoria: Categoria): void {
 this.categoriasService
 .updateCategoria(categoria.id_categoria, { activo: false })
 .subscribe({
 next: () => {
 this.exitoMessage.set(`Categoría "${categoria.nombre}" desactivada.`);
 this.cargarCategorias();
 setTimeout(() => this.exitoMessage.set(''), 4000);
 },
 error: (err) => this.mostrarError(err),
 });
 }

 private finalizarGuardado(mensaje: string): void {
 this.guardando.set(false);
 this.modalAbierto.set(false);
 this.exitoMessage.set(mensaje);
 this.cargarCategorias();
 setTimeout(() => this.exitoMessage.set(''), 3000);
 }

 private mostrarError(err: { error?: { detail?: string } }): void {
 this.guardando.set(false);
 this.errorMessage.set(
 err?.error?.detail ||
 'Ocurrió un error. Verifique los datos e intente nuevamente.'
 );
 }
}
