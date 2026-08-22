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

test('dependeDe siempre apunta a un id de campo existente', () => {
  const todosLosIds = new Set(SECTIONS.flatMap((s) => s.campos.map((c) => c.id)));
  for (const seccion of SECTIONS) {
    for (const campo of seccion.campos) {
      if (campo.dependeDe) {
        assert.ok(todosLosIds.has(campo.dependeDe.campo));
      }
    }
  }
});

test('el número total de campos visibles por defecto ronda el máximo acordado (~26)', () => {
  const total = SECTIONS.flatMap((s) => s.campos).filter((c) => !c.dependeDe).length;
  assert.ok(total >= 24 && total <= 28, `total inesperado: ${total}`);
});
