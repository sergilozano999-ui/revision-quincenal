function esRevisionManana(fechaProximaRevision, fechaHoy) {
  if (!fechaProximaRevision) return false;
  var hoy = new Date(fechaHoy.getFullYear(), fechaHoy.getMonth(), fechaHoy.getDate());
  var manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  var proxima = new Date(
    fechaProximaRevision.getFullYear(),
    fechaProximaRevision.getMonth(),
    fechaProximaRevision.getDate()
  );
  return proxima.getTime() === manana.getTime();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { esRevisionManana: esRevisionManana };
}
