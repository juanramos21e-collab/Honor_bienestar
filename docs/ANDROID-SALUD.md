# Datos de salud en Android

La versión Android conserva la interfaz de Honor y añade acceso nativo a **Health Connect**. No decide la compatibilidad por la marca del teléfono: consulta la disponibilidad del servicio del sistema. Está preparada para Android 9 o posterior, incluidos teléfonos Xiaomi, Samsung, HONOR y otras marcas que dispongan del servicio compatible.

Esto no garantiza acceso a cualquier reloj. El reloj se sincroniza con su aplicación de origen; esa aplicación debe escribir las mediciones en Health Connect. Detectar Salud de HONOR instalada no demuestra que comparta datos. La app comprueba ambas cosas por separado y permite elegir entre los orígenes que realmente tengan mediciones. No se ha implementado una API privada ni una conexión directa a la nube de HONOR.

La web ahora dirige a [HONOR Health oficial de Google Play](https://play.google.com/store/apps/details?id=com.hihonor.health). No pide instalar el APK de este proyecto como paso del registro. Instalar HONOR Health no autoriza a la web a leer sus datos; el aislamiento de Android impide esa consulta directa. El APK de este proyecto sigue disponible en el paquete para pruebas de la integración Health Connect, con los permisos descritos aquí. Una instalación desde Google Play de nuestra propia integración requeriría publicarla y completar las revisiones correspondientes; no se presenta la app oficial de HONOR como sustituto de ese puente.

## Uso en el celular

1. Instala `Honor-salud-android.apk`. Es un APK de prueba firmado, no una publicación de Google Play. Android puede pedir autorización para instalar desde el navegador o gestor de archivos.
2. Abre Honor y entra en **Ajustes → Datos de salud**. Se muestra el teléfono detectado y la disponibilidad de Health Connect.
3. Si falta Health Connect, pulsa **Instalar o actualizar Health Connect**. Si usas un reloj HONOR y falta su aplicación, puedes abrir su instalación desde aquí.
4. Sincroniza el reloj en su aplicación y habilita que esa aplicación comparta datos con Health Connect, si ofrece esa función.
5. En Honor, pulsa **Conectar datos de salud** y concede las lecturas que quieras compartir. No se solicitan permisos para escribir o borrar datos de salud.
6. Elige hasta 30 días y pulsa **Buscar aplicaciones con datos**. Selecciona el origen y pulsa **Actualizar datos**.
7. Las mediciones válidas se incorporan al historial al pulsar Actualizar datos. El origen se recuerda para las próximas consultas. El enlace **Ver mi progreso registrado** abre las gráficas existentes.

Las respuestas, actividades, apuntes y mediciones no recibidas se conservan. Los valores recibidos del origen elegido reemplazan esas mismas mediciones, al actualizar. Repetir una lectura idéntica no crea registros nuevos. Si las fases anteriores resultan incompatibles con un total de sueño nuevo, la actualización se detiene para revisar el día; no se borran fases automáticamente.

Se distinguen la última consulta y el último guardado. Una consulta vacía no se presenta como una sincronización exitosa. Health Connect limita el historial accesible según sus permisos y la fecha de concesión; el límite de 30 días de esta interfaz no amplía esos permisos.

## Datos admitidos

Pasos, distancia, calorías activas, ejercicio, pulso medio, pulso en reposo, SpO₂, sueño y fases, y peso, cuando el origen los comparte. Las cantidades diarias de actividad se consultan con la agregación de Health Connect y se filtran por un único origen para evitar mezclar aplicaciones. SpO₂ se promedia por día; peso usa la última medición de cada día. Se usa la zona horaria del teléfono. El sueño se asigna a la fecha de despertar; las fases o sesiones superpuestas no se cuentan dos veces. Si no hay fases de sueño disponibles, se informa que se usa la duración de la sesión registrada.

El estrés numérico del reloj no se obtiene con esta integración. Puede registrarse manualmente. No se rellena ningún valor ausente con cero. Los datos del reloj no cambian la fórmula del estado personal.

## Historial anterior y Google

El APK y la web tienen almacenamientos locales distintos. Para llevar un historial sin cuenta desde la web al APK, descarga el respaldo JSON desde la web e impórtalo en Ajustes del APK. Instalar el APK no borra los registros del navegador.

Para compartir el historial entre el APK y la laptop mediante Google, hay que registrar **el paquete Android y su certificado** en el proyecto Firebase. La configuración web no registra por sí sola el nuevo cliente Android.

El paquete de entrega incluye `android/android-signing.json` con las huellas públicas de su APK y un script que registra exclusivamente `app.honor.bienestar` en `honor-bienestar`, reutilizando la app y los certificados si ya existen. Desde la carpeta del paquete, en el Windows donde ya iniciaste sesión en Firebase:

```cmd
npm run android:google
```

Este paso usa Firebase CLI y la sesión de tu equipo. Si pide acceso, ejecuta `npx --yes firebase-tools@15.33.0 login` en tu terminal. No se requieren tokens por chat. El script no despliega la web, cambia las reglas ni toca otras aplicaciones. La configuración OAuth debe tener Google habilitado, como la web actual. Después, prueba el inicio de sesión en el APK; la propagación del registro puede tardar.

El cliente OAuth web público se configura mediante `VITE_GOOGLE_WEB_CLIENT_ID`. El paquete compilado incluye el cliente verificado con el proveedor Google del proyecto. Una copia del código necesita ese identificador público además de las cuatro variables Firebase de `.env.example`. El flujo nativo usa Credential Manager y pasa el ID token a Firebase Auth; no abre el acceso Google dentro de un WebView ni guarda tokens en los archivos del proyecto.

## Voz, archivos y privacidad

La versión Android usa la voz y el reconocimiento de Android para conservar los dos recorridos del cuestionario. La escucha empieza después de terminar la lectura y la señal. Pausar o salir detiene el audio y el micrófono; un permiso pendiente no abre el micrófono después de cancelar. La disponibilidad y el procesamiento remoto dependen de los servicios de voz instalados. No se guardan grabaciones.

Los respaldos y Excel usan el selector de guardado de Android. La selección de imágenes sigue disponible. Los registros se guardan de forma privada en la app; si conectas Google, los registros que confirmes se sincronizan con tu cuenta existente. No se lee salud en segundo plano, no se consulta la lista completa de aplicaciones y no se guarda el modelo del teléfono en tu historial. La explicación de privacidad puede abrirse desde los permisos de Health Connect.

En Windows y en la web de Android sigue disponible el registro manual. La lectura del servicio local se ofrece en el APK. iPhone no dispone de este puente Android; el registro manual y las gráficas siguen disponibles en la web. Esta versión no añade integración con Apple Health.

## Compilar y publicar

Requisitos: Node >=22.12, JDK 21 completo (con `javac`), Android SDK 36, Build Tools 35.0.0 y 36.0.0. Configura `JAVA_HOME` y `ANDROID_HOME` según tu instalación de Android Studio. Gradle se descarga mediante su wrapper y comprueba el SHA-256 de la distribución.

```sh
npm ci
npm run build:android
```

Este comando compila la web, copia los recursos al proyecto Android, compila el APK, ejecuta las pruebas Kotlin y coloca el APK en `android/releases/Honor-salud-android.apk`, fuera de `dist/`. No ejecutes `cap sync` en paralelo con Gradle: vuelve a generar un módulo que Gradle necesita. El APK no se incluye dentro de sí mismo ni en el caché offline de la PWA.

Firebase Hosting en el plan Spark rechaza archivos APK. Por eso la web se publica desde `dist/` y el APK se distribuye desde la rama `descargas` del repositorio GitHub. El botón Android abre esa descarga externa. `firebase.json` excluye los APK aunque queden archivos antiguos en `dist/`, y redirige el enlace `/downloads/Honor-salud-android.apk` de entregas anteriores a GitHub. No se requiere cambiar al plan Blaze.

En el entorno de Codex Linux puede prepararse el toolchain con `python3 scripts/setup-android-cloud.py`. Usa rutas en `/workspace/.honor-tools`, verifica checksums oficiales y conserva la verificación TLS con los certificados de confianza del entorno. No modifica `HOME`. El script se probó en la máquina actual; no establece por sí solo una comprobación en otra restauración.

La firma de prueba se conserva en `android/.local/debug.keystore`, fuera de Git y del ZIP. No borres esa carpeta del entorno si necesitas producir actualizaciones con el mismo certificado. Al compilar en otro equipo se genera otra firma y habrá que registrar sus huellas; una APK con otra firma no actualiza la instalación anterior. Para publicar en Google Play hacen falta una firma de producción propia y las declaraciones/revisiones de datos de salud de Play. Este paquete está destinado a instalación de prueba personal.

El ZIP de actualización web contiene `dist/` compilado y no requiere instalar un APK. Las entregas que incluyen también Android dejan el APK separado en `android/releases/`. Si solo tienes la entrega web y quieres crear el APK, compila Android antes de registrar su cliente Google. Para actualizar Hosting y las reglas de métricas desde tu sesión Windows, abre la carpeta `Honor_bienestar` del ZIP recién extraído:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

## Validación y límites

Se comprobaron la compilación web, la compilación y firma del APK, sus permisos de solo lectura de salud y las pruebas Kotlin de intervalos de sueño. Las pruebas de navegador simulan el puente Android para comprobar disponibilidad, permisos, ausencia de datos, importación sin perder apuntes y orden de voz. Las pruebas del registro Firebase simulan la CLI para comprobar su alcance y que no repita escrituras existentes.

La compilación y estas simulaciones no verifican lecturas reales de un reloj, los servicios de voz de un teléfono ni el inicio de sesión Google del APK con la cuenta del usuario. Hay que instalar el APK y comprobar que Salud de HONOR u otra fuente escriba datos en Health Connect. El registro Android de Firebase necesita la sesión del propietario y no se ejecutó desde esta máquina.

Fuentes oficiales consultadas:

- https://developer.android.com/health-and-fitness/guides/health-connect
- https://developer.android.com/health-and-fitness/guides/health-connect/develop/get-started
- https://github.com/android/health-samples/tree/main/health-connect/HealthConnectSample
- Fuentes del SDK estable `androidx.health.connect:connect-client:1.1.0`, obtenidas del repositorio oficial de Google.
