/**
 * J.A.R.V.I.S 2.0.2 - Helpers Module (JavaScript)
 */

const JOKES = [
    "Why do programmers prefer dark mode? Because light attracts bugs.",
    "There are 10 types of people in the world: those who understand binary, and those who don't.",
    "A SQL query walks into a bar, walks up to two tables and asks: Can I join you?",
    "Why was the JavaScript developer sad? Because they didn't know how to 'null' their feelings.",
    "Hardware is the part of a computer that you can kick; software is the part that you can only curse at.",
    "Why do Java programmers wear glasses? Because they don't C#."
];

const QUOTES = [
    { quote: "Sometimes you gotta run before you can walk.", author: "Tony Stark" },
    { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
    { quote: "I can do this all day.", author: "Steve Rogers" },
    { quote: "Part of the journey is the end.", author: "Tony Stark" }
];

function getRandomJoke() {
    const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
    return { joke, speech: joke };
}

async function getQuote() {
    try {
        const res = await fetch("https://zenquotes.io/api/random");
        if (res.ok) {
            const data = await res.json();
            if (data && data.length > 0) {
                const q = data[0].q;
                const a = data[0].a;
                return { quote: q, author: a, speech: `"${q}" by ${a}` };
            }
        }
    } catch (ignored) {}

    const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    return { ...q, speech: `"${q.quote}" - ${q.author}` };
}

async function getPublicIP() {
    try {
        const res = await fetch("https://api.ipify.org?format=json");
        if (res.ok) {
            const data = await res.json();
            return { ip: data.ip, speech: `Your public IP address is ${data.ip}` };
        }
    } catch (e) {
        console.error("Public IP error:", e.message);
    }
    return { ip: "127.0.0.1", speech: "Could not retrieve public IP address, Sir." };
}

function calculateMath(expression) {
    try {
        // Sanitize mathematical expression
        const clean = expression.replace(/[^0-9+\-*/().%^e\s]/g, "");
        if (!clean) throw new Error("Invalid expression");
        // Safe evaluation
        const result = Function(`'use strict'; return (${clean})`)();
        return {
            expression,
            result,
            speech: `The calculation result is ${result}`
        };
    } catch (e) {
        return {
            expression,
            error: e.message,
            speech: "I could not compute that mathematical expression, Sir."
        };
    }
}

module.exports = {
    getRandomJoke,
    getQuote,
    getPublicIP,
    calculateMath
};
