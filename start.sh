#!/bin/bash
echo ""
echo " Checking for Node.js..."
if ! command -v node &> /dev/null; then
    echo " ERROR: Node.js is not installed!"
    echo " Install it from https://nodejs.org or via your package manager."
    exit 1
fi

echo " Installing dependencies..."
npm install --silent

echo " Starting server..."
echo ""

# Auto-open browser
URL="http://localhost:3000"
if command -v xdg-open &> /dev/null; then
    xdg-open "$URL" &
elif command -v open &> /dev/null; then
    open "$URL" &
fi

node server.js
