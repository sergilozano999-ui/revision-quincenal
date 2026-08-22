const test = require('node:test');
const assert = require('node:assert/strict');
const { construirUrlValidacion, validarCliente, enviarRevision } = require('../api.js');

test('construye la url de validación con el id codificado', () => {
  const url = construirUrlValidacion('https://ejemplo.com/exec', 'AB CD');
  assert.equal(url, 'https://ejemplo.com/exec?accion=validar&id=AB%20CD');
});

test('validarCliente devuelve el json de la respuesta cuando el fetch es ok', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'ok', nombre: 'Marta' }) });
  try {
    const resultado = await validarCliente('https://ejemplo.com/exec', 'ID1');
    assert.deepEqual(resultado, { status: 'ok', nombre: 'Marta' });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('validarCliente lanza un error cuando la respuesta http no es ok', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false });
  try {
    await assert.rejects(() => validarCliente('https://ejemplo.com/exec', 'ID1'));
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('enviarRevision resuelve cuando el backend responde status ok', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'ok', numeroRevision: 3 }) });
  try {
    const resultado = await enviarRevision('https://ejemplo.com/exec', { idCliente: 'ID1' });
    assert.deepEqual(resultado, { status: 'ok', numeroRevision: 3 });
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});

test('enviarRevision lanza un error cuando el backend responde status error', async () => {
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 'error', mensaje: 'Cliente no encontrado' }) });
  try {
    await assert.rejects(() => enviarRevision('https://ejemplo.com/exec', {}), /Cliente no encontrado/);
  } finally {
    globalThis.fetch = fetchOriginal;
  }
});
