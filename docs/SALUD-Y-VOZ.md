# Salud del reloj y respuestas por voz

En el registro del día, abre **Peso y cierre → Datos de mi reloj**. Copia los valores que veas en Salud de HONOR y deja vacías las mediciones que tu modelo no tenga. Esta versión permite introducir esos datos manualmente; no está conectada a la cuenta de Salud de HONOR y no descarga lecturas del reloj.

| Dato | Unidad |
| --- | --- |
| Pasos | Número entero |
| Distancia | km |
| Calorías activas | kcal |
| Tiempo de ejercicio | min |
| Frecuencia cardíaca media y pulso en reposo | Latidos por minuto |
| Oxígeno en sangre, SpO₂ | % |
| Sueño total, profundo, ligero y REM | Horas decimales |
| Estrés del reloj | Escala de 0 a 100 |

Por ejemplo, 7 horas y 30 minutos se escribe **7,5**. Las fases registradas no pueden sumar más que el sueño total. Cero es un dato; una casilla vacía es una medición ausente. El peso continúa en su casilla habitual. Estas métricas no alteran la fórmula del estado personal.

En **Mi progreso → Salud y actividad**, el selector permite explorar cada medición. Se usan los filtros de fecha y la agrupación por día, semana, mes o año. Actividad, distancia, calorías y ejercicio se suman; sueño, pulso, oxígeno y estrés se promedian entre los días que tienen dato. Las líneas unen las mediciones disponibles respetando la distancia entre sus fechas.

La gráfica **Relación con tu estado** representa cada día que tiene tanto la medición elegida como respuestas de estado. Permite explorar, por ejemplo, sueño frente a estado o pasos frente a estado. No rellena los datos ausentes y no establece causas ni diagnósticos. El resumen muestra la última medición de cada variable en el rango.

## Responder sin escribir

En el registro, elige **Responder por voz**:

- **Completa:** lee la pregunta y las opciones antes de escucharte.
- **Breve:** dice «Pregunta 1», «Pregunta 2»… La pregunta queda visible en pantalla. En los apuntes pregunta cómo te sientes y al final pide confirmar.
- Puedes incluir o excluir las preguntas del reloj y elegir una escala de cuatro o cinco respuestas.

La escala de cuatro es **1 Nada, 2 Poco, 3 Bastante, 4 Mucho**; la de cinco añade **3 Medio**, desplazando Bastante y Mucho a 4 y 5. En las actividades también puedes decir **sí** o **no**. Las respuestas parciales se conservan con su porcentaje. Los botones manuales de estado mantienen sus cinco valores anteriores.

Pulsa **Comenzar por voz** y permite el micrófono cuando el navegador lo solicite. Mientras se lee, el micrófono está cerrado. Al terminar la lectura suena una señal breve; después aparece **Habla ahora** y se abre el turno. Si el dispositivo no permite la señal sonora, espera la señal visual.

Para peso y reloj di el valor real, por ejemplo «cincuenta y cuatro coma tres», «ocho mil pasos» o «siete horas treinta minutos». La última pregunta permite dictar texto libre para los apuntes del día, hasta 2000 caracteres.

Comandos disponibles:

- **Omitir** o **mantener:** pasa a la siguiente pregunta y conserva la respuesta anterior si la había.
- **Anterior:** vuelve a la pregunta previa para corregirla.
- **Repetir:** vuelve a anunciar la pregunta según el modo seleccionado.
- **Pausa:** cierra el micrófono; pulsa Continuar por voz para seguir.
- Al terminar, **guardar** guarda el día; **revisar** cierra el recorrido para revisar en pantalla.

El botón **Terminar voz y revisar** conserva las respuestas ya capturadas en el borrador y detiene la voz y el micrófono. Salir de la pantalla o pasar a otra pestaña también detiene o pausa el recorrido. El formulario manual sigue disponible al pausar.

La voz depende del soporte del navegador. Prueba Chrome actualizado en Android o Windows, en el dominio HTTPS de la aplicación. Puede necesitar Internet aunque el registro manual funcione sin conexión. El servicio del navegador puede procesar el audio fuera del dispositivo. La aplicación guarda la transcripción y los valores, sin grabaciones de audio. Las pruebas automatizadas controlan APIs simuladas; el micrófono y la voz real deben comprobarse en el dispositivo.

## Publicar esta actualización

Los nuevos datos se incluyen en los borradores, respaldos JSON y columnas adicionales del Excel. También están preparados para sincronizar con la cuenta de Google. Para que Firestore los acepte, publica **las reglas y la web** desde la carpeta que contiene `firebase.json`:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

El ZIP preparado ya incluye la compilación en `dist`. Si modificas los archivos fuente antes de publicar, ejecuta primero `npm ci` y `npm run build`. Las reglas mantienen el acceso limitado a los registros de la propia cuenta y validan las métricas opcionales; los registros anteriores siguen siendo válidos.

La publicación en Firebase y la prueba de sincronización entre dispositivos requieren la sesión de tu proyecto. La compilación local y las pruebas de navegador no prueban por sí solas la nube real. En esta tarea no se pudo descargar el emulador oficial de Firestore por la restricción de red del entorno, por lo que sus reglas nuevas no se ejecutaron en el emulador.
