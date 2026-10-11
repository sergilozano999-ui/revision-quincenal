const test = require('node:test');
const assert = require('node:assert/strict');
const { SECTIONS } = require('../questions.js');

test('hay exactamente 6 secciones', () => {
  assert.equal(SECTIONS.length, 6);
});

test('cada campo tiene id, tipo, etiqueta y obligatorio definidos', () => {
  for (const seccion of SECTIONS) {
    for (const campo of seccion.campos) {
      assert.equal(typeof campo.id, 'string');
      assert.ok(['numero', 'escala', 'opciones', 'foto', 'texto'].includes(campo.tipo));
      assert.equal(typeof campo.etiqueta, 'string');
      assert.equal(typeof campo.obligatorio, 'boolean');
    }
  }
});

test('todos los ids de campo son únicos en todo el cuestionario', () => {
  const ids = SECTIONS.flatMap((s) => s.campos.map((c) => c.id));
  assert.equal(ids.length, new Set(ids).size);
});

test('los campos de tipo opciones declaran al menos 2 opciones', () => {
  for (const seccion of SECTIONS) {
    for (const campo of seccion.campos) {
      if (campo.tipo === 'opciones') {
        assert.ok(Array.isArray(campo.opciones) && campo.opciones.length >= 2);
      }
    }
  }
});

// 'sexo' no es un campo del cuestionario: app.js lo inyecta en estado.respuestas
// a partir del perfil del cliente (endpoint /validar), para mostrar/ocultar
// caderaCm sin que el cliente tenga que responderlo cada vez.
const IDS_EXTERNOS = new Set(['sexo']);

test('dependeDe siempre apunta a un id de campo existente o a un id externo conocido', () => {
  const todosLosIds = new Set(SECTIONS.flatMap((s) => s.campos.map((c) => c.id)));
  for (const seccion of SECTIONS) {
    for (const campo of seccion.campos) {
      if (campo.dependeDe) {
        assert.ok(todosLosIds.has(campo.dependeDe.campo) || IDS_EXTERNOS.has(campo.dependeDe.campo));
      }
    }
  }
});

test('el número total de campos visibles por defecto ronda el máximo acordado (~30, incluye medidas de grasa corporal)', () => {
  const total = SECTIONS.flatMap((s) => s.campos).filter((c) => !c.dependeDe).length;
  assert.ok(total >= 24 && total <= 30, `total inesperado: ${total}`);
});

const { SECTIONS: SECTIONS_DE_NUEVO, SECTIONS_PARTE1, SECTIONS_PARTE2 } = require('../questions.js');

const CAMPOS_PARTE1_ESPERADOS = ['pesoKg', 'cuelloCm', 'cinturaCm', 'caderaCm', 'fotosFrente', 'fotosPerfil', 'fotosEspalda'];

test('SECTIONS_PARTE1 tiene una sola sección con solo peso, medidas y fotos', () => {
  assert.equal(SECTIONS_PARTE1.length, 1);
  const idsParte1 = SECTIONS_PARTE1[0].campos.map((c) => c.id);
  assert.deepEqual(idsParte1.slice().sort(), CAMPOS_PARTE1_ESPERADOS.slice().sort());
});

test('SECTIONS_PARTE2 tiene 6 secciones, la primera con las 3 preguntas de opinión que quedan de "progreso físico"', () => {
  assert.equal(SECTIONS_PARTE2.length, 6);
  const idsPrimeraSeccion = SECTIONS_PARTE2[0].campos.map((c) => c.id);
  assert.deepEqual(
    idsPrimeraSeccion.slice().sort(),
    ['valoracionProgresoFisico', 'comparacionVisual', 'comentarioProgresoFisico'].slice().sort()
  );
});

test('SECTIONS_PARTE2 conserva sin cambios las 5 secciones que no son "progreso físico"', () => {
  const seccionesOriginalesRestantes = SECTIONS_DE_NUEVO.filter((s) => s.id !== 'progreso_fisico');
  const seccionesParte2Restantes = SECTIONS_PARTE2.slice(1);
  assert.deepEqual(seccionesParte2Restantes, seccionesOriginalesRestantes);
});

test('entre SECTIONS_PARTE1 y SECTIONS_PARTE2 se reparten todos los campos de "progreso físico" sin solapamiento ni pérdida', () => {
  const seccionOriginal = SECTIONS_DE_NUEVO.filter((s) => s.id === 'progreso_fisico')[0];
  const idsOriginales = seccionOriginal.campos.map((c) => c.id).slice().sort();

  const idsParte1 = SECTIONS_PARTE1[0].campos.map((c) => c.id);
  const idsParte2 = SECTIONS_PARTE2[0].campos.map((c) => c.id);
  const solapados = idsParte1.filter((id) => idsParte2.includes(id));
  assert.deepEqual(solapados, []);

  const union = idsParte1.concat(idsParte2).sort();
  assert.deepEqual(union, idsOriginales);
});
