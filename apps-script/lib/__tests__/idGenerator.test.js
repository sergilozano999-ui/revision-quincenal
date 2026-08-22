const test = require('node:test');
const assert = require('node:assert/strict');
const { generarIdUnico, ID_CHARS, ID_LENGTH } = require('../idGenerator.gs');

test('genera un id del tamaño y alfabeto esperados cuando no hay colisiones', () => {
  const id = generarIdUnico([]);
  assert.equal(id.length, ID_LENGTH);
  for (const char of id) {
    assert.ok(ID_CHARS.includes(char), `carácter inesperado: ${char}`);
  }
});

test('reintenta cuando el generador produce un id ya existente', () => {
  const candidatos = ['AAAAAAAA', 'BBBBBBBB'];
  let indice = 0;
  const generadorFalso = () => candidatos[indice++];
  const id = generarIdUnico(['AAAAAAAA'], generadorFalso);
  assert.equal(id, 'BBBBBBBB');
});

test('lanza un error si no encuentra un id libre tras 100 intentos', () => {
  const generadorSiempreColisiona = () => 'AAAAAAAA';
  assert.throws(
    () => generarIdUnico(['AAAAAAAA'], generadorSiempreColisiona),
    /No se pudo generar un ID único/
  );
});
