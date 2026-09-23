// apps-script/lib/__tests__/grasaCorporalCalculator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularGrasaCorporal } = require('../grasaCorporalCalculator.gs');

function cercaDe(valor, esperado, tolerancia) {
  assert.ok(Math.abs(valor - esperado) <= tolerancia, `${valor} no está cerca de ${esperado}`);
}

test('hombre: calcula un porcentaje de grasa corporal plausible', () => {
  const resultado = calcularGrasaCorporal('Hombre', 180, 38, 85, null);
  cercaDe(resultado, 16.1, 0.5);
});

test('mujer: calcula un porcentaje de grasa corporal plausible', () => {
  const resultado = calcularGrasaCorporal('Mujer', 165, 32, 75, 98);
  cercaDe(resultado, 28.9, 0.5);
});

test('mujer sin medida de cadera: no se puede calcular', () => {
  assert.equal(calcularGrasaCorporal('Mujer', 165, 32, 75, null), null);
});

test('sin altura: no se puede calcular', () => {
  assert.equal(calcularGrasaCorporal('Hombre', null, 38, 85, null), null);
});

test('sin cuello ni cintura: no se puede calcular', () => {
  assert.equal(calcularGrasaCorporal('Hombre', 180, null, null, null), null);
});

test('cintura menor o igual que cuello (medida imposible): no se puede calcular', () => {
  assert.equal(calcularGrasaCorporal('Hombre', 180, 40, 38, null), null);
});
