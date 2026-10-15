@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Actualizar Honor Bienestar
echo Actualizar Honor - voz y datos de salud
echo Proyecto de Firebase: honor-bienestar
echo.
where node.exe >nul 2>&1
if errorlevel 1 goto :node_missing
where npx.cmd >nul 2>&1
if errorlevel 1 goto :node_missing
set "HONOR_UPDATE_DIR=%TEMP%\Honor-actualizar-%RANDOM%-%RANDOM%"
set "HONOR_UPDATE_URL=https://github.com/juanramos21e-collab/Honor_bienestar/raw/refs/heads/descargas/Honor-web-y-Android-corregido.zip"
set "HONOR_UPDATE_SHA256=6c7cf1e751f484307781fafcaf67a58f4aeb5f9237fcd6b004dc3f3baedf950f"
echo 1. Descargando y comprobando el paquete. Espera sin cerrar esta ventana...
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; New-Item -ItemType Directory -Path $env:HONOR_UPDATE_DIR -ErrorAction Stop | Out-Null; $zip=Join-Path $env:HONOR_UPDATE_DIR 'Honor.zip'; Invoke-WebRequest -UseBasicParsing -Uri $env:HONOR_UPDATE_URL -OutFile $zip -TimeoutSec 120; if ((Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash -ne $env:HONOR_UPDATE_SHA256) { throw 'La comprobacion del ZIP fallo. No se publicara este archivo.' }; Expand-Archive -LiteralPath $zip -DestinationPath $env:HONOR_UPDATE_DIR; $root=Join-Path $env:HONOR_UPDATE_DIR 'Honor_bienestar'; $index=Join-Path $root 'dist\index.html'; if ((Get-Content -Raw -LiteralPath $index) -notlike '*/assets/index-0FUkHDhP.js*') { throw 'El paquete no contiene la version esperada.' }; Write-Host 'Paquete correcto: incluye voz y salud.' } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 goto :prepare_error
pushd "%HONOR_UPDATE_DIR%\Honor_bienestar"
if errorlevel 1 goto :prepare_error
echo.
echo 2. Publicando la nueva version desde su carpeta verificada...
call npx --yes firebase-tools@15.33.0 deploy --only hosting,firestore:rules --project honor-bienestar
set "HONOR_DEPLOY_EXIT=%ERRORLEVEL%"
popd
if not "%HONOR_DEPLOY_EXIT%"=="0" goto :deploy_error
echo.
echo 3. Comprobando la version publicada...
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; try { [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $url='https://honor-bienestar.firebaseapp.com/index.html?honor-check='+[DateTimeOffset]::UtcNow.ToUnixTimeSeconds(); $page=Invoke-WebRequest -UseBasicParsing -Uri $url -Headers @{'Cache-Control'='no-cache'} -TimeoutSec 30; if ($page.Content -notlike '*/assets/index-0FUkHDhP.js*') { throw 'La version publicada no coincide todavia con el paquete.' }; Write-Host 'Version con voz y salud comprobada en Firebase.' } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 goto :verify_error
echo.
echo ACTUALIZACION COMPLETADA Y COMPROBADA.
echo Abre https://honor-bienestar.web.app y pulsa Ctrl+F5.
echo Si Honor muestra un aviso de nueva version, guarda tu registro y pulsa Actualizar.
echo.
echo Microfono: abre Registrar mi dia y busca Comenzar por voz.
echo Reloj: instala el APK Android; abre Cuenta y ajustes, Datos de salud.
echo El reloj necesita compartir las mediciones con Health Connect.
goto :done

:node_missing
echo No encuentro Node.js y npm. Instala Node.js LTS y vuelve a abrir este archivo.
goto :failed

:prepare_error
echo No se pudo preparar el paquete. La publicacion no se ha iniciado.
echo Guarda el mensaje que aparece arriba para revisar el error.
goto :failed

:deploy_error
echo La publicacion devolvio un error. Guarda el mensaje que aparece arriba.
echo Si Firebase pide iniciar sesion, ejecuta en cmd:
echo npx --yes firebase-tools@15.33.0 login
echo Despues vuelve a abrir este archivo.
goto :failed

:verify_error
echo Firebase termino la publicacion, pero no pude comprobar la version por Internet.
echo Guarda el mensaje que aparece arriba para comprobar el resultado.
goto :failed

:failed
echo.
pause
exit /b 1

:done
echo.
pause
exit /b 0
