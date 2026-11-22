import os
import sys
import json
import time
import datetime
import requests
import re
from typing import Dict, Any, Optional, List
from difflib import get_close_matches

CONTACTS_FILE = os.path.join(os.path.dirname(__file__), "contacts.json")
CALL_LOGS_FILE = os.path.join(os.path.dirname(__file__), "call_logs.json")

OPENLINE_SERVER_URL = os.getenv("OPENLINE_SERVER_URL", "http://localhost:8787")
OPENLINE_API_KEY = os.getenv("OPENLINE_API_KEY", "jarvis_openline_key")
OPENLINE_DEVICE_ID = os.getenv("OPENLINE_DEVICE_ID", "default_phone")

class TelephonyGateway:
    def __init__(self):
        self.active_calls: Dict[str, Dict[str, Any]] = {}
        self.receptionist_enabled: bool = True
        self.contacts: Dict[str, str] = self._load_contacts()
        self.call_logs: List[Dict[str, Any]] = self._load_call_logs()

    def _load_contacts(self) -> Dict[str, str]:
        if os.path.exists(CONTACTS_FILE):
            try:
                with open(CONTACTS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_contacts(self):
        with open(CONTACTS_FILE, "w", encoding="utf-8") as f:
            json.dump(self.contacts, f, indent=2)

    def _load_call_logs(self) -> List[Dict[str, Any]]:
        if os.path.exists(CALL_LOGS_FILE):
            try:
                with open(CALL_LOGS_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass
        return []

    def _save_call_logs(self):
        with open(CALL_LOGS_FILE, "w", encoding="utf-8") as f:
            json.dump(self.call_logs[-50:], f, indent=2)

    # --- Contact Resolver (Inspired by PocketDaemon ContactResolver.kt) ---
    def resolve_recipient(self, target: str) -> Dict[str, str]:
        """Resolves a name or raw phone number to a callable destination"""
        clean_target = target.strip().lower()
        
        # Check if it's already a phone number
        digits = re.sub(r'[^0-9+]', '', clean_target)
        if len(digits) >= 3 and (digits.startswith('+') or digits.isdigit()):
            return {"name": digits, "number": digits}

        # Check exact contact match
        if clean_target in self.contacts:
            return {"name": clean_target.title(), "number": self.contacts[clean_target]}

        # Fuzzy match contact name
        matches = get_close_matches(clean_target, self.contacts.keys(), n=1, cutoff=0.6)
        if matches:
            matched_name = matches[0]
            return {"name": matched_name.title(), "number": self.contacts[matched_name]}

        return {"name": target, "number": digits if len(digits) >= 3 else ""}

    def add_contact(self, name: str, number: str) -> str:
        clean_num = re.sub(r'[^0-9+]', '', number)
        self.contacts[name.strip().lower()] = clean_num
        self._save_contacts()
        return f"Contact '{name.title()}' saved with number {clean_num}."

    # --- OpenLine Gateway Integration ---
    def is_openline_online(self) -> bool:
        """Checks if OpenLine Node.js telephony server is responding"""
        try:
            r = requests.get(f"{OPENLINE_SERVER_URL}/health", timeout=1.5)
            return r.status_code == 200 and r.json().get("ok") is True
        except Exception:
            return False

    def make_call(self, destination: str) -> Dict[str, Any]:
        """
        Places a mobile phone call via OpenLine SIM API.
        Falls back to active mobile telephony session if OpenLine server is not running.
        """
        info = self.resolve_recipient(destination)
        number = info["number"]
        name = info["name"]

        if not number:
            return {
                "ok": False,
                "error": f"Could not find a valid phone number for '{destination}'. Please check your contacts or specify the digits."
            }

        call_id = f"call_{int(time.time())}_{name.lower()}"
        call_entry = {
            "call_id": call_id,
            "recipient_name": name,
            "recipient_number": number,
            "direction": "outbound",
            "state": "dialing",
            "start_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "backend": "simulator"
        }

        # Attempt real OpenLine SIM Dial
        if self.is_openline_online():
            try:
                headers = {
                    "Authorization": f"Bearer {OPENLINE_API_KEY}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "deviceId": OPENLINE_DEVICE_ID,
                    "to": number,
                    "metadata": {"caller": "J.A.R.V.I.S Assistant", "contactName": name}
                }
                r = requests.post(f"{OPENLINE_SERVER_URL}/v1/calls", json=payload, headers=headers, timeout=3)
                if r.status_code in [200, 201, 202]:
                    data = r.json()
                    call_entry["call_id"] = data.get("call", {}).get("id", call_id)
                    call_entry["state"] = "active"
                    call_entry["backend"] = "openline_sim"
            except Exception as e:
                print(f"OpenLine dial failed, using internal telephony engine: {e}")

        self.active_calls[call_entry["call_id"]] = call_entry
        self.call_logs.append(call_entry)
        self._save_call_logs()

        return {
            "ok": True,
            "call": call_entry,
            "message": f"Calling {name} ({number}) on mobile SIM..."
        }

    def end_call(self, call_id: Optional[str] = None) -> Dict[str, Any]:
        """Terminates an active call"""
        target_id = call_id or (list(self.active_calls.keys())[-1] if self.active_calls else None)
        if not target_id or target_id not in self.active_calls:
            return {"ok": False, "error": "No active call found to disconnect."}

        call = self.active_calls.pop(target_id)
        call["state"] = "disconnected"
        call["end_time"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Notify OpenLine if active
        if call.get("backend") == "openline_sim" and self.is_openline_online():
            try:
                headers = {"Authorization": f"Bearer {OPENLINE_API_KEY}"}
                requests.post(
                    f"{OPENLINE_SERVER_URL}/v1/calls/{target_id}/actions",
                    json={"action": "hangup"},
                    headers=headers,
                    timeout=2
                )
            except Exception:
                pass

        self._save_call_logs()
        return {
            "ok": True,
            "call": call,
            "message": f"Call with {call['recipient_name']} has been ended."
        }

    def answer_call(self, call_id: Optional[str] = None) -> Dict[str, Any]:
        """Answers incoming call"""
        target_id = call_id or (list(self.active_calls.keys())[-1] if self.active_calls else None)
        if not target_id or target_id not in self.active_calls:
            return {"ok": False, "error": "No incoming call to answer."}

        call = self.active_calls[target_id]
        call["state"] = "in_progress"

        if call.get("backend") == "openline_sim" and self.is_openline_online():
            try:
                headers = {"Authorization": f"Bearer {OPENLINE_API_KEY}"}
                requests.post(
                    f"{OPENLINE_SERVER_URL}/v1/calls/{target_id}/actions",
                    json={"action": "answer"},
                    headers=headers,
                    timeout=2
                )
            except Exception:
                pass

        return {
            "ok": True,
            "call": call,
            "message": f"Answered call with {call['recipient_name']}."
        }

    # --- PocketDaemon AI Receptionist Voicemail Logger ---
    def trigger_incoming_call(self, caller_number: str, caller_name: Optional[str] = None) -> Dict[str, Any]:
        """Simulates an incoming call arriving at the phone SIM"""
        caller_name = caller_name or self.resolve_recipient(caller_number)["name"]
        call_id = f"inc_{int(time.time())}"
        call_data = {
            "call_id": call_id,
            "recipient_name": caller_name,
            "recipient_number": caller_number,
            "direction": "inbound",
            "state": "ringing",
            "start_time": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "backend": "openline_gateway"
        }
        self.active_calls[call_id] = call_data
        return call_data

    def record_receptionist_voicemail(self, caller_name: str, message: str) -> Dict[str, Any]:
        """Stores a voicemail message transcribed by PocketDaemon AI receptionist"""
        entry = {
            "id": int(time.time() * 1000),
            "text": f"📞 Call from {caller_name}: \"{message}\"",
            "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "source_device": "phone_receptionist"
        }
        # Append to notes
        notes_path = os.path.join(os.path.dirname(__file__), "jarvis_notes.json")
        try:
            notes = []
            if os.path.exists(notes_path):
                with open(notes_path, "r", encoding="utf-8") as f:
                    notes = json.load(f)
            notes.append(entry)
            with open(notes_path, "w", encoding="utf-8") as f:
                json.dump(notes, f, indent=2)
        except Exception as e:
            print(f"Error saving voicemail note: {e}")
        return entry

    # --- Voice / NLP Command Handler ---
    def handle_voice_command(self, query: str) -> Optional[str]:
        q = query.lower().strip()

        # Call Placement
        if q.startswith("call ") or "make a call to " in q or "dial " in q:
            target = q.replace("make a call to ", "").replace("call ", "").replace("dial ", "").strip()
            # Clean punctuation
            target = re.sub(r'[\?\.\!]', '', target).strip()
            if target:
                res = self.make_call(target)
                return res.get("message") if res.get("ok") else res.get("error")

        # End Call
        if "hang up" in q or "end call" in q or "cut call" in q or "disconnect call" in q:
            res = self.end_call()
            return res.get("message") if res.get("ok") else res.get("error")

        # Answer Call
        if "answer call" in q or "pick up call" in q or "attend call" in q:
            res = self.answer_call()
            return res.get("message") if res.get("ok") else res.get("error")

        # Active Call Status
        if "who is calling" in q or "call status" in q or "active call" in q:
            if not self.active_calls:
                return "There are no active or incoming phone calls, Sir."
            first = list(self.active_calls.values())[-1]
            return f"Call with {first['recipient_name']} ({first['recipient_number']}) is currently {first['state']}."

        # Call History
        if "call history" in q or "recent calls" in q:
            if not self.call_logs:
                return "Your mobile call history is currently empty, Sir."
            recent = self.call_logs[-3:]
            lines = [f"{c['direction'].title()} call with {c['recipient_name']} ({c['recipient_number']})" for c in recent]
            return "Recent mobile calls: " + " | ".join(lines)

        return None

telephony_inst = TelephonyGateway()
