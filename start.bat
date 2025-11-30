@echo off
echo ========================================
echo   Nard Arena Backend - Starting Server
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Installing dependencies...
call npm install

echo.
echo [2/2] Starting backend server...
echo Server will run on http://localhost:3002
echo API Documentation: http://localhost:3002/api
echo.

call npm run start:dev

pause
