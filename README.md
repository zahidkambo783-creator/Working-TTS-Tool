# 🎙️ ZK Voice Studio

An ultra-realistic, multi-engine AI Voice Cloning and Text-to-Speech (TTS) Studio.

---

## ⚡ Features
- **Edge TTS:** 322+ free worldwide voices with zero quota limits and DRM v2 bypass.
- **Kokoro TTS:** 41 multi-language local AI voices (American, British, Hindi, Spanish, French, Italian, Portuguese) with pre-rendered instant previews.
- **F5-TTS Voice Cloning:** 
  - Dual-Engine Switch: **Local PC (Free & Offline)** vs **Replicate Cloud GPU (Ultra Fast)**.
  - Multi-Language Auto-Transliteration (`any-ascii` for Hindi Devanagari, Urdu, Spanish, etc. with zero noise).
  - **1-Click AI Auto-Transcribe:** Automatically transcribe reference audio into exact text with Faster-Whisper.
- **Silence Remover:** Audio waveform inspector and automatic silence trimmer.
- **Multi-Key Failover:** ElevenLabs rotation system with automated key testing.

---

## 💻 Running On a New PC / Laptop (Step-by-Step)

### Prerequisites:
1. **Node.js (v18 or v20+):** [Download Node.js](https://nodejs.org/)
2. **Python (3.10 or 3.11):** [Download Python](https://www.python.org/downloads/) *(Important: Check "Add Python to PATH" during install)*
3. **FFmpeg:** Open PowerShell and run: `winget install ffmpeg`

### Quick Setup:
1. **Clone the repository:**
   ```bash
   git clone https://github.com/zahidkambo783-creator/Working-TTS-Tool.git
   cd Working-TTS-Tool/zk-voice-studio
   ```
2. **One-Click Automated Setup:**
   - Double-click **`Install_On_New_Device.bat`**
   - It will automatically install all npm packages and Python AI dependencies!
3. **Start the Studio:**
   - Double-click **`Start_ZK_Voice_Studio.bat`**
   - Both Web Interface & Python AI Engine will launch concurrently at `http://localhost:3000`.

---

## 📱 Running on Mobile / Tablet (Same Wi-Fi)
You can use ZK Voice Studio from your phone or iPad without installing anything on your phone:
1. Keep ZK Voice Studio running on your PC.
2. Find your PC's local IP address (open CMD and type `ipconfig`, look for IPv4 e.g. `192.168.1.15`).
3. Open your mobile browser and enter: `http://192.168.1.15:3000`
4. You can now generate voices, record audio, and clone voices directly from your phone!
