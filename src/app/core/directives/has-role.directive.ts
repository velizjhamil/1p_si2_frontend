import {
 Directive,
 Input,
 TemplateRef,
 ViewContainerRef,
 effect,
 inject,
 signal,
} from '@angular/core';
import { RbacService } from '../services/rbac.service';

/**
 * Directiva estructural para renderizado condicional de elementos del DOM
 * según el rol del usuario autenticado.
 *
 * Uso:
 * ```html
 * <button *appHasRole="['ASU', 'GS']" (click)="crear()">Nuevo</button>
 * <span *appHasRole="'ASU'">Solo Administrador</span>
 * ```
 */
@Directive({
 selector: '[appHasRole]',
 standalone: true,
})
export class HasRoleDirective {
 private readonly templateRef = inject(TemplateRef<unknown>);
 private readonly viewContainer = inject(ViewContainerRef);
 private readonly rbacService = inject(RbacService);

 private readonly requiredRoles = signal<string[]>([]);
 private isViewCreated = false;

 constructor() {
 effect(() => {
 const roles = this.requiredRoles();
 const hasPermission = roles.length === 0 || this.rbacService.hasRole(roles);

 if (hasPermission && !this.isViewCreated) {
 this.viewContainer.createEmbeddedView(this.templateRef);
 this.isViewCreated = true;
 } else if (!hasPermission && this.isViewCreated) {
 this.viewContainer.clear();
 this.isViewCreated = false;
 }
 });
 }

 @Input('appHasRole')
 set appHasRole(val: string | string[] | undefined | null) {
 if (!val) {
 this.requiredRoles.set([]);
 } else if (Array.isArray(val)) {
 this.requiredRoles.set(val);
 } else {
 this.requiredRoles.set([val]);
 }
 }
}
