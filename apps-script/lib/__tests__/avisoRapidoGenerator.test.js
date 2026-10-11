const test = require('node:test');
const assert = require('node:assert/strict');
const { construirAvisoRapido } = require('../avisoRapidoGenerator.gs');

function datosBase(sobrescribir) {
  return Object.assign({
    nombre: 'Marta',
    pesoKg: 68.5,
    diferenciaPeso: -0.8,
    grasaCorporalPct: 24.1,
    fotosFrente: 'https://drive.google.com/frente',
    fotosPerfil: 'https://drive.google.com/perfil',
    fotosEspalda: '',
  }, sobrescribir || {});
}

test('el asunto incluye el nombre del cliente', () => {
  const resultado = construirAvisoRapido(datosBase());
  assert.match(resultado.asunto, /Marta/);
});

test('el cuerpo incluye el peso', () => {
  const resultado = construirAvisoRapido(datosBase());
  assert.match(resultado.cuerpo, /68\.5 kg/);
});

test('el cuerpo describe una bajada de peso', () => {
  const resultado = construirAvisoRapido(datosBase({ diferenciaPeso: -0.8 }));
  assert.match(resultado.cuerpo, /bajado 0\.8 kg/);
});

test('el cuerpo describe una subida de peso', () => {
  const resultado = construirAvisoRapido(datosBase({ diferenciaPeso: 1.2 }));
  assert.match(resultado.cuerpo, /subido 1\.2 kg/);
});

test('el cuerpo no menciona diferencia cuando no hay revisión previa', () => {
  const resultado = construirAvisoRapido(datosBase({ diferenciaPeso: null }));
  assert.ok(!/bajado|subido/.test(resultado.cuerpo));
});

test('el cuerpo incluye el % de grasa corporal cuando es un número', () => {
  const resultado = construirAvisoRapido(datosBase({ grasaCorporalPct: 24.1 }));
  assert.match(resultado.cuerpo, /24\.1%/);
});

test('el cuerpo no menciona grasa corporal cuando es null', () => {
  const resultado = construirAvisoRapido(datosBase({ grasaCorporalPct: null }));
  assert.ok(!/grasa corporal/.test(resultado.cuerpo));
});

test('el cuerpo lista las fotos recibidas', () => {
  const resultado = construirAvisoRapido(datosBase());
  assert.match(resultado.cuerpo, /https:\/\/drive\.google\.com\/frente/);
  assert.match(resultado.cuerpo, /https:\/\/drive\.google\.com\/perfil/);
});

test('el cuerpo avisa si no se subió ninguna foto', () => {
  const resultado = construirAvisoRapido(datosBase({ fotosFrente: '', fotosPerfil: '', fotosEspalda: '' }));
  assert.match(resultado.cuerpo, /No ha subido fotos/);
});
