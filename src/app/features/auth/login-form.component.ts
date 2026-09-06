import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.css',
})
export class LoginFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  loginForm = this.fb.group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', [Validators.required, Validators.minLength(6)]],
    recordar: [false], // <--- Agregado para el checkbox
  });

  errorMessage = signal('');
  isLoading = signal(false);
  attemptCount = signal(0);
  isDisabled = signal(false);
  showPassword = signal(false); // <--- Agregado para ver/ocultar contraseña

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

    const { correo, contrasena } = this.loginForm.value;
    this.authService.login(correo!, contrasena!).subscribe({
      next: (response) => {
        this.authService.handleLogin(response);
      },
      error: (err) => {
        const count = this.attemptCount() + 1;
        this.attemptCount.set(count);
        this.errorMessage.set(err?.error?.detail || 'Credenciales incorrectas. Intente nuevamente.');
        this.isLoading.set(false);
        if (count >= 5) {
          this.isDisabled.set(true);
        }
      },
    });
  }
}