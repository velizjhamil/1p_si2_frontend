import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProbadorService, ProbarPrendaPayload } from '../../core/services/probador.service';
import { CatalogoTiendaService } from '../../core/services/catalogo-tienda.service';
import { CarritoService } from '../../core/services/carrito.service';
import { AuthService } from '../../core/services/auth.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ProductoTienda } from '../../core/models/carrito.model';
import {
 AjusteEstimado,
 FotoUsuario,
 SimulacionProbador,
} from '../../core/models/probador.model';

/** Errores de validación de la foto (límite generoso para data URLs). */
const MAX_FOTO_BYTES = 3 * 1024 * 1024; // ~3MB

/** Etiquetas legibles del ajuste estimado. */
const AJUSTE_LABELS: Record<AjusteEstimado, string> = {
 PERFECTO: 'Ajuste Perfecto',
 AJUSTADO: 'Ajustado al cuerpo',
 HOLGADO: 'Holgado',
};

/**
 * Probador Virtual AR (FASE MOCK).
 *
 * Dos etapas/columnas: (a) carga de foto del cliente con Drag & Drop +
 * medidas opcionales; (b) selector de prenda, talla y color. Al probar,
 * el panel de resultado muestra el comparativo foto base vs prenda
 * superpuesta (silueta AR dibujada con SVG), badge de recomendación de
 * talla/ajuste, y acciones: Agregar al Carrito / Guardar en Lookbooks.
 * Abajo, historial/galería con modal de detalle.
 */
@Component({
 selector: 'app-probador-virtual',
 imports: [FormsModule, BadgeComponent],
 templateUrl: './probador-virtual.component.html',
})
export class ProbadorVirtualComponent {
 private readonly probadorService = inject(ProbadorService);
 private readonly catalogoService = inject(CatalogoTiendaService);
 private readonly carritoService = inject(CarritoService);
 private readonly auth = inject(AuthService);

 /** Regla de negocio: solo el Cliente puede agregar al carrito. */
 protected readonly esCliente = this.auth.esCliente();

 // ------------------------------------------------------------------ estado
 /** Catálogo de prendas disponibles para probar. */
 protected readonly productos = signal<ProductoTienda[]>([]);

 /** Foto del cliente procesada por la "IA" (null = aún no subida). */
 protected readonly fotoUsuario = signal<FotoUsuario | null>(null);

 /** Prenda seleccionada del catálogo. */
 protected readonly productoSeleccionado = signal<ProductoTienda | null>(null);

 /** Talla/color elegidos para la prueba. */
 protected readonly tallaSeleccionada = signal('');
 protected readonly colorSeleccionado = signal<{ nombre: string; hex: string } | null>(null);

 /** Resultado de la última simulación (panel comparativo). */
 protected readonly simulacion = signal<SimulacionProbador | null>(null);

 /** Historial persistido de pruebas ("Mis Lookbooks"). */
 protected readonly historial = signal<SimulacionProbador[]>([]);

 /** Simulación del historial abierta en el modal de detalle. */
 protected readonly detalleSimulacion = signal<SimulacionProbador | null>(null);

 // ------------------------------------------------------------ estado de UI
 protected readonly cargandoCatalogo = signal(true);
 protected readonly subiendoFoto = signal(false);
 protected readonly simulando = signal(false);
 protected readonly errorMessage = signal('');
 protected readonly exitoMessage = signal('');
 protected readonly dragOver = signal(false);

 /** Medidas opcionales (ngModel sobre inputs number). */
 protected estaturaInput = '';
 protected pesoInput = '';

 /** Vista previa de la foto antes de procesarla. */
 protected readonly vistaPrevia = signal<string | null>(null);

 /** Data URL de la foto elegida (pendiente de subir). */
 private imagenPendiente: string | null = null;

 // ---------------------------------------------------------------- KPIs UI
 /** Complexión derivada mostrada como chip informativo. */
 protected readonly complexionLabel = computed(() => {
 const foto = this.fotoUsuario();
 if (!foto) return '';
 switch (foto.medidas_aproximadas.complexion) {
 case 'DELGADA': return 'Delgada';
 case 'MEDIA': return 'Media';
 case 'ROBUSTA': return 'Robusta';
 default: return 'Sin medidas';
 }
 });

 /** Cantidad de pruebas guardadas en el lookbook. */
 protected readonly totalLookbook = computed(() => this.historial().length);

 // -------------------------------------------------------------- lifecycle
 constructor() {
 this.catalogoService.getCatalogo().subscribe({
 next: (productos) => {
 this.productos.set(productos);
 this.cargandoCatalogo.set(false);
 },
 error: () => {
 this.errorMessage.set('No se pudo cargar el catálogo de prendas.');
 this.cargandoCatalogo.set(false);
 },
 });
 this.cargarHistorial();
 }

 private cargarHistorial(): void {
 this.probadorService.getHistorialPruebas().subscribe({
 next: (simulaciones) => this.historial.set(simulaciones),
 });
 }

 // ----------------------------------------------------- etapa (a): la foto
 /** Drag & drop: marca el área con highlight visual. */
 protected onDragOver(event: DragEvent): void {
 event.preventDefault();
 this.dragOver.set(true);
 }

 protected onDragLeave(event: DragEvent): void {
 event.preventDefault();
 this.dragOver.set(false);
 }

 /** Suelta la imagen sobre el área de carga. */
 protected onDrop(event: DragEvent): void {
 event.preventDefault();
 this.dragOver.set(false);
 const archivo = event.dataTransfer?.files?.[0];
 if (archivo) this.procesarArchivo(archivo);
 }

 /** Selección clásica vía input[file] (accesible). */
 protected onFileSelected(event: Event): void {
 const input = event.target as HTMLInputElement;
 const archivo = input.files?.[0];
 if (archivo) this.procesarArchivo(archivo);
 input.value = ''; // permite re-elegir el mismo archivo
 }

 /** Valida tipo/tamaño y genera la vista previa (FileReader). */
 private procesarArchivo(archivo: File): void {
 this.errorMessage.set('');
 if (!archivo.type.startsWith('image/')) {
 this.errorMessage.set('El archivo debe ser una imagen (JPG, PNG, WEBP).');
 return;
 }
 if (archivo.size > MAX_FOTO_BYTES) {
 this.errorMessage.set('La imagen supera el límite de 3MB.');
 return;
 }

 const reader = new FileReader();
 reader.onload = () => {
 this.vistaPrevia.set(reader.result as string);
 this.imagenPendiente = reader.result as string;
 };
 reader.readAsDataURL(archivo);
 }

 /** Sube la foto a la "IA" del probador (procesamiento 1.5s). */
 protected subirFoto(): void {
 if (this.subiendoFoto()) return;
 if (!this.imagenPendiente) {
 this.errorMessage.set('Arrastre o seleccione una foto primero.');
 return;
 }

 const estatura = this.estaturaInput ? Number(this.estaturaInput) : null;
 const peso = this.pesoInput ? Number(this.pesoInput) : null;

 if (
 (estatura !== null && (estatura < 100 || estatura > 230)) ||
 (peso !== null && (peso < 25 || peso > 250))
 ) {
 this.errorMessage.set('Medidas fuera de rango (estatura 100-230 cm, peso 25-250 kg).');
 return;
 }

 this.subiendoFoto.set(true);
 this.errorMessage.set('');
 this.probadorService
 .subirFotoUsuario({
 imagen_data_url: this.imagenPendiente,
 estatura,
 peso,
 })
 .subscribe({
 next: (foto) => {
 this.fotoUsuario.set(foto);
 this.subiendoFoto.set(false);
 this.exitoMessage.set('Foto procesada por la IA. Ya puede probar prendas.');
 setTimeout(() => this.exitoMessage.set(''), 3000);
 },
 error: (err: { error?: { detail?: string } }) => {
 this.errorMessage.set(err?.error?.detail ?? 'No se pudo procesar la imagen.');
 this.subiendoFoto.set(false);
 },
 });
 }

 /** Reemplaza la foto actual (vuelve a la etapa de carga). */
 protected cambiarFoto(): void {
 this.fotoUsuario.set(null);
 this.vistaPrevia.set(null);
 this.imagenPendiente = null;
 this.simulacion.set(null);
 this.errorMessage.set('');
 }

 // ------------------------------------------------- etapa (b): la prenda
 /** Selecciona la prenda a probar (resetea talla/color). */
 protected elegirProducto(producto: ProductoTienda): void {
 this.productoSeleccionado.set(producto);
 this.tallaSeleccionada.set('');
 this.colorSeleccionado.set(null);
 this.simulacion.set(null);
 }

 protected elegirTalla(talla: string): void {
 this.tallaSeleccionada.set(talla);
 }

 protected elegirColor(color: { nombre: string; hex: string }): void {
 this.colorSeleccionado.set(color);
 }

 /** lanza la simulación AR de la prenda sobre la foto. */
 protected probarPrenda(): void {
 if (this.simulando()) return;

 const foto = this.fotoUsuario();
 const producto = this.productoSeleccionado();
 if (!foto) {
 this.errorMessage.set('Primero suba la foto del cliente.');
 return;
 }
 if (!producto) {
 this.errorMessage.set('Seleccione una prenda del catálogo.');
 return;
 }
 if (!this.tallaSeleccionada() || !this.colorSeleccionado()) {
 this.errorMessage.set('Seleccione talla y color de la prenda.');
 return;
 }

 const payload: ProbarPrendaPayload = {
 foto_id: foto.id,
 producto: {
 producto_id: producto.producto_id,
 nombre: producto.nombre,
 tallas: producto.tallas,
 colores: producto.colores,
 precio: producto.precio,
 categoria: producto.categoria,
 },
 talla_seleccionada: this.tallaSeleccionada(),
 color_seleccionado: this.colorSeleccionado()!,
 };

 this.simulando.set(true);
 this.errorMessage.set('');
 this.probadorService.probarPrenda(payload).subscribe({
 next: (sim) => {
 this.simulacion.set(sim);
 this.simulando.set(false);
 // Scroll sutil hacia el resultado
 setTimeout(() => {
 document.getElementById('resultado-probador')?.scrollIntoView({ behavior: 'smooth' });
 }, 50);
 },
 error: (err: { error?: { detail?: string } }) => {
 this.errorMessage.set(err?.error?.detail ?? 'La simulación falló. Intente nuevamente.');
 this.simulando.set(false);
 },
 });
 }

 // --------------------------------------------------------- acciones resultado
 /** Agrega la prenda probada al carrito (reutiliza el ). */
 protected agregarAlCarrito(): void {
 const sim = this.simulacion();
 const producto = this.productoSeleccionado();
 if (!sim || !producto) return;

 this.carritoService.agregarAlCarrito({
 producto_id: producto.producto_id,
 nombre: producto.nombre,
 talla: sim.talla_seleccionada,
 color: sim.color_seleccionado ?? '',
 color_hex: sim.color_hex ?? '#1e4d8c',
 precio: producto.precio,
 cantidad: 1,
 imagen_url: null,
 });

 this.exitoMessage.set('Prenda agregada al carrito desde el probador.');
 setTimeout(() => this.exitoMessage.set(''), 3000);
 }

 /** Guarda la prueba en "Mis Lookbooks" (persistido en localStorage). */
 protected guardarEnLookbook(): void {
 const sim = this.simulacion();
 if (!sim) return;
 this.probadorService.guardarEnLookbook(sim).subscribe({
 next: () => {
 this.cargarHistorial();
 this.exitoMessage.set('Prueba guardada en Mis Lookbooks.');
 setTimeout(() => this.exitoMessage.set(''), 3000);
 },
 });
 }

 // ------------------------------------------------------------- historial
 /** Abre el modal de detalle de una prueba del historial. */
 protected verDetalle(sim: SimulacionProbador): void {
 this.detalleSimulacion.set(sim);
 }

 protected cerrarDetalle(): void {
 this.detalleSimulacion.set(null);
 }

 /** Elimina una prueba del lookbook. */
 protected eliminarPrueba(sim: SimulacionProbador): void {
 this.probadorService.eliminarPrueba(sim.id).subscribe({
 next: () => this.cargarHistorial(),
 });
 }

 // ------------------------------------------------------------ UI helpers
 /** Badge del ajuste estimado. */
 protected badgeAjuste(ajuste: AjusteEstimado): 'success' | 'warning' | 'info' {
 switch (ajuste) {
 case 'PERFECTO':
 return 'success';
 case 'AJUSTADO':
 return 'warning';
 default:
 return 'info';
 }
 }

 /** Etiqueta legible del ajuste. */
 protected ajusteLabel(ajuste: AjusteEstimado): string {
 return AJUSTE_LABELS[ajuste];
 }

 /** Fecha legible (es-BO) para tarjetas y modal. */
 protected fechaLegible(iso: string): string {
 return new Date(iso).toLocaleString('es-BO', {
 dateStyle: 'medium',
 timeStyle: 'short',
 });
 }

 /** Clase del preview de color (blanco necesita borde extra). */
 protected claseSwatch(hex: string | undefined): string {
 return hex === '#ffffff' || !hex
 ? 'border border-primary/30'
 : 'border border-primary/10';
 }
}
