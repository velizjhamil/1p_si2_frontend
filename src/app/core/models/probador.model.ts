/**
 * CU8 — Probador Virtual AR: modelos del probador de prendas
 * (fase MOCK en memoria; el backend de AR llegará con su CU real).
 */

/** Complexión derivada de las medidas aproximadas (IMC de referencia). */
export type Complexion = 'DELGADA' | 'MEDIA' | 'ROBUSTA' | 'NO_INDICADA';

/** Resultado de la estimación de ajuste de la prenda probada. */
export type AjusteEstimado = 'PERFECTO' | 'AJUSTADO' | 'HOLGADO';

/** Medidas opcionales que alimentan la recomendación de talla de la IA. */
export interface MedidasAproximadas {
  /** Estatura en centímetros (opcional). */
  estatura: number | null;
  /** Peso en kilogramos (opcional). */
  peso: number | null;
  /** Complexión calculada a partir de estatura y peso. */
  complexion: Complexion;
}

/** Foto del cliente/avatar procesada por el probador virtual. */
export interface FotoUsuario {
  id: number;
  url_imagen: string | null;
  fecha_subida: string;
  medidas_aproximadas: MedidasAproximadas;
}

/** Prueba virtual: superposición AR de una prenda sobre la foto. */
export interface SimulacionProbador {
  id: number;
  producto_id: number;
  producto_nombre: string;
  prenda_imagen_url: string | null;
  /** Foto del cliente con la prenda "puesta" (mock: misma foto + overlay AR). */
  resultado_imagen_url: string | null;
  talla_seleccionada: string;
  ajuste_estimado: AjusteEstimado;
  fecha_simulacion: string;
  // ---- extras de la fase mock para enriquecer la UI ----
  /** Talla que la IA recomienda según las medidas de la foto. */
  talla_recomendada?: string;
  color_seleccionado?: string;
  color_hex?: string;
  precio?: number;
  /** Categoría de la prenda (define la silueta del probador visual). */
  categoria?: string;
}
