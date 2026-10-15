# Honor: carpeta de Drive y datos exclusivos de HONOR Health

[Descargar la actualización web compilada](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-web-Drive-HONOR.zip)

1. Extrae el ZIP en una carpeta nueva y abre **Honor_bienestar**.
2. Escribe **cmd** en la barra de direcciones del Explorador y pulsa Enter.
3. Ejecuta:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

Cuando aparezca **Deploy complete!**, abre https://honor-bienestar.web.app y pulsa Ctrl+F5. Si aparece el aviso de nueva versión, guarda tu registro y pulsa Actualizar.

En **Cuenta y ajustes → Datos de salud** encontrarás la guía de cinco pasos y **Conectar Drive**. Vincula la carpeta configurada para la copia programada de Health Connect. Se incorpora únicamente el escritor oficial HONOR Health; se excluyen los registros del teléfono y de otras apps sin borrar el historial, las respuestas ni los apuntes.

Se comprueba la copia más reciente al volver al frente y cada cinco minutos con la web visible y el acceso temporal de Google vigente. **Al recargar o cerrar la web hay que renovar el acceso de Google; la carpeta se recuerda.** No se descargan ni importan archivos manualmente. No se ofrece sincronización con la web cerrada.

El propietario debe tener habilitada [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com?project=honor-bienestar) y configurar el consentimiento OAuth de lectura de Drive. Google puede requerir usuarios de prueba o verificación según el estado de publicación. La autorización con una cuenta real debe comprobarse después de desplegar. El paquete incluye **LEEME-PRIMERO.txt** y la [guía completa](https://github.com/juanramos21e-collab/Honor_bienestar/blob/main/docs/DRIVE-SALUD.md).

La web ya está compilada. El ZIP no contiene APK ni los datos personales aportados, y conserva la voz por secciones, las gráficas y los GIF. Se verificaron 43 pruebas unitarias y 16 de navegador; Google se simula en las pruebas de conexión, mientras el ZIP y el worker se procesan realmente.

Código: [main](https://github.com/juanramos21e-collab/Honor_bienestar/tree/main). Versión: b4c79c0bdaae5e12fe14e043e5f98a74bf42b496.

SHA-256 del ZIP: 0937e396da577c3af843a358f238f930111b303de176451835a9d6ac8e9e6958.
