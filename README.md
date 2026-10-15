# Honor: voz por secciones y HONOR Health oficial

[Descargar el paquete web actualizado](https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-web-voz-y-PlayStore.zip)

1. Extrae el ZIP en una carpeta nueva y abre **Honor_bienestar**.
2. Escribe **cmd** en la barra de direcciones del Explorador y pulsa Enter.
3. Ejecuta:

```cmd
npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
```

Cuando aparezca **Deploy complete!**, abre https://honor-bienestar.web.app y pulsa Ctrl+F5. Si Honor avisa de una nueva versión, guarda tu registro y pulsa Actualizar.

La web ya está compilada. Este ZIP no contiene APK ni necesita instalarlo para usar la voz en Chrome.

- Actividades: **sí o no**.
- Cómo me siento: **nada, poco, medio, bastante o mucho**.
- Peso: **kilogramos**, con decimales.

El asistente anuncia las instrucciones de cada sección también en el modo breve. Las preguntas del reloj son opcionales. Al final puedes dictar tus apuntes y decir guardar o revisar.

**Cuenta y ajustes → Datos de salud** ahora abre [HONOR Health oficial en Google Play](https://play.google.com/store/apps/details?id=com.hihonor.health). Instalar la app oficial no autoriza a nuestra web a leer sus mediciones privadas: se mantiene el registro manual y las gráficas. La integración Android/Health Connect del proyecto sigue siendo distinta y depende de los permisos y datos compartidos por la app de origen.

Código: [main](https://github.com/juanramos21e-collab/Honor_bienestar/tree/main). Versión: `1ca78680f3407c98870583813cd6a417ae63e0d3`.

SHA-256 del ZIP: `8af1522a101b3f3fea814cc3f078de9b24bd95c32a43695580d0b9a46f2ae3a0`.
