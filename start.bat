@echo off
title source.scent

cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
    echo.
)

echo Starting source.scent at http://localhost:5173
echo Press Ctrl+C to stop
echo.

start "" http://localhost:5173
call npx vite
