import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';
import { ApiService } from './api';
import { Usuario, ApiResponse, TokenResponse, Rol } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
 private readonly api = inject(ApiService);
 private readonly router = inject(Router);
 private readonly platformId = inject(PLATFORM_ID);
 private readonly tokenKey = 'auth_token';
 private readonly userKey = 'auth_user';

 private readonly _isAuthenticated = new BehaviorSubject<boolean>(this.hasToken());
 private readonly _currentUser = new BehaviorSubject<Usuario | null>(this.getUserFromStorage());

 readonly isAuthenticated$ = this._isAuthenticated.asObservable();
 readonly currentUser$ = this._currentUser.asObservable();

 private hasToken(): boolean {
 if (!isPlatformBrowser(this.platformId)) return false;
 try {
 const token = localStorage.getItem(this.tokenKey);
 return !!token && token !== 'undefined' && token !== 'null';
 } catch {
 return false;
 }
 }

 private getUserFromStorage(): Usuario | null {
 if (!isPlatformBrowser(this.platformId)) return null;
 try {
 const raw = localStorage.getItem(this.userKey);
 if (!raw || raw === 'undefined' || raw === 'null') return null;
 return JSON.parse(raw);
 } catch {
 return null;
 }
 }

 login(correo: string, contrasena: string): Observable<ApiResponse<TokenResponse>> {
 return this.api.post<ApiResponse<TokenResponse>>('/auth/login', {
 correo,
 password: contrasena,
 });
 }

 register(payload: {
 nombre: string;
 apellido?: string;
 correo: string;
 password: string;
 nombre_rol?: string;
 }): Observable<ApiResponse<any>> {
 return this.api.post<ApiResponse<any>>('/usuarios', {
 ...payload,
 nombre_rol: payload.nombre_rol || 'C',
 });
 }

 logout(): void {
 if (isPlatformBrowser(this.platformId)) {
 try {
 localStorage.removeItem(this.tokenKey);
 localStorage.removeItem(this.userKey);
 } catch {
 // ignore
 }
 }
 this._isAuthenticated.next(false);
 this._currentUser.next(null);
 this.router.navigate(['/login']);
 }

 handleLogin(response: ApiResponse<TokenResponse>): void {
 try {
 if (!response || !response.data) {
 throw new Error('Respuesta inválida del servidor');
 }

 const token = response.data.access_token;
 const user = response.data.user;

 if (!token || !user) {
 throw new Error('Datos de sesión incompletos');
 }

 if (isPlatformBrowser(this.platformId)) {
 try {
 localStorage.setItem(this.tokenKey, token);
 localStorage.setItem(this.userKey, JSON.stringify(user));
 } catch (e) {
 console.warn('Error al guardar sesión en localStorage:', e);
 }
 }

 this._isAuthenticated.next(true);
 this._currentUser.next(user);

 const rolNombre = user.rol?.nombre_rol || (user.rol as unknown as string) || '';
 this.redirectBasedOnRole(rolNombre);
 } catch (err) {
 console.error('Error al procesar login:', err);
 throw err;
 }
 }

 redirectBasedOnRole(rol: string): void {
 const rolUpper = (rol || '').toUpperCase();
 if (rolUpper === 'ASU' || rolUpper === 'ADMIN') {
 this.router.navigate(['/admin/dashboard']);
 } else if (rolUpper === 'GS') {
 this.router.navigate(['/gerente/dashboard']);
 } else if (rolUpper === 'V') {
 this.router.navigate(['/vendedor/dashboard']);
 } else if (rolUpper === 'C') {
 this.router.navigate(['/tienda/home']);
 } else if (rolUpper === 'D') {
 // Encargado de Delivery: su pantalla de trabajo es la gestión de envíos
 //; no tiene dashboard propio ni acceso a /admin/dashboard.
 this.router.navigate(['/envios']);
 } else {
 this.router.navigate(['/admin/dashboard']);
 }
 }

 redirectUserHome(): void {
 const user = this.getCurrentUser();
 const rol = user?.rol?.nombre_rol || (user?.rol as unknown as string) || this.getRol();
 this.redirectBasedOnRole(rol);
 }

 isAuthenticated(): boolean {
 return this._isAuthenticated.getValue();
 }

 getCurrentUser(): Usuario | null {
 return this._currentUser.getValue();
 }

 usuario(): Usuario | null {
 return this.getCurrentUser();
 }

 getRol(): string {
 return this._currentUser.getValue()?.rol?.nombre_rol ?? '';
 }

 /**
 * True solo para el rol Cliente (C). El carrito y el checkout online son
 * exclusivos de este rol (regla de negocio); ASU/GS/V/D no compran.
 * Es una ayuda de UX: la autoridad real es el backend (403 en /ventas/checkout).
 */
 esCliente(): boolean {
 return (this.getRol() || '').toUpperCase() === 'C';
 }

 getToken(): string | null {
 if (!isPlatformBrowser(this.platformId)) return null;
 return localStorage.getItem(this.tokenKey);
 }
}
