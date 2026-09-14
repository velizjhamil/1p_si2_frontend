import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  
  // Detección automática del entorno basada en hostname
  private readonly baseUrl = this.getBaseUrl();

  /**
   * Determina dinámicamente la URL base del backend según el entorno:
   * - Producción (Vercel): https://attention-backend-czw9.onrender.com/api/v1
   * - Desarrollo local: http://localhost:8000/api/v1
   */
  private getBaseUrl(): string {
    const hostname = window.location.hostname;
    
    // Si estamos en localhost o 127.0.0.1, usar backend local
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000/api/v1';
    }
    
    // Si estamos en Vercel (*.vercel.app), usar backend de producción en Render
    if (hostname.includes('vercel.app')) {
      return 'https://attention-backend-czw9.onrender.com/api/v1';
    }
    
    // Fallback para otros entornos (usar producción por defecto)
    console.warn(`⚠️ Hostname desconocido (${hostname}), usando backend de producción`);
    return 'https://attention-backend-czw9.onrender.com/api/v1';
  }

  constructor() {
    console.log(`🚀 API Service inicializado con baseUrl: ${this.baseUrl}`);
  }

  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${endpoint}`);
  }

  post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${endpoint}`, body);
  }

  put<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}${endpoint}`, body);
  }

  patch<T>(endpoint: string, body: unknown | null): Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${endpoint}`, body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${endpoint}`);
  }
}
