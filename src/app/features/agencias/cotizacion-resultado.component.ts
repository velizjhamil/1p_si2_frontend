import { Component, input } from '@angular/core';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { CRITERIO_LABEL, CRITERIO_UNIDAD, Cotizacion } from '../../core/models/agencia.model';
import { costo, formatoRango, formatoVigencia, numero } from './agencias.util';

/**
 * CU19 — Resultado de una cotización de costo de agencia (presentacional).
 *
 * Muestra el costo elegido, la tarifa aplicada (rango [min, max) y vigencia) y
 * TODAS las tarifas que aplicaban, en orden de preferencia, para que la regla
 * de selección sea visible: mayor costo → PESO antes que VOLUMEN → zona de
 * ciudad completa antes que subzona.
 *
 * El costo es INTERNO (lo que se paga a la agencia); no es lo que paga el cliente.
 */
@Component({
  selector: 'app-cotizacion-resultado',
  imports: [BadgeComponent],
  template: `
    @let c = cotizacion();
    <div class="rounded-xl border border-primary/20 bg-white p-4 space-y-3" data-testid="cotizacion-resultado">
      <div class="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p class="text-xs font-semibold text-primary/70 uppercase tracking-wide">Costo de agencia</p>
          <p class="text-3xl font-bold text-primary" data-testid="costo-agencia">{{ costo(c.costo_agencia) }}</p>
        </div>
        <app-badge variant="accent" [texto]="'Criterio: ' + criterioLabel[c.criterio]" />
      </div>

      <dl class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <div>
          <dt class="text-xs text-slate-500">Agencia</dt>
          <dd class="font-medium text-slate-900">{{ c.agencia.razon_social }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Ciudad</dt>
          <dd class="font-medium text-slate-900">{{ c.ciudad.nombre }}</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Peso</dt>
          <dd class="font-medium text-slate-900">{{ numero(c.peso_kg) }} kg</dd>
        </div>
        <div>
          <dt class="text-xs text-slate-500">Volumen</dt>
          <dd class="font-medium text-slate-900">{{ numero(c.volumen_m3) }} m³</dd>
        </div>
      </dl>

      <div class="rounded-lg bg-slate-50 border border-slate-200/80 p-3 text-sm">
        <p class="text-xs font-semibold text-slate-500 uppercase mb-1">Tarifa aplicada</p>
        <p class="text-slate-800">
          {{ c.tarifa.nombre_zona ? 'Zona: ' + c.tarifa.nombre_zona : 'Zona: toda la ciudad' }} ·
          {{ formatoRango(c.tarifa.criterio, c.tarifa.rango_min, c.tarifa.rango_max) }}
        </p>
        <p class="text-xs text-slate-500 mt-0.5">
          Vigencia {{ formatoVigencia(c.tarifa.vigente_desde, c.tarifa.vigente_hasta) }} · evaluada al
          {{ c.fecha_referencia }} (UTC)
        </p>
      </div>

      @if (c.candidatas.length > 1) {
        <div>
          <p class="text-xs font-semibold text-slate-500 uppercase mb-1">
            Tarifas que aplicaban ({{ c.candidatas.length }})
          </p>
          <ul class="divide-y divide-slate-100 text-sm border border-slate-200 rounded-lg overflow-hidden">
            @for (k of c.candidatas; track k.id_tarifa) {
              <li class="flex items-center justify-between gap-2 px-3 py-2" [class]="k.seleccionada ? 'bg-emerald-50/60' : 'bg-white'">
                <span class="text-slate-700">
                  {{ criterioLabel[k.criterio] }} ·
                  {{ k.nombre_zona ? 'zona ' + k.nombre_zona : 'toda la ciudad' }}
                </span>
                <span class="flex items-center gap-2">
                  <span class="font-medium text-slate-900">{{ costo(k.costo) }}</span>
                  @if (k.seleccionada) {
                    <app-badge variant="success" texto="Elegida" />
                  }
                </span>
              </li>
            }
          </ul>
          <p class="text-xs text-slate-500 mt-1">
            Se elige la de mayor costo; si empatan, PESO antes que VOLUMEN y luego la zona de ciudad completa.
          </p>
        </div>
      }

      <p class="text-xs text-slate-500">
        Es el costo interno que se pagaría a la agencia; no es lo que paga el cliente.
      </p>
    </div>
  `,
})
export class CotizacionResultadoComponent {
  readonly cotizacion = input.required<Cotizacion>();

  protected readonly criterioLabel = CRITERIO_LABEL;
  protected readonly unidad = CRITERIO_UNIDAD;
  protected readonly costo = costo;
  protected readonly numero = numero;
  protected readonly formatoRango = formatoRango;
  protected readonly formatoVigencia = formatoVigencia;
}
