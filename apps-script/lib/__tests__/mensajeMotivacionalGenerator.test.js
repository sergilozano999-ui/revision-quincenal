const test = require('node:test');
const assert = require('node:assert/strict');
const { generarMensajeMotivacional } = require('../mensajeMotivacionalGenerator.gs');

test('cliente que mejora visualmente y cumple casi todo', () => {
  const mensaje = generarMensajeMotivacional({
    nombre: 'Ana',
    comparacionVisual: 'Mejor',
    entrenamientosPrevistos: 10,
    entrenamientosCompletados: 9,
    diferenciaPeso: -1.2,
    grasaCorporalPct: 22.5,
  });
  assert.match(mensaje, /se nota tu progreso/);
  assert.match(mensaje, /cumplimiento excelente/);
  assert.match(mensaje, /bajado 1\.2 kg/);
  assert.match(mensaje, /22\.5%/);
});

test('cliente estancado que dice sentirse peor y cumple poco', () => {
  const mensaje = generarMensajeMotivacional({
    nombre: 'Luis',
    comparacionVisual: 'Peor',
    entrenamientosPrevistos: 8,
    entrenamientosCompletados: 3,
    diferenciaPeso: 0.5,
  });
  assert.match(mensaje, /no te preocupes por este bache/);
  assert.match(mensaje, /Vamos a ver qué se te está atravesando/);
  assert.match(mensaje, /subido 0\.5 kg/);
});

test('cliente igual sin peso previo (primera revisión) no menciona diferencia de peso', () => {
  const mensaje = generarMensajeMotivacional({
    nombre: 'Marta',
    comparacionVisual: 'Igual',
    entrenamientosPrevistos: 6,
    entrenamientosCompletados: 5,
    diferenciaPeso: null,
  });
  assert.match(mensaje, /vas manteniendo el nivel/);
  assert.doesNotMatch(mensaje, /kg desde la última revisión/);
});

test('sin datos de grasa corporal no la menciona', () => {
  const mensaje = generarMensajeMotivacional({
    nombre: 'Iker',
    comparacionVisual: 'Mejor',
    entrenamientosPrevistos: 4,
    entrenamientosCompletados: 4,
    diferenciaPeso: -0.3,
  });
  assert.doesNotMatch(mensaje, /grasa corporal/);
});

test('sin cambio de peso no menciona subida ni bajada', () => {
  const mensaje = generarMensajeMotivacional({
    nombre: 'Sofía',
    comparacionVisual: 'Igual',
    entrenamientosPrevistos: 5,
    entrenamientosCompletados: 4,
    diferenciaPeso: 0,
  });
  assert.doesNotMatch(mensaje, /kg desde la última revisión/);
});
