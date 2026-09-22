import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CarritoService } from '../../../core/services/carrito.service';
import { IaService } from '../../../core/services/ia.service';
import { ChatMessage, ProductoResumenIA } from '../../../core/models/ia.model';

@Component({
 selector: 'app-chat-ia-page',
 standalone: true,
 imports: [CommonModule, FormsModule, RouterLink],
 template: `
 <div class="max-w-6xl mx-auto px-4 py-6 space-y-6">
 <!-- Encabezado de la Página -->
 <div class="bg-gradient-to-r from-slate-900 via-primary to-[#635BFF] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-white/10">
 <div class="space-y-2">
 <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-white">
 <span>✨</span> Asistente Virtual Inteligente
 </div>
 <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-white">
 Attention AI · Asesora de Moda Personal
 </h1>
 <p class="text-sm text-slate-200 max-w-xl leading-relaxed">
 Consulta en tiempo real nuestro catálogo de prendas, disponibilidad física en sucursales, promociones activas y recibe asesoramiento de estilo personalizado.
 </p>
 </div>

 <div class="flex items-center gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-xs border border-white/15 shrink-0">
 <div class="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xl">
 ⚡
 </div>
 <div>
 <span class="block text-xs text-slate-300">Conexión con Catálogo</span>
 <span class="block text-sm font-bold text-emerald-400">RAG en Vivo Activo</span>
 </div>
 </div>
 </div>

 <!-- Contenedor Principal: Chat y Panel de Recomendaciones -->
 <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
 <!-- Columna Izquierda / Central: Chat Conversacional -->
 <div class="lg:col-span-2 bg-white rounded-3xl shadow-lg border border-slate-200 flex flex-col h-[640px] overflow-hidden">
 <!-- Cabecera interna del chat -->
 <div class="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
 <div class="flex items-center gap-2.5">
 <span class="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center text-sm shadow-xs">
 ✨
 </span>
 <div>
 <h2 class="font-bold text-xs text-slate-900">Conversación con la Asesora</h2>
 <span class="text-[10px] text-emerald-600 font-medium">● Respuestas basadas en inventario real</span>
 </div>
 </div>

 <button
 type="button"
 (click)="limpiarConversacion()"
 class="text-xs text-slate-500 hover:text-red-600 transition flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100"
 title="Reiniciar diálogo"
 >
 <span>🧹</span> Limpiar
 </button>
 </div>

 <!-- Mensajes -->
 <div #scrollContainer class="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40">
 @for (msg of mensajes(); track msg.id || $index) {
 @if (msg.rol === 'usuario') {
 <div class="flex justify-end">
 <div class="max-w-[80%] bg-primary text-white rounded-2xl rounded-tr-xs px-4 py-3 text-xs shadow-md leading-relaxed">
 {{ msg.contenido }}
 </div>
 </div>
 } @else {
 <div class="flex items-start gap-3 max-w-[90%]">
 <span class="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#635BFF] to-primary text-white flex items-center justify-center text-xs shrink-0 shadow-xs mt-0.5">
 ✨
 </span>
 <div class="space-y-3 flex-1">
 <div
 class="bg-white text-slate-800 rounded-2xl rounded-tl-xs p-4 text-xs shadow-xs border border-slate-200 leading-relaxed"
 [class.border-red-200]="msg.esError"
 [innerHTML]="formatearMarkdown(msg.contenido)"
 ></div>

 <!-- Tarjetas de Productos en la vista dedicada -->
 @if (msg.productos_detalle && msg.productos_detalle.length > 0) {
 <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
 @for (prod of msg.productos_detalle; track prod.id_producto) {
 <div class="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition space-y-2">
 <div class="flex gap-3 items-center">
 <div class="h-16 w-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
 @if (prod.imagen_url) {
 <img [src]="prod.imagen_url" [alt]="prod.nombre" class="h-full w-full object-cover" />
 } @else {
 <span class="text-2xl">👗</span>
 }
 </div>
 <div class="flex-1 min-w-0">
 <span class="text-[10px] font-semibold text-primary uppercase">{{ prod.categoria || 'Moda' }}</span>
 <h4 class="font-bold text-xs text-slate-900 truncate">{{ prod.nombre }}</h4>
 <span class="text-xs font-black text-slate-900 font-mono">Bs {{ prod.precio_venta.toFixed(2) }}</span>
 </div>
 </div>

 @if (prod.stock_sucursales && prod.stock_sucursales.length > 0) {
 <div class="bg-slate-50 rounded-lg p-2 text-[10px] text-slate-600">
 <span class="font-semibold text-slate-700">Stock físico:</span>
 <div class="flex flex-wrap gap-1 mt-0.5">
 @for (s of prod.stock_sucursales; track s.sucursal) {
 <span class="px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-700">
 {{ s.sucursal }}: <strong>{{ s.stock }} u.</strong>
 </span>
 }
 </div>
 </div>
 }

 <div class="flex gap-2 pt-1">
 <button
 type="button"
 (click)="agregarAlCarrito(prod)"
 class="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold text-white transition flex items-center justify-center gap-1 shadow-xs"
 [class]="productoAgregadoId() === prod.id_producto ? 'bg-emerald-600' : 'bg-primary hover:bg-slate-800'"
 >
 <span>{{ productoAgregadoId() === prod.id_producto ? '✔ ¡Añadido!' : '🛒 Añadir' }}</span>
 </button>
 <button
 type="button"
 (click)="probarConIA(prod)"
 class="py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-[#635BFF] border border-indigo-200"
 >
 <span>👗 Probar</span>
 </button>
 </div>
 </div>
 }
 </div>
 }
 </div>
 </div>
 }
 }

 @if (escribiendo()) {
 <div class="flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded-2xl w-fit border border-slate-200">
 <span class="flex items-center gap-1">
 <span class="h-2 w-2 rounded-full bg-primary animate-bounce"></span>
 <span class="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]"></span>
 <span class="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]"></span>
 </span>
 <span class="text-xs">Attention AI está consultando el catálogo y stock...</span>
 </div>
 }
 </div>

 <!-- Input Footer -->
 <div class="p-4 bg-white border-t border-slate-100 space-y-2">
 <form (ngSubmit)="enviarMensaje()" class="flex gap-2">
 <input
 type="text"
 [(ngModel)]="inputTexto"
 name="consulta_pagina"
 placeholder="Escribe tu consulta sobre estilos, tallas, prendas o sucursales..."
 [disabled]="escribiendo()"
 class="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-xs text-slate-800"
 />
 <button
 type="submit"
 [disabled]="!inputTexto.trim() || escribiendo()"
 class="px-5 py-3 rounded-xl bg-primary hover:bg-slate-800 text-white font-bold text-xs transition disabled:opacity-40"
 >
 Enviar
 </button>
 </form>
 </div>
 </div>

 <!-- Columna Derecha: Panel de Accesos Rápidos y Sugerencias -->
 <div class="space-y-6">
 <!-- Sugerencias de Consultas Frecuentes -->
 <div class="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-3">
 <h3 class="font-bold text-sm text-slate-900 flex items-center gap-2">
 <span>💡</span> Preguntas Frecuentes
 </h3>
 <p class="text-xs text-slate-500">
 Haz clic en cualquiera de estas preguntas para consultar directamente al asistente:
 </p>
 <div class="space-y-2 pt-1">
 @for (sug of sugerencias(); track sug) {
 <button
 type="button"
 (click)="enviarMensaje(sug)"
 class="w-full text-left p-2.5 rounded-xl bg-slate-50 hover:bg-primary hover:text-white border border-slate-200/80 text-xs text-slate-700 transition font-medium"
 >
 👉 {{ sug }}
 </button>
 }
 </div>
 </div>

 <!-- Tarjeta Probador Virtual AR -->
 <div class="bg-gradient-to-tr from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md border border-slate-800 space-y-3">
 <div class="flex items-center gap-2">
 <span class="text-2xl">👗</span>
 <h3 class="font-bold text-sm text-white">Probador Virtual AR</h3>
 </div>
 <p class="text-xs text-slate-300 leading-relaxed">
 ¿Quieres ver cómo te queda una prenda antes de comprarla? Nuestro probador virtual utiliza inteligencia artificial para simular el lookbook en tu silueta.
 </p>
 <a
 routerLink="/probador-virtual"
 class="inline-block w-full text-center py-2.5 px-4 rounded-xl bg-[#635BFF] hover:bg-indigo-600 text-white text-xs font-bold transition shadow-md"
 >
 Ir al Probador Virtual
 </a>
 </div>
 </div>
 </div>
 </div>
 `,
})
export class ChatIaPageComponent implements OnInit {
 private readonly iaService = inject(IaService);
 protected readonly carritoService = inject(CarritoService);
 private readonly auth = inject(AuthService);
 private readonly router = inject(Router);

 @ViewChild('scrollContainer') private scrollContainer?: ElementRef<HTMLDivElement>;

 readonly mensajes = signal<ChatMessage[]>([]);
 readonly escribiendo = signal(false);
 inputTexto = '';

 readonly sugerencias = signal<string[]>([
 '¿Qué vestidos elegantes tienen disponibles en stock?',
 '¿Cuáles son los horarios y direcciones de las sucursales?',
 '¿Tienen cupones de descuento o promociones vigentes?',
 '¿Qué prendas hay disponibles en talla M?',
 ]);

 readonly productoAgregadoId = signal<number | null>(null);

 ngOnInit(): void {
 const nombre = this.auth.getCurrentUser()?.nombre ?? 'Cliente';
 this.mensajes.set([
 {
 id: 'welcome-page',
 rol: 'asistente',
 contenido: `¡Bienvenido(a) **${nombre}**! ✨\n\nSoy tu asistente de moda **Attention AI**. Tengo acceso al inventario en tiempo real de todas las sucursales y promociones. ¿En qué puedo orientarte hoy?`,
 fecha: new Date().toISOString(),
 },
 ]);
 }

 enviarMensaje(textoPersonalizado?: string): void {
 const texto = (textoPersonalizado ?? this.inputTexto).trim();
 if (!texto || this.escribiendo()) return;

 const msgUsuario: ChatMessage = {
 id: `usr-${Date.now()}`,
 rol: 'usuario',
 contenido: texto,
 fecha: new Date().toISOString(),
 };

 this.mensajes.update((prev) => [...prev, msgUsuario]);
 this.inputTexto = '';
 this.escribiendo.set(true);
 setTimeout(() => this.scrollToBottom(), 50);

 this.iaService.enviarMensaje(texto, this.mensajes()).subscribe({
 next: (resp) => {
 const data = resp.data;
 const msgAsistente: ChatMessage = {
 id: `ia-${Date.now()}`,
 rol: 'asistente',
 contenido: data.respuesta,
 productos_recomendados: data.productos_recomendados,
 productos_detalle: data.productos_detalle,
 sugerencias: data.sugerencias,
 fecha: new Date().toISOString(),
 };

 this.mensajes.update((prev) => [...prev, msgAsistente]);
 if (data.sugerencias && data.sugerencias.length > 0) {
 this.sugerencias.set(data.sugerencias);
 }
 this.escribiendo.set(false);
 setTimeout(() => this.scrollToBottom(), 100);
 },
 error: (err) => {
 const msgError: ChatMessage = {
 id: `err-${Date.now()}`,
 rol: 'asistente',
 contenido:
 err?.error?.detail ??
 'Lo sentimos, ocurrió un error al consultar el catálogo. Por favor intenta nuevamente.',
 fecha: new Date().toISOString(),
 esError: true,
 };
 this.mensajes.update((prev) => [...prev, msgError]);
 this.escribiendo.set(false);
 setTimeout(() => this.scrollToBottom(), 100);
 },
 });
 }

 agregarAlCarrito(prod: ProductoResumenIA): void {
 const tallaDefecto = prod.tallas && prod.tallas.length > 0 ? prod.tallas[0] : 'M';
 const colorDefecto = prod.colores && prod.colores.length > 0 ? prod.colores[0].nombre_color : 'Único';
 const hexDefecto = prod.colores && prod.colores.length > 0 ? prod.colores[0].codigo_hex || '#000000' : '#000000';

 this.carritoService.agregarAlCarrito({
 producto_id: prod.id_producto,
 nombre: prod.nombre,
 talla: tallaDefecto,
 color: colorDefecto,
 color_hex: hexDefecto,
 precio: prod.precio_venta,
 cantidad: 1,
 imagen_url: prod.imagen_url ?? null,
 });

 this.productoAgregadoId.set(prod.id_producto);
 setTimeout(() => {
 if (this.productoAgregadoId() === prod.id_producto) {
 this.productoAgregadoId.set(null);
 }
 }, 2500);
 }

 probarConIA(prod: ProductoResumenIA): void {
 this.router.navigate(['/probador-virtual'], {
 queryParams: { prenda_id: prod.id_producto },
 });
 }

 limpiarConversacion(): void {
 this.ngOnInit();
 }

 formatearMarkdown(texto: string): string {
 if (!texto) return '';
 let escaped = texto
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;');
 escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
 escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
 escaped = escaped.replace(/(?:^|\n)- (.*?)(?=\n|$)/g, '<br>• $1');
 escaped = escaped.replace(/\n/g, '<br>');
 return escaped;
 }

 private scrollToBottom(): void {
 if (this.scrollContainer) {
 try {
 const el = this.scrollContainer.nativeElement;
 el.scrollTop = el.scrollHeight;
 } catch (_) {}
 }
 }
}
