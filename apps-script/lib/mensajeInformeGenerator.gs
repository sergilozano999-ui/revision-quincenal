// apps-script/lib/mensajeInformeGenerator.gs
// Mensaje cálido para el informe PDF de progreso — a diferencia del mensaje
// motivacional para WhatsApp (mensajeMotivacionalGenerator.gs), este no
// menciona cifras ni comparativas (para no generar ansiedad al verlo en un
// PDF), solo cercanía y reconocimiento del esfuerzo. Cada llamada combina
// una apertura y un cierre elegidos al azar de un banco de frases, para que
// no salga siempre el mismo mensaje.
var APERTURAS_INFORME = [
  'cada revisión que completas es una prueba más de tu compromiso.',
  'verte seguir aquí, revisión tras revisión, dice mucho de ti.',
  'este es otro paso más en un camino que ya llevas muy bien recorrido.',
  'aparecer y seguir intentándolo, como haces tú, es lo que de verdad cuenta.',
  'gracias por la confianza y por seguir poniendo de tu parte cada quincena.',
  'lo que estás construyendo se nota, aunque algunos días cueste verlo.',
  'cada esfuerzo que metes suma, aunque el camino no sea siempre recto.',
  'me alegra mucho acompañarte en este proceso.',
];

var CIERRES_INFORME = [
  'Sigamos así, un paso cada vez.',
  'Aquí estoy para lo que necesites en el camino.',
  'Vamos a por la siguiente quincena con la misma actitud.',
  'Cuenta conmigo para lo que haga falta.',
  'Un abrazo grande y a seguir a tope.',
  'Estoy muy orgulloso de tu constancia.',
  'Nos vemos en la próxima revisión, ¡sigue así!',
  'Gracias por confiar en el proceso — y en mí.',
];

function elegirAlAzar_(lista, seleccionarOpcional) {
  var seleccionar = seleccionarOpcional || function (longitud) {
    return Math.floor(Math.random() * longitud);
  };
  return lista[seleccionar(lista.length)];
}

function generarMensajeInforme(datos, seleccionarOpcional) {
  var apertura = elegirAlAzar_(APERTURAS_INFORME, seleccionarOpcional);
  var cierre = elegirAlAzar_(CIERRES_INFORME, seleccionarOpcional);
  return datos.nombre + ', ' + apertura + ' ' + cierre;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    generarMensajeInforme: generarMensajeInforme,
    APERTURAS_INFORME: APERTURAS_INFORME,
    CIERRES_INFORME: CIERRES_INFORME,
  };
}
