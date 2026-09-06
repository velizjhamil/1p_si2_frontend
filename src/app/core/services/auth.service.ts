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
    return !!localStorage.getItem(this.tokenKey);
  }

  private getUserFromStorage(): Usuario | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }

  login(correo: string, contrasena: string): Observable<ApiResponse<TokenResponse>> {
    return this.api.post<ApiResponse<TokenResponse>>('/auth/login', {
      correo,
      password: contrasena,
    });
  }

  logout(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.userKey);
    }
    this._isAuthenticated.next(false);
    this._currentUser.next(null);
    this.router.navigate(['/login']);
  }

  handleLogin(response: ApiResponse<TokenResponse>): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.tokenKey, response.data.access_token);
      localStorage.setItem(this.userKey, JSON.stringify(response.data.user));
    }
    this._isAuthenticated.next(true);
    this._currentUser.next(response.data.user);
    this.redirectBasedOnRole(response.data.user.rol.nombre_rol as Rol);
  }

  private redirectBasedOnRole(rol: Rol): void {
    const routes: Record<Rol, string[]> = {
      ASU: ['/admin/dashboard'],
      GS: ['/gerente/dashboard'],
      V: ['/vendedor/dashboard'],
      C: ['/tienda/home'],
    };
    this.router.navigate(routes[rol] || ['/login']);
  }

  isAuthenticated(): boolean {
    return this._isAuthenticated.getValue();
  }

  getCurrentUser(): Usuario | null {
    return this._currentUser.getValue();
  }

  getRol(): string {
    return this._currentUser.getValue()?.rol?.nombre_rol ?? '';
  }

  getToken(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(this.tokenKey);
  }
}
