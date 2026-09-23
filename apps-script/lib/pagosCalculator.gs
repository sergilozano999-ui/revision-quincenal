function faltanDiasParaPago(fechaProximoPago, fechaHoy, dias) {
  if (!fechaProximoPago) return false;
  var hoy = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());
  var objetivo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + dias);
  var proximoPago = new Date(
    fechaProximoPago.getFullYear(),
    fechaProximoPago.getMonth(),
    fechaProximoPago.getDate()
  );
  return proximoPago.getTime() === objetivo.getTime();
}

function calcularSiguienteFechaPago(fechaProximoPago) {
  var siguiente = new Date(fechaProximoPago);
  siguiente.setMonth(siguiente.getMonth() + 3);
  return siguiente;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    faltanDiasParaPago: faltanDiasParaPago,
    calcularSiguienteFechaPago: calcularSiguienteFechaPago,
  };
}
