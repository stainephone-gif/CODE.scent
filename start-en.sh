#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

echo "Starting CODE.scent (English UI)..."
echo "Press Ctrl+C to stop"
echo ""

npx vite --host 0.0.0.0 --open "/?lang=en"
