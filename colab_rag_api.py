# -*- qs_code_tag: colab-rag-v4-voice -*-
# COPY THIS INTO COLAB
# =====================================================================
#  EAEDS Voice Pipeline — Single Colab Notebook
#  All models: Faster-Whisper + OpenSMILE + BERT + Llama-3 8B
# =====================================================================

# ================================================
#  INSTALLS
# ================================================
!pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
!pip install --no-deps xformers "trl<0.9.0" peft accelerate bitsandbytes
!pip install -q fastapi uvicorn pyngrok nest-asyncio sentence-transformers
!pip install -q faster-whisper opensmile soundfile scikit-learn

import os
import io
import re
import json
import torch
import base64
import tempfile
import numpy as np
import soundfile as sf
from datetime import datetime
from typing import List, Optional, Dict

from unsloth import FastLanguageModel
from transformers import TextIteratorStreamer
from sentence_transformers import SentenceTransformer
from faster_whisper import WhisperModel
import opensmile
from threading import Thread
import asyncio

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from pyngrok import ngrok
import uvicorn
import nest_asyncio
import logging
import warnings

# Suppress noisy library warnings
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

# Silence transformers and other noisy loggers to prevent formatting crashes
logging.getLogger("transformers").setLevel(logging.ERROR)
logging.getLogger("unsloth").setLevel(logging.ERROR)

# ================================================
#  CONFIG
# ================================================
MODEL_ID = "unsloth/llama-3-8b-Instruct-bnb-4bit"
EMBED_MODEL_ID = "all-MiniLM-L6-v2"
WHISPER_MODEL_SIZE = "small"  # Options: tiny, base, small, medium
NGROK_AUTH_TOKEN = "379pHHHLQtvbt7YGRViXrOqhk0u_5AkwqBt88Pn5R64gQ6AoN"
MAX_SEQ_LENGTH = 2048
dtype = None
load_in_4bit = True

# Stateful memory per phone number
active_calls: Dict[str, List[str]] = {}

# Emotion labels derived from OpenSMILE features
EMOTION_LABELS = ["Calm", "Nervous", "Panicked", "Angry", "Distressed"]

# ================================================
#  STEP 1: LOAD ALL MODELS
# ================================================

# A. Embeddings (for RAG)
print(f"⏳ Loading Embeddings ({EMBED_MODEL_ID})...")
embed_model = SentenceTransformer(EMBED_MODEL_ID)
print("✅ Embeddings Loaded!")

# B. LLM (Unsloth Llama-3)
print(f"⏳ Loading Llama-3 (Unsloth)...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=MODEL_ID,
    max_seq_length=MAX_SEQ_LENGTH,
    dtype=dtype,
    load_in_4bit=load_in_4bit,
)
FastLanguageModel.for_inference(model)
print("✅ Llama-3 Loaded!")

# C. Faster-Whisper (STT)
print(f"⏳ Loading Faster-Whisper ({WHISPER_MODEL_SIZE})...")
whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cuda", compute_type="float16")
print("✅ Faster-Whisper Loaded!")

# D. OpenSMILE (Emotion Feature Extraction)
print(f"⏳ Loading OpenSMILE...")
smile = opensmile.Smile(
    feature_set=opensmile.FeatureSet.eGeMAPSv02,
    feature_level=opensmile.FeatureLevel.Functionals,
)
print("✅ OpenSMILE Loaded!")

print("\n🎉 ALL MODELS LOADED SUCCESSFULLY!")

# ================================================
#  STEP 2: NUMPY VECTOR STORE (RAG)
# ================================================
knowledge_chunks = []
knowledge_embeddings = None

def build_knowledge_base(text_data):
    global knowledge_chunks, knowledge_embeddings
    raw_chunks = [line.strip() for line in text_data.split("\n") if len(line) > 20]
    if not raw_chunks:
        return
    print(f"⏳ Embedding {len(raw_chunks)} chunks...")
    embeddings = embed_model.encode(raw_chunks, convert_to_numpy=True)
    knowledge_chunks = raw_chunks
    knowledge_embeddings = embeddings
    print(f"✅ Learned {len(knowledge_chunks)} facts!")

def retrieve_context(query, k=3):
    if knowledge_embeddings is None or len(knowledge_chunks) == 0:
        return []
    query_vec = embed_model.encode([query], convert_to_numpy=True)
    scores = np.dot(knowledge_embeddings, query_vec.T).flatten()
    top_k_indices = np.argsort(scores)[-k:][::-1]
    return [knowledge_chunks[idx] for idx in top_k_indices]

# Seed with minimal data
build_knowledge_base("Call 1: Fire reported at Main St. Dispatcher sent Fire Dept.\nCall 2: Medical at 5th Ave.")

# ================================================
#  STEP 3: HELPER FUNCTIONS
# ================================================

def transcribe_audio(audio_path: str) -> str:
    """Run Faster-Whisper on an audio file and return the transcript."""
    # initial_prompt helps bias the STT towards 911/Emergency context
    segments, info = whisper_model.transcribe(
        audio_path, 
        beam_size=1, 
        language="en",
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        initial_prompt="Emergency 911 call. Fire, police, medical. Address, emergency situation."
    )
    transcript = " ".join([seg.text.strip() for seg in segments])
    
    # Robust hallucination filtering
    h_patterns = [
        r"^thank you", r"^thanks for watching", r"^bye$", r"^you$", r"^i'm sorry",
        r"^subtitles by", r"^please subscribe", r"^skii-", r"^\.$"
    ]
    for pattern in h_patterns:
        if re.search(pattern, transcript.strip().lower()):
            print(f"  ⏭️ [Pipeline] Whisper hallucination detected ('{transcript}') — skipping.")
            return ""

    print(f"  🎤 [STT] Transcript: {transcript}")
    return transcript


def extract_emotion_from_audio(audio_path: str) -> str:
    """Run OpenSMILE on audio and classify emotion from acoustic features."""
    try:
        signal, sr = sf.read(audio_path)
        # OpenSMILE expects float32
        if signal.dtype != np.float32:
            signal = signal.astype(np.float32)
        
        features = smile.process_signal(signal, sr)
        
        # Heuristic emotion classification from eGeMAPS features
        # Key features: F0 (pitch), jitter, shimmer, loudness, HNR
        f0_mean = features["F0semitoneFrom27.5Hz_sma3nz_amean"].values[0]
        f0_std = features["F0semitoneFrom27.5Hz_sma3nz_stddevNorm"].values[0]
        loudness = features["loudness_sma3_amean"].values[0]
        jitter = features["jitterLocal_sma3nz_amean"].values[0]
        shimmer = features["shimmerLocaldB_sma3nz_amean"].values[0]
        hnr = features["HNRdBACF_sma3nz_amean"].values[0]
        
        # Classification heuristic (can be replaced with trained model later)
        if f0_mean > 30 and loudness > 0.5 and jitter > 0.02:
            emotion = "Panicked"
        elif f0_mean > 25 and f0_std > 0.3 and loudness > 0.3:
            emotion = "Angry"
        elif jitter > 0.015 or shimmer > 3.0:
            emotion = "Nervous"
        elif f0_std > 0.2 and loudness < 0.2:
            emotion = "Distressed"
        else:
            emotion = "Calm"
        
        confidence = min(0.95, 0.5 + abs(f0_std) + abs(jitter * 10))
        
        print(f"  😶 [Emotion] {emotion} (conf: {confidence:.2f}) | F0={f0_mean:.1f}, Loud={loudness:.2f}, Jitter={jitter:.4f}")
        return emotion
    except Exception as e:
        print(f"  ⚠️ [Emotion] Error: {e}")
        return "Neutral"


def classify_threat(text: str, emotion: str) -> dict:
    """
    Simple BERT-like threat classifier using keyword + emotion heuristics.
    Returns { is_threat: bool, classification: str, confidence: float }
    
    Can be upgraded to a fine-tuned BERT model later.
    """
    text_lower = text.strip().lower()
    
    # Silence / empty
    if len(text_lower) < 3 or text_lower in ["", "um", "uh", "hmm"]:
        return {"is_threat": False, "classification": "silence", "confidence": 0.95}
    
    # Prank indicators
    prank_keywords = ["yo what's up", "lol", "haha", "just kidding", "prank", 
                      "testing", "is this real", "dare", "bet you can't"]
    if any(kw in text_lower for kw in prank_keywords):
        return {"is_threat": False, "classification": "prank", "confidence": 0.85}
    
    # Emergency keywords (strong signal)
    emergency_keywords = ["help", "fire", "gun", "shoot", "stab", "blood", "dying", 
                          "cant breathe", "can't breathe", "heart attack", "overdose",
                          "break in", "breaking in", "robbery", "assault", "crash",
                          "accident", "unconscious", "not breathing", "choking",
                          "someone in my house", "intruder", "hurry", "please help"]
    has_emergency = any(kw in text_lower for kw in emergency_keywords)
    
    # Emotional escalation
    high_emotion = emotion in ["Panicked", "Angry", "Distressed"]
    
    if has_emergency:
        return {"is_threat": True, "classification": "emergency", "confidence": 0.95}
    elif high_emotion and len(text_lower) > 10:
        return {"is_threat": True, "classification": "potential_emergency", "confidence": 0.75}
    else:
        # Default: treat as legitimate call (safety-first approach for 911)
        return {"is_threat": True, "classification": "general_call", "confidence": 0.60}


def generate_llm_response(text: str, emotion: str, phone: str, city: str, state: str) -> dict:
    """Run Llama-3 with the 911 dispatcher prompt. Returns parsed response."""
    global active_calls
    
    # Manage state
    if phone not in active_calls:
        active_calls[phone] = []
    
    # RAG context
    context_list = retrieve_context(text)
    context_text = "\n".join([f"- {c}" for c in context_list])
    
    # System prompt
    system_prompt = f"""### ROLE
You are a 911 Dispatcher for {city}, {state}. The caller sounds {emotion}. 
CRITICAL: You must be extremely concise. Keep your responses under 15 words. Short, punchy sentences. Do not use filler words. Time is of the essence.

### RETRIEVED HISTORY
{context_text}

### CRITICAL OUTPUT FORMAT — YOU MUST FOLLOW THIS EXACTLY

When you identify a location from the caller, YOU MUST output this tag in your response:
<ACTION>UPDATE_MAP: [Full Address]<\s*/\s*ACTION\s*>

When you decide to dispatch emergency services, YOU MUST output this tag in your response:
<ACTION>DISPATCH: [Service1, Service2]<\s*/\s*ACTION\s*>

When the call is ending (caller is safe, help arrived, or says goodbye), YOU MUST output:
<ACTION>END_CALL<\s*/\s*ACTION\s*>

IMPORTANT: These tags are NOT optional. You MUST include them. Do NOT just say "I'm sending help" without the tag. The tag is what actually triggers the dispatch. Without the tag, NO help is sent.

### EXAMPLES OF CORRECT OUTPUT

Example 1 — Caller gives address:
Caller: "I'm at 45 Park Avenue, New York"
Your response: "I've got your location at 45 Park Avenue. Help is on the way. <ACTION>UPDATE_MAP: 45 Park Avenue, New York<\s*/\s*ACTION\s*>"

Example 2 — You decide to send help:
Caller: "There's a fire and someone is hurt"
Your response: "I'm dispatching Fire and EMS to your location right now. Stay on the line. <ACTION>DISPATCH: Fire, EMS<\s*/\s*ACTION\s*>"

Example 3 — Caller gives address AND you dispatch:
Caller: "There's a robbery at 100 Broadway, New York NY 10005"
Your response: "I'm sending police to 100 Broadway immediately. Stay safe. <ACTION>UPDATE_MAP: 100 Broadway, New York, NY 10005<\s*/\s*ACTION\s*> <ACTION>DISPATCH: Police<\s*/\s*ACTION\s*>"

Example 4 — Call ending:
Caller: "The police are here, thank you, bye"
Your response: "You're welcome. Stay safe. Goodbye. <ACTION>END_CALL<\s*/\s*ACTION\s*>"

### RULES
- If address is vague, ask for cross-streets in {city}.
- The MOMENT a caller gives you a specific address, you MUST output <ACTION>UPDATE_MAP: [address]<\s*/\s*ACTION\s*> in that same response. Do not wait.
- The MOMENT you have both the emergency type and the address, you MUST output <ACTION>DISPATCH: [services]<\s*/\s*ACTION\s*> in that same response. Do not wait for more information.
- If a caller reports a fire, dispatch Fire. If injuries, dispatch EMS. If crime, dispatch Police.
- NEVER say "I'm sending help" or "dispatching" without also including the <ACTION>DISPATCH: ...<\s*/\s*ACTION\s*> tag. Saying it without the tag means NO help is actually sent.
- NEVER say "I've got your location" without also including the <ACTION>UPDATE_MAP: ...<\s*/\s*ACTION\s*> tag. Saying it without the tag means the location is NOT recorded.
- STOP generating after your response. Do NOT generate the caller's next message.
- Do NOT use markdown bold (**) in your ACTION tags."""

    # Build history
    history_str = ""
    recent_history = active_calls[phone][-6:]
    for turn in recent_history:
        history_str += turn

    current_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>"
    prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>{history_str}{current_turn}"

    # Generate
    inputs = tokenizer([prompt], return_tensors="pt").to("cuda")
    outputs = model.generate(
        **inputs,
        max_new_tokens=128,
        use_cache=True,
        repetition_penalty=1.2,
        temperature=0.7,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id
    )
    generated_text = tokenizer.batch_decode(outputs[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]

    # Post-process
    final_response_raw = generated_text.split("Caller:")[0].strip()
    final_response_raw = final_response_raw.split("Dispatcher:")[0].strip()

    # Extract action tags
    location_extracted = ""
    dispatched_services = []

    map_match = re.search(r'<\s*ACTION\s*>\s*UPDATE_MAP:\s*(.*?)(?:<\s*/\s*ACTION\s*>|$)', final_response_raw, re.IGNORECASE | re.DOTALL)
    if not map_match:
        map_match = re.search(r'UPDATE_MAP:\s*(.+?)(?:\.|$)', final_response_raw, re.IGNORECASE)
    if map_match:
        location_extracted = map_match.group(1).strip().rstrip('.')

    dispatch_match = re.search(r'<\s*ACTION\s*>\s*DISPATCH:\s*(.*?)(?:<\s*/\s*ACTION\s*>|$)', final_response_raw, re.IGNORECASE | re.DOTALL)
    if not dispatch_match:
        dispatch_match = re.search(r'DISPATCH:\s*(.+?)(?:\.|$)', final_response_raw, re.IGNORECASE)
    if dispatch_match:
        services_str = dispatch_match.group(1).strip().rstrip('.')
        dispatched_services = [s.strip() for s in services_str.split(',')]

    # Clean response
    clean_response = re.sub(r'<\s*ACTION\s*>.*?(?:<\s*/\s*ACTION\s*>|$)', '', final_response_raw, flags=re.IGNORECASE | re.DOTALL).strip()
    clean_response = re.sub(r'UPDATE_MAP:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'DISPATCH:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'END_CALL\b', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'\s{2,}', ' ', clean_response).strip()

    end_call_flag = bool(re.search(r'(?:<\s*ACTION\s*>\s*)?END_CALL\s*(?:<\s*/\s*ACTION\s*>|$)', final_response_raw, re.IGNORECASE))

    # Save to memory
    full_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{clean_response}<|eot_id|>"
    active_calls[phone].append(full_turn)

    return {
        "response": clean_response,
        "context_used": context_list,
        "location_extracted": location_extracted,
        "dispatched_services": dispatched_services,
        "end_call": end_call_flag
    }


async def generate_llm_stream(text: str, emotion: str, phone: str, city: str, state: str):
    """Async generator yielding JSON lines for each sentence and final metadata."""
    global active_calls
    
    if phone not in active_calls:
        active_calls[phone] = []
        
    context_list = retrieve_context(text)
    context_text = "\n".join([f"- {c}" for c in context_list])
    
    system_prompt = f"""### ROLE
You are a highly professional 911 Dispatcher in {city}, {state}. The caller sounds {emotion}.
Your goal is to save lives by being calm, efficient, and direct.

### PROTOCOL
1.  **Professionalism**: Stay in character. Never be snarky or judgmental. 
2.  **Brevity**: Under 12 words. No "I see," "Okay," or filler.
3.  **Clarity**: If the caller is unintelligible, say: "I didn't catch that. Please repeat your emergency."
4.  **Prioritization**: Location is #1 priority. Dispatch is #2. Instructions are #3.

### RETRIEVED HISTORY
{context_text}

### OUTPUT TAGS
<ACTION>UPDATE_MAP: [Address]<\s*/\s*ACTION\s*>
<ACTION>DISPATCH: [Fire, Police, EMS]<\s*/\s*ACTION\s*>
<ACTION>END_CALL<\s*/\s*ACTION\s*>

### RULES
- STOP after your response.
- Use TAGS the moment you have the info."""

    history_str = "".join(active_calls[phone][-6:])
    current_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>"
    prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>{history_str}{current_turn}"

    inputs = tokenizer([prompt], return_tensors="pt").to("cuda")
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)
    generation_kwargs = dict(
        **inputs,
        streamer=streamer,
        max_new_tokens=128,
        use_cache=True,
        repetition_penalty=1.2,
        temperature=0.7,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id
    )
    thread = Thread(target=model.generate, kwargs=generation_kwargs)
    thread.start()

    full_generated_text = ""
    sentence_buffer = ""
    yielded_sentences = set() # Local per-turn deduplication
    
    # delimiters to split sentences
    punctuations = [". ", "! ", "? ", ".\n", "!\n", "?\n"]

    for new_text in streamer:
        full_generated_text += new_text
        sentence_buffer += new_text
        
        # Check if we have a sentence boundary
        for p in punctuations:
            if p in sentence_buffer:
                parts = sentence_buffer.split(p, 1)
                sentence = parts[0] + p.strip()
                sentence_buffer = parts[1] if len(parts) > 1 else ""
                
                # Check for action tags or duplicates or accidental metadata leak
                clean_sentence = re.sub(r'<\s*ACTION\s*>.*?(?:<\s*/\s*ACTION\s*>|$)', '', sentence, flags=re.IGNORECASE | re.DOTALL).strip()
                if clean_sentence and "Dispatcher:" not in clean_sentence and "Caller:" not in clean_sentence:
                    # Filter out loose metadata or punctuation-only fragments
                    is_pure_logic = any(kw in clean_sentence.upper() for kw in ["DISPATCH:", "UPDATE_MAP:", "END_CALL"])
                    has_content = len(re.sub(r'[^\w\s]', '', clean_sentence).strip()) > 0
                    
                    if not is_pure_logic and has_content:
                        if clean_sentence.lower() not in yielded_sentences:
                            yielded_sentences.add(clean_sentence.lower())
                            yield json.dumps({"event": "sentence", "text": clean_sentence}) + "\n"
        
        # small sleep to allow other async ops
        await asyncio.sleep(0.01)

    # Any remaining text in buffer
    if sentence_buffer.strip():
        clean_sentence = re.sub(r'<\s*ACTION\s*>.*?(?:<\s*/\s*ACTION\s*>|$)', '', sentence_buffer, flags=re.IGNORECASE | re.DOTALL).strip()
        if clean_sentence and "Dispatcher:" not in clean_sentence and "Caller:" not in clean_sentence:
            is_pure_logic = any(kw in clean_sentence.upper() for kw in ["DISPATCH:", "UPDATE_MAP:", "END_CALL"])
            has_content = len(re.sub(r'[^\w\s]', '', clean_sentence).strip()) > 0
            
            if not is_pure_logic and has_content:
                if clean_sentence.lower() not in yielded_sentences:
                    yielded_sentences.add(clean_sentence.lower())
                    yield json.dumps({"event": "sentence", "text": clean_sentence}) + "\n"

    # Remove hallucinated speakers if they appeared
    full_generated_text = full_generated_text.split("Caller:")[0].strip()
    full_generated_text = full_generated_text.split("Dispatcher:")[0].strip()

    # Post process tags
    location_extracted = ""
    dispatched_services = []

    map_match = re.search(r'<\s*ACTION\s*>\s*UPDATE_MAP:\s*(.*?)(?:<\s*/\s*ACTION\s*>|$)', full_generated_text, re.IGNORECASE | re.DOTALL)
    if not map_match:
        map_match = re.search(r'UPDATE_MAP:\s*(.+?)(?:\.|$)', full_generated_text, re.IGNORECASE)
    if map_match:
        location_extracted = map_match.group(1).strip().rstrip('.')

    dispatch_match = re.search(r'<\s*ACTION\s*>\s*DISPATCH:\s*(.*?)(?:<\s*/\s*ACTION\s*>|$)', full_generated_text, re.IGNORECASE | re.DOTALL)
    if not dispatch_match:
        dispatch_match = re.search(r'DISPATCH:\s*(.+?)(?:\.|$)', full_generated_text, re.IGNORECASE)
    if dispatch_match:
        services_str = dispatch_match.group(1).strip().rstrip('.')
        dispatched_services = [s.strip() for s in services_str.split(',')]

    clean_response = re.sub(r'<\s*ACTION\s*>.*?(?:<\s*/\s*ACTION\s*>|$)', '', full_generated_text, flags=re.IGNORECASE | re.DOTALL).strip()
    clean_response = re.sub(r'UPDATE_MAP:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'DISPATCH:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'END_CALL\b', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'\s{2,}', ' ', clean_response).strip()

    end_call_flag = bool(re.search(r'(?:<\s*ACTION\s*>\s*)?END_CALL\s*(?:<\s*/\s*ACTION\s*>|$)', full_generated_text, re.IGNORECASE))

    # Save to memory
    full_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{clean_response}<|eot_id|>"
    active_calls[phone].append(full_turn)

    # Yield final metadata
    final_data = {
        "event": "final_meta",
        "response": clean_response,
        "context_used": context_list,
        "location_extracted": location_extracted,
        "dispatched_services": dispatched_services,
        "end_call": end_call_flag
    }
    yield json.dumps(final_data) + "\n"


# ================================================
#  API SERVER
# ================================================
app = FastAPI(title="EAEDS Voice Pipeline")

# ---- Existing Text Chat Endpoint (UNCHANGED) ----

class ChatRequest(BaseModel):
    phone_number: str
    message: str
    city: str = "Unknown City"
    state: str = "Unknown State"
    emotion: str = "Neutral"
    reset: bool = False

@app.post("/upload_knowledge")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8")
    build_knowledge_base(text)
    return {"status": "success", "message": f"Learned {len(knowledge_chunks)} documents."}

@app.post("/chat")
async def generate_response(req: ChatRequest):
    """Text-only chat endpoint — UNCHANGED from v3. Used by the Chat Page."""
    global active_calls

    if req.reset or req.phone_number not in active_calls:
        active_calls[req.phone_number] = []

    result = generate_llm_response(
        text=req.message,
        emotion=req.emotion,
        phone=req.phone_number,
        city=req.city,
        state=req.state
    )

    return {
        "response": result["response"],
        "context_used": result["context_used"],
        "call_id": req.phone_number,
        "location_extracted": result["location_extracted"],
        "dispatched_services": result["dispatched_services"],
        "end_call": result["end_call"]
    }


# ---- NEW: Voice Pipeline Endpoint ----

@app.post("/stream-voice")
async def stream_voice(
    audio: UploadFile = File(...),
    phone_number: str = Form(...),
    city: str = Form("Unknown City"),
    state: str = Form("Unknown State"),
    reset: str = Form("false"),
):
    """
    Full voice streaming pipeline.
    Accepts audio, yields Transcript immediately, then streams sentences, then metadata.
    """
    start_time = datetime.now()
    should_reset = reset.lower() == "true"
    
    if should_reset and phone_number in active_calls:
        active_calls[phone_number] = []
    
    audio_bytes = await audio.read()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    
    print(f"\n{'='*60}")
    print(f"📞 [VOICE PIPELINE] Streaming audio for {phone_number}")
    print(f"{'='*60}")
    
    # Run STT and Emotion Extraction concurrently to reduce latency
    transcript_task = asyncio.to_thread(transcribe_audio, tmp_path)
    emotion_task = asyncio.to_thread(extract_emotion_from_audio, tmp_path)
    
    transcript, emotion = await asyncio.gather(transcript_task, emotion_task)
    
    hallucinations = ["thank you.", "thank you", "thanks for watching.", "thanks for watching", "bye.", "bye"]
    if transcript and transcript.strip().lower() in hallucinations:
        print(f"  ⏭️ [Pipeline] Whisper hallucination detected ('{transcript.strip()}') — skipping.")
        transcript = ""
    
    if not transcript or len(transcript.strip()) < 2:
        print("  ⏭️ [Pipeline] Empty transcript — skipping.")
        os.unlink(tmp_path)
        async def empty_generator():
            yield json.dumps({
                "event": "final_meta", "response": "", "context_used": [],
                "location_extracted": "", "dispatched_services": [], "end_call": False,
                "transcript": ""
            }) + "\n"
        return StreamingResponse(empty_generator(), media_type="text/event-stream")

    os.unlink(tmp_path)
    
    threat_result = classify_threat(transcript, emotion)
    print(f"  🛡️ [Threat] {threat_result['classification']} (threat={threat_result['is_threat']}, conf={threat_result['confidence']:.2f})")
    
    async def pipeline_generator():
        # 1. Yield Transcript & Emotion immediately
        yield json.dumps({
            "event": "start_turn",
            "transcript": transcript,
            "emotion": emotion,
            "threat": threat_result
        }) + "\n"
        
        # 2. Stream Sentences
        if threat_result["is_threat"]:
            async for chunk in generate_llm_stream(transcript, emotion, phone_number, city, state):
                yield chunk
        else:
            fake_res = "This line is for emergencies only. If you have a real emergency, please describe it."
            yield json.dumps({"event": "sentence", "text": fake_res}) + "\n"
            yield json.dumps({
                "event": "final_meta", "response": fake_res, "context_used": [],
                "location_extracted": "", "dispatched_services": [], "end_call": False
            }) + "\n"
            
        elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        print(f"  ⏱️ [Pipeline] Total streaming time: {elapsed_ms}ms")
            
    return StreamingResponse(pipeline_generator(), media_type="text/event-stream")


# ================================================
#  HEALTH CHECK
# ================================================
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": {
            "llm": "llama-3-8b-4bit",
            "stt": f"faster-whisper-{WHISPER_MODEL_SIZE}",
            "emotion": "opensmile-eGeMAPSv02",
            "rag": EMBED_MODEL_ID
        }
    }


# ================================================
#  RUN
# ================================================
ngrok.set_auth_token(NGROK_AUTH_TOKEN)
public_url = ngrok.connect(8000).public_url
print(f"\n🚀 EAEDS VOICE API IS LIVE AT: {public_url}")
print(f"   POST {public_url}/process-voice  (audio pipeline)")
print(f"   POST {public_url}/chat           (text fallback)")
print(f"   GET  {public_url}/health         (status check)")
nest_asyncio.apply()
config = uvicorn.Config(app, port=8000)
server = uvicorn.Server(config)
await server.serve()
