import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import { DashboardMetrics } from '../../core/models/dashboard.model';

/**
 * Dashboard de Inicio — métricas resumen del sistema.
 * Consume GET /api/v1/dashboard/metrics (protegido por JWT; el
 * JwtInterceptor adjunta el Authorization: Bearer automáticamente).
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
 private readonly api = inject(ApiService);

 /** GET /api/v1/dashboard/metrics — KPIs + resumen de la empresa. */
 getMetrics(): Observable<ApiResponse<DashboardMetrics>> {
 return this.api.get<ApiResponse<DashboardMetrics>>('/dashboard/metrics');
 }
}
