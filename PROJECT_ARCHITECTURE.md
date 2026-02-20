# EAEDS (Emotion-Aware Emergency Dispatch System) - Architecture & Logic Documentation

This document serves as the comprehensive A-Z guide of the EAEDS project. It outlines the entire system architecture, the relationships between the backend, frontend, and database layers, and the core operational logic that drives the emergency simulation, processing, and real-time visualization.

---

## 1. High-Level Architecture

EAEDS is a full-stack, real-time application composed of three primary layers:
1. **Frontend (Next.js 14):** A React-based interface for dispatchers and supervisors to monitor live and historical emergency calls.
2. **Backend (FastAPI - Python):** The central nervous system that handles HTTP requests, manages active simulations in memory, triggers AI processing, and broadcasts real-time state via WebSockets.
3. **Database (SQLite):** Persistent storage for archived calls, transcripts, locations, and emotion metadata.
4. **Simulation Client (`templates/chat_test.html`):** A standalone HTML interface simulating an end-user configuring a distress call and communicating with the AI dispatcher.

---

## 2. Directory Structure & Relationships

### `client/` (Next.js Frontend)
- **`src/app/live/page.tsx`**: The core operational dashboard. 
  - Subscribes to `ws://127.0.0.1:8000/ws/call`.
  - Hears `"incoming_call"`, `"ai_response"`, and `"db_response"` events.
  - Dynamically updates active sessions ("live_session_...") and preserves historical DB calls using state merging (`setData(prevData => ...)`).
- **`src/app/traffic/page.tsx`** & **`src/app/archive/page.tsx`**: Historical and secondary monitoring views. 
  - These do *not* rely on WebSockets.
  - They perform a standard HTTP `GET /calls` on component mount to retrieve active memory and DB-backed histories.
  - Rely on strictly structured TS types (`Call` from `src/data/types.ts`).
- **`src/components/live/`**: Reusable specialized sections.
  - **`EventPanel.tsx`**: The left sidebar tracking active and archived calls with counters, displaying Phone, City/State, and current Emotion.
  - **`Map.tsx`**: The live Leaflet map rendering incident markers based on coordinates or manual locations.
  - **`TranscriptPanel.tsx`**: Real-time rendering of the user/AI dialog array.
  - **`EmotionCard.tsx`**: Real-time visualization of the caller's dominant emotional state and confidence level.

### `server/` (FastAPI Backend)
- **`main.py`**: The main entrypoint.
  - Hosts REST APIs: `POST /api/test-chat` (Call injection), `GET /calls` (Hydration), `POST /api/reset-system` (Environment clearing).
  - Holds `app.active_simulations`: A Python dictionary serving as volatile memory for ongoing live calls, identified by Phone Number. Extracts elements like `transcript`, `emotion`, `location`, `city_state`.
  - Hosts the `ConnectionManager`: A custom WebSocket manager broadcasting JSON payloads to all connected clients.
- **`database/db_manager.py`**: The SQLite wrapper.
  - Methods like `save_call` write the final JSON-encoded transcript, duration, phone number, and caller details to the database once a dispatcher intentionally ends a call.
- **`ai_engine/`**: The intelligence tier.
  - `mock_service.py` functions as a fast, reliable stand-in for deep LLM logic during development, simulating AI reasoning based on keywords to trigger map updates (e.g. `TRIGGER_MAP`).

### `templates/` (Testing/Simulation layer)
- **`chat_test.html`**: A lightweight caller simulation page running on `http://localhost:8000/chat`.
  - Bypasses NextJS entirely.
  - Acts as a POST client sending payloads representing Phone, State, City, Emotion, and Text message to `/api/test-chat` on every "Enter" keypress.

---

## 3. Core Logic & Lifecycle (From A to Z)

To understand exactly how EAEDS functions, here is the lifecycle of a single distress call:

### Phase 1: Call Initiation (The Simulation)
1. A user configures the `chat_test.html` page (Phone: `555-1234`, State: `CA`, City: `Los Angeles`, Emotion: `Panicked`).
2. The user types: *"Help, there's a fire!"* and hits Send.
3. The JavaScript `sendMessage()` function builds a JSON payload (`TestChatRequest`) and POSTs it to FastAPI's `/api/test-chat` endpoint.

### Phase 2: Backend Ingestion & State Creation
1. FastAPI intercepts the `POST` payload.
2. It detects that `555-1234` does *not* exist in `app.active_simulations` yet.
3. It initializes a new dictionary entry `app.active_simulations['555-1234']` containing exactly the caller's Phone, their injected Emotion (`Panicked`), and constructs the `city_state` parameter (`Los Angeles, CA`).
4. **WebSocket Push 1 (`incoming_call`)**: FastAPI immediately tells the `ConnectionManager` to broadcast an `incoming_call` event to all open NextJS Dashboards, injecting the Phone, Location, and initial Emotion.

### Phase 3: Frontend Real-Time Syncing (Live Dashboard)
1. The `live/page.tsx` React component receives the WebSocket `incoming_call`.
2. The UI state hook executes `setData(...)`, stripping any previous UI state bounds for that number and mapping a pristine `newCallData` JSON tracking this user.
3. The Left Sidebar (`EventPanel.tsx`) instantly re-renders listing the new phone number, City, and Emotion.
4. Notifications (Toasts) pop up visually alerting dispatchers of the new situation.

### Phase 4: AI Processing Loop
1. Inside `main.py` (still during the initial POST request), the user's message is routed to the AI Engine.
2. The AI evaluates the text. If it detects location contexts, it might set a flag to update the Map coordinates. It generates a response (e.g., *"Stay calm, units are arriving"*).
3. The backend appends this interaction to the `transcript` array inside `active_simulations['555-1234']`.
4. **WebSocket Push 2 (`ai_response`)**: A second payload is blasted via WebSockets containing the final transcript chunk, updated map coordinates, and the sustained emotion.
5. The Live Dashboard receives `ai_response`, merges the new transcript elements, updates `EmotionCard`, and shifts the `Map.tsx` center if requested.

### Phase 5: Call Termination & Persistence
1. The user on `chat_test.html` clicks "End Call & Archive".
2. A unique payload `{"end_call": true}` is POSTed to the backend.
3. `main.py` retrieves the volatile data from `app.active_simulations['555-1234']`.
4. It calls `db.save_call(...)` which writes a permanent record into the SQLite file (`eaeds.db`).
5. `main.py` broadcasts `db_response` to the WebSockets.
6. The frontend receives `db_response`, strips the `live_session_` volatile data format, and replaces the React state identifier with the actual immutable Database ID. The UI card correctly tags as `RESOLVED` and turns green.
7. The `active_simulations` dictionary is deleted on the backend end, completing the lifecycle.

---

## 4. Key Logic Design Choices (Gotchas & Discoveries)

1. **State Independence:** The Traffic Page (`/traffic`) deliberately avoids WebSockets. Because it serves as a pure overview monitoring grid, doing a `GET /calls` fetch provides a much lighter overhead load compared to maintaining open sockets.
2. **Missing Properties & Truthiness Fallbacks:** In Javascript, `call.city_state || call.location_name` can accidentally be bypassed if `city_state` equates explicitly to `"Unknown"`. It must always be strictly checked (`&& call.city_state !== "Unknown"`) to ensure legacy DB locations don't render nullably.
3. **Array Deduplication Check:** Because "Live Calls" load natively from both `/calls` DB hydration *and* WebSockets, merging mechanisms must tightly track the `live_session_` prepended ID structure tightly. If a phone number is missing, strings mismatch and duplicate cards appear. Phone payloads are strictly mandatory now.
4. **Mocked Emulation Context:** A genuine live deployment would replace the `chat_test.html` with a physical SIP/Twilio telephony line transcription module, but the state mechanisms connecting `TestChatRequest` to `IncomingCall` remain identical.
