import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { AuthService } from '../services/auth.service';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

/**
 * ErrorInterceptor — maneja errores HTTP globales.
 *
 * Politica de logout (revisada):
 * - 401 Unauthorized  -> logout. El token expiro o no existe. La unica
 *   respuesta correcta es llevar al usuario a /login.
 * - 403 Forbidden     -> NO logout. El usuario esta autenticado pero no
 *   tiene permiso para ESE endpoint concreto (ej: Cliente intentando
 *   crear una notificacion: es un 403 esperado, no motivo de deslogueo).
 *   Dejar que la UI muestre el mensaje del backend en su propio toast.
 * - 5xx               -> NO logout. Es un error del server; se propaga
 *   al caller para que muestre su propio mensaje.
 *
 * Antes: cualquier 401 O 403 deslogaba al usuario. Eso provocaba que
 * un Cliente al hacer click en "Crear notificacion" (que no le
 * corresponde) terminara deslogado y sin entender por que.
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private readonly authService: AuthService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.authService.logout();
        }
        // 403 y 5xx: se propagan al caller para manejo local.
        return throwError(() => error);
      })
    );
  }
}