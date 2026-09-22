import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DescuentosService, DescuentosQuery } from './descuentos.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import {
 Descuento,
 DescuentoCreatePayload,
 DescuentoUpdatePayload,
 TipoDescuento,
} from '../../core/models/descuento.model';

type FiltroTipo = 'TODOS' | TipoDescuento;
type FiltroEstado = 'TODOS' | 'activos' | 'inactivos';

/**
 * Gestión de Descuentos / Cupones (ASU/GS).
 * Tabla paginada server-side con búsqueda, filtros por tipo y estado,
 * badges de tipo/estado, modal de crear/editar y ConfirmDialog para
 * eliminar. Reglas: el codigo del cupon se normaliza a MAYUSCULAS en
 * el backend (unico, case-insensitive). El PUT acepta semantica PATCH:
 * null = "no cambiar", string vacio en codigo = "quitar codigo".
 */
@Component({
 selector: 'app-descuentos',
 imports: [ReactiveFormsModule, BadgeComponent, ConfirmDialogComponent],
 templateUrl: './descuentos.component.html',
})
export class DescuentosComponent implements OnInit {
 private readonly fb = inject(FormBuilder);
 private readonly descuentosService = inject(DescuentosService);

 // ------------------------------------------------------------------ estado
 descuentos = signal<Descuento[]>([]);
 cargando = signal(true);
 guardando = signal(false);
 errorMessage = signal('');
 exitoMessage = signal('');

 // Paginación
 pagina = signal(1);
 total = signal(0);
 pages = signal(1);
 readonly limit = 10;

 // Filtros
 busqueda = signal('');
 filtroTipo = signal<FiltroTipo>('TODOS');
 filtroEstado = signal<FiltroEstado>('TODOS');

 // Modal de alta/edición
 modalAbierto = signal(false);
 editandoId = signal<number | null>(null);

 // ConfirmDialog de eliminación
 confirmarEliminar = signal<Descuento | null>(null);

 // ------------------------------------------------------------- formulario
 /** Form de crear/editar. El campo codigo es opcional (NULL = regla automatica). */
 descuentoForm = this.fb.group({
 codigo: [''],
 nombre: ['', [Validators.required, Validators.minLength(2)]],
 descripcion: [''],
 tipo: ['PORCENTAJE' as TipoDescuento, Validators.required],
 valor: [10, [Validators.required, Validators.min(0.01)]],
 fecha_inicio: ['', Validators.required],
 fecha_fin: [''],
 activo: [true],
 usos_maximos: [null as number | null],
 monto_minimo_compra: [null as number | null],
 });

 ngOnInit(): void {
 this.cargar();
 }

 // --------------------------------------------------------------- data load
 cargar(): void {
 this.cargando.set(true);
 const filtros: DescuentosQuery = {
 q: this.busqueda() || undefined,
 page: this.pagina(),
 limit: this.limit,
 };
 const tipo = this.filtroTipo();
 if (tipo !== 'TODOS') {
 filtros.tipo = tipo;
 }
 const estado = this.filtroEstado();
 if (estado === 'activos') {
 filtros.activo = true;
 } else if (estado === 'inactivos') {
 filtros.activo = false;
 }
 this.descuentosService.listar(filtros).subscribe({
 next: (resp) => {
 this.descuentos.set(resp.data);
 this.total.set(resp.total);
 this.pages.set(resp.pages);
 this.cargando.set(false);
 },
 error: () => {
 this.errorMessage.set('No se pudo cargar la lista de descuentos.');
 this.cargando.set(false);
 },
 });
 }

 // ------------------------------------------------------------ UI helpers
 onBusqueda(event: Event): void {
 this.busqueda.set((event.target as HTMLInputElement).value);
 this.pagina.set(1);
 this.cargar();
 }

 onFiltroTipo(t: FiltroTipo): void {
 this.filtroTipo.set(t);
 this.pagina.set(1);
 this.cargar();
 }

 onFiltroEstado(e: FiltroEstado): void {
 this.filtroEstado.set(e);
 this.pagina.set(1);
 this.cargar();
 }

 paginaAnterior(): void {
 if (this.pagina() > 1) {
 this.pagina.update((p) => p - 1);
 this.cargar();
 }
 }

 paginaSiguiente(): void {
 if (this.pagina() < this.pages()) {
 this.pagina.update((p) => p + 1);
 this.cargar();
 }
 }

 /** Color del badge según el tipo de descuento. */
 badgeTipo(t: TipoDescuento): 'info' | 'warning' {
 return t === 'PORCENTAJE' ? 'info' : 'warning';
 }

 /** Etiqueta legible del tipo. */
 etiquetaTipo(t: TipoDescuento): string {
 return t === 'PORCENTAJE' ? 'Porcentaje' : 'Monto fijo';
 }

 /** Etiqueta legible del valor. */
 etiquetaValor(d: Descuento): string {
 if (d.tipo === 'PORCENTAJE') {
 return `${d.valor}%`;
 }
 return `Bs. ${Number(d.valor).toFixed(2)}`;
 }

 /** Estado de vigencia: "Vigente" / "Vencido" / "Sin vigencia". */
 estadoVigencia(d: Descuento): {
 label: string;
 variant: 'success' | 'danger' | 'neutral';
 } {
 if (!d.activo) {
 return { label: 'Inactivo', variant: 'neutral' };
 }
 const hoy = new Date().toISOString().slice(0, 10);
 if (d.fecha_inicio > hoy) {
 return { label: 'Programado', variant: 'neutral' };
 }
 if (d.fecha_fin && d.fecha_fin < hoy) {
 return { label: 'Vencido', variant: 'danger' };
 }
 return { label: 'Vigente', variant: 'success' };
 }

 /** True si el cupon ya supero el limite de usos. */
 agotado(d: Descuento): boolean {
 return d.usos_maximos !== null && d.usos_actuales >= d.usos_maximos;
 }

 /** Texto del estado de usos. */
 textoUsos(d: Descuento): string {
 if (d.usos_maximos === null) {
 return `${d.usos_actuales} usos (ilimitado)`;
 }
 return `${d.usos_actuales} / ${d.usos_maximos} usos`;
 }

 // ------------------------------------------------------------------ modal
 abrirModalCrear(): void {
 this.editandoId.set(null);
 const hoy = new Date().toISOString().slice(0, 10);
 this.descuentoForm.reset({
 codigo: '',
 nombre: '',
 descripcion: '',
 tipo: 'PORCENTAJE',
 valor: 10,
 fecha_inicio: hoy,
 fecha_fin: '',
 activo: true,
 usos_maximos: null,
 monto_minimo_compra: null,
 });
 this.errorMessage.set('');
 this.modalAbierto.set(true);
 }

 abrirModalEditar(d: Descuento): void {
 this.editandoId.set(d.id_descuento);
 this.descuentoForm.reset({
 codigo: d.codigo ?? '',
 nombre: d.nombre,
 descripcion: d.descripcion ?? '',
 tipo: d.tipo,
 valor: Number(d.valor),
 fecha_inicio: d.fecha_inicio,
 fecha_fin: d.fecha_fin ?? '',
 activo: d.activo,
 usos_maximos: d.usos_maximos,
 monto_minimo_compra:
 d.monto_minimo_compra !== null ? Number(d.monto_minimo_compra) : null,
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
 if (this.descuentoForm.invalid || this.guardando()) {
 this.errorMessage.set('Complete los campos obligatorios (*) correctamente.');
 return;
 }
 const v = this.descuentoForm.value;
 this.guardando.set(true);
 this.errorMessage.set('');

 if (this.editandoId() !== null) {
 // PUT: armar payload con la semantica "None = no cambiar".
 // Para campos opcionales (codigo, fecha_fin, usos_maximos, monto_minimo_compra)
 // se envia undefined si vienen vacios, para que el backend NO los toque
 // (excepto codigo="" explicito: se envia "" para "quitar codigo").
 const payload: DescuentoUpdatePayload = {
 nombre: v.nombre!,
 descripcion: v.descripcion || null,
 tipo: v.tipo as TipoDescuento,
 valor: Number(v.valor),
 fecha_inicio: v.fecha_inicio!,
 fecha_fin: v.fecha_fin || null,
 activo: v.activo!,
 usos_maximos:
 v.usos_maximos !== null && v.usos_maximos !== undefined
 ? Number(v.usos_maximos)
 : null,
 monto_minimo_compra:
 v.monto_minimo_compra !== null && v.monto_minimo_compra !== undefined
 ? Number(v.monto_minimo_compra)
 : null,
 };
 // codigo: solo se envia si el usuario lo modifico (string no vacio)
 if (v.codigo && v.codigo.trim().length > 0) {
 payload.codigo = v.codigo.trim();
 } else if (v.codigo !== null && v.codigo === '') {
 // string vacio explicito: el backend lo interpreta como "quitar codigo"
 payload.codigo = '';
 }
 this.descuentosService
 .actualizar(this.editandoId()!, payload)
 .subscribe({
 next: () => this.finalizarGuardado('Descuento actualizado correctamente.'),
 error: (err) => this.mostrarError(err),
 });
 } else {
 // POST: armar payload completo
 const payload: DescuentoCreatePayload = {
 codigo: v.codigo && v.codigo.trim().length > 0 ? v.codigo.trim() : null,
 nombre: v.nombre!,
 descripcion: v.descripcion || null,
 tipo: v.tipo as TipoDescuento,
 valor: Number(v.valor),
 fecha_inicio: v.fecha_inicio!,
 fecha_fin: v.fecha_fin || null,
 activo: v.activo!,
 usos_maximos:
 v.usos_maximos !== null && v.usos_maximos !== undefined
 ? Number(v.usos_maximos)
 : null,
 monto_minimo_compra:
 v.monto_minimo_compra !== null && v.monto_minimo_compra !== undefined
 ? Number(v.monto_minimo_compra)
 : null,
 };
 this.descuentosService.crear(payload).subscribe({
 next: () => this.finalizarGuardado('Descuento registrado correctamente.'),
 error: (err) => this.mostrarError(err),
 });
 }
 }

 pedirEliminar(d: Descuento): void {
 this.confirmarEliminar.set(d);
 }

 confirmarEliminacion(): void {
 const d = this.confirmarEliminar();
 if (!d) {
 return;
 }
 this.confirmarEliminar.set(null);
 this.descuentosService.eliminar(d.id_descuento).subscribe({
 next: (resp) => {
 this.exitoMessage.set(resp.message || 'Descuento eliminado correctamente.');
 this.cargar();
 setTimeout(() => this.exitoMessage.set(''), 4000);
 },
 error: (err) => {
 // Si es 409 (ya fue usado), sugerimos desactivar
 this.mostrarError(err);
 },
 });
 }

 /** Activar/Desactivar rapidamente (salida del 409 del DELETE). */
 toggleActivo(d: Descuento): void {
 this.descuentosService
 .actualizar(d.id_descuento, { activo: !d.activo })
 .subscribe({
 next: () => {
 this.exitoMessage.set(
 `Descuento "${d.nombre}" ${d.activo ? 'desactivado' : 'activado'}.`,
 );
 this.cargar();
 setTimeout(() => this.exitoMessage.set(''), 4000);
 },
 error: (err) => this.mostrarError(err),
 });
 }

 private finalizarGuardado(mensaje: string): void {
 this.guardando.set(false);
 this.modalAbierto.set(false);
 this.exitoMessage.set(mensaje);
 this.cargar();
 setTimeout(() => this.exitoMessage.set(''), 3000);
 }

 private mostrarError(err: { error?: { detail?: string } }): void {
 this.guardando.set(false);
 this.errorMessage.set(
 err?.error?.detail ||
 'Ocurrió un error. Verifique los datos e intente nuevamente.',
 );
 }
}
