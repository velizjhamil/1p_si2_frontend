import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmpresaService } from './company.service';

@Component({
 selector: 'app-empresa',
 imports: [ReactiveFormsModule],
 templateUrl: './company.component.html',
})
export class CompanyComponent implements OnInit {
 private readonly fb = inject(FormBuilder);
 private readonly empresaService = inject(EmpresaService);

 cargando = signal(true);
 guardando = signal(false);
 errorMessage = signal('');
 exitoMessage = signal('');

 empresaForm = this.fb.group({
 razon_social: ['', [Validators.required, Validators.minLength(2)]],
 nit: ['', [Validators.required, Validators.minLength(5)]],
 direccion: [''],
 telefono: [''],
 email: ['', Validators.email],
 ciudad: [''],
 });

 ngOnInit(): void {
 this.empresaService.getEmpresa().subscribe({
 next: (resp) => {
 const empresa = resp.data;
 if (empresa) {
 this.empresaForm.reset({
 razon_social: empresa.razon_social,
 nit: empresa.nit,
 direccion: empresa.direccion ?? '',
 telefono: empresa.telefono ?? '',
 email: empresa.email ?? '',
 ciudad: empresa.ciudad ?? '',
 });
 } else {
 // Sin registro: formulario vacío listo para crear el primero
 this.exitoMessage.set(
 'Configure los datos institucionales de su empresa y guarde.'
 );
 }
 this.cargando.set(false);
 },
 error: () => {
 this.errorMessage.set('No se pudo cargar la información de la empresa.');
 this.cargando.set(false);
 },
 });
 }

 guardar(): void {
 if (this.empresaForm.invalid || this.guardando()) {
 this.errorMessage.set('Complete Razón Social y NIT correctamente.');
 return;
 }

 const { razon_social, nit, direccion, telefono, email, ciudad } =
 this.empresaForm.value;

 this.guardando.set(true);
 this.errorMessage.set('');
 this.exitoMessage.set('');

 this.empresaService
 .updateEmpresa({
 razon_social: razon_social!,
 nit: nit!,
 direccion: direccion || undefined,
 telefono: telefono || undefined,
 email: email || undefined,
 ciudad: ciudad || undefined,
 })
 .subscribe({
 next: () => {
 this.guardando.set(false);
 this.exitoMessage.set('Información de la empresa guardada correctamente.');
 setTimeout(() => this.exitoMessage.set(''), 4000);
 },
 error: (err) => {
 this.guardando.set(false);
 this.errorMessage.set(
 err?.error?.detail ||
 'Ocurrió un error al guardar. Verifique los datos e intente nuevamente.'
 );
 },
 });
 }
}
