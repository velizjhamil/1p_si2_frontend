import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { EnviosService, mensajeErrorEnvio } from './envios.service';
import { SucursalesService } from '../branches/branches.service';
import { AgenciasService } from '../agencias/agencias.service';
import { CotizacionResultadoComponent } from '../agencias/cotizacion-resultado.component';
import { costo, esPositivo, normalizarDecimal, numero } from '../agencias/agencias.util';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { Sucursal } from '../../core/models/sucursal.model';
import { AgenciaDisponible, Cotizacion } from '../../core/models/agencia.model';
import {
  ACCION_ENVIO_LABEL,
  ESTADO_ENVIO_LABEL,
  ESTADO_ENVIO_VARIANT,
  Envio,
  EnvioItem,
  EstadoEnvio,
  HistorialEnvio,
  Repartidor,
} from '../../core/models/envio.model';

/** Resultado de una acción: el envío ya actualizado + mensaje para el banner del padre. */
export interface EnvioActualizado {
  envio: Envio;
  mensaje: string;
}

/** Motivos frecuentes de intento fallido (atajos; el motivo sigue siendo texto libre). */
const MOTIVOS_RAPIDOS = [
  'Dirección no encontrada',
  'Cliente no responde',
  'Cliente ausente',
  'Entrega rechazada por el cliente',
];

/** `YYYY-MM-DDTHH:mm` en hora local (valor de <input type="datetime-local">). */
function ahoraLocalInput(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * CU18 — Detalle del envío (modal) + acciones según el estado.
 *
 * Muestra pedido, datos de entrega, despacho (sucursal, repartidor, fechas,
 * intentos) y el historial cronológico (incluye intentos fallidos y
 * reprogramaciones). Las acciones NO se deciden aquí: se ofrecen solo las
 * de `envio.transiciones_permitidas`, que el backend calcula según el estado
 * Y el rol del usuario (el backend además revalida cada operación).
 *
 * La sucursal del envío es información del registro; no es un filtro de
 * seguridad (el backend no restringe por sucursal, ver CU18).
 *
 * El padre es dueño del envío mostrado: al completar una acción se emite
 * `actualizado` con el envío nuevo y el padre lo vuelve a pasar como input.
 */
@Component({
  selector: 'app-envio-detalle',
  imports: [FormsModule, DatePipe, DecimalPipe, BadgeComponent, CotizacionResultadoComponent],
  templateUrl: './envio-detalle.component.html',
})
export class EnvioDetalleComponent {
  private readonly enviosService = inject(EnviosService);
  private readonly sucursalesService = inject(SucursalesService);
  private readonly agenciasService = inject(AgenciasService);

  readonly envio = input.required<Envio>();
  readonly cerrar = output<void>();
  readonly actualizado = output<EnvioActualizado>();

  // --------------------------------------------------------------- historial
  historial = signal<HistorialEnvio[]>([]);
  cargandoHistorial = signal(false);
  errorHistorial = signal('');

  // ----------------------------------------------------------- panel acción
  /** Estado destino de la acción abierta (null = ninguna). */
  accion = signal<EstadoEnvio | null>(null);
  guardando = signal(false);
  errorAccion = signal('');

  // Campos de los formularios (se reinician al abrir cada acción)
  sucursalSel = signal<number | null>(null);
  repartidorSel = signal('');
  fechaLocal = signal('');
  observacion = signal('');
  motivo = signal('');

  // Catálogos reales (se cargan al abrir la acción que los necesita)
  sucursales = signal<Sucursal[]>([]);
  repartidores = signal<Repartidor[]>([]);
  cargandoCatalogo = signal(false);

  // --------------------------------------------- asignación a AGENCIA (CU19)
  /** Repartidor propio (CU18) o agencia de reparto (CU19): mutuamente excluyentes. */
  modoAsignacion = signal<'repartidor' | 'agencia'>('repartidor');
  /** Agencias habilitadas que cubren la ciudad del envío (se cargan al elegir "Agencia"). */
  agencias = signal<AgenciaDisponible[]>([]);
  agenciasCargadas = signal(false);
  errorAgencias = signal('');
  agenciaSel = signal<number | null>(null);
  pesoKg = signal('');
  volumenM3 = signal('');
  cotizacion = signal<Cotizacion | null>(null);
  cotizando = signal(false);
  errorCotizacion = signal('');

  protected readonly costo = costo;
  protected readonly numero = numero;

  protected readonly estadoLabel = ESTADO_ENVIO_LABEL;
  protected readonly estadoVariant = ESTADO_ENVIO_VARIANT;
  protected readonly motivosRapidos = MOTIVOS_RAPIDOS;

  constructor() {
    // Recarga el historial cuando cambia el envío (apertura o tras una acción).
    effect(() => {
      const e = this.envio();
      untracked(() => this.cargarHistorial(e.id_envio));
    });
  }

  // ------------------------------------------------------------------ helpers
  /** Destinos con acción disponible para el usuario (viene del backend). */
  protected acciones(): EstadoEnvio[] {
    return this.envio().transiciones_permitidas;
  }

  /** Texto del botón; retomar tras una reprogramación se muestra explícito. */
  protected etiquetaAccion(destino: EstadoEnvio): string {
    if (destino === 'EN_RUTA' && this.envio().estado === 'REPROGRAMADO') {
      return 'Retomar entrega (en ruta)';
    }
    return ACCION_ENVIO_LABEL[destino] ?? destino;
  }

  protected esPeligro(destino: EstadoEnvio): boolean {
    return destino === 'CANCELADO';
  }

  protected puede(destino: EstadoEnvio): boolean {
    return this.envio().transiciones_permitidas.includes(destino);
  }

  /** Reprogramaciones registradas (del historial; el intento previo se conserva). */
  protected reprogramaciones(): HistorialEnvio[] {
    return this.historial().filter((h) => h.estado_nuevo === 'REPROGRAMADO');
  }

  /** Variante de la prenda ("M · Azul") o '' si no tiene talla ni color. */
  protected variante(it: EnvioItem): string {
    return [it.talla, it.color].filter((v): v is string => !!v).join(' · ');
  }

  protected minFecha(): string {
    return ahoraLocalInput();
  }

  // --------------------------------------------------------------- historial
  private cargarHistorial(id: number): void {
    this.cargandoHistorial.set(true);
    this.errorHistorial.set('');
    this.enviosService.historial(id).subscribe({
      next: (h) => {
        this.historial.set(h);
        this.cargandoHistorial.set(false);
      },
      error: (err) => {
        this.errorHistorial.set(mensajeErrorEnvio(err, 'No se pudo cargar el historial.'));
        this.cargandoHistorial.set(false);
      },
    });
  }

  // ------------------------------------------------------------ abrir acción
  abrirAccion(destino: EstadoEnvio): void {
    if (!this.puede(destino) || this.guardando()) return;
    this.sucursalSel.set(null);
    this.repartidorSel.set('');
    this.fechaLocal.set('');
    this.observacion.set('');
    this.motivo.set('');
    this.errorAccion.set('');
    this.reiniciarAgencia();
    this.accion.set(destino);

    if (destino === 'LISTO_ENVIO') this.cargarSucursales();
    if (destino === 'ASIGNADO') this.cargarRepartidores();
  }

  cancelarAccion(): void {
    if (this.guardando()) return;
    this.accion.set(null);
    this.errorAccion.set('');
  }

  private cargarSucursales(): void {
    this.cargandoCatalogo.set(true);
    this.sucursalesService.getSucursales().subscribe({
      next: (r) => {
        this.sucursales.set(r.data.filter((s) => s.is_active));
        this.cargandoCatalogo.set(false);
      },
      error: (err) => {
        this.errorAccion.set(mensajeErrorEnvio(err, 'No se pudieron cargar las sucursales.'));
        this.cargandoCatalogo.set(false);
      },
    });
  }

  // ----------------------------------------------- asignación a agencia (CU19)
  private reiniciarAgencia(): void {
    this.modoAsignacion.set('repartidor');
    this.agencias.set([]);
    this.agenciasCargadas.set(false);
    this.errorAgencias.set('');
    this.agenciaSel.set(null);
    this.pesoKg.set('');
    this.volumenM3.set('');
    this.cotizacion.set(null);
    this.errorCotizacion.set('');
  }

  /** Ciudad de entrega del envío (snapshot de la venta): con ella se buscan las agencias. */
  protected ciudadEnvio(): string {
    return this.envio().datos_entrega.ciudad;
  }

  cambiarModoAsignacion(modo: 'repartidor' | 'agencia'): void {
    if (this.guardando()) return;
    this.modoAsignacion.set(modo);
    this.errorAccion.set('');
    if (modo === 'agencia' && !this.agenciasCargadas()) this.cargarAgencias();
  }

  /** GET /agencias-reparto/disponibles?ciudad=: solo habilitadas con cobertura en la ciudad. */
  private cargarAgencias(): void {
    this.cargandoCatalogo.set(true);
    this.errorAgencias.set('');
    this.agenciasService.disponibles(this.ciudadEnvio()).subscribe({
      next: (r) => {
        this.agencias.set(r.agencias);
        this.agenciasCargadas.set(true);
        this.cargandoCatalogo.set(false);
      },
      error: (err) => {
        // 404: la ciudad del pedido no está en el catálogo; 409: nombre ambiguo
        this.errorAgencias.set(
          mensajeErrorEnvio(err, 'No se pudieron cargar las agencias disponibles para la ciudad del envío.'),
        );
        this.cargandoCatalogo.set(false);
      },
    });
  }

  /** Cualquier cambio en agencia/peso/volumen invalida la cotización mostrada. */
  protected alCambiarDatosAgencia(): void {
    this.cotizacion.set(null);
    this.errorCotizacion.set('');
  }

  protected agenciaElegida(): AgenciaDisponible | undefined {
    return this.agencias().find((a) => a.id_agencia === this.agenciaSel());
  }

  /** Error de forma de agencia/peso/volumen ('' si está bien). */
  private errorDatosAgencia(): string {
    if (this.agenciaSel() === null) return 'Seleccione la agencia de reparto.';
    if (!esPositivo(this.pesoKg())) return 'Ingrese un peso mayor que 0 (hasta 3 decimales).';
    if (!esPositivo(this.volumenM3())) return 'Ingrese un volumen mayor que 0 (hasta 3 decimales).';
    return '';
  }

  /** Vista previa del costo (solo lectura): no asigna nada hasta confirmar. */
  cotizar(): void {
    if (this.cotizando() || this.guardando()) return;
    this.cotizacion.set(null);
    const error = this.errorDatosAgencia();
    if (error) {
      this.errorCotizacion.set(error);
      return;
    }
    this.errorCotizacion.set('');
    this.cotizando.set(true);
    this.agenciasService
      .cotizar(this.agenciaSel() as number, {
        ciudad: this.ciudadEnvio(),
        peso_kg: normalizarDecimal(this.pesoKg()),
        volumen_m3: normalizarDecimal(this.volumenM3()),
      })
      .subscribe({
        next: (c) => {
          this.cotizacion.set(c);
          this.cotizando.set(false);
        },
        error: (err) => {
          this.errorCotizacion.set(mensajeErrorEnvio(err, 'No se pudo cotizar.'));
          this.cotizando.set(false);
        },
      });
  }

  private cargarRepartidores(): void {
    this.cargandoCatalogo.set(true);
    this.enviosService.repartidores().subscribe({
      next: (r) => {
        this.repartidores.set(r);
        this.cargandoCatalogo.set(false);
      },
      error: (err) => {
        this.errorAccion.set(mensajeErrorEnvio(err, 'No se pudieron cargar los repartidores.'));
        this.cargandoCatalogo.set(false);
      },
    });
  }

  // ------------------------------------------------------------ ejecutar
  /** ISO 8601 con offset a partir de un datetime-local (hora local del navegador). */
  private aIso(local: string): string {
    return new Date(local).toISOString();
  }

  private esFutura(local: string): boolean {
    const t = new Date(local).getTime();
    return Number.isFinite(t) && t > Date.now();
  }

  private opcional(texto: string): string | undefined {
    const t = texto.trim();
    return t ? t : undefined;
  }

  /** Valida en el cliente (el backend revalida) y devuelve el error o ''. */
  private validar(destino: EstadoEnvio): string {
    switch (destino) {
      case 'LISTO_ENVIO':
        return this.sucursalSel() ? '' : 'Seleccione la sucursal que despacha el paquete.';
      case 'ASIGNADO':
        if (this.modoAsignacion() === 'agencia') {
          const e = this.errorDatosAgencia();
          if (e) return e;
        } else if (!this.repartidorSel()) {
          return 'Seleccione un repartidor.';
        }
        if (this.fechaLocal() && !this.esFutura(this.fechaLocal())) {
          return 'La fecha estimada debe ser futura.';
        }
        return '';
      case 'INTENTO_FALLIDO':
        return this.motivo().trim().length >= 5
          ? ''
          : 'Indique el motivo del intento fallido (mínimo 5 caracteres).';
      case 'REPROGRAMADO':
        if (!this.fechaLocal()) return 'Indique la nueva fecha y hora de entrega.';
        return this.esFutura(this.fechaLocal()) ? '' : 'La nueva fecha debe ser futura.';
      case 'CANCELADO':
        return this.observacion().trim().length >= 1 ? '' : 'Indique el motivo de la cancelación.';
      default:
        return '';
    }
  }

  confirmarAccion(): void {
    const destino = this.accion();
    if (!destino || this.guardando()) return;

    const error = this.validar(destino);
    if (error) {
      this.errorAccion.set(error);
      return;
    }

    const id = this.envio().id_envio;
    const obs = this.opcional(this.observacion());
    this.guardando.set(true);
    this.errorAccion.set('');

    let llamada: Observable<Envio>;
    let mensaje: string;
    switch (destino) {
      case 'LISTO_ENVIO':
        llamada = this.enviosService.confirmarPreparacion(id, {
          codigo_sucursal: this.sucursalSel() as number,
          observacion: obs,
        });
        mensaje = 'Preparación confirmada. El envío está listo para asignar.';
        break;
      case 'ASIGNADO':
        if (this.modoAsignacion() === 'agencia') {
          // El backend cotiza con las tarifas vigentes y guarda tarifa, costo y medidas.
          llamada = this.enviosService.asignar(id, {
            id_agencia: this.agenciaSel() as number,
            peso_kg: normalizarDecimal(this.pesoKg()),
            volumen_m3: normalizarDecimal(this.volumenM3()),
            fecha_estimada_entrega: this.fechaLocal() ? this.aIso(this.fechaLocal()) : undefined,
            observacion: obs,
          });
          mensaje = `Agencia "${this.agenciaElegida()?.razon_social ?? ''}" asignada.`;
        } else {
          llamada = this.enviosService.asignar(id, {
            id_repartidor: this.repartidorSel(),
            fecha_estimada_entrega: this.fechaLocal() ? this.aIso(this.fechaLocal()) : undefined,
            observacion: obs,
          });
          mensaje = 'Repartidor asignado.';
        }
        break;
      case 'EN_RUTA':
        llamada = this.enviosService.actualizarEstado(id, { estado: 'EN_RUTA', observacion: obs });
        mensaje = 'Envío en ruta. Se notificó al cliente.';
        break;
      case 'ENTREGADO':
        llamada = this.enviosService.actualizarEstado(id, { estado: 'ENTREGADO', observacion: obs });
        mensaje = 'Envío entregado. Se notificó al cliente y el flujo de despacho finalizó.';
        break;
      case 'INTENTO_FALLIDO':
        llamada = this.enviosService.registrarIntentoFallido(id, {
          motivo: this.motivo().trim(),
          observacion: obs,
        });
        mensaje = 'Intento fallido registrado. Ya puede reprogramar la entrega.';
        break;
      case 'REPROGRAMADO':
        llamada = this.enviosService.reprogramar(id, {
          nueva_fecha_entrega: this.aIso(this.fechaLocal()),
          observacion: obs,
        });
        mensaje = 'Entrega reprogramada. Ya puede retomarla poniéndola en ruta.';
        break;
      case 'CANCELADO':
        llamada = this.enviosService.actualizarEstado(id, {
          estado: 'CANCELADO',
          observacion: obs,
        });
        mensaje = 'Envío cancelado. La venta y el inventario no se modificaron.';
        break;
      default:
        this.guardando.set(false);
        return;
    }

    llamada.subscribe({
      next: (envio) => {
        this.guardando.set(false);
        this.accion.set(null);
        this.actualizado.emit({ envio, mensaje });
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorAccion.set(mensajeErrorEnvio(err));
      },
    });
  }
}
