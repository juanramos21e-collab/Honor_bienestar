# Activar Google y publicar Honor

La web ya funciona sin cuenta. Para acceder al mismo historial desde Android y laptop, hay que conectar Firebase Authentication y Cloud Firestore. No se necesita guardar los archivos en Google Drive.

## 1. Crear el proyecto desde Android

1. En Chrome abre [Firebase Console](https://console.firebase.google.com/) con tu cuenta de Google. Si la consola se ve limitada, activa «Sitio de escritorio» en el menú ⋮.
2. Crea un proyecto (puedes omitir Google Analytics).
3. En Configuración del proyecto → General → Tus aplicaciones, registra una aplicación **Web**.
4. Conserva la configuración pública `firebaseConfig`: `apiKey`, `authDomain`, `projectId` y `appId`. Estos identificadores públicos se incluyen en la web; no son una clave privada de servicio. No compartas ni subas un JSON de cuenta de servicio.
5. Authentication → Método de inicio de sesión → Google: habilítalo y selecciona un correo de soporte.
6. Crea Cloud Firestore, elige la región y empieza en modo de producción. Publica las reglas de [firestore.rules](../firestore.rules) en la pestaña Reglas. Las reglas permiten acceder únicamente a los documentos del usuario autenticado.

## 2. Conectar la web

En la configuración del entorno de desarrollo o de tu proveedor de alojamiento define:

| Variable | Campo de `firebaseConfig` |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

Si trabajas con archivos, copia `.env.example` a `.env.local` y rellena los cuatro campos. `.env.local` está ignorado por Git. La configuración se incorpora al compilar; después de cambiarla hay que ejecutar `npm run build` y publicar la nueva compilación. No introduzcas secretos en variables que empiezan por `VITE_`.

Para un entorno con acceso a Internet restringido, el flujo Google/Firebase necesita `accounts.google.com`, `apis.google.com`, `identitytoolkit.googleapis.com`, `securetoken.googleapis.com`, `firestore.googleapis.com` y el `authDomain` de tu proyecto. Esta configuración no se puede completar con un dominio de proyecto inventado. La navegación del celular usa su propia conexión.

## 3. Publicar con HTTPS

La web necesita una dirección pública HTTPS para instalarse en Android. Firebase Hosting es una opción que incluye HTTPS y el dominio de autorización de Firebase. El archivo `firebase.json` ya contiene la configuración de hosting. Publicar el entorno de Codex conserva la máquina de desarrollo; **no publica la aplicación para los usuarios**.

Desde un entorno de desarrollo con Node y acceso al proyecto:

```sh
npm ci
npm run build
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only hosting,firestore:rules
```

La autenticación y publicación requieren tu cuenta y la selección del proyecto real; no se han ejecutado en esta entrega. No necesitas ejecutar estos comandos en Android: pueden hacerse en un entorno de desarrollo en la nube con el acceso adecuado. También puedes alojar `dist/` con otro proveedor de páginas estáticas que soporte HTTPS.

En Authentication → Configuración → Dominios autorizados, confirma el dominio publicado. Si usas otro proveedor o un dominio propio, sigue la [guía oficial de Firebase para los retornos de autenticación](https://firebase.google.com/docs/auth/web/redirect-best-practices). La aplicación usa una ventana Google; si el navegador bloquea esa ventana, intenta redirección. No funciona dentro de navegadores integrados de ciertas apps: usa Chrome. Los dominios de desarrollo deben autorizarse de forma explícita si se usan para probar Google.

## 4. Comprobar Google con tu proyecto

Estas comprobaciones requieren un proyecto configurado y todavía no se han ejecutado:

1. Inicia sesión desde Android, registra un día y espera «Sincronizado con tu cuenta».
2. Abre la web desde laptop con la misma cuenta; debe aparecer el registro.
3. Desconecta Internet en Android, edita el día y guarda. Reconecta; debe sincronizarse. Si el mismo día cambió también en laptop, la web debe pedirte elegir qué respuestas conservar.
4. En Ajustes → «Incorporar registros sin cuenta», revisa la importación. El historial sin cuenta queda conservado en el navegador.
5. Cierra sesión: se muestra el historial sin cuenta. Inicia otra cuenta: no deben aparecer los registros de la cuenta anterior. Comprueba también que Firestore deniega peticiones a `users/<otro-uid>/days`.

La sincronización se intenta al guardar, abrir la cuenta, recuperar conexión, volver a la ventana y una vez por minuto mientras la app está abierta. No depende de una tarea en segundo plano de Android. Cada día se guarda por fecha; las actualizaciones usan transacciones para detectar cambios desde otros dispositivos. Las respuestas locales y la cola de sincronización persisten aunque cierres la página.

## 5. Instalar en Android

Abre la dirección publicada en Chrome → menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio». Espera la primera carga completa. El service worker guarda la interfaz y los módulos para uso sin conexión. Iniciar Google y sincronizar necesitan Internet; el modo local y los borradores funcionan sin conexión.

Haz un respaldo desde Ajustes antes de borrar los datos del navegador o cambiar de dispositivo. El almacenamiento local depende del navegador y del dominio exacto de la web: cambiar la dirección no mueve automáticamente tus registros.
