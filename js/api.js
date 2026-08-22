(function (root) {
  function construirUrlValidacion(apiUrl, idCliente) {
    return apiUrl + '?accion=validar&id=' + encodeURIComponent(idCliente);
  }

  async function validarCliente(apiUrl, idCliente) {
    var respuesta = await fetch(construirUrlValidacion(apiUrl, idCliente));
    if (!respuesta.ok) {
      throw new Error('No se pudo comprobar el enlace');
    }
    return respuesta.json();
  }

  async function enviarRevision(apiUrl, payload) {
    var respuesta = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!respuesta.ok) {
      throw new Error('No se pudo enviar la revisión');
    }
    var resultado = await respuesta.json();
    if (resultado.status !== 'ok') {
      throw new Error(resultado.mensaje || 'Error al guardar la revisión');
    }
    return resultado;
  }

  var api = { construirUrlValidacion: construirUrlValidacion, validarCliente: validarCliente, enviarRevision: enviarRevision };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.RevisionApi = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
