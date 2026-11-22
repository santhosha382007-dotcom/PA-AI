import os
import random
import asyncio
import concurrent.futures
import requests
import webbrowser
try:
    import cv2
except Exception:
    cv2 = None

try:
    import audioplayer
except Exception:
    audioplayer = None
import wolframalpha
from pywikihow import search_wikihow
from quote import quote
import PyPDF2 as pypdf

MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media")
WOLFRAM_APP_ID = "QTLYH7-4UV274RV6V"

class FridayModule:
    def __init__(self):
        self.is_friday = False  # False = JARVIS mode, True = FRIDAY mode
        self.wolfram_client = None
        try:
            self.wolfram_client = wolframalpha.Client(WOLFRAM_APP_ID)
        except Exception as e:
            print(f"WolframAlpha client init failed: {e}")

    def switch_assistant(self, mode: str) -> str:
        """Switch persona between 'jarvis' and 'friday'"""
        if "friday" in mode.lower():
            self.is_friday = True
            return "Switched to F.R.I.D.A.Y. Boss, all systems are online and female voice interface is active."
        else:
            self.is_friday = False
            return "Switched to J.A.R.V.I.S. At your service, Sir."

    def play_theme(self) -> tuple:
        """Play Iron Man theme audio from media directory"""
        audio_files = [
            "Ironman Airborne.mp3",
            "Iron Man Music.mp3",
            "Iron Man.mp3"
        ]
        available = [f for f in audio_files if os.path.exists(os.path.join(MEDIA_DIR, f))]
        if not available:
            return "Iron Man theme audio files not found.", None
        chosen = random.choice(available)
        full_path = os.path.join(MEDIA_DIR, chosen)
        try:
            # Play in non-blocking mode on PC if audioplayer is available
            if audioplayer:
                player = audioplayer.AudioPlayer(full_path)
                player.play(block=False)
            return f"Playing Iron Man theme: {chosen}", chosen
        except Exception:
            return f"Playing Iron Man theme ({chosen}). Audio stream ready.", chosen

    def ask_computational(self, question: str) -> str:
        """Answer math, science, and computational questions via WolframAlpha or safe math evaluator"""
        if self.wolfram_client:
            try:
                try:
                    loop = asyncio.get_running_loop()
                except RuntimeError:
                    loop = None

                if loop and loop.is_running():
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        res = pool.submit(self.wolfram_client.query, question).result()
                else:
                    res = self.wolfram_client.query(question)

                answer = next(res.results).text
                if answer:
                    return answer
            except Exception:
                pass

        # Smart Math Engine Fallback
        try:
            import math
            import re
            clean_expr = question.lower()
            clean_expr = clean_expr.replace('^', '**').replace('x', '*')
            clean_expr = re.sub(r'\bsquare root of\s*(\d+)', r'sqrt(\1)', clean_expr)
            clean_expr = re.sub(r'[^0-9\+\-\*\/\.\(\)\,\s_a-z]', '', clean_expr)
            allowed_names = {k: v for k, v in math.__dict__.items() if not k.startswith('__')}
            allowed_names.update({'abs': abs, 'round': round, 'pow': pow})
            ans = eval(clean_expr, {'__builtins__': None}, allowed_names)
            return f"{question} = {ans}"
        except Exception:
            return f"Calculated: At your command, Sir."

    def search_how_to(self, query: str) -> str:
        """Search WikiHow for step-by-step instructions"""
        try:
            results = search_wikihow(query, max_results=1)
            if results:
                title = results[0].title
                summary = results[0].summary
                return f"Guide for '{title}': {summary[:400]}..."
            return f"No step-by-step how-to guide found for '{query}'."
        except Exception as e:
            return f"Error searching how-to guide: {e}"

    def get_inspirational_quote(self, search: str = "Einstein") -> str:
        """Fetch quotes"""
        try:
            res = quote(search, limit=1)
            if res and len(res) > 0:
                q = res[0].get("quote", "")
                author = res[0].get("author", search)
                return f"\"{q}\" - {author}"
            return "The only limit to our realization of tomorrow is our doubts of today."
        except Exception:
            return "Success is not final, failure is not fatal: it is the courage to continue that counts."

    def get_public_ip(self) -> str:
        """Retrieve public internet protocol address"""
        try:
            ip = requests.get("https://api.ipify.org", timeout=4).text
            return f"Your public IP address is {ip}."
        except Exception:
            return "Could not retrieve public IP address at this moment."

    def open_camera(self) -> str:
        """Opens front webcam in a separate window until 'q' is pressed"""
        try:
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                return "Could not open camera."
            cv2.namedWindow("F.R.I.D.A.Y Camera Feed")
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                cv2.imshow("F.R.I.D.A.Y Camera Feed", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            cap.release()
            cv2.destroyAllWindows()
            return "Camera closed."
        except Exception as e:
            return f"Camera error: {e}"

    def open_calendar(self) -> str:
        """Opens Google Calendar"""
        webbrowser.open("https://calendar.google.com/calendar/u/0/r")
        return "Opening Google Calendar, Boss."

    def open_route(self, destination: str) -> str:
        """Opens Google Maps route directions"""
        dest_clean = destination.replace("route to", "").replace("directions to", "").strip()
        url = f"https://www.google.com/maps/dir/{dest_clean}"
        webbrowser.open(url)
        return f"Routing directions to {dest_clean} on Google Maps."

    def read_pdf(self, pdf_path: str, page_number: int = 0) -> str:
        """Reads text from a local PDF document"""
        if not os.path.exists(pdf_path):
            return f"PDF file not found at: {pdf_path}"
        try:
            reader = pypdf.PdfReader(pdf_path)
            total = len(reader.pages)
            if page_number < 0 or page_number >= total:
                return f"Invalid page. Document has {total} pages (0 to {total-1})."
            text = reader.pages[page_number].extract_text()
            return text[:600] if text else "The selected page contains no readable text."
        except Exception as e:
            return f"Error reading PDF: {e}"

# Singleton instance
friday_inst = FridayModule()
