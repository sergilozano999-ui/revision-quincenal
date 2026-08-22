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
