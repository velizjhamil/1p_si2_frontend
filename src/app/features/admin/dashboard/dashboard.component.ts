import { Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  imports: [],
  selector: 'app-admin-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  protected readonly authService = inject(AuthService);
  protected readonly usuario = this.authService.getCurrentUser();

  protected cerrarSesion(): void {
    this.authService.logout();
  }
}
