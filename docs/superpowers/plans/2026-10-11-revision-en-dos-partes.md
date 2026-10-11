# Revisión en dos partes (rápida + preguntas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the biweekly client questionnaire into two independent submissions on the same personal link — Part 1 (weight, measurements, photos) and Part 2 (opinion/training/nutrition/activity/feedback questions) — so the trainer gets weight/measurements/photos immediately, without changing the "Respuestas" sheet schema or the "Clientes" formulas.

**Architecture:** Same static-frontend + Apps-Script-backend split as today. A new "RespuestasPendientes" sheet holds at most one row per client between Part 1 and Part 2. `doGet` tells the frontend which part to render; `doPost` branches on a new `parte` field. Part 2 merges the pending row with its own payload and does the exact same `appendRow` to "Respuestas" that exists today, so nothing downstream (Clientes formulas, reminders) needs to change.

**Tech Stack:** Vanilla JS (frontend, GitHub Pages), Google Apps Script (backend, bound to the live Google Sheet), `node --test` for the pure-function unit tests (both frontend `js/` and backend `apps-script/lib/`).

**Spec:** `docs/superpowers/specs/2026-10-11-revision-en-dos-partes-design.md`

## Global Constraints

- Single personal link per client (`?id=idCliente`) — no new links to manage.
- The "Respuestas" sheet schema (36 columns, same order) does not change.
- The "Clientes" sheet formulas (Última_Revisión, Próxima_Revisión, Nº_Revisiones) are not touched.
- Column B of "Respuestas" (the date the Última_Revisión formula aggregates on) must hold the Part 1 date, not the Part 2 date.
- `RecordatorioService.gs`'s daily reminder is not touched — it already points at the same single link.
- Deletions from "RespuestasPendientes" must use `clearContent()`, never "delete row" (see project memory on the 2026-09-07 ARRAYFORMULA incident — applies house-wide, not just to Clientes).
- Test command for both `js/` and `apps-script/lib/`: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js` (run from the repo root). 69 tests pass on the current baseline — treat any drop below that as a regression.

## Review Focus

- Part 2 submitted with no Part 1 pending for that client (old bookmark, pending row cleared by hand) must return a readable error — not a broken `numeroRevision` or a half-filled "Respuestas" row. Owned by Task 5, verified live by Task 7's diagnostic.
- `molestias === 'Sí'` without `detalleMolestias` in the Part 2 payload must still block the submission — the conditional check moves inside the `parte === 2` branch of `validarPayload` and must not get lost in the split. Owned by Task 1, unit-tested.
- Resubmitting Part 1 the same day (client retakes photos before finishing Part 2) must overwrite the existing pending row, never create a second one. Owned by Task 4, verified live by Task 7's diagnostic.
- Column B of the appended "Respuestas" row must carry the Part 1 date, not `new Date()` at Part 2 time — getting this backwards silently desyncs `Próxima_Revisión` from the actual check-in date. Owned by Task 5, verified live by Task 7's diagnostic.
- `SECTIONS_PARTE1`/`SECTIONS_PARTE2` must partition "progreso_fisico"'s fields with no overlap and no gap — a field in both or in neither means a client sees a duplicated question or is missing one. Owned by Task 3, unit-tested.

---

### Task 1: Split `validarPayload` into Part 1 / Part 2

**Files:**
- Modify: `apps-script/lib/validator.gs`
- Test: `apps-script/lib/__tests__/validator.test.js`

**Interfaces:**
- Produces: `validarPayload(payload, parte)` — `parte` is `1` or `2`; returns `{ valido: boolean, errores: string[] }` same shape as today.
- Produces: `CAMPOS_OBLIGATORIOS_PARTE1`, `CAMPOS_OBLIGATORIOS_PARTE2` (arrays of field-name strings), exported for Task 5 to reference if needed.

- [ ] **Step 1: Write the failing tests**

Replace the whole file `apps-script/lib/__tests__/validator.test.js` with:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPayload } = require('../validator.gs');

function payloadParte1Valido(sobrescribir) {
  return Object.assign({
    idCliente: 'ABC12345',
    pesoKg: 80,
    cuelloCm: 38,
    cinturaCm: 85,
  }, sobrescribir || {});
}

function payloadParte2Valido(sobrescribir) {
  return Object.assign({
    idCliente: 'ABC12345',
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

test('un payload de parte 1 completo es válido', () => {
  const resultado = validarPayload(payloadParte1Valido(), 1);
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
});

test('rechaza un payload vacío o inválido en cualquier parte', () => {
  assert.equal(validarPayload(null, 1).valido, false);
  assert.equal(validarPayload(undefined, 2).valido, false);
});

test('parte 1 reporta cada campo obligatorio ausente', () => {
  const resultado = validarPayload(payloadParte1Valido({ pesoKg: undefined }), 1);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('pesoKg')));
});

test('parte 1 no exige ningún campo de la parte 2', () => {
  const resultado = validarPayload(payloadParte1Valido(), 1);
  assert.equal(resultado.valido, true);
});

test('un payload de parte 2 completo es válido', () => {
  const resultado = validarPayload(payloadParte2Valido(), 2);
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
});

test('parte 2 reporta cada campo obligatorio ausente', () => {
  const resultado = validarPayload(payloadParte2Valido({ cumplimientoNutricion: undefined }), 2);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('cumplimientoNutricion')));
});

test('parte 2 no exige ningún campo exclusivo de la parte 1', () => {
  const resultado = validarPayload(payloadParte2Valido(), 2);
  assert.equal(resultado.valido, true);
  assert.ok(!resultado.errores.some((e) => e.includes('pesoKg')));
});

test('parte 2 exige el detalle de molestias cuando molestias es Sí', () => {
  const resultado = validarPayload(payloadParte2Valido({ molestias: 'Sí' }), 2);
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('detalle de las molestias')));
});

test('parte 2 no exige detalle de molestias cuando molestias es No', () => {
  const resultado = validarPayload(payloadParte2Valido({ molestias: 'No' }), 2);
  assert.equal(resultado.valido, true);
});

test('parte 2 acepta el detalle de molestias cuando molestias es Sí y viene relleno', () => {
  const resultado = validarPayload(
    payloadParte2Valido({ molestias: 'Sí', detalleMolestias: 'Dolor de rodilla leve' }), 2
  );
  assert.equal(resultado.valido, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps-script/lib/__tests__/validator.test.js`
Expected: FAIL — `validarPayload` still takes only one argument and uses the old single `CAMPOS_OBLIGATORIOS` list, so parte-1-only payloads fail on missing parte-2 fields.

- [ ] **Step 3: Write the implementation**

Replace the whole file `apps-script/lib/validator.gs` with:

```js
// Duplicado deliberadamente de questions.js (Task 9 original): frontend y
// backend son dos runtimes separados sin build compartido, así que la
// lista de campos obligatorios vive una vez en cada lado.
var CAMPOS_OBLIGATORIOS_PARTE1 = ['idCliente', 'pesoKg', 'cuelloCm', 'cinturaCm'];
var CAMPOS_OBLIGATORIOS_PARTE2 = [
  'idCliente', 'valoracionProgresoFisico', 'comparacionVisual',
  'entrenamientosPrevistos', 'entrenamientosCompletados', 'valoracionEntrenamiento',
  'progresoRendimiento', 'molestias', 'cumplimientoNutricion', 'nivelHambre',
  'dificultadPrincipal', 'pasosDiarios', 'objetivoPasosCumplido', 'calidadSueno',
  'horasSueno', 'nivelEnergia', 'nivelEstres',
];

function validarPayload(payload, parte) {
  if (!payload || typeof payload !== 'object') {
    return { valido: false, errores: ['Payload vacío o inválido'] };
  }
  var campos = parte === 2 ? CAMPOS_OBLIGATORIOS_PARTE2 : CAMPOS_OBLIGATORIOS_PARTE1;
  var errores = [];
  campos.forEach(function (campo) {
    var valor = payload[campo];
    if (valor === undefined || valor === null || valor === '') {
      errores.push('Falta el campo obligatorio: ' + campo);
    }
  });
  if (parte === 2 && payload.molestias === 'Sí' && (!payload.detalleMolestias || String(payload.detalleMolestias).trim() === '')) {
    errores.push('Falta el detalle de las molestias');
  }
  return { valido: errores.length === 0, errores: errores };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validarPayload: validarPayload,
    CAMPOS_OBLIGATORIOS_PARTE1: CAMPOS_OBLIGATORIOS_PARTE1,
    CAMPOS_OBLIGATORIOS_PARTE2: CAMPOS_OBLIGATORIOS_PARTE2,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps-script/lib/__tests__/validator.test.js`
Expected: PASS, 10 tests.

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, 73 tests total (baseline 69, minus the old 6-test `validator.test.js`, plus the new 10-test one — net +4).

- [ ] **Step 6: Commit**

```bash
git add apps-script/lib/validator.gs apps-script/lib/__tests__/validator.test.js
git commit -m "feat: split validarPayload into parte 1 / parte 2"
```

---

### Task 2: Pure generator for the Part 1 trainer email

**Files:**
- Create: `apps-script/lib/avisoRapidoGenerator.gs`
- Test: `apps-script/lib/__tests__/avisoRapidoGenerator.test.js`

**Interfaces:**
- Produces: `construirAvisoRapido(datos)` where `datos = { nombre, pesoKg, diferenciaPeso, grasaCorporalPct, fotosFrente, fotosPerfil, fotosEspalda }` (the last three are comma-joined URL strings or `''`, same shape `guardarFotosCategoria_` already returns). Returns `{ asunto: string, cuerpo: string }`.
- Consumed by: Task 6's `enviarAvisoRapidoAlEntrenador_`.

- [ ] **Step 1: Write the failing test**

Create `apps-script/lib/__tests__/avisoRapidoGenerator.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps-script/lib/__tests__/avisoRapidoGenerator.test.js`
Expected: FAIL with "Cannot find module '../avisoRapidoGenerator.gs'".

- [ ] **Step 3: Write the implementation**

Create `apps-script/lib/avisoRapidoGenerator.gs`:

```js
// apps-script/lib/avisoRapidoGenerator.gs
// Mensaje corto para el entrenador en cuanto llega la Parte 1 (peso,
// medidas y fotos), antes de que el cliente conteste las preguntas. No
// reutiliza generarMensajeMotivacional porque ese necesita datos de
// entrenamientos que solo llegan en la Parte 2.
function construirAvisoRapido(datos) {
  var lineaPeso = 'Parte 1 recibida de ' + datos.nombre + ': ' + datos.pesoKg + ' kg';
  if (typeof datos.diferenciaPeso === 'number' && datos.diferenciaPeso !== 0) {
    var direccion = datos.diferenciaPeso < 0 ? 'bajado' : 'subido';
    lineaPeso += ' (ha ' + direccion + ' ' + Math.abs(datos.diferenciaPeso).toFixed(1) + ' kg).';
  } else {
    lineaPeso += '.';
  }

  var partes = [lineaPeso];

  if (typeof datos.grasaCorporalPct === 'number') {
    partes.push('Grasa corporal estimada: ' + datos.grasaCorporalPct + '%.');
  }

  var fotos = [datos.fotosFrente, datos.fotosPerfil, datos.fotosEspalda].filter(Boolean);
  partes.push(fotos.length ? 'Fotos: ' + fotos.join(' | ') : 'No ha subido fotos esta vez.');
  partes.push('Todavía le faltan las preguntas — te llegará otro aviso cuando las conteste.');

  return {
    asunto: 'Parte 1 recibida de ' + datos.nombre + ' (peso, medidas y fotos)',
    cuerpo: partes.join('\n\n'),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { construirAvisoRapido: construirAvisoRapido };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps-script/lib/__tests__/avisoRapidoGenerator.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps-script/lib/avisoRapidoGenerator.gs apps-script/lib/__tests__/avisoRapidoGenerator.test.js
git commit -m "feat: add pure generator for the Part 1 quick email"
```

---

### Task 3: Split `questions.js` into `SECTIONS_PARTE1` / `SECTIONS_PARTE2`

**Files:**
- Modify: `js/questions.js`
- Test: `js/__tests__/questions.test.js`

**Interfaces:**
- Produces: `SECTIONS` (unchanged, all 6 sections, full source of truth), `SECTIONS_PARTE1` (one section: weight/measurements/photos only), `SECTIONS_PARTE2` (6 sections: the remaining 3 "progreso físico" opinion fields + the other 5 sections untouched).
- Consumed by: Task 9 (`app.js`).

- [ ] **Step 1: Write the failing tests**

Add to the end of `js/__tests__/questions.test.js` (keep all existing tests in the file untouched):

```js
const { SECTIONS, SECTIONS_PARTE1, SECTIONS_PARTE2 } = require('../questions.js');

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
  const seccionesOriginalesRestantes = SECTIONS.filter((s) => s.id !== 'progreso_fisico');
  const seccionesParte2Restantes = SECTIONS_PARTE2.slice(1);
  assert.deepEqual(seccionesParte2Restantes, seccionesOriginalesRestantes);
});

test('entre SECTIONS_PARTE1 y SECTIONS_PARTE2 se reparten todos los campos de "progreso físico" sin solapamiento ni pérdida', () => {
  const seccionOriginal = SECTIONS.filter((s) => s.id === 'progreso_fisico')[0];
  const idsOriginales = seccionOriginal.campos.map((c) => c.id).slice().sort();

  const idsParte1 = SECTIONS_PARTE1[0].campos.map((c) => c.id);
  const idsParte2 = SECTIONS_PARTE2[0].campos.map((c) => c.id);
  const solapados = idsParte1.filter((id) => idsParte2.includes(id));
  assert.deepEqual(solapados, []);

  const union = idsParte1.concat(idsParte2).sort();
  assert.deepEqual(union, idsOriginales);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/__tests__/questions.test.js`
Expected: FAIL — `SECTIONS_PARTE1` and `SECTIONS_PARTE2` are `undefined`.

- [ ] **Step 3: Write the implementation**

In `js/questions.js`, insert the following right before the `if (typeof module !== 'undefined' ...)` export block (after the `SECTIONS` array closes):

```js
  var CAMPOS_PARTE1_PROGRESO_FISICO = ['pesoKg', 'cuelloCm', 'cinturaCm', 'caderaCm', 'fotosFrente', 'fotosPerfil', 'fotosEspalda'];

  var SECCION_PROGRESO_FISICO_ORIGINAL = SECTIONS.filter(function (s) { return s.id === 'progreso_fisico'; })[0];

  var SECCION_PROGRESO_FISICO_PARTE1 = Object.assign({}, SECCION_PROGRESO_FISICO_ORIGINAL, {
    campos: SECCION_PROGRESO_FISICO_ORIGINAL.campos.filter(function (c) {
      return CAMPOS_PARTE1_PROGRESO_FISICO.indexOf(c.id) !== -1;
    }),
  });

  var SECCION_PROGRESO_FISICO_PARTE2 = Object.assign({}, SECCION_PROGRESO_FISICO_ORIGINAL, {
    campos: SECCION_PROGRESO_FISICO_ORIGINAL.campos.filter(function (c) {
      return CAMPOS_PARTE1_PROGRESO_FISICO.indexOf(c.id) === -1;
    }),
  });

  var SECTIONS_PARTE1 = [SECCION_PROGRESO_FISICO_PARTE1];

  var SECTIONS_PARTE2 = [SECCION_PROGRESO_FISICO_PARTE2].concat(
    SECTIONS.filter(function (s) { return s.id !== 'progreso_fisico'; })
  );
```

Then update the existing export block to also export the two new lists:

```js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SECTIONS: SECTIONS, SECTIONS_PARTE1: SECTIONS_PARTE1, SECTIONS_PARTE2: SECTIONS_PARTE2 };
  } else {
    root.SECTIONS = SECTIONS;
    root.SECTIONS_PARTE1 = SECTIONS_PARTE1;
    root.SECTIONS_PARTE2 = SECTIONS_PARTE2;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/__tests__/questions.test.js`
Expected: PASS, 9 tests (5 original + 4 new).

- [ ] **Step 5: Run the full suite to confirm no regressions**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, 86 tests total (73 after Task 1, +9 from Task 2's new file, +4 net here since the 5 original questions.test.js tests still count and 4 were added — `SECTIONS` itself is untouched).

- [ ] **Step 6: Commit**

```bash
git add js/questions.js js/__tests__/questions.test.js
git commit -m "feat: split progreso físico into SECTIONS_PARTE1/PARTE2"
```

---

### Task 4: "RespuestasPendientes" sheet + CRUD helpers

**Files:**
- Modify: `apps-script/Config.gs`
- Modify: `apps-script/ClientesService.gs`

**Interfaces:**
- Produces: `obtenerHojaRespuestasPendientes_()` — returns the Sheet object, creating the tab with its header row on first use.
- Produces: `obtenerFilaPendiente_(idCliente)` — returns `{ fila, idCliente, fecha, nombre, pesoKg, pesoAnterior, diferenciaPeso, cuelloCm, cinturaCm, caderaCm, grasaCorporalPct, fotosFrente, fotosPerfil, fotosEspalda }` or `null` if there's no pending row for that client.
- Produces: `guardarFilaPendiente_(datos)` — `datos` has the same shape as the object above minus `fila`; overwrites the existing row for `datos.idCliente` if one exists, otherwise appends a new row.
- Produces: `borrarFilaPendiente_(idCliente)` — clears the content of that client's pending row (no-op if there isn't one). Uses `clearContent()`, never a row delete.
- Consumed by: Task 5 (`Code.gs`).

No automated test for this task: every existing helper in `ClientesService.gs` that talks to `SpreadsheetApp` is untested today (there's no mocking layer for Sheets in this codebase — only pure `lib/` functions get `node --test` coverage). This task's correctness is verified live in Task 7's diagnostic function, same as the rest of `ClientesService.gs`.

- [ ] **Step 1: Add the sheet name constant**

In `apps-script/Config.gs`, add this line after `var SHEET_ID_RESPUESTAS = 'Respuestas';`:

```js
var SHEET_ID_RESPUESTAS_PENDIENTES = 'RespuestasPendientes';
```

- [ ] **Step 2: Add the CRUD helpers**

In `apps-script/ClientesService.gs`, add this block after the existing `obtenerHojaRespuestas_()` function (keep everything else in the file as-is):

```js
var CABECERA_RESPUESTAS_PENDIENTES = [
  'ID_Cliente', 'Fecha', 'Nombre', 'Peso_kg', 'Peso_anterior', 'Diferencia_peso',
  'Cuello_cm', 'Cintura_cm', 'Cadera_cm', 'Grasa_corporal_pct',
  'Fotos_frente', 'Fotos_perfil', 'Fotos_espalda',
];

// Crea la pestaña "RespuestasPendientes" (con su fila de cabecera) la
// primera vez que hace falta. Guarda, como máximo, una fila por cliente:
// la Parte 1 (peso/medidas/fotos) hasta que llega su Parte 2.
function obtenerHojaRespuestasPendientes_() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_RESPUESTAS_PENDIENTES);
  if (!hoja) {
    hoja = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_ID_RESPUESTAS_PENDIENTES);
    hoja.getRange(1, 1, 1, CABECERA_RESPUESTAS_PENDIENTES.length).setValues([CABECERA_RESPUESTAS_PENDIENTES]);
  }
  return hoja;
}

function obtenerFilaPendiente_(idCliente) {
  var hoja = obtenerHojaRespuestasPendientes_();
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === idCliente) {
      return {
        fila: i + 1,
        idCliente: datos[i][0],
        fecha: datos[i][1],
        nombre: datos[i][2],
        pesoKg: datos[i][3],
        pesoAnterior: datos[i][4],
        diferenciaPeso: datos[i][5],
        cuelloCm: datos[i][6],
        cinturaCm: datos[i][7],
        caderaCm: datos[i][8],
        grasaCorporalPct: datos[i][9],
        fotosFrente: datos[i][10],
        fotosPerfil: datos[i][11],
        fotosEspalda: datos[i][12],
      };
    }
  }
  return null;
}

function guardarFilaPendiente_(datos) {
  var filaValores = [
    datos.idCliente, datos.fecha, datos.nombre, datos.pesoKg,
    datos.pesoAnterior, datos.diferenciaPeso,
    datos.cuelloCm, datos.cinturaCm, datos.caderaCm || '',
    datos.grasaCorporalPct !== null && datos.grasaCorporalPct !== undefined ? datos.grasaCorporalPct : '',
    datos.fotosFrente, datos.fotosPerfil, datos.fotosEspalda,
  ];
  var hoja = obtenerHojaRespuestasPendientes_();
  var existente = obtenerFilaPendiente_(datos.idCliente);
  if (existente) {
    hoja.getRange(existente.fila, 1, 1, filaValores.length).setValues([filaValores]);
  } else {
    hoja.appendRow(filaValores);
  }
}

// clearContent, nunca delete row — ver memoria del proyecto sobre el bug
// de ARRAYFORMULA de 2026-09-07: borrar filas desplaza las que hay debajo
// y puede romper fórmulas que dependan de una posición fija.
function borrarFilaPendiente_(idCliente) {
  var existente = obtenerFilaPendiente_(idCliente);
  if (!existente) return;
  obtenerHojaRespuestasPendientes_().getRange(existente.fila, 1, 1, CABECERA_RESPUESTAS_PENDIENTES.length).clearContent();
}
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, same 86 tests as after Task 3 (this task touches no tested file).

- [ ] **Step 4: Commit**

```bash
git add apps-script/Config.gs apps-script/ClientesService.gs
git commit -m "feat: add RespuestasPendientes sheet and CRUD helpers"
```

---

### Task 5: Rewrite `Code.gs` to branch on `parte`

**Files:**
- Modify: `apps-script/Code.gs`

**Interfaces:**
- Consumes: `validarPayload(payload, parte)` (Task 1), `obtenerFilaPendiente_` / `guardarFilaPendiente_` / `borrarFilaPendiente_` (Task 4), `enviarAvisoRapidoAlEntrenador_(cliente, datos)` (Task 6 — referenced here, defined next task; Apps Script resolves top-level functions at call time regardless of file order, so this is safe to write now).
- Produces: `doGet` response gains a `parte` field (`1` or `2`). `doPost` accepts payloads with `parte: 1` or `parte: 2` and responds `{status:'ok', parte:1}` or `{status:'ok', numeroRevision}` respectively, or `{status:'error', mensaje}`.

No automated test (Code.gs has never had one — it's the GAS entrypoint, exercised manually). Verified live in Task 7/8.

- [ ] **Step 1: Replace the file**

Replace the whole file `apps-script/Code.gs` with:

```js
// apps-script/Code.gs
function doGet(e) {
  var accion = e.parameter.accion;
  if (accion === 'validar') {
    var cliente = buscarClientePorId(e.parameter.id);
    if (!cliente) {
      return respuestaJson_({ status: 'error', mensaje: 'Enlace no válido' });
    }
    var pendiente = obtenerFilaPendiente_(cliente.idCliente);
    return respuestaJson_({ status: 'ok', nombre: cliente.nombre, sexo: cliente.sexo || '', parte: pendiente ? 2 : 1 });
  }
  return respuestaJson_({ status: 'error', mensaje: 'Acción no reconocida' });
}

function respuestaJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var parte = payload.parte === 2 ? 2 : 1;
  var validacion = validarPayload(payload, parte);
  if (!validacion.valido) {
    return respuestaJson_({ status: 'error', mensaje: validacion.errores.join('; ') });
  }

  var cliente = buscarClientePorId(payload.idCliente);
  if (!cliente) {
    return respuestaJson_({ status: 'error', mensaje: 'Cliente no encontrado' });
  }

  return parte === 1 ? procesarParte1_(cliente, payload) : procesarParte2_(cliente, payload);
}

function procesarParte1_(cliente, payload) {
  if (cliente.sexo === 'Mujer' && !payload.caderaCm) {
    return respuestaJson_({ status: 'error', mensaje: 'Falta la medida de cadera' });
  }

  var fecha = new Date();
  var filasPrevias = obtenerFilasClienteRespuestas(payload.idCliente);
  var comparacionPeso = calcularComparacionPeso(payload.pesoKg, filasPrevias);
  var urlsFotos = guardarFotos_(payload, cliente, fecha, 'pendiente');
  var grasaCorporalPct = calcularGrasaCorporal(
    cliente.sexo, cliente.alturaCm, payload.cuelloCm, payload.cinturaCm, payload.caderaCm
  );

  guardarFilaPendiente_({
    idCliente: payload.idCliente,
    fecha: fecha,
    nombre: cliente.nombre,
    pesoKg: payload.pesoKg,
    pesoAnterior: comparacionPeso.pesoAnterior,
    diferenciaPeso: comparacionPeso.diferencia,
    cuelloCm: payload.cuelloCm,
    cinturaCm: payload.cinturaCm,
    caderaCm: payload.caderaCm || '',
    grasaCorporalPct: grasaCorporalPct,
    fotosFrente: urlsFotos.frente,
    fotosPerfil: urlsFotos.perfil,
    fotosEspalda: urlsFotos.espalda,
  });

  enviarAvisoRapidoAlEntrenador_(cliente, {
    pesoKg: payload.pesoKg,
    diferenciaPeso: comparacionPeso.diferencia,
    grasaCorporalPct: grasaCorporalPct,
    fotosFrente: urlsFotos.frente,
    fotosPerfil: urlsFotos.perfil,
    fotosEspalda: urlsFotos.espalda,
  });

  return respuestaJson_({ status: 'ok', parte: 1 });
}

function procesarParte2_(cliente, payload) {
  var pendiente = obtenerFilaPendiente_(payload.idCliente);
  if (!pendiente) {
    return respuestaJson_({ status: 'error', mensaje: 'Antes de esto hace falta enviar fotos, peso y medidas (Parte 1)' });
  }

  var filasPrevias = obtenerFilasClienteRespuestas(payload.idCliente);
  var numeroRevision = calcularNumeroRevision(filasPrevias);
  var comparacionPeso = { pesoAnterior: pendiente.pesoAnterior, diferencia: pendiente.diferenciaPeso };
  var grasaCorporalPct = pendiente.grasaCorporalPct === '' ? null : pendiente.grasaCorporalPct;

  // Columna A = cuándo se completó el registro (ahora). Columna B = cuándo
  // se hizo el check-in físico real (Parte 1) — la fórmula Última_Revisión
  // de Clientes agrega por la columna B, así que Próxima_Revisión debe
  // seguir contando desde la fecha de las medidas, no desde la de las
  // preguntas. Ver spec, sección "Detalle importante".
  obtenerHojaRespuestas_().appendRow([
    new Date(), pendiente.fecha, payload.idCliente, cliente.nombre, numeroRevision,
    pendiente.pesoKg, comparacionPeso.pesoAnterior, comparacionPeso.diferencia,
    payload.valoracionProgresoFisico, payload.comparacionVisual,
    pendiente.fotosFrente, pendiente.fotosPerfil, pendiente.fotosEspalda,
    payload.comentarioProgresoFisico || '',
    payload.entrenamientosPrevistos, payload.entrenamientosCompletados,
    payload.valoracionEntrenamiento, payload.progresoRendimiento,
    payload.molestias, payload.detalleMolestias || '',
    payload.cumplimientoNutricion, payload.nivelHambre, payload.dificultadPrincipal,
    payload.comentarioNutricion || '',
    payload.pasosDiarios, payload.objetivoPasosCumplido, payload.calidadSueno,
    payload.horasSueno, payload.nivelEnergia, payload.nivelEstres,
    payload.mejorLogro || '', payload.mayorDificultad || '',
    payload.necesidadEntrenador || '', payload.comentarioAdicional || '',
    payload.objetivoProximasSemanas || '', payload.mejoraEspecifica || '',
    pendiente.cuelloCm, pendiente.cinturaCm, pendiente.caderaCm || '',
    grasaCorporalPct !== null ? grasaCorporalPct : '',
  ]);

  borrarFilaPendiente_(payload.idCliente);

  enviarMensajeMotivacionalAlEntrenador_(cliente, {
    comparacionVisual: payload.comparacionVisual,
    entrenamientosPrevistos: payload.entrenamientosPrevistos,
    entrenamientosCompletados: payload.entrenamientosCompletados,
  }, comparacionPeso, grasaCorporalPct);
  generarInformeProgreso_(cliente, pendiente.fecha, numeroRevision, pendiente.pesoKg, grasaCorporalPct, pendiente.fotosFrente);

  return respuestaJson_({ status: 'ok', numeroRevision: numeroRevision });
}

function guardarFotos_(payload, cliente, fecha, numeroRevision) {
  var carpetaRaiz = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), CARPETA_FOTOS_RAIZ);
  var carpetaCliente = obtenerOCrearCarpeta_(carpetaRaiz, cliente.idCliente + '_' + cliente.nombre);
  var nombreCarpetaRevision = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd') + '_Revision' + numeroRevision;
  var carpetaRevision = obtenerOCrearCarpeta_(carpetaCliente, nombreCarpetaRevision);

  return {
    frente: guardarFotosCategoria_(carpetaRevision, payload.fotosFrente, 'frente'),
    perfil: guardarFotosCategoria_(carpetaRevision, payload.fotosPerfil, 'perfil'),
    espalda: guardarFotosCategoria_(carpetaRevision, payload.fotosEspalda, 'espalda'),
  };
}

function guardarFotosCategoria_(carpeta, fotosBase64, categoria) {
  if (!fotosBase64 || fotosBase64.length === 0) return '';
  var urls = fotosBase64.map(function (base64, indice) {
    var partes = base64.split(',');
    var datos = partes.length > 1 ? partes[1] : partes[0];
    var blob = Utilities.newBlob(Utilities.base64Decode(datos), 'image/jpeg', categoria + '_' + (indice + 1) + '.jpg');
    var archivo = carpeta.createFile(blob);
    return archivo.getUrl();
  });
  return urls.join(', ');
}

function obtenerOCrearCarpeta_(padre, nombre) {
  var carpetas = padre.getFoldersByName(nombre);
  return carpetas.hasNext() ? carpetas.next() : padre.createFolder(nombre);
}

// Manda al entrenador un mensaje ya redactado (según cómo le haya ido al
// cliente) listo para copiar y pegar donde quiera enviárselo (WhatsApp, etc).
function enviarMensajeMotivacionalAlEntrenador_(cliente, payload, comparacionPeso, grasaCorporalPct) {
  var mensaje = generarMensajeMotivacional({
    nombre: cliente.nombre,
    comparacionVisual: payload.comparacionVisual,
    entrenamientosPrevistos: payload.entrenamientosPrevistos,
    entrenamientosCompletados: payload.entrenamientosCompletados,
    diferenciaPeso: comparacionPeso.diferencia,
    grasaCorporalPct: grasaCorporalPct,
  });

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'Mensaje listo para ' + cliente.nombre,
    body: 'Cópialo y pégalo donde quieras mandárselo:\n\n' + mensaje,
  });
}
```

Note what changed vs. today: `guardarFotos_`'s folder name no longer depends on the final `numeroRevision` (which, in the two-part flow, isn't known until Part 2) — it now folders by `'pendiente'` plus the date, since Part 1 is when the photos actually arrive.

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, same 86 tests (Code.gs isn't part of the node:test suite).

- [ ] **Step 3: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat: branch doGet/doPost on parte 1 / parte 2"
```

---

### Task 6: Wire up the Part 1 quick email

**Files:**
- Create: `apps-script/AvisoRapidoService.gs`

**Interfaces:**
- Consumes: `construirAvisoRapido(datos)` (Task 2).
- Produces: `enviarAvisoRapidoAlEntrenador_(cliente, datos)` — called by `procesarParte1_` in `Code.gs` (Task 5).

No automated test (MailApp-dependent, same as every other email-sending wrapper in this codebase). Verified live in Task 7/8.

- [ ] **Step 1: Create the file**

Create `apps-script/AvisoRapidoService.gs`:

```js
// apps-script/AvisoRapidoService.gs
function enviarAvisoRapidoAlEntrenador_(cliente, datos) {
  var mensaje = construirAvisoRapido({
    nombre: cliente.nombre,
    pesoKg: datos.pesoKg,
    diferenciaPeso: datos.diferenciaPeso,
    grasaCorporalPct: datos.grasaCorporalPct,
    fotosFrente: datos.fotosFrente,
    fotosPerfil: datos.fotosPerfil,
    fotosEspalda: datos.fotosEspalda,
  });

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: mensaje.asunto,
    body: mensaje.cuerpo,
  });
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, same 86 tests.

- [ ] **Step 3: Commit**

```bash
git add apps-script/AvisoRapidoService.gs
git commit -m "feat: send a quick trainer email when Part 1 arrives"
```

---

### Task 7: Diagnostic function, menu item, and test-data cleanup

**Files:**
- Modify: `apps-script/Diagnostico.gs`
- Modify: `apps-script/AdminMenu.gs`

**Interfaces:**
- Produces: `probarRevisionDosPartes_()` — simulates the full two-part flow for the `ZZTEST01` test client and `ui.alert`s a pass/fail summary covering every Review Focus item this plan calls out.
- Modifies: `probarMensajeMotivacional_()` to drive the new two-step `doPost` flow instead of the old single-step one.
- Modifies: `limpiarClientePruebaInterno_()` to also clear `RespuestasPendientes` rows for `ZZTEST01`.
- Modifies: `AdminMenu.gs`'s `onOpen()` to temporarily add `🧪 Probar revisión en dos partes` → `probarRevisionDosPartes_` (removed again in Task 10 once confirmed live).

No automated test for this task — it IS the manual test harness for everything untestable in Tasks 4-6. Verified by actually running it from the live Sheet (Task 8).

- [ ] **Step 1: Update `probarMensajeMotivacional_` for the two-step flow**

In `apps-script/Diagnostico.gs`, replace `probarMensajeMotivacionalInterno_` with:

```js
function probarMensajeMotivacionalInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  var idsExistentes = obtenerIdsClientesExistentes();
  if (idsExistentes.indexOf(ID_CLIENTE_PRUEBA) === -1) {
    var fila = obtenerSiguienteFilaClientes_(hoja);
    hoja.getRange(fila, 1, 1, 4).setValues([[ID_CLIENTE_PRUEBA, 'Cliente de Prueba', new Date(), '']]);
    var idxSexo = obtenerIndiceColumna_(hoja, COL_SEXO);
    var idxAltura = obtenerIndiceColumna_(hoja, COL_ALTURA_CM);
    hoja.getRange(fila, idxSexo + 1).setValue('Hombre');
    hoja.getRange(fila, idxAltura + 1).setValue(178);
  }

  doPost({ postData: { contents: JSON.stringify({
    idCliente: ID_CLIENTE_PRUEBA, parte: 1,
    pesoKg: 79.5, cuelloCm: 38, cinturaCm: 84,
  }) } });

  doPost({ postData: { contents: JSON.stringify({
    idCliente: ID_CLIENTE_PRUEBA, parte: 2,
    valoracionProgresoFisico: 8, comparacionVisual: 'Mejor',
    entrenamientosPrevistos: 8, entrenamientosCompletados: 7,
    valoracionEntrenamiento: 8, progresoRendimiento: 'Sí',
    molestias: 'No',
    cumplimientoNutricion: 7, nivelHambre: 5, dificultadPrincipal: 'Nada',
    pasosDiarios: 9000, objetivoPasosCumplido: 'Sí', calidadSueno: 7,
    horasSueno: 7.5, nivelEnergia: 7, nivelEstres: 3,
  }) } });

  ui.alert(
    'Prueba enviada',
    'Revisa tu correo — deberían haberte llegado DOS emails: uno con asunto que empieza ' +
      '"Parte 1 recibida de Cliente de Prueba" y otro "Mensaje listo para Cliente de Prueba".\n\n' +
      'El cliente ZZTEST01 es de prueba: cuando confirmes que los emails llegaron bien, ' +
      'dile a Claude que limpie los datos de prueba para dejar el Sheet como estaba.',
    ui.ButtonSet.OK
  );
}
```

- [ ] **Step 2: Add the two-part diagnostic function**

In `apps-script/Diagnostico.gs`, add this after `probarMensajeMotivacional_`/`probarMensajeMotivacionalInterno_`:

```js
// Comprueba, de principio a fin, el flujo en dos partes para ZZTEST01:
// 1) antes de la Parte 1, el enlace debe apuntar a la parte 1.
// 2) tras la Parte 1, debe quedar exactamente una fila pendiente (ni cero
//    ni dos, incluso si se repite la Parte 1).
// 3) tras la Parte 1, el enlace debe apuntar ya a la parte 2.
// 4) la Parte 2 sin una Parte 1 pendiente debe dar error, no romperse.
// 5) tras la Parte 2, la fila de Respuestas debe llevar en su columna B
//    (índice 1) la fecha de la Parte 1, no la de la Parte 2.
function probarRevisionDosPartes_() {
  var ui = SpreadsheetApp.getUi();
  try {
    probarRevisionDosPartesInterno_(ui);
  } catch (e) {
    ui.alert('Fallo en la prueba', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function probarRevisionDosPartesInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  var idsExistentes = obtenerIdsClientesExistentes();
  if (idsExistentes.indexOf(ID_CLIENTE_PRUEBA) === -1) {
    var fila = obtenerSiguienteFilaClientes_(hoja);
    hoja.getRange(fila, 1, 1, 4).setValues([[ID_CLIENTE_PRUEBA, 'Cliente de Prueba', new Date(), '']]);
    var idxSexo = obtenerIndiceColumna_(hoja, COL_SEXO);
    var idxAltura = obtenerIndiceColumna_(hoja, COL_ALTURA_CM);
    hoja.getRange(fila, idxSexo + 1).setValue('Hombre');
    hoja.getRange(fila, idxAltura + 1).setValue(178);
  }

  var resultados = [];

  function verificar(descripcion, condicion) {
    resultados.push((condicion ? '✅ ' : '❌ ') + descripcion);
    if (!condicion) throw new Error('Falló: ' + descripcion);
  }

  // Parte 2 sin Parte 1 pendiente: debe dar error, no explotar.
  var respuestaSinPendiente = JSON.parse(doPost({ postData: { contents: JSON.stringify({
    idCliente: ID_CLIENTE_PRUEBA, parte: 2, valoracionProgresoFisico: 1, comparacionVisual: 'Igual',
    entrenamientosPrevistos: 1, entrenamientosCompletados: 1, valoracionEntrenamiento: 1,
    progresoRendimiento: 'Sí', molestias: 'No', cumplimientoNutricion: 1, nivelHambre: 1,
    dificultadPrincipal: 'Nada', pasosDiarios: 1, objetivoPasosCumplido: 'Sí', calidadSueno: 1,
    horasSueno: 1, nivelEnergia: 1, nivelEstres: 1,
  }) } }).getContent());
  verificar('Parte 2 sin Parte 1 pendiente da error legible', respuestaSinPendiente.status === 'error');

  // Parte 1, dos veces seguidas (simula que el cliente repite fotos/peso):
  // debe quedar una sola fila pendiente, no dos.
  doPost({ postData: { contents: JSON.stringify({ idCliente: ID_CLIENTE_PRUEBA, parte: 1, pesoKg: 80, cuelloCm: 38, cinturaCm: 85 }) } });
  doPost({ postData: { contents: JSON.stringify({ idCliente: ID_CLIENTE_PRUEBA, parte: 1, pesoKg: 79.5, cuelloCm: 38, cinturaCm: 84 }) } });
  var hojaPendientes = obtenerHojaRespuestasPendientes_();
  var filasPendientesClientePrueba = hojaPendientes.getDataRange().getValues().filter(function (f) { return f[0] === ID_CLIENTE_PRUEBA; });
  verificar('Repetir la Parte 1 deja una sola fila pendiente', filasPendientesClientePrueba.length === 1);
  verificar('La fila pendiente guardó el peso de la segunda Parte 1 (79.5)', filasPendientesClientePrueba[0][3] === 79.5);

  // El enlace ahora debe apuntar a la parte 2.
  var validacion = JSON.parse(doGet({ parameter: { accion: 'validar', id: ID_CLIENTE_PRUEBA } }).getContent());
  verificar('Tras la Parte 1, el enlace apunta a la parte 2', validacion.parte === 2);

  var fechaPendienteAntes = filasPendientesClientePrueba[0][1];

  // Parte 2: debe completar la revisión y usar la fecha de la Parte 1 en
  // la columna B de Respuestas (índice 1), no "ahora".
  doPost({ postData: { contents: JSON.stringify({
    idCliente: ID_CLIENTE_PRUEBA, parte: 2,
    valoracionProgresoFisico: 8, comparacionVisual: 'Mejor',
    entrenamientosPrevistos: 8, entrenamientosCompletados: 7,
    valoracionEntrenamiento: 8, progresoRendimiento: 'Sí', molestias: 'No',
    cumplimientoNutricion: 7, nivelHambre: 5, dificultadPrincipal: 'Nada',
    pasosDiarios: 9000, objetivoPasosCumplido: 'Sí', calidadSueno: 7,
    horasSueno: 7.5, nivelEnergia: 7, nivelEstres: 3,
  }) } });

  var hojaRespuestas = obtenerHojaRespuestas_();
  var datosRespuestas = hojaRespuestas.getDataRange().getValues();
  var filaGuardada = null;
  for (var i = 1; i < datosRespuestas.length; i++) {
    if (datosRespuestas[i][2] === ID_CLIENTE_PRUEBA) filaGuardada = datosRespuestas[i];
  }
  verificar('La Parte 2 guardó una fila en Respuestas', !!filaGuardada);
  verificar(
    'La columna B de Respuestas lleva la fecha de la Parte 1, no la de la Parte 2',
    filaGuardada[1].getTime() === fechaPendienteAntes.getTime()
  );

  var pendienteTrasParte2 = obtenerFilaPendiente_(ID_CLIENTE_PRUEBA);
  verificar('Tras la Parte 2, no queda ninguna fila pendiente', pendienteTrasParte2 === null);

  ui.alert(
    'Prueba de las dos partes: ' + (resultados.every(function (r) { return r.indexOf('✅') === 0; }) ? 'TODO OK' : 'HAY FALLOS'),
    resultados.join('\n') +
      '\n\nRevisa tu correo: deberían haberte llegado varios emails ' +
      '("Parte 1 recibida de Cliente de Prueba...", "Mensaje listo para Cliente de Prueba", ' +
      '"Informe de progreso listo..."). Cuando confirmes que todo está bien, ' +
      'dile a Claude que limpie los datos de prueba.',
    ui.ButtonSet.OK
  );
}
```

- [ ] **Step 3: Extend the cleanup function**

In `apps-script/Diagnostico.gs`, inside `limpiarClientePruebaInterno_`, add this block right after the existing `hojaRespuestas` loop (before the `carpetaRaiz` lines):

```js
  var hojaPendientes = obtenerHojaRespuestasPendientes_();
  var datosPendientes = hojaPendientes.getDataRange().getValues();
  for (var k = 1; k < datosPendientes.length; k++) {
    if (datosPendientes[k][0] === ID_CLIENTE_PRUEBA) {
      hojaPendientes.getRange(k + 1, 1, 1, hojaPendientes.getLastColumn()).clearContent();
    }
  }
```

- [ ] **Step 4: Add the temporary menu item**

In `apps-script/AdminMenu.gs`, in `onOpen()`, add this line right after `.addItem('➕ Nuevo cliente', 'crearNuevoCliente')`:

```js
    .addItem('🧪 Probar revisión en dos partes', 'probarRevisionDosPartes_')
```

- [ ] **Step 5: Run the full test suite to confirm no regressions**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, same 86 tests (Diagnostico.gs/AdminMenu.gs aren't part of the node:test suite).

- [ ] **Step 6: Commit**

```bash
git add apps-script/Diagnostico.gs apps-script/AdminMenu.gs
git commit -m "feat: add live diagnostic for the two-part revision flow"
```

---

### Task 8: Deploy the backend and verify live with ZZTEST01

**Files:** none (deployment + manual verification only).

**Interfaces:** none produced — this is a verification gate before Task 9 can be built against a real backend.

- [ ] **Step 1: Push to Apps Script**

Run (from `apps-script/`, the clasp-linked project per project memory):
```bash
cd apps-script && clasp push --force && cd ..
```

- [ ] **Step 2: Ask the user to run the diagnostic once**

Tell the user, in simple terms: abre el Google Sheet, recarga la página (para que aparezca el menú actualizado), y pulsa en el menú "Revisión Quincenal" → "🧪 Probar revisión en dos partes". Pide que confirme si el aviso dice "TODO OK" y que mire que le han llegado los emails esperados.

- [ ] **Step 3: React to the result**

If the user reports "HAY FALLOS" or missing emails: read the `ui.alert` text they report back (it lists exactly which check failed, per the `verificar()` calls in Task 7), fix the corresponding task's code, re-run Step 1 and Step 2. Do not proceed to Task 9 until the diagnostic reports "TODO OK" and the user confirms the emails arrived.

- [ ] **Step 4: No commit** — this task is deployment + verification, not a code change.

---

### Task 9: Rework `app.js` for the two-part flow

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `SECTIONS_PARTE1`, `SECTIONS_PARTE2` (Task 3); backend's `parte` field from `validarCliente` (Task 5, confirmed live in Task 8).
- Produces: no new exported interface — `app.js` is the DOM entrypoint, not required by any other file.

No automated test (`app.js` has never had one — it touches `document` at load time with no DOM test harness in this project). Verified manually in a browser in Task 10, against the already-deployed backend from Task 8.

- [ ] **Step 1: Add `parte` and `secciones` to `estado`, and a helper to pick the active list**

In `js/app.js`, change the `estado` object definition to:

```js
  var estado = {
    idCliente: null,
    nombreCliente: '',
    parte: 1,
    secciones: SECTIONS_PARTE1,
    indiceSeccion: 0,
    respuestas: {},
    fotos: { fotosFrente: [], fotosPerfil: [], fotosEspalda: [] },
  };
```

- [ ] **Step 2: Replace every reference to the global `SECTIONS` with `estado.secciones`**

In `actualizarProgreso`, change:
```js
    var total = SECTIONS.length;
```
to:
```js
    var total = estado.secciones.length;
```

In `renderSeccionActual`, change:
```js
    var seccion = SECTIONS[estado.indiceSeccion];
```
to:
```js
    var seccion = estado.secciones[estado.indiceSeccion];
```
and change:
```js
    elBtnSiguiente.textContent = estado.indiceSeccion === SECTIONS.length - 1 ? 'Enviar' : 'Siguiente';
```
to:
```js
    elBtnSiguiente.textContent = estado.indiceSeccion === estado.secciones.length - 1 ? 'Enviar' : 'Siguiente';
```

In the `elBtnSiguiente` click handler, change:
```js
    var seccion = SECTIONS[estado.indiceSeccion];
    var errores = RevisionValidation.validarSeccion(seccion, estado.respuestas);
    if (Object.keys(errores).length > 0) {
      mostrarErroresSeccion(errores);
      return;
    }
    if (estado.indiceSeccion < SECTIONS.length - 1) {
```
to:
```js
    var seccion = estado.secciones[estado.indiceSeccion];
    var errores = RevisionValidation.validarSeccion(seccion, estado.respuestas);
    if (Object.keys(errores).length > 0) {
      mostrarErroresSeccion(errores);
      return;
    }
    if (estado.indiceSeccion < estado.secciones.length - 1) {
```

- [ ] **Step 3: Send `parte` in the payload**

In `construirPayload`, change:
```js
  function construirPayload() {
    var payload = Object.assign({ idCliente: estado.idCliente }, estado.respuestas);
    payload.fotosFrente = estado.fotos.fotosFrente;
    payload.fotosPerfil = estado.fotos.fotosPerfil;
    payload.fotosEspalda = estado.fotos.fotosEspalda;
    return payload;
  }
```
to:
```js
  function construirPayload() {
    var payload = Object.assign({ idCliente: estado.idCliente, parte: estado.parte }, estado.respuestas);
    payload.fotosFrente = estado.fotos.fotosFrente;
    payload.fotosPerfil = estado.fotos.fotosPerfil;
    payload.fotosEspalda = estado.fotos.fotosEspalda;
    return payload;
  }
```

- [ ] **Step 4: Branch the post-submit screen on which part just finished**

Change `enviarFormulario`'s success handler from:
```js
    RevisionApi.enviarRevision(URL_API, construirPayload())
      .then(function () {
        mostrarConfirmacion();
      })
```
to:
```js
    RevisionApi.enviarRevision(URL_API, construirPayload())
      .then(function () {
        if (estado.parte === 1) {
          mostrarTransicionParte2();
        } else {
          mostrarConfirmacion();
        }
      })
```

- [ ] **Step 5: Add the Part 1 → Part 2 transition screen**

Add this new function right before `mostrarConfirmacion`:

```js
  function mostrarTransicionParte2() {
    estado.parte = 2;
    estado.secciones = SECTIONS_PARTE2;
    estado.indiceSeccion = 0;
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML =
      '<h1>¡Gracias! 💪</h1>' +
      '<p>Ya tengo tu peso, medidas y fotos. Solo quedan un par de preguntas — puedes ' +
      'hacerlas ahora mismo, o volver más tarde con el mismo enlace.</p>';
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn--primario';
    boton.textContent = 'Seguir ahora';
    boton.style.marginTop = '24px';
    boton.addEventListener('click', iniciarCuestionario);
    div.appendChild(boton);
    elContenido.appendChild(div);
  }
```

- [ ] **Step 6: Make the welcome screen and reset button text match the active part**

Change `init`'s `.then` handler from:
```js
      .then(function (resultado) {
        if (resultado.status !== 'ok') {
          mostrarError('Este enlace no es válido. Contacta con tu entrenador.');
          return;
        }
        estado.nombreCliente = resultado.nombre;
        estado.respuestas.sexo = resultado.sexo || '';
        mostrarBienvenida(resultado.nombre);
      })
```
to:
```js
      .then(function (resultado) {
        if (resultado.status !== 'ok') {
          mostrarError('Este enlace no es válido. Contacta con tu entrenador.');
          return;
        }
        estado.nombreCliente = resultado.nombre;
        estado.respuestas.sexo = resultado.sexo || '';
        estado.parte = resultado.parte === 2 ? 2 : 1;
        estado.secciones = estado.parte === 2 ? SECTIONS_PARTE2 : SECTIONS_PARTE1;
        mostrarBienvenida(resultado.nombre);
      })
```

Change `mostrarBienvenida` from:
```js
  function mostrarBienvenida(nombre) {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML =
      '<h1>Hola, ' + nombre + ' 👋</h1>' +
      '<p>Vamos con tu revisión quincenal. Te llevará unos 5 minutos.</p>';
```
to:
```js
  function mostrarBienvenida(nombre) {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var textoIntro = estado.parte === 2
      ? '<p>Ya tengo tus fotos, peso y medidas de hoy. Solo quedan un par de preguntas, 2 minutos.</p>'
      : '<p>Vamos con tu revisión quincenal. Te llevará unos 5 minutos.</p>';
    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML = '<h1>Hola, ' + nombre + ' 👋</h1>' + textoIntro;
```

- [ ] **Step 7: Run the full test suite to confirm no regressions**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, same 86 tests (`app.js` has no `node:test` coverage, by existing convention).

- [ ] **Step 8: Commit**

```bash
git add js/app.js
git commit -m "feat: render the questionnaire as two independent parts"
```

---

### Task 10: Deploy the frontend, verify end-to-end in a browser, and clean up

**Files:**
- Modify: `apps-script/Diagnostico.gs` (remove `probarRevisionDosPartes_` wiring from the menu — keep the function itself, same as every other `probarX_` function in this file)
- Modify: `apps-script/AdminMenu.gs` (remove the temporary menu item)

- [ ] **Step 1: Push the frontend**

```bash
git push origin master
```
Wait ~1-2 minutes for GitHub Pages to rebuild (per project memory).

- [ ] **Step 2: Manual browser verification — Part 1**

Build ZZTEST01's link (`https://sergilozano999-ui.github.io/revision-quincenal/?id=ZZTEST01`) and open it in a browser (or ask the user to). Confirm:
- The welcome screen says "unos 5 minutos" (meaning it loaded as Part 1 — only true the first time, before any pending row exists for ZZTEST01; if Task 8's diagnostic already left a completed or pending state, run `limpiarClientePrueba_` first).
- Only one section is shown: peso, cuello, cintura, cintura/cadera (si aplica), 3 fotos — no training/nutrition/feedback questions.
- Submitting shows the "¡Gracias! 💪 ... Seguir ahora" transition screen, not the final "próxima revisión" screen.

- [ ] **Step 3: Manual browser verification — Part 2, same session**

Click "Seguir ahora". Confirm:
- Only the remaining questions appear: the 3 opinion fields about physical progress, then training/nutrition/activity/feedback/next-steps — no weight/measurement/photo fields repeated.
- Submitting shows the original "¡Gracias, Cliente de Prueba! ... Nos vemos en tu próxima revisión" screen.

- [ ] **Step 4: Manual browser verification — resuming Part 2 on a fresh visit**

Repeat Step 2 to generate a new pending Part 1 for ZZTEST01, but this time close the tab instead of clicking "Seguir ahora". Reopen the same link fresh. Confirm the welcome screen now says the "2 minutos" / "ya tengo tus fotos" wording (Part 2), not Part 1 again.

- [ ] **Step 5: Clean up test data**

In the Sheet, run "🧹 Limpiar datos de prueba" (existing menu item) to clear ZZTEST01 from Clientes, Respuestas, and RespuestasPendientes, and trash its Drive folders.

- [ ] **Step 6: Remove the temporary diagnostic menu item**

In `apps-script/AdminMenu.gs`, remove the line added in Task 7 Step 4:
```js
    .addItem('🧪 Probar revisión en dos partes', 'probarRevisionDosPartes_')
```
Leave `probarRevisionDosPartes_` itself in `Diagnostico.gs` untouched — same convention as `probarMensajeMotivacional_` and `probarInformeProgreso_`, reachable from the Apps Script editor if ever needed again, just not cluttering the day-to-day menu.

- [ ] **Step 7: Push the menu cleanup**

```bash
cd apps-script && clasp push --force && cd ..
```

- [ ] **Step 8: Run the full test suite one last time**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: PASS, 86 tests.

- [ ] **Step 9: Commit**

```bash
git add apps-script/AdminMenu.gs
git commit -m "chore: remove temporary two-part diagnostic menu item"
```

- [ ] **Step 10: Push to GitHub**

```bash
git push origin master
```
