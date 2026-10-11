// Duplicado deliberadamente de questions.js (Task 9 original): frontend y
// backend son dos runtimes separados sin build compartido, así que la
// lista de campos obligatorios vive una vez en cada lado.
var CAMPOS_OBLIGATORIOS_PARTE1 = ['idCliente', 'pesoKg', 'cuelloCm', 'cinturaCm'];
var CAMPOS_OBLIGATORIOS_PARTE2 = [
  'idCliente', 'valoracionProgresoFisico', 'comparacionVisual',
  'entrenamientosPrevistos', 'entrenamientosCompletados', 'valoracionEntrenamiento',
  'progresoRendimiento', 'molestias', 'cumplimientoNutricion', 'nivelHambre',
  'dificultadPrincipal', 'pasosDiarios', 'objetivoPasosCumplido', 'calidadSueno',
  'horasSueno', 'nivelEnergia', 'nivelEstres',
];

function validarPayload(payload, parte) {
  if (!payload || typeof payload !== 'object') {
    return { valido: false, errores: ['Payload vacío o inválido'] };
  }
  var campos = parte === 2 ? CAMPOS_OBLIGATORIOS_PARTE2 : CAMPOS_OBLIGATORIOS_PARTE1;
  var errores = [];
  campos.forEach(function (campo) {
    var valor = payload[campo];
    if (valor === undefined || valor === null || valor === '') {
      errores.push('Falta el campo obligatorio: ' + campo);
    }
  });
  if (parte === 2 && payload.molestias === 'Sí' && (!payload.detalleMolestias || String(payload.detalleMolestias).trim() === '')) {
    errores.push('Falta el detalle de las molestias');
  }
  return { valido: errores.length === 0, errores: errores };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validarPayload: validarPayload,
    CAMPOS_OBLIGATORIOS_PARTE1: CAMPOS_OBLIGATORIOS_PARTE1,
    CAMPOS_OBLIGATORIOS_PARTE2: CAMPOS_OBLIGATORIOS_PARTE2,
  };
}
