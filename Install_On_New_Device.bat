@echo off
title ZK Voice Studio - One-Click Installer
echo ==========================================================
echo        ZK Voice Studio - New Device Automated Setup
echo ==========================================================
echo.

if exist "%~dp0package.json" (
    cd /d "%~dp0"
) else if exist "%~dp0zk-voice-studio\package.json" (
    cd /d "%~dp0zk-voice-studio"
)

:: 1. Check Node.js
echo [Step 1/4] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js (LTS version) from: https://nodejs.org
    pause
    exit /b 1
)
node -v
echo Node.js is ready.
echo.

:: 2. Check Python
echo [Step 2/4] Checking Python...
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed!
    echo Please install Python 3.10 or 3.11 from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation!
    pause
    exit /b 1
)
python --version
echo Python is ready.
echo.

:: 3. Check / Install FFmpeg
echo [Step 3/4] Checking FFmpeg...
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo FFmpeg not detected in PATH. Attempting automatic installation via winget...
    winget install Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [NOTE] If winget is unavailable, please install ffmpeg via: winget install ffmpeg
    )
) else (
    echo FFmpeg is already installed.
)
echo.

:: 4. Install Dependencies
echo [Step 4/4] Installing all Node.js & Python dependencies...
echo Installing npm packages...
call npm install

echo.
echo Installing Python AI & Audio libraries...
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt

echo.
echo ==========================================================
echo       Setup Completed Successfully!
echo       You can now double-click Start_ZK_Voice_Studio.bat
echo ==========================================================
echo.
pause
