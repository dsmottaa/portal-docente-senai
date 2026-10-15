@echo off
chcp 65001 >nul
title Portal do Docente SENAI - Iniciar
echo =============================================================
echo  PORTAL DO DOCENTE SENAI - INICIAR
echo =============================================================
echo.

REM Verifica Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado.
    echo        Instale Node.js 22+ (https://nodejs.org) e tente novamente.
    echo.
    pause
    exit /b 1
)

REM Verifica versao >=22
for /f "tokens=2 delims=v" %%v in ('node -v') do set NODE_VER=%%v
for /f "tokens=1 delims=." %%m in ("%NODE_VER%") do set NODE_MAJOR=%%m
if %NODE_MAJOR% LSS 22 (
    echo [AVISO] Node.js versao %NODE_VER% detectada (recomendado 22+).
    echo         O sistema pode funcionar, mas recomenda-se atualizar.
    echo.
)

REM Instala dependencias se necessario
if not exist node_modules (
    echo [INFO] node_modules nao encontrado. Instalando dependencias (npm ci)...
    call npm ci
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias. Verifique conexao e tente novamente.
        pause
        exit /b 1
    )
) else (
    REM Verifica se package-lock.json mais novo que node_modules
    for %%f in (package-lock.json) do set PL_TIME=%%~tf
    for %%f in (node_modules) do set NM_TIME=%%~tf
    if "%PL_TIME%" GTR "%NM_TIME%" (
        echo [INFO] package-lock.json atualizado. Reinstalando dependencias (npm ci)...
        call npm ci
        if errorlevel 1 (
            echo [ERRO] Falha ao reinstalar dependencias.
            pause
            exit /b 1
        )
    )
)

REM Libera porta 8000
echo [INFO] Liberando porta 8000 se ocupada...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
    echo [INFO] Encerrando PID %%a na porta 8000...
    taskkill /F /PID %%a >nul 2>&1
)

REM Inicia servidor em background
echo [INFO] Iniciando servidor...
start /b node server.js

REM Aguarda bind
timeout /t 2 /nobreak >nul

REM Verifica GEMINI_API_KEY (opcional)
if not defined GEMINI_API_KEY (
    echo [AVISO] Variavel de ambiente GEMINI_API_KEY nao definida. O Assistente IA pode nao funcionar.
)

REM Abre navegador
start "" "http://localhost:8000"

echo.
echo [OK] Portal iniciado. Acesse http://localhost:8000
echo      Para encerrar, feche esta janela ou pressione Ctrl+C no terminal do servidor.
echo.
pause