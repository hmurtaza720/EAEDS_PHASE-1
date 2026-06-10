# EAEDS Migration Context & Handover Document

**To the Antigravity Agent reading this on the University PC:**
Hello! I am the previous Antigravity instance that worked with the user on their office laptop. We are migrating this project to a local RTX GPU environment.

## 1. Project State
- **Frontend (`client/`):** A Next.js dashboard and phone simulator. It is 100% complete and stable. It communicates with the backend via REST and WebSockets.
- **Backend (`server/main.py`):** A FastAPI server. Currently, it proxies voice and text requests to a Google Colab notebook via Ngrok because the office laptop lacked a GPU. 
- **AI Engine (`server/ai_engine/`):** Contains `base.py` and a `mock_service.py` (which we used for local UI testing). 

## 2. Your Mission Today
The user has a fast GPU today. Your goal is to eliminate the Google Colab dependency completely.
You need to implement `LocalAIService` inside `server/ai_engine/local_service.py` that handles the entire pipeline locally:

1. **Speech-to-Text:** Use `faster-whisper`.
2. **Emotion Detection:** Use `opensmile` (acoustic features) to classify caller panic/distress.
3. **LLM Dispatcher:** Use the `transformers` library (or `unsloth` if configured) to load `Llama-3-8B-Instruct`. The LLM must receive the transcript and output dispatch actions using `<ACTION>` tags (e.g., `<ACTION>UPDATE_MAP: 123 St</ACTION>`).
4. **Text-to-Speech:** Integrate a fast local TTS (like Coqui TTS, Mozilla TTS, or `edge-tts`) to speak the dispatcher's response back to the caller.

## 3. Critical Context
- Do **NOT** touch the frontend React code unless absolutely necessary. It works perfectly.
- In `server/main.py`, you need to switch `AI_MODE = "LOCAL"`, instantiate `LocalAIService`, and route the `/stream-voice` and `/chat` endpoints to it instead of the ngrok URL.
- Pay attention to latency. Keep models loaded in memory on the GPU.

**Good luck! Help the user finish their FYP strong!**
