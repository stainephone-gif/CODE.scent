#!/bin/bash
cd "$(dirname "$0")"

echo ""
echo "  source.scent — запуск..."
echo ""

if [ ! -d node_modules ]; then
    echo "  Первый запуск: установка зависимостей..."
    echo ""
    npm install
    echo ""
fi

echo "  Открываю http://localhost:5173"
echo "  Для остановки нажмите Ctrl+C"
echo ""

# Открыть браузер (Linux / Mac)
if command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173 &
elif command -v open &>/dev/null; then
    open http://localhost:5173 &
fi

npx vite
