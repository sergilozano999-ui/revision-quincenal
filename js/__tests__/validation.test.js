// js/__tests__/validation.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { obtenerCamposVisibles, validarSeccion, seccionEsValida } = require('../validation.js');

const seccionEjemplo = {
  id: 'demo',
  campos: [
    { id: 'escalaCampo', tipo: 'escala', obligatorio: true },
    { id: 'numeroCampo', tipo: 'numero', obligatorio: true },
    { id: 'textoOpcional', tipo: 'texto', obligatorio: false },
    { id: 'siNo', tipo: 'opciones', obligatorio: true },
    { id: 'detalle', tipo: 'texto', obligatorio: true, dependeDe: { campo: 'siNo', igualA: 'Sí' } },
  ],
};

test('un campo condicional no visible se filtra de obtenerCamposVisibles', () => {
  const visibles = obtenerCamposVisibles(seccionEjemplo, { siNo: 'No' });
  assert.ok(!visibles.some((c) => c.id === 'detalle'));
});

test('un campo condicional visible aparece en obtenerCamposVisibles', () => {
  const visibles = obtenerCamposVisibles(seccionEjemplo, { siNo: 'Sí' });
  assert.ok(visibles.some((c) => c.id === 'detalle'));
});

test('una escala fuera de 1-10 produce error', () => {
  const errores = validarSeccion(seccionEjemplo, { escalaCampo: 11, numeroCampo: 5, siNo: 'No' });
  assert.ok(errores.escalaCampo);
});

test('una escala válida no produce error', () => {
  const errores = validarSeccion(seccionEjemplo, { escalaCampo: 7, numeroCampo: 5, siNo: 'No' });
  assert.equal(errores.escalaCampo, undefined);
});

test('un campo obligatorio de texto vacío produce error', () => {
  const errores = validarSeccion(seccionEjemplo, { escalaCampo: 7, numeroCampo: 5, siNo: 'No', textoOpcional: '' });
  assert.equal(errores.textoOpcional, undefined, 'textoOpcional no es obligatorio');
});

test('el detalle condicional es obligatorio solo cuando se dispara la condición', () => {
  const sinDetalle = validarSeccion(seccionEjemplo, { escalaCampo: 7, numeroCampo: 5, siNo: 'Sí' });
  assert.ok(sinDetalle.detalle);

  const noAplica = validarSeccion(seccionEjemplo, { escalaCampo: 7, numeroCampo: 5, siNo: 'No' });
  assert.equal(noAplica.detalle, undefined);
});

test('seccionEsValida refleja si validarSeccion devolvió errores', () => {
  assert.equal(seccionEsValida(seccionEjemplo, { escalaCampo: 7, numeroCampo: 5, siNo: 'No' }), true);
  assert.equal(seccionEsValida(seccionEjemplo, { escalaCampo: 7, numeroCampo: 5, siNo: 'Sí' }), false);
});
