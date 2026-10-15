@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Backup Externo - Portal do Docente SENAI
echo =============================================================
echo  BACKUP EXTERNO - PORTAL DO DOCENTE SENAI
echo =============================================================
echo.

REM Detecta drives removiveis
set DRIVES=
for /f "tokens=*" %%d in ('powershell -NoProfile -Command "Get-Volume -DriveType Removable | Select-Object -ExpandProperty DriveLetter"') do (
    set DRIVES=!DRIVES! %%d
)
if "!DRIVES!"=="" (
    echo [ERRO] Nenhum pendrive detectado. Conecte um pendrive e tente novamente.
    pause
    exit /b 1
)

REM Conta drives
set COUNT=0
for %%d in (!DRIVES!) do set /a COUNT+=1

set DEST_DRIVE=
if %COUNT% EQU 1 (
    for %%d in (!DRIVES!) do set DEST_DRIVE=%%d
) else (
    echo [INFO] Multiplos pendrives detectados:
    set IDX=0
    for %%d in (!DRIVES!) do (
        set /a IDX+=1
        echo   [!IDX!] %%d:
    )
    choice /C:123456789 /N /M "Selecione o numero do pendrive desejado: "
    set SEL=!ERRORLEVEL!
    set IDX=0
    for %%d in (!DRIVES!) do (
        set /a IDX+=1
        if !IDX! EQU !SEL! set DEST_DRIVE=%%d
    )
)

if not defined DEST_DRIVE (
    echo [ERRO] Nenhum destino selecionado.
    pause
    exit /b 1
)

REM Executa backup
set TIMESTAMP=%date:~-4%%date:3,2%%date:0,2%-%time:~0,2%%time:3,2%%time:6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set LOGFILE=backups\backup-%TIMESTAMP%.log

echo [INFO] Iniciando backup para %DEST_DRIVE%:\ ...
node backup-externo.cjs %DEST_DRIVE%:\ >"%LOGFILE%" 2>&1
if errorlevel 1 (
    echo [ERRO] Falha no backup. Consulte %LOGFILE%
) else (
    echo [OK] Backup concluido. Log: %LOGFILE%
    echo [INFO] Arquivo de backup copiado para %DEST_DRIVE%:\
)
pause