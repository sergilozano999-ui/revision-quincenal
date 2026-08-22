# Revisión Quincenal — Diseño

**Fecha:** 2026-08-22
**Estado:** Aprobado, pendiente de plan de implementación

## 1. Propósito

Aplicación web propia (sin Google Forms) para que los clientes de un entrenador
personal online completen una revisión quincenal de progreso desde el móvil,
en 4-5 minutos. Las respuestas y fotos de progreso se guardan automáticamente
en Google Sheets y Google Drive del entrenador. Cada cliente accede mediante
un enlace personal con un ID único.

## 2. Requisitos (fuente de verdad)

1. Cuestionario completable en ~4-5 minutos.
2. Diseño mobile-first, aspecto premium, minimalista, animaciones sutiles y profesionales.
3. Revisiones quincenales (cada 2 semanas).
4. Cada cliente tiene un ID único y un enlace personal.
5. Cada envío crea una fila nueva en Sheets; nunca se sobrescribe una revisión anterior.
6. Subida de fotos de progreso desde el móvil (cámara o galería).
7. Fotos guardadas en Google Drive, organizadas por cliente y fecha.
8. Google Sheets guarda los enlaces a las fotos.
9. El entrenador puede comparar la revisión actual con la anterior (peso y variación).
10. Desde Sheets se ve fácilmente la fecha de la última revisión y la próxima.
11. El entrenador puede crear nuevos clientes y generar automáticamente su enlace personal.
12. No se usa Google Forms.
13. La app no depende de Claude Code para funcionar una vez publicada.
14. La aplicación funciona de forma independiente una vez desplegada.
15. Estructura simple de mantener, sin tecnologías innecesarias.
16. Máximo ~26 preguntas visibles (se aceptó superar el límite inicial de 20 porque
    la mayoría son taps de un segundo — ver sección 5).
17. Preguntas condicionales solo aparecen cuando son necesarias.
18. Preguntas abiertas opcionales salvo las estrictamente necesarias.
19. Sin preguntas médicas ni diagnósticos.
20. Tono cercano, motivador y profesional (coaching premium).

## 3. Arquitectura

**Opción elegida:** frontend estático + Google Apps Script como API.

- **Frontend**: HTML/CSS/JS puro (sin frameworks), desplegado gratis en GitHub
  Pages. Sin build, sin dependencias externas, carga instantánea.
- **Backend**: un proyecto de Google Apps Script vinculado al Google Sheet del
  entrenador, desplegado como *Web App* (`doGet` para validar el ID del
  cliente, `doPost` para recibir la revisión completa). Escribe en Sheets y
  sube fotos a Drive.
- Se descartaron: (B) función serverless intermedia con cuenta de servicio —
  añade infraestructura innecesaria para el volumen de un negocio de
  entrenamiento personal; (C) servir el frontend desde Apps Script HTML
  Service — peor rendimiento y peor control del diseño premium en móvil.

### Comunicación frontend ↔ backend

- `fetch` con `Content-Type: text/plain` para evitar el preflight CORS que
  Apps Script no gestiona bien. Apps Script responde con las cabeceras
  necesarias para que el frontend pueda leer la respuesta.
- Las fotos se comprimen/redimensionan en el navegador (canvas, máx. ~1600px,
  calidad 80%) antes de convertirlas a base64 y enviarlas, para que la subida
  sea rápida en datos móviles.

## 4. Estructura de archivos

```
revision-quincenal/
├── index.html              # App del cuestionario (SPA de una sola página)
├── css/
│   └── styles.css          # Diseño premium, mobile-first, variables de tema
├── js/
│   ├── app.js               # Navegación entre secciones, estado del formulario
│   ├── questions.js          # Config de las 6 secciones y preguntas (data-driven)
│   ├── validation.js         # Reglas de validación por campo/sección
│   └── api.js                 # Envío del payload al Web App de Apps Script
├── assets/                       # Logo/iconos si los hay
└── README.md                     # Instrucciones de despliegue y configuración

apps-script/                # Copia versionada del código del backend
├── Code.gs                   # doGet()/doPost(): valida ID, escribe en Sheets, sube fotos
├── ClientesService.gs         # Validación de ID, cálculo de nº de revisión y comparación
├── AdminMenu.gs                # Menú "Nuevo cliente" → genera ID y enlace
└── Config.gs                    # IDs de Sheet/carpeta Drive, URL base del frontend
```

`apps-script/` se mantiene en el repo como copia de seguridad versionada; el
código que realmente se ejecuta vive en el editor de Apps Script vinculado al
Sheet.

## 5. Cuestionario (contenido exacto)

Todas las escalas son 1-10 visuales (círculos táctiles). Los campos marcados
"opcional" son de texto libre y no bloquean el avance.

### 1. Progreso físico
- Peso actual (kg) — número, obligatorio.
- Valoración del progreso físico últimas 2 semanas — escala 1-10, obligatorio.
- Comparación con la última revisión — Mejor / Igual / Peor, obligatorio.
- Fotos de progreso: Frente, Perfil, Espalda — opcional, múltiples por categoría.
- Comentario sobre el progreso físico — texto, opcional.

### 2. Entrenamiento
- Entrenamientos previstos — número, obligatorio.
- Entrenamientos completados — número, obligatorio.
- Valoración de los entrenamientos — escala 1-10, obligatorio.
- Progreso en pesos/repeticiones/rendimiento — Sí / No / Parcialmente, obligatorio.
- Molestias o dificultad entrenando — Sí / No, obligatorio.
  - Si "Sí": detalle breve — texto, obligatorio solo si aparece (condicional).

### 3. Nutrición
- Cumplimiento de la alimentación — escala 1-10, obligatorio.
- Nivel de hambre — escala 1-10, obligatorio.
- Lo más difícil de cumplir — Nada / Fines de semana / Comer fuera / Organización / Antojos / Otro, obligatorio.
- Algo que cambiar o comentar — texto, opcional.

### 4. Actividad y recuperación
- Media de pasos diarios — número, obligatorio.
- Objetivo de pasos cumplido — Sí / Parcialmente / No, obligatorio.
- Calidad del sueño — escala 1-10, obligatorio.
- Horas de sueño aproximadas — número, obligatorio.
- Nivel de energía — escala 1-10, obligatorio.
- Nivel de estrés — escala 1-10, obligatorio.

### 5. Feedback
- Qué has hecho mejor estas 2 semanas — texto, opcional.
- Qué es lo que más te ha costado — texto, opcional.
- Algo que necesites del entrenador — texto, opcional.
- Algo más que quieras contar — texto, opcional.

### 6. Próximas 2 semanas
- Objetivo principal — texto, opcional.
- Algo concreto que mejorar — texto, opcional.

## 6. Modelo de datos

### Google Sheet — pestaña `Clientes`

| Columna | Origen |
|---|---|
| ID_Cliente | Generado por `AdminMenu.gs` al crear el cliente (8 caracteres alfanuméricos, sin ambigüedad O/0, I/1), único |
| Nombre | Introducido por el entrenador al crear el cliente |
| Fecha_Alta | Automática |
| Enlace_Personal | Generado automáticamente (`{URL_BASE}?id={ID_Cliente}`) |
| Última_Revisión | Fórmula `MAXIFS` sobre `Respuestas` |
| Próxima_Revisión | Fórmula `Última_Revisión + 14` |
| Nº_Revisiones | Fórmula `COUNTIF` sobre `Respuestas` |

### Google Sheet — pestaña `Respuestas` (append-only, nunca se edita ni se borra)

Columnas de control: `Timestamp`, `Fecha`, `ID_Cliente`, `Nombre_Cliente`,
`Nº_Revisión` (secuencial por cliente, calculado por el script).

Una columna por cada pregunta de la sección 5 (nombradas de forma
descriptiva, p. ej. `Peso_kg`, `Valoración_Progreso_Fisico`,
`Entrenamientos_Completados`, `Calidad_Sueño`, `Objetivo_Proximas_2_Semanas`,
etc.), más:

- `Fotos_Frente`, `Fotos_Perfil`, `Fotos_Espalda` — URLs de Drive (varias
  separadas por coma si hay más de una foto por categoría).
- `Peso_Anterior_kg`, `Diferencia_Peso_kg` — calculadas por el script en el
  momento del envío, comparando con la fila anterior del mismo cliente
  (cumple el requisito de comparación, punto 9).

### Google Drive

```
/Revisión Quincenal - Fotos Clientes/
  /{ID_Cliente}_{Nombre}/
    /{Fecha}_Revision{Nº}/
      frente_1.jpg
      perfil_1.jpg
      espalda_1.jpg
```

Carpetas creadas automáticamente por el script si no existen. Archivos
privados (solo accesibles por el entrenador, propietario del Drive) — no se
hacen públicos.

## 7. Flujo de datos

1. **Apertura del enlace** (`?id=...`) → `GET` a Apps Script para validar el
   ID contra `Clientes`. ID inválido → pantalla de error, cuestionario no se
   muestra. ID válido → bienvenida personalizada con el nombre del cliente.
2. **Cuestionario** → navegación por las 6 secciones, validación por sección
   antes de avanzar, fotos comprimidas en el navegador antes de guardarlas
   en el estado del formulario.
3. **Envío** → `POST` con el payload completo (JSON, fotos en base64) vía
   `fetch` con `Content-Type: text/plain`.
4. **Procesamiento en `doPost`**:
   - Valida `ID_Cliente`.
   - Calcula `Nº_Revisión` (cuenta filas previas de ese cliente).
   - Calcula `Peso_Anterior_kg` / `Diferencia_Peso_kg` (última fila previa).
   - Decodifica y guarda las fotos en Drive, obtiene URLs.
   - Añade una fila nueva a `Respuestas` (nunca edita filas existentes).
   - Devuelve `{ "status": "ok" }` o un error descriptivo.
5. **Confirmación** → pantalla final motivadora con la fecha estimada de la
   próxima revisión (+14 días). Si el envío falla, aviso claro con opción de
   reintentar sin perder las respuestas ya rellenadas.

## 8. UI/UX

- Tema claro y minimalista, color de acento configurable (variable CSS),
  tipografía del sistema, esquinas redondeadas, sombras muy sutiles.
- Pantallas: Bienvenida → 6 secciones (una por vista) → Confirmación.
  Transiciones fade/slide de ~250ms entre pantallas.
- Barra de progreso fija arriba ("Sección X de 6" + barra animada). Botones
  "Atrás"/"Siguiente" fijos abajo, zona cómoda para el pulgar.
- Componentes por tipo de pregunta:
  - Escalas 1-10 → círculos táctiles grandes (mín. 44px), resaltado con
    color de acento.
  - Opciones (Sí/No/Parcialmente, Mejor/Igual/Peor, etc.) → botones tipo
    píldora, selección única.
  - Números → campos con `inputmode` apropiado para teclado móvil.
  - Texto libre → textarea compacto, marcado "opcional" donde aplica.
  - Fotos → 3 tarjetas (Frente/Perfil/Espalda), miniatura y opción de borrar.
  - Condicional (detalle de molestias) → despliegue suave solo si aplica.
- Contenedor centrado, ancho máximo ~480px (se ve bien también en
  tablet/escritorio aunque el uso principal es móvil).

## 9. Alta de clientes (administración)

Sin panel de administración aparte: menú personalizado en el propio Google
Sheet — **"Revisión Quincenal" → "➕ Nuevo cliente"**. Pide el nombre, genera
un ID único (comprobando que no colisione con los existentes), crea la fila
en `Clientes` y muestra el enlace ya listo para copiar y compartir.

## 10. Manejo de errores

- Enlace con ID inválido o ausente → pantalla de error, cuestionario bloqueado.
- Campo obligatorio vacío → no se puede avanzar de sección, se resalta el campo.
- Fallo de red o del servidor al enviar → aviso claro, reintento sin pérdida
  de datos ya rellenados.
- Error inesperado en Apps Script → capturado y devuelto como mensaje
  entendible, nunca una traza técnica cruda.

## 11. Pruebas (plan manual)

- Flujo completo en iPhone Safari y Android Chrome.
- Envío con y sin fotos.
- Enlace con ID inválido / sin ID.
- Red lenta (throttling) para verificar que la compresión de fotos y el
  aviso de reintento funcionan.
- Verificar que la fila aparece correctamente en `Respuestas` y que las
  fórmulas de `Clientes` (última/próxima revisión, nº de revisiones) se
  actualizan solas.
- Verificar que las fotos aparecen en la carpeta de Drive correcta y que los
  enlaces en `Respuestas` funcionan.
- Alta de un cliente nuevo desde el menú de Sheets y verificación de que el
  enlace generado funciona de extremo a extremo.

## 12. Fuera de alcance (explícitamente no incluido)

- Panel de administración web independiente.
- Preguntas médicas o de diagnóstico.
- Autenticación más allá del ID único en el enlace.
- Edición o borrado de revisiones ya enviadas desde la propia app.
