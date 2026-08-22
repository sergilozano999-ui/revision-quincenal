// js/validation.js
(function (root) {
  function obtenerCamposVisibles(seccion, respuestas) {
    return seccion.campos.filter(function (campo) {
      if (!campo.dependeDe) return true;
      return respuestas[campo.dependeDe.campo] === campo.dependeDe.igualA;
    });
  }

  function validarSeccion(seccion, respuestas) {
    var errores = {};
    obtenerCamposVisibles(seccion, respuestas).forEach(function (campo) {
      if (!campo.obligatorio) return;
      var valor = respuestas[campo.id];

      if (campo.tipo === 'escala') {
        if (typeof valor !== 'number' || valor < 1 || valor > 10) {
          errores[campo.id] = 'Selecciona un valor del 1 al 10';
        }
        return;
      }
      if (campo.tipo === 'numero') {
        if (typeof valor !== 'number' || Number.isNaN(valor)) {
          errores[campo.id] = 'Introduce un número';
        }
        return;
      }
      if (valor === undefined || valor === null || String(valor).trim() === '') {
        errores[campo.id] = 'Este campo es obligatorio';
      }
    });
    return errores;
  }

  function seccionEsValida(seccion, respuestas) {
    return Object.keys(validarSeccion(seccion, respuestas)).length === 0;
  }

  var api = { obtenerCamposVisibles: obtenerCamposVisibles, validarSeccion: validarSeccion, seccionEsValida: seccionEsValida };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.RevisionValidation = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
