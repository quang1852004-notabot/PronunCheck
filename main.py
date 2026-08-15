from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import uuid
import torch
from concurrent.futures import ThreadPoolExecutor
import uvicorn
import traceback

import config
import scoring
from faster_whisper import WhisperModel
from faster_whisper.audio import decode_audio
from transformers import Wav2Vec2Processor, Wav2Vec2ForCTC

if config.DEVICE == "cpu" and config.TORCH_CPU_THREADS:
    torch.set_num_threads(config.TORCH_CPU_THREADS)

os.makedirs(config.UPLOAD_DIR, exist_ok=True)
os.makedirs(config.REFERENCE_AUDIO_DIR, exist_ok=True)

executor = ThreadPoolExecutor(max_workers=config.PARALLEL_AI_WORKERS)

print(f"Loading AI models on {config.DEVICE.upper()}...")

try:
    whisper_model = WhisperModel(
        config.WHISPER_MODEL_NAME, device=config.DEVICE, compute_type=config.COMPUTE_TYPE,
        cpu_threads=config.WHISPER_CPU_THREADS, num_workers=config.WHISPER_NUM_WORKERS
    )
except Exception as e:
    print(f"Error loading Faster-Whisper: {e}")
    whisper_model = None

try:
    w2v_processor = Wav2Vec2Processor.from_pretrained(config.WAV2VEC_MODEL_NAME)
    w2v_model = Wav2Vec2ForCTC.from_pretrained(config.WAV2VEC_MODEL_NAME).to(config.DEVICE)
    w2v_model.eval()
    vocab_dict = w2v_processor.tokenizer.get_vocab()
except Exception as e:
    print(f"Error loading Wav2Vec2: {e}")
    w2v_processor, w2v_model, vocab_dict = None, None, None

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Warming up AI models...", flush=True)
    yield

app = FastAPI(title="Advanced Pronunciation Assessment", version="3.1", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.post("/api/v1/assess")
def assess_pronunciation(audio_file: UploadFile = File(...), expected_word: str = Form("Schule")):
    file_path = ""
    try:
        file_extension = audio_file.filename.split(".")[-1].lower() if audio_file.filename else "wav"
        temp_filename = f"{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(config.UPLOAD_DIR, temp_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(audio_file.file.read())

        audio_array = decode_audio(file_path, sampling_rate=16000)

        # Call scoring module via executor
        future_precise = executor.submit(scoring.analyze_precise_score, audio_array, expected_word, w2v_model, w2v_processor, vocab_dict)
        future_whisper = executor.submit(scoring.analyze_with_whisperx, audio_array, expected_word, whisper_model)
        future_dtw = executor.submit(scoring.calculate_dtw_score, audio_array, expected_word)

        precise_score, char_scores, worst_char = future_precise.result()
        whisper_score = future_whisper.result()
        dtw_score = future_dtw.result()

        assessment_result = scoring.calculate_dynamic_score(
            precise_score, whisper_score, dtw_score, expected_word, worst_char
        )

        return JSONResponse(content={
            "status": "success",
            "word": expected_word,
            "char_scores": char_scores,
            "assessment": assessment_result
        })

    except Exception as e:
        err_msg = traceback.format_exc()
        print("API Error:", err_msg, flush=True)
        return JSONResponse(status_code=500, content={"status": "error", "message": str(e)})
    finally:
        if file_path and os.path.exists(file_path):
            try: os.remove(file_path)
            except: pass

if __name__ == "__main__":
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, workers=config.WORKERS)
