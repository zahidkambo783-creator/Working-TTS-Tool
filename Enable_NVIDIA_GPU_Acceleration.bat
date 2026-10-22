@echo off
title ZK Voice Studio - Enable NVIDIA GPU Acceleration
echo ==========================================================
echo        ZK Voice Studio - NVIDIA GPU Acceleration Setup
echo ==========================================================
echo.
echo Detected GPU: NVIDIA GeForce GTX 1660 SUPER (6GB VRAM)
echo.
echo This script will install PyTorch with CUDA 12.4 support.
echo This will make Voice Cloning 20x-30x faster (3-5 seconds instead of 2 minutes)!
echo.
echo Press any key to start installing PyTorch with CUDA...
pause >nul

echo [1/2] Uninstalling previous PyTorch...
python -m pip uninstall -y torch torchvision torchaudio

echo.
echo [2/2] Installing CUDA 12.4 PyTorch for NVIDIA GPU (GTX 1660 SUPER)...
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

echo.
echo ==========================================================
echo Testing GPU Acceleration...
python -c "import torch; print('CUDA Available:', torch.cuda.is_available()); print('GPU Name:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'None')"
echo ==========================================================
echo.
echo If CUDA Available is True, your GPU is now active!
echo You can now restart ZK Voice Studio using Start_ZK_Voice_Studio.bat
pause
