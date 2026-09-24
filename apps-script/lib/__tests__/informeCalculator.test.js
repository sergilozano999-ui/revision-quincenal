const test = require('node:test');
const assert = require('node:assert/strict');
const { extraerIdDrive, primeraUrlFoto, seleccionarFotoAntes } = require('../informeCalculator.gs');

test('extraerIdDrive obtiene el ID de una URL típica de Drive', () => {
  const url = 'https://drive.google.com/file/d/1AbC-XyZ_123/view?usp=drivesdk';
  assert.equal(extraerIdDrive(url), '1AbC-XyZ_123');
});

test('extraerIdDrive devuelve null si la URL no tiene el patrón esperado', () => {
  assert.equal(extraerIdDrive('https://ejemplo.com/foto.jpg'), null);
});

test('extraerIdDrive devuelve null si no hay URL', () => {
  assert.equal(extraerIdDrive(''), null);
  assert.equal(extraerIdDrive(null), null);
});

test('primeraUrlFoto se queda con la primera si hay varias separadas por coma', () => {
  assert.equal(primeraUrlFoto('https://a, https://b'), 'https://a');
});

test('primeraUrlFoto devuelve cadena vacía si no hay valor', () => {
  assert.equal(primeraUrlFoto(''), '');
  assert.equal(primeraUrlFoto(undefined), '');
});

test('seleccionarFotoAntes prioriza la foto manual del entrenador si existe', () => {
  const resultado = seleccionarFotoAntes({
    fotoAntesManualUrl: 'https://manual',
    filasPrevias: [{ urlFrente: 'https://primera-revision' }],
    fotoActualUrl: 'https://actual',
  });
  assert.equal(resultado, 'https://manual');
});

test('seleccionarFotoAntes usa la foto de la revisión más antigua si no hay manual', () => {
  const resultado = seleccionarFotoAntes({
    fotoAntesManualUrl: '',
    filasPrevias: [
      { urlFrente: 'https://revision-1' },
      { urlFrente: 'https://revision-2' },
    ],
    fotoActualUrl: 'https://actual',
  });
  assert.equal(resultado, 'https://revision-1');
});

test('seleccionarFotoAntes salta revisiones antiguas sin foto hasta encontrar una', () => {
  const resultado = seleccionarFotoAntes({
    fotoAntesManualUrl: '',
    filasPrevias: [
      { urlFrente: '' },
      { urlFrente: 'https://revision-2' },
    ],
    fotoActualUrl: 'https://actual',
  });
  assert.equal(resultado, 'https://revision-2');
});

test('seleccionarFotoAntes usa la foto actual si es la primera revisión del cliente', () => {
  const resultado = seleccionarFotoAntes({
    fotoAntesManualUrl: '',
    filasPrevias: [],
    fotoActualUrl: 'https://actual',
  });
  assert.equal(resultado, 'https://actual');
});
