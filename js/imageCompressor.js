// js/imageCompressor.js
function comprimirImagen(archivo, maxAncho, calidad) {
  return new Promise(function (resolve, reject) {
    var lector = new FileReader();
    lector.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
    lector.onload = function () {
      var img = new Image();
      img.onerror = function () { reject(new Error('No se pudo procesar la imagen')); };
      img.onload = function () {
        var escala = Math.min(1, maxAncho / img.width);
        var ancho = Math.round(img.width * escala);
        var alto = Math.round(img.height * escala);
        var lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        lienzo.getContext('2d').drawImage(img, 0, 0, ancho, alto);
        resolve(lienzo.toDataURL('image/jpeg', calidad));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

window.comprimirImagen = comprimirImagen;
