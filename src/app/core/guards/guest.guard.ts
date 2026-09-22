import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * guestGuard — protege la ruta /login para usuarios NO autenticados.
 * Si el usuario ya tiene sesión iniciada, lo redirige a su dashboard correspondiente.
 * Si no está autenticado, permite el acceso y renderizado del formulario.
 */
export const guestGuard: CanActivateFn = () => {
 const authService = inject(AuthService);

 if (authService.isAuthenticated()) {
 authService.redirectUserHome();
 return false;
 }

 return true;
};
