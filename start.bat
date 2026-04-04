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

echo Starting source.scent...
echo Press Ctrl+C to stop
echo.

call npx vite --open
