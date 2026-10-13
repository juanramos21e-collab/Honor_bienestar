# Editar los textos de Honor

Los textos se editan en los archivos del proyecto y se publican nuevamente en Firebase Hosting. La consola de Firebase administra el alojamiento, el acceso y los datos; no es un editor de los párrafos de la interfaz.

## Cambiar un texto de Ajustes

1. Abre la carpeta `Honor_bienestar` en [Visual Studio Code](https://code.visualstudio.com/).
2. Abre `src/components/Settings.tsx`.
3. Usa Ctrl+F para buscar la frase que quieras cambiar. Puedes reemplazar el texto que aparece entre `<p>` y `</p>`. Por ejemplo:

```tsx
<p>Abre Honor como una app en Android.</p>
```

4. Guarda el archivo con Ctrl+S.

## Dónde están los demás textos

| Pantalla | Archivo |
| --- | --- |
| Inicio y menú | `src/App.tsx` |
| Cuestionario del día | `src/components/DayForm.tsx` |
| Gráficas y progreso | `src/components/Progress.tsx` |
| Cuenta y ajustes | `src/components/Settings.tsx` |
| Preguntas sobre las actividades | `src/lib/model.ts` (campos `label` y `hint`) |
| Colores, tamaños y distribución | `src/styles.css` |

Para localizar una frase, usa Ctrl+Shift+F en Visual Studio Code y limita la búsqueda a `src/**`. Así encontrarás el archivo fuente que corresponde a ese texto.

## Ver los cambios antes de publicarlos

Abre una terminal en la carpeta que contiene `package.json` y `firebase.json`.

La primera vez instala las dependencias:

```cmd
npm ci
```

Para revisar la aplicación durante la edición:

```cmd
npm run dev
```

Vite mostrará la dirección local de desarrollo en tu terminal. La vista de desarrollo refleja los archivos guardados; publicar la web es un paso separado.

## Actualizar la web publicada

Desde esa misma carpeta:

```cmd
npm run build
npx --yes firebase-tools@15.33.0 deploy --only hosting --project honor-bienestar
```

Si ya iniciaste sesión en Firebase CLI con tu cuenta, se reutiliza. Si la sesión dejó de estar disponible, ejecuta `npx --yes firebase-tools@15.33.0 login` y completa el flujo de Google en tu navegador.

El despliegue actualiza la web en el mismo dominio. Publicar solo Hosting conserva los registros de Firestore. En una app instalada, utiliza «Actualizar» cuando aparezca el aviso de nueva versión; guarda el registro que estés completando antes de actualizar.

La configuración pública en `.env.local` está incluida en el paquete preparado para publicar y sigue ignorada por Git. Conserva ese archivo al trabajar en tu copia del proyecto.
