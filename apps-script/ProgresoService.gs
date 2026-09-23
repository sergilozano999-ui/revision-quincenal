// apps-script/ProgresoService.gs
//
// Hoja "Progreso": un desplegable (B1) para elegir cliente y dos gráficos
// nativos de Sheets (peso y cumplimiento de entrenamientos) que se
// actualizan solos al cambiar el desplegable, porque están enlazados a una
// fórmula QUERY que filtra la pestaña Respuestas por el cliente elegido.
//
// Enfoque deliberadamente simple: sin sidebar, sin lógica en el servidor
// para "ver progreso" — todo vive en fórmulas y en un gráfico de Sheets,
// como se decidió al capturar esta idea (ver memoria del proyecto).
var NOMBRE_HOJA_PROGRESO = 'Progreso';
var FILA_MAX_PROGRESO = 103; // cabecera en fila 3 + hasta 100 revisiones de un mismo cliente

function verProgreso_() {
  var ui = SpreadsheetApp.getUi();
  try {
    verProgresoInterno_(ui);
  } catch (e) {
    ui.alert('Fallo al preparar la hoja de progreso', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function verProgresoInterno_(ui) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(NOMBRE_HOJA_PROGRESO);
  if (!hoja) {
    hoja = ss.insertSheet(NOMBRE_HOJA_PROGRESO);
  }

  configurarSelectorCliente_(hoja);
  configurarTablaProgreso_(hoja);
  configurarGraficosProgreso_(hoja);

  ss.setActiveSheet(hoja);
  ui.alert(
    'Hoja de progreso lista',
    'Elige un cliente en el desplegable de la celda B1 de la pestaña "Progreso". ' +
      'Los gráficos se actualizan solos al cambiar el cliente.',
    ui.ButtonSet.OK
  );
}

function configurarSelectorCliente_(hoja) {
  var hojaClientes = obtenerHojaClientes_();
  hoja.getRange('A1').setValue('Cliente:').setFontWeight('bold');

  var rangoNombres = hojaClientes.getRange(2, 2, Math.max(hojaClientes.getMaxRows() - 1, 1), 1);
  var validacion = SpreadsheetApp.newDataValidation()
    .requireValueInRange(rangoNombres, true)
    .setAllowInvalid(false)
    .build();
  var celdaSelector = hoja.getRange('B1');
  celdaSelector.setDataValidation(validacion);

  var valorActual = celdaSelector.getValue();
  if (!valorActual) {
    var primerNombre = hojaClientes.getRange(2, 2).getValue();
    if (primerNombre) {
      celdaSelector.setValue(primerNombre);
    }
  }
}

function configurarTablaProgreso_(hoja) {
  hoja.getRange(3, 1, FILA_MAX_PROGRESO - 2, 5).clearContent();
  hoja.getRange('A3:E3')
    .setValues([['Fecha', 'Peso (kg)', 'Entren. completados', 'Entren. previstos', '% Grasa corporal']])
    .setFontWeight('bold');

  // Locale de esta hoja = español, así que las fórmulas necesitan ";" como
  // separador de argumentos incluso puestas por código (ver memoria del
  // proyecto sobre el bug de ARRAYFORMULA/MAXIFS de 2026-09-07). La cadena
  // de la propia query (select/where/order by) sí usa comas siempre, es un
  // lenguaje aparte que no depende del locale de la hoja.
  // headers=1 le dice a QUERY que la fila 1 de Respuestas es cabecera, para
  // que infiera bien los tipos (fecha, número) en vez de tratarlo todo como
  // texto — importante para que el eje de fechas del gráfico salga bien.
  // Columna AN = % Grasa corporal, calculada y guardada por Code.gs al recibir
  // cada revisión (ver calcularGrasaCorporal en lib/grasaCorporalCalculator.gs).
  var formula = '=IFERROR(QUERY(Respuestas!A:AN;'
    + '"select A, F, P, O, AN where D = \'"&B1&"\' order by A";1);"")';
  hoja.getRange('A4').setFormula(formula);
}

function configurarGraficosProgreso_(hoja) {
  hoja.getCharts().forEach(function (grafico) {
    hoja.removeChart(grafico);
  });

  var rangoFechaPeso = hoja.getRange('A3:B' + FILA_MAX_PROGRESO);
  var graficoPeso = hoja.newChart()
    .asLineChart()
    .addRange(rangoFechaPeso)
    .setPosition(6, 1, 0, 0)
    .setOption('title', 'Peso a lo largo del tiempo')
    .setOption('legend', { position: 'none' })
    .build();
  hoja.insertChart(graficoPeso);

  var rangoFecha = hoja.getRange('A3:A' + FILA_MAX_PROGRESO);
  var rangoEntrenamientos = hoja.getRange('C3:D' + FILA_MAX_PROGRESO);
  var graficoEntrenamientos = hoja.newChart()
    .asLineChart()
    .addRange(rangoFecha)
    .addRange(rangoEntrenamientos)
    .setPosition(25, 1, 0, 0)
    .setOption('title', 'Entrenamientos completados vs. previstos')
    .build();
  hoja.insertChart(graficoEntrenamientos);

  var rangoGrasa = hoja.getRange('E3:E' + FILA_MAX_PROGRESO);
  var graficoGrasa = hoja.newChart()
    .asLineChart()
    .addRange(rangoFecha)
    .addRange(rangoGrasa)
    .setPosition(44, 1, 0, 0)
    .setOption('title', '% Grasa corporal a lo largo del tiempo')
    .setOption('legend', { position: 'none' })
    .build();
  hoja.insertChart(graficoGrasa);
}
