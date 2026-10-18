import edge_tts
import os
import sys
import tempfile
import anyascii

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Dynamically locate FFmpeg across all PCs and OS environments
import shutil

ffmpeg_path = shutil.which('ffmpeg')
ffmpeg_bin = os.path.dirname(ffmpeg_path) if ffmpeg_path else ''

if not ffmpeg_bin:
    user_appdata = os.environ.get('LOCALAPPDATA', '')
    candidates = [
        os.path.join(user_appdata, r'ffmpegio\ffmpeg-downloader\ffmpeg\bin'),
        r'C:\ffmpeg\bin',
        r'C:\Program Files\ffmpeg\bin',
        os.path.join(os.path.dirname(__file__), 'ffmpeg', 'bin'),
    ]
    for c in candidates:
        if os.path.exists(c):
            ffmpeg_bin = c
            os.environ['PATH'] = ffmpeg_bin + ';' + os.environ.get('PATH', '')
            break

from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask

from pydantic import BaseModel
from pydub import AudioSegment
import pydub.utils
AudioSegment.converter = os.path.join(ffmpeg_bin, 'ffmpeg.exe') if (ffmpeg_bin and os.path.exists(os.path.join(ffmpeg_bin, 'ffmpeg.exe'))) else 'ffmpeg'
pydub.utils.get_prober_name = lambda: os.path.join(ffmpeg_bin, 'ffprobe.exe') if (ffmpeg_bin and os.path.exists(os.path.join(ffmpeg_bin, 'ffprobe.exe'))) else 'ffprobe'
from pydub.silence import split_on_silence
import soundfile as sf

# Patch torchaudio.load to use soundfile fallback (prevents torchcodec missing dll crash on Windows)
try:
    import torchaudio
    import torch
    _orig_torchaudio_load = torchaudio.load
    def safe_torchaudio_load(filepath, *args, **kwargs):
        try:
            data, sr = sf.read(filepath)
            tensor = torch.from_numpy(data).float()
            if tensor.ndim == 1:
                tensor = tensor.unsqueeze(0)
            else:
                tensor = tensor.t()
            return tensor, sr
        except Exception:
            return _orig_torchaudio_load(filepath, *args, **kwargs)
    torchaudio.load = safe_torchaudio_load
except Exception as e:
    print("Warning patching torchaudio.load:", e)

# Import Kokoro
try:
    from kokoro import KPipeline
except ImportError:
    print("Kokoro is not installed. Please run: pip install kokoro soundfile")
    KPipeline = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Multi-language Kokoro Pipelines (American, British, Hindi, Spanish, French, Italian, Portuguese)
kokoro_pipelines = {}

def get_kokoro_pipeline(voice_id: str):
    if KPipeline is None:
        return None
    prefix = voice_id[:2].lower() if len(voice_id) >= 2 else 'af'
    lang_map = {
        'af': 'a', 'am': 'a',
        'bf': 'b', 'bm': 'b',
        'hf': 'h', 'hm': 'h',
        'ef': 'e', 'em': 'e',
        'ff': 'f',
        'if': 'i', 'im': 'i',
        'pf': 'p', 'pm': 'p',
        'jf': 'j', 'jm': 'j',
        'zf': 'z', 'zm': 'z',
    }
    lang = lang_map.get(prefix, 'a')
    if lang not in kokoro_pipelines:
        print(f"Initializing Kokoro pipeline for language '{lang}'...")
        kokoro_pipelines[lang] = KPipeline(lang_code=lang)
    return kokoro_pipelines[lang]

class KokoroRequest(BaseModel):
    text: str
    voice: str = 'af_heart'

@app.post("/api/tts/kokoro")
async def generate_kokoro(req: KokoroRequest):
    p = get_kokoro_pipeline(req.voice)
    if p is None:
        return JSONResponse(status_code=500, content={"error": "Kokoro is not installed on the server."})
    
    try:
        generator = p(req.text, voice=req.voice, speed=1, split_pattern=r'\n+')
        all_audio = []
        sample_rate = 24000
        for i, (gs, ps, audio) in enumerate(generator):
            all_audio.extend(audio.tolist())
            
        output_path = "kokoro_output.wav"
        sf.write(output_path, all_audio, sample_rate)
        return FileResponse(output_path, media_type="audio/wav")
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


class EdgeTtsRequest(BaseModel):
    text: str
    voice: str = 'en-US-AriaNeural'
    rate: str = '+0%'
    pitch: str = '+0Hz'
    volume: str = '+0%'

@app.post('/api/tts/edge')
async def generate_edge_tts(req: EdgeTtsRequest):
    try:
        temp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        temp_out.close()
        communicate = edge_tts.Communicate(
            text=req.text,
            voice=req.voice,
            rate=req.rate,
            pitch=req.pitch,
            volume=req.volume
        )
        await communicate.save(temp_out.name)
        def cleanup():
            try:
                os.unlink(temp_out.name)
            except Exception:
                pass
        return FileResponse(temp_out.name, media_type='audio/mpeg', background=BackgroundTask(cleanup))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={'error': str(e)})


@app.post('/api/remove-silence')
async def remove_silence(
    file: UploadFile = File(...),
    min_silence_len: int = Form(500),
    silence_thresh: int = Form(-40),
    keep_silence: int = Form(100)
):
    try:
        temp_in = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        content = await file.read()
        temp_in.write(content)
        temp_in.close()

        audio = AudioSegment.from_file(temp_in.name)
        chunks = split_on_silence(
            audio,
            min_silence_len=min_silence_len,
            silence_thresh=silence_thresh,
            keep_silence=keep_silence
        )
        
        if not chunks:
            os.unlink(temp_in.name)
            return JSONResponse(status_code=400, content={'error': 'Could not split audio (maybe it is all silence or no silence meets the threshold).'})
        
        processed_audio = chunks[0]
        for chunk in chunks[1:]:
            processed_audio += chunk
            
        temp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        processed_audio.export(temp_out.name, format='mp3', bitrate='320k')
        
        os.unlink(temp_in.name)
        return FileResponse(temp_out.name, media_type='audio/mpeg', background=BackgroundTask(os.unlink, temp_out.name))
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={'error': str(e)})


@app.post("/api/trim-f5-audio")
async def trim_f5_audio(
    ref_file: UploadFile = File(...),
    gen_file: UploadFile = File(...)
):
    try:
        temp_ref = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_ref.write(await ref_file.read())
        temp_ref.close()

        temp_gen = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_gen.write(await gen_file.read())
        temp_gen.close()

        ref_audio = AudioSegment.from_file(temp_ref.name)
        gen_audio = AudioSegment.from_file(temp_gen.name)
        
        # F5-TTS prepends reference audio. We trim it out.
        # Adding 100ms safety buffer to remove the crossfade/gap.
        trim_duration = len(ref_audio) + 100
        
        if len(gen_audio) > trim_duration:
            trimmed = gen_audio[trim_duration:]
        else:
            trimmed = gen_audio
            
        temp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        trimmed.export(temp_out.name, format="wav")
        temp_out.close()
        
        def cleanup():
            os.unlink(temp_ref.name)
            os.unlink(temp_gen.name)
            os.unlink(temp_out.name)
            
        return FileResponse(temp_out.name, media_type="audio/wav", background=BackgroundTask(cleanup))
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


# Speech-to-Text via Faster-Whisper
whisper_instance = None

def get_whisper_instance():
    global whisper_instance
    if whisper_instance is None:
        try:
            from faster_whisper import WhisperModel
            print("Loading faster-whisper base model...")
            whisper_instance = WhisperModel("base", device="cpu", compute_type="int8")
            print("faster-whisper model loaded successfully!")
        except Exception as e:
            print("Failed to load faster-whisper:", e)
    return whisper_instance

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    try:
        model = get_whisper_instance()
        if model is None:
            return JSONResponse(status_code=500, content={"error": "Whisper STT engine is not available."})

        suffix = os.path.splitext(file.filename or '')[1] or '.wav'
        temp_in = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        content = await file.read()
        temp_in.write(content)
        temp_in.close()

        print(f"Transcribing audio '{file.filename}' with faster-whisper...")
        segments, info = model.transcribe(temp_in.name, beam_size=5)
        text = " ".join([s.text.strip() for s in segments]).strip()
        print(f"Transcription complete ({info.language}, prob={info.language_probability:.2f}): '{text[:80]}...'")

        try:
            os.unlink(temp_in.name)
        except Exception:
            pass

        return JSONResponse(content={
            "text": text,
            "language": info.language,
            "language_probability": round(info.language_probability, 2)
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})


# Local F5-TTS
f5_instance = None

def get_f5_instance():
    global f5_instance
    if f5_instance is None:
        from f5_tts.api import F5TTS
        print("Loading local F5-TTS model checkpoint...")
        f5_instance = F5TTS()
        print("F5-TTS model loaded successfully!")
    return f5_instance

def sanitize_f5_text(text: str) -> str:
    if not text:
        return ""
    # Transliterate any non-Latin scripts (Hindi/Devanagari, Urdu/Arabic, Cyrillic, etc.)
    # to clean phonetic ASCII characters so F5-TTS vocabulary can synthesize it smoothly!
    has_non_latin = any(ord(c) > 0x024F and ord(c) < 0x2E80 for c in text)
    if has_non_latin:
        return anyascii.anyascii(text)
    return text

@app.post("/api/tts/f5-local")
async def generate_f5_local(
    ref_audio: UploadFile = File(...),
    ref_text: str = Form(""),
    gen_text: str = Form(""),
    speed: float = Form(1.0)
):
    try:
        model = get_f5_instance()
        
        temp_ref = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        content = await ref_audio.read()
        temp_ref.write(content)
        temp_ref.close()

        # Sanitize text for multi-language compatibility (Hindi, Spanish, Urdu, etc.)
        safe_ref_text = sanitize_f5_text(ref_text)
        safe_gen_text = sanitize_f5_text(gen_text)

        temp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_out.close()

        print(f"Generating local F5-TTS speech: '{safe_gen_text[:60]}'...")
        wav, sr, _ = model.infer(
            ref_file=temp_ref.name,
            ref_text=safe_ref_text,
            gen_text=safe_gen_text,
            file_wave=temp_out.name,
            speed=speed,
            remove_silence=True
        )

        def cleanup():
            try:
                os.unlink(temp_ref.name)
                os.unlink(temp_out.name)
            except Exception:
                pass

        return FileResponse(temp_out.name, media_type="audio/wav", background=BackgroundTask(cleanup))
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
