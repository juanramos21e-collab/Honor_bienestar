# Honor: lectura del ZIP de Drive y origen de datos

[Descargar actualización web compilada](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-web-Drive-lectura.zip)

1. Extrae el ZIP en una carpeta nueva y abre **Honor_bienestar**.
2. Escribe **cmd** en la barra de direcciones del Explorador y pulsa Enter.
3. Ejecuta:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

Espera **Deploy complete!**, abre https://honor-bienestar.web.app y pulsa Ctrl+F5. Si hay aviso de nueva versión, guarda tu registro y pulsa Actualizar.

En **Cuenta y ajustes → Datos de salud**, **Actualizar datos de salud** descarga, descomprime y lee el ZIP aunque Drive informe que no ha cambiado. Las comprobaciones automáticas conservan el ahorro de descargas; una nueva versión del lector revisa las copias anteriores.

**Datos encontrados en la copia** muestra los tipos de mediciones, orígenes, cantidades y compatibilidad. Se importa exclusivamente el escritor oficial HONOR Health. La presencia de datos del teléfono en un ZIP no demuestra que HONOR haya escrito mediciones. Sincroniza el dispositivo en HONOR Health y comprueba los registros de ese origen en Health Connect antes de esperar su siguiente exportación a Drive.

Se retiró el apartado «Si Google rechaza la conexión». Las gráficas de salud eligen inicialmente una métrica con datos, incluidas las calorías cuando son las únicas disponibles. Se mantienen el acceso temporal de Google, la carpeta guardada, las respuestas, los apuntes, la voz y los GIF.

La guía completa está en [DRIVE-SALUD.md](https://github.com/juanramos21e-collab/Honor_bienestar/blob/main/docs/DRIVE-SALUD.md) y el paquete incluye **LEEME-PRIMERO.txt**.

**52 pruebas unitarias y 19 escenarios de navegador** pasaron. Google y su API se simulan; ZIP, SQLite, worker y WASM se ejecutan realmente. También se comprobó localmente el archivo aportado, sin incluirlo en Git ni en el paquete. No se ha consultado la carpeta privada del usuario desde este entorno.

El ZIP contiene fuente y web compilada, sin APK, datos personales, bases de salud ni claves privadas. Compatible con Firebase Hosting Spark.

Código: [main](https://github.com/juanramos21e-collab/Honor_bienestar/tree/main). Versión: 0fc3de8259d3996e8363f3dd95a442125af901d4.

SHA-256 del ZIP: 935d15479b24a2a791302597cdaafa09f06593fdefd9390ccef89d871fbe07a1.
