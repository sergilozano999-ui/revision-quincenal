function calcularNumeroRevision(filasCliente) {
  return filasCliente.length + 1;
}

function calcularComparacionPeso(pesoActual, filasCliente) {
  if (!filasCliente || filasCliente.length === 0) {
    return { pesoAnterior: null, diferencia: null };
  }
  var filaAnterior = filasCliente[filasCliente.length - 1];
  var pesoAnterior = filaAnterior.pesoKg;
  var diferencia = Math.round((pesoActual - pesoAnterior) * 100) / 100;
  return { pesoAnterior: pesoAnterior, diferencia: diferencia };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calcularNumeroRevision: calcularNumeroRevision, calcularComparacionPeso: calcularComparacionPeso };
}
