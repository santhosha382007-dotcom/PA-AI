# P.A - A.I Backend (Personal Assistant Cloud Backend)

High-performance, multi-device cloud synchronization hub and voice AI backend designed for seamless deployment on **Render**, powering both Mobile Apps (Flutter / Android / iOS) and Laptop/Web companions.

---

## ⚡ Core Features

* **Multi-Device Synchronization**: Real-time bi-directional WebSocket hub connecting Mobile Phones and PC/Laptop instances.
* **Location-First Weather Forecast**: Integrated with OpenWeatherMap & Open-Meteo to detect location details (City, State, Country, Coordinates) before reporting real-time weather metrics.
* **Mobile Calling System (OpenLine + PocketDaemon)**: Full telephony call state management, SIM dialer integration, contact resolver (`contacts.json`), and AI voicemail recorder (`call_logs.json`).
* **F.R.I.D.A.Y & J.A.R.V.I.S Dual Personas**: Switchable assistant personas with WolframAlpha computational intelligence, WikiHow guides, daily quotes, and audio theme streaming.
* **Interactive 3D Particle Neural Orb**: WebGL Three.js visualizer with real-time Web Audio API voice frequency reactivity.
* **Remote Device Controls**: Ring phone alarm, silence/stop phone alarm, trigger vibration, capture diagnostics, and synchronize notes.

---

## 🚀 One-Click Deployment on Render

This repository is pre-configured with `render.yaml` and `Procfile` for native deployment as a Render Web Service.

### Option 1: Automatic Blueprint (Recommended)
1. Go to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> **Blueprint**.
3. Connect this repository (`santhosha382007-dotcom/PA-AI`).
4. Click **Apply** — Render automatically builds and deploys using `render.yaml`.

### Option 2: Manual Web Service
* **Runtime**: Python 3
* **Build Command**: `pip install -r requirements.txt`
* **Start Command**: `uvicorn server:app --host 0.0.0.0 --port $PORT`

---

## 📱 Connecting Mobile App to Render Backend

In your mobile companion (Flutter / React Native / Android):

```dart
// Example Flutter configuration
final String baseUrl = "https://<your-render-app>.onrender.com";
final String wsUrl = "wss://<your-render-app>.onrender.com/ws/phone?client_id=device_1";
```

### Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | System health, connected device count, phone battery |
| `POST` | `/api/command` | Natural language voice/text query processing |
| `POST` | `/api/telephony/call` | Initiate cellular call session |
| `POST` | `/api/telephony/hangup`| Terminate active call |
| `POST` | `/api/trigger/ring-phone`| Ring mobile phone alarm |
| `POST` | `/api/trigger/stop-alarm`| Silence phone alarm remotely |
| `POST` | `/api/trigger/vibrate-phone`| Vibrate mobile phone |
| `GET` | `/api/notes` | Fetch synced memory notes across devices |
| `POST` | `/api/notes` | Save new synced memory note |
| `GET` | `/media/{file}` | Stream theme music & audio effects |
| `WS` | `/ws/{client_type}` | Bi-directional real-time telemetry and events |

---

## 🛠️ Local Development

```bash
# Clone the repository
git clone https://github.com/santhosha382007-dotcom/PA-AI.git
cd PA-AI

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .\.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📂 Repository Structure

```
├── server.py               # Main FastAPI & WebSockets Hub
├── weather.py              # Location-first weather engine
├── news.py                 # NewsAPI headlines retrieval
├── friday_module.py        # Friday persona & WolframAlpha integration
├── telephony_gateway.py    # OpenLine & PocketDaemon telephony gateway
├── pc_controller.py        # PC hardware bridge & Tanglish NLP parser
├── diction.py              # Offline dictionary definitions
├── contacts.json           # Telephony address book
├── call_logs.json          # Call logs & voicemail recordings
├── static/                 # PWA Companion & 3D Neural Orb Visualizer
│   ├── index.html
│   ├── style.css
│   ├── app.js
│   ├── orb.js
│   └── three.min.js
├── media/                  # Audio themes & assets
├── render.yaml             # Render infrastructure-as-code
├── Procfile                # Web process definition
└── requirements.txt        # Production dependencies
```
