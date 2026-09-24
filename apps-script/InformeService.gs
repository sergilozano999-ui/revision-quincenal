// apps-script/InformeService.gs
//
// Tras cada revisión, genera un PDF de progreso (foto "antes"/"ahora",
// datos actuales y un mensaje cálido) y te lo manda a ti por email para que
// lo revises antes de decidir mandarlo también al cliente. Si algo falla,
// no bloquea el guardado de la revisión del cliente — solo te llega un
// aviso del fallo.
var COL_FOTO_ANTES_MANUAL = 'Foto_Antes_Manual_URL';

function generarInformeProgreso_(cliente, fecha, numeroRevision, pesoKg, grasaCorporalPct, urlFrenteActual) {
  try {
    generarInformeProgresoInterno_(cliente, fecha, numeroRevision, pesoKg, grasaCorporalPct, urlFrenteActual);
  } catch (e) {
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: 'Aviso: no se pudo generar el informe PDF de ' + cliente.nombre,
      body: 'La revisión de ' + cliente.nombre + ' se ha guardado correctamente, ' +
        'pero no se pudo generar su informe PDF.\n\nDetalle técnico: ' + String(e && e.message || e),
    });
  }
}

function generarInformeProgresoInterno_(cliente, fecha, numeroRevision, pesoKg, grasaCorporalPct, urlFrenteActual) {
  var urlFotoAhora = primeraUrlFoto(urlFrenteActual);
  var urlFotoAntes = seleccionarFotoAntes({
    fotoAntesManualUrl: obtenerFotoAntesManual_(cliente.idCliente),
    filasPrevias: obtenerFilasFrenteClienteOrdenadas_(cliente.idCliente),
    fotoActualUrl: urlFotoAhora,
  });
  var mensaje = generarMensajeInforme({ nombre: cliente.nombre });

  var pdfBlob = construirPdfInforme_(cliente, fecha, numeroRevision, pesoKg, grasaCorporalPct, urlFotoAntes, urlFotoAhora, mensaje);

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'Informe de progreso listo: ' + cliente.nombre,
    body: 'Revisa el PDF adjunto antes de decidir si se lo mandas al cliente.',
    attachments: [pdfBlob],
  });
}

function obtenerFotoAntesManual_(idCliente) {
  var hoja = obtenerHojaClientes_();
  var idxFotoManual = obtenerIndiceColumna_(hoja, COL_FOTO_ANTES_MANUAL);
  var datos = hoja.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] === idCliente) {
      return datos[i][idxFotoManual] || '';
    }
  }
  return '';
}

// Todas las filas de Respuestas de este cliente (incluida la que se acaba
// de guardar), ordenadas de más antigua a más reciente, solo con su URL de
// Fotos_Frente. seleccionarFotoAntes ya sabe saltar las que no tengan foto
// y caer en la foto actual si esta es la primera revisión del cliente.
function obtenerFilasFrenteClienteOrdenadas_(idCliente) {
  var hoja = obtenerHojaRespuestas_();
  var datos = hoja.getDataRange().getValues();
  var cabecera = datos[0];
  var idxId = cabecera.indexOf('ID_Cliente');
  var idxFecha = cabecera.indexOf('Fecha');
  var idxFrente = cabecera.indexOf('Fotos_Frente');

  var filas = [];
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][idxId] === idCliente) {
      filas.push({ fecha: datos[i][idxFecha], urlFrente: primeraUrlFoto(datos[i][idxFrente]) });
    }
  }
  filas.sort(function (a, b) { return a.fecha - b.fecha; });
  return filas;
}

var COLOR_BANNER = '#1E3A8A';
var COLOR_BANNER_SUBTITULO = '#BFDBFE';
var COLOR_TARJETA_FOTO = '#F3F4F6';
var COLOR_CAPTION_FOTO = '#1E3A8A';
var COLOR_TARJETA_DATO = '#EFF6FF';
var COLOR_TEXTO_DATO = '#1D4ED8';
var COLOR_ETIQUETA_DATO = '#6B7280';
var COLOR_TARJETA_MENSAJE = '#FFFBEB';
var COLOR_TEXTO_MENSAJE = '#78350F';

function construirPdfInforme_(cliente, fecha, numeroRevision, pesoKg, grasaCorporalPct, urlFotoAntes, urlFotoAhora, mensaje) {
  var nombreDoc = 'Informe_' + cliente.nombre + '_Revision' + numeroRevision;
  var doc = DocumentApp.create(nombreDoc);
  var cuerpo = doc.getBody();
  cuerpo.setMarginTop(28).setMarginBottom(28).setMarginLeft(36).setMarginRight(36);

  agregarBannerInforme_(cuerpo, cliente, fecha);
  cuerpo.appendParagraph('').setFontSize(4);
  agregarFotosInforme_(cuerpo, urlFotoAntes, urlFotoAhora);
  cuerpo.appendParagraph('').setFontSize(8);
  agregarDatosInforme_(cuerpo, pesoKg, grasaCorporalPct);
  cuerpo.appendParagraph('').setFontSize(8);
  agregarMensajeInforme_(cuerpo, mensaje);

  doc.saveAndClose();
  var archivo = DriveApp.getFileById(doc.getId());
  var pdfBlob = archivo.getAs(MimeType.PDF).setName(nombreDoc + '.pdf');

  var carpetaInformes = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), NOMBRE_CARPETA_INFORMES);
  archivo.moveTo(carpetaInformes);

  return pdfBlob;
}

// Nota: aquí se evita encadenar varias llamadas de estilo seguidas (ej.
// x.setBold(true).setFontSize(12)...) porque algunos setters del servicio
// Document no devuelven el propio elemento — se hace una llamada por línea.
function estilizarParrafo_(parrafo, opciones) {
  if (opciones.negrita) parrafo.setBold(true);
  if (opciones.cursiva) parrafo.setItalic(true);
  if (opciones.tamano) parrafo.setFontSize(opciones.tamano);
  if (opciones.color) parrafo.setForegroundColor(opciones.color);
  parrafo.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

function estilizarCelda_(celda, colorFondo, relleno) {
  celda.setBackgroundColor(colorFondo);
  celda.setPaddingTop(relleno.arriba);
  celda.setPaddingBottom(relleno.abajo);
  celda.setPaddingLeft(relleno.izquierda);
  celda.setPaddingRight(relleno.derecha);
}

function agregarBannerInforme_(cuerpo, cliente, fecha) {
  var tablaBanner = cuerpo.appendTable([[cliente.nombre]]);
  tablaBanner.setBorderWidth(0);
  var celdaBanner = tablaBanner.getRow(0).getCell(0);
  estilizarCelda_(celdaBanner, COLOR_BANNER, { arriba: 20, abajo: 20, izquierda: 24, derecha: 24 });

  var parrafoNombre = celdaBanner.getChild(0).asParagraph();
  estilizarParrafo_(parrafoNombre, { negrita: true, tamano: 22, color: '#FFFFFF' });

  var textoFecha = 'Informe de progreso · ' + Utilities.formatDate(fecha, Session.getScriptTimeZone(), "d 'de' MMMM 'de' yyyy");
  var parrafoFecha = celdaBanner.appendParagraph(textoFecha);
  estilizarParrafo_(parrafoFecha, { tamano: 11, color: COLOR_BANNER_SUBTITULO });
}

function agregarFotosInforme_(cuerpo, urlFotoAntes, urlFotoAhora) {
  var tablaFotos = cuerpo.appendTable([['ANTES', 'AHORA'], ['', '']]);
  tablaFotos.setBorderWidth(0);
  tablaFotos.setColumnWidth(0, 250);
  tablaFotos.setColumnWidth(1, 250);

  [0, 1].forEach(function (columna) {
    var celdaCaption = tablaFotos.getRow(0).getCell(columna);
    estilizarCelda_(celdaCaption, COLOR_TARJETA_FOTO, { arriba: 10, abajo: 0, izquierda: 10, derecha: 10 });
    var parrafoCaption = celdaCaption.getChild(0).asParagraph();
    estilizarParrafo_(parrafoCaption, { negrita: true, tamano: 11, color: COLOR_CAPTION_FOTO });

    var celdaFoto = tablaFotos.getRow(1).getCell(columna);
    estilizarCelda_(celdaFoto, COLOR_TARJETA_FOTO, { arriba: 6, abajo: 16, izquierda: 12, derecha: 12 });
  });

  insertarFotoEnCelda_(tablaFotos.getRow(1).getCell(0), urlFotoAntes);
  insertarFotoEnCelda_(tablaFotos.getRow(1).getCell(1), urlFotoAhora);
}

function agregarDatosInforme_(cuerpo, pesoKg, grasaCorporalPct) {
  var tieneGrasa = typeof grasaCorporalPct === 'number';
  var filaDatos = tieneGrasa ? [' ', ' '] : [' '];
  var tablaDatos = cuerpo.appendTable([filaDatos]);
  tablaDatos.setBorderWidth(0);
  var anchoColumna = tieneGrasa ? 250 : 500;
  tablaDatos.setColumnWidth(0, anchoColumna);
  if (tieneGrasa) tablaDatos.setColumnWidth(1, anchoColumna);

  agregarTarjetaDato_(tablaDatos.getRow(0).getCell(0), pesoKg + ' kg', 'PESO ACTUAL');
  if (tieneGrasa) {
    agregarTarjetaDato_(tablaDatos.getRow(0).getCell(1), grasaCorporalPct + '%', '% GRASA CORPORAL ESTIMADO');
  }
}

function agregarTarjetaDato_(celda, valor, etiqueta) {
  estilizarCelda_(celda, COLOR_TARJETA_DATO, { arriba: 14, abajo: 14, izquierda: 10, derecha: 10 });

  var parrafoValor = celda.getChild(0).asParagraph();
  parrafoValor.setText(valor);
  estilizarParrafo_(parrafoValor, { negrita: true, tamano: 20, color: COLOR_TEXTO_DATO });

  var parrafoEtiqueta = celda.appendParagraph(etiqueta);
  estilizarParrafo_(parrafoEtiqueta, { tamano: 9, color: COLOR_ETIQUETA_DATO });
}

function agregarMensajeInforme_(cuerpo, mensaje) {
  var tablaMensaje = cuerpo.appendTable([[mensaje]]);
  tablaMensaje.setBorderWidth(0);
  var celdaMensaje = tablaMensaje.getRow(0).getCell(0);
  estilizarCelda_(celdaMensaje, COLOR_TARJETA_MENSAJE, { arriba: 16, abajo: 16, izquierda: 20, derecha: 20 });

  var parrafoMensaje = celdaMensaje.getChild(0).asParagraph();
  estilizarParrafo_(parrafoMensaje, { cursiva: true, tamano: 12, color: COLOR_TEXTO_MENSAJE });
}

function insertarFotoEnCelda_(celda, urlFoto) {
  var idArchivo = urlFoto ? extraerIdDrive(urlFoto) : null;
  if (!idArchivo) {
    celda.editAsText().setText('(sin foto)');
    return;
  }
  var blobFoto = DriveApp.getFileById(idArchivo).getBlob();
  celda.editAsText().setText('');
  var imagen = celda.appendImage(blobFoto);
  var anchoMax = 220;
  if (imagen.getWidth() > anchoMax) {
    var ratio = anchoMax / imagen.getWidth();
    imagen.setWidth(anchoMax);
    imagen.setHeight(Math.round(imagen.getHeight() * ratio));
  }
}

// --- Foto "antes" personalizada (menú) ---

function subirFotoAntesPersonalizada_() {
  var ui = SpreadsheetApp.getUi();
  var hoja = obtenerHojaClientes_();
  var datos = hoja.getRange(2, 1, Math.max(hoja.getMaxRows() - 1, 1), 2).getValues();
  var clientes = datos
    .filter(function (fila) { return fila[0]; })
    .map(function (fila) { return { idCliente: fila[0], nombre: fila[1] }; });

  if (clientes.length === 0) {
    ui.alert('Todavía no hay clientes creados.');
    return;
  }

  var plantilla = HtmlService.createTemplateFromFile('SubirFotoAntesDialog');
  plantilla.clientes = clientes;
  var html = plantilla.evaluate().setWidth(400).setHeight(340);
  ui.showModalDialog(html, 'Foto "antes" personalizada');
}

// Llamada desde SubirFotoAntesDialog.html vía google.script.run.
function guardarFotoAntesManual_(idCliente, fotoBase64) {
  var cliente = buscarClientePorId(idCliente);
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }

  var carpetaRaiz = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), CARPETA_FOTOS_RAIZ);
  var carpetaCliente = obtenerOCrearCarpeta_(carpetaRaiz, cliente.idCliente + '_' + cliente.nombre);

  var partes = fotoBase64.split(',');
  var datosImagen = partes.length > 1 ? partes[1] : partes[0];
  var blob = Utilities.newBlob(Utilities.base64Decode(datosImagen), 'image/jpeg', 'antes_manual.jpg');
  var archivo = carpetaCliente.createFile(blob);

  var hoja = obtenerHojaClientes_();
  var idxFotoManual = obtenerIndiceColumna_(hoja, COL_FOTO_ANTES_MANUAL);
  var filas = hoja.getDataRange().getValues();
  for (var i = 1; i < filas.length; i++) {
    if (filas[i][0] === idCliente) {
      hoja.getRange(i + 1, idxFotoManual + 1).setValue(archivo.getUrl());
      return;
    }
  }
  throw new Error('Cliente no encontrado en la hoja');
}
