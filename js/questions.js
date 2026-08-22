(function (root) {
  var SECTIONS = [
    {
      id: 'progreso_fisico',
      titulo: 'Progreso físico',
      campos: [
        { id: 'pesoKg', tipo: 'numero', etiqueta: 'Peso actual (kg)', obligatorio: true, min: 30, max: 300, paso: 0.1 },
        { id: 'valoracionProgresoFisico', tipo: 'escala', etiqueta: '¿Cómo valoras tu progreso físico estas últimas 2 semanas?', obligatorio: true },
        { id: 'comparacionVisual', tipo: 'opciones', etiqueta: '¿Cómo te ves físicamente respecto a la última revisión?', obligatorio: true, opciones: ['Mejor', 'Igual', 'Peor'] },
        { id: 'fotosFrente', tipo: 'foto', etiqueta: 'Foto de frente', obligatorio: false },
        { id: 'fotosPerfil', tipo: 'foto', etiqueta: 'Foto de perfil', obligatorio: false },
        { id: 'fotosEspalda', tipo: 'foto', etiqueta: 'Foto de espalda', obligatorio: false },
        { id: 'comentarioProgresoFisico', tipo: 'texto', etiqueta: 'Comentario sobre tu progreso físico (opcional)', obligatorio: false },
      ],
    },
    {
      id: 'entrenamiento',
      titulo: 'Entrenamiento',
      campos: [
        { id: 'entrenamientosPrevistos', tipo: 'numero', etiqueta: '¿Cuántos entrenamientos tenías previstos?', obligatorio: true, min: 0, max: 30, paso: 1 },
        { id: 'entrenamientosCompletados', tipo: 'numero', etiqueta: '¿Cuántos has completado?', obligatorio: true, min: 0, max: 30, paso: 1 },
        { id: 'valoracionEntrenamiento', tipo: 'escala', etiqueta: '¿Cómo valoras tus entrenamientos estas 2 semanas?', obligatorio: true },
        { id: 'progresoRendimiento', tipo: 'opciones', etiqueta: '¿Has conseguido progresar en pesos, repeticiones o rendimiento?', obligatorio: true, opciones: ['Sí', 'No', 'Parcialmente'] },
        { id: 'molestias', tipo: 'opciones', etiqueta: '¿Has tenido alguna molestia o dificultad entrenando?', obligatorio: true, opciones: ['Sí', 'No'] },
        { id: 'detalleMolestias', tipo: 'texto', etiqueta: 'Cuéntame brevemente qué te ha pasado', obligatorio: true, dependeDe: { campo: 'molestias', igualA: 'Sí' } },
      ],
    },
    {
      id: 'nutricion',
      titulo: 'Nutrición',
      campos: [
        { id: 'cumplimientoNutricion', tipo: 'escala', etiqueta: '¿Cómo valoras tu cumplimiento de la alimentación?', obligatorio: true },
        { id: 'nivelHambre', tipo: 'escala', etiqueta: '¿Cómo has llevado el hambre?', obligatorio: true },
        { id: 'dificultadPrincipal', tipo: 'opciones', etiqueta: '¿Qué ha sido lo más difícil de cumplir?', obligatorio: true, opciones: ['Nada', 'Fines de semana', 'Comer fuera', 'Organización', 'Antojos', 'Otro'] },
        { id: 'comentarioNutricion', tipo: 'texto', etiqueta: '¿Algo de la alimentación que quieras cambiar o comentar? (opcional)', obligatorio: false },
      ],
    },
    {
      id: 'actividad_recuperacion',
      titulo: 'Actividad y recuperación',
      campos: [
        { id: 'pasosDiarios', tipo: 'numero', etiqueta: 'Media aproximada de pasos diarios', obligatorio: true, min: 0, max: 50000, paso: 100 },
        { id: 'objetivoPasosCumplido', tipo: 'opciones', etiqueta: '¿Has cumplido tu objetivo de pasos?', obligatorio: true, opciones: ['Sí', 'Parcialmente', 'No'] },
        { id: 'calidadSueno', tipo: 'escala', etiqueta: '¿Cómo valoras tu calidad del sueño?', obligatorio: true },
        { id: 'horasSueno', tipo: 'numero', etiqueta: '¿Cuántas horas duermes aproximadamente?', obligatorio: true, min: 0, max: 16, paso: 0.5 },
        { id: 'nivelEnergia', tipo: 'escala', etiqueta: '¿Cómo valorarías tu nivel de energía?', obligatorio: true },
        { id: 'nivelEstres', tipo: 'escala', etiqueta: '¿Cómo valorarías tu nivel de estrés?', obligatorio: true },
      ],
    },
    {
      id: 'feedback',
      titulo: 'Feedback',
      campos: [
        { id: 'mejorLogro', tipo: 'texto', etiqueta: '¿Qué crees que has hecho mejor estas 2 semanas? (opcional)', obligatorio: false },
        { id: 'mayorDificultad', tipo: 'texto', etiqueta: '¿Qué es lo que más te ha costado? (opcional)', obligatorio: false },
        { id: 'necesidadEntrenador', tipo: 'texto', etiqueta: '¿Hay algo que necesites de mí como entrenador? (opcional)', obligatorio: false },
        { id: 'comentarioAdicional', tipo: 'texto', etiqueta: '¿Hay algo más que quieras contarme? (opcional)', obligatorio: false },
      ],
    },
    {
      id: 'proximas_semanas',
      titulo: 'Próximas 2 semanas',
      campos: [
        { id: 'objetivoProximasSemanas', tipo: 'texto', etiqueta: '¿Cuál quieres que sea tu principal objetivo para las próximas 2 semanas? (opcional)', obligatorio: false },
        { id: 'mejoraEspecifica', tipo: 'texto', etiqueta: '¿Hay algo concreto que quieras mejorar? (opcional)', obligatorio: false },
      ],
    },
  ];

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SECTIONS: SECTIONS };
  } else {
    root.SECTIONS = SECTIONS;
  }
})(typeof window !== 'undefined' ? window : globalThis);
