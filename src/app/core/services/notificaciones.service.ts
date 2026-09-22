import {
 Injectable,
 PLATFORM_ID,
 computed,
 inject,
 signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, map, of, tap } from 'rxjs';
import { ApiService } from './api';
import { ApiResponse } from '../models/usuario.model';
import {
 Notificacion,
 NotificacionCreatePayload,
 NotificacionFiltros,
 NotificacionListado,
} from '../models/notificacion.model';

/**
 * Gestión de Notificaciones.
 *
 * Estado global con signals: la campanita del layout y la vista
 * dedicada leen del MISMO store, así un marcado-desde-campana se
 * refleja instantáneamente en la vista y viceversa.
 *
 * El servicio NO se auto-inicia: quien lo necesita (la campanita del
 * layout) llama a `cargar()` al login. El contador `noLeidas` se
 * mantiene en sincronía con cada operación.
 *
 * Contrato del backend:
 * - GET /api/v1/notificaciones?solo_no_leidas=&page=&limit=
 * - GET /api/v1/notificaciones/contador-no-leidas
 * - POST /api/v1/notificaciones (ASU/GS)
 * - PATCH /api/v1/notificaciones/{id}/leer
 * - PATCH /api/v1/notificaciones/leer-todas
 * - DELETE /api/v1/notificaciones/{id}
 *
 * El JWT lo agrega el interceptor HTTP (no se manda manual).
 */

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
 private readonly api = inject(ApiService);
 private readonly platformId = inject(PLATFORM_ID);

 // ------------------------------------------------------------------ estado
 /** Bandeja cruda (cacheada, source of truth). */
 private readonly _items = signal<Notificacion[]>([]);
 readonly items = this._items.asReadonly();

 /** Contador de no leídas (deriva de items pero también se actualiza
 * por operaciones individuales). */
 private readonly _noLeidas = signal<number>(0);
 readonly noLeidas = this._noLeidas.asReadonly();

 /** Última vez que se cargó (para el polling barato del header). */
 private readonly _ultimaSync = signal<Date | null>(null);
 readonly ultimaSync = this._ultimaSync.asReadonly();

 /** Estado de carga (true durante `cargar()`). */
 private readonly _cargando = signal<boolean>(false);
 readonly cargando = this._cargando.asReadonly();

 /** Vista derivada: items sin leer primero, luego leídas, por fecha DESC. */
 readonly itemsOrdenados = computed(() =>
 [...this._items()].sort((a, b) => {
 if (a.leida !== b.leida) return a.leida ? 1 : -1;
 return (
 new Date(b.fecha_creacion).getTime() -
 new Date(a.fecha_creacion).getTime()
 );
 }),
 );

 // ----------------------------------------------------------------- listado
 /**
 * GET /notificaciones - listado paginado.
 * Actualiza la señal `items` y el contador `noLeidas`.
 */
 cargar(filtros: NotificacionFiltros = {}): Observable<NotificacionListado> {
 this._cargando.set(true);
 const params: string[] = [];
 if (filtros.solo_no_leidas) params.push('solo_no_leidas=true');
 params.push(`page=${filtros.page ?? 1}`);
 params.push(`limit=${filtros.limit ?? 50}`);
 const qs = `?${params.join('&')}`;

 return this.api.get<ApiResponse<Notificacion[]> & {
 total: number;
 total_no_leidas: number;
 page: number;
 limit: number;
 pages: number;
 }>(`/notificaciones${qs}`).pipe(
 map((resp) => ({
 items: resp.data,
 total: resp.total,
 total_no_leidas: resp.total_no_leidas,
 page: resp.page,
 limit: resp.limit,
 pages: resp.pages,
 })),
 tap((resp) => {
 this._items.set(resp.items);
 this._noLeidas.set(resp.total_no_leidas);
 this._ultimaSync.set(new Date());
 this._cargando.set(false);
 }),
 );
 }

 /**
 * GET /notificaciones/contador-no-leidas - refresh barato del badge
 * del header (sin pagar el costo del listado). Llamado por el polling
 * cada 60s o por foco de la ventana.
 */
 refrescarContador(): Observable<number> {
 return this.api
 .get<ApiResponse<{ total_no_leidas: number }>>(
 '/notificaciones/contador-no-leidas',
 )
 .pipe(
 map((r) => r.data.total_no_leidas),
 tap((n) => this._noLeidas.set(n)),
 );
 }

 // -------------------------------------------------------------- crear (ASU/GS)
 /** POST /notificaciones - crear (solo ASU/GS vía HTTP). */
 crear(payload: NotificacionCreatePayload): Observable<Notificacion> {
 return this.api
 .post<ApiResponse<Notificacion>>('/notificaciones', payload)
 .pipe(
 map((resp) => resp.data),
 tap(() => {
 // Refresca el contador (puede que la nueva sea para mi).
 this.refrescarContador().subscribe();
 this._ultimaSync.set(new Date());
 }),
 );
 }

 // ------------------------------------------------------------- marcar leida
 /** PATCH /{id}/leer - marca UNA como leida (idempotente). */
 marcarLeida(id_notificacion: number): Observable<Notificacion> {
 return this.api
 .patch<ApiResponse<Notificacion>>(
 `/notificaciones/${id_notificacion}/leer`,
 null,
 )
 .pipe(
 map((resp) => resp.data),
 tap((n) => this.aplicarLeidaLocal(n)),
 );
 }

 /** PATCH /leer-todas - marca TODAS como leidas. */
 marcarTodasLeidas(): Observable<{ marcadas: number }> {
 return this.api
 .patch<ApiResponse<{ marcadas: number }>>(
 '/notificaciones/leer-todas',
 null,
 )
 .pipe(
 map((resp) => resp.data),
 tap(() => {
 this._items.update((items) =>
 items.map((n) => ({ ...n, leida: true })),
 );
 this._noLeidas.set(0);
 }),
 );
 }

 // ------------------------------------------------------------------ eliminar
 /** DELETE /{id} - elimina una notificacion. */
 eliminar(id_notificacion: number): Observable<void> {
 return this.api
 .delete<ApiResponse<{ id_notificacion: number }>>(
 `/notificaciones/${id_notificacion}`,
 )
 .pipe(
 tap(() => {
 this._items.update((items) =>
 items.filter((n) => n.id_notificacion !== id_notificacion),
 );
 this.recalcularNoLeidas();
 }),
 map(() => void 0 as void),
 );
 }

 // ------------------------------------------------------------------ helpers
 /** Resetea el store (logout). */
 limpiar(): void {
 this._items.set([]);
 this._noLeidas.set(0);
 this._ultimaSync.set(null);
 }

 /** No-op si no estamos en el browser (evita errores en SSR). */
 private aplicarLeidaLocal(n: Notificacion): void {
 this._items.update((items) =>
 items.map((it) =>
 it.id_notificacion === n.id_notificacion
 ? { ...it, leida: n.leida }
 : it,
 ),
 );
 this.recalcularNoLeidas();
 }

 /** Recalcula el contador de no leidas desde la cache local. */
 private recalcularNoLeidas(): void {
 const n = this._items().filter((it) => !it.leida).length;
 this._noLeidas.set(n);
 }

 /**
 * Sentinel: previene el bug tipico de "importar en el server pero el
 * servicio intenta leer localStorage". Expuesto para que el layout NO
 * llame a `cargar()` en SSR (donde el request no tiene token).
 */
 readonly esBrowser = computed(() => isPlatformBrowser(this.platformId));
}
