# Honor · Mi bienestar

[Abrir Honor](https://honor-bienestar.firebaseapp.com/)

La aplicación está publicada en Firebase Hosting y se puede abrir desde Android o Windows. Este repositorio conserva el código fuente y su historial de cambios. Para llevar una modificación del código a la web, compila el proyecto y publica la nueva versión en Firebase; subir un commit a GitHub no inicia un despliegue automático.

Web instalable en Android (PWA), con la misma información y fórmula de la aplicación original de Streamlit y su Excel. El repositorio contiene la web y su configuración; los archivos personales enviados no se publican ni se incluyen en la compilación.

## Lo que incluye

- Menú principal: «¿Qué hiciste hoy?» y «Ver mi progreso».
- Nueve actividades con los pesos de productividad del Excel; seis preguntas de estado, peso opcional y notas.
- Un registro por fecha. Las respuestas guardadas reaparecen al editar; los cambios actualizan ese día. El borrador también se guarda mientras respondes.
- Gráficas de estado, peso y variables con agrupación por día, semana, mes y año, filtros y detalle diario.
- Guardado local en IndexedDB, apertura sin conexión tras la primera carga e instalación en Android.
- Importación de `Data_Estado_Ani.xlsx` y respaldos JSON con revisión de fechas coincidentes; exportación de registros a Excel y respaldo JSON.
- Personalización de nombre, imagen de portada e imagen del menú desde el celular. Esas preferencias quedan en cada dispositivo.
- Integración con Google/Firebase y cola local de sincronización. **Necesita la configuración de un proyecto Firebase para activarse.** No se simula una sesión cuando falta la configuración.
- Catálogo de frases y orientación del Excel original. Las frases cambian cada dos horas o al pulsar el botón; se evita repetirlas durante siete días mientras haya opciones disponibles. La orientación conserva el criterio original de la variable de menor valor.

## Desarrollo

Requiere Node >=22.12 (validado con Node 24.19.0) y npm. Cada tarea en la nube ya está aislada: usa el checkout existente, sin crear worktrees salvo que se solicite.

```sh
cd /workspace/Honor_bienestar
npm ci
npm run dev
```

Para compilar y probar la versión instalable:

```sh
npm run build
npm run preview
```

El service worker se genera en la compilación de producción. En desarrollo con Vite no se registra para evitar cachés durante cambios de código. No se necesita un servidor Python ni mantener un Excel abierto.

Para el sandbox de Codex, añade `npm_config_cache=/tmp/honor-npm` antes del comando npm si el directorio de caché predeterminado no es escribible.

## Validación

```sh
npm test
```

Sin configuración Firebase, ejecuta `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e` (tres pruebas). Si Firebase ya está configurado, ejecuta `CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e -- --grep-invert 'Google pendiente'` (dos pruebas). La prueba «Google pendiente» corresponde exclusivamente a una compilación sin configuración Firebase.

Las pruebas unitarias cubren la fórmula, los pesos, vacíos frente a ceros, períodos, validación de datos, conflictos e importación del formato original. Las pruebas en Chromium con tamaño de pantalla Android cubren registro, edición sin duplicados, recuperación del borrador, recarga sin conexión, importación, respaldo y las dos imágenes. Si Chromium no está instalado, usa la instalación estándar de Playwright (`npx playwright install chromium`) y omite `CHROMIUM_PATH`.

Google y Firestore deben verificarse con un proyecto real siguiendo [la guía de Google y publicación](docs/GOOGLE-Y-PUBLICACION.md). Las pruebas locales no establecen que la sincronización con una cuenta real haya sido validada.

## Compatibilidad con el Excel

Se lee la hoja `Estado_Animo`, incluyendo los encabezados originales con espacios, `Productibidad`, `Pass_think`, `Heartache` y las fórmulas con resultados guardados. También se recuperan las actividades de la hoja `Productividad`. Se omiten filas futuras que solo tienen un cero automático de productividad.

```text
Productividad = Meditar×0.05 + Leer×0.08 + Limpieza×0.05
              + Universidad×0.15 + Proyectos personales×0.22
              + Aprender×0.10 + Apoyar×0.15 + Cronograma×0.10 + Gym×0.10

Estado = Productividad + Energía + Proyectos personales + Universidad
       + Salud − Pensamientos − Dolor
Porcentaje de estado = Estado / 3
```

La fórmula original puede producir valores mayores que 100% o negativos. Se mantiene ese comportamiento, se omiten los vacíos y el peso queda separado. Es un indicador de las respuestas de la persona, no una evaluación médica.

La productividad importada se conserva en modo manual para respetar el historial; puedes elegir recalcularla con las actividades al editar. El Excel exportado conserva las variables originales y los resultados, además de las actividades y notas. No conserva macros, formato, fórmulas auxiliares ni otras hojas no relacionadas con el registro. El respaldo JSON conserva todos los campos de los registros; las imágenes y borradores no se incluyen.

## Google y publicación

La versión publicada utiliza el proyecto Firebase `honor-bienestar`. En una copia nueva del repositorio, configura las cuatro variables indicadas en `.env.example` mediante un archivo local `.env.local` o las variables del entorno de compilación. `.env.local` está excluido de Git. Los dominios, la aplicación web y el proveedor Google ya se configuraron en Firebase; el acceso y la sincronización con una cuenta real requieren comprobarse entre dispositivos.

Desde la carpeta que contiene `firebase.json`, publica los cambios con:

```sh
npm run build
npx --yes firebase-tools@15.33.0 deploy --only hosting --project honor-bienestar
```

Consulta [GOOGLE-Y-PUBLICACION.md](docs/GOOGLE-Y-PUBLICACION.md) para crear el proyecto desde Android, habilitar Google, publicar las reglas de acceso y alojar la web con HTTPS. El alojamiento externo no se realiza al publicar un entorno de Codex.

Sin cuenta, los registros solo existen en ese navegador y dominio. Se solicita almacenamiento persistente, pero el navegador puede no concederlo: descarga respaldos. Con Google, cada cuenta tiene un historial independiente; puedes incorporar los registros locales desde Ajustes sin borrar la copia sin cuenta. Si dos dispositivos modifican el mismo día, se comparan antes de sobrescribir.
