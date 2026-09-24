@echo off
title Portal do Docente SENAI - Instalar dependencias
chcp 65001 >nul
mode con cols=78 lines=22

echo =============================================================
echo    PORTAL DO DOCENTE SENAI - INSTALAR DEPENDENCIAS
echo =============================================================
echo.

REM --- Verifica o Node.js (motor do portal) ---
where node >nul 2>&1
if errorlevel 1 (
  echo  [!] Node.js NAO encontrado neste PC.
  echo      Instale antes: https://nodejs.org  (versao 22 ou 24 LTS)
  echo      Depois rode este arquivo de novo ou o "iniciar-sistema.bat".
  echo.
  pause
  exit /b 1
)

echo  [1/2] Instalando dependencias do projeto (npm install)...
call npm install
if errorlevel 1 goto erro

echo.
echo  [2/2] IA do portal usa o Google Gemini (conta nao precisa de Ollama).
echo        Antes de usar o "Assistente IA":
echo         1) Gere uma chave em: https://aistudio.google.com/apikey
echo         2) Defina a variavel GEMINI_API_KEY (ou edite o server.js)

echo.
echo =============================================================
echo    PRONTO! DEPENDENCIAS INSTALADAS.
echo    Depois do login, teste a pagina "Assistente IA".
echo =============================================================
pause
exit /b 0

:erro
echo.
echo  [X] Falha ao instalar dependencias. Verifique a internet e rode novamente.
pause
exit /b 1