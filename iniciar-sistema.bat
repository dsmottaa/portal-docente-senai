@echo off
title Portal do Docente SENAI
cd /d "%~dp0"

echo [1/3] Encerrando servidor anterior na porta 8000, se existir...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  echo     - Encerrando PID %%a...
  taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Iniciando "node server.js" em nova janela...
start "Portal do Docente SENAI - Servidor" cmd /k node server.js

echo [3/3] Verificando IA local (Ollama)... aguarde alguns segundos.
timeout /t 2 /nobreak >nul

start "" "http://localhost:8000"
echo.
echo Pronto! O portal foi aberto no navegador.
echo Para encerrar, feche a janela "Portal do Docente SENAI - Servidor".
echo.
pause