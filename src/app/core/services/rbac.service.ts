import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';

export interface RbacNavModule<TItem> {
 label: string;
 icon: string;
 roles?: string[];
 items: TItem[];
}

export interface RbacNavItem {
 label: string;
 route: string;
 icon: string;
 badge?: string;
 roles?: string[];
}

@Injectable({ providedIn: 'root' })
export class RbacService {
 private readonly authService = inject(AuthService);

 private readonly user = toSignal(this.authService.currentUser$, {
 initialValue: null,
 });

 /** Rol normalizado en mayúsculas ('ASU', 'GS', 'V', 'C', 'D') o '' */
 readonly rol = computed<string>(() => {
 const fromSignal = this.user()?.rol?.nombre_rol;
 if (fromSignal) return fromSignal.toUpperCase();

 const fromService = this.authService.getRol();
 if (fromService) return fromService.toUpperCase();

 return '';
 });

 readonly esAdmin = computed<boolean>(() => {
 const r = this.rol();
 return r === 'ASU' || r === 'ADMIN';
 });

 readonly esGerente = computed<boolean>(() => this.rol() === 'GS');
 readonly esVendedor = computed<boolean>(() => this.rol() === 'V');
 readonly esCliente = computed<boolean>(() => this.rol() === 'C');
 readonly esDelivery = computed<boolean>(() => this.rol() === 'D');

 /**
 * Obtiene el rol actual del usuario autenticado (string plano).
 */
 getRol(): string {
 return this.rol();
 }

 /**
 * Valida si el rol actual coincide con alguno de los roles permitidos.
 */
 hasRole(roles: string | string[]): boolean {
 const current = this.rol();
 if (!current) return false;

 const list = Array.isArray(roles) ? roles : [roles];
 return list.some((r) => r.toUpperCase() === current);
 }

 /**
 * Verifica autorización para guardias de ruta y navegación.
 *
 * Reglas:
 * - Si no se especifican roles permitidos, el acceso es público para autenticados.
 * - Si strict es true: se requiere coincidencia exacta (ej. Carrito y Checkout son exclusivos de C).
 * - Si strict es false: ASU/ADMIN tiene acceso total a gestión administrativa y operativa.
 * - El rol del usuario debe coincidir con alguno de allowedRoles.
 */
 canAccess(allowedRoles?: string[], strict = false): boolean {
 if (!allowedRoles || allowedRoles.length === 0) {
 return true;
 }

 const current = this.rol();
 if (!current) return false;

 const admin = this.esAdmin();
 if (admin && !strict) {
 return true;
 }

 return allowedRoles.some((r) => r.toUpperCase() === current);
 }

  /**
   * Valida si un ítem del menú debe ser visible para el rol dado (o el rol actual).
   */
  canAccessItem(
    item: { roles?: string[] } | string[] | undefined,
    currentRol?: string,
  ): boolean {
    const r = (currentRol ?? this.rol()).toUpperCase();
    if (!r) return false;

    // Normalizar si se pasa el ítem completo o solo el arreglo de roles
    const itemRoles = Array.isArray(item) ? item : item?.roles;

    // Sin restricción de roles explícita -> visible para todos los autenticados
    if (!itemRoles || itemRoles.length === 0) return true;

    const rolesUpper = itemRoles.map((x) => x.toUpperCase());

    // Administrador (ASU / ADMIN) accede a ítems que tengan ASU o ADMIN en sus roles
    if (r === 'ASU' || r === 'ADMIN') {
      return rolesUpper.includes('ASU') || rolesUpper.includes('ADMIN');
    }

    // Regla estricta para Cliente: ítems con solo ['C'] son exclusivamente para el cliente
    const soloCliente = rolesUpper.length === 1 && rolesUpper[0] === 'C';
    if (soloCliente) {
      return r === 'C';
    }

    return rolesUpper.includes(r);
  }

 /**
 * Filtra dinámicamente una lista de módulos y sus ítems para el rol indicado.
 * Si una categoría queda sin ítems visibles, se descarta automáticamente.
 */
 filterMenu<TModule extends RbacNavModule<TItem>, TItem extends RbacNavItem>(
 modules: TModule[],
 userRol?: string,
 ): TModule[] {
 const r = (userRol ?? this.rol()).toUpperCase();
 if (!r) return [];

 return modules
 .filter((mod) => {
 if (!mod.roles || mod.roles.length === 0) return true;
 const modRolesUpper = mod.roles.map((x) => x.toUpperCase());
 if (r === 'ASU' || r === 'ADMIN') {
 return modRolesUpper.includes('ASU') || modRolesUpper.includes('ADMIN');
 }
 return modRolesUpper.includes(r);
 })
 .map((mod) => {
 // Filtrar ítems del módulo
 const visibleItems = mod.items.filter((item) => this.canAccessItem(item, r));
 return {
 ...mod,
 items: visibleItems,
 };
 })
 .filter((mod) => mod.items.length > 0);
 }
}
