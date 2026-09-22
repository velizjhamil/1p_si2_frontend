import {
 Component,
 OnInit,
 inject,
 signal,
 computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { isPlatformBrowser, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
 Notificacion,
 TipoNotificacion,
} from '../../core/models/notificacion.model';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

type Filtro = 'todas' | 'no_leidas';

/** Roles que pueden disparar el modal de 'Nueva notificacion'. */
const ROLES_EMISOR: ReadonlyArray<string> = ['GS', 'ASU', 'ADMIN'];

/**
 * Vista dedicada de notificaciones.
 *
 * Bandeja completa con:
 * - Filtro rapido: Todas / Solo no leidas.
 * - Filtro por tipo (chips).
 * - Marcar individual / marcar todas / eliminar (con confirm).
 * - Boton "Nueva notificacion" SOLO para GS / ASU (con modal de envio).
 * - Deep-link a la referencia (mismo mapeo que la campanita).
 *
 * Comparte store con la campanita del header: cualquier accion
 * (marcar leida, eliminar, crear) se refleja al instante en el badge.
 */
@Component({
 selector: 'app-notificaciones',
 imports: [FormsModule, DatePipe, ConfirmDialogComponent],
 templateUrl: './notificaciones.component.html',
})
export class NotificacionesComponent implements OnInit {
 protected readonly noti = inject(NotificacionesService);
 private readonly authService = inject(AuthService);
 private readonly api = inject(ApiService);
 private readonly router = inject(Router);
 private readonly platformId = inject(PLATFORM_ID);

 protected readonly cargando = signal(false);
 protected readonly guardando = signal(false);
 protected readonly errorMessage = signal('');
 protected readonly exitoMessage = signal('');

 // Filtros (UI-only, no disparan GET: la cache del service ya esta).
 protected readonly filtro = signal<Filtro>('todas');
 protected readonly tipoFiltro = signal<TipoNotificacion | 'TODOS'>('TODOS');

 // Confirm dialog: eliminar individual
 protected readonly confirmarEliminar = signal<Notificacion | null>(null);

 // ----------------------------------------------------------------- modal
 // Estado del modal "Nueva notificacion". Solo se muestra si el rol es
 // GS o ASU (validado en puedeEmitir()).
 protected readonly modalAbierto = signal<boolean>(false);
 /**
 * UUID del destinatario seleccionado en el <select>. VACIO = nadie
 * seleccionado. El backend espera `id_usuario: UUID` (ver
 * `backend/app/schemas/notificacion.py:NotificacionCreate`), asi que
 * el form guarda el UUID directamente: cero mapeo, cero regex,
 * cero conversion correo -> id. El <select> usa el UUID como value.
 */
 protected readonly formDestinatarioId = signal<string>('');
 protected readonly formTitulo = signal<string>('');
 protected readonly formMensaje = signal<string>('');
 protected readonly formTipo = signal<TipoNotificacion>('INFO');
 protected readonly enviando = signal<boolean>(false);
 protected readonly errorModal = signal<string>('');

 /**
 * Catalogo de usuarios para llenar el <select>. Se carga una sola vez
 * al abrir el modal. El endpoint GET /api/v1/usuarios no soporta ?q=,
 * asi que traemos la lista completa y el <select> se encarga del UX.
 */
 protected readonly usuariosCatalogo = signal<Array<{
 id_usuario: string;
 correo: string;
 nombre?: string;
 apellido?: string | null;
 }>>([]);
 protected readonly cargandoUsuarios = signal<boolean>(false);

 // Roles del usuario actual (signal estable desde AuthService)
 private readonly _userFromAuth = toSignal(this.authService.currentUser$, {
 initialValue: this.authService.getCurrentUser(),
 });
 protected readonly _rol = computed<string>(() => {
 const u = this._userFromAuth();
 const nombre = u?.rol?.nombre_rol;
 if (nombre) return String(nombre).toUpperCase();
 // Fallback SSR / hidratacion: localStorage
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

 /** True si el usuario puede abrir el modal de nueva notificacion. */
 protected readonly puedeEmitir = computed<boolean>(() =>
 ROLES_EMISOR.includes(this._rol()),
 );

 /** Tipos disponibles para los chips de filtro Y para el select del modal. */
 protected readonly tipos: Array<TipoNotificacion | 'TODOS'> = [
 'TODOS',
 'INFO',
 'WARNING',
 'ERROR',
 'SUCCESS',
 'STOCK',
 'PEDIDO',
 'DEVOLUCION',
 'SISTEMA',
 ];

 /** Tipos que el modal deja elegir (TODOS no es un tipo valido de envio). */
 protected readonly tiposEnviables: TipoNotificacion[] = [
 'INFO',
 'WARNING',
 'ERROR',
 'SUCCESS',
 'STOCK',
 'PEDIDO',
 'DEVOLUCION',
 'SISTEMA',
 ];

 /** Items ya cacheados, filtrados por UI. */
 protected readonly itemsFiltrados = computed(() => {
 const todos = this.noti.itemsOrdenados();
 const f = this.filtro();
 const t = this.tipoFiltro();
 return todos.filter((n) => {
 if (f === 'no_leidas' && n.leida) return false;
 if (t !== 'TODOS' && n.tipo !== t) return false;
 return true;
 });
 });

 /** Validacion reactiva del formulario del modal.
 *
 * Refleja 1-a-1 las constraints del schema Pydantic
 * `NotificacionCreate` en backend/app/schemas/notificacion.py:
 * - id_usuario: UUID valido (regex v4 completa; el backend
 * acepta cualquier UUID, no solo v4, pero el seed del proyecto
 * siempre emite v4, asi que validamos v4 para mayor precision)
 * - titulo: 1..100 chars
 * - mensaje: 1..500 chars
 * - tipo: uno de los 8 valores (validado por el chip seleccionado)
 *
 * Si el form pasa `formValido()` aqui, NO deberia recibir 422 del
 * backend (el id_usuario ya viene del catalogo, que lo garantiza).
 */
 protected readonly formValido = computed<boolean>(() => {
 const id = this.formDestinatarioId();
 const titulo = this.formTitulo().trim();
 const mensaje = this.formMensaje().trim();
 // UUID v4 completo (32 hex + 4 guiones, version 4 en el tercer grupo).
 const uuidOk = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
 id,
 );
 return (
 uuidOk &&
 titulo.length >= 1 &&
 titulo.length <= 100 &&
 mensaje.length >= 1 &&
 mensaje.length <= 500
 );
 });

 ngOnInit(): void {
 this.cargar();
 }

 cargar(): void {
 this.cargando.set(true);
 this.errorMessage.set('');
 this.noti.cargar({ limit: 100 }).subscribe({
 next: () => this.cargando.set(false),
 error: () => {
 this.errorMessage.set('No se pudieron cargar las notificaciones.');
 this.cargando.set(false);
 },
 });
 }

 // --------------------------------------------------------------- acciones
 onClickNotificacion(n: Notificacion): void {
 if (!n.leida) {
 this.noti.marcarLeida(n.id_notificacion).subscribe({
 error: () => this.errorMessage.set('No se pudo marcar como leída.'),
 });
 }
 const ruta = this.deepLinkDe(n);
 if (ruta) this.router.navigateByUrl(ruta);
 }

 marcarTodasLeidas(): void {
 if (this.noti.noLeidas() === 0) return;
 this.guardando.set(true);
 this.noti.marcarTodasLeidas().subscribe({
 next: () => {
 this.guardando.set(false);
 this.flashExito('Todas las notificaciones marcadas como leídas.');
 },
 error: () => {
 this.guardando.set(false);
 this.errorMessage.set('No se pudieron marcar como leídas.');
 },
 });
 }

 pedirEliminar(n: Notificacion): void {
 this.confirmarEliminar.set(n);
 }

 confirmarEliminacion(): void {
 const n = this.confirmarEliminar();
 if (!n) return;
 this.guardando.set(true);
 this.noti.eliminar(n.id_notificacion).subscribe({
 next: () => {
 this.guardando.set(false);
 this.confirmarEliminar.set(null);
 this.flashExito('Notificación eliminada.');
 },
 error: () => {
 this.guardando.set(false);
 this.confirmarEliminar.set(null);
 this.errorMessage.set('No se pudo eliminar la notificación.');
 },
 });
 }

 cancelarEliminacion(): void {
 this.confirmarEliminar.set(null);
 }

 // ----------------------------------------------------------- modal envio
 /**
 * Abre el modal y (si hace falta) carga el catalogo de usuarios. El
 * catalogo se cachea en memoria para que abrir/cerrar el modal sea
 * instantáneo. Se recarga si el caller lo pide (boton 'Refrescar').
 */
 abrirModalNueva(forzarRecarga: boolean = false): void {
 this.formDestinatarioId.set('');
 this.formTitulo.set('');
 this.formMensaje.set('');
 this.formTipo.set('INFO');
 this.errorModal.set('');
 this.modalAbierto.set(true);
 if (forzarRecarga || this.usuariosCatalogo().length === 0) {
 this.cargarCatalogoUsuarios();
 }
 }

 /** Cierra el modal sin enviar. */
 cerrarModal(): void {
 if (this.enviando()) return; // no cerrar mientras se envia
 this.modalAbierto.set(false);
 this.errorModal.set('');
 }

 /**
 * GET /api/v1/usuarios. El endpoint actual no soporta ?q= (filtra en
 * servidor), asi que traemos la lista completa y resolvemos el
 * destinatario por coincidencia exacta de correo en memoria. Si la
 * base crece, agregar `?q=` al backend es trivial.
 */
 private cargarCatalogoUsuarios(): void {
 this.cargandoUsuarios.set(true);
 this.api
 .get<ApiResponse<Array<{
 id_usuario: string;
 correo: string;
 nombre?: string;
 apellido?: string | null;
 }>>>('/usuarios')
 .subscribe({
 next: (resp) => {
 this.usuariosCatalogo.set(resp.data ?? []);
 this.cargandoUsuarios.set(false);
 },
 error: () => {
 this.cargandoUsuarios.set(false);
 this.errorModal.set(
 'No se pudo cargar el catálogo de usuarios. Intente nuevamente.',
 );
 },
 });
 }

 /**
 * Toma el id_usuario del <select> (ya validado por formValido()) y
 * dispara POST /api/v1/notificaciones. No hay conversion ni busqueda:
 * el UUID viaja tal cual del catalogo al backend.
 *
 * Defense in depth (en orden):
 * 1. formValido() cubre titulo/mensaje/longitud + UUID formato.
 * 2. catalogo cargado (boton disabled, pero lo verificamos igual).
 * 3. el UUID existe en el catalogo (defensa contra manipulacion del DOM).
 */
 enviarNueva(): void {
 if (!this.formValido() || this.enviando()) return;
 this.enviando.set(true);
 this.errorModal.set('');

 const idUsuario = this.formDestinatarioId();

 // Hardening: si el catalogo no esta cargado, NO enviamos.
 if (this.cargandoUsuarios() || this.usuariosCatalogo().length === 0) {
 this.enviando.set(false);
 this.errorModal.set(
 'El catálogo de usuarios aún se está cargando. Espere un momento e intente nuevamente.',
 );
 return;
 }

 // Hardening: el id_usuario tiene que existir en el catalogo. Esto
 // protege contra una manipulacion del DOM (e.g. devtools) que setee
 // un UUID que no corresponde a ningun usuario real. El backend lo
 // rechazaria con 404, pero cortamos antes.
 const existeEnCatalogo = this.usuariosCatalogo().some(
 (u) => u.id_usuario === idUsuario,
 );
 if (!existeEnCatalogo) {
 this.enviando.set(false);
 this.errorModal.set(
 'El destinatario seleccionado no es válido. Refresque el catálogo e intente nuevamente.',
 );
 return;
 }

 this.noti
 .crear({
 id_usuario: idUsuario,
 titulo: this.formTitulo().trim(),
 mensaje: this.formMensaje().trim(),
 tipo: this.formTipo(),
 })
 .subscribe({
 next: () => {
 this.enviando.set(false);
 this.modalAbierto.set(false);
 this.flashExito('Notificación enviada correctamente.');
 this.cargar(); // refresca la bandeja para ver la nueva
 },
 error: (err) => {
 this.enviando.set(false);
 this.errorModal.set(
 err?.error?.detail ||
 'No se pudo enviar la notificación. Intente nuevamente.',
 );
 },
 });
 }

 // --------------------------------------------------------------- helpers
 setFiltro(f: Filtro): void {
 this.filtro.set(f);
 }
 setTipo(t: TipoNotificacion | 'TODOS'): void {
 this.tipoFiltro.set(t);
 }

 badgeClase(tipo: TipoNotificacion): string {
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
 default:
 return 'bg-container text-primary border border-primary/15';
 }
 }

 private deepLinkDe(n: Notificacion): string | null {
 if (!n.referencia_tipo || !n.referencia_id) return null;
 switch (n.referencia_tipo) {
 case 'devolucion':
 return '/devoluciones';
 case 'reserva':
 return '/reservas/gestion';
 case 'producto':
 return '/catalogo/productos';
 case 'venta':
 default:
 return null; // sin vista publica de venta en el sidebar actual
 }
 }

 private flashExito(msg: string): void {
 this.exitoMessage.set(msg);
 setTimeout(() => this.exitoMessage.set(''), 3000);
 }
}
