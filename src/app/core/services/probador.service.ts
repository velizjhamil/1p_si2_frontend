import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api';
import { ApiResponse } from '../models/usuario.model';
import {
 AjusteEstimado,
 Complexion,
 FotoUsuario,
 MedidasAproximadas,
 SimulacionProbador,
} from '../models/probador.model';

/**
 * Probador Virtual AR.
 *
 * Consume los endpoints reales del backend FastAPI:
 * - POST /api/v1/probador-virtual/subir-foto (guarda foto + complexión)
 * - POST /api/v1/probador-virtual/probar (simulación + recomendación)
 * - POST /api/v1/probador-virtual/lookbook (guardar en Mis Lookbooks)
 * - GET /api/v1/probador-virtual/historial (simulaciones del usuario)
 * - DELETE /api/v1/probador-virtual/lookbook/{id}
 *
 * El motor de recomendación (complexión por IMC → talla objetivo →
 * ajuste estimado) ahora vive en el BACKEND — misma semántica que el
 * mock. Las tallas disponibles se validan contra el catálogo real.
 */

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

/** DTO de foto devuelta por el backend. */
interface FotoDTO {
 id_foto: number;
 url_imagen: string;
 fecha_subida: string;
 estatura_cm: number | null;
 peso_kg: number | null;
 complexion: Complexion;
}

/** DTO de simulación devuelta por el backend. */
interface SimulacionDTO {
 id_simulacion: number;
 producto_id: number;
 producto_nombre: string;
 prenda_imagen_url: string | null;
 resultado_imagen_url: string | null;
 talla_seleccionada: string;
 talla_recomendada: string;
 ajuste_estimado: AjusteEstimado;
 color_seleccionado: string | null;
 color_hex: string | null;
 precio: number | null;
 categoria: string | null;
 fecha_simulacion: string;
}

/** Envelope con total del historial. */
interface HistorialEnvelope extends ApiResponse<SimulacionDTO[]> {
 total: number;
}

@Injectable({ providedIn: 'root' })
export class ProbadorService {
 private readonly api = inject(ApiService);

 // ------------------------------------------------------------------ foto
 /** POST /probador-virtual/subir-foto — guarda la foto y deriva la complexión. */
 subirFotoUsuario(payload: SubirFotoPayload): Observable<FotoUsuario> {
 if (!payload.imagen_data_url) {
 return new Observable<FotoUsuario>((subscriber) =>
 subscriber.error({
 error: { detail: 'Seleccione una foto para subir al probador.' },
 }),
 );
 }
 return this.api
 .post<ApiResponse<FotoDTO>>('/probador-virtual/subir-foto', {
 imagen_data_url: payload.imagen_data_url,
 estatura: payload.estatura,
 peso: payload.peso,
 })
 .pipe(map((resp) => this.mapFoto(resp.data)));
 }

 /** GET /probador-virtual/fotos — fotos del usuario. */
 getFotosUsuario(): Observable<FotoUsuario[]> {
 return this.api
 .get<ApiResponse<FotoDTO[]>>('/probador-virtual/fotos')
 .pipe(map((resp) => resp.data.map((dto) => this.mapFoto(dto))));
 }

 // -------------------------------------------------------------- simulación
 /**
 * POST /probador-virtual/probar — simula la prenda sobre la foto.
 * El backend valida tallas contra el catálogo real, recomienda talla
 * según la complexión de la foto y estima el ajuste.
 */
 probarPrenda(payload: ProbarPrendaPayload): Observable<SimulacionProbador> {
 if (!payload.talla_seleccionada || !payload.color_seleccionado?.nombre) {
 return new Observable<SimulacionProbador>((subscriber) =>
 subscriber.error({
 error: { detail: 'Seleccione talla y color antes de probar la prenda.' },
 }),
 );
 }

 return this.api
 .post<ApiResponse<SimulacionDTO>>('/probador-virtual/probar', {
 foto_id: payload.foto_id,
 producto_id: payload.producto.producto_id,
 talla_seleccionada: payload.talla_seleccionada,
 color_nombre: payload.color_seleccionado.nombre,
 color_hex: payload.color_seleccionado.hex,
 })
 .pipe(map((resp) => this.mapSimulacion(resp.data)));
 }

 /** POST /probador-virtual/lookbook — guarda la prueba en Mis Lookbooks. */
 guardarEnLookbook(simulacion: SimulacionProbador): Observable<SimulacionProbador> {
 return this.api
 .post<ApiResponse<SimulacionDTO>>('/probador-virtual/lookbook', {
 id_simulacion: simulacion.id,
 })
 .pipe(map((resp) => this.mapSimulacion(resp.data)));
 }

 /** GET /probador-virtual/historial — pruebas del usuario (recientes primero). */
 getHistorialPruebas(): Observable<SimulacionProbador[]> {
 return this.api
 .get<HistorialEnvelope>('/probador-virtual/historial')
 .pipe(map((resp) => resp.data.map((dto) => this.mapSimulacion(dto))));
 }

 /** DELETE /probador-virtual/lookbook/{id} — elimina una prueba del lookbook. */
 eliminarPrueba(id: number): Observable<void> {
 return this.api.delete<ApiResponse<null>>(`/probador-virtual/lookbook/${id}`).pipe(
 map(() => undefined),
 );
 }

 // -------------------------------------------------------------- mapeo DTOs
 /** DTO backend -> modelo FotoUsuario del componente. */
 private mapFoto(dto: FotoDTO): FotoUsuario {
 const medidas: MedidasAproximadas = {
 estatura: dto.estatura_cm,
 peso: dto.peso_kg,
 complexion: dto.complexion,
 };
 return {
 id: dto.id_foto,
 url_imagen: dto.url_imagen,
 fecha_subida: dto.fecha_subida,
 medidas_aproximadas: medidas,
 };
 }

 /** DTO backend -> modelo SimulacionProbador del componente. */
 private mapSimulacion(dto: SimulacionDTO): SimulacionProbador {
 return {
 id: dto.id_simulacion,
 producto_id: dto.producto_id,
 producto_nombre: dto.producto_nombre,
 prenda_imagen_url: dto.prenda_imagen_url,
 resultado_imagen_url: dto.resultado_imagen_url,
 talla_seleccionada: dto.talla_seleccionada,
 ajuste_estimado: dto.ajuste_estimado,
 fecha_simulacion: dto.fecha_simulacion,
 talla_recomendada: dto.talla_recomendada,
 color_seleccionado: dto.color_seleccionado ?? undefined,
 color_hex: dto.color_hex ?? undefined,
 precio: dto.precio ?? undefined,
 categoria: dto.categoria ?? undefined,
 };
 }
}
