/**
 * J.A.R.V.I.S 2.0.2 - Real-Time Synced Cloud & Local Server (Node.js)
 * High-performance, lightweight, instant-startup replacement for server.py.
 */

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const { processCommand } = require("./jarvis");
const { getWeatherReport } = require("./weather");
const { getNewsHeadlines } = require("./news");
const { getQuote, getRandomJoke, getPublicIP, calculateMath } = require("./helpers");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Serve static UI assets
app.use(express.static(path.join(__dirname, "static")));
app.use("/media", express.static(path.join(__dirname, "media")));

// Connected clients tracking
const clients = new Map(); // ws -> { type: 'laptop'|'mobile', id: string, info: object }

wss.on("connection", (ws, req) => {
    const url = req.url || "";
    let clientType = "general";
    if (url.includes("/ws/laptop")) clientType = "laptop";
    else if (url.includes("/ws/mobile")) clientType = "mobile";

    clients.set(ws, { type: clientType, id: Math.random().toString(36).substring(7), info: {} });
    console.log(`[WS Connected] Device: ${clientType} (Total clients: ${clients.size})`);

    // Notify device of connection
    ws.send(JSON.stringify({
        type: "CONNECTED",
        device: clientType,
        message: "Connected to J.A.R.V.I.S Core",
        timestamp: Date.now()
    }));

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);
            handleWsMessage(ws, data);
        } catch (e) {
            console.error("Malformed WS message:", e.message);
        }
    });

    ws.on("close", () => {
        clients.delete(ws);
        console.log(`[WS Disconnected] Device: ${clientType} (Total clients: ${clients.size})`);
    });

    ws.on("error", (err) => {
        console.error(`[WS Error] ${err.message}`);
    });
});

function broadcast(msgObj, targetType = null) {
    const jsonStr = JSON.stringify(msgObj);
    for (const [ws, meta] of clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
            if (!targetType || meta.type === targetType) {
                ws.send(jsonStr);
            }
        }
    }
}

function handleWsMessage(senderWs, msg) {
    const type = msg.type || "";
    const senderMeta = clients.get(senderWs) || {};

    if (type === "REGISTER") {
        senderMeta.type = msg.device || senderMeta.type;
        senderMeta.info = msg;
        clients.set(senderWs, senderMeta);
        console.log(`[Registered] Device ${senderMeta.type}:`, msg.hostname || msg.model || "");
        return;
    }

    if (type === "STOP_ALARM" || msg.action === "stop_alarm") {
        console.log("[Broadcast] STOP_ALARM to all devices");
        broadcast({ type: "STOP_ALARM", action: "stop_alarm", timestamp: Date.now() });
        return;
    }

    if (type === "ALARM" || type === "RING_PHONE" || msg.action === "ring_phone") {
        console.log("[Broadcast] RING_PHONE to mobile");
        broadcast({ type: "ALARM", action: "ring_phone", timestamp: Date.now() }, "mobile");
        return;
    }

    if (type === "LAPTOP_STATUS") {
        // Broadcast laptop telemetry to mobile and web UI
        broadcast({ type: "LAPTOP_STATUS", data: msg }, "mobile");
        return;
    }

    if (type === "LAPTOP_SCREENSHOT") {
        // Save and broadcast screenshot
        broadcast({ type: "LAPTOP_SCREENSHOT", image: msg.image, timestamp: Date.now() });
        return;
    }

    // Default: broadcast to opposite device type
    if (senderMeta.type === "mobile") {
        broadcast(msg, "laptop");
    } else if (senderMeta.type === "laptop") {
        broadcast(msg, "mobile");
    } else {
        broadcast(msg);
    }
}

// ---------------- REST API Routes ----------------

app.get("/api/status", (req, res) => {
    const devices = [];
    for (const [, meta] of clients.entries()) {
        devices.push(meta.type);
    }
    res.json({
        status: "online",
        engine: "Node.js v24 J.A.R.V.I.S 2.0.2",
        clients_count: clients.size,
        active_devices: devices,
        timestamp: Date.now()
    });
});

app.post("/api/chat", async (req, res) => {
    try {
        const query = req.body.message || req.body.query || "";
        const result = await processCommand(query);

        // If command is remote hardware action, broadcast immediately
        if (result.action === "stop_alarm") {
            broadcast({ type: "STOP_ALARM", action: "stop_alarm" });
        } else if (result.action === "ring_phone") {
            broadcast({ type: "ALARM", action: "ring_phone" }, "mobile");
        } else if (result.action === "device_command") {
            broadcast({ type: "DEVICE_COMMAND", data: result.data }, "laptop");
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({ error: e.message, reply: "An internal processing error occurred, Sir." });
    }
});

app.post("/api/weather", async (req, res) => {
    try {
        const query = req.body.query || "";
        const report = await getWeatherReport(query);
        res.json(report);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/news", async (req, res) => {
    try {
        const news = await getNewsHeadlines();
        res.json(news);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/quote", async (req, res) => {
    const q = await getQuote();
    res.json(q);
});

app.get("/api/joke", (req, res) => {
    res.json(getRandomJoke());
});

app.get("/api/public-ip", async (req, res) => {
    const ip = await getPublicIP();
    res.json(ip);
});

app.post("/api/calculate", (req, res) => {
    const expr = req.body.expression || "";
    res.json(calculateMath(expr));
});

app.post("/api/alarm/stop", (req, res) => {
    broadcast({ type: "STOP_ALARM", action: "stop_alarm", timestamp: Date.now() });
    res.json({ status: "ok", message: "Stop alarm broadcast sent to all devices" });
});

app.post("/api/alarm/ring", (req, res) => {
    broadcast({ type: "ALARM", action: "ring_phone", timestamp: Date.now() }, "mobile");
    res.json({ status: "ok", message: "Ring alarm broadcast sent to phone" });
});

app.post("/api/call", (req, res) => {
    const target = req.body.phone_number || req.body.target || "";
    broadcast({ type: "CALL", target, timestamp: Date.now() }, "mobile");
    res.json({ status: "ok", target });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "static", "index.html"));
});

server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`J.A.R.V.I.S 2.0.2 Hub running on port ${PORT}`);
    console.log(`Live HTTP: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws/{client_type}`);
    console.log(`===============================================`);
});
