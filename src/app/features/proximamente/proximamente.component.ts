import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Placeholder de módulos en desarrollo (Ciclos 2+).
 * Los ítems del sidebar correspondientes a CUs aún no implementados
 * navegan aquí para no romper el menú jerárquico del sistema.
 */
@Component({
 selector: 'app-proximamente',
 template: `
 <section class="p-6 md:p-8 max-w-3xl mx-auto">
 <div class="bg-white rounded-2xl shadow-md border border-primary/10 p-10 text-center">
 <span
 class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-container text-primary mb-6"
 >
 <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path
 stroke-linecap="round"
 stroke-linejoin="round"
 stroke-width="2"
 d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
 />
 </svg>
 </span>
 <h1 class="text-2xl font-bold text-primary">Módulo en desarrollo</h1>
 <p class="text-gray-600 mt-3 text-sm leading-relaxed">
 Esta sección del sistema (<strong>{{ modulo }}</strong>) corresponde a
 los Ciclos 2 y 3 del proyecto Attention y aún no fue implementada.
 Volvé pronto: el módulo se integrará al layout automáticamente.
 </p>
 <a
 routerLink="/"
 class="inline-block mt-8 bg-primary text-white px-5 py-2.5 rounded-lg hover:bg-accent hover:text-primary transition text-sm font-medium"
 >
 Volver al inicio
 </a>
 </div>
 </section>
 `,
 standalone: true,
 imports: [],
})
export class ProximamenteComponent {
 protected readonly modulo: string;

 constructor(route: ActivatedRoute) {
 // Nombre del módulo desde la URL /proximamente/:modulo
 this.modulo = (route.snapshot.paramMap.get('modulo') ?? 'Módulo')
 .split('-')
 .join(' ');
 }
}
