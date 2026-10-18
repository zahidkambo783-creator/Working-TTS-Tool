@echo off
title ZK Voice Studio
echo ==========================================================
echo               Starting ZK Voice Studio...
echo ==========================================================
echo.
cd /d "%~dp0zk-voice-studio"

echo [1/2] Launching Python AI Engine & Web Interface...
start http://localhost:3000
npm run dev
pause
