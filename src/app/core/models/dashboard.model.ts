/**
 * Dashboard de Inicio (métricas resumen) — modelos del contrato backend.
 */
import { Empresa } from './empresa.model';

/** GET /api/v1/dashboard/metrics (protegido por JWT). */
export interface DashboardMetrics {
  total_sucursales: number;
  total_usuarios: number;
  total_proveedores: number;
  total_clientes: number;
  resumen_empresa: Empresa | null;
  generado_en?: string;
}
