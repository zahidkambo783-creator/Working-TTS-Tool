import edge_tts
import os
import tempfile
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.background import BackgroundTask

from pydantic import BaseModel
from pydub import AudioSegment
import pydub.utils
AudioSegment.converter = r'C:\Users\Zahid\AppData\Local\ffmpegio\ffmpeg-downloader\ffmpeg\bin\ffmpeg.exe'
pydub.utils.get_prober_name = lambda: r'C:\Users\Zahid\AppData\Local\ffmpegio\ffmpeg-downloader\ffmpeg\bin\ffprobe.exe'
from pydub.silence import split_on_silence
import soundfile as sf

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

# Load Kokoro Pipeline globally (American English by default)
pipeline = None
if KPipeline is not None:
    print("Loading Kokoro TTS model (this will download ~82MB on first run)...")
    pipeline = KPipeline(lang_code='a') # 'a' for American English
    print("Kokoro loaded successfully!")

class KokoroRequest(BaseModel):
    text: str
    voice: str = 'af_heart' # default voice

@app.post("/api/tts/kokoro")
async def generate_kokoro(req: KokoroRequest):
    if pipeline is None:
        return JSONResponse(status_code=500, content={"error": "Kokoro is not installed on the server."})
    
    try:
        generator = pipeline(req.text, voice=req.voice, speed=1, split_pattern=r'\n+')
        
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

        temp_out = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
        temp_out.close()

        print(f"Generating local F5-TTS speech: {gen_text[:60]}...")
        wav, sr, _ = model.infer(
            ref_file=temp_ref.name,
            ref_text=ref_text,
            gen_text=gen_text,
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
