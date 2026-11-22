import os
import sys
import json
import subprocess
import re
from typing import Dict, Any, Optional

SCRIPTS_DIR = os.path.join(os.path.dirname(__file__), "pc_controls")

def run_ps_script(script_name: str, args: list) -> Dict[str, Any]:
    if sys.platform != "win32":
        return {"ok": False, "error": "PC hardware commands require a Windows companion device."}
    script_path = os.path.join(SCRIPTS_DIR, script_name)
    if not os.path.exists(script_path):
        return {"ok": False, "error": f"Script not found: {script_name}"}
    cmd = [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", script_path
    ] + [str(a) for a in args]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=8
        )
        out = proc.stdout.strip()
        if out:
            # Parse last JSON line from stdout
            lines = [l for l in out.splitlines() if l.strip().startswith("{")]
            if lines:
                return json.loads(lines[-1])
        return {"ok": True, "raw": out}
    except Exception as e:
        return {"ok": False, "error": str(e)}

class PCController:
    # --- Volume Control ---
    @staticmethod
    def get_volume() -> Dict[str, Any]:
        return run_ps_script("volume.ps1", ["-Action", "get"])

    @staticmethod
    def set_volume(level: int) -> Dict[str, Any]:
        level = max(0, min(100, int(level)))
        return run_ps_script("volume.ps1", ["-Action", "set", "-Level", level])

    @staticmethod
    def set_mute(mute: bool = True) -> Dict[str, Any]:
        action = "mute" if mute else "unmute"
        return run_ps_script("volume.ps1", ["-Action", action])

    # --- Screen Brightness ---
    @staticmethod
    def get_brightness() -> Dict[str, Any]:
        return run_ps_script("brightness.ps1", ["-Action", "get"])

    @staticmethod
    def set_brightness(level: int) -> Dict[str, Any]:
        level = max(0, min(100, int(level)))
        return run_ps_script("brightness.ps1", ["-Action", "set", "-Level", level])

    # --- Wi-Fi Radio ---
    @staticmethod
    def get_wifi_status() -> Dict[str, Any]:
        return run_ps_script("wifi-radio.ps1", [])

    @staticmethod
    def set_wifi(enabled: bool) -> Dict[str, Any]:
        state = "On" if enabled else "Off"
        return run_ps_script("wifi-radio.ps1", ["-State", state])

    # --- Windows Dark Mode ---
    @staticmethod
    def set_darkmode(dark: bool) -> Dict[str, Any]:
        mode = "dark" if dark else "light"
        return run_ps_script("darkmode.ps1", ["-Mode", mode])

    # --- Shell Folders ---
    @staticmethod
    def open_folder(folder_type: str) -> str:
        if sys.platform != "win32":
            return f"Opening your {folder_type.title()} folder on your PC companion, Sir."
        user_home = os.path.expanduser("~")
        mapping = {
            "downloads": os.path.join(user_home, "Downloads"),
            "documents": os.path.join(user_home, "Documents"),
            "pictures": os.path.join(user_home, "Pictures"),
            "desktop": os.path.join(user_home, "Desktop"),
            "music": os.path.join(user_home, "Music"),
            "videos": os.path.join(user_home, "Videos"),
        }
        folder_path = mapping.get(folder_type.lower())
        if folder_path and os.path.exists(folder_path):
            os.startfile(folder_path)
            return f"Opening your {folder_type.title()} folder, Sir."
        return f"Could not locate folder for {folder_type}."

    # --- NLP & Tanglish Interpreter ---
    @classmethod
    def handle_command(cls, query: str) -> Optional[str]:
        q = query.lower().strip()

        # Volume
        if "mute" in q and "unmute" not in q:
            res = cls.set_mute(True)
            return "Master audio is now muted." if res.get("ok") else f"Failed to mute: {res.get('error')}"

        if "unmute" in q:
            res = cls.set_mute(False)
            return "Master audio unmuted." if res.get("ok") else f"Failed to unmute: {res.get('error')}"

        if "volume" in q:
            # Check for specific number
            num_match = re.search(r'\b(\d{1,3})\b', q)
            if num_match:
                level = int(num_match.group(1))
                res = cls.set_volume(level)
                return f"Master volume set to {level}%." if res.get("ok") else f"Volume error: {res.get('error')}"
            if "up" in q or "increase" in q or "kootu" in q:
                curr = cls.get_volume().get("percent", 50)
                new_lvl = min(100, curr + 15)
                cls.set_volume(new_lvl)
                return f"Volume increased to {new_lvl}%."
            if "down" in q or "decrease" in q or "kora" in q:
                curr = cls.get_volume().get("percent", 50)
                new_lvl = max(0, curr - 15)
                cls.set_volume(new_lvl)
                return f"Volume decreased to {new_lvl}%."
            if "status" in q or "what is" in q:
                res = cls.get_volume()
                return f"Volume is currently at {res.get('percent', 'unknown')}%."

        # Brightness
        if "brightness" in q:
            num_match = re.search(r'\b(\d{1,3})\b', q)
            if num_match:
                level = int(num_match.group(1))
                res = cls.set_brightness(level)
                return f"Screen brightness set to {level}%." if res.get("ok") else f"Brightness error: {res.get('error')}"
            if "up" in q or "increase" in q or "adhigam" in q:
                curr = cls.get_brightness().get("percent", 50)
                new_lvl = min(100, curr + 20)
                cls.set_brightness(new_lvl)
                return f"Brightness increased to {new_lvl}%."
            if "down" in q or "decrease" in q or "kammi" in q:
                curr = cls.get_brightness().get("percent", 50)
                new_lvl = max(0, curr - 20)
                cls.set_brightness(new_lvl)
                return f"Brightness decreased to {new_lvl}%."

        # Wi-Fi
        if "wifi" in q or "wi-fi" in q:
            if "off" in q or "disable" in q or "koodathu" in q or "turn off" in q:
                res = cls.set_wifi(False)
                return "Wi-Fi radio switched off." if res.get("ok") else f"Wi-Fi error: {res.get('error')}"
            if "on" in q or "enable" in q or "turn on" in q:
                res = cls.set_wifi(True)
                return "Wi-Fi radio switched on." if res.get("ok") else f"Wi-Fi error: {res.get('error')}"
            if "status" in q or "state" in q:
                res = cls.get_wifi_status()
                return f"Wi-Fi radio is currently {res.get('state', 'unknown')}."

        # Dark Mode
        if "dark mode" in q or "dark theme" in q:
            if "off" in q or "disable" in q or "light" in q:
                res = cls.set_darkmode(False)
                return "Switched to Windows Light Mode." if res.get("ok") else f"Theme error: {res.get('error')}"
            else:
                res = cls.set_darkmode(True)
                return "Switched to Windows Dark Mode." if res.get("ok") else f"Theme error: {res.get('error')}"

        # Folders (Downloads, Documents, Desktop, etc.)
        for folder in ["downloads", "documents", "pictures", "desktop", "music", "videos"]:
            if folder in q:
                return cls.open_folder(folder)

        return None
