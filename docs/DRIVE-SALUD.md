# HONOR Health → Health Connect → Drive → Honor Bienestar

La web lee la copia programada de Health Connect desde una carpeta de Drive elegida por la persona. El ZIP se descarga y procesa dentro del navegador, sin compartirlo públicamente ni enviarlo a un servidor del proyecto.

## Preparación en el teléfono

1. Instala [HONOR Health oficial](https://play.google.com/store/apps/details?id=com.hihonor.health) y sincroniza el reloj o la balanza.
2. Instala o abre [Health Connect](https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata). Algunos Android lo incluyen en Ajustes.
3. En HONOR Health: **Configuración → Compartir datos con terceros → Health Connect**. Activa los permisos de escritura de las mediciones que desees compartir.
4. En Health Connect: **Administrar datos → Copia de seguridad y restablecimiento → Exportación programada**. Elige **Diariamente**, Drive y una carpeta. Conserva el nombre **Health Connect.zip**; se admiten copias posteriores con sufijos. La copia puede esperar a que el teléfono esté cargando y sin uso. Drive puede esperar Wi-Fi si solo permite transferencias con esa red.
5. En Honor Bienestar: **Cuenta y ajustes → Datos de salud → Conectar Drive**. Autoriza lectura de Drive, entra en la misma carpeta y pulsa **Vincular esta carpeta**. También se puede elegir Mi unidad si la exportación está en la raíz.

Los nombres de los menús pueden variar. Un permiso activado no demuestra que la fuente haya escrito mediciones: una copia válida puede no contener datos de HONOR.

## Fuente y conservación del historial

La identidad del escritor es el paquete exacto **com.hihonor.health** en application_info_table. Se filtra app_info_id en cada tabla de registros antes de leer sus muestras, fases o segmentos. El nombre visible de una aplicación no autoriza su importación. No se completa una métrica ausente con datos del teléfono, de otra app ni con ceros.

La copia puede contener datos más antiguos que la instalación de HONOR Health: Health Connect mantiene sus propios registros. Esas fechas no identifican la fecha de instalación ni demuestran cuál fue la app anterior.

Se leen pasos, distancia, calorías activas, ejercicio, pulso, pulso en reposo, SpO₂, peso y sueño con fases cuando HONOR los haya compartido. No se promete leer todos los tipos posibles de Health Connect. El estrés sigue como entrada manual.

Se usan los offsets guardados y se convierten metros a kilómetros, calorías a kilocalorías y gramos a kilogramos. La actividad respeta la prioridad por última modificación de los intervalos solapados del mismo escritor, siguiendo el criterio de AOSP. El sueño corresponde al día de despertar; no se suman dos veces fases o sesiones, y el ejercicio excluye pausas y descansos.

Solo se actualizan los campos recibidos. Las respuestas, actividades, apuntes, peso ausente y demás métricas se conservan. Se combina con los datos actuales en una transacción de IndexedDB y se incorpora a la cola de Firebase si hay cuenta conectada. No se eliminan días ni registros de Health Connect o Drive. Los valores inválidos o una mezcla de sueño incoherente detienen la actualización.

## Revisar los datos encontrados

En Datos de salud, **Datos encontrados en la copia** muestra cada tipo de medición, su origen, el número de registros y si esta versión lo admite. Se distinguen HONOR Health, el teléfono y otras aplicaciones aunque tengan nombres parecidos. La presencia de calorías o distancia en el ZIP no implica que su escritor sea HONOR. El filtro de importación acepta exclusivamente HONOR.

Los estados de descarga y lectura confirman cuándo se procesa el ZIP y su archivo interno health_connect_export.db. El informe se guarda junto a la última copia revisada, sin guardar el ZIP ni la base de datos. Una lectura vacía distingue la falta de mediciones HONOR de tipos HONOR todavía no compatibles. La gráfica elige inicialmente una métrica disponible, en lugar de mostrar pasos vacíos si únicamente hay calorías u otra medición.

## Frecuencia y duración del acceso

Se elige el ZIP de Health Connect más reciente entre los archivos directos de la carpeta elegida. No se recorren otras carpetas ni todo Drive. Se comprueba al volver al frente, al recuperar conexión y cada cinco minutos con la web visible. Se pausa durante el cuestionario o los conflictos. Las comprobaciones automáticas evitan descargar otra vez una copia sin cambios. El botón Actualizar datos de salud sí fuerza su descarga, descompresión y lectura; una actualización del lector también revisa las copias ya procesadas. Un archivo vacío, incompleto o reemplazado durante la lectura no se incorpora.

**Se reutiliza el acceso de Google al actualizar, cambiar de carpeta o recargar la misma pestaña.** Si al iniciar sesión Google devuelve un acceso que ya permite Drive, también se aprovecha: no se abre otra autorización. La sesión de Firebase por sí sola no concede ese permiso; se solicita la primera vez que falte. Se indica a Google la cuenta conectada sin forzar un selector de cuentas. Si el acceso caduca, se revoca o se cierra la pestaña, pulsa **Actualizar datos de salud** para renovarlo. La carpeta se recuerda: no se repite la guía ni se descargan archivos manualmente. Durante el acceso vigente, la consulta y la incorporación son automáticas. La copia de Android limita la frecuencia; no es lectura en tiempo real ni sincronización con la web cerrada.

La autorización persistente y las tareas con la web cerrada necesitan un servicio adicional que gestione credenciales renovables. Esta versión no almacena tokens de renovación ni simula esa capacidad.

## Configuración de Google para el propietario

Se reutiliza la configuración pública VITE_FIREBASE_* y el cliente Google asociado a Firebase Authentication. No requiere APK, una clave privada en el navegador ni cambiar el plan Spark para alojar la web.

- Habilita [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com?project=honor-bienestar) en **honor-bienestar**.
- Revisa el [consentimiento OAuth](https://console.cloud.google.com/auth/overview?project=honor-bienestar) para **https://www.googleapis.com/auth/drive.readonly**. Google puede requerir usuarios de prueba o verificación según el estado y alcance de publicación. No se obtuvo esa verificación desde este entorno.
- Firebase debe tener habilitado Google y autorizar los dominios de Hosting, como en la configuración existente.

Google no ofrece en este flujo un permiso OAuth limitado a una carpeta que incluya automáticamente sus ZIP futuros. La persona eligió buscar nuevas copias en una carpeta y autorizó el permiso de lectura de Drive más amplio. La interfaz lo explica. Se consulta la carpeta elegida, además de listar carpetas durante su selección; no se piden permisos de escritura.

La autorización usa una instancia Firebase secundaria con persistencia en memoria, sin cambiar la cuenta del historial. Si el historial tiene cuenta, se exige la misma cuenta Google. El token temporal se mantiene en memoria y sessionStorage de la pestaña para sobrevivir a recargas, con caducidad de 55 minutos y vinculado al historial y la cuenta autorizada. No se almacena un token de renovación. Se descarta al desvincular, cambiar de historial, cerrar sesión, caducar o recibir un rechazo de autorización. Al cerrar la pestaña termina su almacenamiento de sesión. Si el navegador impide sessionStorage, se conserva solo en memoria. IndexedDB, ajustes, respaldos y Firestore no guardan el token ni el ZIP. Desvincular conserva las mediciones incorporadas; el permiso concedido se puede retirar desde Google.

## Validación y límites

- npm test: origen exacto, unidades, medianoche, solapamientos, fases, pausas, combinación e idempotencia; autorización y API simuladas.
- CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- --config playwright.drive.config.ts: carpeta, filtro, consulta automática, permiso vencido y conservación del historial. Solo Google se sustituye mediante rutas de Playwright en desarrollo; la app y el lector de ZIP son reales.
- health-archive.spec.ts ejecuta el worker compilado y su WASM en Chromium.
- La copia privada proporcionada también se verificó localmente. El ZIP, la base y sus valores no se incluyen en Git, pruebas ni entregas.

Android puede cambiar el esquema SQLite interno. Se validó el esquema de la muestra, sin garantizar cualquier versión futura. Límites: ZIP de 20 MB, base descomprimida de 64 MB, 300 000 filas consultadas, 10 000 días y 30 segundos en un worker cancelable.

Las simulaciones no confirman autorización real ni que Drive API o el consentimiento estén activados en producción. Hay que comprobar la conexión publicada con la cuenta. Una copia sin mediciones de HONOR se muestra como vacía, sin afirmar que se importaron datos.
