import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VentasService } from './ventas.service';
import { AuthService } from '../../core/services/auth.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { EstadoPago, MetodoPago, Venta, formatBs } from '../../core/models/carrito.model';

type MetodoPagoVariant = 'info' | 'success' | 'warning';
type EstadoPagoVariant = 'success' | 'warning' | 'danger';

/** Variante del badge según método de pago. */
function badgeMetodo(m: MetodoPago): MetodoPagoVariant {
 switch (m) {
 case 'QR':
 return 'info';
 case 'TARJETA':
 return 'success';
 case 'EFECTIVO':
 return 'warning';
 }
}

/** Variante del badge según estado de pago. */
function badgeEstado(e: EstadoPago): EstadoPagoVariant {
 switch (e) {
 case 'PAGADO':
 return 'success';
 case 'PENDIENTE':
 return 'warning';
 case 'RECHAZADO':
 return 'danger';
 }
}

/** Etiqueta legible del método de pago. */
function etiquetaMetodo(m: MetodoPago): string {
 return m.charAt(0) + m.slice(1).toLowerCase();
}

/**
 * Detalle dedicado de una venta (deep-link /ventas/:id).
 * Reutiliza el `VentasService.obtener` y renderiza el comprobante con
 * la misma información del modal de `VentasComponent`, pero en página
 * completa para permitir navegación directa o impresión limpia.
 */
@Component({
 selector: 'app-venta-detalle',
 imports: [BadgeComponent, DatePipe, RouterLink],
 templateUrl: './venta-detalle.component.html',
})
export class VentaDetalleComponent implements OnInit {
 private readonly route = inject(ActivatedRoute);
 private readonly router = inject(Router);
 private readonly ventasService = inject(VentasService);
 private readonly authService = inject(AuthService);

 venta = signal<Venta | null>(null);
 cargando = signal(true);
 errorMessage = signal('');

 ngOnInit(): void {
 const idParam = this.route.snapshot.paramMap.get('id');
 const id = idParam ? Number(idParam) : NaN;
 if (!Number.isFinite(id) || id <= 0) {
 this.errorMessage.set('Identificador de venta inválido.');
 this.cargando.set(false);
 return;
 }

 this.ventasService.obtener(id).subscribe({
 next: (v) => {
 this.venta.set(v);
 this.cargando.set(false);
 },
 error: (err) => {
 this.errorMessage.set(
 err?.error?.detail || 'No se pudo cargar la venta solicitada.',
 );
 this.cargando.set(false);
 },
 });
 }

 /** solo quienes gestionan envíos (ASU/GS/D) ven el enlace a /envios. */
 protected puedeVerEnvio(): boolean {
 return ['ASU', 'GS', 'D'].includes(this.authService.getRol().toUpperCase());
 }

 protected volver(): void {
 this.router.navigate(['/ventas']);
 }

 protected imprimir(): void {
 window.print();
 }

 protected badgeDeMetodo(m: MetodoPago) {
 return badgeMetodo(m);
 }
 protected badgeDeEstado(e: EstadoPago) {
 return badgeEstado(e);
 }
 protected etiquetaDeMetodo(m: MetodoPago) {
 return etiquetaMetodo(m);
 }
 protected formatoBs(monto: number) {
 return formatBs(monto);
 }
}
