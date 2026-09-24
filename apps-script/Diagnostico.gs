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

// Crea (si no existe ya) un cliente de prueba "ZZTEST01" y simula el envío
// de su cuestionario, para comprobar de verdad el email con el mensaje
// motivacional sin esperar a que un cliente real lo rellene. Reutilizable:
// se puede pulsar varias veces sin duplicar el cliente de prueba.
var ID_CLIENTE_PRUEBA = 'ZZTEST01';

function probarMensajeMotivacional_() {
  var ui = SpreadsheetApp.getUi();
  try {
    probarMensajeMotivacionalInterno_(ui);
  } catch (e) {
    ui.alert('Fallo en la prueba', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function probarMensajeMotivacionalInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  var idsExistentes = obtenerIdsClientesExistentes();
  if (idsExistentes.indexOf(ID_CLIENTE_PRUEBA) === -1) {
    var fila = obtenerSiguienteFilaClientes_(hoja);
    hoja.getRange(fila, 1, 1, 4).setValues([[ID_CLIENTE_PRUEBA, 'Cliente de Prueba', new Date(), '']]);
    var idxSexo = obtenerIndiceColumna_(hoja, COL_SEXO);
    var idxAltura = obtenerIndiceColumna_(hoja, COL_ALTURA_CM);
    hoja.getRange(fila, idxSexo + 1).setValue('Hombre');
    hoja.getRange(fila, idxAltura + 1).setValue(178);
  }

  var payload = {
    idCliente: ID_CLIENTE_PRUEBA,
    pesoKg: 79.5, cuelloCm: 38, cinturaCm: 84,
    valoracionProgresoFisico: 8, comparacionVisual: 'Mejor',
    entrenamientosPrevistos: 8, entrenamientosCompletados: 7,
    valoracionEntrenamiento: 8, progresoRendimiento: 'Sí',
    molestias: 'No',
    cumplimientoNutricion: 7, nivelHambre: 5, dificultadPrincipal: 'Nada',
    pasosDiarios: 9000, objetivoPasosCumplido: 'Sí', calidadSueno: 7,
    horasSueno: 7.5, nivelEnergia: 7, nivelEstres: 3,
  };

  doPost({ postData: { contents: JSON.stringify(payload) } });

  ui.alert(
    'Prueba enviada',
    'Revisa tu correo — debería haberte llegado un email con asunto ' +
      '"Mensaje listo para Cliente de Prueba".\n\n' +
      'El cliente ZZTEST01 es de prueba: cuando confirmes que el email llegó bien, ' +
      'dile a Claude que limpie los datos de prueba para dejar el Sheet como estaba.',
    ui.ButtonSet.OK
  );
}

// Imágenes de prueba (rojo = "antes", azul = "ahora") solo para ver cómo
// queda el informe PDF sin depender de fotos reales de ningún cliente.
var FOTO_PRUEBA_ROJA_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAIAAAABc2X6AAAAdElEQVR4nO3PAQkAMAzAsAmbfy7rMg59oAKaObtfNc8PgIGBgYGBgb8JuB5wPeB6wPWA6wHXA64HXA+4HnA94HrA9YDrAdcDrgdcD7gecD3gesD1gOsB1wOuB1wPuB5wPeB6wPWA6wHXA64HXA+4HnA94HoX73xB0isej70AAAAASUVORK5CYII=';
var FOTO_PRUEBA_AZUL_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAFAAAABQCAIAAAABc2X6AAAAdUlEQVR4nO3PAQkAIBDAQIOZxMTGMoawP1iA3drnjmp9PwAGBgYGBgYeE3A94HrA9YDrAdcDrgdcD7gecD3gesD1gOsB1wOuB1wPuB5wPeB6wPWA6wHXA64HXA+4HnA94HrA9YDrAdcDrgdcD7gecD3gesD1Hj0eL//JO84GAAAAAElFTkSuQmCC';

// Genera un informe PDF de prueba (con dos imágenes de color liso, roja de
// "antes" y azul de "ahora", no fotos reales) para que puedas ver cómo
// queda el diseño y el email antes de confiar en la función con clientes
// reales. Crea el cliente ZZTEST01 si no existe. Limpiar con
// "🧹 Limpiar datos de prueba" cuando termines de revisarlo.
function probarInformeProgreso_() {
  var ui = SpreadsheetApp.getUi();
  try {
    probarInformeProgresoInterno_(ui);
  } catch (e) {
    ui.alert('Fallo en la prueba', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function probarInformeProgresoInterno_(ui) {
  var hoja = obtenerHojaClientes_();
  var idsExistentes = obtenerIdsClientesExistentes();
  if (idsExistentes.indexOf(ID_CLIENTE_PRUEBA) === -1) {
    var fila = obtenerSiguienteFilaClientes_(hoja);
    hoja.getRange(fila, 1, 1, 4).setValues([[ID_CLIENTE_PRUEBA, 'Cliente de Prueba', new Date(), '']]);
  }

  var carpetaRaiz = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), CARPETA_FOTOS_RAIZ);
  var carpetaCliente = obtenerOCrearCarpeta_(carpetaRaiz, ID_CLIENTE_PRUEBA + '_Cliente de Prueba');
  var archivoRojo = carpetaCliente.createFile(
    Utilities.newBlob(Utilities.base64Decode(FOTO_PRUEBA_ROJA_BASE64), 'image/png', 'prueba_antes.png')
  );
  var archivoAzul = carpetaCliente.createFile(
    Utilities.newBlob(Utilities.base64Decode(FOTO_PRUEBA_AZUL_BASE64), 'image/png', 'prueba_ahora.png')
  );

  var idxFotoManual = obtenerIndiceColumna_(hoja, COL_FOTO_ANTES_MANUAL);
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === ID_CLIENTE_PRUEBA) {
      hoja.getRange(i + 1, idxFotoManual + 1).setValue(archivoRojo.getUrl());
      break;
    }
  }

  // Llamamos directo a la versión interna (sin el try/catch que en real
  // manda un email de aviso) para que, si algo falla, el error salga aquí
  // mismo en un mensaje en pantalla en vez de tener que ir a mirar el correo.
  generarInformeProgresoInterno_(
    { idCliente: ID_CLIENTE_PRUEBA, nombre: 'Cliente de Prueba' },
    new Date(), 1, 79.5, 18.5, archivoAzul.getUrl()
  );

  ui.alert(
    'Informe de prueba enviado',
    'Revisa tu correo — debería haberte llegado un email con asunto ' +
      '"Informe de progreso listo: Cliente de Prueba", con un PDF adjunto ' +
      '(imagen roja = "antes", azul = "ahora", solo para ver el diseño).\n\n' +
      'Cuando lo hayas revisado, dile a Claude que limpie los datos de prueba.',
    ui.ButtonSet.OK
  );
}

// Borra (clearContent, nunca delete row — ver memoria del proyecto sobre el
// bug de ARRAYFORMULA de 2026-09-07) los datos del cliente de prueba
// ZZTEST01 en Clientes y Respuestas, y su carpeta vacía de fotos en Drive.
function limpiarClientePrueba_() {
  var ui = SpreadsheetApp.getUi();
  try {
    limpiarClientePruebaInterno_(ui);
  } catch (e) {
    ui.alert('Fallo al limpiar', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function limpiarClientePruebaInterno_(ui) {
  var hojaClientes = obtenerHojaClientes_();
  var datosClientes = hojaClientes.getDataRange().getValues();
  for (var i = 1; i < datosClientes.length; i++) {
    if (datosClientes[i][0] === ID_CLIENTE_PRUEBA) {
      hojaClientes.getRange(i + 1, 1, 1, hojaClientes.getLastColumn()).clearContent();
      break;
    }
  }

  var hojaRespuestas = obtenerHojaRespuestas_();
  var datosRespuestas = hojaRespuestas.getDataRange().getValues();
  for (var j = 1; j < datosRespuestas.length; j++) {
    if (datosRespuestas[j][2] === ID_CLIENTE_PRUEBA) { // columna C = ID_Cliente
      hojaRespuestas.getRange(j + 1, 1, 1, hojaRespuestas.getLastColumn()).clearContent();
    }
  }

  var carpetaRaiz = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), CARPETA_FOTOS_RAIZ);
  var carpetasCliente = carpetaRaiz.getFoldersByName(ID_CLIENTE_PRUEBA + '_Cliente de Prueba');
  while (carpetasCliente.hasNext()) {
    carpetasCliente.next().setTrashed(true);
  }

  var carpetaInformes = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), NOMBRE_CARPETA_INFORMES);
  var archivosInforme = carpetaInformes.getFilesByName('Informe_Cliente de Prueba_Revision1');
  while (archivosInforme.hasNext()) {
    archivosInforme.next().setTrashed(true);
  }

  ui.alert('Limpieza hecha', 'Los datos de prueba (ZZTEST01) se han borrado. Tu Sheet está como antes.', ui.ButtonSet.OK);
}
