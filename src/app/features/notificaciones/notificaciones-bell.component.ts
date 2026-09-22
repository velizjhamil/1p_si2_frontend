import {
 Component,
 ElementRef,
 HostListener,
 OnDestroy,
 OnInit,
 inject,
 signal,
 computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { AuthService } from '../../core/services/auth.service';
import {
 Notificacion,
 TipoNotificacion,
} from '../../core/models/notificacion.model';

/**
 * Campanita de notificaciones del header.
 *
 * Componente inline (template chico) montado en el `LayoutComponent`
 * junto al carrito. Maneja:
 * - Apertura/cierre del popover (con click-outside para cerrar).
 * - Badge con el contador de no leidas (`noLeidas` del service).
 * - Carga inicial + polling cada 60s para refrescar el contador sin
 * pagar el costo del listado.
 * - Click en una notificacion: marca leida + navega al deep-link si
 * tiene `referencia_tipo`/`referencia_id`.
 *
 * DIFERENCIACION VISUAL POR ROL (capa UI, no backend):
 * El backend ya aísla notificaciones por `id_usuario` (un Cliente NO ve
 * las de un Gerente y viceversa). Acá ajustamos el COPY y el set de
 * tipos visibles en el popover:
 *
 * - Cliente (C) -> "Tus alertas de compra" (PEDIDO, DEVOLUCION, SUCCESS, INFO)
 * - Gerente (GS) -> "Notificaciones operativas" (TODOS los tipos)
 * - Vendedor (V) -> "Notificaciones de ventas" (TODOS los tipos)
 * - Admin (ASU) -> "Bandeja global" (TODOS los tipos)
 *
 * El filtrado por tipo es SOLO del popover (UX). El contador del badge
 * sigue reflejando el total real del backend (no miente). El usuario
 * puede ir a `/notificaciones` para ver todo sin filtro.
 *
 * El estado vive en `NotificacionesService` (signals), asi que OTROS
 * componentes (vista dedicada `/notificaciones`) leen el mismo store
 * y ven los cambios al instante.
 */
@Component({
 selector: 'app-notificaciones-bell',
 imports: [DatePipe, RouterLink],
 template: `
 <div class="relative">
 <!-- Botón campana -->
 <button
 type="button"
 (click)="toggleDropdown()"
 class="relative h-10 w-10 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-primary active:scale-95 transition flex items-center justify-center"
 [title]="headerContexto().titulo"
 [attr.aria-label]="headerContexto().titulo"
 [attr.aria-expanded]="dropdownAbierto()"
 >
 <svg
 class="h-6 w-6"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 stroke-width="2"
 stroke-linecap="round"
 stroke-linejoin="round"
 aria-hidden="true"
 >
 <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
 <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
 </svg>
 @if (notificacionesService.noLeidas() > 0) {
 <span
 class="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-accent text-primary text-[11px] font-bold flex items-center justify-center shadow-sm"
 >
 {{
 notificacionesService.noLeidas() > 99
 ? '99+'
 : notificacionesService.noLeidas()
 }}
 </span>
 }
 </button>

 <!-- Dropdown -->
 @if (dropdownAbierto()) {
 <div
 class="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
 (click)="$event.stopPropagation()"
 >
 <!-- Cabecera del dropdown (copy contextual segun rol) -->
 <div
 class="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-container"
 >
 <div class="min-w-0">
 <p class="text-sm font-semibold text-primary truncate">
 {{ headerContexto().titulo }}
 </p>
 <p class="text-xs text-slate-600 truncate">
 {{ headerContexto().subtitulo }}
 </p>
 </div>
 @if (notificacionesService.noLeidas() > 0) {
 <button
 type="button"
 (click)="marcarTodasLeidas()"
 class="text-xs font-semibold text-primary hover:text-accent transition shrink-0 ml-2"
 title="Marcar todas como leídas"
 >
 Marcar todas
 </button>
 }
 </div>

 <!-- Lista -->
 <div class="max-h-[60vh] overflow-y-auto">
 @if (notificacionesService.cargando()) {
 <p class="px-4 py-8 text-center text-sm text-slate-500">
 Cargando...
 </p>
 } @else if (itemsVisibles().length === 0) {
 <div class="px-4 py-10 text-center">
 <svg
 class="h-10 w-10 mx-auto text-slate-300 mb-2"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 stroke-width="1.5"
 stroke-linecap="round"
 stroke-linejoin="round"
 aria-hidden="true"
 >
 <path
 d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"
 />
 </svg>
 <p class="text-sm text-slate-500">{{ headerContexto().vacio }}</p>
 </div>
 } @else {
 <ul class="divide-y divide-slate-100">
 @for (n of itemsVisibles(); track n.id_notificacion) {
 <li>
 <button
 type="button"
 (click)="onClickNotificacion(n)"
 class="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-start gap-3"
 [class.bg-container]="!n.leida"
 >
 <!-- Indicador de no leída (puntito) -->
 <span
 class="mt-1.5 h-2 w-2 rounded-full shrink-0"
 [class.bg-primary]="!n.leida"
 [class.bg-transparent]="n.leida"
 ></span>
 <div class="flex-1 min-w-0">
 <div class="flex items-center gap-2">
 <p
 class="text-sm font-semibold truncate"
 [class.text-slate-900]="!n.leida"
 [class.text-slate-600]="n.leida"
 >
 {{ n.titulo }}
 </p>
 <span
 class="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
 [class]="badgeClase(n.tipo)"
 >
 {{ n.tipo }}
 </span>
 </div>
 <p
 class="text-xs mt-0.5 line-clamp-2"
 [class.text-slate-700]="!n.leida"
 [class.text-slate-500]="n.leida"
 >
 {{ n.mensaje }}
 </p>
 <p class="text-[10px] text-slate-400 mt-1">
 {{ n.fecha_creacion | date: 'dd/MM HH:mm' }}
 </p>
 </div>
 </button>
 </li>
 }
 </ul>
 }
 </div>

 <!-- Footer del dropdown -->
 <div
 class="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between"
 >
 <span class="text-[11px] text-slate-500">
 @if (notificacionesService.ultimaSync(); as t) {
 Actualizado {{ t | date: 'HH:mm:ss' }}
 }
 </span>
 <a
 routerLink="/notificaciones"
 (click)="cerrarDropdown()"
 class="text-xs font-semibold text-primary hover:text-accent transition"
 >
 @if (filtraPorTipo()) {
 Ver todas (sin filtro)
 } @else {
 Ver todas
 }
 </a>
 </div>
 </div>
 }
 </div>
 `,
})
export class NotificacionesBellComponent implements OnInit, OnDestroy {
 protected readonly notificacionesService = inject(NotificacionesService);
 private readonly authService = inject(AuthService);
 private readonly router = inject(Router);
 private readonly host = inject(ElementRef<HTMLElement>);
 private readonly platformId = inject(PLATFORM_ID);

 /** Dropdown abierto/cerrado. */
 protected readonly dropdownAbierto = signal<boolean>(false);

 /**
 * Signal estable del rol actual (lee de currentUser$ o localStorage).
 * 'INVITADO' es un fallback: en la práctica el guard garantiza que
 * esta campanita SOLO se monta dentro del layout autenticado, así que
 * el usuario nunca debería ver el fallback.
 */
 private readonly _rolFromUser = toSignal(this.authService.currentUser$, {
 initialValue: this.authService.getCurrentUser(),
 });
 protected readonly _rol = computed<string>(() => {
 const u = this._rolFromUser();
 const nombre = u?.rol?.nombre_rol;
 if (nombre) return String(nombre).toUpperCase();
 // Fallback: si la sesion se restauro despues de montar la campanita
 // (caso SSR/hidratacion).
 if (isPlatformBrowser(this.platformId)) {
 try {
 const raw = localStorage.getItem('auth_user');
 if (raw) {
 const parsed = JSON.parse(raw);
 const r = parsed?.rol?.nombre_rol || parsed?.rol;
 if (r) return String(r).toUpperCase();
 }
 } catch {
 // ignore
 }
 }
 return 'INVITADO';
 });

 /** Tipos permitidos en el popover segun rol. */
 private readonly TIPOS_POR_ROL: Record<string, ReadonlyArray<TipoNotificacion> | 'TODOS'> = {
 C: ['PEDIDO', 'DEVOLUCION', 'SUCCESS', 'INFO'],
 GS: 'TODOS',
 V: 'TODOS',
 ASU: 'TODOS',
 ADMIN: 'TODOS',
 INVITADO: 'TODOS',
 };

 /** Items visibles en el popover: filtrados por tipo segun rol, slice 10. */
 protected readonly itemsVisibles = computed<Notificacion[]>(() => {
 const rol = this._rol();
 const permitidos = this.TIPOS_POR_ROL[rol] ?? 'TODOS';
 const ordenados = this.notificacionesService.itemsOrdenados();
 const filtrados =
 permitidos === 'TODOS'
 ? ordenados
 : ordenados.filter((n) => permitidos.includes(n.tipo));
 return filtrados.slice(0, 10);
 });

 /** Copy contextual del header del popover segun rol. */
 protected readonly headerContexto = computed<{
 titulo: string;
 subtitulo: string;
 vacio: string;
 }>(() => {
 const rol = this._rol();
 const noLeidas = this.notificacionesService.noLeidas();
 switch (rol) {
 case 'C':
 return {
 titulo: 'Tus alertas de compra',
 subtitulo:
 noLeidas === 0
 ? 'Pedidos, pagos y envíos al día'
 : `${noLeidas} alerta(s) por revisar`,
 vacio: 'Sin alertas de compra por ahora',
 };
 case 'GS':
 return {
 titulo: 'Notificaciones operativas',
 subtitulo:
 noLeidas === 0
 ? 'Sucursal y alertas del sistema al día'
 : `${noLeidas} aviso(s) operativo(s) pendiente(s)`,
 vacio: 'Sin avisos operativos pendientes',
 };
 case 'V':
 return {
 titulo: 'Notificaciones de ventas',
 subtitulo:
 noLeidas === 0
 ? 'Sin novedades de venta pendientes'
 : `${noLeidas} novedad(es) por revisar`,
 vacio: 'Sin novedades de venta',
 };
 case 'ASU':
 case 'ADMIN':
 return {
 titulo: 'Bandeja global',
 subtitulo:
 noLeidas === 0
 ? 'Sistema al día'
 : `${noLeidas} notificacion(es) en el sistema`,
 vacio: 'Sin notificaciones en el sistema',
 };
 default:
 return {
 titulo: 'Notificaciones',
 subtitulo: `${noLeidas} sin leer`,
 vacio: 'Sin notificaciones',
 };
 }
 });

 /** True si el rol actual tiene un subconjunto de tipos (no ve todo). */
 protected readonly filtraPorTipo = computed<boolean>(() => {
 const permitidos = this.TIPOS_POR_ROL[this._rol()] ?? 'TODOS';
 return permitidos !== 'TODOS';
 });

 private pollingId: ReturnType<typeof setInterval> | null = null;

 ngOnInit(): void {
 // Carga inicial (silenciosa: si falla, no rompe el header).
 this.notificacionesService.cargar({ limit: 50 }).subscribe({
 error: () => {
 // Silencioso: el badge queda en 0; la vista dedicada hara retry.
 },
 });

 // Polling cada 60s del contador (refresh BARATO, no del listado).
 this.pollingId = setInterval(() => {
 this.notificacionesService.refrescarContador().subscribe({
 error: () => {
 // Si el token expira, el backend responde 401 y el interceptor
 // redirige a /login; aqui solo dejamos de hacer ruido.
 },
 });
 }, 60_000);
 }

 ngOnDestroy(): void {
 if (this.pollingId !== null) {
 clearInterval(this.pollingId);
 }
 }

 // --------------------------------------------------------------- dropdown
 protected toggleDropdown(): void {
 const nuevo = !this.dropdownAbierto();
 this.dropdownAbierto.set(nuevo);
 if (nuevo) {
 // Reabrir: re-fetch del listado para mostrar lo mas reciente.
 this.notificacionesService.cargar({ limit: 50 }).subscribe({
 error: () => {
 // Silencioso.
 },
 });
 }
 }

 protected cerrarDropdown(): void {
 this.dropdownAbierto.set(false);
 }

 /** Click fuera del componente -> cierra el dropdown. */
 @HostListener('document:click', ['$event'])
 onDocumentClick(event: MouseEvent): void {
 if (!this.dropdownAbierto()) return;
 const target = event.target as Node | null;
 if (target && !this.host.nativeElement.contains(target)) {
 this.dropdownAbierto.set(false);
 }
 }

 /** Escapa cierra el dropdown (accesibilidad). */
 @HostListener('document:keydown.escape')
 onEscape(): void {
 if (this.dropdownAbierto()) this.dropdownAbierto.set(false);
 }

 // --------------------------------------------------------------- acciones
 protected onClickNotificacion(n: Notificacion): void {
 // 1) Marcar leida (idempotente, server-side). Tap ya leida tambien
 // dispara el deep-link (no re-marca).
 if (!n.leida) {
 this.notificacionesService.marcarLeida(n.id_notificacion).subscribe({
 error: () => {
 // Si falla el PATCH, el store local no se actualiza; el usuario
 // puede volver a intentar.
 },
 });
 }

 // 2) Deep-link si la notificacion referencia un recurso.
 const ruta = this.deepLinkDe(n);
 if (ruta) {
 this.dropdownAbierto.set(false);
 this.router.navigateByUrl(ruta);
 }
 }

 protected marcarTodasLeidas(): void {
 this.notificacionesService.marcarTodasLeidas().subscribe({
 error: () => {
 // Silencioso.
 },
 });
 }

 /** Mapea `referencia_tipo` + `referencia_id` a una ruta interna. */
 private deepLinkDe(n: Notificacion): string | null {
 if (!n.referencia_tipo || !n.referencia_id) return null;
 switch (n.referencia_tipo) {
 case 'venta':
 return `/ventas`; // no hay detalle público de venta en la nav
 case 'devolucion':
 return '/devoluciones';
 case 'reserva':
 return '/reservas/gestion';
 case 'producto':
 return `/catalogo/productos`;
 default:
 return null;
 }
 }

 // --------------------------------------------------------------- helpers UI
 /** Color del badge segun el tipo (paleta Atencion + semaforo basico). */
 protected badgeClase(tipo: TipoNotificacion): string {
 switch (tipo) {
 case 'ERROR':
 case 'STOCK':
 return 'bg-rose-50 text-rose-700 border border-rose-200/60';
 case 'WARNING':
 return 'bg-amber-50 text-amber-800 border border-amber-200/60';
 case 'SUCCESS':
 return 'bg-emerald-50 text-emerald-700 border border-emerald-200/60';
 case 'PEDIDO':
 case 'DEVOLUCION':
 return 'bg-blue-50 text-blue-700 border border-blue-200/60';
 case 'SISTEMA':
 return 'bg-slate-100 text-slate-700 border border-slate-200/60';
 case 'INFO':
 default:
 return 'bg-container text-primary border border-primary/15';
 }
 }
}
