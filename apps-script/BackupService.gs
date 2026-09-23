// apps-script/BackupService.gs
var NOMBRE_CARPETA_BACKUPS = 'Revisión Quincenal - Copias de seguridad';

function activarBackupSemanal_() {
  var ui = SpreadsheetApp.getUi();
  try {
    activarBackupSemanalInterno_(ui);
  } catch (e) {
    ui.alert('Fallo al activar la copia de seguridad', String(e && e.message || e), ui.ButtonSet.OK);
    throw e;
  }
}

function activarBackupSemanalInterno_(ui) {
  var triggersExistentes = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === 'hacerBackupSemanal';
  });
  if (triggersExistentes.length === 0) {
    ScriptApp.newTrigger('hacerBackupSemanal').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  }

  var carpeta = hacerBackupSemanal();

  ui.alert(
    'Copia de seguridad activada',
    'Cada domingo de madrugada se hará una copia completa del Sheet automáticamente. ' +
      'Ahora mismo te he hecho una primera copia de prueba.\n\n' +
      'Las copias se guardan en Google Drive, en la carpeta "' + NOMBRE_CARPETA_BACKUPS + '":\n' + carpeta.getUrl(),
    ui.ButtonSet.OK
  );
}

function hacerBackupSemanal() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var archivo = DriveApp.getFileById(ss.getId());
  var carpeta = obtenerOCrearCarpeta_(DriveApp.getRootFolder(), NOMBRE_CARPETA_BACKUPS);
  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  archivo.makeCopy('Backup ' + fecha + ' - ' + ss.getName(), carpeta);
  return carpeta;
}
