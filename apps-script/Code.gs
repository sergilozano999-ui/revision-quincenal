// apps-script/Code.gs
function doGet(e) {
  var accion = e.parameter.accion;
  if (accion === 'validar') {
    var cliente = buscarClientePorId(e.parameter.id);
    if (!cliente) {
      return respuestaJson_({ status: 'error', mensaje: 'Enlace no válido' });
    }
    return respuestaJson_({ status: 'ok', nombre: cliente.nombre });
  }
  return respuestaJson_({ status: 'error', mensaje: 'Acción no reconocida' });
}

function respuestaJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var validacion = validarPayload(payload);
  if (!validacion.valido) {
    return respuestaJson_({ status: 'error', mensaje: validacion.errores.join('; ') });
  }

  var cliente = buscarClientePorId(payload.idCliente);
  if (!cliente) {
    return respuestaJson_({ status: 'error', mensaje: 'Cliente no encontrado' });
  }

  var filasPrevias = obtenerFilasClienteRespuestas(payload.idCliente);
  var numeroRevision = calcularNumeroRevision(filasPrevias);
  var comparacionPeso = calcularComparacionPeso(payload.pesoKg, filasPrevias);
  var fecha = new Date();
  var urlsFotos = guardarFotos_(payload, cliente, fecha, numeroRevision);

  obtenerHojaRespuestas_().appendRow([
    fecha, fecha, payload.idCliente, cliente.nombre, numeroRevision,
    payload.pesoKg, comparacionPeso.pesoAnterior, comparacionPeso.diferencia,
    payload.valoracionProgresoFisico, payload.comparacionVisual,
    urlsFotos.frente, urlsFotos.perfil, urlsFotos.espalda,
    payload.comentarioProgresoFisico || '',
    payload.entrenamientosPrevistos, payload.entrenamientosCompletados,
    payload.valoracionEntrenamiento, payload.progresoRendimiento,
    payload.molestias, payload.detalleMolestias || '',
    payload.cumplimientoNutricion, payload.nivelHambre, payload.dificultadPrincipal,
    payload.comentarioNutricion || '',
    payload.pasosDiarios, payload.objetivoPasosCumplido, payload.calidadSueno,
    payload.horasSueno, payload.nivelEnergia, payload.nivelEstres,
    payload.mejorLogro || '', payload.mayorDificultad || '',
    payload.necesidadEntrenador || '', payload.comentarioAdicional || '',
    payload.objetivoProximasSemanas || '', payload.mejoraEspecifica || '',
  ]);

  return respuestaJson_({ status: 'ok', numeroRevision: numeroRevision });
}

function guardarFotos_(payload, cliente, fecha, numeroRevision) {
  var carpetaRaiz = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), CARPETA_FOTOS_RAIZ);
  var carpetaCliente = obtenerOCrearCarpeta_(carpetaRaiz, cliente.idCliente + '_' + cliente.nombre);
  var nombreCarpetaRevision = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd') + '_Revision' + numeroRevision;
  var carpetaRevision = obtenerOCrearCarpeta_(carpetaCliente, nombreCarpetaRevision);

  return {
    frente: guardarFotosCategoria_(carpetaRevision, payload.fotosFrente, 'frente'),
    perfil: guardarFotosCategoria_(carpetaRevision, payload.fotosPerfil, 'perfil'),
    espalda: guardarFotosCategoria_(carpetaRevision, payload.fotosEspalda, 'espalda'),
  };
}

function guardarFotosCategoria_(carpeta, fotosBase64, categoria) {
  if (!fotosBase64 || fotosBase64.length === 0) return '';
  var urls = fotosBase64.map(function (base64, indice) {
    var partes = base64.split(',');
    var datos = partes.length > 1 ? partes[1] : partes[0];
    var blob = Utilities.newBlob(Utilities.base64Decode(datos), 'image/jpeg', categoria + '_' + (indice + 1) + '.jpg');
    var archivo = carpeta.createFile(blob);
    return archivo.getUrl();
  });
  return urls.join(', ');
}

function obtenerOCrearCarpeta_(padre, nombre) {
  var carpetas = padre.getFoldersByName(nombre);
  return carpetas.hasNext() ? carpetas.next() : padre.createFolder(nombre);
}
