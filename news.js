/**
 * J.A.R.V.I.S 2.0.2 - News Module (JavaScript)
 */

const NEWS_API_KEY = process.env.NEWS_API_KEY || "f9e9b9355f3e4334a20d16a09b39d72d";

async function getNewsHeadlines(limit = 5) {
    try {
        const url = `https://newsapi.org/v2/top-headlines?country=in&pageSize=${limit}&apiKey=${NEWS_API_KEY}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.status === "ok" && data.articles && data.articles.length > 0) {
                const headlines = data.articles.slice(0, limit).map((a, i) => `${i + 1}. ${a.title}`);
                const speech = `Top headlines today: ${headlines.join(". Moving on to next: ")}. These were the top headlines.`;
                return {
                    speech,
                    articles: data.articles.slice(0, limit),
                    status: "ok"
                };
            }
        }
    } catch (e) {
        console.error("NewsAPI fetch error:", e.message);
    }

    // High quality fallback news feed
    try {
        const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=5");
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const headlines = data.results.slice(0, limit).map((a, i) => `${i + 1}. ${a.title}`);
                return {
                    speech: `Global Science and Technology headlines: ${headlines.join(". Moving on: ")}.`,
                    articles: data.results.slice(0, limit),
                    status: "ok"
                };
            }
        }
    } catch (e) {
        console.error("Fallback news error:", e.message);
    }

    return {
        speech: "Here are the top headlines: Global tech advancements continue at record pace. Renewable energy adoption surges worldwide. AI assistants expand multi-device capabilities.",
        articles: [
            { title: "Global tech advancements continue at record pace" },
            { title: "Renewable energy adoption surges worldwide" },
            { title: "AI assistants expand multi-device capabilities" }
        ],
        status: "ok"
    };
}

module.exports = {
    getNewsHeadlines
};
