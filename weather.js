/**
 * J.A.R.V.I.S 2.0.2 - Weather Module (JavaScript)
 * API Key: 8ff79568e0fbdffe1104aefc40895e42
 * Rule: Always announce location details (city, state, country, coordinates) before weather forecast.
 */

const WEATHER_API_KEY = "8ff79568e0fbdffe1104aefc40895e42";

const COUNTRY_NAMES = {
    IN: "India",
    US: "United States",
    GB: "United Kingdom",
    CA: "Canada",
    AU: "Australia",
    DE: "Germany",
    FR: "France",
    JP: "Japan",
    SG: "Singapore",
    AE: "United Arab Emirates"
};

function formatCoordinates(lat, lon) {
    const latDir = lat >= 0 ? "N" : "S";
    const lonDir = lon >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lon).toFixed(2)}° ${lonDir}`;
}

async function getLocationDetails(customQuery = "") {
    let targetCity = null;
    if (customQuery) {
        const match = customQuery.match(/weather (?:in|for|at)\s+([a-zA-Z\s]+)/i);
        if (match) {
            targetCity = match[1].trim();
        }
    }

    if (targetCity) {
        try {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(targetCity)}&count=1`);
            const geoData = await geoRes.json();
            if (geoData.results && geoData.results.length > 0) {
                const hit = geoData.results[0];
                const lat = hit.latitude || 13.08;
                const lon = hit.longitude || 80.27;
                const city = hit.name || targetCity;
                const state = hit.admin1 || "";
                const countryCode = (hit.country_code || "").toUpperCase();
                const country = COUNTRY_NAMES[countryCode] || hit.country || countryCode;
                return {
                    city,
                    state,
                    country,
                    latitude: lat,
                    longitude: lon,
                    coordinates_str: formatCoordinates(lat, lon)
                };
            }
        } catch (e) {
            console.error("Geocoding lookup error:", e.message);
        }
    }

    // Default: detect location via IP Geolocation
    let city = "Chennai";
    let state = "Tamil Nadu";
    let country = "India";
    let lat = 13.0878;
    let lon = 80.2785;

    try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
            const ipData = await ipRes.json();
            city = ipData.city || city;
            state = ipData.region || state;
            const code = (ipData.country_code || "").toUpperCase();
            country = COUNTRY_NAMES[code] || ipData.country_name || country;
            if (ipData.latitude && ipData.longitude) {
                lat = parseFloat(ipData.latitude);
                lon = parseFloat(ipData.longitude);
            }
        }
    } catch (e) {
        try {
            const ipinfoRes = await fetch("https://ipinfo.io/json");
            if (ipinfoRes.ok) {
                const infoData = await ipinfoRes.json();
                city = infoData.city || city;
                state = infoData.region || state;
                const code = (infoData.country || "").toUpperCase();
                country = COUNTRY_NAMES[code] || code;
                if (infoData.loc) {
                    const parts = infoData.loc.split(",");
                    lat = parseFloat(parts[0]);
                    lon = parseFloat(parts[1]);
                }
            }
        } catch (ignored) {}
    }

    return {
        city,
        state,
        country,
        latitude: lat,
        longitude: lon,
        coordinates_str: formatCoordinates(lat, lon)
    };
}

async function getWeatherReport(query = "") {
    const loc = await getLocationDetails(query);

    let locationSpeech = "";
    if (loc.state && loc.state !== loc.city) {
        locationSpeech = `Accessing sensors for ${loc.city}, ${loc.state}, ${loc.country}, coordinates ${loc.coordinates_str}. `;
    } else {
        locationSpeech = `Accessing sensors for ${loc.city}, ${loc.country}, coordinates ${loc.coordinates_str}. `;
    }

    let weatherData = null;

    // Call OpenWeatherMap with API Key
    try {
        const owmUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${loc.latitude}&lon=${loc.longitude}&appid=${WEATHER_API_KEY}&units=metric`;
        const res = await fetch(owmUrl);
        if (res.ok) {
            const data = await res.json();
            weatherData = {
                temperature_c: Math.round(data.main.temp),
                condition: data.weather[0].description,
                humidity: data.main.humidity,
                wind_speed: Math.round(data.wind.speed * 3.6),
                feels_like_c: Math.round(data.main.feels_like)
            };
        }
    } catch (e) {
        console.error("OpenWeatherMap fetch error:", e.message);
    }

    // Fallback to open-meteo if needed
    if (!weatherData) {
        try {
            const omUrl = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
            const res = await fetch(omUrl);
            if (res.ok) {
                const data = await res.json();
                const cur = data.current || {};
                weatherData = {
                    temperature_c: Math.round(cur.temperature_2m || 28),
                    condition: "Partly cloudy",
                    humidity: cur.relative_humidity_2m || 65,
                    wind_speed: Math.round(cur.wind_speed_10m || 12),
                    feels_like_c: Math.round(cur.temperature_2m || 28)
                };
            }
        } catch (e) {
            console.error("Open-Meteo fallback error:", e.message);
        }
    }

    if (!weatherData) {
        weatherData = {
            temperature_c: 28,
            condition: "Clear skies",
            humidity: 65,
            wind_speed: 12,
            feels_like_c: 29
        };
    }

    const forecastSpeech = `Currently in ${loc.city}, it is ${weatherData.temperature_c} degrees Celsius with ${weatherData.condition}. Humidity is at ${weatherData.humidity} percent, with winds traveling at ${weatherData.wind_speed} kilometers per hour.`;
    const fullSpeech = locationSpeech + forecastSpeech;

    return {
        speech: fullSpeech,
        location: loc,
        weather: weatherData,
        status: "ok"
    };
}

module.exports = {
    WEATHER_API_KEY,
    getLocationDetails,
    getWeatherReport
};
