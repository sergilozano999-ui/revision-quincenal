// apps-script/lib/mensajeMotivacionalGenerator.gs
// Genera un mensaje listo para copiar y pegar (WhatsApp, etc.) según cómo le
// ha ido al cliente en esta revisión: su propia valoración visual, cuánto ha
// cumplido de entrenamientos, y el cambio de peso si hay revisión previa.
function generarMensajeMotivacional(datos) {
  var nombre = datos.nombre;
  var partes = [];

  if (datos.comparacionVisual === 'Mejor') {
    partes.push('¡' + nombre + ', se nota tu progreso! 💪');
  } else if (datos.comparacionVisual === 'Peor') {
    partes.push(nombre + ', no te preocupes por este bache, forma parte del proceso. Lo importante es seguir. 💪');
  } else {
    partes.push(nombre + ', vas manteniendo el nivel — la constancia es lo que más cuenta. 🙌');
  }

  var previstos = datos.entrenamientosPrevistos;
  var completados = datos.entrenamientosCompletados;
  if (typeof previstos === 'number' && previstos > 0 && typeof completados === 'number') {
    var cumplimiento = completados / previstos;
    if (cumplimiento >= 0.9) {
      partes.push('Has completado ' + completados + ' de ' + previstos + ' entrenamientos, un cumplimiento excelente.');
    } else if (cumplimiento >= 0.6) {
      partes.push('Has completado ' + completados + ' de ' + previstos + ' entrenamientos — bien, pero podemos afinar un poco más.');
    } else {
      partes.push('Solo has llegado a ' + completados + ' de ' + previstos + ' entrenamientos. Vamos a ver qué se te está atravesando para ponértelo más fácil.');
    }
  }

  if (typeof datos.diferenciaPeso === 'number' && datos.diferenciaPeso !== 0) {
    var direccion = datos.diferenciaPeso < 0 ? 'bajado' : 'subido';
    partes.push('Has ' + direccion + ' ' + Math.abs(datos.diferenciaPeso).toFixed(1) + ' kg desde la última revisión.');
  }

  if (typeof datos.grasaCorporalPct === 'number') {
    partes.push('Tu % de grasa corporal estimado ahora mismo es ' + datos.grasaCorporalPct + '%.');
  }

  partes.push('¡Seguimos! 🚀');

  return partes.join(' ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generarMensajeMotivacional: generarMensajeMotivacional };
}
