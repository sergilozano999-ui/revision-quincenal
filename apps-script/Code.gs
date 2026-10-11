// apps-script/Code.gs
function doGet(e) {
  var accion = e.parameter.accion;
  if (accion === 'validar') {
    var cliente = buscarClientePorId(e.parameter.id);
    if (!cliente) {
      return respuestaJson_({ status: 'error', mensaje: 'Enlace no válido' });
    }
    var pendiente = obtenerFilaPendiente_(cliente.idCliente);
    return respuestaJson_({ status: 'ok', nombre: cliente.nombre, sexo: cliente.sexo || '', parte: pendiente ? 2 : 1 });
  }
  return respuestaJson_({ status: 'error', mensaje: 'Acción no reconocida' });
}

function respuestaJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var parte = payload.parte === 2 ? 2 : 1;
  var validacion = validarPayload(payload, parte);
  if (!validacion.valido) {
    return respuestaJson_({ status: 'error', mensaje: validacion.errores.join('; ') });
  }

  var cliente = buscarClientePorId(payload.idCliente);
  if (!cliente) {
    return respuestaJson_({ status: 'error', mensaje: 'Cliente no encontrado' });
  }

  return parte === 1 ? procesarParte1_(cliente, payload) : procesarParte2_(cliente, payload);
}

function procesarParte1_(cliente, payload) {
  if (cliente.sexo === 'Mujer' && !payload.caderaCm) {
    return respuestaJson_({ status: 'error', mensaje: 'Falta la medida de cadera' });
  }

  var fecha = new Date();
  var filasPrevias = obtenerFilasClienteRespuestas(payload.idCliente);
  var comparacionPeso = calcularComparacionPeso(payload.pesoKg, filasPrevias);
  var urlsFotos = guardarFotos_(payload, cliente, fecha, 'pendiente');
  var grasaCorporalPct = calcularGrasaCorporal(
    cliente.sexo, cliente.alturaCm, payload.cuelloCm, payload.cinturaCm, payload.caderaCm
  );

  guardarFilaPendiente_({
    idCliente: payload.idCliente,
    fecha: fecha,
    nombre: cliente.nombre,
    pesoKg: payload.pesoKg,
    pesoAnterior: comparacionPeso.pesoAnterior,
    diferenciaPeso: comparacionPeso.diferencia,
    cuelloCm: payload.cuelloCm,
    cinturaCm: payload.cinturaCm,
    caderaCm: payload.caderaCm || '',
    grasaCorporalPct: grasaCorporalPct,
    fotosFrente: urlsFotos.frente,
    fotosPerfil: urlsFotos.perfil,
    fotosEspalda: urlsFotos.espalda,
  });

  enviarAvisoRapidoAlEntrenador_(cliente, {
    pesoKg: payload.pesoKg,
    diferenciaPeso: comparacionPeso.diferencia,
    grasaCorporalPct: grasaCorporalPct,
    fotosFrente: urlsFotos.frente,
    fotosPerfil: urlsFotos.perfil,
    fotosEspalda: urlsFotos.espalda,
  });

  return respuestaJson_({ status: 'ok', parte: 1 });
}

function procesarParte2_(cliente, payload) {
  var pendiente = obtenerFilaPendiente_(payload.idCliente);
  if (!pendiente) {
    return respuestaJson_({ status: 'error', mensaje: 'Antes de esto hace falta enviar fotos, peso y medidas (Parte 1)' });
  }

  var filasPrevias = obtenerFilasClienteRespuestas(payload.idCliente);
  var numeroRevision = calcularNumeroRevision(filasPrevias);
  var comparacionPeso = { pesoAnterior: pendiente.pesoAnterior, diferencia: pendiente.diferenciaPeso };
  var grasaCorporalPct = pendiente.grasaCorporalPct === '' ? null : pendiente.grasaCorporalPct;

  // Columna A = cuándo se completó el registro (ahora). Columna B = cuándo
  // se hizo el check-in físico real (Parte 1) — la fórmula Última_Revisión
  // de Clientes agrega por la columna B, así que Próxima_Revisión debe
  // seguir contando desde la fecha de las medidas, no desde la de las
  // preguntas. Ver spec, sección "Detalle importante".
  obtenerHojaRespuestas_().appendRow([
    new Date(), pendiente.fecha, payload.idCliente, cliente.nombre, numeroRevision,
    pendiente.pesoKg, comparacionPeso.pesoAnterior, comparacionPeso.diferencia,
    payload.valoracionProgresoFisico, payload.comparacionVisual,
    pendiente.fotosFrente, pendiente.fotosPerfil, pendiente.fotosEspalda,
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
    pendiente.cuelloCm, pendiente.cinturaCm, pendiente.caderaCm || '',
    grasaCorporalPct !== null ? grasaCorporalPct : '',
  ]);

  borrarFilaPendiente_(payload.idCliente);

  enviarMensajeMotivacionalAlEntrenador_(cliente, {
    comparacionVisual: payload.comparacionVisual,
    entrenamientosPrevistos: payload.entrenamientosPrevistos,
    entrenamientosCompletados: payload.entrenamientosCompletados,
  }, comparacionPeso, grasaCorporalPct);
  generarInformeProgreso_(cliente, pendiente.fecha, numeroRevision, pendiente.pesoKg, grasaCorporalPct, pendiente.fotosFrente);

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

// Manda al entrenador un mensaje ya redactado (según cómo le haya ido al
// cliente) listo para copiar y pegar donde quiera enviárselo (WhatsApp, etc).
function enviarMensajeMotivacionalAlEntrenador_(cliente, payload, comparacionPeso, grasaCorporalPct) {
  var mensaje = generarMensajeMotivacional({
    nombre: cliente.nombre,
    comparacionVisual: payload.comparacionVisual,
    entrenamientosPrevistos: payload.entrenamientosPrevistos,
    entrenamientosCompletados: payload.entrenamientosCompletados,
    diferenciaPeso: comparacionPeso.diferencia,
    grasaCorporalPct: grasaCorporalPct,
  });

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: 'Mensaje listo para ' + cliente.nombre,
    body: 'Cópialo y pégalo donde quieras mandárselo:\n\n' + mensaje,
  });
}
