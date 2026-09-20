import {
  costo,
  esDecimalValido,
  esPositivo,
  estadoTarifa,
  formatoRango,
  formatoVigencia,
  hoyUtc,
  normalizarDecimal,
  numero,
} from './agencias.util';

describe('agencias.util (CU19)', () => {
  describe('decimales', () => {
    it('normaliza la coma decimal y recorta espacios', () => {
      expect(normalizarDecimal(' 2,5 ')).toBe('2.5');
      expect(normalizarDecimal('10')).toBe('10');
    });

    it('acepta hasta 3 decimales y 7 enteros (Numeric(10,3))', () => {
      for (const ok of ['0', '0.001', '2.5', '2,5', '9999999.999', '5.000']) {
        expect(esDecimalValido(ok), ok).toBe(true);
      }
      for (const mal of ['', ' ', 'abc', '-1', '1.2345', '10000000', '1e3', '1..2', '.5', '5.', '+3', 'NaN', 'Infinity']) {
        expect(esDecimalValido(mal), mal).toBe(false);
      }
    });

    it('costo: hasta 2 decimales y 8 enteros (Numeric(10,2))', () => {
      expect(esDecimalValido('99999999.99', 2, 8)).toBe(true);
      expect(esDecimalValido('12.345', 2, 8)).toBe(false);
      expect(esDecimalValido('100000000', 2, 8)).toBe(false);
      expect(esDecimalValido('0', 2, 8)).toBe(true); // costo 0 es válido
    });

    it('esPositivo exige > 0', () => {
      expect(esPositivo('0.001')).toBe(true);
      expect(esPositivo('2,5')).toBe(true);
      for (const mal of ['0', '0.000', '', 'x', '-2', '1.2345']) expect(esPositivo(mal), mal).toBe(false);
    });
  });

  describe('formato', () => {
    it('número sin ceros sobrantes y costo con moneda', () => {
      expect(numero(5)).toBe('5');
      expect(numero(2.5)).toBe('2.5');
      expect(numero(0.75)).toBe('0.75');
      expect(numero(null)).toBe('—');
      expect(costo(10.5)).toBe('Bs 10.50');
      expect(costo(0)).toBe('Bs 0.00');
      expect(costo(undefined)).toBe('—');
    });

    it('rango [min, max): el máximo se marca como excluido; null = en adelante', () => {
      expect(formatoRango('PESO', 0, 5)).toBe('0 a 5 kg (5 excluido)');
      expect(formatoRango('VOLUMEN', 0.5, 2)).toBe('0.5 a 2 m³ (2 excluido)');
      expect(formatoRango('PESO', 5, null)).toBe('5 kg en adelante');
    });

    it('vigencia con o sin fin', () => {
      expect(formatoVigencia('2026-01-01', '2026-12-31')).toBe('2026-01-01 → 2026-12-31');
      expect(formatoVigencia('2026-01-01', null)).toBe('Desde 2026-01-01 · sin fin');
    });

    it('hoy en UTC', () => {
      expect(hoyUtc(new Date('2026-06-15T23:30:00-04:00'))).toBe('2026-06-16'); // ya es el 16 en UTC
      expect(hoyUtc(new Date('2026-06-15T01:00:00Z'))).toBe('2026-06-15');
    });
  });

  describe('estadoTarifa', () => {
    const base = { is_active: true, vigente: true, vigente_desde: '2026-01-01', vigente_hasta: null };
    it('inactiva manda sobre todo', () => {
      expect(estadoTarifa({ ...base, is_active: false }, '2026-06-01')).toEqual({ texto: 'Inactiva', variante: 'neutral' });
    });
    it('vigente', () => {
      expect(estadoTarifa(base, '2026-06-01')).toEqual({ texto: 'Vigente', variante: 'success' });
    });
    it('futura y expirada se distinguen por la fecha de hoy', () => {
      expect(estadoTarifa({ ...base, vigente: false, vigente_desde: '2026-07-01' }, '2026-06-01').texto).toBe('Futura');
      expect(
        estadoTarifa({ ...base, vigente: false, vigente_desde: '2025-01-01', vigente_hasta: '2025-12-31' }, '2026-06-01').texto,
      ).toBe('Expirada');
    });
  });
});
