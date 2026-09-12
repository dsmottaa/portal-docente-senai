@echo off
title Portal do Docente SENAI - Instalar IA Local (Ollama)
chcp 65001 >nul
mode con cols=78 lines=30

echo =============================================================
echo    PORTAL DO DOCENTE SENAI - INSTALAR IA LOCAL (OLLAMA)
echo =============================================================
echo.

REM --- Verifica o Node.js (motor do portal) ---
where node >nul 2>&1
if errorlevel 1 (
  echo  [!] Node.js NAO encontrado neste PC.
  echo      Instale antes: https://nodejs.org  (versao 24 LTS)
  echo      Depois rode este arquivo de novo ou o "iniciar-sistema.bat".
  echo.
)

REM --- Se o Ollama ja estiver instalado, so baixa o modelo ---
where ollama >nul 2>&1
if not errorlevel 1 goto baixar_modelo

echo  [1/2] Baixando o instalador do Ollama...
powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile '%TEMP%\OllamaSetup.exe'"
if errorlevel 1 goto erro

echo        Instalando... (aguarde)
start /wait "" "%TEMP%\OllamaSetup.exe" /S

where ollama >nul 2>&1
if errorlevel 1 (
  echo        A instalacao nao confirmou em modo silencioso.
  echo        Abrindo a janela de instalacao para concluir manualmente...
  start "" "%TEMP%\OllamaSetup.exe"
  echo        Conclua a instalacao e depois volte aqui.
  pause
)

:baixar_modelo
echo.
echo  [2/2] Baixando o modelo de IA (qwen2.5:3b, ~2 GB - so na 1a vez)...
echo        Isto pode levar alguns minutos dependendo da sua internet.
ollama pull qwen2.5:3b
if errorlevel 1 goto erro_ia

echo.
echo =============================================================
echo   PRONTO! A IA LOCAL ESTA INSTALADA E ATIVA.
echo   Agora:  1) feche esta janela   2) abra o portal
echo   Depois do login, teste a pagina "Assistente IA".
echo =============================================================
pause
exit /b 0

:erro_ia
echo.
echo  [!] O modelo nao foi baixado.
echo      Confira a internet e tente: ollama pull qwen2.5:3b
echo      Se o Ollama nao abriu, clique no icone da lhama na
echo      bandeja do Windows e rode este arquivo de novo.
pause
exit /b 1

:erro
echo.
echo  [X] Falha ao baixar o instalador. Verifique a internet e tente
echo      novamente, ou baixe manualmente em https://ollama.com/download
pause
exit /b 1