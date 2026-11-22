// J.A.R.V.I.S Multi-Device Synced Companion Logic
const CLOUD_HOST = "https://pa-ai-346x.onrender.com";
const CLOUD_WS_HOST = "wss://pa-ai-346x.onrender.com";

function getApiBaseUrl() {
  if (window.location.protocol === "file:" || !window.location.host) {
    return CLOUD_HOST;
  }
  return window.location.origin;
}

function getWsUrl() {
  if (window.location.protocol === "file:" || !window.location.host) {
    return `${CLOUD_WS_HOST}/ws/${currentDeviceType}?client_id=${Math.random().toString(36).substring(7)}`;
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/${currentDeviceType}?client_id=${Math.random().toString(36).substring(7)}`;
}

let socket = null;
let currentDeviceType = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? "phone" : "laptop";
let alarmAudioContext = null;
let alarmInterval = null;
let currentPersona = "JARVIS";
let neuralOrb = null;

// DOM Elements
const connectionBadge = document.getElementById("connectionBadge");
const deviceSelector = document.getElementById("deviceSelector");
const hudStatus = document.getElementById("hudStatus");
const micBtn = document.getElementById("micBtn");
const orbContainer = document.getElementById("orbContainer");
const commandInput = document.getElementById("commandInput");
const sendBtn = document.getElementById("sendBtn");
const chatLog = document.getElementById("chatLog");
const laptopCpu = document.getElementById("laptopCpu");
const laptopBattery = document.getElementById("laptopBattery");
const phoneBattery = document.getElementById("phoneBattery");
const deviceCount = document.getElementById("deviceCount");
const notesList = document.getElementById("notesList");
const newNoteInput = document.getElementById("newNoteInput");
const addNoteBtn = document.getElementById("addNoteBtn");
const refreshNotesBtn = document.getElementById("refreshNotesBtn");
const alarmBanner = document.getElementById("alarmBanner");
const silenceAlarmBtn = document.getElementById("silenceAlarmBtn");
const screenshotModal = document.getElementById("screenshotModal");
const screenshotImg = document.getElementById("screenshotImg");
const closeModal = document.getElementById("closeModal");
const hudToast = document.getElementById("hudToast");
const companionAudioPlayer = document.getElementById("companionAudioPlayer");

// Calculation Modal Elements
const calcModal = document.getElementById("calcModal");
const closeCalcModal = document.getElementById("closeCalcModal");
const calcInput = document.getElementById("calcInput");
const btnExecuteCalc = document.getElementById("btnExecuteCalc");

// Remote Command Buttons
const btnRingPhone = document.getElementById("btnRingPhone");
const btnStopAlarm = document.getElementById("btnStopAlarm");
const btnVibratePhone = document.getElementById("btnVibratePhone");
const btnScreenshot = document.getElementById("btnScreenshot");
const btnNews = document.getElementById("btnNews");
const btnWeather = document.getElementById("btnWeather");
const btnJoke = document.getElementById("btnJoke");
const btnTheme = document.getElementById("btnTheme");
const btnQuote = document.getElementById("btnQuote");
const btnCalc = document.getElementById("btnCalc");
const btnIp = document.getElementById("btnIp");
const btnCalendar = document.getElementById("btnCalendar");

// Fast Folder Buttons
const btnFolderDownloads = document.getElementById("btnFolderDownloads");
const btnFolderDocs = document.getElementById("btnFolderDocs");

// Telephony Elements
const activeCallCard = document.getElementById("activeCallCard");
const activeCallName = document.getElementById("activeCallName");
const activeCallNumber = document.getElementById("activeCallNumber");
const activeCallStatus = document.getElementById("activeCallStatus");
const btnHangupCall = document.getElementById("btnHangupCall");
const btnAnswerCall = document.getElementById("btnAnswerCall");
const callDestinationInput = document.getElementById("callDestinationInput");
const btnDialCall = document.getElementById("btnDialCall");

// PC Hardware Controls
const volSlider = document.getElementById("volSlider");
const volValue = document.getElementById("volValue");
const btnToggleMute = document.getElementById("btnToggleMute");
const brightSlider = document.getElementById("brightSlider");
const brightValue = document.getElementById("brightValue");
const btnToggleWifi = document.getElementById("btnToggleWifi");
const btnToggleDark = document.getElementById("btnToggleDark");
const personaToggleBtn = document.getElementById("personaToggleBtn");

let isMuted = false;
let isDark = true;
let isWifiOn = true;

// Initialize 3D Neural Particle Orb
try {
  if (window.JarvisNeuralOrb) {
    neuralOrb = new JarvisNeuralOrb("orbCanvas", "orbContainer");
  }
} catch (e) {
  console.warn("Could not start 3D Neural Orb:", e);
}

// Device Mode Selector
deviceSelector.value = currentDeviceType;
deviceSelector.addEventListener("change", (e) => {
  currentDeviceType = e.target.value;
  showToast(`Switched mode to ${currentDeviceType.toUpperCase()}`);
  reconnectWebSocket();
});

// Toast System
let toastTimer = null;
function showToast(message, type = "info") {
  if (!hudToast) return;
  hudToast.textContent = message;
  hudToast.classList.remove("hidden");
  hudToast.style.opacity = "1";
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    hudToast.style.opacity = "0";
    setTimeout(() => hudToast.classList.add("hidden"), 300);
  }, 2500);
}
window.showToast = showToast;

// Unlock Web Audio Context on first gesture (Critical for Mobile Chrome / Safari)
function unlockAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx && !alarmAudioContext) {
    alarmAudioContext = new AudioCtx();
  }
  if (alarmAudioContext && alarmAudioContext.state === "suspended") {
    alarmAudioContext.resume();
  }
}
window.addEventListener("touchstart", unlockAudioContext, { once: true });
window.addEventListener("click", unlockAudioContext, { once: true });

// Setup Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isListening = false;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-IN";

  recognition.onstart = () => {
    isListening = true;
    hudStatus.textContent = "LISTENING... (SPEAK TO J.A.R.V.I.S)";
    micBtn.classList.add("listening");
    if (neuralOrb) neuralOrb.setState("listening");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    hudStatus.textContent = `RECOGNIZED: "${transcript}"`;
    sendCommand(transcript);
  };

  recognition.onerror = (event) => {
    console.warn("Speech recognition error:", event.error);
    hudStatus.textContent = `MIC: ${event.error.toUpperCase()}`;
    isListening = false;
    micBtn.classList.remove("listening");
    if (neuralOrb) neuralOrb.setState("idle");
  };

  recognition.onend = () => {
    isListening = false;
    hudStatus.textContent = "TAP NEURAL ORB TO ACTIVATE";
    micBtn.classList.remove("listening");
    if (neuralOrb) neuralOrb.setState("idle");
  };
}

window.onNativeSpeechResult = function(transcript) {
  if (!transcript) return;
  if (hudStatus) hudStatus.textContent = `RECOGNIZED: "${transcript}"`;
  if (micBtn) micBtn.classList.remove("listening");
  if (neuralOrb) neuralOrb.setState("idle");
  sendCommand(transcript);
};

window.onNativeSpeechError = function(code) {
  if (hudStatus) hudStatus.textContent = `MIC STATUS: STANDBY (${code})`;
  if (micBtn) micBtn.classList.remove("listening");
  if (neuralOrb) neuralOrb.setState("idle");
};

function toggleVoiceInput() {
  unlockAudioContext();
  if (window.AndroidBridge && window.AndroidBridge.startVoiceRecognition) {
    hudStatus.textContent = "LISTENING... (SPEAK TO J.A.R.V.I.S)";
    micBtn.classList.add("listening");
    if (neuralOrb) neuralOrb.setState("listening");
    window.AndroidBridge.startVoiceRecognition();
    return;
  }
  if (!recognition) {
    showToast("Speech recognition not supported in this browser. Please type command.");
    return;
  }
  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.warn("Recognition start error:", e);
    }
  }
}

if (micBtn) micBtn.addEventListener("click", toggleVoiceInput);

// Text-to-Speech (TTS)
function speakText(text) {
  if (!text) return;

  // Use Native Android TTS if available inside app
  if (window.AndroidBridge && window.AndroidBridge.speak) {
    if (neuralOrb) neuralOrb.setState("speaking");
    window.AndroidBridge.speak(text);
    setTimeout(() => {
      if (neuralOrb) neuralOrb.setState("idle");
    }, Math.max(1500, Math.min(8000, text.length * 60)));
    return;
  }

  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = window.speechSynthesis.getVoices();

  if (currentPersona === "FRIDAY") {
    const femaleVoice = voices.find(v => /female|zira|samantha|victoria|karen/i.test(v.name));
    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.pitch = 1.3;
    utterance.rate = 1.0;
  } else {
    const maleVoice = voices.find(v => /male|david|george|alex/i.test(v.name));
    if (maleVoice) utterance.voice = maleVoice;
    utterance.pitch = 0.95;
    utterance.rate = 1.05;
  }

  utterance.onstart = () => {
    if (neuralOrb) neuralOrb.setState("speaking");
  };
  utterance.onend = () => {
    if (neuralOrb) neuralOrb.setState("idle");
  };

  window.speechSynthesis.speak(utterance);
}

// WebSocket Connection
function connectWebSocket() {
  const wsUrl = getWsUrl();

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    connectionBadge.textContent = "CONNECTED (" + currentDeviceType.toUpperCase() + ")";
    connectionBadge.className = "badge badge-connected";
    hudStatus.textContent = "ALL SYSTEMS ONLINE & READY";
    reportPhoneBattery();
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleIncomingMessage(data);
    } catch (e) {
      console.error("Malformed message:", e);
    }
  };

  socket.onclose = () => {
    connectionBadge.textContent = "DISCONNECTED";
    connectionBadge.className = "badge badge-disconnected";
    hudStatus.textContent = "RECONNECTING TO J.A.R.V.I.S...";
    setTimeout(connectWebSocket, 3000);
  };

  socket.onerror = (err) => {
    console.error("WebSocket Error:", err);
  };
}

function reconnectWebSocket() {
  if (socket) {
    socket.close();
  }
  connectWebSocket();
}

// Handle Incoming Server Events
function handleIncomingMessage(msg) {
  switch (msg.type) {
    case "INIT_STATE":
      updateLaptopTelemetry(msg.laptop);
      renderNotes(msg.notes || []);
      if (msg.phone_battery) {
        phoneBattery.textContent = msg.phone_battery.level;
      }
      break;

    case "DEVICES_UPDATE":
      deviceCount.textContent = (msg.devices || []).length;
      break;

    case "DEVICE_COMMAND":
      if (msg.action === "RING_ALARM") {
        triggerPhoneAlarm();
        if (btnStopAlarm) btnStopAlarm.classList.add("btn-pulsing");
      } else if (msg.action === "STOP_ALARM") {
        stopAlarm();
      } else if (msg.action === "VIBRATE") {
        triggerPhoneVibration(msg.duration || 1000);
      } else if (msg.action === "GET_BATTERY") {
        reportPhoneBattery();
      }
      break;

    case "COMMAND_RESULT":
      displayChat(msg.data.query, msg.data.response, msg.data.source_device);
      speakText(msg.data.response);
      showToast(`✓ ${msg.data.response.substring(0, 45)}...`);

      // If Iron Man music audio is attached, stream it in browser
      if (msg.data.extra && msg.data.extra.audio_url && companionAudioPlayer) {
        companionAudioPlayer.src = msg.data.extra.audio_url;
        companionAudioPlayer.play().catch(e => console.log("Audio play gesture required:", e));
      }
      // If Calendar URL attached and on mobile, open link
      if (msg.data.extra && msg.data.extra.url && currentDeviceType === "phone") {
        window.open(msg.data.extra.url, "_blank");
      }
      break;

    case "CALL_STATUS_UPDATE":
      updateCallUI(msg.active_calls);
      break;

    case "NOTES_UPDATE":
      renderNotes(msg.notes || []);
      break;

    case "SCREENSHOT_CAPTURED":
      showScreenshot(msg.url);
      break;

    case "PHONE_BATTERY_UPDATE":
      if (msg.battery) {
        phoneBattery.textContent = msg.battery.level;
      }
      break;
  }
}

// Telemetry Updates
function updateLaptopTelemetry(stats) {
  if (!stats) return;
  laptopCpu.textContent = `${stats.cpu_percent}%`;
  laptopBattery.textContent = `${stats.battery.percent}% ${stats.battery.power_plugged ? "⚡" : ""}`;
}

// Battery Reporting (for Phone mode)
function reportPhoneBattery() {
  if (window.AndroidBridge && window.AndroidBridge.getBatteryLevel) {
    try {
      const level = window.AndroidBridge.getBatteryLevel() + "%";
      phoneBattery.textContent = level;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "PHONE_BATTERY_UPDATE",
          battery: { level: level, charging: true }
        }));
      }
      return;
    } catch (ignored) {}
  }

  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      const level = Math.round(battery.level * 100) + "%";
      phoneBattery.textContent = level;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: "PHONE_BATTERY_UPDATE",
          battery: {
            level: level,
            charging: battery.charging
          }
        }));
      }
    });
  }
}

// Sound & Alarm Synthesizer (Works on any Mobile Browser via Web Audio API or Native Java)
function triggerPhoneAlarm() {
  alarmBanner.classList.remove("hidden");
  if (btnStopAlarm) btnStopAlarm.classList.add("btn-pulsing");
  triggerPhoneVibration([500, 200, 500, 200, 500]);
  unlockAudioContext();

  if (window.AndroidBridge && window.AndroidBridge.ringAlarm) {
    try {
      window.AndroidBridge.ringAlarm();
      return;
    } catch (ignored) {}
  }

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!alarmAudioContext) {
      alarmAudioContext = new AudioContext();
    }
    
    let freqToggle = false;
    if (alarmInterval) clearInterval(alarmInterval);
    alarmInterval = setInterval(() => {
      try {
        const osc = alarmAudioContext.createOscillator();
        const gain = alarmAudioContext.createGain();
        osc.type = "sawtooth";
        osc.frequency.value = freqToggle ? 960 : 720;
        freqToggle = !freqToggle;
        
        gain.gain.setValueAtTime(0.7, alarmAudioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, alarmAudioContext.currentTime + 0.35);
        
        osc.connect(gain);
        gain.connect(alarmAudioContext.destination);
        
        osc.start();
        osc.stop(alarmAudioContext.currentTime + 0.35);
      } catch (err) {
        console.warn("Alarm osc error:", err);
      }
    }, 450);

  } catch (e) {
    console.error("Audio synth error:", e);
  }
}

function stopAlarm() {
  alarmBanner.classList.add("hidden");
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
  if (btnStopAlarm) btnStopAlarm.classList.remove("btn-pulsing");

  if (window.AndroidBridge && window.AndroidBridge.stopAlarm) {
    try {
      window.AndroidBridge.stopAlarm();
    } catch (ignored) {}
  }
}

silenceAlarmBtn.addEventListener("click", () => {
  stopAlarm();
  sendCommand("stop phone alarm");
});

function triggerPhoneVibration(pattern) {
  if (window.AndroidBridge && window.AndroidBridge.vibrate) {
    try {
      const dur = Array.isArray(pattern) ? pattern[0] : (typeof pattern === "number" ? pattern : 500);
      window.AndroidBridge.vibrate(dur);
      return;
    } catch (ignored) {}
  }
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Client-Side Offline Weather Engine (Location First, API Key 8ff79568e0fbdffe1104aefc40895e42)
async function executeWeatherClient(queryText = "") {
  showToast("🌤️ Detecting location & weather...");
  let city = "Chennai";
  let state = "Tamil Nadu";
  let country = "India";
  let lat = 13.0878;
  let lon = 80.2785;

  try {
    const ipRes = await fetch("https://ipapi.co/json/");
    if (ipRes.ok) {
      const d = await ipRes.json();
      city = d.city || city;
      state = d.region || state;
      country = d.country_name || country;
      if (d.latitude && d.longitude) {
        lat = d.latitude;
        lon = d.longitude;
      }
    }
  } catch (e) {
    console.warn("IP geolocation:", e);
  }

  let temp = 28;
  let desc = "partly cloudy";
  let humidity = 65;
  let wind = 12;

  try {
    const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=8ff79568e0fbdffe1104aefc40895e42&units=metric`;
    const res = await fetch(owmUrl);
    if (res.ok) {
      const data = await res.json();
      temp = Math.round(data.main.temp);
      desc = data.weather[0].description;
      humidity = data.main.humidity;
      wind = Math.round(data.wind.speed * 3.6);
    }
  } catch (e) {
    console.warn("OpenWeatherMap fetch:", e);
  }

  const speech = `Accessing sensors for ${city}, ${state}, ${country}. Currently it is ${temp} degrees Celsius with ${desc}. Humidity is at ${humidity} percent, with winds traveling at ${wind} kilometers per hour.`;
  displayChat(queryText || "Weather", speech, currentDeviceType);
  speakText(speech);
  showToast(`🌤️ ${city}: ${temp}°C, ${desc}`);
}

// Command Dispatcher (Hybrid Offline Client & Synced Remote)
function sendCommand(queryText) {
  if (!queryText || !queryText.trim()) return;

  unlockAudioContext();
  const cleanQuery = queryText.trim();
  const qLower = cleanQuery.toLowerCase();

  if (neuralOrb) neuralOrb.setState("thinking");
  hudStatus.textContent = `PROCESSING: "${cleanQuery}"`;

  // Check client-side direct execution for instant response
  if (qLower.includes("stop alarm") || qLower.includes("silence alarm")) {
    stopAlarm();
    displayChat(cleanQuery, "Phone alarm silenced, Sir.", currentDeviceType);
    speakText("Phone alarm silenced, Sir.");
    showToast("🔕 Alarm Silenced");
  } else if (qLower.includes("ring phone") || (qLower.includes("alarm") && !qLower.includes("stop"))) {
    triggerPhoneAlarm();
    displayChat(cleanQuery, "Phone alarm ringing, Sir.", currentDeviceType);
    speakText("Phone alarm ringing, Sir.");
    showToast("🔔 Alarm Triggered");
  } else if (qLower.includes("weather") || qLower.includes("temperature")) {
    executeWeatherClient(cleanQuery);
  } else if (qLower.startsWith("call ") || qLower.startsWith("dial ")) {
    const num = cleanQuery.replace(/(?:call|dial)\s+/i, "").trim();
    if (window.AndroidBridge && window.AndroidBridge.makeCall) {
      window.AndroidBridge.makeCall(num);
    }
    const reply = `Dialing ${num}, Sir.`;
    displayChat(cleanQuery, reply, currentDeviceType);
    speakText(reply);
  } else if (qLower.startsWith("calculate ") || (qLower.startsWith("what is ") && /\d/.test(qLower))) {
    const expr = cleanQuery.replace(/(?:calculate|what is)\s+/i, "").trim();
    try {
      const cleanExpr = expr.replace(/[^0-9+\-*/().%^e\s]/g, "");
      const res = Function(`'use strict'; return (${cleanExpr})`)();
      const reply = `The calculation result is ${res}`;
      displayChat(cleanQuery, reply, currentDeviceType);
      speakText(reply);
    } catch (e) {
      displayChat(cleanQuery, "Could not compute calculation, Sir.", currentDeviceType);
    }
  }

  // Also broadcast over WebSocket if open for multi-device sync
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: "COMMAND",
      query: cleanQuery,
      source_device: currentDeviceType
    }));
  } else {
    // Fallback to REST API
    fetch(`${getApiBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: cleanQuery, source_device: currentDeviceType })
    })
    .then(r => r.json())
    .then(data => {
      if (!qLower.includes("weather") && !qLower.includes("stop alarm") && !qLower.includes("ring phone")) {
        displayChat(cleanQuery, data.reply || data.response, currentDeviceType);
        speakText(data.reply || data.response);
        showToast(`✓ ${(data.reply || data.response || "").substring(0, 45)}...`);
      }
    })
    .catch(err => {
      console.warn("Cloud fallback error:", err.message);
    });
  }

  commandInput.value = "";
}
    })
    .then(r => r.json())
    .then(data => {
      displayChat(data.query, data.response, currentDeviceType);
      speakText(data.response);
      showToast(`✓ ${data.response.substring(0, 45)}...`);
    })
    .catch(err => {
      console.error("Command REST error:", err);
      showToast("Error sending command to host");
    });
  }

  commandInput.value = "";
}

// Export sendCommand to window for inline click handlers
window.sendCommand = sendCommand;

sendBtn.addEventListener("click", () => sendCommand(commandInput.value));
commandInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendCommand(commandInput.value);
});

// Chat Log Display
function displayChat(userQuery, jarvisResponse, sourceDevice) {
  const userBubble = document.createElement("div");
  userBubble.className = "chat-bubble bubble-user";
  userBubble.innerHTML = `<strong>[${(sourceDevice || "user").toUpperCase()}]</strong>: ${userQuery}`;
  chatLog.appendChild(userBubble);

  const jarvisBubble = document.createElement("div");
  jarvisBubble.className = "chat-bubble bubble-jarvis";
  jarvisBubble.innerHTML = `<strong>[${currentPersona}]</strong>: ${jarvisResponse}`;
  chatLog.appendChild(jarvisBubble);

  chatLog.scrollTop = chatLog.scrollHeight;
}

// Synced Notes Management
function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    notesList.innerHTML = `<div class="empty-notes">No synced notes yet. Add one above!</div>`;
    return;
  }

  notesList.innerHTML = "";
  notes.forEach((note) => {
    const item = document.createElement("div");
    item.className = "note-item";
    item.innerHTML = `
      <div class="note-content">
        <span>${note.text}</span>
        <span class="note-meta">${note.created_at || ""} • ${note.source_device || "device"}</span>
      </div>
      <button class="delete-note-btn" onclick="deleteNote(${note.id})">&times;</button>
    `;
    notesList.appendChild(item);
  });
}

function addNote() {
  const text = newNoteInput.value.trim();
  if (!text) return;
  fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text, source_device: currentDeviceType })
  }).then(() => {
    newNoteInput.value = "";
    showToast("Note synced across all devices");
  });
}

window.deleteNote = function(id) {
  fetch(`/api/notes/${id}`, { method: "DELETE" }).then(() => {
    showToast("Note deleted");
  });
};

addNoteBtn.addEventListener("click", addNote);
newNoteInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") addNote();
});
refreshNotesBtn.addEventListener("click", () => {
  fetch("/api/notes").then(r => r.json()).then(renderNotes);
});

// Screenshot Modal
function showScreenshot(url) {
  screenshotImg.src = url + "?t=" + new Date().getTime();
  screenshotModal.style.display = "flex";
  showToast("📸 Screenshot received");
}
closeModal.addEventListener("click", () => {
  screenshotModal.style.display = "none";
});

// Calculation Modal
function openCalcModal() {
  calcModal.style.display = "flex";
  calcInput.focus();
}

function closeCalc() {
  calcModal.style.display = "none";
}

if (closeCalcModal) closeCalcModal.addEventListener("click", closeCalc);

window.setCalcPrompt = function(expr) {
  calcInput.value = expr;
  executeCalculation();
};

function executeCalculation() {
  const expr = calcInput.value.trim();
  if (!expr) return;
  closeCalc();
  sendCommand("calculate " + expr);
}

if (btnExecuteCalc) btnExecuteCalc.addEventListener("click", executeCalculation);
if (calcInput) {
  calcInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") executeCalculation();
  });
}

// ========================================================
// REMOTE COMMANDS BUTTON LISTENERS (100% Reliable Handlers)
// ========================================================
if (btnRingPhone) {
  btnRingPhone.addEventListener("click", () => {
    triggerPhoneVibration(200);
    showToast("🔔 Triggering Phone Alarm...");
    sendCommand("ring my phone");
  });
}

if (btnStopAlarm) {
  btnStopAlarm.addEventListener("click", () => {
    stopAlarm();
    showToast("🔕 Silencing phone alarm...");
    sendCommand("stop phone alarm");
  });
}

if (btnVibratePhone) {
  btnVibratePhone.addEventListener("click", () => {
    triggerPhoneVibration([300, 100, 300, 100, 400]);
    showToast("📳 Vibrating Phone...");
    sendCommand("vibrate phone");
  });
}

if (btnScreenshot) {
  btnScreenshot.addEventListener("click", () => {
    showToast("📸 Capturing Laptop Screenshot...");
    sendCommand("take screenshot");
  });
}

if (btnNews) {
  btnNews.addEventListener("click", () => {
    showToast("📰 Fetching Top Headlines...");
    sendCommand("news");
  });
}

if (btnWeather) {
  btnWeather.addEventListener("click", () => {
    showToast("🌤️ Getting Local Weather...");
    sendCommand("weather");
  });
}

if (btnJoke) {
  btnJoke.addEventListener("click", () => {
    showToast("😄 Requesting Joke...");
    sendCommand("tell me a joke");
  });
}

if (btnTheme) {
  btnTheme.addEventListener("click", () => {
    showToast("🎵 Playing Iron Man Theme...");
    sendCommand("play theme");
  });
}

if (btnQuote) {
  btnQuote.addEventListener("click", () => {
    showToast("💡 Requesting Daily Quote...");
    sendCommand("quote");
  });
}

if (btnCalc) {
  btnCalc.addEventListener("click", () => {
    openCalcModal();
  });
}

if (btnIp) {
  btnIp.addEventListener("click", () => {
    showToast("🌐 Querying Public IP...");
    sendCommand("what is my ip");
  });
}

if (btnCalendar) {
  btnCalendar.addEventListener("click", () => {
    showToast("📅 Opening Calendar...");
    sendCommand("open calendar");
  });
}

// Fast Folders (PC)
if (btnFolderDownloads) {
  btnFolderDownloads.addEventListener("click", () => {
    showToast("📥 Opening PC Downloads Folder...");
    sendCommand("open downloads");
  });
}

if (btnFolderDocs) {
  btnFolderDocs.addEventListener("click", () => {
    showToast("📄 Opening PC Documents Folder...");
    sendCommand("open documents");
  });
}

// Assistant Persona Toggle (J.A.R.V.I.S <-> F.R.I.D.A.Y)
if (personaToggleBtn) {
  personaToggleBtn.addEventListener("click", () => {
    if (currentPersona === "JARVIS") {
      currentPersona = "FRIDAY";
      personaToggleBtn.textContent = "👩 F.R.I.D.A.Y";
      personaToggleBtn.classList.add("btn-warning");
      sendCommand("switch to friday");
    } else {
      currentPersona = "JARVIS";
      personaToggleBtn.textContent = "🤖 J.A.R.V.I.S";
      personaToggleBtn.classList.remove("btn-warning");
      sendCommand("switch to jarvis");
    }
  });
}

// Telephony & Mobile Calling System (OpenLine + PocketDaemon)
function updateCallUI(activeCalls) {
  if (!activeCalls || Object.keys(activeCalls).length === 0) {
    if (activeCallCard) activeCallCard.classList.add("hidden");
    return;
  }
  const callIds = Object.keys(activeCalls);
  const call = activeCalls[callIds[callIds.length - 1]];
  if (activeCallCard && call) {
    activeCallCard.classList.remove("hidden");
    activeCallName.textContent = call.recipient_name || "Unknown";
    activeCallNumber.textContent = call.recipient_number ? ` (${call.recipient_number})` : "";
    activeCallStatus.textContent = (call.state || "ACTIVE").toUpperCase();
    if (call.direction === "inbound" && call.state === "ringing") {
      btnAnswerCall.classList.remove("hidden");
    } else {
      btnAnswerCall.classList.add("hidden");
    }
  }
}

window.dialTarget = function(target) {
  if (!target) return;
  showToast(`📞 Dialing ${target}...`);
  sendCommand(`call ${target}`);
};

if (btnDialCall) {
  btnDialCall.addEventListener("click", () => {
    const dest = callDestinationInput.value.trim();
    if (dest) {
      dialTarget(dest);
      callDestinationInput.value = "";
    }
  });
}

if (btnHangupCall) {
  btnHangupCall.addEventListener("click", () => {
    showToast("Ending Call...");
    sendCommand("hang up");
  });
}

if (btnAnswerCall) {
  btnAnswerCall.addEventListener("click", () => {
    showToast("Answering Call...");
    sendCommand("answer call");
  });
}

// PC Hardware Controls (MAbitha1/jarvis-)
if (volSlider) {
  volSlider.addEventListener("input", (e) => {
    volValue.textContent = `${e.target.value}%`;
  });
  volSlider.addEventListener("change", (e) => {
    const val = e.target.value;
    volValue.textContent = `${val}%`;
    showToast(`🔊 Volume set to ${val}%`);
    fetch("/api/pc/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: parseInt(val) })
    });
  });
}

if (btnToggleMute) {
  btnToggleMute.addEventListener("click", () => {
    isMuted = !isMuted;
    btnToggleMute.textContent = isMuted ? "Unmute" : "Mute";
    showToast(isMuted ? "🔇 Audio Muted" : "🔊 Audio Unmuted");
    fetch("/api/pc/volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mute: isMuted })
    });
  });
}

if (brightSlider) {
  brightSlider.addEventListener("input", (e) => {
    brightValue.textContent = `${e.target.value}%`;
  });
  brightSlider.addEventListener("change", (e) => {
    const val = e.target.value;
    brightValue.textContent = `${val}%`;
    showToast(`☀️ Brightness set to ${val}%`);
    fetch("/api/pc/brightness", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: parseInt(val) })
    });
  });
}

if (btnToggleWifi) {
  btnToggleWifi.addEventListener("click", () => {
    isWifiOn = !isWifiOn;
    btnToggleWifi.textContent = isWifiOn ? "Wi-Fi: ON" : "Wi-Fi: OFF";
    showToast(isWifiOn ? "📶 Wi-Fi Turned ON" : "📶 Wi-Fi Turned OFF");
    fetch("/api/pc/wifi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: isWifiOn })
    });
  });
}

if (btnToggleDark) {
  btnToggleDark.addEventListener("click", () => {
    isDark = !isDark;
    btnToggleDark.textContent = isDark ? "Dark Mode: ON" : "Dark Mode: OFF";
    showToast(isDark ? "🌙 Dark Mode Enabled" : "☀️ Light Mode Enabled");
    fetch("/api/pc/darkmode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dark: isDark })
    });
  });
}

// Start Connection on page load
connectWebSocket();
