// apps-script/ProgresoService.gs
//
// Hoja "Progreso": un desplegable (B1) para elegir cliente, su Objetivo
// (E1, para saber cómo leer las gráficas) y varios gráficos nativos de
// Sheets (peso, entrenamientos, % grasa corporal, masa magra) que se
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

  // El objetivo (perder grasa / ganar músculo / mantenimiento) es el que
  // dice cómo hay que leer las gráficas de peso y masa magra para ese
  // cliente en concreto — no es lo mismo "el peso sube" siendo buena o mala
  // noticia según lo que busque cada uno.
  hoja.getRange('D1').setValue('Objetivo:').setFontWeight('bold');
  var formulaObjetivo = '=IFERROR(INDEX(Clientes!A:Z;'
    + 'MATCH(B1;Clientes!B:B;0);MATCH("' + COL_OBJETIVO + '";Clientes!A1:Z1;0));"(sin definir)")';
  hoja.getRange('E1').setFormula(formulaObjetivo);
}

function configurarTablaProgreso_(hoja) {
  hoja.getRange(3, 1, FILA_MAX_PROGRESO - 2, 6).clearContent();
  hoja.getRange('A3:F3')
    .setValues([['Fecha', 'Peso (kg)', 'Entren. completados', 'Entren. previstos', '% Grasa corporal', 'Masa magra (kg)']])
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

  // Masa magra = peso sin contar la grasa estimada. Se calcula sola con lo
  // que ya hay en las columnas B (peso) y E (% grasa) — en blanco si falta
  // cualquiera de las dos (revisiones de antes de tener este dato, o
  // clientes sin Sexo/Altura puestos todavía).
  var formulaMasaMagra = '=ARRAYFORMULA(IF((B4:B="")+(E4:E="");"";B4:B*(1-E4:E/100)))';
  hoja.getRange('F4').setFormula(formulaMasaMagra);

  // Sin esto, la fecha que devuelve QUERY puede mostrarse como el número de
  // serie interno (ej. "46280") en vez de una fecha legible, y el gráfico de
  // líneas no la interpreta bien como eje de tiempo.
  hoja.getRange(4, 1, FILA_MAX_PROGRESO - 3, 1).setNumberFormat('dd/mm/yyyy');
  hoja.getRange(4, 2, FILA_MAX_PROGRESO - 3, 1).setNumberFormat('0.0');
  hoja.getRange(4, 3, FILA_MAX_PROGRESO - 3, 2).setNumberFormat('0');
  hoja.getRange(4, 5, FILA_MAX_PROGRESO - 3, 2).setNumberFormat('0.0');
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

  var rangoMasaMagra = hoja.getRange('F3:F' + FILA_MAX_PROGRESO);
  var graficoMasaMagra = hoja.newChart()
    .asLineChart()
    .addRange(rangoFecha)
    .addRange(rangoMasaMagra)
    .setPosition(63, 1, 0, 0)
    .setOption('title', 'Masa magra a lo largo del tiempo (peso sin la grasa estimada)')
    .setOption('legend', { position: 'none' })
    .build();
  hoja.insertChart(graficoMasaMagra);
}
