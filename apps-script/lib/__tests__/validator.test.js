const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPayload } = require('../validator.gs');

function payloadValido(sobrescribir) {
  return Object.assign({
    idCliente: 'ABC12345',
    pesoKg: 80,
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

test('un payload completo es válido', () => {
  const resultado = validarPayload(payloadValido());
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
});

test('rechaza un payload vacío o inválido', () => {
  assert.equal(validarPayload(null).valido, false);
  assert.equal(validarPayload(undefined).valido, false);
});

test('reporta cada campo obligatorio ausente', () => {
  const resultado = validarPayload(payloadValido({ pesoKg: undefined }));
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('pesoKg')));
});

test('exige el detalle de molestias cuando molestias es Sí', () => {
  const resultado = validarPayload(payloadValido({ molestias: 'Sí' }));
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('detalle de las molestias')));
});

test('no exige detalle de molestias cuando molestias es No', () => {
  const resultado = validarPayload(payloadValido({ molestias: 'No' }));
  assert.equal(resultado.valido, true);
});

test('acepta el detalle de molestias cuando molestias es Sí y viene relleno', () => {
  const resultado = validarPayload(payloadValido({ molestias: 'Sí', detalleMolestias: 'Dolor de rodilla leve' }));
  assert.equal(resultado.valido, true);
});
