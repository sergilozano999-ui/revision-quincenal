const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPayload } = require('../validator.gs');

function payloadParte1Valido(sobrescribir) {
  return Object.assign({
    idCliente: 'ABC12345',
    pesoKg: 80,
    cuelloCm: 38,
    cinturaCm: 85,
  }, sobrescribir || {});
}

function payloadParte2Valido(sobrescribir) {
  return Object.assign({
    idCliente: 'ABC12345',
    valoracionProgresoFisico: 8,
    comparacionVisual: 'Mejor',
    entrenamientosPrevistos: 6,
    entrenamientosCompletados: 5,
    valoracionEntrenamiento: 7,
    progresoRendimiento: 'Sí',
    molestias: 'No',
    cumplimientoNutricion: 8,
    nivelHambre: 5,
    dificultadPrincipal: 'Fines de semana',
    pasosDiarios: 8000,
    objetivoPasosCumplido: 'Sí',
    calidadSueno: 7,
    horasSueno: 7.5,
    nivelEnergia: 6,
    nivelEstres: 4,
  }, sobrescribir || {});
}

test('un payload de parte 1 completo es válido', () => {
  const resultado = validarPayload(payloadParte1Valido(), 1);
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
});

test('rechaza un payload vacío o inválido en cualquier parte', () => {
  assert.equal(validarPayload(null, 1).valido, false);
  assert.equal(validarPayload(undefined, 2).valido, false);
});

test('parte 1 reporta cada campo obligatorio ausente', () => {
  const resultado = validarPayload(payloadParte1Valido({ pesoKg: undefined }), 1);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('pesoKg')));
});

test('parte 1 no exige ningún campo de la parte 2', () => {
  const resultado = validarPayload(payloadParte1Valido(), 1);
  assert.equal(resultado.valido, true);
});

test('un payload de parte 2 completo es válido', () => {
  const resultado = validarPayload(payloadParte2Valido(), 2);
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
});

test('parte 2 reporta cada campo obligatorio ausente', () => {
  const resultado = validarPayload(payloadParte2Valido({ cumplimientoNutricion: undefined }), 2);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('cumplimientoNutricion')));
});

test('parte 2 no exige ningún campo exclusivo de la parte 1', () => {
  const resultado = validarPayload(payloadParte2Valido(), 2);
  assert.equal(resultado.valido, true);
  assert.ok(!resultado.errores.some((e) => e.includes('pesoKg')));
});

test('parte 2 exige el detalle de molestias cuando molestias es Sí', () => {
  const resultado = validarPayload(payloadParte2Valido({ molestias: 'Sí' }), 2);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('detalle de las molestias')));
});

test('parte 2 no exige detalle de molestias cuando molestias es No', () => {
  const resultado = validarPayload(payloadParte2Valido({ molestias: 'No' }), 2);
  assert.equal(resultado.valido, true);
});

test('parte 2 acepta el detalle de molestias cuando molestias es Sí y viene relleno', () => {
  const resultado = validarPayload(
    payloadParte2Valido({ molestias: 'Sí', detalleMolestias: 'Dolor de rodilla leve' }), 2
  );
  assert.equal(resultado.valido, true);
});
