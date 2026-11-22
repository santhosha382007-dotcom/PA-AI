/**
 * J.A.R.V.I.S 2.0.2 - Dictionary Module (JavaScript)
 */

const fs = require("fs");
const path = require("path");

let localDict = {};
try {
    const dictPath = path.join(__dirname, "data.json");
    if (fs.existsSync(dictPath)) {
        localDict = JSON.parse(fs.readFileSync(dictPath, "utf-8"));
    }
} catch (e) {
    console.error("Local dictionary load error:", e.message);
}

async function defineWord(word) {
    if (!word) return { speech: "Please state the word you want me to define, Sir.", status: "error" };
    const query = word.trim().toLowerCase();

    // Check online Free Dictionary API
    try {
        const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                const entry = data[0];
                const meaning = entry.meanings && entry.meanings[0];
                const def = meaning && meaning.definitions && meaning.definitions[0] ? meaning.definitions[0].definition : "";
                const part = meaning ? meaning.partOfSpeech : "definition";
                const speech = `The definition of ${word} as a ${part} is: ${def}`;
                return {
                    word,
                    partOfSpeech: part,
                    definition: def,
                    speech,
                    status: "ok"
                };
            }
        }
    } catch (e) {
        console.error("Online dictionary error:", e.message);
    }

    // Check local dictionary
    if (localDict[query]) {
        const def = Array.isArray(localDict[query]) ? localDict[query][0] : localDict[query];
        return {
            word,
            definition: def,
            speech: `According to my local database, ${word} means: ${def}`,
            status: "ok"
        };
    }

    return {
        word,
        speech: `I could not find a formal definition for '${word}', Sir.`,
        status: "not_found"
    };
}

module.exports = {
    defineWord
};
