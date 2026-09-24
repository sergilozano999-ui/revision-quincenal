// apps-script/lib/informeCalculator.gs
// Lógica pura para decidir qué fotos "antes"/"ahora" usar en el informe PDF
// de progreso, y para extraer el ID de Drive de una URL de archivo.

// File.getUrl() en Apps Script devuelve algo como
// "https://drive.google.com/file/d/{ID}/view?usp=drivesdk".
function extraerIdDrive(url) {
  if (!url) return null;
  var match = String(url).match(/\/d\/([-\w]+)/);
  return match ? match[1] : null;
}

// Fotos_Frente puede traer varias URLs separadas por ", " si el cliente
// subió más de una foto en esa categoría — nos quedamos con la primera.
function primeraUrlFoto(valorColumna) {
  if (!valorColumna) return '';
  return String(valorColumna).split(',')[0].trim();
}

// datos.filasPrevias: filas de Respuestas del mismo cliente, ordenadas de
// más antigua a más reciente, cada una con { urlFrente }. Si el cliente no
// tiene ninguna foto previa (primera revisión), se usa la foto actual
// también como "antes" — es lo único que hay, y es lo esperado en una
// primera revisión (antes/ahora salen iguales).
function seleccionarFotoAntes(datos) {
  if (datos.fotoAntesManualUrl) return datos.fotoAntesManualUrl;

  for (var i = 0; i < datos.filasPrevias.length; i++) {
    if (datos.filasPrevias[i].urlFrente) {
      return datos.filasPrevias[i].urlFrente;
    }
  }
  return datos.fotoActualUrl;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extraerIdDrive: extraerIdDrive,
    primeraUrlFoto: primeraUrlFoto,
    seleccionarFotoAntes: seleccionarFotoAntes,
  };
}
