@echo off
chcp 65001 >nul
title source.scent

echo.
echo   source.scent — запуск...
echo.

cd /d "%~dp0"

if not exist node_modules (
    echo   Первый запуск: установка зависимостей...
    echo.
    call npm install
    echo.
)

echo   Открываю http://localhost:5173
echo   Для остановки нажмите Ctrl+C в этом окне
echo.

start "" http://localhost:5173
call npx vite
