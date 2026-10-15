# Honor: paquete completo para actualizar

[Descargar el paquete web y Android corregido](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-web-y-Android-corregido.zip)

1. Extrae el ZIP en una carpeta nueva y abre **Honor_bienestar**.
2. Escribe **cmd** en la barra de direcciones del Explorador y pulsa Enter.
3. Ejecuta:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

Cuando aparezca **Deploy complete!**, abre https://honor-bienestar.web.app y pulsa Ctrl+F5. Si aparece el aviso de nueva versión en Honor, guarda tu registro y pulsa Actualizar.

El paquete ya está compilado. **Firebase Spark bloquea los APK alojados en Hosting.** Esta entrega deja la web en `dist/` y el APK separado en `android/releases/Honor-salud-android.apk`. La configuración excluye también cualquier APK de entregas anteriores. No hace falta cambiar de plan.

**Micrófono:** abre el formulario del día y pulsa **Comenzar por voz**, arriba de las preguntas.

**Reloj:** instala en el celular el APK incluido o [descárgalo desde GitHub](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-salud-android.apk). Abre **Cuenta y ajustes → Datos de salud**. La lectura requiere Android 9+, Health Connect compatible y que la app del reloj comparta las mediciones con ese servicio.

La firma del APK se mantiene. Para Google, ejecuta una vez `npm run android:google` desde el paquete y tu sesión Firebase. Lee `LEEME-PRIMERO.txt` para migrar un historial local al APK y consultar los límites.

Código: [main](https://github.com/juanramos21e-collab/Honor_bienestar/tree/main). Versión: `345474e28e1a9f36db553a7764323145eb0acb5f`.

SHA-256 del ZIP: `6c7cf1e751f484307781fafcaf67a58f4aeb5f9237fcd6b004dc3f3baedf950f`.
