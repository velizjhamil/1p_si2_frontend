import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api';
import {
  ChatMessage,
  ChatRequestPayload,
  ChatResponseData,
  IAStatusData,
} from '../models/ia.model';

export interface ApiResponse<T> {
  status: string;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class IaService {
  private readonly api = inject(ApiService);

  /**
   * CU25: Envía una consulta de moda o preguntas frecuentes al Asistente IA.
   * Conecta con Gemini mediante RAG directamente sobre la base de datos de Attention.
   */
  enviarMensaje(
    mensaje: string,
    historial: ChatMessage[] = [],
    idSucursal?: number | null,
  ): Observable<ApiResponse<ChatResponseData>> {
    // Tomar los últimos 8 mensajes válidos para mantener contexto conversacional
    const historialPayload = historial
      .filter((m) => !m.esError && m.contenido.trim().length > 0)
      .slice(-8)
      .map((m) => ({
        rol: m.rol === 'usuario' ? 'usuario' : 'asistente',
        contenido: m.contenido,
      }));

    const payload: ChatRequestPayload = {
      mensaje: mensaje.trim(),
      historial: historialPayload,
      id_sucursal: idSucursal || null,
    };

    return this.api.post<ApiResponse<ChatResponseData>>('/ia/chat', payload);
  }

  /**
   * Diagnóstico del estado del servicio de IA y base de datos (GET /api/v1/ia/status).
   */
  verificarEstado(): Observable<ApiResponse<IAStatusData>> {
    return this.api.get<ApiResponse<IAStatusData>>('/ia/status');
  }
}
