import { CRITERIO_UNIDAD, CriterioTarifa, Tarifa } from '../../core/models/agencia.model';

/**
 * Utilidades puras de (agencias de reparto): formato de rangos/vigencias,
 * estado visible de una tarifa y validación de decimales. Sin dependencias de
 * Angular, para poder probarlas directamente.
 */

/** Variante de `app-badge` (shared). */
export type VarianteBadge = 'success' | 'info' | 'danger' | 'warning' | 'neutral' | 'accent';

/** Recorta y acepta coma decimal ("2,5" → "2.5"). */
export function normalizarDecimal(texto: string): string {
 return (texto ?? '').trim().replace(',', '.');
}

/**
 * ¿Es un decimal válido para el backend? Sin signo, con hasta `maxDecimales`
 * decimales y `maxEnteros` dígitos enteros (Numeric(10,3) → 7 y 3; costo
 * Numeric(10,2) → 8 y 2). No exige que sea > 0: eso lo decide cada campo.
 */
export function esDecimalValido(texto: string, maxDecimales = 3, maxEnteros = 7): boolean {
 const t = normalizarDecimal(texto);
 const re = new RegExp(`^\\d{1,${maxEnteros}}(\\.\\d{1,${maxDecimales}})?$`);
 return re.test(t);
}

/** Decimal válido y estrictamente mayor que cero (peso/volumen del envío). */
export function esPositivo(texto: string, maxDecimales = 3, maxEnteros = 7): boolean {
 return esDecimalValido(texto, maxDecimales, maxEnteros) && Number(normalizarDecimal(texto)) > 0;
}

/** Número sin ceros sobrantes: 5 → "5", 2.5 → "2.5", 0.75 → "0.75". */
export function numero(n: number | null | undefined): string {
 if (n === null || n === undefined) return '—';
 return String(Number(n));
}

/** Costo con 2 decimales y moneda: 10.5 → "Bs 10.50". */
export function costo(n: number | null | undefined): string {
 if (n === null || n === undefined) return '—';
 return `Bs ${Number(n).toFixed(2)}`;
}

/**
 * Rango [min, max): el mínimo se incluye y el máximo no.
 * "0 a 5 kg (5 excluido)" · "5 kg en adelante".
 */
export function formatoRango(
 criterio: CriterioTarifa,
 min: number,
 max: number | null,
): string {
 const u = CRITERIO_UNIDAD[criterio];
 return max === null
 ? `${numero(min)} ${u} en adelante`
 : `${numero(min)} a ${numero(max)} ${u} (${numero(max)} excluido)`;
}

/** Vigencia [desde, hasta]: ambas fechas incluidas; hasta = null → sin fin. */
export function formatoVigencia(desde: string, hasta: string | null): string {
 return hasta === null ? `Desde ${desde} · sin fin` : `${desde} → ${hasta}`;
}

/** Fecha de hoy en UTC (YYYY-MM-DD), la misma que usa el backend para la vigencia. */
export function hoyUtc(ahora: Date = new Date()): string {
 return ahora.toISOString().slice(0, 10);
}

/**
 * Estado visible de una tarifa. Se calcula con la fecha de hoy (UTC) además del
 * flag `vigente` que envía el backend, para distinguir "Futura" de "Expirada".
 */
export function estadoTarifa(
 t: Pick<Tarifa, 'is_active' | 'vigente' | 'vigente_desde' | 'vigente_hasta'>,
 hoy: string = hoyUtc(),
): { texto: string; variante: VarianteBadge } {
 if (!t.is_active) return { texto: 'Inactiva', variante: 'neutral' };
 if (t.vigente) return { texto: 'Vigente', variante: 'success' };
 if (t.vigente_desde > hoy) return { texto: 'Futura', variante: 'info' };
 return { texto: 'Expirada', variante: 'warning' };
}
