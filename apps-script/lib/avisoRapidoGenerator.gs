// apps-script/lib/avisoRapidoGenerator.gs
// Mensaje corto para el entrenador en cuanto llega la Parte 1 (peso,
// medidas y fotos), antes de que el cliente conteste las preguntas. No
// reutiliza generarMensajeMotivacional porque ese necesita datos de
// entrenamientos que solo llegan en la Parte 2.
function construirAvisoRapido(datos) {
  var lineaPeso = 'Parte 1 recibida de ' + datos.nombre + ': ' + datos.pesoKg + ' kg';
  if (typeof datos.diferenciaPeso === 'number' && datos.diferenciaPeso !== 0) {
    var direccion = datos.diferenciaPeso < 0 ? 'bajado' : 'subido';
    lineaPeso += ' (ha ' + direccion + ' ' + Math.abs(datos.diferenciaPeso).toFixed(1) + ' kg).';
  } else {
    lineaPeso += '.';
  }

  var partes = [lineaPeso];

  if (typeof datos.grasaCorporalPct === 'number') {
    partes.push('Grasa corporal estimada: ' + datos.grasaCorporalPct + '%.');
  }

  var fotos = [datos.fotosFrente, datos.fotosPerfil, datos.fotosEspalda].filter(Boolean);
  partes.push(fotos.length ? 'Fotos: ' + fotos.join(' | ') : 'No ha subido fotos esta vez.');
  partes.push('Todavía le faltan las preguntas — te llegará otro aviso cuando las conteste.');

  return {
    asunto: 'Parte 1 recibida de ' + datos.nombre + ' (peso, medidas y fotos)',
    cuerpo: partes.join('\n\n'),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { construirAvisoRapido: construirAvisoRapido };
}
