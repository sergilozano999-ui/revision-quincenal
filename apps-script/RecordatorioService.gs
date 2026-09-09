// apps-script/RecordatorioService.gs
var COL_EMAIL_NOMBRE = 'Email';

function obtenerIndiceColumnaEmail_(hoja) {
  var cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var idx = cabecera.indexOf(COL_EMAIL_NOMBRE);
  if (idx === -1) {
    idx = cabecera.length;
    hoja.getRange(1, idx + 1).setValue(COL_EMAIL_NOMBRE);
  }
  return idx;
}

function enviarRecordatorios() {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getDataRange().getValues();
  var cabecera = datos[0];
  var idxProxima = cabecera.indexOf('Próxima_Revisión');
  var idxEmail = obtenerIndiceColumnaEmail_(hoja);
  var hoy = new Date();

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var idCliente = fila[0];
    var nombre = fila[1];
    var email = fila[idxEmail];
    var proximaRevision = fila[idxProxima];
    if (!idCliente || !email || !esRevisionManana(proximaRevision, hoy)) continue;

    var enlace = URL_BASE_FRONTEND + '?id=' + idCliente;
    MailApp.sendEmail({
      to: email,
      subject: 'Recordatorio: tu revisión quincenal es mañana',
      body:
        'Hola ' + nombre + ',\n\n' +
        'Mañana toca tu revisión quincenal. Puedes hacerla desde tu enlace personal:\n' +
        enlace + '\n\n' +
        '¡Nos vemos mañana!'
    });
  }
}
