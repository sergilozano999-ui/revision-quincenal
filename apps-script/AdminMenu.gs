// apps-script/AdminMenu.gs
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Revisión Quincenal')
    .addItem('➕ Nuevo cliente', 'crearNuevoCliente')
    .addItem('🔧 Configurar recordatorios por email', 'configurarRecordatorios_')
    .addItem('💶 Avisos de pago', 'avisosPago_')
    .addItem('📈 Ver progreso de clientes', 'verProgreso_')
    .addItem('🛠️ Completar sexo/altura de clientes', 'completarDatosClientes_')
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

  // Sexo y altura hacen falta para calcular el % de grasa corporal
  // (fórmula US Navy) a partir de las medidas que el cliente meta en cada
  // revisión.
  var respuestaSexo = ui.alert('Nuevo cliente', '¿Es una clienta (mujer)?', ui.ButtonSet.YES_NO);
  var sexo = respuestaSexo === ui.Button.YES ? 'Mujer' : 'Hombre';

  var respuestaAltura = ui.prompt(
    'Nuevo cliente',
    'Altura en cm (para calcular el % de grasa corporal; déjalo en blanco si no lo sabes ahora):',
    ui.ButtonSet.OK_CANCEL
  );
  if (respuestaAltura.getSelectedButton() !== ui.Button.OK) return;
  var alturaTexto = respuestaAltura.getResponseText().trim();
  var alturaCm = alturaTexto ? Number(alturaTexto) : '';

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

  var idxSexo = obtenerIndiceColumna_(hoja, COL_SEXO);
  hoja.getRange(fila, idxSexo + 1).setValue(sexo);
  if (alturaCm) {
    var idxAltura = obtenerIndiceColumna_(hoja, COL_ALTURA_CM);
    hoja.getRange(fila, idxAltura + 1).setValue(alturaCm);
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

// Único botón para pagos: activa el aviso diario si no lo estaba, y manda
// SIEMPRE un correo con el estado real (activado o no, columnas encontradas,
// y la fecha/estado de cada cliente). Idempotente, se puede pulsar varias veces.
function avisosPago_() {
  var ui = SpreadsheetApp.getUi();
  try {
    avisosPagoInterno_(ui);
  } catch (e) {
    ui.alert('Fallo en avisos de pago', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function avisosPagoInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  obtenerIndiceColumna_(hoja, COL_PROXIMO_PAGO);
  obtenerIndiceColumna_(hoja, COL_PAGADO);

  var triggersExistentes = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'enviarAvisosPago';
  });
  if (triggersExistentes.length === 0) {
    ScriptApp.newTrigger('enviarAvisosPago').timeBased().everyDays(1).atHour(20).nearMinute(30).create();
  }

  var idxEmailCliente = obtenerIndiceColumnaEmail_(hoja);

  var datos = hoja.getDataRange().getValues();
  var cabecera = datos[0];
  var idxProximoPago = cabecera.indexOf(COL_PROXIMO_PAGO);
  var idxPagado = cabecera.indexOf(COL_PAGADO);

  var lineas = [];
  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    if (!fila[0]) continue;
    var fecha = idxProximoPago !== -1 ? fila[idxProximoPago] : '';
    var fechaTexto = fecha instanceof Date
      ? Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'dd/MM/yyyy')
      : '(sin fecha puesta)';
    var pagado = idxPagado !== -1 ? fila[idxPagado] || 'No' : 'No';
    var tieneEmail = idxEmailCliente !== -1 && fila[idxEmailCliente];
    lineas.push(
      '- ' + fila[1] + ': próximo pago ' + fechaTexto + ' | Pagado: ' + pagado +
      ' | Recordatorio al cliente: ' + (tieneEmail ? 'sí (' + fila[idxEmailCliente] + ')' : 'NO (sin email en la hoja Clientes)')
    );
  }

  var emailPropietario = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({
    to: emailPropietario,
    subject: 'AVISOS DE PAGO: resultado de la comprobación',
    body:
      'Aviso diario automático: ACTIVADO ✅\n\n' +
      'Cuando a un cliente le queden ' + DIAS_AVISO_PAGO + ' días para su próximo pago, ' +
      'te avisan a ti Y, si tiene email puesto en la hoja Clientes, también le llega un ' +
      'recordatorio a él.\n\n' +
      'Columnas encontradas en la fila 1 de la hoja Clientes:\n' + cabecera.join(' | ') + '\n\n' +
      'Clientes y su próximo pago:\n' +
      (lineas.length ? lineas.join('\n') : '(no hay clientes con datos todavía)')
  });

  ui.alert(
    'Avisos de pago',
    'Te he mandado un correo a ' + emailPropietario + ' con el resultado. Busca el asunto "AVISOS DE PAGO: resultado de la comprobación".',
    ui.ButtonSet.OK
  );
}

// Recorre los clientes existentes a los que les falte Sexo o Altura_cm (los
// necesarios para la gráfica de % de grasa corporal) y pregunta uno por uno,
// para no obligar al usuario a editar la hoja Clientes a mano.
function completarDatosClientes_() {
  var ui = SpreadsheetApp.getUi();
  try {
    completarDatosClientesInterno_(ui);
  } catch (e) {
    ui.alert('Fallo al completar datos', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function completarDatosClientesInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  var idxSexo = obtenerIndiceColumna_(hoja, COL_SEXO);
  var idxAltura = obtenerIndiceColumna_(hoja, COL_ALTURA_CM);
  var datos = hoja.getDataRange().getValues();

  var completados = 0;
  var saltados = 0;

  for (var i = 1; i < datos.length; i++) {
    var idCliente = datos[i][0];
    var nombre = datos[i][1];
    if (!idCliente) continue;
    if (datos[i][idxSexo] && datos[i][idxAltura]) continue;

    var respuestaSexo = ui.alert(
      'Datos de ' + nombre,
      '¿' + nombre + ' es una clienta (mujer)?\n\n(Cancelar = saltar a este cliente por ahora)',
      ui.ButtonSet.YES_NO_CANCEL
    );
    if (respuestaSexo === ui.Button.CANCEL || respuestaSexo === ui.Button.CLOSE) {
      saltados++;
      continue;
    }
    var sexo = respuestaSexo === ui.Button.YES ? 'Mujer' : 'Hombre';

    var respuestaAltura = ui.prompt(
      'Datos de ' + nombre,
      'Altura de ' + nombre + ' en cm (déjalo en blanco si no lo sabes ahora):',
      ui.ButtonSet.OK_CANCEL
    );
    if (respuestaAltura.getSelectedButton() !== ui.Button.OK) {
      saltados++;
      continue;
    }
    var alturaTexto = respuestaAltura.getResponseText().trim();

    hoja.getRange(i + 1, idxSexo + 1).setValue(sexo);
    if (alturaTexto) {
      hoja.getRange(i + 1, idxAltura + 1).setValue(Number(alturaTexto));
    }
    completados++;
  }

  var mensaje = completados + ' cliente(s) completado(s).';
  if (saltados) mensaje += ' ' + saltados + ' saltado(s) — vuelve a pulsar este botón cuando quieras terminarlos.';
  if (completados === 0 && saltados === 0) mensaje = 'Todos los clientes ya tenían estos datos completos.';
  ui.alert('Listo', mensaje, ui.ButtonSet.OK);
}

