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
