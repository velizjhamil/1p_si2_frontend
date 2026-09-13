import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  AjusteEstimado,
  Complexion,
  FotoUsuario,
  MedidasAproximadas,
  SimulacionProbador,
} from '../models/probador.model';

/**
 * CU8 — Probador Virtual AR (FASE MOCK).
 *
 * Simula el motor de IA del probador: procesamiento de la foto del
 * cliente (1.5s), superposición de la prenda y recomendación de talla.
 * El historial persiste en localStorage (SSR-safe) para sobrevivir
 * recargas. Cuando llegue el backend AR, solo se reemplaza el cuerpo
 * de los métodos por llamadas HTTP al ApiService — la UI no cambia.
 */

/** Delay del "procesamiento de imagen/IA" al subir la foto (ms). */
const DELAY_SUBIDA = 1500;

/** Delay de la simulación de superposición AR (ms). */
const DELAY_SIMULACION = 1200;

/** Delay de lecturas del historial (ms). */
const DELAY_LECTURA = 250;

/** Clave de persistencia del historial de pruebas en localStorage. */
const STORAGE_KEY = 'attention_probador_historial';

/** Payload para subir una foto con medidas opcionales. */
export interface SubirFotoPayload {
  /** Data URL de la imagen seleccionada (FileReader). */
  imagen_data_url: string | null;
  estatura: number | null;
  peso: number | null;
}

/** Payload para probar una prenda sobre una foto existente. */
export interface ProbarPrendaPayload {
  foto_id: number;
  producto: {
    producto_id: number;
    nombre: string;
    tallas: string[];
    colores: { nombre: string; hex: string }[];
    precio: number;
    categoria: string;
  };
  talla_seleccionada: string;
  color_seleccionado: { nombre: string; hex: string };
}

@Injectable({ providedIn: 'root' })
export class ProbadorService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Fotos procesadas en la sesión actual (una activa a la vez). */
  private fotos: FotoUsuario[] = [];

  /** Historial de simulaciones (persistido en localStorage). */
  private historial: SimulacionProbador[] = [];

  /** Contador autonumérico mock. */
  private siguienteId = 1;

  constructor() {
    this.historial = this.leerStorage();
    this.siguienteId = this.historial.length + 1;
  }

  // ------------------------------------------------------------------ foto
  /**
   * POST mock — sube la foto del cliente y simula el análisis de IA:
   * detección de silueta + derivación de complexión por estatura/peso.
   */
  subirFotoUsuario(payload: SubirFotoPayload): Observable<FotoUsuario> {
    if (!payload.imagen_data_url) {
      return this.error422('Seleccione una foto para subir al probador.');
    }

    const medidas = this.derivarMedidas(payload.estatura, payload.peso);

    const foto: FotoUsuario = {
      id: this.siguienteId++,
      url_imagen: payload.imagen_data_url,
      fecha_subida: new Date().toISOString(),
      medidas_aproximadas: medidas,
    };
    this.fotos.push(foto);

    // Simula el procesamiento de imagen/IA (1.5s)
    return of(foto).pipe(delay(DELAY_SUBIDA));
  }

  /** GET mock — fotos procesadas de la sesión. */
  getFotosUsuario(): Observable<FotoUsuario[]> {
    return of([...this.fotos]).pipe(delay(DELAY_LECTURA));
  }

  // -------------------------------------------------------------- simulación
  /**
   * POST mock — prueba la prenda: superpone la silueta AR sobre la foto
   * del cliente y estima el ajuste comparando talla seleccionada vs la
   * talla recomendada por la IA según las medidas de la foto.
   */
  probarPrenda(payload: ProbarPrendaPayload): Observable<SimulacionProbador> {
    const foto = this.fotos.find((f) => f.id === payload.foto_id);
    if (!foto) {
      return this.error409(
        'La foto del cliente no fue encontrada. Suba una foto primero.',
      );
    }
    if (!payload.talla_seleccionada || !payload.color_seleccionado?.nombre) {
      return this.error422('Seleccione talla y color antes de probar la prenda.');
    }

    // "IA" mock: recomienda talla según complexión derivada de las medidas
    const tallaRecomendada = this.recomendarTalla(
      foto.medidas_aproximadas,
      payload.producto.tallas,
    );

    // Ajuste estimado: comparación talla elegida vs recomendada
    const ajuste = this.estimarAjuste(
      payload.talla_seleccionada,
      tallaRecomendada,
      payload.producto.tallas,
    );

    const simulacion: SimulacionProbador = {
      id: this.siguienteId++,
      producto_id: payload.producto.producto_id,
      producto_nombre: payload.producto.nombre,
      prenda_imagen_url: null,
      // Mock: la "imagen simulada" es la misma foto del cliente;
      // la superposición AR la dibuja el visualizador del componente.
      resultado_imagen_url: foto.url_imagen,
      talla_seleccionada: payload.talla_seleccionada,
      ajuste_estimado: ajuste,
      fecha_simulacion: new Date().toISOString(),
      talla_recomendada: tallaRecomendada,
      color_seleccionado: payload.color_seleccionado.nombre,
      color_hex: payload.color_seleccionado.hex,
      precio: payload.producto.precio,
      categoria: payload.producto.categoria,
    };

    return of(simulacion).pipe(delay(DELAY_SIMULACION));
  }

  /**
   * POST mock — guarda una prueba en "Mis Lookbooks" (el historial
   * persistido). Solo llegan aquí las simulaciones que el usuario decide
   * conservar con el botón "Guardar En Mis Lookbooks".
   */
  guardarEnLookbook(simulacion: SimulacionProbador): Observable<SimulacionProbador> {
    this.historial.unshift(simulacion);
    this.persistir();
    return of(simulacion).pipe(delay(DELAY_LECTURA));
  }

  /** GET mock — historial de pruebas (más reciente primero). */
  getHistorialPruebas(): Observable<SimulacionProbador[]> {
    return of([...this.historial]).pipe(delay(DELAY_LECTURA));
  }

  /** DELETE mock — elimina una prueba del historial. */
  eliminarPrueba(id: number): Observable<void> {
    this.historial = this.historial.filter((s) => s.id !== id);
    this.persistir();
    return of(undefined).pipe(delay(DELAY_LECTURA));
  }

  // ------------------------------------------------------------ motor "IA" mock
  /**
   * Deriva la complexión a partir de estatura y peso (IMC de referencia).
   * Sin medidas: complexión NO_INDICADA → talla M por defecto.
   */
  private derivarMedidas(
    estatura: number | null,
    peso: number | null,
  ): MedidasAproximadas {
    let complexion: Complexion = 'NO_INDICADA';
    if (estatura && peso && estatura > 0 && peso > 0) {
      const imc = peso / Math.pow(estatura / 100, 2);
      complexion = imc < 20 ? 'DELGADA' : imc <= 27 ? 'MEDIA' : 'ROBUSTA';
    }
    return { estatura, peso, complexion };
  }

  /** Talla sugerida por la "IA" según complexión y tallas disponibles. */
  private recomendarTalla(
    medidas: MedidasAproximadas,
    tallasDisponibles: string[],
  ): string {
    if (tallasDisponibles.length === 0) return 'M';

    const ordenadas = [...tallasDisponibles].sort((a, b) =>
      this.indiceTalla(a) - this.indiceTalla(b),
    );
    let objetivo = 1; // índice de M en una escala relativa

    switch (medidas.complexion) {
      case 'DELGADA':
        objetivo = 0; // tiende a S (o la menor disponible)
        break;
      case 'MEDIA':
        objetivo = 1; // tiende a M
        break;
      case 'ROBUSTA':
        objetivo = 2; // tiende a L
        break;
      default:
        objetivo = Math.min(1, ordenadas.length - 1);
    }

    return ordenadas[Math.min(objetivo, ordenadas.length - 1)];
  }

  /** Índice relativo de una talla (XS=0, S=1, M=2, ...). */
  private indiceTalla(talla: string): number {
    const orden = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    const idx = orden.indexOf(talla.toUpperCase());
    return idx >= 0 ? idx : 2;
  }

  /** Estima el ajuste comparando la talla elegida con la recomendada. */
  private estimarAjuste(
    elegida: string,
    recomendada: string,
    tallasDisponibles: string[],
  ): AjusteEstimado {
    if (elegida === recomendada) return 'PERFECTO';

    const idxElegida = this.indiceTalla(elegida);
    const idxRecomendada = this.indiceTalla(recomendada);

    // Una talla menos que la recomendada: queda ajustado al cuerpo
    if (idxElegida < idxRecomendada) return 'AJUSTADO';
    // Una o más tallas más: queda holgado
    return 'HOLGADO';
  }

  // ------------------------------------------------------------- persistencia
  /** Guarda el historial en localStorage (solo navegador). */
  private persistir(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.historial));
    } catch {
      // storage lleno/bloqueado: el historial sigue vivo en memoria
    }
  }

  /** Restaura el historial de localStorage (vacío en SSR). */
  private leerStorage(): SimulacionProbador[] {
    if (!isPlatformBrowser(this.platformId)) return [];
    try {
      const crudo = localStorage.getItem(STORAGE_KEY);
      return crudo ? (JSON.parse(crudo) as SimulacionProbador[]) : [];
    } catch {
      return [];
    }
  }

  // ------------------------------------------------------------------ errores
  /** Simula la respuesta de error del backend FastAPI. */
  private error409(detail: string): Observable<never> {
    return throwError(() => ({ error: { detail } })).pipe(delay(DELAY_LECTURA));
  }

  private error422(detail: string): Observable<never> {
    return throwError(() => ({ error: { detail } })).pipe(delay(DELAY_LECTURA));
  }
}
