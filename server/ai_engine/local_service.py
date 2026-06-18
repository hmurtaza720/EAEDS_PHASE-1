import os
import io
import re
import json
import torch

# Monkey patch for older PyTorch versions that do not have float8_e8m0fnu (added in PyTorch 2.6.0)
if not hasattr(torch, "float8_e8m0fnu"):
    setattr(torch, "float8_e8m0fnu", torch.float32)

import base64
import tempfile
import asyncio
import numpy as np
import soundfile as sf
from datetime import datetime
from typing import List, Optional, Dict, AsyncGenerator
from threading import Thread

# Import base class
from .base import AIService

# Load libraries dynamically if available, otherwise print warning
try:
    from faster_whisper import WhisperModel
except ImportError:
    WhisperModel = None

try:
    import opensmile
except ImportError:
    opensmile = None

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None

try:
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TextIteratorStreamer
except ImportError:
    AutoModelForCausalLM = None
    AutoTokenizer = None
    BitsAndBytesConfig = None
    TextIteratorStreamer = None

try:
    import edge_tts
except ImportError:
    edge_tts = None


class LocalAIService(AIService):
    """
    Local AI Service that loads Whisper, OpenSMILE, Llama-3-8B-Instruct (4-bit),
    and SentenceTransformers on the GPU for zero-latency local operations.
    """

    def __init__(self):
        print("\n[LocalAI] [INIT] Starting local GPU services...")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f" [LocalAI] [DEVICE] Compute Device: {self.device.upper()}")

        # A. Embeddings Model (for RAG)
        if SentenceTransformer:
            print(" [LocalAI] [LOADING] Loading SentenceTransformer (all-MiniLM-L6-v2)...")
            self.embed_model = SentenceTransformer("all-MiniLM-L6-v2")
            print(" [LocalAI] [OK] Embeddings Model Loaded!")
        else:
            self.embed_model = None
            print(" [LocalAI] [WARNING] SentenceTransformer not installed. RAG disabled.")

        # B. STT Model (faster-whisper)
        if WhisperModel:
            print(" [LocalAI] [LOADING] Loading Faster-Whisper (small)...")
            self.whisper_model = WhisperModel("small", device=self.device, compute_type="float16" if self.device == "cuda" else "float32")
            print(" [LocalAI] [OK] Faster-Whisper Loaded!")
        else:
            self.whisper_model = None
            print(" [LocalAI] [WARNING] faster-whisper not installed. STT disabled.")

        # C. Voice Emotion Extraction (OpenSMILE)
        if opensmile:
            print(" [LocalAI] [LOADING] Loading OpenSMILE functionals (eGeMAPSv02)...")
            self.smile = opensmile.Smile(
                feature_set=opensmile.FeatureSet.eGeMAPSv02,
                feature_level=opensmile.FeatureLevel.Functionals,
            )
            print(" [LocalAI] [OK] OpenSMILE Loaded!")
        else:
            self.smile = None
            print(" [LocalAI] [WARNING] opensmile not installed. Voice emotion analysis disabled.")

        # D. LLM (transformers Llama-3-8B-Instruct 4-bit)
        if AutoModelForCausalLM:
            print(" [LocalAI] [LOADING] Loading Llama-3-8B-Instruct (4-bit GPU)...")
            # 4-bit config to run Llama-3 on an 8GB VRAM card
            self.bnb_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            self.model_id = "unsloth/llama-3-8b-Instruct-bnb-4bit"
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_id)
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_id,
                quantization_config=self.bnb_config,
                device_map="cuda:0"
            )
            print(" [LocalAI] [OK] Llama-3-8B-Instruct Loaded!")
        else:
            self.model = None
            self.tokenizer = None
            print(" [LocalAI] [WARNING] transformers not installed. LLM disabled.")

        # E. Seed RAG Knowledge Base
        self.knowledge_chunks = []
        self.knowledge_embeddings = None
        self.load_local_knowledge()

        # F. Active calls history
        self.active_calls = {}
        print("[LocalAI] [SUCCESS] ALL MODELS INSTANTIATED ON GPU SUCCESSFULLY!\n")

    def load_local_knowledge(self):
        """Attempts to load formatted_knowledge.txt from the local file system."""
        base_dir = os.getcwd()
        possible_paths = [
            os.path.join(base_dir, "txtfiles", "formatted_knowledge.txt"),
            os.path.join(base_dir, "..", "txtfiles", "formatted_knowledge.txt"),
            os.path.join(os.path.dirname(__file__), "..", "..", "txtfiles", "formatted_knowledge.txt"),
        ]
        
        knowledge_loaded = False
        for path in possible_paths:
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        text_data = f.read()
                    self.build_knowledge_base(text_data)
                    knowledge_loaded = True
                    break
                except Exception as e:
                    print(f" [LocalAI] [WARNING] Error reading knowledge base from {path}: {e}")
                    
        if not knowledge_loaded:
            print(" [LocalAI] [WARNING] No local knowledge base loaded. Seeding with minimal data.")
            self.build_knowledge_base(
                "Call 1: Fire reported at Main St. Dispatcher sent Fire Dept.\n"
                "Call 2: Medical emergency at 5th Ave. Ambulance dispatched."
            )

    def build_knowledge_base(self, text_data: str):
        if not self.embed_model:
            return
        # Split by call boundary or lines longer than 20 chars
        raw_chunks = [line.strip() for line in text_data.split("\n") if len(line) > 20]
        if not raw_chunks:
            return
        embeddings = self.embed_model.encode(raw_chunks, convert_to_numpy=True)
        self.knowledge_chunks = raw_chunks
        self.knowledge_embeddings = embeddings
        print(f" [LocalAI] [OK] Knowledge base loaded. Learned {len(self.knowledge_chunks)} facts.")

    def retrieve_context(self, query: str, k: int = 3) -> List[str]:
        if self.knowledge_embeddings is None or len(self.knowledge_chunks) == 0 or not self.embed_model:
            return []
        query_vec = self.embed_model.encode([query], convert_to_numpy=True)
        scores = np.dot(self.knowledge_embeddings, query_vec.T).flatten()
        top_k_indices = np.argsort(scores)[-k:][::-1]
        return [self.knowledge_chunks[idx] for idx in top_k_indices]

    def classify_threat(self, text: str, emotion: str) -> dict:
        """Heuristic threat classifier that flags legitimate emergency calls."""
        text_lower = text.strip().lower()
        if len(text_lower) < 3 or text_lower in ["", "um", "uh", "hmm", "hello", "hi"]:
            return {"is_threat": False, "classification": "silence", "confidence": 0.95}
        
        prank_keywords = ["yo what's up", "lol", "haha", "just kidding", "prank", "testing", "bet you can't"]
        if any(kw in text_lower for kw in prank_keywords):
            return {"is_threat": False, "classification": "prank", "confidence": 0.85}
        
        emergency_keywords = [
            "help", "fire", "gun", "shoot", "stab", "blood", "dying", "cant breathe", "can't breathe",
            "heart attack", "overdose", "break in", "breaking in", "robbery", "assault", "crash",
            "accident", "unconscious", "not breathing", "choking", "intruder", "hurry"
        ]
        has_emergency = any(kw in text_lower for kw in emergency_keywords)
        high_emotion = emotion in ["Panicked", "Angry", "Distressed"]
        
        if has_emergency:
            return {"is_threat": True, "classification": "emergency", "confidence": 0.95}
        elif high_emotion and len(text_lower) > 10:
            return {"is_threat": True, "classification": "potential_emergency", "confidence": 0.75}
        else:
            return {"is_threat": True, "classification": "general_call", "confidence": 0.60}

    async def generate_tts_webm(self, text: str) -> str:
        """Synthesizes text to WebM (Opus) base64 string using edge-tts."""
        if not edge_tts:
            print(" [LocalAI] [WARNING] edge-tts not installed. Cannot generate speech.")
            return ""
            
        try:
            # edge-tts generates webm natively by setting voice and saving with webm extension
            communicate = edge_tts.Communicate(text, voice="en-US-BrianNeural")
            with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
                tmp_path = tmp.name
                
            await communicate.save(tmp_path)
            
            with open(tmp_path, "rb") as f:
                webm_bytes = f.read()
                
            os.unlink(tmp_path)
            return base64.b64encode(webm_bytes).decode("utf-8")
        except Exception as e:
            print(f" [LocalAI] [WARNING] edge-tts error: {e}. Trying offline fallback...")
            return self.generate_tts_wav_offline(text)

    def generate_tts_wav_offline(self, text: str) -> str:
        """Offline backup TTS generator using local pyttsx3."""
        try:
            import pyttsx3
            engine = pyttsx3.init()
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name
            engine.save_to_file(text, tmp_path)
            engine.runAndWait()
            
            with open(tmp_path, "rb") as f:
                wav_bytes = f.read()
            os.unlink(tmp_path)
            return base64.b64encode(wav_bytes).decode("utf-8")
        except Exception as e:
            print(f" [LocalAI] [WARNING] Offline TTS failed: {e}")
            return ""

    # --- Implement Abstract Base Class Methods ---

    async def process_text(self, text: str) -> str:
        """Simple text fallback implementation conforming to base class."""
        res = await self.process_text_full(text, "test_call", "Unknown", "Unknown", "Neutral")
        return res["response"]

    async def detect_emotion(self, text: str) -> str:
        """Text keyword based fallback emotion analysis."""
        text_lower = text.lower()
        if "fire" in text_lower or "help" in text_lower or "blood" in text_lower or "gun" in text_lower:
            return "Panicked"
        if "hurt" in text_lower or "crash" in text_lower:
            return "Distressed"
        if "calm" in text_lower:
            return "Calm"
        return "Neutral"

    async def detect_location(self, text: str) -> List[float] | None:
        """Extracts demo geocordinates from text."""
        text_lower = text.lower()
        if "fire" in text_lower:
             return [37.7908, -122.4008]
        if "gun" in text_lower or "shooter" in text_lower:
             return [37.7694, -122.4862]
        if "crash" in text_lower:
             return [37.8080, -122.4177]
        if "medical" in text_lower or "hurt" in text_lower:
             return [37.7749, -122.4194]
        return None

    # --- Full Contextual Local API Methods ---

    async def process_text_full(self, text: str, phone: str, city: str, state: str, emotion: str, reset: bool = False) -> dict:
        """Full contextual Llama-3-8B processing (used by the REST chat endpoint)."""
        if reset or phone not in self.active_calls:
            self.active_calls[phone] = []
            
        if text.strip().upper() == "RESET":
            self.active_calls[phone] = []
            return {"response": "System reset.", "location_extracted": "", "dispatched_services": [], "end_call": False}

        # Retrieval context
        context_list = self.retrieve_context(text)
        context_text = "\n".join([f"- {c}" for c in context_list])

        system_prompt = f"""### ROLE
You are a 911 Dispatcher for {city}, {state}. The caller sounds {emotion}.
CRITICAL: Be concise. Max 2 sentences of spoken text. No filler words.

### REFERENCE KNOWLEDGE (from training data, NOT from this caller)
{context_text}

### OUTPUT FORMAT — FOLLOW EXACTLY

Use these tags in your response when appropriate:

Location tag:   <ACTION>UPDATE_MAP: [Full Address]</ACTION>
Dispatch tag:   <ACTION>DISPATCH: [Service1, Service2]</ACTION>
End call tag:   <ACTION>END_CALL</ACTION>

IMPORTANT: Tags trigger real actions. Without them, no help is sent.

### EXAMPLES

Caller: "I'm at 45 Park Avenue, there's a fire"
You: "Fire units dispatched to 45 Park Avenue. Stay low. <ACTION>UPDATE_MAP: 45 Park Avenue, {city}, {state}</ACTION> <ACTION>DISPATCH: Fire, EMS</ACTION>"

Caller: "Someone broke into my house at 100 Broadway"
You: "Police en route to 100 Broadway. Stay hidden. <ACTION>UPDATE_MAP: 100 Broadway, {city}, {state}</ACTION> <ACTION>DISPATCH: Police</ACTION>"

Caller: "Thank you, police are here, bye"
You: "Glad to help. Stay safe. <ACTION>END_CALL</ACTION>"

### RULES
- Ask for address if not provided. Ask for cross-streets in {city} if vague.
- When caller gives an address, ALWAYS include <ACTION>UPDATE_MAP: [address]</ACTION>.
- When you know the emergency type, ALWAYS include <ACTION>DISPATCH: [services]</ACTION>.
- Fire → dispatch Fire. Injuries → EMS. Crime → Police.
- Do NOT generate the caller's next message. Stop after your response.
- Tags MUST use exactly: <ACTION>...</ACTION> — no other format."""

        history_str = "".join(self.active_calls[phone][-6:])
        current_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>"
        prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>{history_str}{current_turn}"

        inputs = self.tokenizer([prompt], return_tensors="pt").to("cuda")
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=128,
                use_cache=True,
                repetition_penalty=1.2,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
        generated_text = self.tokenizer.batch_decode(outputs[:, inputs.input_ids.shape[1]:], skip_special_tokens=True)[0]

        final_response_raw = generated_text.split("Caller:")[0].strip()
        final_response_raw = final_response_raw.split("Dispatcher:")[0].strip()

        # Extract meta tags
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

        clean_response = re.sub(r'<\s*ACTION\s*>.*?(?:<\s*/\s*ACTION\s*>|$)', '', final_response_raw, flags=re.IGNORECASE | re.DOTALL).strip()
        clean_response = re.sub(r'UPDATE_MAP:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
        clean_response = re.sub(r'DISPATCH:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
        clean_response = re.sub(r'END_CALL\b', '', clean_response, flags=re.IGNORECASE).strip()
        clean_response = re.sub(r'\s{2,}', ' ', clean_response).strip()

        end_call_flag = bool(re.search(r'(?:<\s*ACTION\s*>\s*)?END_CALL\s*(?:<\s*/\s*ACTION\s*>|$)', final_response_raw, re.IGNORECASE))

        # Save history
        full_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {text}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{clean_response}<|eot_id|>"
        self.active_calls[phone].append(full_turn)

        return {
            "response": clean_response,
            "context_used": context_list,
            "location_extracted": location_extracted,
            "dispatched_services": dispatched_services,
            "end_call": end_call_flag
        }

    async def process_audio(self, wav_path: str, phone: str, city: str, state: str) -> AsyncGenerator[str, None]:
        """
        Complete pipeline: Speech-to-Text, Voice Emotion Analysis, Threat check,
        Sentence Streaming LLM, and base64 audio synthesis. Yields JSON event lines.
        """
        start_time = datetime.now()
        
        # 1. Transcribe audio (STT)
        print(f"\n[LocalAI] [TRANSCRIPTION] Transcribing {wav_path} using faster-whisper...")
        try:
            segments, info = self.whisper_model.transcribe(
                wav_path,
                beam_size=1,
                language="en",
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500),
                initial_prompt=None
            )
            transcript = " ".join([seg.text.strip() for seg in segments])
        except Exception as e:
            print(f" [LocalAI] [WARNING] Whisper failed: {e}")
            transcript = ""

        # Filter out common hallucinations
        h_patterns = [
            r"^thank you", r"^thanks for watching", r"^bye$", r"^you$", r"^i'm sorry",
            r"^subtitles by", r"^please subscribe", r"^skii-", r"^\.$"
        ]
        for pattern in h_patterns:
            if re.search(pattern, transcript.strip().lower()):
                print(f"  [LocalAI] [SKIP] Whisper hallucination filtered ('{transcript}') — skipping.")
                transcript = ""

        # 2. Extract Acoustic Emotion (OpenSMILE)
        emotion = "Neutral"
        if self.smile and os.path.exists(wav_path):
            try:
                signal, sr = sf.read(wav_path)
                if signal.dtype != np.float32:
                    signal = signal.astype(np.float32)
                features = self.smile.process_signal(signal, sr)
                
                f0_mean = features["F0semitoneFrom27.5Hz_sma3nz_amean"].values[0]
                f0_std = features["F0semitoneFrom27.5Hz_sma3nz_stddevNorm"].values[0]
                loudness = features["loudness_sma3_amean"].values[0]
                jitter = features["jitterLocal_sma3nz_amean"].values[0]
                shimmer = features["shimmerLocaldB_sma3nz_amean"].values[0]

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
            except Exception as e:
                print(f" [LocalAI] [WARNING] OpenSMILE feature extraction failed: {e}")

        threat_result = self.classify_threat(transcript, emotion)
        
        # Yield start_turn (transcript and emotion) immediately
        yield json.dumps({
            "event": "start_turn",
            "transcript": transcript,
            "emotion": emotion,
            "threat": threat_result
        }) + "\n"

        if not transcript or len(transcript.strip()) < 2:
            print(" [LocalAI] [SKIP] Empty transcript - skipping LLM generation.")
            yield json.dumps({
                "event": "final_meta",
                "response": "",
                "context_used": [],
                "location_extracted": "",
                "dispatched_services": [],
                "end_call": False
            }) + "\n"
            return

        # 3. Stream LLM Response & Synthesize Audio
        if not threat_result["is_threat"]:
            fake_res = "This line is for emergencies only. If you have a real emergency, please describe it."
            audio_b64 = await self.generate_tts_webm(fake_res)
            yield json.dumps({
                "event": "sentence",
                "text": fake_res,
                "audio": audio_b64
            }) + "\n"
            yield json.dumps({
                "event": "final_meta",
                "response": fake_res,
                "context_used": [],
                "location_extracted": "",
                "dispatched_services": [],
                "end_call": False
            }) + "\n"
        else:
            # Context Retrieval
            context_list = self.retrieve_context(transcript)
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
<ACTION>UPDATE_MAP: [Address]<\\s*/\\s*ACTION\\s*>
<ACTION>DISPATCH: [Fire, Police, EMS]<\\s*/\\s*ACTION\\s*>
<ACTION>END_CALL<\\s*/\\s*ACTION\\s*>

### RULES
- STOP after your response.
- Use TAGS the moment you have the info."""

            if phone not in self.active_calls:
                self.active_calls[phone] = []

            history_str = "".join(self.active_calls[phone][-6:])
            current_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {transcript}<|eot_id|><|start_header_id|>assistant<|end_header_id|>"
            prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>{history_str}{current_turn}"

            inputs = self.tokenizer([prompt], return_tensors="pt").to("cuda")
            streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
            
            generation_kwargs = dict(
                **inputs,
                streamer=streamer,
                max_new_tokens=128,
                use_cache=True,
                repetition_penalty=1.2,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
            
            thread = Thread(target=self.model.generate, kwargs=generation_kwargs)
            thread.start()

            full_generated_text = ""
            sentence_buffer = ""
            yielded_sentences = set()
            punctuations = [". ", "! ", "? ", ".\n", "!\n", "?\n"]

            for new_text in streamer:
                full_generated_text += new_text
                sentence_buffer += new_text

                for p in punctuations:
                    if p in sentence_buffer:
                        parts = sentence_buffer.split(p, 1)
                        sentence = parts[0] + p.strip()
                        sentence_buffer = parts[1] if len(parts) > 1 else ""

                        clean_sentence = re.sub(r'<\s*ACTION\s*>.*?(?:<\s*/\s*ACTION\s*>|$)', '', sentence, flags=re.IGNORECASE | re.DOTALL).strip()
                        if clean_sentence and "Dispatcher:" not in clean_sentence and "Caller:" not in clean_sentence:
                            is_pure_logic = any(kw in clean_sentence.upper() for kw in ["DISPATCH:", "UPDATE_MAP:", "END_CALL"])
                            has_content = len(re.sub(r'[^\w\s]', '', clean_sentence).strip()) > 0

                            if not is_pure_logic and has_content:
                                if clean_sentence.lower() not in yielded_sentences:
                                    yielded_sentences.add(clean_sentence.lower())
                                    
                                    # TTS Synthesize sentence immediately
                                    audio_b64 = await self.generate_tts_webm(clean_sentence)
                                    yield json.dumps({
                                        "event": "sentence",
                                        "text": clean_sentence,
                                        "audio": audio_b64
                                    }) + "\n"
                await asyncio.sleep(0.01)

            # Rest of sentence buffer
            if sentence_buffer.strip():
                clean_sentence = re.sub(r'<\s*ACTION\s*>.*?(?:<\s*/\s*ACTION\s*>|$)', '', sentence_buffer, flags=re.IGNORECASE | re.DOTALL).strip()
                if clean_sentence and "Dispatcher:" not in clean_sentence and "Caller:" not in clean_sentence:
                    is_pure_logic = any(kw in clean_sentence.upper() for kw in ["DISPATCH:", "UPDATE_MAP:", "END_CALL"])
                    has_content = len(re.sub(r'[^\w\s]', '', clean_sentence).strip()) > 0
                    if not is_pure_logic and has_content:
                        if clean_sentence.lower() not in yielded_sentences:
                            yielded_sentences.add(clean_sentence.lower())
                            audio_b64 = await self.generate_tts_webm(clean_sentence)
                            yield json.dumps({
                                "event": "sentence",
                                "text": clean_sentence,
                                "audio": audio_b64
                            }) + "\n"

            # Parse tags from full LLM response
            full_generated_text = full_generated_text.split("Caller:")[0].strip()
            full_generated_text = full_generated_text.split("Dispatcher:")[0].strip()

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

            full_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {transcript}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{clean_response}<|eot_id|>"
            self.active_calls[phone].append(full_turn)

            yield json.dumps({
                "event": "final_meta",
                "response": clean_response,
                "context_used": context_list,
                "location_extracted": location_extracted,
                "dispatched_services": dispatched_services,
                "end_call": end_call_flag
            }) + "\n"

        elapsed_ms = int((datetime.now() - start_time).total_seconds() * 1000)
        print(f" [LocalAI] [TIME] Total streaming processing time: {elapsed_ms}ms")

    async def process_text(self, transcript: str, phone: str, city: str, state: str):
        """MOCKED implementation for load testing to bypass GPU limits."""
        import asyncio
        import json
        
        emotion = "Panicked"
        threat_result = {"is_threat": True, "classification": "emergency", "confidence": 0.99}
        
        yield json.dumps({
            "event": "start_turn",
            "transcript": transcript,
            "emotion": emotion,
            "threat": threat_result
        }) + "\n"
        
        mock_response = "Dispatching fire department to your location. Stay calm and evacuate if possible."
        
        yield json.dumps({
            "event": "sentence",
            "text": mock_response,
            "audio": ""  # Bypass TTS for load test
        }) + "\n"
        
        yield json.dumps({
            "event": "final_meta",
            "response": mock_response,
            "context_used": [],
            "location_extracted": "User Location",
            "dispatched_services": ["Fire Department"],
            "end_call": False
        }) + "\n"

