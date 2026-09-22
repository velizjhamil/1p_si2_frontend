import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
 // Rutas con parámetros no son prerenderizables: se renderizan en cliente.
 {
 path: 'proximamente/:modulo',
 renderMode: RenderMode.Client,
 },
 {
 path: 'ventas/:id',
 renderMode: RenderMode.Client,
 },
 {
 path: 'agencias/:id',
 renderMode: RenderMode.Client,
 },
 // El resto de la app se prerenderiza como páginas estáticas.
 {
 path: '**',
 renderMode: RenderMode.Prerender,
 },
];
