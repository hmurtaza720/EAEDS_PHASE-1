# �️ EAEDS Control
**Emotion-Aware Emergency Dispatch System** | *Local Edge Edition*

> *Status: OPERATIONAL* | *Architecture: On-Premise (Local GPU)*

## 🚨 Overview
**EAEDS Control** is an autonomous 911 dispatcher that uses AI to Listen, Feel, and Reason in real-time.

It solves the problem of human bandwidth during mass-casualty events by providing a fully local, privacy-first AI responder:
*   **The Body (Local):** Your laptop runs the sleek React UI (Phone + Map).
*   **The Brain (Local):** A dedicated onsite server runs the AI models (Whisper + Mistral).

## 🏗️ System Architecture
![EAEDS Architecture Diagram](./diagram.png)

## 🧠 AI Capabilities
1.  **Hearing (Faster-Whisper):** Instant, accurate speech-to-text.
2.  **Feeling (OpenSMILE):** Detects if a caller is **Calm** or **Panicking** (Acoustic Analysis).
3.  **Thinking (Mistral-7B):** Follows 911 protocols to ask the right questions (Police/Fire/Medical).

## 🛠️ Tech Stack
*   **Frontend:** Next.js 14, Tailwind CSS, Shadcn UI, Lucide React.
*   **Backend:** Python FastAPI, WebSockets, SQLite.
*   **AI Engine:** Local Python Service (No Cloud APIs).

## 🚀 Quick Start
### 1. Start the Local System
1.  **Backend:** `cd server` -> `python -m uvicorn main:app --reload`
2.  **Frontend:** `cd client` -> `npm run dev`

### 2. Connect the Brain
The system is configured to connect to the local AI service on `localhost`. Ensure your local Inference Server is running.

---
*Built as a Final Year Project (FYP)*
