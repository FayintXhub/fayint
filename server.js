// --- server.js ---
const express = require("express");
const https   = require("https");
const crypto  = require("crypto");
const app     = express();
const PORT    = process.env.PORT || 3000;

const KEY_SECRET  = process.env.KEY_SECRET || "j4rzz-secret-ganti-ini";
const SCRIPT_URL  = "https://raw.githubusercontent.com/jarzzuusus/kasdhwais/refs/heads/main/main";
const TOKEN_TTL   = 5 * 60;
const RATE_LIMIT  = 10;
const RATE_WINDOW = 60 * 1000;

const rateMap = new Map();
function checkRateLimit(key) {
    const now   = Date.now();
    const entry = rateMap.get(key) || { count: 0, windowStart: now };
    if (now - entry.windowStart > RATE_WINDOW) {
        entry.count       = 0;
        entry.windowStart = now;
    }
    entry.count++;
    rateMap.set(key, entry);
    return entry.count <= RATE_LIMIT;
}

const nonceCache   = new Map();
const NONCE_WINDOW = 30 * 1000;
const NONCE_LIMIT  = 3;
function checkNonce(userId) {
    const now   = Date.now();
    const entry = nonceCache.get(userId) || { lastSeen: now, count: 0 };
    if (now - entry.lastSeen > NONCE_WINDOW) {
        entry.count    = 0;
        entry.lastSeen = now;
    }
    entry.count++;
    nonceCache.set(userId, entry);
    return entry.count <= NONCE_LIMIT;
}

const ROBLOX_UA_PATTERN  = /Roblox|RobloxApp|RobloxStudio|RCC|HashLib/i;
const BROWSER_UA_PATTERN = /Mozilla\/5\.0.*(?:Chrome|Firefox|Safari|Edge|Edg|OPR|Opera)/;
function isAllowedAgent(ua) {
    if (!ua || ua.trim() === "")      return true;
    if (ROBLOX_UA_PATTERN.test(ua))  return true;
    if (BROWSER_UA_PATTERN.test(ua)) return false;
    return true;
}

function decodeLoaderToken(token) {
    try {
        const decoded = Buffer.from(token, "base64url").toString("utf8");
        const parts   = decoded.split(":");
        if (parts.length !== 3) return null;

        const [userId, bucket, hmac] = parts;
        const currentBucket = Math.floor(Date.now() / 1000 / TOKEN_TTL);

        const isValid = [currentBucket, currentBucket - 1].some(b => {
            const expected = crypto
                .createHmac("sha256", KEY_SECRET)
                .update(`${userId}:${b}`)
                .digest("hex")
                .slice(0, 24);
            return expected === hmac && String(b) === bucket;
        });

        return isValid ? userId : null;
    } catch {
        return null;
    }
}

function deriveEncKey(token) {
    return crypto
        .createHmac("sha256", KEY_SECRET)
        .update(token)
        .digest("hex")
        .slice(0, 16);
}

function encryptPayload(script, token) {
    const buf    = Buffer.from(script, "utf8");
    const keyBuf = Buffer.from(deriveEncKey(token), "utf8");
    const out    = Buffer.alloc(buf.length);
    for (let i = 0; i < buf.length; i++) {
        out[i] = buf[i] ^ keyBuf[i % keyBuf.length];
    }
    return out.toString("base64");
}

let scriptCache = null;
let cacheExpiry = 0;
const CACHE_TTL = 2 * 60 * 1000;
async function getCachedScript() {
    if (scriptCache && Date.now() < cacheExpiry) return scriptCache;
    scriptCache = await new Promise((resolve, reject) => {
        https.get(SCRIPT_URL, res => {
            if (res.statusCode !== 200) return reject(new Error(`GitHub ${res.statusCode}`));
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end",  ()    => resolve(data));
        }).on("error", reject);
    });
    cacheExpiry = Date.now() + CACHE_TTL;
    return scriptCache;
}

app.get("/hub", async (req, res) => {
    const token     = req.query.t;
    const userAgent = req.headers["user-agent"] || "";

    if (!isAllowedAgent(userAgent)) return res.status(403).send("403 Forbidden");

    const userId = decodeLoaderToken(token);
    if (!userId) return res.status(401).send("-- [J4rzz Hub] Invalid/expired token. Re-run /getscript.");

    if (!checkNonce(userId))    return res.status(429).send("-- [J4rzz Hub] Slow down.");
    if (!checkRateLimit(token)) return res.status(429).send("-- [J4rzz Hub] Rate limit hit.");

    try {
        const script    = await getCachedScript();
        const encrypted = encryptPayload(script, token);
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Cache-Control", "no-store");
        res.send(encrypted);
    } catch (err) {
        console.error("Script fetch error:", err.message);
        res.status(500).send("-- [J4rzz Hub] Failed to load. Try again.");
    }
});

app.use((req, res) => res.status(403).send("403 Forbidden"));

app.listen(PORT, () => console.log(`J4rzz Loader running on port ${PORT}`));
