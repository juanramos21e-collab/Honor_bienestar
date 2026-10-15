# Honor: acceso de Drive reutilizado

[Descargar actualización web compilada](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-web-Drive-sesion.zip)

1. Extrae el ZIP en una carpeta nueva y abre **Honor_bienestar**.
2. Escribe **cmd** en la barra de direcciones del Explorador y pulsa Enter.
3. Ejecuta:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

Cuando aparezca **Deploy complete!**, abre https://honor-bienestar.web.app y pulsa Ctrl+F5. Si aparece un aviso de nueva versión, guarda tu registro y pulsa Actualizar.

Se quitó el párrafo indicado de **Datos de salud**. **Actualizar datos de salud** reutiliza el acceso y la carpeta vinculada; recargar la misma pestaña ya no obliga a conectar Google de nuevo. Si Google devuelve un acceso con permiso de Drive al iniciar sesión, también se aprovecha sin abrir otra autorización. Se indica a Google la cuenta conocida sin forzar un selector.

Google exige el permiso de Drive la primera vez. La sesión de Firebase por sí sola no lo concede. El acceso temporal se mantiene en la sesión de la pestaña y caduca en unos 55 minutos; cerrar la pestaña, cerrar sesión, revocar el permiso o desvincular lo descarta. Si hace falta renovarlo, pulsa **Actualizar datos de salud**; la carpeta se recuerda.

Se comprueba la copia al volver al frente y cada cinco minutos con la web visible y autorizada. La frecuencia depende de la exportación de Health Connect. Se mantiene el filtro exclusivo HONOR, la voz por secciones, las gráficas, los GIF y la sincronización de registros. No se borra el historial.

Google Drive API y el consentimiento OAuth de lectura deben estar habilitados en el proyecto. La conexión con la cuenta real se comprueba después de publicar. La [guía completa](https://github.com/juanramos21e-collab/Honor_bienestar/blob/main/docs/DRIVE-SALUD.md) y **LEEME-PRIMERO.txt** describen los límites.

ZIP con fuente y web compilada, sin APK, datos personales, bases de salud ni claves privadas. **50 pruebas unitarias y 17 escenarios de navegador** pasaron. Google se simula; el ZIP, SQLite, el worker y su WASM se procesan realmente.

Código: [main](https://github.com/juanramos21e-collab/Honor_bienestar/tree/main). Versión: ffb5e100d787dd23fa88b05a4fe9c3eccdc52e14.

SHA-256 del ZIP: abc692252dc23e7bfef3f87233e2a6dd39e1018ecf665166fc7409e415377927.
