// apps-script/lib/grasaCorporalCalculator.gs
// Fórmula US Navy (versión métrica, cm) para estimar % de grasa corporal.
function calcularGrasaCorporal(sexo, alturaCm, cuelloCm, cinturaCm, caderaCm) {
  if (!alturaCm || !cuelloCm || !cinturaCm) return null;

  var esMujer = sexo === 'Mujer';
  var base;
  if (esMujer) {
    if (!caderaCm) return null;
    var sumaMujer = cinturaCm + caderaCm - cuelloCm;
    if (sumaMujer <= 0) return null;
    base = 495 / (1.29579 - 0.35004 * log10_(sumaMujer) + 0.22100 * log10_(alturaCm)) - 450;
  } else {
    var diferenciaHombre = cinturaCm - cuelloCm;
    if (diferenciaHombre <= 0) return null;
    base = 495 / (1.0324 - 0.19077 * log10_(diferenciaHombre) + 0.15456 * log10_(alturaCm)) - 450;
  }

  if (!isFinite(base) || base <= 0) return null;
  return Math.round(base * 10) / 10;
}

function log10_(valor) {
  return Math.log(valor) / Math.LN10;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularGrasaCorporal: calcularGrasaCorporal };
}
