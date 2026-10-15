# Descargar y actualizar Honor

[Descargar actualizador para Windows](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Actualizar-Honor-Windows.zip)

En Windows, extrae el ZIP y abre `Actualizar-Honor.cmd` para descargar el paquete, verificar su SHA-256 y publicar la versión correcta usando tu sesión de Firebase. Usa una carpeta nueva para evitar publicar por error una copia anterior. Después comprueba la versión que devuelve Firebase. No necesita instalar dependencias del proyecto ni Android Studio.

[Descargar el APK Android](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-salud-android.apk)

El micrófono está en **Registrar mi día → Comenzar por voz**. Los datos de salud están en **Cuenta y ajustes → Datos de salud**. La consulta de Health Connect requiere el APK Android y que la app del reloj comparta sus mediciones con ese servicio. La web permite registro manual y gráficas.

## Actualización manual

[Descargar el ZIP listo para publicar](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-Android-y-web-salud.zip)

1. Extrae el ZIP y abre la carpeta `Honor_bienestar`.
2. Escribe `cmd` en la barra de direcciones del Explorador y pulsa Enter.
3. Ejecuta:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

Cuando aparezca `Deploy complete!`, abre https://honor-bienestar.web.app y actualiza la página.

El paquete incluye la web compilada y el APK de prueba. Para instalar el APK, usa `Honor_bienestar/dist/downloads/Honor-salud-android.apk`. Para habilitar Google en el APK, ejecuta una vez `npm run android:google` desde la misma carpeta y tu sesión de Firebase. Consulta `LEEME-PRIMERO.txt` dentro del ZIP.

Código de origen: [main](https://github.com/juanramos21e-collab/Honor_bienestar/tree/main).
Versión del código: `b4e8323660505f32377527770cb5216b6288b292`.

SHA-256 del ZIP: `9fe04dc3061211359f6ce2d91a3f5f9d793ec83621787092d05b3726194455fd`.
