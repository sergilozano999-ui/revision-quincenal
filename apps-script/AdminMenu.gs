// apps-script/AdminMenu.gs
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Revisión Quincenal')
    .addItem('➕ Nuevo cliente', 'crearNuevoCliente')
    .addItem('🔧 Configurar recordatorios por email', 'configurarRecordatorios_')
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

  var respuestaEmail = ui.prompt('Nuevo cliente', 'Email del cliente (para recordatorios, opcional):', ui.ButtonSet.OK_CANCEL);
  if (respuestaEmail.getSelectedButton() !== ui.Button.OK) return;
  var email = respuestaEmail.getResponseText().trim();

  var idsExistentes = obtenerIdsClientesExistentes();
  var idCliente = generarIdUnico(idsExistentes);
  var enlace = URL_BASE_FRONTEND + '?id=' + idCliente;

  var hoja = obtenerHojaClientes_();
  var fila = obtenerSiguienteFilaClientes_(hoja);
  hoja.getRange(fila, 1, 1, 4).setValues([[idCliente, nombre, new Date(), enlace]]);

  if (email) {
    var idxEmail = obtenerIndiceColumnaEmail_(hoja);
    hoja.getRange(fila, idxEmail + 1).setValue(email);
  }

  ui.alert('Cliente creado', nombre + '\n\nEnlace personal:\n' + enlace, ui.ButtonSet.OK);
}

// Activa el envío diario de recordatorios y manda un correo de prueba al
// propietario. Los emails de cada cliente viven solo en la columna Email
// de la pestaña Clientes, nunca en el código. Idempotente.
function configurarRecordatorios_() {
  var ui = SpreadsheetApp.getUi();
  try {
    configurarRecordatoriosInterno_(ui);
  } catch (e) {
    ui.alert('Fallo al configurar recordatorios', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function configurarRecordatoriosInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  obtenerIndiceColumnaEmail_(hoja);

  var triggersExistentes = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'enviarRecordatorios';
  });
  if (triggersExistentes.length === 0) {
    ScriptApp.newTrigger('enviarRecordatorios').timeBased().everyDays(1).atHour(20).nearMinute(30).create();
  }

  var emailPropietario = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: emailPropietario,
    subject: 'Prueba: recordatorios de Revisión Quincenal activados',
    body:
      'Esto es un correo de prueba. Si lo has recibido, los recordatorios automáticos ' +
      'ya están activados y funcionando correctamente.\n\n' +
      'Recuerda rellenar la columna Email en la pestaña Clientes para cada cliente ' +
      'que quieras que reciba recordatorios.'
  });

  ui.alert(
    'Recordatorios configurados',
    'Se ha activado el envío diario (~20:30) y te he mandado un correo de prueba a ' + emailPropietario + '.',
    ui.ButtonSet.OK
  );
}

