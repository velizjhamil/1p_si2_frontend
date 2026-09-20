import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { mensajeErrorEnvio } from '../envios/envios.service';
import { AgenciaCotizadorComponent } from './agencia-cotizador.component';
import { AgenciaFormComponent, AgenciaGuardada } from './agencia-form.component';
import { AgenciaZonasComponent } from './agencia-zonas.component';
import { AgenciasService } from './agencias.service';
import { Agencia } from '../../core/models/agencia.model';

/**
 * CU19 — Detalle de una agencia de reparto: datos, habilitación, zonas de
 * cobertura con sus tarifas y simulador de cotización.
 *
 * ASU/GS: ven y editan todo (incluye datos de facturación y totales). D: solo
 * consulta una agencia HABILITADA, sin facturación (una deshabilitada le
 * responde 404 y se muestra el mensaje del backend).
 */
@Component({
  selector: 'app-agencia-detalle',
  imports: [
    RouterLink,
    DatePipe,
    BadgeComponent,
    ConfirmDialogComponent,
    AgenciaFormComponent,
    AgenciaZonasComponent,
    AgenciaCotizadorComponent,
  ],
  templateUrl: './agencia-detalle.component.html',
})
export class AgenciaDetalleComponent implements OnInit {
  private readonly service = inject(AgenciasService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly puedeGestionar = ['ASU', 'GS'].includes((this.auth.getRol() || '').toUpperCase());

  agencia = signal<Agencia | null>(null);
  cargando = signal(true);
  errorMessage = signal('');
  exitoMessage = signal('');

  editando = signal(false);
  confirmarDeshabilitar = signal(false);
  confirmarEliminar = signal(false);

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      const id = Number(p.get('id'));
      if (!Number.isInteger(id) || id <= 0) {
        this.errorMessage.set('Agencia no válida.');
        this.cargando.set(false);
        return;
      }
      this.cargar(id);
    });
  }

  private cargar(id: number): void {
    this.cargando.set(true);
    this.errorMessage.set('');
    this.service.obtener(id).subscribe({
      next: (a) => {
        this.agencia.set(a);
        this.cargando.set(false);
      },
      error: (err) => {
        this.agencia.set(null);
        this.errorMessage.set(mensajeErrorEnvio(err, 'No se pudo cargar la agencia.'));
        this.cargando.set(false);
      },
    });
  }

  alGuardar(r: AgenciaGuardada): void {
    this.editando.set(false);
    this.agencia.set({ ...this.agencia()!, ...r.agencia });
    this.avisar(r.mensaje);
  }

  alternarEstado(): void {
    const a = this.agencia();
    if (!a) return;
    if (a.is_active) {
      this.confirmarDeshabilitar.set(true);
      return;
    }
    this.cambiarEstado(true);
  }

  confirmarDeshabilitacion(): void {
    this.confirmarDeshabilitar.set(false);
    this.cambiarEstado(false);
  }

  private cambiarEstado(habilitar: boolean): void {
    const a = this.agencia();
    if (!a) return;
    this.errorMessage.set('');
    this.service.cambiarEstado(a.id_agencia, habilitar).subscribe({
      next: (n) => {
        this.agencia.set({ ...a, ...n });
        this.avisar(
          habilitar
            ? 'Agencia habilitada: vuelve a ofrecerse para asignaciones.'
            : 'Agencia deshabilitada: ya no se ofrece para nuevas asignaciones. Sus envíos anteriores no se modifican.',
        );
      },
      error: (err) => this.errorMessage.set(mensajeErrorEnvio(err)),
    });
  }

  /** DELETE físico (409 si tiene envíos asociados). Al eliminar vuelve al listado. */
  confirmarEliminacion(): void {
    const a = this.agencia();
    this.confirmarEliminar.set(false);
    if (!a) return;
    this.errorMessage.set('');
    this.service.eliminar(a.id_agencia).subscribe({
      next: () => this.router.navigate(['/agencias']),
      error: (err) => this.errorMessage.set(mensajeErrorEnvio(err)),
    });
  }

  private avisar(mensaje: string): void {
    this.errorMessage.set('');
    this.exitoMessage.set(mensaje);
    setTimeout(() => this.exitoMessage.set(''), 4000);
  }
}
