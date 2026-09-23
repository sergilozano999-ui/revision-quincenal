// apps-script/PagosService.gs
var COL_PROXIMO_PAGO = 'Próximo_Pago';
var COL_PAGADO = 'Pagado';
var DIAS_AVISO_PAGO = 5;

function obtenerIndiceColumna_(hoja, nombreColumna) {
  var cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var idx = cabecera.indexOf(nombreColumna);
  if (idx === -1) {
    idx = cabecera.length;
    hoja.getRange(1, idx + 1).setValue(nombreColumna);
  }
  return idx;
}

function enviarAvisosPago() {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getDataRange().getValues();
  var cabecera = datos[0];
  var idxProximoPago = obtenerIndiceColumna_(hoja, COL_PROXIMO_PAGO);
  obtenerIndiceColumna_(hoja, COL_PAGADO);
  var idxEmailCliente = obtenerIndiceColumnaEmail_(hoja);
  var hoy = new Date();
  var emailPropietario = Session.getEffectiveUser().getEmail();

  for (var i = 1; i < datos.length; i++) {
    var fila = datos[i];
    var idCliente = fila[0];
    var nombre = fila[1];
    var proximoPago = fila[idxProximoPago];
    if (!idCliente || !faltanDiasParaPago(proximoPago, hoy, DIAS_AVISO_PAGO)) continue;

    var fechaTexto = Utilities.formatDate(proximoPago, Session.getScriptTimeZone(), 'dd/MM/yyyy');

    MailApp.sendEmail({
      to: emailPropietario,
      subject: 'Aviso: pago pendiente de ' + nombre,
      body:
        nombre + ' tiene el próximo pago programado para el ' + fechaTexto +
        ' (dentro de ' + DIAS_AVISO_PAGO + ' días).\n\n' +
        'Cuando lo cobres, marca "Sí" en la columna Pagado de ese cliente y la próxima fecha se actualizará sola.'
    });

    var emailCliente = idxEmailCliente !== -1 ? fila[idxEmailCliente] : '';
    if (emailCliente) {
      MailApp.sendEmail({
        to: emailCliente,
        subject: 'Recordatorio: tu próximo pago',
        body:
          'Hola ' + nombre + ',\n\n' +
          'Este es un recordatorio de que tu próximo pago está previsto para el ' + fechaTexto +
          '.\n\nCualquier duda, contacta con tu entrenador.\n\n¡Gracias!'
      });
    }
  }
}

// Trigger simple: se ejecuta automáticamente al editar la hoja, sin necesidad
// de configurarlo desde el menú. Si además existe un onEdit en otro archivo,
// Apps Script solo permite una función con ese nombre en todo el proyecto.
function onEdit(e) {
  actualizarProximoPagoSiMarcado_(e);
}

function actualizarProximoPagoSiMarcado_(e) {
  var hoja = e.range.getSheet();
  if (hoja.getName() !== SHEET_ID_CLIENTES) return;
  if (e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;

  var cabecera = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  var idxPagado = cabecera.indexOf(COL_PAGADO);
  if (idxPagado === -1 || e.range.getColumn() !== idxPagado + 1) return;

  var valor = String(e.range.getValue()).trim().toLowerCase();
  if (valor !== 'sí' && valor !== 'si') return;

  var idxProximoPago = cabecera.indexOf(COL_PROXIMO_PAGO);
  if (idxProximoPago === -1) return;

  var celdaFecha = hoja.getRange(e.range.getRow(), idxProximoPago + 1);
  var fechaActual = celdaFecha.getValue();
  if (!(fechaActual instanceof Date)) return;

  celdaFecha.setValue(calcularSiguienteFechaPago(fechaActual));
  e.range.setValue('No');
}
