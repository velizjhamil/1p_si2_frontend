import { Component, OnInit, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import {
  passwordSeguraValidator,
  evaluarRequisitosPassword,
} from '../../core/utils/password-validator';

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

 modo = signal<'login' | 'registro'>('login');
 exitoMessage = signal('');

 loginForm = this.fb.group({
 correo: ['', [Validators.required, Validators.email]],
 contrasena: ['', [Validators.required]],
 recordar: [false],
 });

 registroForm = this.fb.group({
 nombre: ['', Validators.required],
 apellido: [''],
 correo: ['', [Validators.required, Validators.email]],
 password: ['', [Validators.required, passwordSeguraValidator(true)]],
 confirmPassword: ['', Validators.required],
 });

 passwordRegistroValor = signal('');
 requisitosRegistro = computed(() =>
 evaluarRequisitosPassword(this.passwordRegistroValor()),
 );

 errorMessage = signal('');
 isLoading = signal(false);
 attemptCount = signal(0);
 isDisabled = signal(false);
 showPassword = signal(false);
 showRegisterPassword = signal(false);
 showRegisterConfirmPassword = signal(false);

  ngOnInit(): void {
    this.registroForm.controls.password.valueChanges.subscribe((val) => {
      this.passwordRegistroValor.set(val || '');
    });

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

  cambiarModo(nuevoModo: 'login' | 'registro'): void {
    this.modo.set(nuevoModo);
    this.errorMessage.set('');
    this.exitoMessage.set('');
  }

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  toggleRegisterPassword(): void {
    this.showRegisterPassword.update((val) => !val);
  }

  toggleRegisterConfirmPassword(): void {
    this.showRegisterConfirmPassword.update((val) => !val);
  }

  onRegistroSubmit(): void {
    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      this.errorMessage.set(
        'Por favor completa todos los campos requeridos con una contraseña que cumpla las directivas de seguridad.',
      );
      return;
    }

    const { nombre, apellido, correo, password, confirmPassword } = this.registroForm.value;

    if (password !== confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.exitoMessage.set('');

    this.authService
      .register({
        nombre: nombre!.trim(),
        apellido: (apellido || '').trim(),
        correo: correo!.trim().toLowerCase(),
        password: password!,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.exitoMessage.set('¡Cuenta creada exitosamente! Ahora puedes iniciar sesión.');
          const savedEmail = correo!.trim().toLowerCase();
          this.registroForm.reset();
          this.passwordRegistroValor.set('');
          this.modo.set('login');
          this.loginForm.patchValue({ correo: savedEmail });
        },
        error: (err) => {
          this.isLoading.set(false);
          let message = 'No se pudo crear la cuenta. Intente nuevamente.';
          if (err?.error?.detail) {
            message = err.error.detail;
          } else if (err?.error?.message) {
            message = err.error.message;
          }
          this.errorMessage.set(message);
        },
      });
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