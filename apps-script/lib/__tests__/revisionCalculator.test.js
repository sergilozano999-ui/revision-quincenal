// apps-script/lib/__tests__/revisionCalculator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularNumeroRevision, calcularComparacionPeso } = require('../revisionCalculator.gs');

test('la primera revisión de un cliente es la número 1', () => {
  assert.equal(calcularNumeroRevision([]), 1);
});

test('cuenta las revisiones previas y suma una', () => {
  assert.equal(calcularNumeroRevision([{}, {}]), 3);
});

test('sin revisiones previas no hay comparación de peso', () => {
  assert.deepEqual(calcularComparacionPeso(80, []), { pesoAnterior: null, diferencia: null });
});

test('compara el peso actual con el de la última revisión', () => {
  const resultado = calcularComparacionPeso(80, [{ pesoKg: 82 }]);
  assert.deepEqual(resultado, { pesoAnterior: 82, diferencia: -2 });
});

test('redondea la diferencia a 2 decimales evitando errores de coma flotante', () => {
  const resultado = calcularComparacionPeso(80.5, [{ pesoKg: 79.2 }]);
  assert.equal(resultado.diferencia, 1.3);
});
