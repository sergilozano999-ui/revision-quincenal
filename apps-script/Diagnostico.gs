// apps-script/Diagnostico.gs
//
// Comprobación rápida de qué clientes tienen email puesto en la hoja
// Clientes (hace falta para que les lleguen recordatorios de revisión y de
// pago). Se ve al momento en un aviso, sin tener que revisar el correo.
function comprobarEmailsClientes_() {
  var ui = SpreadsheetApp.getUi();
  try {
    comprobarEmailsClientesInterno_(ui);
  } catch (e) {
    ui.alert('Fallo al comprobar emails', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function comprobarEmailsClientesInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  var idxEmail = obtenerIndiceColumnaEmail_(hoja);
  var datos = hoja.getDataRange().getValues();

  var lineas = [];
  for (var i = 1; i < datos.length; i++) {
    if (!datos[i][0]) continue;
    var nombre = datos[i][1];
    var email = datos[i][idxEmail];
    lineas.push('- ' + nombre + ': ' + (email ? email : '❌ SIN EMAIL'));
  }

  ui.alert(
    'Emails de clientes',
    (lineas.length ? lineas.join('\n') : '(no hay clientes todavía)') +
      '\n\nA los que salen "❌ SIN EMAIL" no les llega ningún recordatorio (ni de revisión ni de pago). ' +
      'Rellénales el email en la columna Email de esta hoja para activarlo.',
    ui.ButtonSet.OK
  );
}
