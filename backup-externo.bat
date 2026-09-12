@echo off
title Backup Externo - Portal do Docente SENAI
cd /d "%~dp0"

echo ============================================
echo  Backup externo do Portal do Docente SENAI
echo ============================================
echo.
echo Conecte o pendrive e informe o destino.
echo Se nao informar nada, procuro D:, E: ou F:.
echo.
set /p DEST=Destino (ex.: D:\) ou Enter para procurar: 

node backup-externo.cjs %DEST%
echo.
echo ------------------------------------------------------------
echo  Dica: faca este backup ao menos 1x por semana.
echo  Ele copia um snapshot do banco + a pasta backups\ inteira.
echo ------------------------------------------------------------
echo.
pause