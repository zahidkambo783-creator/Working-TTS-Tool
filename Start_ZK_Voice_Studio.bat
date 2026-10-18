@echo off
title ZK Voice Studio
echo ==========================================================
echo               Starting ZK Voice Studio...
echo ==========================================================
echo.

if exist "%~dp0package.json" (
    cd /d "%~dp0"
) else if exist "%~dp0zk-voice-studio\package.json" (
    cd /d "%~dp0zk-voice-studio"
)

echo [1/2] Opening browser interface...
start http://localhost:3000

echo [2/2] Launching Next.js & Python AI Backend concurrently...
npm run dev
pause
