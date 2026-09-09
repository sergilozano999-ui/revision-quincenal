// js/app.js
(function () {
  var URL_API = 'https://script.google.com/macros/s/AKfycbxCfq2Ll69VmLS_IJKRGxufGLZXGR20DyiC-kv0LLUrfQRD-W5zVzgrc4c0HFkZOzMlaQ/exec';

  var estado = {
    idCliente: null,
    nombreCliente: '',
    indiceSeccion: 0,
    respuestas: {},
    fotos: { fotosFrente: [], fotosPerfil: [], fotosEspalda: [] },
  };

  var elCabecera = document.getElementById('cabecera');
  var elBarraProgreso = document.getElementById('barra-progreso');
  var elTextoProgreso = document.getElementById('texto-progreso');
  var elContenido = document.getElementById('contenido');
  var elNavegacion = document.getElementById('navegacion');
  var elBtnAtras = document.getElementById('btn-atras');
  var elBtnSiguiente = document.getElementById('btn-siguiente');

  function obtenerIdDeUrl() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function mostrarError(mensaje) {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML = '<h1>Enlace no válido</h1><p>' + mensaje + '</p>';
    elContenido.appendChild(div);
  }

  function mostrarBienvenida(nombre) {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML =
      '<h1>Hola, ' + nombre + ' 👋</h1>' +
      '<p>Vamos con tu revisión quincenal. Te llevará unos 5 minutos.</p>';
    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn--primario';
    boton.textContent = 'Comenzar';
    boton.style.marginTop = '24px';
    boton.addEventListener('click', iniciarCuestionario);
    div.appendChild(boton);
    elContenido.appendChild(div);
  }

  function iniciarCuestionario() {
    estado.indiceSeccion = 0;
    elCabecera.hidden = false;
    elNavegacion.hidden = false;
    renderSeccionActual();
  }

  function actualizarProgreso() {
    var total = SECTIONS.length;
    var actual = estado.indiceSeccion + 1;
    elBarraProgreso.style.width = Math.round((actual / total) * 100) + '%';
    elTextoProgreso.textContent = 'Sección ' + actual + ' de ' + total;
  }

  function renderSeccionActual() {
    var seccion = SECTIONS[estado.indiceSeccion];
    actualizarProgreso();
    elContenido.innerHTML = '';

    var titulo = document.createElement('h2');
    titulo.textContent = seccion.titulo;
    elContenido.appendChild(titulo);

    var camposVisibles = RevisionValidation.obtenerCamposVisibles(seccion, estado.respuestas);
    camposVisibles.forEach(function (campo) {
      elContenido.appendChild(crearCampoDOM(campo));
    });

    elBtnAtras.disabled = estado.indiceSeccion === 0;
    elBtnSiguiente.textContent = estado.indiceSeccion === SECTIONS.length - 1 ? 'Enviar' : 'Siguiente';
  }

  // Task 14 añade los casos 'foto'; Task 15 no toca esta función.
  function crearCampoDOM(campo) {
    var contenedor = document.createElement('div');
    contenedor.className = 'campo';

    var etiqueta = document.createElement('label');
    etiqueta.className = 'campo__etiqueta';
    etiqueta.textContent = campo.etiqueta;
    contenedor.appendChild(etiqueta);

    if (campo.tipo === 'escala') {
      contenedor.appendChild(crearEscalaDOM(campo));
    } else if (campo.tipo === 'opciones') {
      contenedor.appendChild(crearOpcionesDOM(campo));
    } else if (campo.tipo === 'numero') {
      contenedor.appendChild(crearNumeroDOM(campo));
    } else if (campo.tipo === 'texto') {
      contenedor.appendChild(crearTextoDOM(campo));
    } else if (campo.tipo === 'foto') {
      contenedor.appendChild(crearFotoDOM(campo));
    }

    var error = document.createElement('p');
    error.className = 'campo__error';
    error.id = 'error-' + campo.id;
    contenedor.appendChild(error);

    return contenedor;
  }

  function crearEscalaDOM(campo) {
    var grupo = document.createElement('div');
    grupo.className = 'escala';
    for (var valor = 1; valor <= 10; valor++) {
      (function (v) {
        var boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'escala__opcion';
        boton.textContent = String(v);
        if (estado.respuestas[campo.id] === v) boton.classList.add('is-seleccionada');
        boton.addEventListener('click', function () {
          estado.respuestas[campo.id] = v;
          grupo.querySelectorAll('.escala__opcion').forEach(function (b) { b.classList.remove('is-seleccionada'); });
          boton.classList.add('is-seleccionada');
        });
        grupo.appendChild(boton);
      })(valor);
    }
    return grupo;
  }

  function crearOpcionesDOM(campo) {
    var grupo = document.createElement('div');
    grupo.className = 'opciones';
    campo.opciones.forEach(function (opcion) {
      var boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'opciones__boton';
      boton.textContent = opcion;
      if (estado.respuestas[campo.id] === opcion) boton.classList.add('is-seleccionada');
      boton.addEventListener('click', function () {
        estado.respuestas[campo.id] = opcion;
        grupo.querySelectorAll('.opciones__boton').forEach(function (b) { b.classList.remove('is-seleccionada'); });
        boton.classList.add('is-seleccionada');
        renderSeccionActual();
      });
      grupo.appendChild(boton);
    });
    return grupo;
  }

  function crearNumeroDOM(campo) {
    var input = document.createElement('input');
    input.type = 'number';
    input.inputMode = 'decimal';
    if (campo.min !== undefined) input.min = campo.min;
    if (campo.max !== undefined) input.max = campo.max;
    if (campo.paso !== undefined) input.step = campo.paso;
    if (estado.respuestas[campo.id] !== undefined) input.value = estado.respuestas[campo.id];
    input.addEventListener('input', function () {
      estado.respuestas[campo.id] = input.value === '' ? undefined : Number(input.value);
    });
    return input;
  }

  function crearTextoDOM(campo) {
    var textarea = document.createElement('textarea');
    if (estado.respuestas[campo.id] !== undefined) textarea.value = estado.respuestas[campo.id];
    textarea.addEventListener('input', function () {
      estado.respuestas[campo.id] = textarea.value;
    });
    return textarea;
  }

  function crearFotoDOM(campo) {
    var envoltorio = document.createElement('div');

    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    var previsualizacion = document.createElement('div');
    previsualizacion.style.display = 'flex';
    previsualizacion.style.gap = '8px';
    previsualizacion.style.flexWrap = 'wrap';
    previsualizacion.style.marginTop = '8px';

    function repintarPrevisualizacion() {
      previsualizacion.innerHTML = '';
      estado.fotos[campo.id].forEach(function (dataUrl, indice) {
        var miniatura = document.createElement('div');
        miniatura.style.position = 'relative';

        var img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = '72px';
        img.style.height = '72px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        miniatura.appendChild(img);

        var borrar = document.createElement('button');
        borrar.type = 'button';
        borrar.textContent = '×';
        borrar.setAttribute('aria-label', 'Quitar foto');
        borrar.style.position = 'absolute';
        borrar.style.top = '-6px';
        borrar.style.right = '-6px';
        borrar.style.border = 'none';
        borrar.style.borderRadius = '999px';
        borrar.style.width = '22px';
        borrar.style.height = '22px';
        borrar.style.cursor = 'pointer';
        borrar.addEventListener('click', function () {
          estado.fotos[campo.id].splice(indice, 1);
          repintarPrevisualizacion();
        });
        miniatura.appendChild(borrar);

        previsualizacion.appendChild(miniatura);
      });
    }

    input.addEventListener('change', function () {
      var archivos = Array.prototype.slice.call(input.files);
      Promise.all(archivos.map(function (archivo) { return comprimirImagen(archivo, 1600, 0.8); }))
        .then(function (dataUrls) {
          estado.fotos[campo.id] = estado.fotos[campo.id].concat(dataUrls);
          repintarPrevisualizacion();
          input.value = '';
        })
        .catch(function () {
          alert('No se pudo procesar alguna foto. Inténtalo de nuevo.');
        });
    });

    envoltorio.appendChild(input);
    envoltorio.appendChild(previsualizacion);
    repintarPrevisualizacion();
    return envoltorio;
  }

  function mostrarErroresSeccion(errores) {
    Object.keys(errores).forEach(function (campoId) {
      var el = document.getElementById('error-' + campoId);
      if (el) el.textContent = errores[campoId];
    });
  }

  elBtnAtras.addEventListener('click', function () {
    if (estado.indiceSeccion === 0) return;
    estado.indiceSeccion -= 1;
    renderSeccionActual();
  });

  elBtnSiguiente.addEventListener('click', function () {
    var seccion = SECTIONS[estado.indiceSeccion];
    var errores = RevisionValidation.validarSeccion(seccion, estado.respuestas);
    if (Object.keys(errores).length > 0) {
      mostrarErroresSeccion(errores);
      return;
    }
    if (estado.indiceSeccion < SECTIONS.length - 1) {
      estado.indiceSeccion += 1;
      renderSeccionActual();
      return;
    }
    enviarFormulario();
  });

  function construirPayload() {
    var payload = Object.assign({ idCliente: estado.idCliente }, estado.respuestas);
    payload.fotosFrente = estado.fotos.fotosFrente;
    payload.fotosPerfil = estado.fotos.fotosPerfil;
    payload.fotosEspalda = estado.fotos.fotosEspalda;
    return payload;
  }

  function enviarFormulario() {
    elBtnSiguiente.disabled = true;
    elBtnSiguiente.textContent = 'Enviando...';
    RevisionApi.enviarRevision(URL_API, construirPayload())
      .then(function () {
        mostrarConfirmacion();
      })
      .catch(function (error) {
        elBtnSiguiente.disabled = false;
        elBtnSiguiente.textContent = 'Enviar';
        mostrarAvisoReintento(error.message);
      });
  }

  function mostrarAvisoReintento(mensaje) {
    var existente = document.getElementById('aviso-reintento');
    if (existente) existente.remove();
    var aviso = document.createElement('p');
    aviso.id = 'aviso-reintento';
    aviso.className = 'campo__error';
    aviso.textContent = 'No se pudo enviar tu revisión (' + mensaje + '). Tus respuestas siguen aquí — inténtalo de nuevo.';
    elContenido.insertBefore(aviso, elContenido.firstChild);
  }

  function mostrarConfirmacion() {
    elCabecera.hidden = true;
    elNavegacion.hidden = true;
    elContenido.innerHTML = '';
    var proximaFecha = new Date();
    proximaFecha.setDate(proximaFecha.getDate() + 14);
    var textoFecha = proximaFecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    var div = document.createElement('div');
    div.className = 'pantalla-centrada';
    div.innerHTML =
      '<h1>¡Gracias, ' + estado.nombreCliente + '! 💪</h1>' +
      '<p>Tu entrenador revisará esto pronto.</p>' +
      '<p>Nos vemos en tu próxima revisión, sobre el ' + textoFecha + '.</p>';
    elContenido.appendChild(div);
  }

  function init() {
    estado.idCliente = obtenerIdDeUrl();
    if (!estado.idCliente) {
      mostrarError('Este enlace no incluye tu identificador. Contacta con tu entrenador.');
      return;
    }
    RevisionApi.validarCliente(URL_API, estado.idCliente)
      .then(function (resultado) {
        if (resultado.status !== 'ok') {
          mostrarError('Este enlace no es válido. Contacta con tu entrenador.');
          return;
        }
        estado.nombreCliente = resultado.nombre;
        mostrarBienvenida(resultado.nombre);
      })
      .catch(function () {
        mostrarError('No se pudo comprobar tu enlace. Revisa tu conexión e inténtalo de nuevo.');
      });
  }

  init();

  window.RevisionApp = { estado: estado };
})();
