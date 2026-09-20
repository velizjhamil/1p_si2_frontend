import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { mensajeErrorEnvio } from '../envios/envios.service';
import { AgenciaFormComponent, AgenciaGuardada } from './agencia-form.component';
import { AgenciasService } from './agencias.service';
import { Agencia } from '../../core/models/agencia.model';

type FiltroEstado = 'todas' | 'habilitadas' | 'deshabilitadas';

/**
 * CU19 — Agencias de reparto (listado).
 *
 * Catálogo global de empresas de transporte externas autorizadas por la marca.
 * - ASU/GS: ven todas (con NIT), registran, editan, habilitan/deshabilitan y
 *   eliminan (409 si tiene envíos asociados: se sugiere deshabilitar).
 * - D (Encargado de Delivery): solo CONSULTA las habilitadas, sin datos de
 *   facturación. El backend lo garantiza; aquí además se ocultan las acciones.
 *
 * Deshabilitar una agencia no toca sus envíos históricos: solo deja de
 * ofrecerse para nuevas asignaciones.
 */
@Component({
  selector: 'app-agencias',
  imports: [RouterLink, BadgeComponent, ConfirmDialogComponent, AgenciaFormComponent],
  templateUrl: './agencias.component.html',
})
export class AgenciasComponent implements OnInit {
  private readonly service = inject(AgenciasService);
  private readonly auth = inject(AuthService);

  /** ASU/GS administran; D solo consulta. */
  readonly puedeGestionar = ['ASU', 'GS'].includes((this.auth.getRol() || '').toUpperCase());

  agencias = signal<Agencia[]>([]);
  cargando = signal(true);
  errorMessage = signal('');
  exitoMessage = signal('');

  pagina = signal(1);
  total = signal(0);
  pages = signal(1);
  readonly limit = 10;

  busqueda = signal('');
  filtroEstado = signal<FiltroEstado>('todas');
  readonly filtros: { valor: FiltroEstado; texto: string }[] = [
    { valor: 'todas', texto: 'Todas' },
    { valor: 'habilitadas', texto: 'Habilitadas' },
    { valor: 'deshabilitadas', texto: 'Deshabilitadas' },
  ];

  /** Modal de alta/edición: undefined = cerrado, null = crear, Agencia = editar. */
  formulario = signal<Agencia | null | undefined>(undefined);
  confirmarEliminar = signal<Agencia | null>(null);
  confirmarDeshabilitar = signal<Agencia | null>(null);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    const estado = this.filtroEstado();
    this.service
      .listar({
        q: this.busqueda().trim() || undefined,
        // D no filtra por estado: el backend solo le devuelve habilitadas
        is_active: !this.puedeGestionar || estado === 'todas' ? undefined : estado === 'habilitadas',
        page: this.pagina(),
        limit: this.limit,
      })
      .subscribe({
        next: (r) => {
          this.agencias.set(r.data);
          this.total.set(r.total);
          this.pages.set(Math.max(1, r.pages));
          this.cargando.set(false);
        },
        error: (err) => {
          this.errorMessage.set(mensajeErrorEnvio(err, 'No se pudo cargar la lista de agencias.'));
          this.cargando.set(false);
        },
      });
  }

  // ------------------------------------------------------------------ filtros
  onBusqueda(event: Event): void {
    this.busqueda.set((event.target as HTMLInputElement).value);
    this.pagina.set(1);
    this.cargar();
  }

  onFiltroEstado(estado: FiltroEstado): void {
    this.filtroEstado.set(estado);
    this.pagina.set(1);
    this.cargar();
  }

  paginaAnterior(): void {
    if (this.pagina() > 1) {
      this.pagina.update((p) => p - 1);
      this.cargar();
    }
  }

  paginaSiguiente(): void {
    if (this.pagina() < this.pages()) {
      this.pagina.update((p) => p + 1);
      this.cargar();
    }
  }

  // ------------------------------------------------------------- formulario
  abrirCrear(): void {
    this.formulario.set(null);
  }

  abrirEditar(agencia: Agencia): void {
    this.formulario.set(agencia);
  }

  cerrarFormulario(): void {
    this.formulario.set(undefined);
  }

  alGuardar(resultado: AgenciaGuardada): void {
    this.formulario.set(undefined);
    this.avisar(resultado.mensaje);
    this.cargar();
  }

  // ---------------------------------------------------------------- acciones
  /** Habilitar es directo; deshabilitar pide confirmación (deja de ofrecerse). */
  alternarEstado(agencia: Agencia): void {
    if (agencia.is_active) {
      this.confirmarDeshabilitar.set(agencia);
      return;
    }
    this.cambiarEstado(agencia, true);
  }

  confirmarDeshabilitacion(): void {
    const agencia = this.confirmarDeshabilitar();
    this.confirmarDeshabilitar.set(null);
    if (agencia) this.cambiarEstado(agencia, false);
  }

  private cambiarEstado(agencia: Agencia, habilitar: boolean): void {
    this.errorMessage.set('');
    this.service.cambiarEstado(agencia.id_agencia, habilitar).subscribe({
      next: () => {
        this.avisar(
          habilitar
            ? `Agencia "${agencia.razon_social}" habilitada.`
            : `Agencia "${agencia.razon_social}" deshabilitada. Sus envíos anteriores no se modifican.`,
        );
        this.cargar();
      },
      error: (err) => this.errorMessage.set(mensajeErrorEnvio(err)),
    });
  }

  pedirEliminar(agencia: Agencia): void {
    this.confirmarEliminar.set(agencia);
  }

  /** DELETE físico. El backend responde 409 si la agencia tiene envíos asociados. */
  confirmarEliminacion(): void {
    const agencia = this.confirmarEliminar();
    this.confirmarEliminar.set(null);
    if (!agencia) return;
    this.errorMessage.set('');
    this.service.eliminar(agencia.id_agencia).subscribe({
      next: (mensaje) => {
        this.avisar(mensaje || 'Agencia eliminada correctamente.');
        if (this.agencias().length === 1 && this.pagina() > 1) this.pagina.update((p) => p - 1);
        this.cargar();
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
