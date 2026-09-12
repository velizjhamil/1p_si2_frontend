import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService } from './dashboard.service';
import { DashboardMetrics } from '../../core/models/dashboard.model';

/**
 * Dashboard de Administración (ASU) — pantalla de Inicio.
 * Banner de bienvenida con nombre y rol del usuario autenticado, KPI
 * cards de métricas del sistema (sucursales, usuarios, proveedores,
 * clientes), resumen institucional de la empresa matriz y accesos
 * rápidos a los módulos de gestión.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);

  protected readonly usuario = this.authService.getCurrentUser();
  protected readonly metrics = signal<DashboardMetrics | null>(null);
  protected readonly cargando = signal(true);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.dashboardService.getMetrics().subscribe({
      next: (resp) => {
        this.metrics.set(resp.data);
        this.cargando.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'No se pudieron cargar las métricas del sistema.'
        );
        this.cargando.set(false);
      },
    });
  }

  protected cerrarSesion(): void {
    this.authService.logout();
  }
}
