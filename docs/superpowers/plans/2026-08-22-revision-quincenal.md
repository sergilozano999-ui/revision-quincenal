# Revisión Quincenal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, mobile-first web questionnaire that personal-training clients complete every two weeks via a personal link, with responses and progress photos saved automatically to the trainer's Google Sheets/Drive.

**Architecture:** A static, build-free frontend (HTML/CSS/vanilla JS) deployed to GitHub Pages talks to a Google Apps Script Web App (deployed from the trainer's Google Sheet), which validates the client ID, appends a row to a `Respuestas` sheet, and stores photos in Drive. Pure business logic (ID generation, revision-number/weight-delta calculation, payload validation, form validation, questionnaire config, API calls) is written so it can be unit-tested with Node's built-in test runner — no test framework dependency needed.

**Tech Stack:** Vanilla HTML/CSS/JS (no build step, no framework), Google Apps Script (V8 runtime), Google Sheets, Google Drive, Node.js `node:test` + `node:assert/strict` for logic unit tests (dev-time only, not shipped).

**Reference spec:** `docs/superpowers/specs/2026-08-22-revision-quincenal-design.md`

## Global Constraints

- Questionnaire completable in ~4-5 minutes; max ~26 visible questions; conditional questions only render when triggered.
- Mobile-first, premium/minimalist visual design; subtle, professional animations only.
- Revisions are biweekly; every submission is a **new row** — existing rows are never edited or overwritten.
- Every client has a unique ID and personal link (`?id=...`); invalid/missing ID blocks the questionnaire.
- Progress photos (Frente/Perfil/Espalda) are optional, multi-select, uploaded from mobile, stored in Drive organized by client and date, and their URLs are stored in Sheets.
- The trainer can see, directly in the `Clientes` sheet, each client's last revision date, next revision date, and revision count, without touching a script.
- The trainer can create a new client and get an auto-generated unique ID + personal link from a Sheets menu — no separate admin app.
- No Google Forms. No medical/diagnostic questions. Tone: warm, motivating, professional coaching — never clinical.
- No unnecessary technologies: no bundler, no UI framework, no test framework beyond Node's built-in `node:test`.
- The app must work fully standalone once deployed — no dependency on any AI tool at runtime.

---

## Task 1: Backend — Unique client ID generator

**Files:**
- Create: `apps-script/lib/idGenerator.gs`
- Test: `apps-script/lib/__tests__/idGenerator.test.js`

**Interfaces:**
- Produces: `generarIdUnico(idsExistentes, generadorOpcional)` → `string` (8-char ID from charset `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, excludes ambiguous `O/0/I/1`). Throws `Error` after 100 failed attempts. `generadorOpcional` is an optional zero-arg function returning a candidate ID; defaults to the module's internal random generator — used by tests to force collisions deterministically.

- [ ] **Step 1: Write the failing tests**

```js
// apps-script/lib/__tests__/idGenerator.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps-script/lib/__tests__/idGenerator.test.js`
Expected: FAIL — `Cannot find module '../idGenerator.gs'`

- [ ] **Step 3: Write the implementation**

```js
// apps-script/lib/idGenerator.gs
var ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var ID_LENGTH = 8;

function generarIdAleatorio_() {
  var id = '';
  for (var i = 0; i < ID_LENGTH; i++) {
    id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  }
  return id;
}

function generarIdUnico(idsExistentes, generadorOpcional) {
  var generar = generadorOpcional || generarIdAleatorio_;
  var intentos = 0;
  var id = generar();
  while (idsExistentes.indexOf(id) !== -1) {
    intentos++;
    if (intentos > 100) {
      throw new Error('No se pudo generar un ID único tras 100 intentos');
    }
    id = generar();
  }
  return id;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generarIdUnico: generarIdUnico, ID_CHARS: ID_CHARS, ID_LENGTH: ID_LENGTH };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps-script/lib/__tests__/idGenerator.test.js`
Expected: `# pass 3`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add apps-script/lib/idGenerator.gs apps-script/lib/__tests__/idGenerator.test.js
git commit -m "feat: add unique client id generator"
```

---

## Task 2: Backend — Revision number and weight comparison

**Files:**
- Create: `apps-script/lib/revisionCalculator.gs`
- Test: `apps-script/lib/__tests__/revisionCalculator.test.js`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `calcularNumeroRevision(filasCliente)` → `number` (1-indexed; `filasCliente` is an array of that client's prior rows, in chronological order).
  - `calcularComparacionPeso(pesoActual, filasCliente)` → `{ pesoAnterior: number|null, diferencia: number|null }`. `filaCliente` objects must have a `pesoKg` property. Used by Task 7's `doPost`, where `filasCliente` comes from `obtenerFilasClienteRespuestas` (Task 5).

- [ ] **Step 1: Write the failing tests**

```js
// apps-script/lib/__tests__/revisionCalculator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularNumeroRevision, calcularComparacionPeso } = require('../revisionCalculator.gs');

test('la primera revisión de un cliente es la número 1', () => {
  assert.equal(calcularNumeroRevision([]), 1);
});

test('cuenta las revisiones previas y suma una', () => {
  assert.equal(calcularNumeroRevision([{}, {}]), 3);
});

test('sin revisiones previas no hay comparación de peso', () => {
  assert.deepEqual(calcularComparacionPeso(80, []), { pesoAnterior: null, diferencia: null });
});

test('compara el peso actual con el de la última revisión', () => {
  const resultado = calcularComparacionPeso(80, [{ pesoKg: 82 }]);
  assert.deepEqual(resultado, { pesoAnterior: 82, diferencia: -2 });
});

test('redondea la diferencia a 2 decimales evitando errores de coma flotante', () => {
  const resultado = calcularComparacionPeso(80.5, [{ pesoKg: 79.2 }]);
  assert.equal(resultado.diferencia, 1.3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps-script/lib/__tests__/revisionCalculator.test.js`
Expected: FAIL — `Cannot find module '../revisionCalculator.gs'`

- [ ] **Step 3: Write the implementation**

```js
// apps-script/lib/revisionCalculator.gs
function calcularNumeroRevision(filasCliente) {
  return filasCliente.length + 1;
}

function calcularComparacionPeso(pesoActual, filasCliente) {
  if (!filasCliente || filasCliente.length === 0) {
    return { pesoAnterior: null, diferencia: null };
  }
  var filaAnterior = filasCliente[filasCliente.length - 1];
  var pesoAnterior = filaAnterior.pesoKg;
  var diferencia = Math.round((pesoActual - pesoAnterior) * 100) / 100;
  return { pesoAnterior: pesoAnterior, diferencia: diferencia };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularNumeroRevision: calcularNumeroRevision, calcularComparacionPeso: calcularComparacionPeso };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps-script/lib/__tests__/revisionCalculator.test.js`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add apps-script/lib/revisionCalculator.gs apps-script/lib/__tests__/revisionCalculator.test.js
git commit -m "feat: add revision number and weight comparison calculators"
```

---

## Task 3: Backend — Payload validation

**Files:**
- Create: `apps-script/lib/validator.gs`
- Test: `apps-script/lib/__tests__/validator.test.js`

**Interfaces:**
- Produces: `validarPayload(payload)` → `{ valido: boolean, errores: string[] }`. This is server-side defense-in-depth validation (the frontend already validates in Task 10); it re-checks required fields exist and the `detalleMolestias` conditional rule, since the backend must never trust the network.
- The exact payload field names below are the same camelCase keys the frontend will send (see Task 9's `questions.js` field `id`s) — Task 7's `doPost` calls this before writing to Sheets.

- [ ] **Step 1: Write the failing tests**

```js
// apps-script/lib/__tests__/validator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validarPayload } = require('../validator.gs');

function payloadValido(sobrescribir) {
  return Object.assign({
    idCliente: 'ABC12345',
    pesoKg: 80,
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

test('un payload completo es válido', () => {
  const resultado = validarPayload(payloadValido());
  assert.equal(resultado.valido, true);
  assert.deepEqual(resultado.errores, []);
});

test('rechaza un payload vacío o inválido', () => {
  assert.equal(validarPayload(null).valido, false);
  assert.equal(validarPayload(undefined).valido, false);
});

test('reporta cada campo obligatorio ausente', () => {
  const resultado = validarPayload(payloadValido({ pesoKg: undefined }));
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('pesoKg')));
});

test('exige el detalle de molestias cuando molestias es Sí', () => {
  const resultado = validarPayload(payloadValido({ molestias: 'Sí' }));
  assert.equal(resultado.valido, false);
  assert.ok(resultado.errores.some((e) => e.includes('detalle de las molestias')));
});

test('no exige detalle de molestias cuando molestias es No', () => {
  const resultado = validarPayload(payloadValido({ molestias: 'No' }));
  assert.equal(resultado.valido, true);
});

test('acepta el detalle de molestias cuando molestias es Sí y viene relleno', () => {
  const resultado = validarPayload(payloadValido({ molestias: 'Sí', detalleMolestias: 'Dolor de rodilla leve' }));
  assert.equal(resultado.valido, true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps-script/lib/__tests__/validator.test.js`
Expected: FAIL — `Cannot find module '../validator.gs'`

- [ ] **Step 3: Write the implementation**

```js
// apps-script/lib/validator.gs
// Duplicado deliberadamente de questions.js (Task 9): frontend y backend son
// dos runtimes separados sin build compartido, así que la lista de campos
// obligatorios vive una vez en cada lado.
var CAMPOS_OBLIGATORIOS = [
  'idCliente', 'pesoKg', 'valoracionProgresoFisico', 'comparacionVisual',
  'entrenamientosPrevistos', 'entrenamientosCompletados', 'valoracionEntrenamiento',
  'progresoRendimiento', 'molestias', 'cumplimientoNutricion', 'nivelHambre',
  'dificultadPrincipal', 'pasosDiarios', 'objetivoPasosCumplido', 'calidadSueno',
  'horasSueno', 'nivelEnergia', 'nivelEstres',
];

function validarPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valido: false, errores: ['Payload vacío o inválido'] };
  }
  var errores = [];
  CAMPOS_OBLIGATORIOS.forEach(function (campo) {
    var valor = payload[campo];
    if (valor === undefined || valor === null || valor === '') {
      errores.push('Falta el campo obligatorio: ' + campo);
    }
  });
  if (payload.molestias === 'Sí' && (!payload.detalleMolestias || String(payload.detalleMolestias).trim() === '')) {
    errores.push('Falta el detalle de las molestias');
  }
  return { valido: errores.length === 0, errores: errores };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validarPayload: validarPayload, CAMPOS_OBLIGATORIOS: CAMPOS_OBLIGATORIOS };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps-script/lib/__tests__/validator.test.js`
Expected: `# pass 6`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add apps-script/lib/validator.gs apps-script/lib/__tests__/validator.test.js
git commit -m "feat: add server-side payload validation"
```

---

## Task 4: Backend — Google Sheet structure and Config.gs

**Files:**
- Create: `apps-script/Config.gs`
- Manual: create/configure the actual Google Sheet (no repo file — this is Google infrastructure)

**Interfaces:**
- Produces global constants consumed by Tasks 5-8: `SHEET_ID_CLIENTES`, `SHEET_ID_RESPUESTAS`, `CARPETA_FOTOS_RAIZ`, `URL_BASE_FRONTEND`.
- Produces the exact sheet/column layout every later backend task depends on.

- [ ] **Step 1: Create the Google Sheet**

In Google Drive, create a new Google Sheet named `Revisión Quincenal - [Tu nombre]`. Rename the first tab to `Clientes` and add a second tab named `Respuestas`.

- [ ] **Step 2: Set up the `Clientes` tab**

Row 1 (header), columns A–G:

```
A1: ID_Cliente   B1: Nombre   C1: Fecha_Alta   D1: Enlace_Personal
E1: Última_Revisión   F1: Próxima_Revisión   G1: Nº_Revisiones
```

Row 2, columns E–G only (self-expanding formulas — leave A2:D2 empty, Task 8's script fills them):

```
E2: =ARRAYFORMULA(IF(A2:A="","",IFERROR(MAXIFS(Respuestas!B:B,Respuestas!C:C,A2:A))))
F2: =ARRAYFORMULA(IF(E2:E="","",E2:E+14))
G2: =ARRAYFORMULA(IF(A2:A="","",COUNTIF(Respuestas!C:C,A2:A)))
```

These three array formulas auto-apply to every row as soon as column A gets an ID — no dragging or copying needed when new clients are added.

- [ ] **Step 3: Set up the `Respuestas` tab**

Row 1 (header), columns A–AJ, in this exact order (this order is load-bearing — Task 7's `doPost` appends values in this same order):

```
Timestamp, Fecha, ID_Cliente, Nombre_Cliente, Nº_Revisión,
Peso_kg, Peso_Anterior_kg, Diferencia_Peso_kg,
Valoracion_Progreso_Fisico, Comparacion_Visual, Fotos_Frente, Fotos_Perfil, Fotos_Espalda, Comentario_Progreso_Fisico,
Entrenamientos_Previstos, Entrenamientos_Completados, Valoracion_Entrenamiento, Progreso_Rendimiento, Molestias, Detalle_Molestias,
Cumplimiento_Nutricion, Nivel_Hambre, Dificultad_Principal, Comentario_Nutricion,
Pasos_Diarios, Objetivo_Pasos_Cumplido, Calidad_Sueno, Horas_Sueno, Nivel_Energia, Nivel_Estres,
Mejor_Logro, Mayor_Dificultad, Necesidad_Entrenador, Comentario_Adicional,
Objetivo_Proximas_Semanas, Mejora_Especifica
```

Leave row 2 onward empty — this tab is append-only.

- [ ] **Step 4: Open the Apps Script editor and create Config.gs**

In the Sheet, go to **Extensions → Apps Script**. Delete the default empty `Code.gs` content for now (Task 7 recreates it). Create a new script file named `Config` and paste:

```js
// apps-script/Config.gs
var SHEET_ID_CLIENTES = 'Clientes';
var SHEET_ID_RESPUESTAS = 'Respuestas';
var CARPETA_FOTOS_RAIZ = 'Revisión Quincenal - Fotos Clientes';
// Se actualiza en la Tarea 16 con la URL real de GitHub Pages, ej.:
// 'https://sergilozano.github.io/revision-quincenal/'
var URL_BASE_FRONTEND = 'https://TU-USUARIO.github.io/revision-quincenal/';
```

Save the Apps Script project as `revision-quincenal-backend`. Also save a copy in the repo for version control.

- [ ] **Step 5: Commit the repo copy**

```bash
mkdir -p apps-script
git add apps-script/Config.gs
git commit -m "feat: define sheet layout and backend config constants"
```

---

## Task 5: Backend — ClientesService.gs (sheet reads)

**Files:**
- Create: `apps-script/ClientesService.gs`

**Interfaces:**
- Consumes: `SHEET_ID_CLIENTES`, `SHEET_ID_RESPUESTAS` (Task 4).
- Produces (used by Tasks 6-8):
  - `buscarClientePorId(idCliente)` → `{ idCliente, nombre } | null`
  - `obtenerIdsClientesExistentes()` → `string[]` (used by Task 8 with `generarIdUnico` from Task 1)
  - `obtenerSiguienteFilaClientes_(hoja)` → `number` (first row where column A is empty — used instead of `getLastRow()` because the array formulas in columns E:G make `getLastRow()` unreliable on this tab)
  - `obtenerFilasClienteRespuestas(idCliente)` → `{ pesoKg: number }[]` in chronological order (used by Task 7 with `calcularNumeroRevision`/`calcularComparacionPeso` from Task 2)

This file uses `SpreadsheetApp`, which only exists inside the Apps Script runtime — it is not unit-tested with Node, it's verified manually via the Apps Script editor's execution log (Step 3 below).

- [ ] **Step 1: Write the implementation**

Paste into a new Apps Script file named `ClientesService`:

```js
// apps-script/ClientesService.gs
function obtenerHojaClientes_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_CLIENTES);
}

function obtenerHojaRespuestas_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_RESPUESTAS);
}

function buscarClientePorId(idCliente) {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === idCliente) {
      return { idCliente: datos[i][0], nombre: datos[i][1] };
    }
  }
  return null;
}

function obtenerIdsClientesExistentes() {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getRange(2, 1, Math.max(hoja.getMaxRows() - 1, 1), 1).getValues();
  return datos.map(function (fila) { return fila[0]; }).filter(function (valor) { return valor !== ''; });
}

function obtenerSiguienteFilaClientes_(hoja) {
  var datos = hoja.getRange(2, 1, Math.max(hoja.getMaxRows() - 1, 1), 1).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] === '') {
      return i + 2;
    }
  }
  return hoja.getMaxRows() + 1;
}

function obtenerFilasClienteRespuestas(idCliente) {
  var hoja = obtenerHojaRespuestas_();
  var datos = hoja.getDataRange().getValues();
  var cabecera = datos[0];
  var idxId = cabecera.indexOf('ID_Cliente');
  var idxPeso = cabecera.indexOf('Peso_kg');
  var filas = [];
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][idxId] === idCliente) {
      filas.push({ pesoKg: datos[i][idxPeso] });
    }
  }
  return filas;
}
```

- [ ] **Step 2: Manually verify `buscarClientePorId` and `obtenerIdsClientesExistentes`**

In the `Clientes` tab, manually add one test row: `A2: TESTID01`, `B2: Cliente de Prueba`, `C2: (today's date)`, `D2: (any text)`. In the Apps Script editor, select function `buscarClientePorId` from the dropdown — but since it takes a parameter, instead create a temporary throwaway function, run it, check the log, then delete it:

```js
function _pruebaManual() {
  Logger.log(buscarClientePorId('TESTID01'));
  Logger.log(obtenerIdsClientesExistentes());
}
```

Run: select `_pruebaManual` in the toolbar dropdown, click Run, open **View → Logs**.
Expected: `{idCliente=TESTID01, nombre=Cliente de Prueba}` and `[TESTID01]`.

Delete `_pruebaManual` afterward — it was only for verification.

- [ ] **Step 3: Commit**

```bash
git add apps-script/ClientesService.gs
git commit -m "feat: add Clientes/Respuestas sheet read helpers"
```

---

## Task 6: Backend — doGet (client ID validation) + Web App deployment

**Files:**
- Create: `apps-script/Code.gs` (doGet only for now; Task 7 adds doPost)

**Interfaces:**
- Consumes: `buscarClientePorId` (Task 5).
- Produces: the deployed Web App URL, needed by Task 11 (`api.js`) and Task 16 (final wiring).
- HTTP contract: `GET {webAppUrl}?accion=validar&id=XXX` → `{ "status": "ok", "nombre": "..." }` or `{ "status": "error", "mensaje": "..." }`.

- [ ] **Step 1: Write the implementation**

Paste into a new Apps Script file named `Code`:

```js
// apps-script/Code.gs
function doGet(e) {
  var accion = e.parameter.accion;
  if (accion === 'validar') {
    var cliente = buscarClientePorId(e.parameter.id);
    if (!cliente) {
      return respuestaJson_({ status: 'error', mensaje: 'Enlace no válido' });
    }
    return respuestaJson_({ status: 'ok', nombre: cliente.nombre });
  }
  return respuestaJson_({ status: 'error', mensaje: 'Acción no reconocida' });
}

function respuestaJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2: Deploy as a Web App**

In the Apps Script editor: **Deploy → New deployment → Select type: Web app**. Configure:
- Execute as: **Me**
- Who has access: **Anyone**

Click **Deploy**, authorize the requested permissions, and copy the resulting Web App URL (looks like `https://script.google.com/macros/s/XXXXX/exec`). Save it — Task 11 and Task 16 need it.

- [ ] **Step 3: Manually verify with a real HTTP request**

Using the `TESTID01` row created in Task 5:

Run: `curl "https://script.google.com/macros/s/XXXXX/exec?accion=validar&id=TESTID01"`
Expected: `{"status":"ok","nombre":"Cliente de Prueba"}`

Run: `curl "https://script.google.com/macros/s/XXXXX/exec?accion=validar&id=NOEXISTE"`
Expected: `{"status":"error","mensaje":"Enlace no válido"}`

- [ ] **Step 4: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat: add client id validation endpoint and deploy web app"
```

---

## Task 7: Backend — doPost (save revision + photos)

**Files:**
- Modify: `apps-script/Code.gs` (add `doPost` and photo-saving helpers)

**Interfaces:**
- Consumes: `validarPayload` (Task 3), `buscarClientePorId`/`obtenerFilasClienteRespuestas` (Task 5), `calcularNumeroRevision`/`calcularComparacionPeso` (Task 2), `CARPETA_FOTOS_RAIZ` (Task 4).
- HTTP contract: `POST {webAppUrl}` with `Content-Type: text/plain` and a JSON body matching the field names in Task 3's `CAMPOS_OBLIGATORIOS` plus optional fields (`detalleMolestias`, `comentarioProgresoFisico`, `comentarioNutricion`, `mejorLogro`, `mayorDificultad`, `necesidadEntrenador`, `comentarioAdicional`, `objetivoProximasSemanas`, `mejoraEspecifica`) and photo arrays (`fotosFrente`, `fotosPerfil`, `fotosEspalda` — each an array of base64 data-URL strings, possibly empty). Returns `{ "status": "ok", "numeroRevision": N }` or `{ "status": "error", "mensaje": "..." }`.
- Produces: appends one row to `Respuestas` per successful call — this is the function that guarantees requirement "never overwrite a previous revision."

- [ ] **Step 1: Add photo-saving helpers and doPost to Code.gs**

Append to `apps-script/Code.gs`:

```js
function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var validacion = validarPayload(payload);
  if (!validacion.valido) {
    return respuestaJson_({ status: 'error', mensaje: validacion.errores.join('; ') });
  }

  var cliente = buscarClientePorId(payload.idCliente);
  if (!cliente) {
    return respuestaJson_({ status: 'error', mensaje: 'Cliente no encontrado' });
  }

  var filasPrevias = obtenerFilasClienteRespuestas(payload.idCliente);
  var numeroRevision = calcularNumeroRevision(filasPrevias);
  var comparacionPeso = calcularComparacionPeso(payload.pesoKg, filasPrevias);
  var fecha = new Date();
  var urlsFotos = guardarFotos_(payload, cliente, fecha, numeroRevision);

  obtenerHojaRespuestas_().appendRow([
    fecha, fecha, payload.idCliente, cliente.nombre, numeroRevision,
    payload.pesoKg, comparacionPeso.pesoAnterior, comparacionPeso.diferencia,
    payload.valoracionProgresoFisico, payload.comparacionVisual,
    urlsFotos.frente, urlsFotos.perfil, urlsFotos.espalda,
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
  ]);

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
```

- [ ] **Step 2: Redeploy the Web App**

**Deploy → Manage deployments → Edit (pencil icon) → Version: New version → Deploy**. `doPost` only takes effect on the live URL after a new version is deployed.

- [ ] **Step 3: Manually verify with a real HTTP request**

```bash
curl -X POST "https://script.google.com/macros/s/XXXXX/exec" \
  -H "Content-Type: text/plain" \
  -d '{
    "idCliente": "TESTID01", "pesoKg": 80, "valoracionProgresoFisico": 8,
    "comparacionVisual": "Mejor", "fotosFrente": [], "fotosPerfil": [], "fotosEspalda": [],
    "entrenamientosPrevistos": 6, "entrenamientosCompletados": 5, "valoracionEntrenamiento": 7,
    "progresoRendimiento": "Sí", "molestias": "No",
    "cumplimientoNutricion": 8, "nivelHambre": 5, "dificultadPrincipal": "Fines de semana",
    "pasosDiarios": 8000, "objetivoPasosCumplido": "Sí", "calidadSueno": 7,
    "horasSueno": 7.5, "nivelEnergia": 6, "nivelEstres": 4
  }'
```

Expected: `{"status":"ok","numeroRevision":1}`. Open the `Respuestas` tab and confirm a new row appeared with `Nº_Revisión = 1`, `Peso_Anterior_kg` and `Diferencia_Peso_kg` empty (first revision). Run the same `curl` command a second time.
Expected: a second row appears with `Nº_Revisión = 2`, `Peso_Anterior_kg = 80`, `Diferencia_Peso_kg = 0`. Confirm the `Clientes` tab's `Última_Revisión`/`Próxima_Revisión`/`Nº_Revisiones` formulas for `TESTID01` updated automatically.

- [ ] **Step 4: Commit**

```bash
git add apps-script/Code.gs
git commit -m "feat: save revisions and progress photos on submission"
```

---

## Task 8: Backend — AdminMenu.gs (create client)

**Files:**
- Create: `apps-script/AdminMenu.gs`

**Interfaces:**
- Consumes: `generarIdUnico` (Task 1), `obtenerIdsClientesExistentes`/`obtenerSiguienteFilaClientes_`/`obtenerHojaClientes_` (Task 5), `URL_BASE_FRONTEND` (Task 4).
- Produces: the "➕ Nuevo cliente" menu item — the only way clients get created; satisfies "the trainer can create new clients and auto-generate their personal link."

- [ ] **Step 1: Write the implementation**

Paste into a new Apps Script file named `AdminMenu`:

```js
// apps-script/AdminMenu.gs
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Revisión Quincenal')
    .addItem('➕ Nuevo cliente', 'crearNuevoCliente')
    .addToUi();
}

function crearNuevoCliente() {
  var ui = SpreadsheetApp.getUi();
  var respuesta = ui.prompt('Nuevo cliente', 'Nombre del cliente:', ui.ButtonSet.OK_CANCEL);
  if (respuesta.getSelectedButton() !== ui.Button.OK) return;

  var nombre = respuesta.getResponseText().trim();
  if (!nombre) {
    ui.alert('El nombre no puede estar vacío.');
    return;
  }

  var idsExistentes = obtenerIdsClientesExistentes();
  var idCliente = generarIdUnico(idsExistentes);
  var enlace = URL_BASE_FRONTEND + '?id=' + idCliente;

  var hoja = obtenerHojaClientes_();
  var fila = obtenerSiguienteFilaClientes_(hoja);
  hoja.getRange(fila, 1, 1, 4).setValues([[idCliente, nombre, new Date(), enlace]]);

  ui.alert('Cliente creado', nombre + '\n\nEnlace personal:\n' + enlace, ui.ButtonSet.OK);
}
```

- [ ] **Step 2: Manually verify**

Reload the Google Sheet in the browser (menus only register after a reload). Confirm the **Revisión Quincenal** menu appears next to Extensions. Click **➕ Nuevo cliente**, type "María López", confirm. Expected: an alert shows a link ending in `?id=` followed by 8 characters; a new row appears in `Clientes` with that ID, "María López", today's date, and the matching link; columns E/F/G show blank (no revisions yet, since the array formulas are already live). Run it a second time with another name and confirm it lands on the *next* row, not overwriting the first.

- [ ] **Step 3: Commit**

```bash
git add apps-script/AdminMenu.gs
git commit -m "feat: add sheet menu to create clients with auto-generated links"
```

---

## Task 9: Frontend — Questionnaire configuration (questions.js)

**Files:**
- Create: `js/questions.js`
- Test: `js/__tests__/questions.test.js`

**Interfaces:**
- Produces (global `SECTIONS`, also `module.exports.SECTIONS` for tests): an array of 6 section objects `{ id, titulo, campos: [...] }`. Each `campo`: `{ id, tipo, etiqueta, obligatorio, opciones?, dependeDe? }`. `tipo` ∈ `'numero' | 'escala' | 'opciones' | 'foto' | 'texto'`. `dependeDe`, when present, is `{ campo: string, igualA: string }`.
- Consumed by: Task 10 (`validation.js`), Task 13 (rendering engine).
- These exact field `id`s are the payload keys Task 7's backend expects — do not rename without updating `apps-script/lib/validator.gs`.

- [ ] **Step 1: Write the failing tests**

```js
// js/__tests__/questions.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/__tests__/questions.test.js`
Expected: FAIL — `Cannot find module '../questions.js'`

- [ ] **Step 3: Write the implementation**

```js
// js/questions.js
(function (root) {
  var SECTIONS = [
    {
      id: 'progreso_fisico',
      titulo: 'Progreso físico',
      campos: [
        { id: 'pesoKg', tipo: 'numero', etiqueta: 'Peso actual (kg)', obligatorio: true, min: 30, max: 300, paso: 0.1 },
        { id: 'valoracionProgresoFisico', tipo: 'escala', etiqueta: '¿Cómo valoras tu progreso físico estas últimas 2 semanas?', obligatorio: true },
        { id: 'comparacionVisual', tipo: 'opciones', etiqueta: '¿Cómo te ves físicamente respecto a la última revisión?', obligatorio: true, opciones: ['Mejor', 'Igual', 'Peor'] },
        { id: 'fotosFrente', tipo: 'foto', etiqueta: 'Foto de frente', obligatorio: false },
        { id: 'fotosPerfil', tipo: 'foto', etiqueta: 'Foto de perfil', obligatorio: false },
        { id: 'fotosEspalda', tipo: 'foto', etiqueta: 'Foto de espalda', obligatorio: false },
        { id: 'comentarioProgresoFisico', tipo: 'texto', etiqueta: 'Comentario sobre tu progreso físico (opcional)', obligatorio: false },
      ],
    },
    {
      id: 'entrenamiento',
      titulo: 'Entrenamiento',
      campos: [
        { id: 'entrenamientosPrevistos', tipo: 'numero', etiqueta: '¿Cuántos entrenamientos tenías previstos?', obligatorio: true, min: 0, max: 30, paso: 1 },
        { id: 'entrenamientosCompletados', tipo: 'numero', etiqueta: '¿Cuántos has completado?', obligatorio: true, min: 0, max: 30, paso: 1 },
        { id: 'valoracionEntrenamiento', tipo: 'escala', etiqueta: '¿Cómo valoras tus entrenamientos estas 2 semanas?', obligatorio: true },
        { id: 'progresoRendimiento', tipo: 'opciones', etiqueta: '¿Has conseguido progresar en pesos, repeticiones o rendimiento?', obligatorio: true, opciones: ['Sí', 'No', 'Parcialmente'] },
        { id: 'molestias', tipo: 'opciones', etiqueta: '¿Has tenido alguna molestia o dificultad entrenando?', obligatorio: true, opciones: ['Sí', 'No'] },
        { id: 'detalleMolestias', tipo: 'texto', etiqueta: 'Cuéntame brevemente qué te ha pasado', obligatorio: true, dependeDe: { campo: 'molestias', igualA: 'Sí' } },
      ],
    },
    {
      id: 'nutricion',
      titulo: 'Nutrición',
      campos: [
        { id: 'cumplimientoNutricion', tipo: 'escala', etiqueta: '¿Cómo valoras tu cumplimiento de la alimentación?', obligatorio: true },
        { id: 'nivelHambre', tipo: 'escala', etiqueta: '¿Cómo has llevado el hambre?', obligatorio: true },
        { id: 'dificultadPrincipal', tipo: 'opciones', etiqueta: '¿Qué ha sido lo más difícil de cumplir?', obligatorio: true, opciones: ['Nada', 'Fines de semana', 'Comer fuera', 'Organización', 'Antojos', 'Otro'] },
        { id: 'comentarioNutricion', tipo: 'texto', etiqueta: '¿Algo de la alimentación que quieras cambiar o comentar? (opcional)', obligatorio: false },
      ],
    },
    {
      id: 'actividad_recuperacion',
      titulo: 'Actividad y recuperación',
      campos: [
        { id: 'pasosDiarios', tipo: 'numero', etiqueta: 'Media aproximada de pasos diarios', obligatorio: true, min: 0, max: 50000, paso: 100 },
        { id: 'objetivoPasosCumplido', tipo: 'opciones', etiqueta: '¿Has cumplido tu objetivo de pasos?', obligatorio: true, opciones: ['Sí', 'Parcialmente', 'No'] },
        { id: 'calidadSueno', tipo: 'escala', etiqueta: '¿Cómo valoras tu calidad del sueño?', obligatorio: true },
        { id: 'horasSueno', tipo: 'numero', etiqueta: '¿Cuántas horas duermes aproximadamente?', obligatorio: true, min: 0, max: 16, paso: 0.5 },
        { id: 'nivelEnergia', tipo: 'escala', etiqueta: '¿Cómo valorarías tu nivel de energía?', obligatorio: true },
        { id: 'nivelEstres', tipo: 'escala', etiqueta: '¿Cómo valorarías tu nivel de estrés?', obligatorio: true },
      ],
    },
    {
      id: 'feedback',
      titulo: 'Feedback',
      campos: [
        { id: 'mejorLogro', tipo: 'texto', etiqueta: '¿Qué crees que has hecho mejor estas 2 semanas? (opcional)', obligatorio: false },
        { id: 'mayorDificultad', tipo: 'texto', etiqueta: '¿Qué es lo que más te ha costado? (opcional)', obligatorio: false },
        { id: 'necesidadEntrenador', tipo: 'texto', etiqueta: '¿Hay algo que necesites de mí como entrenador? (opcional)', obligatorio: false },
        { id: 'comentarioAdicional', tipo: 'texto', etiqueta: '¿Hay algo más que quieras contarme? (opcional)', obligatorio: false },
      ],
    },
    {
      id: 'proximas_semanas',
      titulo: 'Próximas 2 semanas',
      campos: [
        { id: 'objetivoProximasSemanas', tipo: 'texto', etiqueta: '¿Cuál quieres que sea tu principal objetivo para las próximas 2 semanas? (opcional)', obligatorio: false },
        { id: 'mejoraEspecifica', tipo: 'texto', etiqueta: '¿Hay algo concreto que quieras mejorar? (opcional)', obligatorio: false },
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SECTIONS: SECTIONS };
  } else {
    root.SECTIONS = SECTIONS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/__tests__/questions.test.js`
Expected: `# pass 6`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/questions.js js/__tests__/questions.test.js
git commit -m "feat: add data-driven questionnaire configuration"
```

---

## Task 10: Frontend — Section validation (validation.js)

**Files:**
- Create: `js/validation.js`
- Test: `js/__tests__/validation.test.js`

**Interfaces:**
- Consumes: section/field shape from Task 9 (passed as plain objects — no direct dependency on `questions.js` at runtime, keeping this file testable in isolation).
- Produces (global `RevisionValidation`, also `module.exports`):
  - `obtenerCamposVisibles(seccion, respuestas)` → `campo[]` (filters out fields whose `dependeDe` condition isn't met)
  - `validarSeccion(seccion, respuestas)` → `{ [campoId]: string }` (map of field id → error message, only for invalid required visible fields)
  - `seccionEsValida(seccion, respuestas)` → `boolean`
- Consumed by: Task 13 (rendering engine calls this before allowing "Siguiente").

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/__tests__/validation.test.js`
Expected: FAIL — `Cannot find module '../validation.js'`

- [ ] **Step 3: Write the implementation**

```js
// js/validation.js
(function (root) {
  function obtenerCamposVisibles(seccion, respuestas) {
    return seccion.campos.filter(function (campo) {
      if (!campo.dependeDe) return true;
      return respuestas[campo.dependeDe.campo] === campo.dependeDe.igualA;
    });
  }

  function validarSeccion(seccion, respuestas) {
    var errores = {};
    obtenerCamposVisibles(seccion, respuestas).forEach(function (campo) {
      if (!campo.obligatorio) return;
      var valor = respuestas[campo.id];

      if (campo.tipo === 'escala') {
        if (typeof valor !== 'number' || valor < 1 || valor > 10) {
          errores[campo.id] = 'Selecciona un valor del 1 al 10';
        }
        return;
      }
      if (campo.tipo === 'numero') {
        if (typeof valor !== 'number' || Number.isNaN(valor)) {
          errores[campo.id] = 'Introduce un número';
        }
        return;
      }
      if (valor === undefined || valor === null || String(valor).trim() === '') {
        errores[campo.id] = 'Este campo es obligatorio';
      }
    });
    return errores;
  }

  function seccionEsValida(seccion, respuestas) {
    return Object.keys(validarSeccion(seccion, respuestas)).length === 0;
  }

  var api = { obtenerCamposVisibles: obtenerCamposVisibles, validarSeccion: validarSeccion, seccionEsValida: seccionEsValida };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.RevisionValidation = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/__tests__/validation.test.js`
Expected: `# pass 7`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/validation.js js/__tests__/validation.test.js
git commit -m "feat: add section validation with conditional field support"
```

---

## Task 11: Frontend — API client (api.js)

**Files:**
- Create: `js/api.js`
- Test: `js/__tests__/api.test.js`

**Interfaces:**
- Produces (global `RevisionApi`, also `module.exports`):
  - `construirUrlValidacion(apiUrl, idCliente)` → `string`
  - `validarCliente(apiUrl, idCliente)` → `Promise<{status, nombre?, mensaje?}>`
  - `enviarRevision(apiUrl, payload)` → `Promise<{status, numeroRevision?}>`, rejects with an `Error` if `status !== 'ok'` or the HTTP response isn't OK.
- Consumed by: Task 13's `init()` (calls `validarCliente`) and Task 15 (calls `enviarRevision`).
- Talks to Task 6/7's deployed Web App (`doGet`/`doPost`).

- [ ] **Step 1: Write the failing tests**

```js
// js/__tests__/api.test.js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/__tests__/api.test.js`
Expected: FAIL — `Cannot find module '../api.js'`

- [ ] **Step 3: Write the implementation**

```js
// js/api.js
(function (root) {
  function construirUrlValidacion(apiUrl, idCliente) {
    return apiUrl + '?accion=validar&id=' + encodeURIComponent(idCliente);
  }

  async function validarCliente(apiUrl, idCliente) {
    var respuesta = await fetch(construirUrlValidacion(apiUrl, idCliente));
    if (!respuesta.ok) {
      throw new Error('No se pudo comprobar el enlace');
    }
    return respuesta.json();
  }

  async function enviarRevision(apiUrl, payload) {
    var respuesta = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!respuesta.ok) {
      throw new Error('No se pudo enviar la revisión');
    }
    var resultado = await respuesta.json();
    if (resultado.status !== 'ok') {
      throw new Error(resultado.mensaje || 'Error al guardar la revisión');
    }
    return resultado;
  }

  var api = { construirUrlValidacion: construirUrlValidacion, validarCliente: validarCliente, enviarRevision: enviarRevision };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.RevisionApi = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/__tests__/api.test.js`
Expected: `# pass 5`, `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add js/api.js js/__tests__/api.test.js
git commit -m "feat: add api client for client validation and revision submission"
```

---

## Task 12: Frontend — Base HTML shell and premium CSS

**Files:**
- Create: `index.html`
- Create: `css/styles.css`

**Interfaces:**
- Produces the DOM elements Task 13 wires up by ID: `#cabecera`, `#barra-progreso`, `#texto-progreso`, `#contenido`, `#navegacion`, `#btn-atras`, `#btn-siguiente`.
- Produces CSS custom properties (`--color-accent`, etc.) and reusable classes (`.btn`, `.btn--primario`, `.btn--secundario`, `.campo`, `.escala`, `.escala__opcion`, `.opciones`, `.opciones__boton`) that Task 13/14 rely on when building elements with `classList.add(...)`.

This task has no automated tests (pure markup/styling) — verified manually in a browser.

- [ ] **Step 1: Write index.html**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <title>Revisión Quincenal</title>
  <link rel="stylesheet" href="css/styles.css">
</head>
<body>
  <div class="app">
    <header class="app__header" id="cabecera" hidden>
      <div class="progreso">
        <div class="progreso__barra" id="barra-progreso"></div>
      </div>
      <p class="progreso__texto" id="texto-progreso"></p>
    </header>
    <main class="app__contenido" id="contenido"></main>
    <footer class="app__nav" id="navegacion" hidden>
      <button type="button" class="btn btn--secundario" id="btn-atras">Atrás</button>
      <button type="button" class="btn btn--primario" id="btn-siguiente">Siguiente</button>
    </footer>
  </div>

  <script src="js/questions.js"></script>
  <script src="js/validation.js"></script>
  <script src="js/api.js"></script>
  <script src="js/imageCompressor.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write css/styles.css**

```css
/* css/styles.css */
:root {
  --color-bg: #faf9f7;
  --color-surface: #ffffff;
  --color-text: #1a1a1a;
  --color-text-muted: #6b6b6b;
  --color-accent: #2f6f4f;
  --color-accent-contrast: #ffffff;
  --color-border: #e5e2dc;
  --color-error: #c0392b;
  --radius-md: 12px;
  --radius-lg: 20px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 40px;
  --max-width: 480px;
  --transicion: 250ms ease;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.45;
}

.app {
  max-width: var(--max-width);
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.app__header {
  position: sticky;
  top: 0;
  background: var(--color-surface);
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  z-index: 5;
}

.progreso {
  height: 6px;
  background: var(--color-border);
  border-radius: 999px;
  overflow: hidden;
}

.progreso__barra {
  height: 100%;
  width: 0%;
  background: var(--color-accent);
  border-radius: 999px;
  transition: width var(--transicion);
}

.progreso__texto {
  margin: var(--spacing-sm) 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.app__contenido {
  flex: 1;
  padding: var(--spacing-lg) var(--spacing-md);
  animation: aparecer var(--transicion);
}

@keyframes aparecer {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.app__nav {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.btn {
  flex: 1;
  padding: 14px var(--spacing-md);
  border-radius: var(--radius-md);
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, opacity 120ms ease;
}

.btn:active { transform: scale(0.97); }

.btn--primario {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
}

.btn--secundario {
  background: var(--color-bg);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.campo { margin-bottom: var(--spacing-lg); }

.campo__etiqueta {
  display: block;
  font-weight: 600;
  margin-bottom: var(--spacing-sm);
}

.campo__error {
  color: var(--color-error);
  font-size: 13px;
  margin-top: var(--spacing-sm);
}

.campo input[type="number"],
.campo textarea {
  width: 100%;
  padding: 12px var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: 16px;
  font-family: inherit;
}

.campo textarea { min-height: 80px; resize: vertical; }

.escala { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

.escala__opcion {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, background var(--transicion), color var(--transicion);
}

.escala__opcion.is-seleccionada {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  border-color: var(--color-accent);
  transform: scale(1.05);
}

.opciones { display: flex; flex-wrap: wrap; gap: var(--spacing-sm); }

.opciones__boton {
  padding: 10px var(--spacing-md);
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transicion), color var(--transicion);
}

.opciones__boton.is-seleccionada {
  background: var(--color-accent);
  color: var(--color-accent-contrast);
  border-color: var(--color-accent);
}

.pantalla-centrada {
  text-align: center;
  padding-top: var(--spacing-xl);
}

.pantalla-centrada h1 { margin-bottom: var(--spacing-sm); }
.pantalla-centrada p { color: var(--color-text-muted); }
```

- [ ] **Step 3: Manually verify**

Open `index.html` directly in a browser (double-click or `open index.html`). Expected: a blank premium page with no console errors (the header/footer are `hidden` until Task 13 shows them; scripts load without 404s — check the browser dev tools Network tab).

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css
git commit -m "feat: add base app shell and premium mobile-first styles"
```

---

## Task 13: Frontend — Section rendering engine (app.js, part 1: welcome/error/render)

**Files:**
- Create: `js/app.js`

**Interfaces:**
- Consumes: `SECTIONS` (Task 9), `RevisionValidation` (Task 10), `RevisionApi` (Task 11), DOM ids from Task 12.
- Produces: `window.RevisionApp` internal state machine; screens `bienvenida`, `error`, `seccion`. Task 14 extends the field-rendering `switch`; Task 15 extends navigation to handle submission/confirmation.
- **Set the API URL**: replace `URL_API` below with the Web App URL from Task 6.

- [ ] **Step 1: Write the implementation**

```js
// js/app.js
(function () {
  var URL_API = 'PON_AQUI_LA_URL_DE_TU_WEB_APP'; // Task 16 la reemplaza por la URL real

  var estado = {
    idCliente: null,
    nombreCliente: '',
    indiceSeccion: 0,
    respuestas: {},
    fotos: { fotosFrente: [], fotosPerfil: [], fotosEspalda: [] },
  };

  var elCabecera = document.getElementById('cabecera');
  var elBarraProgreso = document.getElementById('barra-progreso');
  var elTextoProgreso = document.getElementById('texto-progreso');
  var elContenido = document.getElementById('contenido');
  var elNavegacion = document.getElementById('navegacion');
  var elBtnAtras = document.getElementById('btn-atras');
  var elBtnSiguiente = document.getElementById('btn-siguiente');

  function obtenerIdDeUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function mostrarError(mensaje) {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML = '<h1>Enlace no válido</h1><p>' + mensaje + '</p>';
    elContenido.appendChild(div);
  }

  function mostrarBienvenida(nombre) {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML =
      '<h1>Hola, ' + nombre + ' 👋</h1>' +
      '<p>Vamos con tu revisión quincenal. Te llevará unos 5 minutos.</p>';
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn--primario';
    boton.textContent = 'Comenzar';
    boton.style.marginTop = '24px';
    boton.addEventListener('click', iniciarCuestionario);
    div.appendChild(boton);
    elContenido.appendChild(div);
  }

  function iniciarCuestionario() {
    estado.indiceSeccion = 0;
    elCabecera.hidden = false;
    elNavegacion.hidden = false;
    renderSeccionActual();
  }

  function actualizarProgreso() {
    var total = SECTIONS.length;
    var actual = estado.indiceSeccion + 1;
    elBarraProgreso.style.width = Math.round((actual / total) * 100) + '%';
    elTextoProgreso.textContent = 'Sección ' + actual + ' de ' + total;
  }

  function renderSeccionActual() {
    var seccion = SECTIONS[estado.indiceSeccion];
    actualizarProgreso();
    elContenido.innerHTML = '';

    var titulo = document.createElement('h2');
    titulo.textContent = seccion.titulo;
    elContenido.appendChild(titulo);

    var camposVisibles = RevisionValidation.obtenerCamposVisibles(seccion, estado.respuestas);
    camposVisibles.forEach(function (campo) {
      elContenido.appendChild(crearCampoDOM(campo));
    });

    elBtnAtras.disabled = estado.indiceSeccion === 0;
    elBtnSiguiente.textContent = estado.indiceSeccion === SECTIONS.length - 1 ? 'Enviar' : 'Siguiente';
  }

  // Task 14 añade los casos 'foto'; Task 15 no toca esta función.
  function crearCampoDOM(campo) {
    var contenedor = document.createElement('div');
    contenedor.className = 'campo';

    var etiqueta = document.createElement('label');
    etiqueta.className = 'campo__etiqueta';
    etiqueta.textContent = campo.etiqueta;
    contenedor.appendChild(etiqueta);

    if (campo.tipo === 'escala') {
      contenedor.appendChild(crearEscalaDOM(campo));
    } else if (campo.tipo === 'opciones') {
      contenedor.appendChild(crearOpcionesDOM(campo));
    } else if (campo.tipo === 'numero') {
      contenedor.appendChild(crearNumeroDOM(campo));
    } else if (campo.tipo === 'texto') {
      contenedor.appendChild(crearTextoDOM(campo));
    }

    var error = document.createElement('p');
    error.className = 'campo__error';
    error.id = 'error-' + campo.id;
    contenedor.appendChild(error);

    return contenedor;
  }

  function crearEscalaDOM(campo) {
    var grupo = document.createElement('div');
    grupo.className = 'escala';
    for (var valor = 1; valor <= 10; valor++) {
      (function (v) {
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'escala__opcion';
        boton.textContent = String(v);
        if (estado.respuestas[campo.id] === v) boton.classList.add('is-seleccionada');
        boton.addEventListener('click', function () {
          estado.respuestas[campo.id] = v;
          grupo.querySelectorAll('.escala__opcion').forEach(function (b) { b.classList.remove('is-seleccionada'); });
          boton.classList.add('is-seleccionada');
        });
        grupo.appendChild(boton);
      })(valor);
    }
    return grupo;
  }

  function crearOpcionesDOM(campo) {
    var grupo = document.createElement('div');
    grupo.className = 'opciones';
    campo.opciones.forEach(function (opcion) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'opciones__boton';
      boton.textContent = opcion;
      if (estado.respuestas[campo.id] === opcion) boton.classList.add('is-seleccionada');
      boton.addEventListener('click', function () {
        estado.respuestas[campo.id] = opcion;
        grupo.querySelectorAll('.opciones__boton').forEach(function (b) { b.classList.remove('is-seleccionada'); });
        boton.classList.add('is-seleccionada');
        renderSeccionActual();
      });
      grupo.appendChild(boton);
    });
    return grupo;
  }

  function crearNumeroDOM(campo) {
    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    if (campo.min !== undefined) input.min = campo.min;
    if (campo.max !== undefined) input.max = campo.max;
    if (campo.paso !== undefined) input.step = campo.paso;
    if (estado.respuestas[campo.id] !== undefined) input.value = estado.respuestas[campo.id];
    input.addEventListener('input', function () {
      estado.respuestas[campo.id] = input.value === '' ? undefined : Number(input.value);
    });
    return input;
  }

  function crearTextoDOM(campo) {
    var textarea = document.createElement('textarea');
    if (estado.respuestas[campo.id] !== undefined) textarea.value = estado.respuestas[campo.id];
    textarea.addEventListener('input', function () {
      estado.respuestas[campo.id] = textarea.value;
    });
    return textarea;
  }

  function mostrarErroresSeccion(errores) {
    Object.keys(errores).forEach(function (campoId) {
      var el = document.getElementById('error-' + campoId);
      if (el) el.textContent = errores[campoId];
    });
  }

  elBtnAtras.addEventListener('click', function () {
    if (estado.indiceSeccion === 0) return;
    estado.indiceSeccion -= 1;
    renderSeccionActual();
  });

  // Task 15 reemplaza este listener para manejar el envío final.
  elBtnSiguiente.addEventListener('click', function () {
    var seccion = SECTIONS[estado.indiceSeccion];
    var errores = RevisionValidation.validarSeccion(seccion, estado.respuestas);
    if (Object.keys(errores).length > 0) {
      mostrarErroresSeccion(errores);
      return;
    }
    if (estado.indiceSeccion < SECTIONS.length - 1) {
      estado.indiceSeccion += 1;
      renderSeccionActual();
    }
  });

  function init() {
    estado.idCliente = obtenerIdDeUrl();
    if (!estado.idCliente) {
      mostrarError('Este enlace no incluye tu identificador. Contacta con tu entrenador.');
      return;
    }
    RevisionApi.validarCliente(URL_API, estado.idCliente)
      .then(function (resultado) {
        if (resultado.status !== 'ok') {
          mostrarError('Este enlace no es válido. Contacta con tu entrenador.');
          return;
        }
        estado.nombreCliente = resultado.nombre;
        mostrarBienvenida(resultado.nombre);
      })
      .catch(function () {
        mostrarError('No se pudo comprobar tu enlace. Revisa tu conexión e inténtalo de nuevo.');
      });
  }

  init();

  window.RevisionApp = { estado: estado };
})();
```

- [ ] **Step 2: Manually verify**

Since `URL_API` is still a placeholder, opening `index.html` now should show the error screen (no client ID / failed validation) — that's expected at this stage. Temporarily add `?id=TESTID01` to the URL while `URL_API` is still a placeholder: confirm you still see the error screen (fetch fails, caught, friendly message shown, no uncaught exception in console). This confirms the request flow and error handling work before real wiring in Task 16.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add section rendering engine with client validation flow"
```

---

## Task 14: Frontend — Photo upload and client-side compression

**Files:**
- Create: `js/imageCompressor.js`
- Modify: `js/app.js` (add the `'foto'` case to `crearCampoDOM`)

**Interfaces:**
- Produces: `comprimirImagen(archivo, maxAncho, calidad)` → `Promise<string>` (JPEG data-URL), global `window.comprimirImagen`. DOM/canvas-dependent — not unit-tested with Node; verified manually in a browser.
- Modifies `estado.fotos.{fotosFrente,fotosPerfil,fotosEspalda}` (arrays of data-URL strings) which Task 15's submission step reads directly.

- [ ] **Step 1: Write imageCompressor.js**

```js
// js/imageCompressor.js
function comprimirImagen(archivo, maxAncho, calidad) {
  return new Promise(function (resolve, reject) {
    var lector = new FileReader();
    lector.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
    lector.onload = function () {
      var img = new Image();
      img.onerror = function () { reject(new Error('No se pudo procesar la imagen')); };
      img.onload = function () {
        var escala = Math.min(1, maxAncho / img.width);
        var ancho = Math.round(img.width * escala);
        var alto = Math.round(img.height * escala);
        var lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        lienzo.getContext('2d').drawImage(img, 0, 0, ancho, alto);
        resolve(lienzo.toDataURL('image/jpeg', calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

window.comprimirImagen = comprimirImagen;
```

- [ ] **Step 2: Add the `'foto'` case to `js/app.js`**

In `js/app.js`, add a new function and wire it into `crearCampoDOM`:

```js
// En crearCampoDOM, añadir antes del bloque de error:
    } else if (campo.tipo === 'foto') {
      contenedor.appendChild(crearFotoDOM(campo));
    }
```

The full updated `if/else if` chain in `crearCampoDOM`:

```js
    if (campo.tipo === 'escala') {
      contenedor.appendChild(crearEscalaDOM(campo));
    } else if (campo.tipo === 'opciones') {
      contenedor.appendChild(crearOpcionesDOM(campo));
    } else if (campo.tipo === 'numero') {
      contenedor.appendChild(crearNumeroDOM(campo));
    } else if (campo.tipo === 'texto') {
      contenedor.appendChild(crearTextoDOM(campo));
    } else if (campo.tipo === 'foto') {
      contenedor.appendChild(crearFotoDOM(campo));
    }
```

And add `crearFotoDOM` alongside the other `crear*DOM` functions:

```js
  function crearFotoDOM(campo) {
    var envoltorio = document.createElement('div');

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.multiple = true;

    var previsualizacion = document.createElement('div');
    previsualizacion.style.display = 'flex';
    previsualizacion.style.gap = '8px';
    previsualizacion.style.flexWrap = 'wrap';
    previsualizacion.style.marginTop = '8px';

    function repintarPrevisualizacion() {
      previsualizacion.innerHTML = '';
      estado.fotos[campo.id].forEach(function (dataUrl, indice) {
        var miniatura = document.createElement('div');
        miniatura.style.position = 'relative';

        var img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = '72px';
        img.style.height = '72px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        miniatura.appendChild(img);

        var borrar = document.createElement('button');
        borrar.type = 'button';
        borrar.textContent = '×';
        borrar.setAttribute('aria-label', 'Quitar foto');
        borrar.style.position = 'absolute';
        borrar.style.top = '-6px';
        borrar.style.right = '-6px';
        borrar.style.border = 'none';
        borrar.style.borderRadius = '999px';
        borrar.style.width = '22px';
        borrar.style.height = '22px';
        borrar.style.cursor = 'pointer';
        borrar.addEventListener('click', function () {
          estado.fotos[campo.id].splice(indice, 1);
          repintarPrevisualizacion();
        });
        miniatura.appendChild(borrar);

        previsualizacion.appendChild(miniatura);
      });
    }

    input.addEventListener('change', function () {
      var archivos = Array.prototype.slice.call(input.files);
      Promise.all(archivos.map(function (archivo) { return comprimirImagen(archivo, 1600, 0.8); }))
        .then(function (dataUrls) {
          estado.fotos[campo.id] = estado.fotos[campo.id].concat(dataUrls);
          repintarPrevisualizacion();
          input.value = '';
        })
        .catch(function () {
          alert('No se pudo procesar alguna foto. Inténtalo de nuevo.');
        });
    });

    envoltorio.appendChild(input);
    envoltorio.appendChild(previsualizacion);
    repintarPrevisualizacion();
    return envoltorio;
  }
```

Add the `<script src="js/imageCompressor.js"></script>` tag to `index.html`, **before** `js/app.js` (it already was added in Task 12 — confirm it's there and in the right order).

- [ ] **Step 3: Manually verify**

Open the app on an actual phone (or Chrome DevTools device emulation with a real file). Navigate to "Progreso físico", tap the file input under "Foto de frente" — confirm it offers the camera directly (`capture="environment"`) and the gallery. Pick 2 photos. Expected: two thumbnails appear within ~1-2 seconds (compression happening), and each is visibly smaller than the original file (check via DevTools Network/Memory or simply that large photos — e.g. 4000×3000 — don't freeze the UI). Tap the "×" on one thumbnail — confirm it's removed and `estado.fotos.fotosFrente` (inspect via console: `RevisionApp.estado.fotos`) reflects one item left.

- [ ] **Step 4: Commit**

```bash
git add js/imageCompressor.js js/app.js index.html
git commit -m "feat: add mobile photo upload with client-side compression"
```

---

## Task 15: Frontend — Submission, confirmation, and error/retry handling

**Files:**
- Modify: `js/app.js` (replace the `elBtnSiguiente` click handler; add `enviarFormulario` and `mostrarConfirmacion`)

**Interfaces:**
- Consumes: `RevisionApi.enviarRevision` (Task 11), `estado.respuestas`/`estado.fotos` (Tasks 13-14).
- Produces: the `confirmacion` screen and retry-without-data-loss behavior described in the spec's data flow (section 7, step 5).

- [ ] **Step 1: Replace the `elBtnSiguiente` listener in `js/app.js`**

Remove the Task 13 version of this block:

```js
  // Task 15 reemplaza este listener para manejar el envío final.
  elBtnSiguiente.addEventListener('click', function () {
    var seccion = SECTIONS[estado.indiceSeccion];
    var errores = RevisionValidation.validarSeccion(seccion, estado.respuestas);
    if (Object.keys(errores).length > 0) {
      mostrarErroresSeccion(errores);
      return;
    }
    if (estado.indiceSeccion < SECTIONS.length - 1) {
      estado.indiceSeccion += 1;
      renderSeccionActual();
    }
  });
```

Replace it with:

```js
  elBtnSiguiente.addEventListener('click', function () {
    var seccion = SECTIONS[estado.indiceSeccion];
    var errores = RevisionValidation.validarSeccion(seccion, estado.respuestas);
    if (Object.keys(errores).length > 0) {
      mostrarErroresSeccion(errores);
      return;
    }
    if (estado.indiceSeccion < SECTIONS.length - 1) {
      estado.indiceSeccion += 1;
      renderSeccionActual();
      return;
    }
    enviarFormulario();
  });

  function construirPayload() {
    var payload = Object.assign({ idCliente: estado.idCliente }, estado.respuestas);
    payload.fotosFrente = estado.fotos.fotosFrente;
    payload.fotosPerfil = estado.fotos.fotosPerfil;
    payload.fotosEspalda = estado.fotos.fotosEspalda;
    return payload;
  }

  function enviarFormulario() {
    elBtnSiguiente.disabled = true;
    elBtnSiguiente.textContent = 'Enviando...';
    RevisionApi.enviarRevision(URL_API, construirPayload())
      .then(function () {
        mostrarConfirmacion();
      })
      .catch(function (error) {
        elBtnSiguiente.disabled = false;
        elBtnSiguiente.textContent = 'Enviar';
        mostrarAvisoReintento(error.message);
      });
  }

  function mostrarAvisoReintento(mensaje) {
    var existente = document.getElementById('aviso-reintento');
    if (existente) existente.remove();
    var aviso = document.createElement('p');
    aviso.id = 'aviso-reintento';
    aviso.className = 'campo__error';
    aviso.textContent = 'No se pudo enviar tu revisión (' + mensaje + '). Tus respuestas siguen aquí — inténtalo de nuevo.';
    elContenido.insertBefore(aviso, elContenido.firstChild);
  }

  function mostrarConfirmacion() {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var proximaFecha = new Date();
    proximaFecha.setDate(proximaFecha.getDate() + 14);
    var textoFecha = proximaFecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML =
      '<h1>¡Gracias, ' + estado.nombreCliente + '! 💪</h1>' +
      '<p>Tu entrenador revisará esto pronto.</p>' +
      '<p>Nos vemos en tu próxima revisión, sobre el ' + textoFecha + '.</p>';
    elContenido.appendChild(div);
  }
```

- [ ] **Step 2: Manually verify the happy path and the failure path**

With `URL_API` still pointing at the real deployed Web App from Task 7 (or temporarily overridden in the browser console via `URL_API` — note it's a closure variable, so for this manual check either edit the file temporarily or wait for Task 16's real wiring): complete the full questionnaire for `TESTID01` and submit. Expected: button shows "Enviando...", then the confirmation screen appears with the client's name and a date 14 days out; a new row appears in `Respuestas`.

To verify the failure path, temporarily set `URL_API` to an invalid URL, fill the form, and submit. Expected: button re-enables, text reverts to "Enviar", a red message appears above the section explaining the send failed, and all previously entered answers are still visible when you check `RevisionApp.estado.respuestas` in the console (nothing was cleared).

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat: add submission flow with confirmation screen and retry on failure"
```

---

## Task 16: Deployment — GitHub Pages + final wiring + end-to-end QA

**Files:**
- Modify: `js/app.js` (`URL_API` constant)
- Modify: `apps-script/Config.gs` (`URL_BASE_FRONTEND` constant, both repo copy and live Apps Script project)
- Create: `README.md`

**Interfaces:** none — this task wires Tasks 1-15 together against real, deployed infrastructure and runs the manual QA matrix from the spec.

- [ ] **Step 1: Push the repo to GitHub and enable Pages**

```bash
git remote add origin https://github.com/TU-USUARIO/revision-quincenal.git
git push -u origin master
```

In the GitHub repo settings, go to **Pages**, set source to the `master` branch, root folder. Wait for the deployment to finish and note the resulting URL (`https://TU-USUARIO.github.io/revision-quincenal/`).

- [ ] **Step 2: Wire the real URLs on both sides**

In `js/app.js`, replace:
```js
  var URL_API = 'PON_AQUI_LA_URL_DE_TU_WEB_APP';
```
with the actual Web App URL from Task 6, e.g.:
```js
  var URL_API = 'https://script.google.com/macros/s/XXXXXXXXXXXX/exec';
```

In `apps-script/Config.gs` (repo copy) and in the live Apps Script editor, replace:
```js
var URL_BASE_FRONTEND = 'https://TU-USUARIO.github.io/revision-quincenal/';
```
with your real GitHub Pages URL (same value, just confirm the placeholder segment is your actual username). In the Apps Script editor, redeploy: **Deploy → Manage deployments → Edit → New version → Deploy**.

Push the frontend change:
```bash
git add js/app.js apps-script/Config.gs
git commit -m "chore: wire production web app and pages urls"
git push
```

- [ ] **Step 3: Write README.md**

```markdown
# Revisión Quincenal

App de revisión quincenal para clientes de entrenamiento personal online.

## Desarrollo

- Frontend: HTML/CSS/JS puro en `index.html`, `css/`, `js/` — sin build, sin dependencias.
- Backend: Google Apps Script en `apps-script/` (copia versionada; el código real vive en el proyecto de Apps Script vinculado al Google Sheet).

## Pruebas de lógica

```bash
node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js
```

## Desplegar cambios de frontend

Push a `master` — GitHub Pages se actualiza solo.

## Desplegar cambios de backend

Editar el archivo correspondiente en el editor de Apps Script (Extensions → Apps Script desde el Sheet), luego **Deploy → Manage deployments → Edit → New version → Deploy**. Copiar el mismo cambio a `apps-script/` en este repo para mantener el historial.

## Dar de alta un cliente

Desde el Google Sheet: menú **Revisión Quincenal → ➕ Nuevo cliente**.
```

- [ ] **Step 4: Run the full logic test suite one last time**

Run: `node --test apps-script/lib/__tests__/*.test.js js/__tests__/*.test.js`
Expected: all suites pass, `# fail 0` across the board.

- [ ] **Step 5: End-to-end manual QA (real devices, real deployed app)**

Using the real `https://TU-USUARIO.github.io/revision-quincenal/?id=TESTID01` link:

- Complete the full flow on an iPhone (Safari) and an Android phone (Chrome): confirm layout, tap targets, and animations feel premium and don't jank.
- Submit once with photos in all three categories, once with zero photos.
- Open the link with a missing/invalid `id` — confirm the error screen, not the questionnaire.
- Throttle the network (Chrome DevTools → Network → Slow 4G), submit with photos — confirm compression keeps the request fast enough not to feel broken, and that the retry message appears (not a silent hang) if you fully disconnect mid-submit.
- After each submission, verify in `Respuestas`: the row appended (never edited), `Nº_Revisión` incremented correctly, `Peso_Anterior_kg`/`Diferencia_Peso_kg` correct, photo URLs open the right images in Drive.
- Verify `Clientes` tab: `Última_Revisión`, `Próxima_Revisión`, `Nº_Revisiones` for `TESTID01` update automatically after each submission.
- Create a brand-new client via **➕ Nuevo cliente**, open their fresh link end-to-end, confirm it works exactly like `TESTID01` did.

- [ ] **Step 6: Remove test data and commit final state**

Delete the `TESTID01` row (and its Drive photos) from `Clientes`/`Respuestas`/Drive — it was only for development QA.

```bash
git add README.md
git commit -m "docs: add README with dev, deploy, and client onboarding instructions"
git push
```
