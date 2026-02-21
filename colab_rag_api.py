# -*- qs_code_tag: colab-rag-v3 -*-
# COPY THIS INTO COLAB

# 1. Unsloth Install (Handles CUDA/Transformers Automatically)
# This is the "Gold Standard" for Colab Llama-3 usage.
!pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
!pip install --no-deps "xformers<0.0.27" "trl<0.9.0" peft accelerate bitsandbytes
!pip install -q fastapi uvicorn pyngrok nest-asyncio sentence-transformers

import os
import torch
import numpy as np
from unsloth import FastLanguageModel
from sentence_transformers import SentenceTransformer
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from pyngrok import ngrok
import uvicorn
import nest_asyncio
from typing import List, Optional, Dict
import re

# ================================
#  CONFIG
# ================================
MODEL_ID = "unsloth/llama-3-8b-Instruct-bnb-4bit"
EMBED_MODEL_ID = "all-MiniLM-L6-v2"
NGROK_AUTH_TOKEN = "39epSpZBJBXEKQjbC8wsWzDjbew_6DiZJ9SKDJghSCqizoAdk"
MAX_SEQ_LENGTH = 2048 
dtype = None 
load_in_4bit = True 

# STATEFUL MEMORY (For "Optimization")
# Stores last 10 turns per phone number.
active_calls: Dict[str, List[str]] = {}

# ================================
#  STEP 1: LOAD MODELS
# ================================

# A. Embeddings 
print(f"⏳ Loading Embeddings ({EMBED_MODEL_ID})...")
try:
    embed_model = SentenceTransformer(EMBED_MODEL_ID)
except Exception as e:
    print(f"⚠️ Error loading embeddings: {e}")
    raise e

# B. LLM (Unsloth)
print(f"⏳ Loading Llama-3 (Unsloth)...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = MODEL_ID,
    max_seq_length = MAX_SEQ_LENGTH,
    dtype = dtype,
    load_in_4bit = load_in_4bit,
)
FastLanguageModel.for_inference(model) 
print("✅ Models Loaded!")

# ================================
#  STEP 2: NUMPY VECTOR STORE
# ================================
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
    results = []
    for idx in top_k_indices:
        results.append(knowledge_chunks[idx])
    return results

# Dummy Start
build_knowledge_base("Call 1: Fire reported at Main St. Dispatcher sent Fire Dept.\nCall 2: Medical at 5th Ave.")

# ================================
#  API SERVER
# ================================
app = FastAPI()

class ChatRequest(BaseModel):
    phone_number: str  # Unique Session ID
    message: str
    city: str = "Unknown City"
    state: str = "Unknown State"
    emotion: str = "Neutral"  # e.g. "Panicked", "Calm"
    reset: bool = False       # Set True for new call

@app.post("/upload_knowledge")
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    text = content.decode("utf-8")
    build_knowledge_base(text)
    return {"status": "success", "message": f"Learned {len(knowledge_chunks)} documents."}

@app.post("/chat")
async def generate_response(req: ChatRequest):
    global active_calls
    
    # 1. Manage State (Memory)
    if req.reset or req.phone_number not in active_calls:
        active_calls[req.phone_number] = []
    
    # 2. Retrieve Context
    context_list = retrieve_context(req.message)
    context_text = "\n".join([f"- {c}" for c in context_list])
    
    # 3. Dynamic System Prompt
    system_prompt = f"""### ROLE
You are a 911 Dispatcher for {req.city}, {req.state}. The caller sounds {req.emotion}. Be calm, professional, and concise.

### RETRIEVED HISTORY
{context_text}

### CRITICAL OUTPUT FORMAT — YOU MUST FOLLOW THIS EXACTLY

When you identify a location from the caller, YOU MUST output this tag in your response:
<ACTION>UPDATE_MAP: [Full Address]</ACTION>

When you decide to dispatch emergency services, YOU MUST output this tag in your response:
<ACTION>DISPATCH: [Service1, Service2]</ACTION>

When the call is ending (caller is safe, help arrived, or says goodbye), YOU MUST output:
<ACTION>END_CALL</ACTION>

IMPORTANT: These tags are NOT optional. You MUST include them. Do NOT just say "I'm sending help" without the tag. The tag is what actually triggers the dispatch. Without the tag, NO help is sent.

### EXAMPLES OF CORRECT OUTPUT

Example 1 — Caller gives address:
Caller: "I'm at 45 Park Avenue, New York"
Your response: "I've got your location at 45 Park Avenue. Help is on the way. <ACTION>UPDATE_MAP: 45 Park Avenue, New York</ACTION>"

Example 2 — You decide to send help:
Caller: "There's a fire and someone is hurt"
Your response: "I'm dispatching Fire and EMS to your location right now. Stay on the line. <ACTION>DISPATCH: Fire, EMS</ACTION>"

Example 3 — Caller gives address AND you dispatch:
Caller: "There's a robbery at 100 Broadway, New York NY 10005"
Your response: "I'm sending police to 100 Broadway immediately. Stay safe. <ACTION>UPDATE_MAP: 100 Broadway, New York, NY 10005</ACTION> <ACTION>DISPATCH: Police</ACTION>"

Example 4 — Call ending:
Caller: "The police are here, thank you, bye"
Your response: "You're welcome. Stay safe. Goodbye. <ACTION>END_CALL</ACTION>"

### RULES
- If address is vague, ask for cross-streets in {req.city}.
- The MOMENT a caller gives you a specific address, you MUST output <ACTION>UPDATE_MAP: [address]</ACTION> in that same response. Do not wait.
- The MOMENT you have both the emergency type and the address, you MUST output <ACTION>DISPATCH: [services]</ACTION> in that same response. Do not wait for more information.
- If a caller reports a fire, dispatch Fire. If injuries, dispatch EMS. If crime, dispatch Police.
- NEVER say "I'm sending help" or "dispatching" without also including the <ACTION>DISPATCH: ...</ACTION> tag. Saying it without the tag means NO help is actually sent.
- NEVER say "I've got your location" without also including the <ACTION>UPDATE_MAP: ...</ACTION> tag. Saying it without the tag means the location is NOT recorded.
- STOP generating after your response. Do NOT generate the caller's next message.
- Do NOT use markdown bold (**) in your ACTION tags."""

    # 4. Construct History
    history_str = ""
    history = active_calls[req.phone_number]
    # Add user message to history temporarily for prompt construction
    current_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {req.message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>"
    
    # Limit history to last 6 turns (Optimization)
    recent_history = history[-6:] 
    for turn in recent_history:
        history_str += turn
    
    prompt = f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|>{history_str}{current_turn}"
    
    # 5. Generate
    inputs = tokenizer([prompt], return_tensors = "pt").to("cuda")
    outputs = model.generate(
        **inputs, 
        max_new_tokens = 128, 
        use_cache = True,
        pad_token_id = tokenizer.eos_token_id
    )
    generated_text = tokenizer.batch_decode(outputs[:, inputs.input_ids.shape[1]:], skip_special_tokens = True)[0]
    
    # 6. Post-Processing
    final_response_raw = generated_text.split("Caller:")[0].strip()
    final_response_raw = final_response_raw.split("Dispatcher:")[0].strip()
    
    # Extract tags
    location_extracted = ""
    dispatched_services = []
    
    # Parse UPDATE_MAP — Try wrapped <ACTION> tags first
    map_match = re.search(r'<ACTION>\s*UPDATE_MAP:\s*(.*?)(?:</ACTION>|$)', final_response_raw, re.IGNORECASE | re.DOTALL)
    if not map_match:
        # Fallback: LLM wrote bare "UPDATE_MAP: [address]" without <ACTION> wrapper
        map_match = re.search(r'UPDATE_MAP:\s*(.+?)(?:\.|$)', final_response_raw, re.IGNORECASE)
    if map_match:
        location_extracted = map_match.group(1).strip().rstrip('.')
        
    # Parse DISPATCH — Try wrapped first, then bare
    dispatch_match = re.search(r'<ACTION>\s*DISPATCH:\s*(.*?)(?:</ACTION>|$)', final_response_raw, re.IGNORECASE | re.DOTALL)
    if not dispatch_match:
        dispatch_match = re.search(r'DISPATCH:\s*(.+?)(?:\.|$)', final_response_raw, re.IGNORECASE)
    if dispatch_match:
        services_str = dispatch_match.group(1).strip().rstrip('.')
        dispatched_services = [s.strip() for s in services_str.split(',')]
        
    # Clean spoken response — Remove ALL action patterns (wrapped AND bare)
    clean_response = re.sub(r'<ACTION>.*?(?:</ACTION>|$)', '', final_response_raw, flags=re.IGNORECASE | re.DOTALL).strip()
    # Remove bare UPDATE_MAP / DISPATCH / END_CALL text that leaked
    clean_response = re.sub(r'UPDATE_MAP:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'DISPATCH:\s*[^\.\n]+\.?', '', clean_response, flags=re.IGNORECASE).strip()
    clean_response = re.sub(r'END_CALL\b', '', clean_response, flags=re.IGNORECASE).strip()
    # Clean up any leftover double spaces or leading/trailing punctuation artifacts
    clean_response = re.sub(r'\s{2,}', ' ', clean_response).strip()
    
    # Parse END_CALL
    end_call_flag = bool(re.search(r'(?:<ACTION>\s*)?END_CALL\s*(?:</ACTION>|$)', final_response_raw, re.IGNORECASE))
    
    # Save to Memory
    full_turn = f"<|start_header_id|>user<|end_header_id|>\n\nCaller: {req.message}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{clean_response}<|eot_id|>"
    active_calls[req.phone_number].append(full_turn)
    
    return {
        "response": clean_response, 
        "context_used": context_list,
        "call_id": req.phone_number,
        "location_extracted": location_extracted,
        "dispatched_services": dispatched_services,
        "end_call": end_call_flag
    }

# ================================
#  RUN
# ================================
ngrok.set_auth_token(NGROK_AUTH_TOKEN)
public_url = ngrok.connect(8000).public_url
print(f"\n🚀 API IS LIVE AT: {public_url}")
nest_asyncio.apply()
config = uvicorn.Config(app, port=8000)
server = uvicorn.Server(config)
await server.serve()
