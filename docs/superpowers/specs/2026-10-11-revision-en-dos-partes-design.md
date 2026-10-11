# Revisión en dos partes (rápida + preguntas) — Diseño

**Fecha:** 2026-10-11
**Estado:** Aprobado, pendiente de plan de implementación

## 1. Propósito

Los clientes tardan en enviar la revisión quincenal completa, lo que retrasa
al entrenador para ponerse a trabajar sobre los nuevos datos. Se divide el
cuestionario en dos partes independientes que el cliente puede completar en
momentos distintos del mismo enlace personal:

- **Parte 1 (rápida):** peso, cuello, cintura, cadera y las 3 fotos de
  progreso (frente, perfil, espalda).
- **Parte 2 (preguntas):** las 3 preguntas de opinión sobre el progreso
  físico (valoración, comparación visual, comentario) + los bloques
  Entrenamiento, Nutrición, Actividad y recuperación, Feedback, Próximas
  semanas.

El entrenador recibe un aviso por email en cuanto llega la Parte 1 (con
peso/medidas/% grasa/fotos) para poder empezar a trabajar sin esperar a la
Parte 2. Cuando llega la Parte 2, se genera la fila completa en "Respuestas",
el informe PDF y el mensaje motivacional, exactamente igual que hoy.

## 2. Requisitos (fuente de verdad)

1. Un único enlace personal por cliente — sin enlaces nuevos que gestionar.
2. Al abrir el enlace, la app muestra automáticamente la parte que falta: si
   no hay una Parte 1 pendiente ese día, muestra la Parte 1; si ya hay una
   Parte 1 pendiente sin cerrar, muestra directamente la Parte 2.
3. Tras enviar la Parte 1, el cliente puede continuar inmediatamente a la
   Parte 2 en la misma sesión, o cerrar y volver más tarde el mismo enlace.
4. Al enviar la Parte 1 llega un email al entrenador con peso, medidas, %
   grasa corporal estimado y enlaces a las fotos.
5. Al enviar la Parte 2 se comporta exactamente como la revisión actual:
   una fila en "Respuestas", el mensaje motivacional de siempre y el informe
   PDF.
6. Ninguna fórmula de la hoja "Clientes" (Última_Revisión, Próxima_Revisión,
   Nº_Revisiones) cambia. Siguen contando solo revisiones completas (Parte 1
   + Parte 2).
7. Los recordatorios existentes (`RecordatorioService.gs`) no cambian: siguen
   enviando el mismo enlace de siempre.
8. Si un cliente envía la Parte 1 pero no vuelve a hacer la Parte 2 el mismo
   día, no se dispara ningún aviso automático nuevo (fuera de alcance por
   ahora). La próxima vez que abra su enlace, retoma en la Parte 2.
9. Si un cliente repite la Parte 1 antes de completar la Parte 2 (p. ej.
   vuelve a hacerse las fotos), la Parte 1 pendiente anterior se sustituye
   por la nueva.

## 3. Arquitectura

Se mantiene la arquitectura actual (frontend estático + Apps Script como
API). El cambio es: una revisión completa ya no se escribe en "Respuestas"
en una sola llamada, sino en dos pasos, usando una hoja intermedia de
"pendientes" para guardar la Parte 1 hasta que llega la Parte 2.

### Alternativa descartada

Dos enlaces distintos (`?id=X&parte=1` / `?id=X&parte=2`) que el entrenador
reenvía por separado. Se descarta porque obliga a gestionar y explicar dos
enlaces por cliente (más fricción, más confusión si se usan en el orden
equivocado), justo lo contrario de lo que se busca.

### Nueva hoja: "RespuestasPendientes"

Una fila por cliente como máximo (clave: `ID_Cliente`). Se escribe al
enviar la Parte 1 y se borra al completarse la Parte 2. Columnas:

```
ID_Cliente | Fecha | Nombre | Peso_kg | Peso_anterior | Diferencia_peso |
Cuello_cm | Cintura_cm | Cadera_cm | Grasa_corporal_pct |
Fotos_frente | Fotos_perfil | Fotos_espalda
```

`Peso_anterior`, `Diferencia_peso` y `Grasa_corporal_pct` se calculan ya en
la Parte 1 (toda la información necesaria — sexo, altura, cuello, cintura,
cadera — está disponible), reutilizando `calcularComparacionPeso` y
`calcularGrasaCorporal` tal cual existen hoy. Así no hay que recalcular nada
al llegar la Parte 2.

### `doGet` (`?accion=validar&id=...`)

Además de `nombre` y `sexo`, devuelve `parte: 1` o `parte: 2` según exista o
no una fila para ese cliente en "RespuestasPendientes".

### `doPost`

El payload incluye un campo nuevo `parte` (1 o 2).

- **`parte === 1`:** valida solo los campos de la Parte 1, sube las fotos
  (reutiliza `guardarFotos_` sin cambios), calcula grasa corporal y
  comparación de peso, y escribe/sobrescribe la fila de ese cliente en
  "RespuestasPendientes". Envía el email rápido al entrenador. Responde
  `{status: 'ok', parte: 1}`.
- **`parte === 2`:** busca la fila pendiente del cliente en
  "RespuestasPendientes" (si no existe, responde error pidiendo completar
  antes la Parte 1). Combina esos datos con el payload de la Parte 2,
  calcula `numeroRevision` igual que hoy (cuenta filas completas en
  "Respuestas"), y hace el mismo `appendRow` de 36 columnas que existe
  actualmente — mismo orden, mismo esquema, cero cambios en "Respuestas" ni
  en sus fórmulas dependientes. Borra la fila de "RespuestasPendientes".
  Ejecuta `enviarMensajeMotivacionalAlEntrenador_` y
  `generarInformeProgreso_` exactamente como hoy. Responde
  `{status: 'ok', numeroRevision}`.

### Validación (`validator.gs`)

Se divide `CAMPOS_OBLIGATORIOS` en `CAMPOS_OBLIGATORIOS_PARTE1` y
`CAMPOS_OBLIGATORIOS_PARTE2`, y `validarPayload(payload, parte)` valida solo
el subconjunto correspondiente. La validación condicional de cadera (según
sexo) y de `detalleMolestias` (según `molestias`) se mantiene en su parte
correspondiente.

### Email rápido al entrenador (nueva función)

`enviarAvisoRapidoAlEntrenador_(cliente, datosPendientes)` en
`RecordatorioService.gs` o un archivo nuevo `AvisoRapidoService.gs`: email
simple sin plantilla de generador de mensajes — algo como:

> "Parte 1 recibida de {nombre}: {peso} kg ({diferencia}), grasa corporal
> estimada {grasa}%. Fotos: {enlaces}."

No reutiliza `generarMensajeMotivacional` porque ese generador necesita
datos de entrenamientos que solo llegan en la Parte 2.

### Detalle importante: qué fecha queda como "fecha de la revisión"

La fórmula de `Última_Revisión` en "Clientes" (ver memoria del proyecto)
agrega por la **columna B** de "Respuestas". Hoy columnas A y B llevan el
mismo valor (`fecha` en el momento del único envío). Al partir en dos
pasos, columna B debe seguir llevando la fecha en que el cliente se hizo
las medidas/fotos (Parte 1) — no la fecha en que, horas después, contesta
las preguntas — para que `Próxima_Revisión` (Última_Revisión + 14 días) se
siga contando desde el check-in físico real. Columna A pasa a ser el
momento en que se completó el registro (Parte 2).

### Frontend

- `questions.js`: las `SECTIONS` se reparten en dos listas —
  `SECCIONES_PARTE1` (solo el subconjunto de medidas/fotos del bloque
  "Progreso físico") y `SECCIONES_PARTE2` (las 3 preguntas de opinión que
  quedan del bloque "Progreso físico" + el resto de bloques tal cual).
- `app.js`: al validar el cliente, usa el campo `parte` de la respuesta para
  decidir qué lista de secciones renderizar. Tras enviar la Parte 1 con
  éxito, pasa directamente a renderizar la Parte 2 en la misma sesión (sin
  recargar), con una pantalla breve de transición ("¡Gracias! Quedan un par
  de preguntas").
- `api.js`: `enviarRevision` incluye `parte` en el payload; sin cambios
  estructurales.

## 4. Casos límite

- **Parte 2 sin Parte 1 pendiente** (p. ej. fila pendiente borrada
  manualmente o caso inconsistente): error legible, frontend vuelve a
  mostrar la Parte 1.
- **Cliente abre el enlace días después de una Parte 1 pendiente antigua**:
  se le lleva a la Parte 2 igualmente — se asume que lo que quedó pendiente
  sigue siendo válido (no hay expiración por ahora, fuera de alcance).
- **Limpieza de datos de prueba** (`Diagnostico.gs`): la función de limpieza
  existente se extiende para borrar también filas de prueba en
  "RespuestasPendientes".

## 5. Fuera de alcance (ideas futuras)

- Recordatorio automático si la Parte 2 queda pendiente varias horas o días.
- Expiración de una Parte 1 pendiente demasiado antigua.
