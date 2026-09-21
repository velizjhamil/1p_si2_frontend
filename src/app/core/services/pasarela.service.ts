import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  CarritoItem,
  DatosEntrega,
  DatosTarjeta,
  MetodoPago,
  ProcesarPagoResponse,
  TipoVenta,
  TransaccionPago,
} from '../models/carrito.model';

export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

export interface IniciarPagoPayload {
  items: {
    producto_id: number;
    cantidad: number;
    talla: string;
    color: string;
  }[];
  metodo_pago: MetodoPago;
  datos_entrega: DatosEntrega;
  tipo_entrega?: 'DOMICILIO' | 'RETIRO';
  tipo_venta?: TipoVenta;
  id_sucursal?: number | null;
  datos_tarjeta?: DatosTarjeta;
  id_cliente_override?: string;
}

@Injectable({ providedIn: 'root' })
export class PasarelaService {
  private readonly api = inject(ApiService);

  /**
   * Inicia una transacción de pago en la pasarela (CU15 / CU21).
   * Registra la Venta y la TransaccionPago en el backend.
   */
  iniciarPago(payload: IniciarPagoPayload): Observable<ApiResponse<ProcesarPagoResponse>> {
    return this.api.post<ApiResponse<ProcesarPagoResponse>>('/pagos/procesar', payload);
  }

  /**
   * Consulta el estado en vivo de una transacción en la pasarela.
   */
  consultarEstado(codigoTransaccion: string): Observable<ApiResponse<TransaccionPago>> {
    return this.api.get<ApiResponse<TransaccionPago>>(`/pagos/estado/${codigoTransaccion}`);
  }

  /**
   * Simula la confirmación asíncrona por webhook (modo demo / pruebas).
   */
  simularConfirmacion(
    codigoTransaccion: string,
    aprobar: boolean = true,
    motivo?: string,
  ): Observable<ApiResponse<{ codigo_transaccion: string; estado: string; status: string }>> {
    const body: Record<string, unknown> = {
      codigo_transaccion: codigoTransaccion,
      aprobar,
    };
    if (motivo) {
      body['motivo'] = motivo;
    }
    return this.api.post<ApiResponse<{ codigo_transaccion: string; estado: string; status: string }>>(
      '/pagos/simular-confirmacion',
      body,
    );
  }

  /**
   * CU21: Procesa el pago directo con tarjeta en la pasarela nativa AttentionPay.
   */
  pagarConTarjeta(payload: any): Observable<ApiResponse<any>> {
    return this.api.post<ApiResponse<any>>('/pagos/procesar-tarjeta', payload);
  }

  /**
   * CU21: Genera una sesión oficial de pago con Stripe Checkout Sessions API.
   */
  crearSesionStripe(
    payload: any,
  ): Observable<ApiResponse<{ session_id: string; url: string; codigo_venta: string; id_venta: number; total: number }>> {
    return this.api.post<ApiResponse<any>>('/pagos/crear-sesion-stripe', payload);
  }

  /**
   * CU21: Valida el estado de la sesión de Stripe Checkout al retornar de la pasarela y liquida la compra.
   */
  confirmarSesionStripe(sessionId: string): Observable<ApiResponse<any>> {
    return this.api.post<ApiResponse<any>>('/pagos/confirmar-sesion-stripe', {
      session_id: sessionId,
    });
  }

  /**
   * CU21: Valida el abono por QR institucional y liquida la compra en tiempo real.
   */
  confirmarAbonoQR(codigoTransaccion: string, comprobanteReferencia?: string): Observable<ApiResponse<any>> {
    return this.api.post<ApiResponse<any>>('/pagos/qr/confirmar-abono', {
      codigo_transaccion: codigoTransaccion,
      comprobante_referencia: comprobanteReferencia,
    });
  }
}
