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
