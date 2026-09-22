import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { RbacService } from '../services/rbac.service';

export const authGuard: CanActivateFn = (route, state) => {
 const authService = inject(AuthService);
 const rbacService = inject(RbacService);
 const router = inject(Router);

 if (!authService.isAuthenticated()) {
 router.navigate(['/login']);
 return false;
 }

 const allowedRoles = route.data?.['roles'] as string[] | undefined;
 const estricto = route.data?.['strict'] === true;

 if (!rbacService.canAccess(allowedRoles, estricto)) {
 authService.redirectUserHome();
 return false;
 }

 return true;
};
