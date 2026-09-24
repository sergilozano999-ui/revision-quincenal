const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generarMensajeInforme,
  APERTURAS_INFORME,
  CIERRES_INFORME,
} = require('../mensajeInformeGenerator.gs');

test('combina siempre la primera apertura y el primer cierre con el selector fijo en 0', () => {
  const mensaje = generarMensajeInforme({ nombre: 'Ana' }, () => 0);
  assert.equal(mensaje, 'Ana, ' + APERTURAS_INFORME[0] + ' ' + CIERRES_INFORME[0]);
});

test('combina la última apertura y el último cierre con el selector fijo en longitud-1', () => {
  const mensaje = generarMensajeInforme({ nombre: 'Luis' }, (longitud) => longitud - 1);
  assert.equal(
    mensaje,
    'Luis, ' + APERTURAS_INFORME[APERTURAS_INFORME.length - 1] + ' ' + CIERRES_INFORME[CIERRES_INFORME.length - 1]
  );
});

test('el mensaje incluye el nombre del cliente', () => {
  const mensaje = generarMensajeInforme({ nombre: 'Marta' }, () => 0);
  assert.match(mensaje, /^Marta,/);
});

test('el mensaje nunca menciona cifras (para no generar ansiedad al leerlo)', () => {
  for (let i = 0; i < APERTURAS_INFORME.length; i++) {
    for (let j = 0; j < CIERRES_INFORME.length; j++) {
      const selector = (function (aperturaIdx, cierreIdx) {
        let llamada = 0;
        return () => (llamada++ === 0 ? aperturaIdx : cierreIdx);
      })(i, j);
      const mensaje = generarMensajeInforme({ nombre: 'Iker' }, selector);
      assert.doesNotMatch(mensaje, /[0-9]/);
    }
  }
});

test('sin selector (aleatorio real) produce un mensaje válido con el nombre', () => {
  const mensaje = generarMensajeInforme({ nombre: 'Sofía' });
  assert.match(mensaje, /^Sofía,/);
});
