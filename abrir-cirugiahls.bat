@echo off
setlocal

cd /d "%~dp0"

set "NODE_EXE=C:\Users\Abelino\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE_EXE%" (
  echo No se encontro el runtime de Node en:
  echo %NODE_EXE%
  echo.
  echo Abre la app manualmente con el comando indicado en el chat.
  pause
  exit /b 1
)

start "" http://localhost:4173
"%NODE_EXE%" server.js
