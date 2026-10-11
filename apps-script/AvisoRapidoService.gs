// apps-script/AvisoRapidoService.gs
function enviarAvisoRapidoAlEntrenador_(cliente, datos) {
  var mensaje = construirAvisoRapido({
    nombre: cliente.nombre,
    pesoKg: datos.pesoKg,
    diferenciaPeso: datos.diferenciaPeso,
    grasaCorporalPct: datos.grasaCorporalPct,
    fotosFrente: datos.fotosFrente,
    fotosPerfil: datos.fotosPerfil,
    fotosEspalda: datos.fotosEspalda,
  });

  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: mensaje.asunto,
    body: mensaje.cuerpo,
  });
}
