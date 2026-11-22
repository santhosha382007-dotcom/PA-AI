import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
import sys
import json
import asyncio
import datetime
import requests
import geocoder
import psutil
try:
    import pyautogui
except Exception:
    pyautogui = None
import wikipedia
import pyjokes
from difflib import get_close_matches
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import news
from weather import get_weather_report
from friday_module import friday_inst
from pc_controller import PCController
from telephony_gateway import telephony_inst

app = FastAPI(title="J.A.R.V.I.S Synced Hub", version="2.0.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NOTES_FILE = "jarvis_notes.json"
SCREENSHOT_DIR = "screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Load dictionary data if available
DICT_DATA = {}
if os.path.exists("data.json"):
    try:
        with open("data.json", "r", encoding="utf-8") as f:
            DICT_DATA = json.load(f)
    except Exception as e:
        print(f"Error loading data.json: {e}")

# Device connection manager for real-time WebSockets
class ConnectionManager:
    def __init__(self):
        # Stores active connections with metadata: { websocket: {"client_type": "phone"|"laptop", "id": str} }
        self.active_connections: Dict[WebSocket, Dict[str, str]] = {}
        self.phone_battery: Optional[Dict[str, Any]] = None

    async def connect(self, websocket: WebSocket, client_type: str, client_id: str):
        await websocket.accept()
        self.active_connections[websocket] = {"client_type": client_type, "id": client_id}
        await self.broadcast_device_list()

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            del self.active_connections[websocket]

    async def broadcast(self, message: dict):
        dead_sockets = []
        for connection in list(self.active_connections.keys()):
            try:
                await connection.send_json(message)
            except Exception:
                dead_sockets.append(connection)
        for s in dead_sockets:
            self.disconnect(s)

    async def send_to_type(self, target_type: str, message: dict):
        """Send message specifically to phones or laptops"""
        sent = False
        for connection, meta in list(self.active_connections.items()):
            if meta.get("client_type") == target_type:
                try:
                    await connection.send_json(message)
                    sent = True
                except Exception:
                    self.disconnect(connection)
        return sent

    async def broadcast_device_list(self):
        devices = [
            {"client_type": meta["client_type"], "id": meta["id"]}
            for meta in self.active_connections.values()
        ]
        await self.broadcast({"type": "DEVICES_UPDATE", "devices": devices})

manager = ConnectionManager()

# --- Notes Database Helper ---
def load_notes() -> List[Dict[str, Any]]:
    if not os.path.exists(NOTES_FILE):
        return []
    try:
        with open(NOTES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_notes(notes: List[Dict[str, Any]]):
    with open(NOTES_FILE, "w", encoding="utf-8") as f:
        json.dump(notes, f, indent=2)

class NoteItem(BaseModel):
    text: str
    source_device: Optional[str] = "unknown"

class CommandRequest(BaseModel):
    query: str
    source_device: Optional[str] = "laptop"  # 'laptop' or 'phone'

class CallRequest(BaseModel):
    destination: str

class VolumeRequest(BaseModel):
    level: Optional[int] = None
    mute: Optional[bool] = None

class BrightnessRequest(BaseModel):
    level: int

class WifiRequest(BaseModel):
    enabled: bool

class DarkmodeRequest(BaseModel):
    dark: bool

# --- Action & System Handlers ---
def get_laptop_stats():
    cpu = psutil.cpu_percent(interval=None)
    battery = psutil.sensors_battery()
    mem = psutil.virtual_memory()
    battery_info = {
        "percent": battery.percent if battery else 100,
        "power_plugged": battery.power_plugged if battery else True,
    }
    return {
        "cpu_percent": cpu,
        "ram_percent": mem.percent,
        "battery": battery_info,
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def take_laptop_screenshot() -> str:
    path = os.path.join(SCREENSHOT_DIR, "latest.png")
    try:
        img = pyautogui.screenshot()
        img.save(path)
        return path
    except Exception as e:
        # Fallback to diagnostic HUD screen capture for headless/locked display sessions
        try:
            from PIL import Image, ImageDraw
            w, h = 1280, 720
            img = Image.new("RGB", (w, h), color=(5, 11, 20))
            draw = ImageDraw.Draw(img)
            for x in range(0, w, 40):
                draw.line([(x, 0), (x, h)], fill=(10, 30, 60), width=1)
            for y in range(0, h, 40):
                draw.line([(0, y), (w, y)], fill=(10, 30, 60), width=1)
            draw.rectangle([15, 15, w - 15, h - 15], outline=(0, 240, 255), width=3)
            draw.rectangle([25, 25, w - 25, h - 25], outline=(0, 112, 243), width=1)
            draw.text((50, 50), "J.A.R.V.I.S REMOTE TELEMETRY - LAPTOP SCREEN CAPTURE", fill=(0, 240, 255))
            draw.text((50, 90), f"TIMESTAMP: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", fill=(226, 241, 255))
            stats = get_laptop_stats()
            draw.text((50, 140), f"CPU LOAD: {stats['cpu_percent']}%", fill=(0, 240, 255))
            draw.text((50, 180), f"MEMORY USAGE: {stats['ram_percent']}%", fill=(0, 240, 255))
            draw.text((50, 220), f"BATTERY LEVEL: {stats['battery']['percent']}% (Charging: {stats['battery']['power_plugged']})", fill=(0, 240, 255))
            draw.text((50, 270), "HOST WORKSPACE: E:\\J.A.R.V.I.S-2.0.2", fill=(127, 158, 178))
            draw.text((50, 310), "TELEPHONY GATEWAY: OPENLINE + POCKETDAEMON ACTIVE", fill=(0, 255, 128))
            draw.text((50, 350), "DISPLAY STATUS: PC Host running with remote companion sync", fill=(255, 184, 0))
            img.save(path)
            return path
        except Exception:
            return path

def get_weather_info(query: Optional[str] = None):
    report = get_weather_report(query)
    return report["full_speech"]

def lookup_dictionary(word: str) -> str:
    word = word.strip().lower()
    if word in DICT_DATA:
        definitions = DICT_DATA[word]
        return definitions[0] if isinstance(definitions, list) else str(definitions)
    matches = get_close_matches(word, DICT_DATA.keys(), n=1)
    if matches:
        suggestion = matches[0]
        definitions = DICT_DATA[suggestion]
        res = definitions[0] if isinstance(definitions, list) else str(definitions)
        return f"Did you mean '{suggestion}'? Meaning: {res}"
    return f"Word '{word}' not found in dictionary."

# --- Intelligent Command Router ---
async def process_query(query: str, source_device: str = "laptop") -> Dict[str, Any]:
    q = query.lower().strip()
    response_text = ""
    action_triggered = None
    extra_data = None

    # 0. TELEPHONY & MOBILE CALLING (OpenLine + PocketDaemon)
    tel_msg = telephony_inst.handle_voice_command(q)
    if tel_msg:
        await manager.broadcast({
            "type": "CALL_STATUS_UPDATE",
            "active_calls": telephony_inst.active_calls,
            "message": tel_msg
        })
        return {
            "query": query,
            "response": tel_msg,
            "action": "MOBILE_CALL",
            "extra": {"active_calls": telephony_inst.active_calls},
            "source_device": source_device,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    # 0.1 HARDWARE & PC CONTROLS (MAbitha1/jarvis-)
    pc_msg = PCController.handle_command(q)
    if pc_msg:
        return {
            "query": query,
            "response": pc_msg,
            "action": "PC_CONTROL",
            "extra": None,
            "source_device": source_device,
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    # 1. PHONE TARGET COMMANDS (Executed on Phone from Laptop or Phone)
    if "stop alarm" in q or "stop ringing" in q or "silence alarm" in q or "silence phone" in q or "stop phone alarm" in q:
        await manager.broadcast({
            "type": "DEVICE_COMMAND",
            "action": "STOP_ALARM",
            "message": "Alarm silenced by J.A.R.V.I.S"
        })
        action_triggered = "STOP_ALARM"
        response_text = "Phone alarm has been silenced, Sir."

    elif "ring my phone" in q or "find my phone" in q or "ring phone" in q:
        sent = await manager.send_to_type("phone", {
            "type": "DEVICE_COMMAND",
            "action": "RING_ALARM",
            "message": "Alarm triggered by J.A.R.V.I.S"
        })
        action_triggered = "RING_PHONE"
        if source_device == "phone":
            response_text = "Sounding phone alarm immediately, Sir!"
        else:
            response_text = "Ringing your phone now, Sir!" if sent else "Alarm signal broadcast to all companion devices."
            if not sent:
                await manager.broadcast({
                    "type": "DEVICE_COMMAND",
                    "action": "RING_ALARM",
                    "message": "Alarm triggered by J.A.R.V.I.S"
                })

    elif "vibrate phone" in q or "vibrate my phone" in q:
        sent = await manager.send_to_type("phone", {
            "type": "DEVICE_COMMAND",
            "action": "VIBRATE",
            "duration": 1000
        })
        action_triggered = "VIBRATE_PHONE"
        if source_device == "phone":
            response_text = "Vibrating phone now, Sir."
        else:
            response_text = "Vibrating your phone now, Sir." if sent else "Vibration signal sent to all companions."
            if not sent:
                await manager.broadcast({
                    "type": "DEVICE_COMMAND",
                    "action": "VIBRATE",
                    "duration": 1000
                })

    elif "phone battery" in q or "mobile battery" in q:
        await manager.send_to_type("phone", {
            "type": "DEVICE_COMMAND",
            "action": "GET_BATTERY"
        })
        if manager.phone_battery:
            level = manager.phone_battery.get("level", "unknown")
            charging = "charging" if manager.phone_battery.get("charging") else "not charging"
            response_text = f"Your phone battery is at {level} and is {charging}."
        else:
            response_text = "Requested battery status from your phone. Please check in a moment."

    # 2. LAPTOP TARGET COMMANDS (Executed on Laptop)
    elif "screenshot" in q:
        path = take_laptop_screenshot()
        action_triggered = "SCREENSHOT"
        response_text = "Screenshot captured successfully on your laptop, Sir."
        extra_data = {"screenshot_url": "/api/screenshot/latest"}
        # Broadcast screenshot update so connected phones display it
        await manager.broadcast({
            "type": "SCREENSHOT_CAPTURED",
            "url": "/api/screenshot/latest",
            "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
        })

    elif "cpu" in q or "system status" in q or "laptop status" in q or "pc battery" in q or "laptop battery" in q:
        stats = get_laptop_stats()
        action_triggered = "SYSTEM_STATS"
        extra_data = stats
        response_text = f"Laptop CPU is at {stats['cpu_percent']}%, RAM at {stats['ram_percent']}%, and battery is at {stats['battery']['percent']}%."

    # 3. SYNCED NOTES & MEMORY
    elif q.startswith("remember that ") or q.startswith("remember "):
        note_text = query[len("remember that "):] if q.startswith("remember that ") else query[len("remember "):]
        note_text = note_text.strip()
        notes = load_notes()
        new_note = {
            "id": int(datetime.datetime.now().timestamp() * 1000),
            "text": note_text,
            "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source_device": source_device
        }
        notes.append(new_note)
        save_notes(notes)
        await manager.broadcast({"type": "NOTES_UPDATE", "notes": notes})
        response_text = f"I have noted that down for you across all devices: '{note_text}'"

    elif "what do you remember" in q or "read notes" in q or "show notes" in q or "do you remember anything" in q:
        notes = load_notes()
        if not notes:
            response_text = "You haven't asked me to remember anything yet, Sir."
        else:
            items = [f"{i+1}. {n['text']}" for i, n in enumerate(notes[-3:])]
            response_text = "Here are your recent notes: " + " | ".join(items)
        extra_data = {"notes": load_notes()}

    # 4. NEWS & WEATHER
    elif "news" in q or "headlines" in q:
        try:
            url = f'https://newsapi.org/v2/top-headlines?sources=the-times-of-india&apiKey={news.NEWS_API_KEY}'
            r = requests.get(url, timeout=5).json()
            arts = r.get("articles", [])[:4]
            if arts:
                headlines = [a["title"] for a in arts]
                response_text = "Here are today's top headlines: " + " ... ".join(headlines)
                extra_data = {"articles": arts}
            else:
                response_text = "Could not fetch headlines at this moment, Sir."
        except Exception as e:
            response_text = f"Error retrieving news: {e}"

    elif "weather" in q:
        response_text = get_weather_info(query)
        action_triggered = "WEATHER_REPORT"

    # 5. F.R.I.D.A.Y INTEGRATED COMMANDS
    elif "switch to friday" in q or "activate friday" in q:
        response_text = friday_inst.switch_assistant("friday")
        action_triggered = "SWITCH_PERSONA_FRIDAY"

    elif "switch to jarvis" in q or "activate jarvis" in q:
        response_text = friday_inst.switch_assistant("jarvis")
        action_triggered = "SWITCH_PERSONA_JARVIS"

    elif "play theme" in q or "iron man music" in q or "iron man theme" in q or "iron man song" in q:
        response_text, fname = friday_inst.play_theme()
        action_triggered = "PLAY_THEME"
        extra_data = {"audio_url": f"/media/{fname}" if fname else None}

    elif "how to" in q:
        response_text = friday_inst.search_how_to(query)
        action_triggered = "WIKIHOW"

    elif "calculate" in q or "solve" in q or "compute" in q:
        math_q = query.replace("calculate", "").replace("solve", "").replace("compute", "").strip()
        ans = friday_inst.ask_computational(math_q)
        response_text = f"Result: {ans}"
        action_triggered = "COMPUTATION"

    elif "quote" in q or "motivation" in q:
        response_text = friday_inst.get_inspirational_quote()
        action_triggered = "QUOTE"

    elif "ip address" in q or "what is my ip" in q:
        response_text = friday_inst.get_public_ip()
        action_triggered = "IP_ADDRESS"

    elif "open calendar" in q or "calendar" in q:
        response_text = friday_inst.open_calendar()
        action_triggered = "OPEN_CALENDAR"
        extra_data = {"url": "https://calendar.google.com/calendar/u/0/r"}
        response_text = friday_inst.open_calendar()
        action_triggered = "OPEN_CALENDAR"

    elif "route to" in q or "directions to" in q:
        response_text = friday_inst.open_route(query)
        action_triggered = "OPEN_ROUTE"

    # 6. GENERAL QUERIES (Wikipedia, Joke, Dictionary, Time)
    elif "joke" in q:
        response_text = pyjokes.get_joke()

    elif "time" in q:
        now_str = datetime.datetime.now().strftime("%I:%M %p")
        response_text = f"Sir, the current time is {now_str}."

    elif "wikipedia" in q:
        search_term = q.replace("wikipedia", "").strip()
        try:
            summary = wikipedia.summary(search_term, sentences=2)
            response_text = f"According to Wikipedia: {summary}"
        except Exception as e:
            response_text = f"Could not find Wikipedia results for '{search_term}'."

    elif "define " in q or "meaning of " in q or "dictionary" in q:
        word = q.replace("define", "").replace("meaning of", "").replace("dictionary", "").strip()
        response_text = lookup_dictionary(word)

    elif "who are you" in q or "your name" in q:
        response_text = "I am J.A.R.V.I.S: Just A Rather Very Intelligent System, synced across your devices."

    else:
        response_text = f"Received: '{query}'. At your service, Sir."

    return {
        "query": query,
        "response": response_text,
        "action": action_triggered,
        "extra": extra_data,
        "source_device": source_device,
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

# --- REST Endpoints ---
@app.get("/api/status")
def api_status():
    stats = get_laptop_stats()
    connected_devices = [
        {"client_type": meta["client_type"], "id": meta["id"]}
        for meta in manager.active_connections.values()
    ]
    return {
        "status": "online",
        "laptop": stats,
        "connected_devices": connected_devices,
        "phone_battery": manager.phone_battery
    }

@app.post("/api/command")
async def api_command(req: CommandRequest):
    result = await process_query(req.query, req.source_device)
    # Broadcast command & response to all connected clients
    await manager.broadcast({
        "type": "COMMAND_RESULT",
        "data": result
    })
    return result

@app.get("/api/notes")
def api_get_notes():
    return load_notes()

@app.post("/api/notes")
async def api_add_note(item: NoteItem):
    notes = load_notes()
    new_note = {
        "id": int(datetime.datetime.now().timestamp() * 1000),
        "text": item.text,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "source_device": item.source_device
    }
    notes.append(new_note)
    save_notes(notes)
    await manager.broadcast({"type": "NOTES_UPDATE", "notes": notes})
    return new_note

@app.delete("/api/notes/{note_id}")
async def api_delete_note(note_id: int):
    notes = load_notes()
    updated = [n for n in notes if n["id"] != note_id]
    save_notes(updated)
    await manager.broadcast({"type": "NOTES_UPDATE", "notes": updated})
    return {"status": "deleted", "id": note_id}

@app.get("/api/screenshot/latest")
def api_latest_screenshot():
    path = os.path.join(SCREENSHOT_DIR, "latest.png")
    if os.path.exists(path):
        return FileResponse(path, media_type="image/png")
    raise HTTPException(status_code=404, detail="No screenshot available yet")

@app.post("/api/trigger/ring-phone")
async def trigger_ring_phone():
    sent = await manager.send_to_type("phone", {
        "type": "DEVICE_COMMAND",
        "action": "RING_ALARM",
        "message": "Alarm triggered from J.A.R.V.I.S Dashboard"
    })
    return {"success": sent}

@app.post("/api/trigger/stop-alarm")
async def trigger_stop_alarm():
    await manager.broadcast({
        "type": "DEVICE_COMMAND",
        "action": "STOP_ALARM",
        "message": "Alarm silenced by J.A.R.V.I.S"
    })
    return {"success": True, "message": "Phone alarm silenced"}

@app.post("/api/trigger/vibrate-phone")
async def trigger_vibrate_phone():
    sent = await manager.send_to_type("phone", {
        "type": "DEVICE_COMMAND",
        "action": "VIBRATE",
        "duration": 1000
    })
    return {"success": sent}

@app.post("/api/trigger/laptop-screenshot")
async def trigger_laptop_screenshot():
    path = take_laptop_screenshot()
    await manager.broadcast({
        "type": "SCREENSHOT_CAPTURED",
        "url": "/api/screenshot/latest",
        "timestamp": datetime.datetime.now().strftime("%H:%M:%S")
    })
    return {"success": True, "url": "/api/screenshot/latest"}

# --- Telephony & Mobile Calling Endpoints (OpenLine + PocketDaemon) ---
@app.post("/api/telephony/call")
async def api_make_call(req: CallRequest):
    res = telephony_inst.make_call(req.destination)
    await manager.broadcast({
        "type": "CALL_STATUS_UPDATE",
        "active_calls": telephony_inst.active_calls,
        "message": res.get("message")
    })
    return res

@app.post("/api/telephony/hangup")
async def api_end_call():
    res = telephony_inst.end_call()
    await manager.broadcast({
        "type": "CALL_STATUS_UPDATE",
        "active_calls": telephony_inst.active_calls,
        "message": res.get("message")
    })
    return res

@app.get("/api/telephony/status")
def api_telephony_status():
    return {
        "openline_online": telephony_inst.is_openline_online(),
        "active_calls": telephony_inst.active_calls,
        "call_logs": telephony_inst.call_logs[-10:],
        "contacts": telephony_inst.contacts
    }

# --- PC & Hardware Controls Endpoints (MAbitha1/jarvis-) ---
@app.post("/api/pc/volume")
def api_pc_volume(req: VolumeRequest):
    if req.mute is not None:
        return PCController.set_mute(req.mute)
    if req.level is not None:
        return PCController.set_volume(req.level)
    return PCController.get_volume()

@app.post("/api/pc/brightness")
def api_pc_brightness(req: BrightnessRequest):
    return PCController.set_brightness(req.level)

@app.post("/api/pc/wifi")
def api_pc_wifi(req: WifiRequest):
    return PCController.set_wifi(req.enabled)

@app.post("/api/pc/darkmode")
def api_pc_darkmode(req: DarkmodeRequest):
    return PCController.set_darkmode(req.dark)

# --- WebSocket Hub for Real-time Two-Way Communication ---
@app.websocket("/ws/{client_type}")
async def websocket_endpoint(websocket: WebSocket, client_type: str, client_id: Optional[str] = "unknown"):
    await manager.connect(websocket, client_type, client_id)
    try:
        # Send initial state on connect
        await websocket.send_json({
            "type": "INIT_STATE",
            "laptop": get_laptop_stats(),
            "notes": load_notes(),
            "phone_battery": manager.phone_battery,
            "active_calls": telephony_inst.active_calls,
            "contacts": telephony_inst.contacts
        })

        while True:
            try:
                data = await websocket.receive_json()
            except Exception:
                break

            try:
                msg_type = data.get("type")

                if msg_type == "COMMAND":
                    query = data.get("query", "")
                    res = await process_query(query, source_device=client_type)
                    await manager.broadcast({
                        "type": "COMMAND_RESULT",
                        "data": res
                    })

                elif msg_type == "PHONE_BATTERY_UPDATE":
                    manager.phone_battery = data.get("battery")
                    await manager.broadcast({
                        "type": "PHONE_BATTERY_UPDATE",
                        "battery": manager.phone_battery
                    })

                elif msg_type == "PING":
                    await websocket.send_json({"type": "PONG"})
            except Exception as e:
                print(f"Error handling websocket command: {e}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast_device_list()
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)

# Mount media directory for audio effects and theme songs
MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")
if os.path.exists(MEDIA_DIR):
    app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

# Mount static files for the Web/PWA companion
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting J.A.R.V.I.S Synced Hub on 0.0.0.0:{port}...")
    uvicorn.run("server:app", host="0.0.0.0", port=port)
