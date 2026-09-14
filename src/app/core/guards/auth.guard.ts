import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const allowedRoles = route.data?.['roles'] as string[] | undefined;
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = authService.getRol();
    const roleUpper = (userRole || '').toUpperCase();
    const esAdmin = roleUpper === 'ASU' || roleUpper === 'ADMIN';

    if (esAdmin) {
      return true;
    }

    if (!allowedRoles.some((r) => r.toUpperCase() === roleUpper)) {
      authService.redirectUserHome();
      return false;
    }
  }

  return true;
};