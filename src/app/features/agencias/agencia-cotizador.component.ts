import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { mensajeErrorEnvio } from '../envios/envios.service';
import { AgenciasService } from './agencias.service';
import { normalizarDecimal, esPositivo } from './agencias.util';
import { CotizacionResultadoComponent } from './cotizacion-resultado.component';
import { Cotizacion } from '../../core/models/agencia.model';
import { Ciudad } from '../../core/models/sucursal.model';

/**
 * Simulador de cotización de una agencia (ASU/GS/D).
 *
 * Permite probar "¿cuánto costaría enviar X kg / Y m³ a esta ciudad con esta
 * agencia?" con las tarifas vigentes. Es de SOLO LECTURA: no asigna nada ni
 * guarda la cotización. Una agencia deshabilitada no cotiza (el backend
 * responde 400 —404 para D—).
 */
@Component({
 selector: 'app-agencia-cotizador',
 imports: [FormsModule, CotizacionResultadoComponent],
 template: `
 <section class="bg-white rounded-xl border border-primary/10 shadow-sm p-5 space-y-4">
 <div>
 <h2 class="text-lg font-bold text-primary">Simulador de cotización</h2>
 <p class="text-sm text-gray-600">
 Calcule el costo de agencia para una ciudad, peso y volumen con las tarifas vigentes. No asigna ni guarda nada.
 </p>
 </div>

 @if (!habilitada()) {
 <p class="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
 Agencia deshabilitada: no puede cotizar.
 </p>
 } @else {
 <div class="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
 <label class="block text-xs font-semibold text-slate-600 md:col-span-2">
 Ciudad de destino
 <select
 [ngModel]="ciudad()"
 (ngModelChange)="ciudad.set($event); cotizacion.set(null)"
 class="mt-1 w-full text-sm border border-slate-300 rounded-lg p-2 bg-white"
 aria-label="Ciudad de destino"
 >
 <option value="" disabled>Seleccione una ciudad</option>
 @for (c of ciudades(); track c.id) {
 <option [value]="c.nombre">{{ c.nombre }}</option>
 }
 </select>
 </label>
 <label class="block text-xs font-semibold text-slate-600">
 Peso (kg)
 <input
 type="text"
 inputmode="decimal"
 [ngModel]="peso()"
 (ngModelChange)="peso.set($event); cotizacion.set(null)"
 placeholder="Ej: 2.5"
 aria-label="Peso en kg"
 class="mt-1 w-full text-sm border border-slate-300 rounded-lg p-2 bg-white"
 />
 </label>
 <label class="block text-xs font-semibold text-slate-600">
 Volumen (m³)
 <input
 type="text"
 inputmode="decimal"
 [ngModel]="volumen()"
 (ngModelChange)="volumen.set($event); cotizacion.set(null)"
 placeholder="Ej: 0.05"
 aria-label="Volumen en m3"
 class="mt-1 w-full text-sm border border-slate-300 rounded-lg p-2 bg-white"
 />
 </label>
 </div>
 <div class="flex items-center gap-3">
 <button
 type="button"
 (click)="cotizar()"
 [disabled]="cotizando()"
 class="bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-accent hover:text-primary transition text-sm font-medium disabled:opacity-50"
 >
 {{ cotizando() ? 'Cotizando...' : 'Cotizar' }}
 </button>
 <span class="text-xs text-gray-500">Peso y volumen deben ser mayores que 0 (hasta 3 decimales).</span>
 </div>
 }

 @if (error()) {
 <div class="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm" role="alert">
 {{ error() }}
 </div>
 }
 @if (cotizacion(); as c) {
 <app-cotizacion-resultado [cotizacion]="c" />
 }
 </section>
 `,
})
export class AgenciaCotizadorComponent implements OnInit {
 private readonly service = inject(AgenciasService);

 readonly idAgencia = input.required<number>();
 readonly habilitada = input(true);

 ciudades = signal<Ciudad[]>([]);
 ciudad = signal('');
 peso = signal('');
 volumen = signal('');
 cotizando = signal(false);
 error = signal('');
 cotizacion = signal<Cotizacion | null>(null);

 ngOnInit(): void {
 this.service.ciudades().subscribe({
 next: (c) => this.ciudades.set(c),
 error: (err) => this.error.set(mensajeErrorEnvio(err, 'No se pudo cargar el catálogo de ciudades.')),
 });
 }

 cotizar(): void {
 if (this.cotizando()) return;
 this.cotizacion.set(null);
 if (!this.ciudad()) return this.error.set('Seleccione la ciudad de destino.');
 if (!esPositivo(this.peso())) {
 return this.error.set('Ingrese un peso mayor que 0 (hasta 3 decimales).');
 }
 if (!esPositivo(this.volumen())) {
 return this.error.set('Ingrese un volumen mayor que 0 (hasta 3 decimales).');
 }
 this.error.set('');
 this.cotizando.set(true);
 this.service
 .cotizar(this.idAgencia(), {
 ciudad: this.ciudad(),
 peso_kg: normalizarDecimal(this.peso()),
 volumen_m3: normalizarDecimal(this.volumen()),
 })
 .subscribe({
 next: (c) => {
 this.cotizacion.set(c);
 this.cotizando.set(false);
 },
 error: (err) => {
 this.error.set(mensajeErrorEnvio(err, 'No se pudo cotizar.'));
 this.cotizando.set(false);
 },
 });
 }
}
