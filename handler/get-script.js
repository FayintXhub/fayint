// --- handlers/getscript.js ---
const {
    SlashCommandBuilder, EmbedBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require("discord.js");
const crypto = require("crypto");

const LOADER_URL = process.env.LOADER_URL || "https://your-railway-url.up.railway.app/hub";
const KEY_SECRET = process.env.KEY_SECRET || "j4rzz-secret-ganti-ini";
const TOKEN_TTL  = 5 * 60;

function generateUserKey(userId) {
    return "J4-" + crypto
        .createHmac("sha256", KEY_SECRET)
        .update(userId)
        .digest("hex")
        .slice(0, 16);
}

function generateLoaderToken(userId) {
    const bucket  = Math.floor(Date.now() / 1000 / TOKEN_TTL);
    const payload = `${userId}:${bucket}`;
    const hmac    = crypto
        .createHmac("sha256", KEY_SECRET)
        .update(payload)
        .digest("hex")
        .slice(0, 24);
    return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

function deriveEncKey(token) {
    return crypto
        .createHmac("sha256", KEY_SECRET)
        .update(token)
        .digest("hex")
        .slice(0, 16);
}
function buildLoaderScript(userId) {
    const token  = generateLoaderToken(userId);
    const encKey = deriveEncKey(token);
    return `local HttpService = game:GetService("HttpService")
local url    = "${LOADER_URL}?t=${token}"
local encKey = "${encKey}"

local ok, res = pcall(function()
    return HttpService:RequestAsync({ Url = url, Method = "GET" })
end)
if not ok then warn("[J4rzz] Request error: " .. tostring(res)) return end
if not res.Success then warn("[J4rzz] HTTP " .. res.StatusCode .. ": " .. tostring(res.Body)) return end

local function xorByte(a, b)
    local result, bit = 0, 128
    while bit > 0 do
        local ab = a >= bit and 1 or 0
        local bb = b >= bit and 1 or 0
        if ab ~= bb then result = result + bit end
        if ab == 1 then a = a - bit end
        if bb == 1 then b = b - bit end
        bit = math.floor(bit / 2)
    end
    return result
end

local function b64decode(s)
    local chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    local lkup  = {}
    for i = 1, #chars do lkup[chars:sub(i,i)] = i - 1 end
    local result, bits, val = {}, 0, 0
    for i = 1, #s do
        local c = s:sub(i,i)
        if c == "=" then break end
        val  = val * 64 + (lkup[c] or 0)
        bits = bits + 6
        if bits >= 8 then
            bits = bits - 8
            local pow = 2 ^ bits
            local byte = math.floor(val / pow) % 256
            val = val % pow
            result[#result+1] = string.char(byte)
        end
    end
    return table.concat(result)
end

local function xorDecrypt(data, key)
    local out = {}
    for i = 1, #data do
        out[i] = string.char(xorByte(data:byte(i), key:byte(((i-1) % #key) + 1)))
    end
    return table.concat(out)
end

local ok2, decrypted = pcall(function()
    return xorDecrypt(b64decode(res.Body), encKey)
end)
if not ok2 then warn("[J4rzz] Decrypt error: " .. tostring(decrypted)) return end

local fn, err = loadstring(decrypted)
if not fn then warn("[J4rzz] Loadstring error: " .. tostring(err)) return end

local ok3, err3 = pcall(fn)
if not ok3 then warn("[J4rzz] Script error: " .. tostring(err3)) end`;
}

const command = new SlashCommandBuilder()
    .setName("setupgetscript")
    .setDescription("Kirim embed script J4RZZ Hub");

function buildMainEmbed() {
    return new EmbedBuilder()
        .setTitle("ðŸš€ J4RZZ Hub â€” Script Loader")
        .setColor(0x5865f2)
        .setDescription(
            "## Selamat Datang di **J4RZZ Hub**!\n" +
            "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n" +
            "### ðŸ“Œ Cara Mendapatkan Script\n" +
            "**1.** Pilih device lo â€” **PC** atau **Mobile**\n" +
            "**2.** Download file `.lua` yang muncul\n" +
            "**3.** Buka di notepad, paste isinya ke executor!\n\n" +
            "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n" +
            "### âš ï¸ Perhatian\n" +
            "> â€¢ Key bersifat **personal**, jangan dibagikan\n" +
            "> â€¢ Script URL **expired dalam 5 menit** â€” re-run kalau expired\n\n" +
            "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
        )
        .setFooter({ text: "J4RZZ Hub â€¢ v2.0" })
        .setTimestamp();
}

function buildPCEmbed(userId) {
    const userKey = generateUserKey(userId);
    return new EmbedBuilder()
        .setTitle("J4 - Script Loader")
        .setColor(0x00d4ff)
        .setDescription(
            "## âœ… Script PC berhasil didapat!\n" +
            "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”\n\n" +
            "> âš ï¸ **Key lo bersifat personal** â€” jangan kasih ke orang lain!\n" +
            "> â±ï¸ **URL expired dalam 5 menit** â€” run ulang `/getscript` kalau expired\n" +
            "> ðŸ“„ **Download file `.lua` di bawah, paste isinya ke executor**\n\n" +
            "â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”"
        )
        .addFields(
            { name: "ðŸ”‘ Key", value: `\`${userKey}\``, inline: false }
        )
        .setFooter({ text: "J4RZZ Hub â€¢ v2.0" })
        .setTimestamp();
}

function buildMainButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("getscript_pc")
            .setLabel("ðŸ’» PC Script")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId("getscript_mobile")
            .setLabel("ðŸ“± Mobile Script")
            .setStyle(ButtonStyle.Secondary)
    );
}

module.exports = {
    command,
    async executeCommand(interaction) {
        const OWNER_ID = process.env.OWNER_ID || "";
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: "âŒ No permission.", ephemeral: true });
        }
        await interaction.reply({ embeds: [buildMainEmbed()], components: [buildMainButtons()] });
    },
    async executeButton(interaction) {
        const userId = interaction.user.id;
        const loader = buildLoaderScript(userId);

        if (interaction.customId === "getscript_pc") {
            return interaction.reply({
                embeds: [buildPCEmbed(userId)],
                files: [{
                    attachment: Buffer.from(loader, "utf8"),
                    name: "j4rzz_loader.lua",
                }],
                ephemeral: true,
            });
        }
        if (interaction.customId === "getscript_mobile") {
            return interaction.reply({
                content: "ðŸ“± **Script Mobile lo** â€” download file di bawah, paste isinya ke executor.",
                files: [{
                    attachment: Buffer.from(loader, "utf8"),
                    name: "j4rzz_loader.lua",
                }],
                ephemeral: true,
            });
        }
    },
};
