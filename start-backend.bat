@echo off
echo ========================================
echo   Nard Arena Backend - Starting Server
echo ========================================
echo.

cd /d "%~dp0"

echo [0/3] Stopping PM2 processes...
call pm2 stop all 2>nul
call pm2 delete all 2>nul
echo PM2 processes stopped.
echo.

echo [1/3] Installing dependencies...
call npm install

echo.
echo [2/3] Building backend...
call npm run build

echo.
echo [3/3] Starting backend server...
echo Server will run on http://localhost:3002
echo API Documentation: http://localhost:3002/api
echo.

call npm run start:dev

pause
