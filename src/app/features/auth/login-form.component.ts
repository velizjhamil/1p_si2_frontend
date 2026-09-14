import { Component, OnInit, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

const REMEMBERED_EMAIL_KEY = 'attention_remembered_email';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-form.component.html',
})
export class LoginFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);

  loginForm = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required, Validators.minLength(6)]],
    recordar: [false],
  });

  errorMessage = signal('');
  isLoading = signal(false);
  attemptCount = signal(0);
  isDisabled = signal(false);
  showPassword = signal(false);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const remembered = localStorage.getItem(REMEMBERED_EMAIL_KEY);
        if (remembered) {
          // Desencriptación base64 simple o lectura directa
          const email = atob(remembered);
          if (email) {
            this.loginForm.patchValue({
              correo: email,
              recordar: true,
            });
          }
        }
      } catch {
        // En caso de que el valor guardado no sea base64 válido
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
    }
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  onSubmit(): void {
    if (this.isDisabled()) return;
    if (this.loginForm.invalid) {
      this.errorMessage.set('Por favor, complete todos los campos correctamente.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const { correo, contrasena, recordar } = this.loginForm.value;
      this.authService.login(correo!, contrasena!).subscribe({
        next: (response) => {
          // Gestionar Recordar sesión en localStorage
          if (isPlatformBrowser(this.platformId)) {
            try {
              if (recordar && correo) {
                localStorage.setItem(REMEMBERED_EMAIL_KEY, btoa(correo));
              } else {
                localStorage.removeItem(REMEMBERED_EMAIL_KEY);
              }
            } catch (err) {
              console.warn('No se pudo guardar la preferencia de recordar sesión:', err);
            }
          }

          try {
            this.authService.handleLogin(response);
          } catch (loginErr: any) {
            this.isLoading.set(false);
            this.errorMessage.set(loginErr?.message || 'Error al procesar la sesión.');
          }
        },
        error: (err) => {
          const count = this.attemptCount() + 1;
          this.attemptCount.set(count);

          let message = 'Credenciales incorrectas. Intente nuevamente.';
          if (err.status === 0) {
            message = 'No se pudo conectar con el servidor. Verifique que el backend esté en ejecución.';
          } else if (err?.error?.detail) {
            message = err.error.detail;
          } else if (err?.error?.message) {
            message = err.error.message;
          }

          this.errorMessage.set(message);
          this.isLoading.set(false);

          if (count >= 5) {
            this.isDisabled.set(true);
            this.errorMessage.set('Demasiados intentos fallidos. Acceso bloqueado temporalmente por seguridad.');
          }
        },
      });
    } catch (e: any) {
      this.isLoading.set(false);
      this.errorMessage.set('Ocurrió un error inesperado al procesar la solicitud.');
    }
  }
}

export { LoginFormComponent as LoginComponent };