var ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var ID_LENGTH = 8;

function generarIdAleatorio_() {
  var id = '';
  for (var i = 0; i < ID_LENGTH; i++) {
    id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  }
  return id;
}

function generarIdUnico(idsExistentes, generadorOpcional) {
  var generar = generadorOpcional || generarIdAleatorio_;
  var intentos = 0;
  var id = generar();
  while (idsExistentes.indexOf(id) !== -1) {
    intentos++;
    if (intentos > 100) {
      throw new Error('No se pudo generar un ID único tras 100 intentos');
    }
    id = generar();
  }
  return id;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { generarIdUnico: generarIdUnico, ID_CHARS: ID_CHARS, ID_LENGTH: ID_LENGTH };
}
