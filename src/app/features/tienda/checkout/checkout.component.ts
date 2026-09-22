import { UpperCasePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../../environments/environment';
import { CarritoService } from '../../../core/services/carrito.service';
import { AuthService } from '../../../core/services/auth.service';
import { PasarelaService } from '../../../core/services/pasarela.service';
import {
 DatosEntrega,
 DatosTarjeta,
 MetodoPago,
 TransaccionPago,
 Venta,
 formatBs,
} from '../../../core/models/carrito.model';

/** Métodos de pago disponibles en el checkout. */
const METODOS_PAGO: { id: MetodoPago; label: string; icono: string; descripcion: string }[] = [
 { id: 'QR', label: 'QR Simple', icono: '📱', descripcion: 'Escanee el código interoperable con su app bancaria' },
 { id: 'TARJETA', label: 'Tarjeta (Stripe Checkout)', icono: '💳', descripcion: 'Pasarela oficial Stripe · Visa, Mastercard, Amex' },
 { id: 'EFECTIVO', label: 'Efectivo', icono: '💵', descripcion: 'Pague en efectivo contra entrega / en tienda' },
];

@Component({
 selector: 'app-checkout',
 imports: [ReactiveFormsModule, RouterLink, UpperCasePipe],
 templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit, OnDestroy {
 private readonly fb = inject(FormBuilder);
 protected readonly carrito = inject(CarritoService);
 private readonly auth = inject(AuthService);
 private readonly pasarela = inject(PasarelaService);
 private readonly route = inject(ActivatedRoute);
 private readonly router = inject(Router);

 protected readonly formatBs = formatBs;
 protected readonly metodosPago = METODOS_PAGO;

 /** Método de pago seleccionado (QR por defecto). */
 protected readonly metodoSeleccionado = signal<MetodoPago>('QR');

 /** Procesando el pago / transacción. */
 protected readonly procesando = signal(false);

 /** Transacción activa generada en la pasarela (para QR o Tarjeta). */
 protected readonly transaccionIniciada = signal<TransaccionPago | null>(null);

 /** Pedido confirmado en efectivo contra entrega (Yango). */
 protected readonly pedidoEfectivo = signal<Venta | null>(null);

 /** Código único de pedido generado para QR (a dictar al repartidor). */
 protected readonly codigoPedidoQR = computed(
 () =>
 this.transaccionIniciada()?.codigo_venta ||
 this.transaccionIniciada()?.codigo_transaccion ||
 ''
 );

 /** Código de verificación de pago contra entrega (a dictar a Yango). */
 protected readonly codigoVerificacionEfectivo = computed(
 () =>
 this.pedidoEfectivo()?.codigo ||
 this.ventaConfirmada()?.codigo ||
 ''
 );

 /** Indicador de código copiado al portapapeles. */
 protected readonly copiado = signal(false);

 /** Controla la visualización del modal de factura completa. */
 protected readonly mostrarModalTicket = signal(false);

 /** Segundos restantes de vigencia del QR. */
 protected readonly segundosRestantes = signal<number>(900);

 /** Venta confirmada: controla el modal de ticket. */
 protected readonly ventaConfirmada = signal<Venta | null>(null);

 /** Mensaje de error del proceso de pago. */
 protected readonly errorMessage = signal('');

 private pollingSub?: Subscription;
 private timerSub?: Subscription;

 /** Tipo de entrega seleccionado: a domicilio o retiro en tienda. */
 protected readonly tipoEntrega = signal<'DOMICILIO' | 'RETIRO'>('DOMICILIO');

 /** Controla si se despliega el formulario completo al pagar con Stripe o se mantiene minimizado. */
 protected readonly editarDatosStripe = signal(false);

 /** Usuario autenticado actual. */
 protected readonly currentUser = computed(() => this.auth.getCurrentUser());

 /** Texto dinámico del botón principal según el método de pago seleccionado. */
 protected readonly textoBotonPago = computed(() => {
 const metodo = this.metodoSeleccionado();
 if (metodo === 'TARJETA') {
 return '💳 Pagar con Stripe';
 }
 if (metodo === 'QR') {
 return this.transaccionIniciada()
 ? '✔ Confirmar Validación de Abono'
 : '📲 Ver QR de Pago';
 }
 if (this.pedidoEfectivo()) {
 return '✔ Pedido Confirmado (Ver Código)';
 }
 return '✔ Confirmar Pedido en Efectivo';
 });

 /** Recupera datos guardados o de perfil para autocompletar sin fricciones. */
 private obtenerDatosAutofill(): {
 nombre: string;
 correo: string;
 telefono: string;
 direccion: string;
 ciudad: string;
 } {
 const user = this.auth.getCurrentUser();
 const nombre = user
 ? [user.nombre, (user as any).apellido].filter(Boolean).join(' ')
 : '';
 const correo = user?.correo ?? '';

 let telefono = '';
 let direccion = '';
 let ciudad = 'Santa Cruz';

 if (typeof window !== 'undefined') {
 try {
 telefono =
 (user as any)?.telefono ||
 localStorage.getItem('attention_user_phone') ||
 (user ? '77123456' : '');
 direccion = localStorage.getItem('attention_user_address') || '';
 ciudad = localStorage.getItem('attention_user_city') || 'Santa Cruz';
 } catch {
 // ignore storage error
 }
 }

 return {
 nombre,
 correo,
 telefono: telefono || (user ? '77123456' : ''),
 direccion,
 ciudad,
 };
 }

 /** Datos de facturación/entrega (precargados automáticamente del usuario autenticado). */
 protected readonly datosForm = this.fb.group({
 nombre_cliente: [
 this.obtenerDatosAutofill().nombre,
 [Validators.required, Validators.minLength(3)],
 ],
 correo: [
 this.obtenerDatosAutofill().correo,
 [Validators.required, Validators.email],
 ],
 telefono: [
 this.obtenerDatosAutofill().telefono,
 [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)],
 ],
 direccion: [
 this.obtenerDatosAutofill().direccion,
 [Validators.required, Validators.minLength(5)],
 ],
 ciudad: [this.obtenerDatosAutofill().ciudad, Validators.required],
 referencia: [''],
 });

 /** Formulario de tarjeta de crédito/débito (mantenido por compatibilidad) */
 protected readonly tarjetaForm = this.fb.group({
 titular: [
 (this.auth.getCurrentUser()?.nombre ?? '').toUpperCase(),
 [Validators.required, Validators.minLength(3)],
 ],
 numero_tarjeta: ['', [Validators.required, Validators.pattern(/^[0-9 ]{15,19}$/)]],
 expiracion: ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/[0-9]{2}$/)]],
 cvv: ['', [Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]],
 });

 ngOnInit(): void {
 // Precargar SDK oficial de Stripe en segundo plano
 if (environment.stripePublishableKey) {
 loadStripe(environment.stripePublishableKey).catch((err) => {
 console.warn('Advertencia al precargar Stripe SDK:', err);
 });
 }

 // Validar retorno exitoso de Stripe Checkout (success_url)
 const stripeSessionId = this.route.snapshot.queryParams['stripe_session_id'];
 if (stripeSessionId) {
 this.procesando.set(true);
 this.errorMessage.set('');
 this.pasarela.confirmarSesionStripe(stripeSessionId).subscribe({
 next: (resp) => {
 const data = resp.data;
 this.carrito.confirmarVenta();
 this.ventaConfirmada.set({
 id: data.id_venta,
 codigo: data.codigo_venta,
 items: this.carrito.items(),
 total: data.total,
 metodo_pago: 'TARJETA',
 estado_pago: data.estado_pago || 'PAGADO',
 fecha: data.fecha || new Date().toISOString(),
 datos_entrega: data.datos_entrega || {
 nombre_cliente: this.datosForm.value.nombre_cliente || 'Cliente',
 correo: this.datosForm.value.correo || '',
 telefono: this.datosForm.value.telefono || '',
 direccion: this.datosForm.value.direccion || '',
 ciudad: this.datosForm.value.ciudad || 'Santa Cruz',
 },
 stripe_id: stripeSessionId,
 comprobante_fiscal: data.comprobante_fiscal,
 });
 this.procesando.set(false);
 this.router.navigate([], {
 relativeTo: this.route,
 queryParams: {},
 replaceUrl: true,
 });
 },
 error: (err) => {
 this.errorMessage.set(
 err?.error?.detail ??
 'No se pudo confirmar la sesión oficial de Stripe Checkout.'
 );
 this.procesando.set(false);
 this.router.navigate([], {
 relativeTo: this.route,
 queryParams: {},
 replaceUrl: true,
 });
 },
 });
 }

 // Validar cancelación de pago en Stripe Checkout (cancel_url)
 const cancelParam = this.route.snapshot.queryParams['cancel'];
 if (cancelParam === 'true') {
 this.errorMessage.set('El pago en Stripe Checkout fue cancelado por el usuario.');
 this.router.navigate([], {
 relativeTo: this.route,
 queryParams: {},
 replaceUrl: true,
 });
 }
 }

 ngOnDestroy(): void {
 this.detenerPolling();
 }

 /** Selecciona un método de pago. */
 protected elegirMetodo(metodo: MetodoPago): void {
 this.metodoSeleccionado.set(metodo);
 this.transaccionIniciada.set(null);
 this.pedidoEfectivo.set(null);
 this.detenerPolling();
 this.errorMessage.set('');
 if (metodo === 'TARJETA') {
 this.editarDatosStripe.set(false);
 }
 }

 /** Copia al portapapeles el código de verificación/entrega */
 protected copiarCodigo(codigo: string): void {
 if (!codigo) return;
 if (typeof navigator !== 'undefined' && navigator.clipboard) {
 navigator.clipboard.writeText(codigo).then(() => {
 this.copiado.set(true);
 setTimeout(() => this.copiado.set(false), 2500);
 });
 }
 }

 private detenerPolling(): void {
 this.pollingSub?.unsubscribe();
 this.pollingSub = undefined;
 this.timerSub?.unsubscribe();
 this.timerSub = undefined;
 }

 private iniciarPollingQR(codigoTxn: string, ventaInfo: Venta): void {
 this.detenerPolling();
 this.segundosRestantes.set(900);

 this.timerSub = interval(1000).subscribe(() => {
 const rest = this.segundosRestantes();
 if (rest > 0) {
 this.segundosRestantes.set(rest - 1);
 } else {
 this.detenerPolling();
 }
 });

 this.pollingSub = interval(3000).subscribe(() => {
 this.pasarela.consultarEstado(codigoTxn).subscribe({
 next: (resp) => {
 if (resp.data.estado === 'PAGADO') {
 this.detenerPolling();
 this.carrito.confirmarVenta();
 this.ventaConfirmada.set({
 ...ventaInfo,
 estado_pago: 'PAGADO',
 });
 this.procesando.set(false);
 } else if (resp.data.estado === 'RECHAZADO') {
 this.detenerPolling();
 this.errorMessage.set('El pago fue rechazado por la entidad emisora.');
 this.procesando.set(false);
 }
 },
 });
 });
 }

 /** Formatea número de tarjeta en bloques de 4 dígitos */
 protected onNumeroTarjetaInput(event: Event): void {
 const input = event.target as HTMLInputElement;
 const clean = input.value.replace(/\D/g, '').slice(0, 16);
 const blocks = clean.match(/.{1,4}/g) ?? [];
 input.value = blocks.join(' ');
 this.tarjetaForm.patchValue({ numero_tarjeta: input.value }, { emitEvent: false });
 }

 /** Formatea fecha de expiración MM/AA */
 protected onExpiracionInput(event: Event): void {
 const input = event.target as HTMLInputElement;
 const clean = input.value.replace(/\D/g, '').slice(0, 4);
 if (clean.length >= 3) {
 input.value = `${clean.slice(0, 2)}/${clean.slice(2)}`;
 } else {
 input.value = clean;
 }
 this.tarjetaForm.patchValue({ expiracion: input.value }, { emitEvent: false });
 }

 /** Cambia el modo de entrega (Domicilio vs Retiro en Tienda). */
 protected cambiarTipoEntrega(tipo: 'DOMICILIO' | 'RETIRO'): void {
 this.tipoEntrega.set(tipo);
 if (tipo === 'RETIRO') {
 this.datosForm.patchValue({
 direccion: 'Retiro en Tienda Central Attention — Av. San Martín #450',
 });
 } else {
 const guardada =
 typeof window !== 'undefined'
 ? localStorage.getItem('attention_user_address') || ''
 : '';
 this.datosForm.patchValue({
 direccion: guardada,
 });
 }
 }

 /** Texto descriptivo del estado de pago para el comprobante formal. */
 protected estadoPagoLegible(estado: string | undefined, metodo: MetodoPago): string {
 if (metodo === 'EFECTIVO') {
 return 'PENDIENTE DE PAGO CONTRA ENTREGA (YANGO / TIENDA)';
 }
 if (estado === 'PAGADO') return 'PAGADO Y VALIDADO';
 if (estado === 'RECHAZADO') return 'RECHAZADO';
 return estado || 'PENDIENTE';
 }

 /** Confirma y procesa el pago a través de la pasarela */
 protected confirmarYpagar(): void {
 if (this.procesando()) return;

 const metodo = this.metodoSeleccionado();

 // Si es tarjeta (Stripe), autocompletar de inmediato cualquier campo faltante para evitar fricciones
 if (metodo === 'TARJETA') {
 const u = this.auth.getCurrentUser();
 if (this.datosForm.get('nombre_cliente')?.invalid || !this.datosForm.value.nombre_cliente?.trim()) {
 this.datosForm.patchValue({
 nombre_cliente: u?.nombre || 'Cliente Attention',
 });
 }
 if (this.datosForm.get('correo')?.invalid || !this.datosForm.value.correo?.trim()) {
 this.datosForm.patchValue({
 correo: u?.correo || 'cliente@attention.com',
 });
 }
 if (this.datosForm.get('telefono')?.invalid || !this.datosForm.value.telefono?.trim()) {
 this.datosForm.patchValue({ telefono: '77123456' });
 }
 if (this.datosForm.get('direccion')?.invalid || !this.datosForm.value.direccion?.trim()) {
 const ciudad = this.datosForm.value.ciudad || 'Santa Cruz';
 this.datosForm.patchValue({
 direccion: `Dirección registrada en perfil (${ciudad})`,
 });
 }
 if (!this.datosForm.value.ciudad) {
 this.datosForm.patchValue({ ciudad: 'Santa Cruz' });
 }
 }

 // Si es retiro en tienda y la dirección quedó vacía, asignar dirección institucional
 if (this.tipoEntrega() === 'RETIRO' && !this.datosForm.value.direccion?.trim()) {
 this.datosForm.patchValue({
 direccion: 'Retiro en Tienda Central Attention — Av. San Martín #450',
 });
 }

 if (this.datosForm.invalid) {
 if (this.datosForm.get('telefono')?.invalid) {
 this.errorMessage.set('Ingrese un teléfono de contacto válido (7 u 8 dígitos).');
 } else if (this.datosForm.get('direccion')?.invalid && this.tipoEntrega() === 'DOMICILIO') {
 this.errorMessage.set('Ingrese una dirección válida para la entrega a domicilio.');
 } else {
 this.errorMessage.set('Complete los datos requeridos de facturación y entrega.');
 }
 return;
 }
 if (this.carrito.vacio()) {
 this.errorMessage.set('Su carrito está vacío.');
 return;
 }

 // Si es QR y ya se generó la transacción, confirmar validación de abono
 if (metodo === 'QR' && this.transaccionIniciada()) {
 this.confirmarAbonoManual();
 return;
 }

 const datos: DatosEntrega = {
 nombre_cliente: this.datosForm.value.nombre_cliente!.trim(),
 correo: this.datosForm.value.correo!.trim(),
 telefono: this.datosForm.value.telefono!.trim(),
 direccion: this.datosForm.value.direccion!.trim(),
 ciudad: this.datosForm.value.ciudad!,
 referencia: this.datosForm.value.referencia?.trim() || undefined,
 };

 // Guardar en localStorage para futuras compras sin fricciones
 if (typeof window !== 'undefined') {
 try {
 localStorage.setItem('attention_user_phone', datos.telefono);
 if (this.tipoEntrega() === 'DOMICILIO' && datos.direccion) {
 localStorage.setItem('attention_user_address', datos.direccion);
 }
 if (datos.ciudad) {
 localStorage.setItem('attention_user_city', datos.ciudad);
 }
 } catch {
 // ignore storage error
 }
 }

 const itemsPayload = this.carrito.items().map((i) => ({
 producto_id: i.producto_id,
 cantidad: i.cantidad,
 talla: i.talla,
 color: i.color,
 }));

 this.procesando.set(true);
 this.errorMessage.set('');

 if (metodo === 'TARJETA') {
 const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
 const successUrl = `${origin}/tienda/checkout?stripe_session_id={CHECKOUT_SESSION_ID}`;
 const cancelUrl = `${origin}/tienda/checkout?cancel=true`;

 const sucursalId = this.carrito.items().find((i) => i.id_sucursal)?.id_sucursal ?? null;

 this.pasarela
 .crearSesionStripe({
 items: itemsPayload,
 datos_entrega: datos,
 tipo_entrega: this.tipoEntrega(),
 id_sucursal: sucursalId,
 success_url: successUrl,
 cancel_url: cancelUrl,
 })
 .subscribe({
 next: (resp) => {
 if (resp?.data?.url) {
 window.location.href = resp.data.url;
 } else {
 this.errorMessage.set('No se obtuvo la URL de pago de Stripe Checkout.');
 this.procesando.set(false);
 }
 },
 error: (err) => {
 this.errorMessage.set(
 err?.error?.detail ??
 err?.error?.message ??
 'Error al inicializar la pasarela oficial de Stripe Checkout.'
 );
 this.procesando.set(false);
 },
 });
 return;
 }

 const sucursalId = this.carrito.items().find((i) => i.id_sucursal)?.id_sucursal ?? null;

 this.pasarela
 .iniciarPago({
 items: itemsPayload,
 metodo_pago: metodo,
 datos_entrega: datos,
 tipo_entrega: this.tipoEntrega(),
 id_sucursal: sucursalId,
 tipo_venta: 'ONLINE',
 })
 .subscribe({
 next: (resp) => {
 const transaccion = resp.data.transaccion;
 const ventaObj: Venta = {
 id: resp.data.id_venta,
 codigo: resp.data.codigo_venta,
 items: this.carrito.items(),
 total: resp.data.total,
 metodo_pago: resp.data.metodo_pago,
 estado_pago: resp.data.estado_pago,
 fecha: new Date().toISOString(),
 datos_entrega: datos,
 tipo_entrega: this.tipoEntrega(),
 };

 if (metodo === 'EFECTIVO') {
 this.carrito.confirmarVenta();
 this.pedidoEfectivo.set(ventaObj);
 this.ventaConfirmada.set({
 ...ventaObj,
 estado_pago: 'PENDIENTE',
 });
 this.procesando.set(false);
 return;
 }

 if (metodo === 'QR' && transaccion) {
 if (!transaccion.codigo_venta && resp.data.codigo_venta) {
 transaccion.codigo_venta = resp.data.codigo_venta;
 }
 this.transaccionIniciada.set(transaccion);
 this.iniciarPollingQR(transaccion.codigo_transaccion, ventaObj);
 this.procesando.set(false);
 return;
 }
 },
 error: (err) => {
 this.errorMessage.set(err?.error?.detail ?? 'El pago no pudo procesarse.');
 this.procesando.set(false);
 },
 });
 }

 /** Confirma la validación del abono del QR institucional en tiempo real */
 protected confirmarAbonoManual(): void {
 const txn = this.transaccionIniciada();
 if (!txn) return;

 this.procesando.set(true);
 this.errorMessage.set('');

 this.pasarela.confirmarAbonoQR(txn.codigo_transaccion, 'Abono verificado por cliente').subscribe({
 next: (resp) => {
 this.detenerPolling();
 this.carrito.confirmarVenta();
 this.ventaConfirmada.set({
 id: resp.data.id_venta,
 codigo: resp.data.codigo_venta,
 items: this.carrito.items(),
 total: resp.data.total,
 metodo_pago: 'QR',
 estado_pago: 'PAGADO',
 fecha: resp.data.fecha,
 datos_entrega: {
 nombre_cliente: this.datosForm.value.nombre_cliente!,
 correo: this.datosForm.value.correo!,
 telefono: this.datosForm.value.telefono!,
 direccion: this.datosForm.value.direccion!,
 ciudad: this.datosForm.value.ciudad!,
 },
 comprobante_fiscal: resp.data.comprobante_fiscal,
 });
 this.procesando.set(false);
 },
 error: (err) => {
 this.errorMessage.set(err?.error?.detail ?? 'Error al validar el abono del QR.');
 this.procesando.set(false);
 },
 });
 }

 /** Simula la confirmación bancaria del pago QR (botón demo) */
 protected simularConfirmacionBancaria(): void {
 const txn = this.transaccionIniciada();
 if (!txn) return;

 this.procesando.set(true);
 this.pasarela.simularConfirmacion(txn.codigo_transaccion, true).subscribe({
 next: () => {
 // El polling detectará el cambio de inmediato, o lo forzamos:
 this.detenerPolling();
 this.carrito.confirmarVenta();
 this.ventaConfirmada.set({
 id: txn.id_venta ?? 0,
 codigo: txn.codigo_venta ?? 'ATT-000000',
 items: this.carrito.items(),
 total: txn.monto,
 metodo_pago: 'QR',
 estado_pago: 'PAGADO',
 fecha: new Date().toISOString(),
 datos_entrega: {
 nombre_cliente: this.datosForm.value.nombre_cliente!,
 correo: this.datosForm.value.correo!,
 telefono: this.datosForm.value.telefono!,
 direccion: this.datosForm.value.direccion!,
 ciudad: this.datosForm.value.ciudad!,
 },
 });
 this.procesando.set(false);
 },
 error: (err) => {
 this.errorMessage.set(err?.error?.detail ?? 'Error al simular confirmación bancaria.');
 this.procesando.set(false);
 },
 });
 }

 /** Cierra el ticket y vuelve al catálogo. */
 protected cerrarTicket(): void {
 this.mostrarModalTicket.set(false);
 this.ventaConfirmada.set(null);
 this.transaccionIniciada.set(null);
 this.pedidoEfectivo.set(null);
 }

 /** Fecha legible para el ticket. */
 protected fechaLegible(iso: string): string {
 return new Date(iso).toLocaleString('es-BO', {
 dateStyle: 'medium',
 timeStyle: 'short',
 });
 }

 /** Tiempo formateado para el QR */
 protected tiempoRestanteQR(): string {
 const s = this.segundosRestantes();
 const min = Math.floor(s / 60).toString().padStart(2, '0');
 const sec = (s % 60).toString().padStart(2, '0');
 return `${min}:${sec}`;
 }

 // -------------------------------------------------------------- visuales mock
 /**
 * Celdas del QR (7x7): patrón determinístico con las tres "ojeras".
 */
 protected readonly qrCeldas = computed<boolean[]>(() => {
 const N = 7;
 const celdas: boolean[] = [];
 let semilla = 123456789;
 const rnd = () => {
 semilla = (semilla * 1103515245 + 12345) % 2147483648;
 return semilla / 2147483648;
 };
 for (let i = 0; i < N * N; i++) {
 celdas.push(rnd() > 0.5);
 }
 const ojera = (fila: number, col: number) => {
 const set = (r: number, c: number, v: boolean) => {
 celdas[r * N + c] = v;
 };
 for (let k = 0; k < 3; k++) {
 set(fila, col + k, true);
 set(fila + 2, col + k, true);
 set(fila + k, col, true);
 set(fila + k, col + 2, true);
 }
 set(fila + 1, col + 1, true);
 set(fila + 0, col + 0, true);
 set(fila + 2, col + 2, true);
 };
 ojera(0, 0);
 ojera(0, 4);
 ojera(4, 0);
 return celdas;
 });

 /** Alturas de las barras del código de barras */
 protected readonly barrasTicket = computed<number[]>(() => {
 let semilla = 987654321;
 const rnd = () => {
 semilla = (semilla * 1103515245 + 12345) % 2147483648;
 return semilla / 2147483648;
 };
 return Array.from({ length: 42 }, () => 16 + Math.floor(rnd() * 24));
 });

 /** Imprime solo el ticket (window.print). */
 protected imprimirTicket(): void {
 window.print();
 }
}
