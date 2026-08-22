// js/app.js
(function () {
  var URL_API = 'PON_AQUI_LA_URL_DE_TU_WEB_APP'; // Task 16 la reemplaza por la URL real

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

  // Task 15 reemplaza este listener para manejar el envío final.
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
    }
  });

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
