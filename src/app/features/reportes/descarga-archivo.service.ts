import { Injectable } from '@angular/core';

/**
 * CU20 — Entrega al navegador un archivo ya generado por el backend
 * (exportación PDF/Excel). Servicio aparte para poder sustituirlo en pruebas
 * y porque toca el DOM. No genera ni transforma el contenido.
 */
@Injectable({ providedIn: 'root' })
export class DescargaArchivoService {
  /** Dispara la descarga de `blob` con el nombre indicado. */
  descargar(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Se libera tras el clic; el navegador ya tomó la referencia del archivo.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
