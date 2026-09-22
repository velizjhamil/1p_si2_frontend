import type { ChartConfiguration } from 'chart.js';

/**
 * Configuraciones de Chart.js de los reportes.
 *
 * SOLO presentación: cada función recibe las series ya calculadas por el
 * backend (etiquetas + valores) y arma la configuración del gráfico. No se
 * suma, promedia ni recalcula nada aquí. `import type` evita cargar Chart.js
 * en el servidor (SSR/prerender); el componente lo importa dinámicamente en
 * el navegador.
 */
export type ConfigGrafico = ChartConfiguration;

/** Paleta Attention (primary #1E4D8C) + acentos de la guía de estilo. */
export const PALETA = ['#1e4d8c', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#64748b'];

export const COLOR_NIVEL_STOCK: Record<string, string> = {
 CRITICO: '#f43f5e',
 BAJO: '#f59e0b',
 OK: '#10b981',
};

export const COLOR_ESTADO_DEVOLUCION: Record<string, string> = {
 SOLICITADA: '#0ea5e9',
 APROBADA: '#f59e0b',
 COMPLETADA: '#10b981',
 RECHAZADA: '#f43f5e',
};

/** Solo formato de texto (2 decimales); no es un cálculo de negocio. */
const bs = (n: number): string => `Bs. ${n.toFixed(2)}`;

interface OpcionesSerie {
 /** true: el valor es un importe (tooltip y eje con "Bs."). */
 moneda?: boolean;
}

function tooltipValor(moneda: boolean) {
 return {
 callbacks: {
 label: (ctx: { dataset: { label?: string }; parsed: number | { x: number; y: number } }) => {
 const p = ctx.parsed;
 const valor = typeof p === 'number' ? p : (p.y ?? p.x);
 return `${ctx.dataset.label ?? ''}: ${moneda ? bs(valor) : valor}`;
 },
 },
 };
}

/** Línea temporal (p. ej. ingresos por día). */
export function configLinea(
 etiquetas: string[],
 valores: number[],
 nombre: string,
 { moneda = false }: OpcionesSerie = {},
): ConfigGrafico {
 return {
 type: 'line',
 data: {
 labels: etiquetas,
 datasets: [
 {
 label: nombre,
 data: valores,
 borderColor: PALETA[0],
 backgroundColor: 'rgba(30, 77, 140, 0.12)',
 fill: true,
 tension: 0.25,
 pointRadius: valores.length > 45 ? 0 : 3,
 },
 ],
 },
 options: {
 plugins: { legend: { display: false }, tooltip: tooltipValor(moneda) as never },
 scales: { x: { ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: true } },
 },
 };
}

/** Barras verticales u horizontales (`horizontal`). */
export function configBarras(
 etiquetas: string[],
 valores: number[],
 nombre: string,
 { moneda = false, horizontal = false }: OpcionesSerie & { horizontal?: boolean } = {},
 colores?: string[],
): ConfigGrafico {
 return {
 type: 'bar',
 data: {
 labels: etiquetas,
 datasets: [
 {
 label: nombre,
 data: valores,
 backgroundColor: colores ?? PALETA[0],
 borderRadius: 4,
 },
 ],
 },
 options: {
 indexAxis: horizontal ? 'y' : 'x',
 plugins: { legend: { display: false }, tooltip: tooltipValor(moneda) as never },
 scales: horizontal ? { x: { beginAtZero: true } } : { x: { ticks: { maxTicksLimit: 12 } }, y: { beginAtZero: true } },
 },
 };
}

/** Dona (distribución por canal, método de pago, nivel de stock o estado). */
export function configDona(
 etiquetas: string[],
 valores: number[],
 nombre: string,
 colores: string[],
 { moneda = false }: OpcionesSerie = {},
): ConfigGrafico {
 return {
 type: 'doughnut',
 data: {
 labels: etiquetas,
 datasets: [{ label: nombre, data: valores, backgroundColor: colores, borderWidth: 1 }],
 },
 options: {
 plugins: {
 legend: { position: 'bottom' },
 tooltip: {
 callbacks: {
 label: (ctx: { label: string; parsed: number }) =>
 `${ctx.label}: ${moneda ? bs(ctx.parsed) : ctx.parsed}`,
 },
 } as never,
 },
 },
 };
}
