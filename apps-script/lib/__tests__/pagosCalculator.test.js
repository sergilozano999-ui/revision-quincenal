// apps-script/lib/__tests__/pagosCalculator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { faltanDiasParaPago, calcularSiguienteFechaPago } = require('../pagosCalculator.gs');

test('faltan exactamente 5 días para el próximo pago', () => {
  const hoy = new Date(2026, 8, 9);
  const enCincoDias = new Date(2026, 8, 14);
  assert.equal(faltanDiasParaPago(enCincoDias, hoy, 5), true);
});

test('el próximo pago es hoy, no en 5 días', () => {
  const hoy = new Date(2026, 8, 9);
  assert.equal(faltanDiasParaPago(hoy, hoy, 5), false);
});

test('el próximo pago está a más de 5 días', () => {
  const hoy = new Date(2026, 8, 9);
  const enUnaSemana = new Date(2026, 8, 16);
  assert.equal(faltanDiasParaPago(enUnaSemana, hoy, 5), false);
});

test('sin fecha de próximo pago no hay aviso', () => {
  const hoy = new Date(2026, 8, 9);
  assert.equal(faltanDiasParaPago('', hoy, 5), false);
  assert.equal(faltanDiasParaPago(null, hoy, 5), false);
});

test('ignora la hora del día, solo compara la fecha', () => {
  const hoy = new Date(2026, 8, 9, 23, 59);
  const enCincoDias = new Date(2026, 8, 14, 0, 1);
  assert.equal(faltanDiasParaPago(enCincoDias, hoy, 5), true);
});

test('calcula la siguiente fecha de pago sumando 3 meses', () => {
  const fecha = new Date(2026, 8, 14);
  const siguiente = calcularSiguienteFechaPago(fecha);
  assert.equal(siguiente.getFullYear(), 2026);
  assert.equal(siguiente.getMonth(), 11);
  assert.equal(siguiente.getDate(), 14);
});

test('calcular la siguiente fecha de pago cruza el año', () => {
  const fecha = new Date(2026, 10, 20);
  const siguiente = calcularSiguienteFechaPago(fecha);
  assert.equal(siguiente.getFullYear(), 2027);
  assert.equal(siguiente.getMonth(), 1);
  assert.equal(siguiente.getDate(), 20);
});
