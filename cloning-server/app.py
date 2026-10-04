import os
# Auto-accept Coqui TOS for XTTSv2
os.environ["COQUI_TOS_AGREED"] = "1"

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import torch
import shutil
import tempfile
import uuid

app = FastAPI(title="ZK Voice Cloning Server")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global TTS model reference
tts = None

@app.on_event("startup")
def load_model():
    global tts
    try:
        from TTS.api import TTS
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Loading XTTSv2 model on {device}... (This may take a minute on first run)")
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Failed to load TTS model: {e}")

@app.post("/api/clone")
async def clone_voice(
    text: str = Form(...),
    language: str = Form("en"),
    audio: UploadFile = File(...)
):
    global tts
    if tts is None:
        raise HTTPException(status_code=500, detail="TTS model is not loaded yet. Check server logs.")

    temp_dir = tempfile.mkdtemp()
    ref_audio_path = os.path.join(temp_dir, f"ref_{uuid.uuid4().hex}_{audio.filename}")
    
    with open(ref_audio_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)
        
    output_path = os.path.join(temp_dir, f"out_{uuid.uuid4().hex}.wav")
    
    try:
        print(f"Generating cloned audio for text: '{text[:50]}...'")
        tts.tts_to_file(
            text=text,
            speaker_wav=ref_audio_path,
            language=language,
            file_path=output_path
        )
        return FileResponse(output_path, media_type="audio/wav", filename="cloned_audio.wav")
    except Exception as e:
        print(f"Error during synthesis: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
