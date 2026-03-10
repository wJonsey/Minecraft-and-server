@echo off
title Minecraft Browser Server
echo.
echo  Checking for Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is not installed!
    echo  Please install it from https://nodejs.org
    pause
    exit /b 1
)

echo  Installing dependencies...
call npm install --silent

echo  Starting server...
echo.
start "" http://localhost:3000
node server.js
pause
