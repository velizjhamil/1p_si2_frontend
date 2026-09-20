import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../core/services/api';
import { ApiResponse } from '../../core/models/usuario.model';
import {
  DevolucionesReporte,
  FiltrosDevoluciones,
  FormatoExportacion,
  FiltrosInventario,
  FiltrosProductosMasVendidos,
  FiltrosRendimientoVendedores,
  FiltrosVentas,
  InventarioSituacion,
  ProductosMasVendidos,
  RendimientoVendedores,
  TipoReporte,
  VentasPeriodo,
} from '../../core/models/reporte.model';

/**
 * CU20 — Gestión de Reportes (ASU/GS).
 *
 * Consume GET /api/v1/reportes/{ventas|productos-mas-vendidos|inventario|
 * devoluciones|rendimiento-vendedores} y devuelve el envelope
 * { status, data, message }. Solo lectura: no calcula nada; los KPIs, series
 * y tablas los entrega el backend.
 *
 * - Las fechas se envían tal cual las eligió el usuario (`YYYY-MM-DD`): el
 *   backend las interpreta como día calendario UTC. No hay conversión de zona.
 * - Los parámetros vacíos (undefined / null / '') NO se envían: el backend
 *   aplica sus valores por defecto (p. ej. últimos 30 días).
 * - Errores: 401 (el ErrorInterceptor cierra la sesión), 403 (rol sin acceso),
 *   422 (filtros inválidos) llegan al componente como HttpErrorResponse;
 *   usar `mensajeErrorReporte()`.
 */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  /** GET /reportes/ventas */
  getVentas(filtros: FiltrosVentas = {}): Observable<ApiResponse<VentasPeriodo>> {
    return this.api.get<ApiResponse<VentasPeriodo>>(`/reportes/ventas${queryString(filtros)}`);
  }

  /** GET /reportes/productos-mas-vendidos */
  getProductosMasVendidos(
    filtros: FiltrosProductosMasVendidos = {},
  ): Observable<ApiResponse<ProductosMasVendidos>> {
    return this.api.get<ApiResponse<ProductosMasVendidos>>(
      `/reportes/productos-mas-vendidos${queryString(filtros)}`,
    );
  }

  /** GET /reportes/inventario */
  getInventario(filtros: FiltrosInventario = {}): Observable<ApiResponse<InventarioSituacion>> {
    return this.api.get<ApiResponse<InventarioSituacion>>(
      `/reportes/inventario${queryString(filtros)}`,
    );
  }

  /** GET /reportes/devoluciones */
  getDevoluciones(filtros: FiltrosDevoluciones = {}): Observable<ApiResponse<DevolucionesReporte>> {
    return this.api.get<ApiResponse<DevolucionesReporte>>(
      `/reportes/devoluciones${queryString(filtros)}`,
    );
  }

  /** GET /reportes/rendimiento-vendedores (contrato original: fecha_desde/fecha_hasta/tipo_venta). */
  getRendimientoVendedores(
    filtros: FiltrosRendimientoVendedores = {},
  ): Observable<ApiResponse<RendimientoVendedores>> {
    return this.api.get<ApiResponse<RendimientoVendedores>>(
      `/reportes/rendimiento-vendedores${queryString(filtros)}`,
    );
  }

  /**
   * Exportación: GET /reportes/{tipo}?formato=pdf|xlsx con LOS MISMOS filtros
   * de la consulta que se está viendo (el backend reutiliza el mismo service,
   * validación y autorización que el JSON). Devuelve el archivo como Blob.
   *
   * Usa HttpClient directo porque ApiService (compartido) no soporta
   * responseType 'blob'. Los errores 401/403/422 llegan como HttpErrorResponse
   * con el cuerpo JSON ya leído (el backend responde JSON en los errores),
   * así que `mensajeErrorReporte()` funciona igual que en las consultas.
   */
  exportar(
    tipo: TipoReporte,
    formato: FormatoExportacion,
    filtros: object = {},
  ): Observable<Blob> {
    const url = `${environment.apiUrl}/reportes/${tipo}${queryString({ ...filtros, formato })}`;
    return this.http.get(url, { responseType: 'blob' }).pipe(
      catchError((err: HttpErrorResponse) =>
        err.error instanceof Blob
          ? from(leerBlobComoTexto(err.error)).pipe(
              switchMap((texto) => throwError(() => errorConCuerpoJson(err, texto))),
            )
          : throwError(() => err),
      ),
    );
  }
}

/** Nombre del archivo descargado: reporte-<tipo>_<inicio>_<fin>.<pdf|xlsx> (período aplicado, UTC). */
export function nombreArchivoExportacion(
  tipo: TipoReporte,
  inicio: string,
  fin: string,
  formato: FormatoExportacion,
): string {
  return `reporte-${tipo}_${inicio}_${fin}.${formato}`;
}

function leerBlobComoTexto(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result ?? ''));
    lector.onerror = () => reject(lector.error);
    lector.readAsText(blob);
  });
}

/** Rehace el HttpErrorResponse con el JSON del cuerpo (que llegó como Blob). */
function errorConCuerpoJson(err: HttpErrorResponse, texto: string): HttpErrorResponse {
  let cuerpo: unknown = null;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    cuerpo = null;
  }
  return new HttpErrorResponse({
    error: cuerpo,
    headers: err.headers,
    status: err.status,
    statusText: err.statusText,
    url: err.url ?? undefined,
  });
}

/** Query string sin parámetros vacíos: `''` o `'?a=1&b=2'`. */
export function queryString(filtros: object): string {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor === undefined || valor === null || valor === '') continue;
    params.set(clave, String(valor));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/** Forma mínima del error HTTP del backend ({detail: string | [{loc, msg}]}). */
interface ErrorHttpReporte {
  status?: number;
  error?: { detail?: string | { loc?: (string | number)[]; msg?: string }[] };
}

/** Etiquetas legibles de los query params para los 422 de validación de FastAPI. */
const ETIQUETA_PARAMETRO: Record<string, string> = {
  fecha_inicio: 'Fecha inicial',
  fecha_fin: 'Fecha final',
  fecha_desde: 'Fecha inicial',
  fecha_hasta: 'Fecha final',
  categoria_id: 'Categoría',
  canal_venta: 'Canal de venta',
  tipo_venta: 'Canal de venta',
  nivel_stock: 'Nivel de stock',
  estado: 'Estado',
  top: 'Top',
  limite: 'Límite de filas',
  limite_detalle: 'Límite del detalle',
};

/** Clasificación de un error HTTP para decidir qué estado de UI mostrar. */
export type TipoErrorReporte = 'no-autenticado' | 'sin-permiso' | 'filtros-invalidos' | 'inesperado';

export function tipoErrorReporte(err: unknown): TipoErrorReporte {
  const status = (err as ErrorHttpReporte | null)?.status;
  if (status === 401) return 'no-autenticado';
  if (status === 403) return 'sin-permiso';
  if (status === 422) return 'filtros-invalidos';
  return 'inesperado';
}

/**
 * Mensaje legible para el usuario según el error HTTP:
 * - 401: sesión vencida.
 * - 403: el `detail` del backend ("Su rol no tiene acceso al panel de reportes.").
 * - 422: `detail` string (regla de negocio: rango invertido, categoría
 *   inexistente…) o lista de validación de FastAPI (`Campo: mensaje`).
 * - 0 / 5xx / otros: mensaje genérico.
 */
export function mensajeErrorReporte(err: unknown): string {
  const e = err as ErrorHttpReporte | null;
  const detail = e?.error?.detail;
  switch (tipoErrorReporte(err)) {
    case 'no-autenticado':
      return 'Su sesión expiró o no es válida. Inicie sesión nuevamente.';
    case 'sin-permiso':
      return typeof detail === 'string' && detail
        ? detail
        : 'Su rol no tiene acceso al panel de reportes.';
    case 'filtros-invalidos':
      if (typeof detail === 'string' && detail) return detail;
      if (Array.isArray(detail) && detail.length > 0) {
        return detail
          .map((d) => {
            const campo = d.loc?.[d.loc.length - 1];
            const etiqueta = typeof campo === 'string' ? (ETIQUETA_PARAMETRO[campo] ?? campo) : '';
            const texto = d.msg ?? 'valor inválido';
            return etiqueta ? `${etiqueta}: ${texto}` : texto;
          })
          .join(' · ');
      }
      return 'Los filtros ingresados no son válidos.';
    default:
      return e?.status === 0
        ? 'No hay conexión con el servidor.'
        : 'No se pudo cargar el reporte. Intente nuevamente.';
  }
}
