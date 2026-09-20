import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { mensajeErrorEnvio } from '../envios/envios.service';
import { AgenciasService } from './agencias.service';
import {
  costo,
  esDecimalValido,
  estadoTarifa,
  formatoRango,
  formatoVigencia,
  hoyUtc,
  normalizarDecimal,
} from './agencias.util';
import {
  CRITERIO_LABEL,
  CriterioTarifa,
  Tarifa,
  TarifaCreatePayload,
  TarifaUpdatePayload,
  ZonaCobertura,
  ZonaPayload,
} from '../../core/models/agencia.model';
import { Ciudad } from '../../core/models/sucursal.model';

/** Contexto de un modal de tarifa: la zona y, al editar, la tarifa. */
interface ModalTarifa {
  zona: ZonaCobertura;
  tarifa: Tarifa | null;
}

/**
 * CU19 — Zonas de cobertura y tarifas de una agencia.
 *
 * Zona = ciudad del catálogo + subzona opcional (vacía = toda la ciudad). Cada
 * zona tiene tarifas por PESO o por VOLUMEN (un solo criterio por tarifa) con
 * rango [mínimo, máximo) —el máximo no se incluye; "sin tope" = tramo
 * abierto— y vigencia [desde, hasta] (sin fin opcional). El backend valida que
 * no se solapen tarifas activas de la misma zona y criterio (409).
 *
 * ASU/GS administran; D solo consulta. Con la agencia deshabilitada no se
 * pueden crear ni editar zonas/tarifas (sí consultar y eliminar).
 */
@Component({
  selector: 'app-agencia-zonas',
  imports: [FormsModule, BadgeComponent, ConfirmDialogComponent],
  templateUrl: './agencia-zonas.component.html',
})
export class AgenciaZonasComponent implements OnInit {
  private readonly service = inject(AgenciasService);

  readonly idAgencia = input.required<number>();
  /** ASU/GS. */
  readonly puedeGestionar = input(false);
  /** Agencia habilitada (deshabilitada: solo consulta y eliminación). */
  readonly habilitada = input(true);

  zonas = signal<ZonaCobertura[]>([]);
  ciudades = signal<Ciudad[]>([]);
  cargando = signal(true);
  errorMessage = signal('');
  exitoMessage = signal('');

  /** Zona con las tarifas desplegadas. */
  expandida = signal<number | null>(null);
  tarifas = signal<Record<number, Tarifa[]>>({});
  cargandoTarifas = signal(false);

  // ---------------------------------------------------------------- modal zona
  zonaModal = signal<{ zona: ZonaCobertura | null } | null>(null);
  zCiudad = signal<number | null>(null);
  zSubzona = signal('');
  zError = signal('');
  zGuardando = signal(false);

  // -------------------------------------------------------------- modal tarifa
  tarifaModal = signal<ModalTarifa | null>(null);
  tCriterio = signal<CriterioTarifa>('PESO');
  tMin = signal('');
  tMax = signal('');
  tSinTope = signal(false);
  tCosto = signal('');
  tDesde = signal('');
  tHasta = signal('');
  tSinFin = signal(true);
  tActiva = signal(true);
  tError = signal('');
  tGuardando = signal(false);

  confirmarZona = signal<ZonaCobertura | null>(null);
  confirmarTarifa = signal<{ zona: ZonaCobertura; tarifa: Tarifa } | null>(null);

  protected readonly criterioLabel = CRITERIO_LABEL;
  protected readonly criterios: CriterioTarifa[] = ['PESO', 'VOLUMEN'];
  protected readonly costo = costo;
  protected readonly formatoRango = formatoRango;
  protected readonly formatoVigencia = formatoVigencia;
  protected readonly estado = estadoTarifa;

  /** ¿Se pueden crear/editar zonas y tarifas? (admin y agencia habilitada). */
  protected get puedeEditar(): boolean {
    return this.puedeGestionar() && this.habilitada();
  }

  ngOnInit(): void {
    this.cargarZonas();
    if (this.puedeGestionar()) {
      this.service.ciudades().subscribe({
        next: (c) => this.ciudades.set(c),
        error: (err) => this.errorMessage.set(mensajeErrorEnvio(err, 'No se pudo cargar el catálogo de ciudades.')),
      });
    }
  }

  cargarZonas(): void {
    this.cargando.set(true);
    this.service.zonas(this.idAgencia()).subscribe({
      next: (z) => {
        this.zonas.set(z);
        this.cargando.set(false);
      },
      error: (err) => {
        this.errorMessage.set(mensajeErrorEnvio(err, 'No se pudieron cargar las zonas.'));
        this.cargando.set(false);
      },
    });
  }

  // ---------------------------------------------------------------- tarifas
  alternarZona(zona: ZonaCobertura): void {
    if (this.expandida() === zona.id_zona) {
      this.expandida.set(null);
      return;
    }
    this.expandida.set(zona.id_zona);
    this.cargarTarifas(zona.id_zona);
  }

  private cargarTarifas(idZona: number): void {
    this.cargandoTarifas.set(true);
    this.service.tarifas(this.idAgencia(), idZona).subscribe({
      next: (t) => {
        this.tarifas.update((m) => ({ ...m, [idZona]: t }));
        this.cargandoTarifas.set(false);
      },
      error: (err) => {
        this.errorMessage.set(mensajeErrorEnvio(err, 'No se pudieron cargar las tarifas.'));
        this.cargandoTarifas.set(false);
      },
    });
  }

  tarifasDe(zona: ZonaCobertura): Tarifa[] {
    return this.tarifas()[zona.id_zona] ?? [];
  }

  // -------------------------------------------------------------------- zona
  abrirZona(zona: ZonaCobertura | null): void {
    this.zCiudad.set(zona ? zona.id_ciudad : null);
    this.zSubzona.set(zona?.nombre_zona ?? '');
    this.zError.set('');
    this.zonaModal.set({ zona });
  }

  cerrarZona(): void {
    if (!this.zGuardando()) this.zonaModal.set(null);
  }

  guardarZona(): void {
    const ctx = this.zonaModal();
    if (!ctx || this.zGuardando()) return;
    const ciudad = this.zCiudad();
    const sub = this.zSubzona().trim();
    if (ciudad === null) return this.zError.set('Seleccione la ciudad.');

    this.zGuardando.set(true);
    this.zError.set('');
    let payload: ZonaPayload;
    if (ctx.zona) {
      const original = ctx.zona;
      payload = {};
      if (ciudad !== original.id_ciudad) payload.id_ciudad = ciudad;
      if (sub && sub !== (original.nombre_zona ?? '')) payload.nombre_zona = sub;
      if (!sub && original.nombre_zona) {
        this.zGuardando.set(false);
        return this.zError.set(
          'Una subzona no se puede vaciar. Para cubrir toda la ciudad elimine la zona y cree una nueva sin subzona.',
        );
      }
      if (Object.keys(payload).length === 0) {
        this.zGuardando.set(false);
        return this.zError.set('No hay cambios para guardar.');
      }
    } else {
      payload = { id_ciudad: ciudad, ...(sub ? { nombre_zona: sub } : {}) };
    }

    const llamada = ctx.zona
      ? this.service.actualizarZona(this.idAgencia(), ctx.zona.id_zona, payload)
      : this.service.crearZona(this.idAgencia(), payload);
    llamada.subscribe({
      next: () => {
        this.zGuardando.set(false);
        this.zonaModal.set(null);
        this.avisar(ctx.zona ? 'Zona actualizada.' : 'Zona de cobertura registrada.');
        this.cargarZonas();
      },
      error: (err) => {
        this.zGuardando.set(false);
        this.zError.set(mensajeErrorEnvio(err, 'No se pudo guardar la zona.'));
      },
    });
  }

  confirmarEliminacionZona(): void {
    const zona = this.confirmarZona();
    this.confirmarZona.set(null);
    if (!zona) return;
    this.errorMessage.set('');
    this.service.eliminarZona(this.idAgencia(), zona.id_zona).subscribe({
      next: (m) => {
        if (this.expandida() === zona.id_zona) this.expandida.set(null);
        this.avisar(m || 'Zona eliminada.');
        this.cargarZonas();
      },
      error: (err) => this.errorMessage.set(mensajeErrorEnvio(err)),
    });
  }

  /** Descripción legible de una zona: "La Paz · Sopocachi" / "La Paz (toda la ciudad)". */
  protected nombreZona(z: ZonaCobertura): string {
    return z.nombre_zona ? `${z.ciudad} · ${z.nombre_zona}` : `${z.ciudad} (toda la ciudad)`;
  }

  // ------------------------------------------------------------------ tarifa
  abrirTarifa(zona: ZonaCobertura, tarifa: Tarifa | null): void {
    this.tCriterio.set(tarifa?.criterio ?? 'PESO');
    this.tMin.set(tarifa ? String(tarifa.rango_min) : '0');
    this.tMax.set(tarifa?.rango_max != null ? String(tarifa.rango_max) : '');
    this.tSinTope.set(tarifa ? tarifa.rango_max === null : false);
    this.tCosto.set(tarifa ? String(tarifa.costo) : '');
    this.tDesde.set(tarifa?.vigente_desde ?? hoyUtc());
    this.tHasta.set(tarifa?.vigente_hasta ?? '');
    this.tSinFin.set(tarifa ? tarifa.vigente_hasta === null : true);
    this.tActiva.set(tarifa?.is_active ?? true);
    this.tError.set('');
    this.tarifaModal.set({ zona, tarifa });
  }

  cerrarTarifa(): void {
    if (!this.tGuardando()) this.tarifaModal.set(null);
  }

  /** Validación del cliente (el backend revalida y además controla el solapamiento). */
  private validarTarifa(): string {
    if (!esDecimalValido(this.tMin(), 3, 7)) {
      return 'El rango mínimo debe ser un número mayor o igual a 0 (hasta 3 decimales).';
    }
    if (!this.tSinTope()) {
      if (!esDecimalValido(this.tMax(), 3, 7)) {
        return 'El rango máximo debe ser un número (hasta 3 decimales) o marque "Sin tope".';
      }
      if (Number(normalizarDecimal(this.tMax())) <= Number(normalizarDecimal(this.tMin()))) {
        return 'El rango máximo debe ser mayor que el mínimo (el máximo no se incluye en el rango).';
      }
    }
    if (!esDecimalValido(this.tCosto(), 2, 8)) {
      return 'El costo debe ser un número mayor o igual a 0 (hasta 2 decimales).';
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(this.tDesde())) return 'Indique desde qué fecha rige la tarifa.';
    if (!this.tSinFin()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(this.tHasta())) return 'Indique la fecha final o marque "Sin fin".';
      if (this.tHasta() < this.tDesde()) return 'La vigencia final no puede ser anterior a la inicial.';
    }
    return '';
  }

  private payloadCrear(): TarifaCreatePayload {
    return {
      criterio: this.tCriterio(),
      rango_min: normalizarDecimal(this.tMin()),
      rango_max: this.tSinTope() ? null : normalizarDecimal(this.tMax()),
      costo: normalizarDecimal(this.tCosto()),
      vigente_desde: this.tDesde(),
      vigente_hasta: this.tSinFin() ? null : this.tHasta(),
      is_active: this.tActiva(),
    };
  }

  /** Solo lo que cambió; `null` explícito en rango_max/vigente_hasta = abierto/sin fin. */
  private payloadEditar(o: Tarifa): TarifaUpdatePayload {
    const n = this.payloadCrear();
    const p: TarifaUpdatePayload = {};
    if (n.criterio !== o.criterio) p.criterio = n.criterio;
    if (Number(n.rango_min) !== Number(o.rango_min)) p.rango_min = n.rango_min;
    const maxNuevo = n.rango_max === null ? null : Number(n.rango_max);
    if (maxNuevo !== (o.rango_max === null ? null : Number(o.rango_max))) p.rango_max = n.rango_max;
    if (Number(n.costo) !== Number(o.costo)) p.costo = n.costo;
    if (n.vigente_desde !== o.vigente_desde) p.vigente_desde = n.vigente_desde;
    if (n.vigente_hasta !== o.vigente_hasta) p.vigente_hasta = n.vigente_hasta;
    if (n.is_active !== o.is_active) p.is_active = n.is_active;
    return p;
  }

  guardarTarifa(): void {
    const ctx = this.tarifaModal();
    if (!ctx || this.tGuardando()) return;
    const error = this.validarTarifa();
    if (error) return this.tError.set(error);

    let llamada;
    if (ctx.tarifa) {
      const payload = this.payloadEditar(ctx.tarifa);
      if (Object.keys(payload).length === 0) return this.tError.set('No hay cambios para guardar.');
      llamada = this.service.actualizarTarifa(this.idAgencia(), ctx.zona.id_zona, ctx.tarifa.id_tarifa, payload);
    } else {
      llamada = this.service.crearTarifa(this.idAgencia(), ctx.zona.id_zona, this.payloadCrear());
    }
    this.tGuardando.set(true);
    this.tError.set('');
    llamada.subscribe({
      next: () => {
        this.tGuardando.set(false);
        this.tarifaModal.set(null);
        this.avisar(ctx.tarifa ? 'Tarifa actualizada.' : 'Tarifa registrada.');
        this.cargarTarifas(ctx.zona.id_zona);
        this.cargarZonas();
      },
      error: (err) => {
        this.tGuardando.set(false);
        this.tError.set(mensajeErrorEnvio(err, 'No se pudo guardar la tarifa.'));
      },
    });
  }

  /** Activa/desactiva una tarifa (una inactiva no se aplica ni bloquea a las demás). */
  alternarActiva(zona: ZonaCobertura, t: Tarifa): void {
    this.errorMessage.set('');
    this.service.actualizarTarifa(this.idAgencia(), zona.id_zona, t.id_tarifa, { is_active: !t.is_active }).subscribe({
      next: () => {
        this.avisar(t.is_active ? 'Tarifa desactivada.' : 'Tarifa activada.');
        this.cargarTarifas(zona.id_zona);
      },
      error: (err) => this.errorMessage.set(mensajeErrorEnvio(err)),
    });
  }

  confirmarEliminacionTarifa(): void {
    const ctx = this.confirmarTarifa();
    this.confirmarTarifa.set(null);
    if (!ctx) return;
    this.errorMessage.set('');
    this.service.eliminarTarifa(this.idAgencia(), ctx.zona.id_zona, ctx.tarifa.id_tarifa).subscribe({
      next: (m) => {
        this.avisar(m || 'Tarifa eliminada.');
        this.cargarTarifas(ctx.zona.id_zona);
        this.cargarZonas();
      },
      error: (err) => this.errorMessage.set(mensajeErrorEnvio(err)),
    });
  }

  private avisar(mensaje: string): void {
    this.errorMessage.set('');
    this.exitoMessage.set(mensaje);
    setTimeout(() => this.exitoMessage.set(''), 4000);
  }
}
