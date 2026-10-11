// apps-script/ClientesService.gs
var COL_SEXO = 'Sexo';
var COL_ALTURA_CM = 'Altura_cm';
var COL_OBJETIVO = 'Objetivo';

function obtenerHojaClientes_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_CLIENTES);
}

function obtenerHojaRespuestas_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_RESPUESTAS);
}

var CABECERA_RESPUESTAS_PENDIENTES = [
  'ID_Cliente', 'Fecha', 'Nombre', 'Peso_kg', 'Peso_anterior', 'Diferencia_peso',
  'Cuello_cm', 'Cintura_cm', 'Cadera_cm', 'Grasa_corporal_pct',
  'Fotos_frente', 'Fotos_perfil', 'Fotos_espalda',
];

// Crea la pestaña "RespuestasPendientes" (con su fila de cabecera) la
// primera vez que hace falta. Guarda, como máximo, una fila por cliente:
// la Parte 1 (peso/medidas/fotos) hasta que llega su Parte 2.
function obtenerHojaRespuestasPendientes_() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ID_RESPUESTAS_PENDIENTES);
  if (!hoja) {
    hoja = SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_ID_RESPUESTAS_PENDIENTES);
    hoja.getRange(1, 1, 1, CABECERA_RESPUESTAS_PENDIENTES.length).setValues([CABECERA_RESPUESTAS_PENDIENTES]);
  }
  return hoja;
}

function obtenerFilaPendiente_(idCliente) {
  var hoja = obtenerHojaRespuestasPendientes_();
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === idCliente) {
      return {
        fila: i + 1,
        idCliente: datos[i][0],
        fecha: datos[i][1],
        nombre: datos[i][2],
        pesoKg: datos[i][3],
        pesoAnterior: datos[i][4],
        diferenciaPeso: datos[i][5],
        cuelloCm: datos[i][6],
        cinturaCm: datos[i][7],
        caderaCm: datos[i][8],
        grasaCorporalPct: datos[i][9],
        fotosFrente: datos[i][10],
        fotosPerfil: datos[i][11],
        fotosEspalda: datos[i][12],
      };
    }
  }
  return null;
}

function guardarFilaPendiente_(datos) {
  var filaValores = [
    datos.idCliente, datos.fecha, datos.nombre, datos.pesoKg,
    datos.pesoAnterior, datos.diferenciaPeso,
    datos.cuelloCm, datos.cinturaCm, datos.caderaCm || '',
    datos.grasaCorporalPct !== null && datos.grasaCorporalPct !== undefined ? datos.grasaCorporalPct : '',
    datos.fotosFrente, datos.fotosPerfil, datos.fotosEspalda,
  ];
  var hoja = obtenerHojaRespuestasPendientes_();
  var existente = obtenerFilaPendiente_(datos.idCliente);
  if (existente) {
    hoja.getRange(existente.fila, 1, 1, filaValores.length).setValues([filaValores]);
  } else {
    hoja.appendRow(filaValores);
  }
}

// clearContent, nunca delete row — ver memoria del proyecto sobre el bug
// de ARRAYFORMULA de 2026-09-07: borrar filas desplaza las que hay debajo
// y puede romper fórmulas que dependan de una posición fija.
function borrarFilaPendiente_(idCliente) {
  var existente = obtenerFilaPendiente_(idCliente);
  if (!existente) return;
  obtenerHojaRespuestasPendientes_().getRange(existente.fila, 1, 1, CABECERA_RESPUESTAS_PENDIENTES.length).clearContent();
}

function buscarClientePorId(idCliente) {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getDataRange().getValues();
  var cabecera = datos[0];
  var idxSexo = cabecera.indexOf(COL_SEXO);
  var idxAltura = cabecera.indexOf(COL_ALTURA_CM);
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === idCliente) {
      return {
        idCliente: datos[i][0],
        nombre: datos[i][1],
        sexo: idxSexo !== -1 ? datos[i][idxSexo] : '',
        alturaCm: idxAltura !== -1 ? datos[i][idxAltura] : '',
      };
    }
  }
  return null;
}

function obtenerIdsClientesExistentes() {
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getRange(2, 1, Math.max(hoja.getMaxRows() - 1, 1), 1).getValues();
  return datos.map(function (fila) { return fila[0]; }).filter(function (valor) { return valor !== ''; });
}

// Scans manually instead of getLastRow(): array formulas in columns E:G
// keep those cells populated, making getLastRow() unreliable on this tab.
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
