/**
 * J.A.R.V.I.S 2.0.2 - Core AI Engine (JavaScript)
 */

const { getWeatherReport } = require("./weather");
const { getNewsHeadlines } = require("./news");
const { defineWord } = require("./diction");
const { getRandomJoke, getQuote, getPublicIP, calculateMath } = require("./helpers");

async function processCommand(query = "", context = {}) {
    const q = query.trim().toLowerCase();
    if (!q) {
        return { reply: "At your service, Sir. How may I assist you?", action: null };
    }

    // Weather forecast (Always location-first)
    if (q.includes("weather") || q.includes("temperature") || q.includes("forecast") || q.includes("climate")) {
        const report = await getWeatherReport(query);
        return {
            reply: report.speech,
            action: "weather",
            data: report
        };
    }

    // News headlines
    if (q.includes("news") || q.includes("headline") || q.includes("current events")) {
        const news = await getNewsHeadlines();
        return {
            reply: news.speech,
            action: "news",
            data: news
        };
    }

    // Stop Phone Alarm
    if (q.includes("stop alarm") || q.includes("silence alarm") || q.includes("turn off alarm") || q.includes("cancel alarm")) {
        return {
            reply: "Stopping phone alarm immediately, Sir.",
            action: "stop_alarm",
            data: { device: "all" }
        };
    }

    // Ring Phone / Alarm
    if (q.includes("ring phone") || q.includes("find phone") || q.includes("trigger alarm") || q.includes("sound alarm")) {
        return {
            reply: "Triggering phone alarm now, Sir.",
            action: "ring_phone",
            data: { device: "mobile" }
        };
    }

    // Phone Calling
    if (q.startsWith("call ") || q.startsWith("dial ") || q.includes("phone call")) {
        const match = query.match(/(?:call|dial)\s+([a-zA-Z0-9\s]+)/i);
        const target = match ? match[1].trim() : "";
        return {
            reply: `Initiating call to ${target}, Sir.`,
            action: "call_phone",
            data: { target }
        };
    }

    // Laptop Volume Control
    if (q.includes("volume up") || q.includes("increase volume")) {
        return { reply: "Increasing system volume.", action: "device_command", data: { type: "volume", action: "up" } };
    }
    if (q.includes("volume down") || q.includes("decrease volume")) {
        return { reply: "Decreasing system volume.", action: "device_command", data: { type: "volume", action: "down" } };
    }
    if (q.includes("mute volume") || q.includes("unmute")) {
        return { reply: "Toggling audio mute.", action: "device_command", data: { type: "volume", action: "mute" } };
    }

    // Laptop Brightness
    if (q.includes("brightness")) {
        const m = q.match(/(\d+)/);
        const level = m ? parseInt(m[1]) : 70;
        return { reply: `Setting display brightness to ${level} percent.`, action: "device_command", data: { type: "brightness", level } };
    }

    // Dark Mode
    if (q.includes("dark mode") || q.includes("light mode")) {
        const enable = !q.includes("light mode") && (q.includes("dark mode") || q.includes("enable dark"));
        return { reply: `Switching to ${enable ? "Dark" : "Light"} theme.`, action: "device_command", data: { type: "darkmode", action: enable } };
    }

    // Laptop Screenshot
    if (q.includes("screenshot") || q.includes("capture screen")) {
        return { reply: "Capturing laptop display diagnostics.", action: "device_command", data: { type: "screenshot" } };
    }

    // Fast Folders
    if (q.includes("open downloads") || q.includes("downloads folder")) {
        return { reply: "Opening Downloads folder.", action: "device_command", data: { type: "open_folder", folder: "downloads" } };
    }
    if (q.includes("open documents") || q.includes("documents folder")) {
        return { reply: "Opening Documents folder.", action: "device_command", data: { type: "open_folder", folder: "documents" } };
    }

    // Iron Man Music
    if (q.includes("iron man music") || q.includes("play music") || q.includes("soundtrack")) {
        return { reply: "Initiating Iron Man soundtrack playback.", action: "device_command", data: { type: "ironman_music" } };
    }

    // Dictionary definition
    if (q.startsWith("define ") || q.startsWith("meaning of ") || q.startsWith("what is the meaning of ")) {
        const word = query.replace(/(?:define|what is the meaning of|meaning of)\s+/i, "").trim();
        const def = await defineWord(word);
        return { reply: def.speech, action: "dictionary", data: def };
    }

    // Math calculations
    if (q.startsWith("calculate ") || q.startsWith("what is ") && /\d/.test(q)) {
        const expr = query.replace(/(?:calculate|what is)\s+/i, "").trim();
        const mathRes = calculateMath(expr);
        return { reply: mathRes.speech, action: "calculate", data: mathRes };
    }

    // Jokes
    if (q.includes("joke") || q.includes("make me laugh")) {
        const j = getRandomJoke();
        return { reply: j.speech, action: "joke", data: j };
    }

    // Quotes
    if (q.includes("quote") || q.includes("inspiration")) {
        const qt = await getQuote();
        return { reply: qt.speech, action: "quote", data: qt };
    }

    // Public IP
    if (q.includes("public ip") || q.includes("my ip")) {
        const ip = await getPublicIP();
        return { reply: ip.speech, action: "public_ip", data: ip };
    }

    // Time & Date
    if (q.includes("time") || q.includes("date")) {
        const now = new Date();
        const timeStr = now.toLocaleTimeString();
        const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return { reply: `Current time is ${timeStr} on ${dateStr}, Sir.`, action: "time", data: { time: timeStr, date: dateStr } };
    }

    // Default conversational response
    return {
        reply: `Understood, Sir. Processing your command: "${query}". All systems operating normally.`,
        action: "general",
        data: { query }
    };
}

module.exports = {
    processCommand
};
