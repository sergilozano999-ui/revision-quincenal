// apps-script/ClientesService.gs
function obtenerHojaClientes_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_CLIENTES);
}

function obtenerHojaRespuestas_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_RESPUESTAS);
}

function buscarClientePorId(idCliente) {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === idCliente) {
      return { idCliente: datos[i][0], nombre: datos[i][1] };
    }
  }
  return null;
}

function obtenerIdsClientesExistentes() {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getRange(2, 1, Math.max(hoja.getMaxRows() - 1, 1), 1).getValues();
  return datos.map(function (fila) { return fila[0]; }).filter(function (valor) { return valor !== ''; });
}

function obtenerSiguienteFilaClientes_(hoja) {
  var datos = hoja.getRange(2, 1, Math.max(hoja.getMaxRows() - 1, 1), 1).getValues();
  for (var i = 0; i < datos.length; i++) {
    if (datos[i][0] === '') {
      return i + 2;
    }
  }
  return hoja.getMaxRows() + 1;
}

function obtenerFilasClienteRespuestas(idCliente) {
  var hoja = obtenerHojaRespuestas_();
  var datos = hoja.getDataRange().getValues();
  var cabecera = datos[0];
  var idxId = cabecera.indexOf('ID_Cliente');
  var idxPeso = cabecera.indexOf('Peso_kg');
  var filas = [];
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][idxId] === idCliente) {
      filas.push({ pesoKg: datos[i][idxPeso] });
    }
  }
  return filas;
}
