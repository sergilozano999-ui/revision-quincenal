// apps-script/lib/__tests__/recordatorioCalculator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { esRevisionManana } = require('../recordatorioCalculator.gs');

test('la próxima revisión es mañana', () => {
  const hoy = new Date(2026, 8, 9);
  const manana = new Date(2026, 8, 10);
  assert.equal(esRevisionManana(manana, hoy), true);
});

test('la próxima revisión es hoy, no mañana', () => {
  const hoy = new Date(2026, 8, 9);
  assert.equal(esRevisionManana(hoy, hoy), false);
});

test('la próxima revisión es dentro de varios días', () => {
  const hoy = new Date(2026, 8, 9);
  const enUnaSemana = new Date(2026, 8, 16);
  assert.equal(esRevisionManana(enUnaSemana, hoy), false);
});

test('sin fecha de próxima revisión no hay recordatorio', () => {
  const hoy = new Date(2026, 8, 9);
  assert.equal(esRevisionManana('', hoy), false);
  assert.equal(esRevisionManana(null, hoy), false);
});

test('ignora la hora del día, solo compara la fecha', () => {
  const hoy = new Date(2026, 8, 9, 23, 59);
  const manana = new Date(2026, 8, 10, 0, 1);
  assert.equal(esRevisionManana(manana, hoy), true);
});
