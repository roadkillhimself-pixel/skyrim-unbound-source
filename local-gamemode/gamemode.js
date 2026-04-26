if (globalThis.__skrpGamemodeLoaded) {
    console.log("[gamemode] SK:RP reload detected; re-registering handlers.");
}
globalThis.__skrpGamemodeLoaded = true;

console.log("[gamemode] Loading...");

const fs = require("fs");
const path = require("path");
let DatabaseSync = null;
try {
    DatabaseSync = require("node:sqlite").DatabaseSync;
} catch (e) {
    console.log("[gamemode] node:sqlite unavailable, witnessed chat logging disabled:", e);
}

const INVALID_USER_ID = 65535;
const SAY_RADIUS = 800;
const LOW_RADIUS = 220;
const LOWER_RADIUS = 110;
const OOC_RADIUS = 1000;
const SHOUT_RADIUS = 3200;
const EMOTE_COLOR = "#c08ad0";
const AME_DURATION_MS = 7000;
const AME_MAX_LENGTH = 96;
const AME_MAX_LINE_LENGTH = 42;
const AME_MAX_LINES = 3;
const OOC_CHAT_COLOR = "#ffffff";
const NATIVE_CHAT_FONT = "DIN-Pro-bold";
const NATIVE_CHAT_GLYPH_METRICS = {
    32: [19, 1, -12], 33: [7, 5, -2], 34: [6, 10, -3], 35: [5, 18, -3], 36: [4, 17, -3],
    37: [5, 22, -2], 38: [5, 20, -4], 39: [6, 4, -2], 40: [6, 7, -3], 41: [5, 7, -2],
    42: [5, 12, -3], 43: [5, 14, -3], 44: [6, 5, -3], 45: [5, 10, -3], 46: [6, 5, -3],
    47: [4, 12, -4], 48: [5, 14, -3], 49: [7, 8, 1], 50: [5, 14, -3], 51: [5, 14, -3],
    52: [5, 14, -3], 53: [5, 14, -3], 54: [5, 14, -3], 55: [5, 14, -3], 56: [5, 14, -3],
    57: [5, 14, -3], 58: [6, 5, -2], 59: [6, 5, -2], 60: [6, 12, -2], 61: [5, 14, -3],
    62: [6, 12, -2], 63: [6, 13, -4], 64: [5, 20, -3], 65: [4, 19, -4], 66: [6, 16, -3],
    67: [5, 16, -3], 68: [6, 16, -3], 69: [6, 14, -2], 70: [6, 14, -3], 71: [5, 16, -2],
    72: [6, 16, -2], 73: [6, 5, -2], 74: [4, 13, -2], 75: [6, 17, -4], 76: [6, 14, -3],
    77: [6, 19, -1], 78: [6, 17, -2], 79: [5, 16, -2], 80: [6, 16, -4], 81: [5, 17, -3],
    82: [6, 16, -3], 83: [4, 16, -3], 84: [4, 16, -3], 85: [6, 16, -3], 86: [4, 17, -4],
    87: [4, 26, -4], 88: [4, 18, -5], 89: [4, 17, -4], 90: [5, 14, -3], 91: [6, 8, -3],
    92: [4, 12, -4], 93: [5, 8, -2], 94: [5, 15, -3], 95: [4, 18, -5], 96: [7, 6, 2],
    97: [5, 13, -3], 98: [6, 13, -3], 99: [5, 12, -3], 100: [5, 14, -3], 101: [5, 14, -3],
    102: [5, 9, -4], 103: [5, 13, -2], 104: [6, 13, -2], 105: [6, 4, -2], 106: [3, 7, -2],
    107: [6, 14, -4], 108: [6, 7, -4], 109: [6, 22, -3], 110: [6, 13, -2], 111: [5, 14, -3],
    112: [6, 13, -3], 113: [5, 14, -3], 114: [6, 12, -5], 115: [4, 14, -3], 116: [4, 9, -3],
    117: [6, 13, -2], 118: [4, 15, -5], 119: [4, 22, -4], 120: [4, 15, -4], 121: [4, 15, -5],
    122: [5, 12, -3], 123: [5, 11, -3], 124: [7, 4, -1], 125: [5, 11, -3], 126: [5, 16, -3]
};
const CHATLOG_RETENTION_DAYS = 7;
const CHAT_USER_SETTINGS_FILE = path.join(process.cwd(), "skrp-chat-user-settings.json");
const RP_SCENE_STORE_FILE = path.join(process.cwd(), "skrp-scenes.json");
const RP_SCENE_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const RP_SCENE_TRIGGER_RADIUS = 90;
const RP_SCENE_RENDER_RADIUS = 4200;
const RP_SCENE_CHECK_TICK_MS = 1500;
const RP_SCENE_TEXT_MAX_LENGTH = 240;
const RP_SCENE_MARKER_Z_OFFSET = 92;
const RP_SCENE_MARKER_COLOR = [1, 0.86, 0.34, 0.96];
const CHAT_DEFAULT_VERSION = 2;
const CHAT_SETTINGS = {
    left: 32,
    top: 38,
    width: 2000,
    inputWidth: 800,
    visibleLines: 9,
    historyLines: 60,
    fontSize: 40,
    inputFontSize: 41,
    lineHeight: 47,
    inputGap: 14
};
const CHAT_SETTING_LIMITS = {
    fontSize: { min: 25, max: 50 },
    visibleLines: { min: 3, max: 18 },
    width: { min: 360, max: 2000 }
};

let chatMessageSeq = 0;
let ameTextSeq = 0;
const userChatSettings = {};
const userChatSettingKeys = {};
globalThis.__skrpRecentChatSubmits = globalThis.__skrpRecentChatSubmits || {};
const recentChatSubmits = globalThis.__skrpRecentChatSubmits;
globalThis.__skrpRecentOutgoingChat = globalThis.__skrpRecentOutgoingChat || {};
const recentOutgoingChat = globalThis.__skrpRecentOutgoingChat;
globalThis.__skrpLastChatPayloadByActor = globalThis.__skrpLastChatPayloadByActor || {};
const lastChatPayloadByActor = globalThis.__skrpLastChatPayloadByActor;
globalThis.__skrpLastAmePayloadByActor = globalThis.__skrpLastAmePayloadByActor || {};
const lastAmePayloadByActor = globalThis.__skrpLastAmePayloadByActor;
globalThis.__skrpChatTypingStateByUser = globalThis.__skrpChatTypingStateByUser || {};
const chatTypingStateByUser = globalThis.__skrpChatTypingStateByUser;
globalThis.__skrpChatUiReadyByUser = globalThis.__skrpChatUiReadyByUser || {};
const chatUiReadyByUser = globalThis.__skrpChatUiReadyByUser;
globalThis.__skrpRoleplayScenes = Array.isArray(globalThis.__skrpRoleplayScenes)
    ? globalThis.__skrpRoleplayScenes
    : loadPersistedRoleplayScenes();
const roleplayScenes = globalThis.__skrpRoleplayScenes;
globalThis.__skrpRoleplayScenePresenceByUser = globalThis.__skrpRoleplayScenePresenceByUser || {};
const roleplayScenePresenceByUser = globalThis.__skrpRoleplayScenePresenceByUser;
globalThis.__skrpLastRoleplayScenePayloadByActor = globalThis.__skrpLastRoleplayScenePayloadByActor || {};
const lastRoleplayScenePayloadByActor = globalThis.__skrpLastRoleplayScenePayloadByActor;
let roleplaySceneSeq = Math.max(
    Number(globalThis.__skrpRoleplaySceneSeq || 0),
    getMaxRoleplaySceneId(roleplayScenes)
);
globalThis.__skrpRoleplaySceneSeq = roleplaySceneSeq;
const SERVER_SETTINGS = readServerSettings();
const ENABLE_WITNESSED_CHAT_LOG = SERVER_SETTINGS.enableWitnessedChatLog === true;
const CHATLOG_DB_PATH = resolveUcpDbPath();

let chatLogDb = null;
let insertWitnessedChatLogStmt = null;
let pruneWitnessedChatLogStmt = null;
let lastWitnessedChatPruneAt = 0;
let ucpAdminDb = null;
const ADMIN_DUTY_COLOR = "#4e9a66";
const ADMIN_DUTY_RGBA = [0.31, 0.6, 0.4, 0.96];
const ADMIN_DEFAULT_CHAT_COLOR = "#f8f2df";
const ADMIN_PANEL_RATE_LIMIT_MS = 1500;
const ADMIN_CACHE_TTL_MS = 10000;
const ADMIN_FREEZE_TICK_MS = 900;
const ADMIN_GODMODE_TICK_MS = 750;
const ADMIN_HEAL_RADIUS_DEFAULT = 800;
const ADMIN_HEAL_RADIUS_MAX = 10000;
const ADMIN_ACTOR_VALUE_MAX = 9999;
const ADMIN_ITEM_CATALOG_LIMIT = 12000;
const ADMIN_ITEM_TYPES = {
    ALCH: "Alchemy",
    AMMO: "Ammo",
    ARMO: "Armor",
    BOOK: "Book",
    INGR: "Ingredient",
    KEYM: "Key",
    LIGH: "Light",
    MISC: "Misc",
    SCRL: "Scroll",
    SLGM: "Soul Gem",
    WEAP: "Weapon"
};
const CHANGE_CHARACTER_PACKET_TYPE = "changeCharacterSelection";
const CHANGE_CHARACTER_COOLDOWN_MS = 60000;
const onlineUsers = {};
const adminCacheByUser = {};
const adminDutyByUser = {};
const adminLastActionByUser = {};
const changeCharacterCooldownByUser = {};
const frozenUsers = {};
const adminInvisibleByUser = {};
let adminItemCatalogCache = null;
const ADMIN_COMMANDS = [
    { name: "admin", usage: "/admin", description: "Open your staff command panel.", permission: "panel.access" },
    { name: "adminhelp", usage: "/adminhelp", description: "Show staff commands available to your rank.", permission: "panel.access" },
    { name: "aduty", usage: "/aduty", description: "Toggle staff duty mode, public staff identity, and duty godmode.", permission: "panel.access" },
    { name: "a", usage: "/a <message>", description: "Send an internal staff chat message.", permission: "panel.access" },
    { name: "asay", usage: "/asay <message>", description: "Send an internal staff chat message.", permission: "panel.access" },
    { name: "goto", usage: "/goto <id>", description: "Teleport to a player.", permission: "teleport.force", dutyOnly: true },
    { name: "bring", usage: "/bring <id>", description: "Bring a player to you.", permission: "teleport.force", dutyOnly: true },
    { name: "freeze", usage: "/freeze <id>", description: "Freeze a player in place.", permission: "moderation.freeze", dutyOnly: true },
    { name: "unfreeze", usage: "/unfreeze <id>", description: "Unfreeze a player.", permission: "moderation.freeze", dutyOnly: true },
    { name: "akick", usage: "/akick <id> [reason]", description: "Kick a player from the server.", permission: "moderation.kick", dutyOnly: true },
    { name: "heal", usage: "/heal <id|me>", description: "Fully heal one player.", permission: "inventory.restore", dutyOnly: true },
    { name: "healall", usage: "/healall <radius>", description: "Fully heal nearby players in a radius.", permission: "inventory.restore", dutyOnly: true },
    { name: "revive", usage: "/revive <id|me>", description: "Revive and heal one player.", permission: "inventory.restore", dutyOnly: true },
    { name: "sethp", usage: "/sethp <id|me> <1-9999>", description: "Set a player's health value.", permission: "inventory.restore", dutyOnly: true },
    { name: "setstamina", usage: "/setstamina <id|me> <0-9999>", description: "Set a player's stamina value.", permission: "inventory.restore", dutyOnly: true },
    { name: "giveitem", usage: "/giveitem <id|me> <formId|editorId> [count]", description: "Spawn an item into a player's inventory.", permission: "inventory.restore", dutyOnly: true },
    { name: "invisible", usage: "/invisible", description: "Toggle invisible observer mode with collision disabled.", permission: "teleport.force", dutyOnly: true },
    { name: "checkscene", usage: "/checkscene <id>", description: "List a player's active RP scenes.", permission: "scene.moderate" },
    { name: "editscene", usage: "/editscene <id> <text>", description: "Edit any active RP scene.", permission: "scene.moderate" },
    { name: "deletescene", usage: "/deletescene <id> confirm", description: "Delete any active RP scene.", permission: "scene.moderate" },
    { name: "areloadadmins", usage: "/areloadadmins", description: "Reload staff permissions from the UCP database.", permission: "staff.roles.assign" },
    { name: "setadmin", usage: "/setadmin <id|username> <role_code> [note]", description: "Grant a UCP staff role.", permission: "staff.roles.assign" },
    { name: "removeadmin", usage: "/removeadmin <id|username> [role_code]", description: "Revoke UCP staff roles.", permission: "staff.roles.assign" }
];

let persistedChatSettings = {};
try {
    if (fs.existsSync(CHAT_USER_SETTINGS_FILE)) {
        persistedChatSettings = JSON.parse(fs.readFileSync(CHAT_USER_SETTINGS_FILE, "utf8")) || {};
    }
} catch (e) {
    console.log("[gamemode] Failed to load chat user settings:", e);
    persistedChatSettings = {};
}

function readServerSettings() {
    try {
        const settingsPath = path.join(process.cwd(), "server-settings.json");
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, "utf8");
            return JSON.parse(raw) || {};
        }
    } catch (e) {
        console.log("[gamemode] Failed to read server settings:", e);
    }

    return {};
}

function resolveUcpDbPath() {
    try {
        if (SERVER_SETTINGS && typeof SERVER_SETTINGS.ucpDbPath === "string" && SERVER_SETTINGS.ucpDbPath.trim()) {
            return path.isAbsolute(SERVER_SETTINGS.ucpDbPath)
                ? SERVER_SETTINGS.ucpDbPath
                : path.resolve(process.cwd(), SERVER_SETTINGS.ucpDbPath);
        }
    } catch (e) {
        console.log("[gamemode] Failed to resolve custom UCP DB path, falling back to default:", e);
    }

    return path.resolve(process.cwd(), "ucp", "skyrim-unbound-ucp.sqlite");
}

function ensureWitnessedChatLogStore() {
    if (!ENABLE_WITNESSED_CHAT_LOG) return null;
    if (!DatabaseSync) return null;
    if (chatLogDb) return chatLogDb;

    try {
        fs.mkdirSync(path.dirname(CHATLOG_DB_PATH), { recursive: true });
        chatLogDb = new DatabaseSync(CHATLOG_DB_PATH);
        chatLogDb.exec("PRAGMA journal_mode = WAL");
        chatLogDb.exec(`
            CREATE TABLE IF NOT EXISTS character_chatlog_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                witness_profile_id INTEGER NOT NULL,
                speaker_profile_id INTEGER,
                speaker_name TEXT NOT NULL,
                message_text TEXT NOT NULL,
                chat_kind TEXT NOT NULL,
                radius INTEGER NOT NULL,
                color TEXT,
                world_desc TEXT,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_character_chatlog_entries_witness_time
            ON character_chatlog_entries(witness_profile_id, created_at DESC, id DESC);

            CREATE INDEX IF NOT EXISTS idx_character_chatlog_entries_created_at
            ON character_chatlog_entries(created_at);
        `);

        insertWitnessedChatLogStmt = chatLogDb.prepare(`
            INSERT INTO character_chatlog_entries (
                witness_profile_id,
                speaker_profile_id,
                speaker_name,
                message_text,
                chat_kind,
                radius,
                color,
                world_desc,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        pruneWitnessedChatLogStmt = chatLogDb.prepare(`
            DELETE FROM character_chatlog_entries
            WHERE created_at < ?
        `);
    } catch (e) {
        console.log("[gamemode] Failed to initialize witnessed chat logging:", e);
        chatLogDb = null;
        insertWitnessedChatLogStmt = null;
        pruneWitnessedChatLogStmt = null;
    }

    return chatLogDb;
}

function ensureUcpAdminStore() {
    if (!DatabaseSync) return null;
    if (ucpAdminDb) return ucpAdminDb;

    let db = null;
    try {
        fs.mkdirSync(path.dirname(CHATLOG_DB_PATH), { recursive: true });
        db = new DatabaseSync(CHATLOG_DB_PATH);
        db.exec("PRAGMA journal_mode = WAL");
        db.exec(`
            CREATE TABLE IF NOT EXISTS staff_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL UNIQUE,
                rank_value INTEGER NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                panel_access INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS staff_permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                category TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS staff_role_permissions (
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                PRIMARY KEY (role_id, permission_id)
            );

            CREATE TABLE IF NOT EXISTS account_staff_roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                role_id INTEGER NOT NULL,
                granted_by_account_id INTEGER,
                note TEXT,
                created_at TEXT NOT NULL,
                valid_until TEXT,
                revoked_at TEXT,
                revoked_by_account_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS account_permission_overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                is_granted INTEGER NOT NULL,
                reason TEXT NOT NULL,
                granted_by_account_id INTEGER,
                created_at TEXT NOT NULL,
                revoked_at TEXT,
                revoked_by_account_id INTEGER
            );

            CREATE TABLE IF NOT EXISTS admin_audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_account_id INTEGER,
                actor_role_snapshot TEXT,
                action_code TEXT NOT NULL,
                target_account_id INTEGER,
                target_character_id INTEGER,
                ticket_id INTEGER,
                application_submission_id INTEGER,
                moderation_case_id INTEGER,
                remote_ip TEXT,
                details_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created
            ON admin_audit_events(created_at DESC);
        `);
        ucpAdminDb = db;
    } catch (e) {
        console.log("[gamemode] Failed to initialize UCP admin DB:", e);
        if (db) {
            try {
                db.close();
            } catch (closeError) {}
        }
        ucpAdminDb = null;
    }

    return ucpAdminDb;
}

function dbGet(db, sql, params) {
    try {
        const statement = db.prepare(sql);
        return statement.get.apply(statement, params || []);
    } catch (e) {
        console.log("[gamemode] Database read failed:", e);
        return null;
    }
}

function dbAll(db, sql, params) {
    try {
        const statement = db.prepare(sql);
        return statement.all.apply(statement, params || []);
    } catch (e) {
        console.log("[gamemode] Database list failed:", e);
        return [];
    }
}

function dbRun(db, sql, params) {
    try {
        const statement = db.prepare(sql);
        return statement.run.apply(statement, params || []);
    } catch (e) {
        console.log("[gamemode] Database write failed:", e);
        return null;
    }
}

function nowIso() {
    return new Date().toISOString();
}

function normalizeRoleCode(roleCode) {
    return String(roleCode || "").trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
}

function normalizeAccountSearch(raw) {
    return String(raw || "").trim();
}

function rateLimit(userId, bucket, cooldownMs) {
    const key = String(userId) + ":" + bucket;
    const now = Date.now();
    if (adminLastActionByUser[key] && now - adminLastActionByUser[key] < cooldownMs) {
        return true;
    }
    adminLastActionByUser[key] = now;
    return false;
}

function getActorProfileIdSafe(actorId) {
    try {
        return getActorProfileId(actorId);
    } catch (e) {
        return null;
    }
}

function getUserProfileId(userId) {
    const actorId = mp.getUserActor(userId);
    return getActorProfileIdSafe(actorId);
}

function getAccountByProfileId(profileId) {
    const db = ensureUcpAdminStore();
    if (!db || !profileId) return null;

    return dbGet(db, `
        SELECT
            a.id AS account_id,
            a.username AS username,
            c.id AS character_id,
            c.name AS character_name,
            c.profile_id AS profile_id
        FROM characters c
        JOIN accounts a ON a.id = c.account_id
        WHERE c.profile_id = ?
        LIMIT 1
    `, [profileId]);
}

function getAccountByUserId(userId) {
    const actorId = mp.getUserActor(userId);
    const profileId = getActorProfileIdSafe(actorId);
    if (!profileId) return null;
    return getAccountByProfileId(profileId);
}

function getRoleByCode(roleCode) {
    const db = ensureUcpAdminStore();
    if (!db) return null;
    return dbGet(db, `
        SELECT id, code, name, rank_value
        FROM staff_roles
        WHERE code = ?
        LIMIT 1
    `, [normalizeRoleCode(roleCode)]);
}

function getStaffSummaryForAccount(accountId) {
    const db = ensureUcpAdminStore();
    if (!db || !accountId) {
        return { rankValue: 0, roles: [], permissions: [] };
    }

    const rows = dbAll(db, `
        SELECT DISTINCT sr.id, sr.code, sr.name, sr.rank_value
        FROM account_staff_roles asr
        JOIN staff_roles sr ON sr.id = asr.role_id
        WHERE asr.account_id = ?
          AND asr.revoked_at IS NULL
          AND (asr.valid_until IS NULL OR asr.valid_until = '' OR asr.valid_until > ?)
        ORDER BY sr.rank_value DESC
    `, [accountId, nowIso()]);

    const permissions = {};
    rows.forEach(function(role) {
        const permissionRows = dbAll(db, `
            SELECT p.code
            FROM staff_role_permissions rp
            JOIN staff_permissions p ON p.id = rp.permission_id
            WHERE rp.role_id = ?
        `, [role.id]);
        permissionRows.forEach(function(row) {
            permissions[row.code] = true;
        });
    });

    const overrides = dbAll(db, `
        SELECT p.code, apo.is_granted
        FROM account_permission_overrides apo
        JOIN staff_permissions p ON p.id = apo.permission_id
        WHERE apo.account_id = ? AND apo.revoked_at IS NULL
    `, [accountId]);
    overrides.forEach(function(row) {
        if (Number(row.is_granted) === 1) {
            permissions[row.code] = true;
        } else {
            delete permissions[row.code];
        }
    });

    return {
        rankValue: rows.length ? Number(rows[0].rank_value) : 0,
        roles: rows.map(function(role) {
            return {
                id: Number(role.id),
                code: String(role.code),
                name: String(role.name),
                rankValue: Number(role.rank_value)
            };
        }),
        permissions: Object.keys(permissions).sort()
    };
}

function getAdminInfo(userId, force) {
    const cache = adminCacheByUser[userId];
    if (!force && cache && Date.now() - cache.cachedAt < ADMIN_CACHE_TTL_MS) {
        return cache.admin;
    }

    const account = getAccountByUserId(userId);
    if (!account) {
        adminCacheByUser[userId] = { cachedAt: Date.now(), admin: null };
        adminDutyByUser[userId] = false;
        clearAdminInvisibleState(userId);
        return null;
    }

    const staff = getStaffSummaryForAccount(Number(account.account_id));
    if (!staff.roles.length || staff.permissions.indexOf("panel.access") === -1) {
        adminCacheByUser[userId] = { cachedAt: Date.now(), admin: null };
        adminDutyByUser[userId] = false;
        clearAdminInvisibleState(userId);
        return null;
    }

    const admin = {
        userId: Number(userId),
        accountId: Number(account.account_id),
        characterId: Number(account.character_id),
        profileId: Number(account.profile_id),
        username: String(account.username || "Staff"),
        characterName: String(account.character_name || getDisplayName(mp.getUserActor(userId))),
        role: staff.roles[0],
        roles: staff.roles,
        rankValue: staff.rankValue,
        permissions: staff.permissions
    };

    adminCacheByUser[userId] = { cachedAt: Date.now(), admin: admin };
    return admin;
}

function hasPermission(admin, permissionCode) {
    return !!(admin && admin.permissions && admin.permissions.indexOf(permissionCode) !== -1);
}

function getUserPingValue(userId) {
    const methods = ["getUserPing", "getPing", "getUserLatency"];

    for (let i = 0; i < methods.length; i++) {
        const methodName = methods[i];
        try {
            if (typeof mp[methodName] === "function") {
                const ping = Number(mp[methodName](userId));
                if (isFinite(ping) && ping >= 0) {
                    return Math.round(ping);
                }
            }
        } catch (e) {}
    }

    try {
        if (typeof mp.getPrometheusMetrics === "function") {
            const metrics = String(mp.getPrometheusMetrics() || "");
            const escapedUserId = String(userId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const pattern = new RegExp("skymp_server_ping_per_slot_seconds\\{[^}]*networking_user_id=\"" + escapedUserId + "\"[^}]*\\}\\s+([0-9.]+)");
            const match = metrics.match(pattern);
            if (match) {
                const seconds = Number(match[1]);
                if (isFinite(seconds) && seconds >= 0) {
                    return Math.round(seconds * 1000);
                }
            }
        }
    } catch (e) {}

    return null;
}

function getMinimumRoleForPermission(permissionCode) {
    if (!permissionCode) return null;

    const db = ensureUcpAdminStore();
    if (!db) return null;

    const row = dbGet(db, `
        SELECT sr.code, sr.name, sr.rank_value
        FROM staff_roles sr
        JOIN staff_role_permissions rp ON rp.role_id = sr.id
        JOIN staff_permissions p ON p.id = rp.permission_id
        WHERE p.code = ?
        ORDER BY sr.rank_value ASC
        LIMIT 1
    `, [permissionCode]);

    if (!row) return null;

    return {
        code: String(row.code),
        name: String(row.name),
        rankValue: Number(row.rank_value)
    };
}

function getAvailableAdminCommands(admin) {
    if (!admin) return [];

    return ADMIN_COMMANDS
        .filter(function(command) {
            return command.public || !command.permission || hasPermission(admin, command.permission);
        })
        .map(function(command) {
            const minimumRole = command.permission ? getMinimumRoleForPermission(command.permission) : null;
            return {
                name: command.name,
                usage: command.usage,
                description: command.description,
                permission: command.permission || null,
                dutyOnly: command.dutyOnly === true,
                public: command.public === true,
                minimumRole: minimumRole
            };
        });
}

function requireAdmin(userId, permissionCode, options) {
    options = options || {};
    const admin = getAdminInfo(userId, !!options.forceRefresh);
    if (!admin) {
        sendChatMessage(userId, "You are not authorized to use this staff command.", "#d56b6b");
        return null;
    }

    if (permissionCode && !hasPermission(admin, permissionCode)) {
        sendChatMessage(userId, "You do not have permission for this command.", "#d56b6b");
        return null;
    }

    if (options.dutyOnly && !adminDutyByUser[userId]) {
        sendChatMessage(userId, "You must be on duty first. Use /aduty.", "#d3a34d");
        return null;
    }

    return admin;
}

function writeAdminAudit(actorAdmin, actionCode, details, targetAccountId, targetCharacterId) {
    const db = ensureUcpAdminStore();
    if (!db || !actorAdmin) return;

    dbRun(db, `
        INSERT INTO admin_audit_events (
            actor_account_id,
            actor_role_snapshot,
            action_code,
            target_account_id,
            target_character_id,
            details_json,
            created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        actorAdmin.accountId,
        actorAdmin.role ? actorAdmin.role.name : "STAFF",
        actionCode,
        targetAccountId || null,
        targetCharacterId || null,
        JSON.stringify(details || {}),
        nowIso()
    ]);
}

function rememberOnlineUser(userId, actorId) {
    if (typeof userId !== "number" || userId === INVALID_USER_ID) {
        return false;
    }

    try {
        const resolvedActorId = actorId || mp.getUserActor(userId);
        if (!resolvedActorId) {
            return false;
        }
    } catch (e) {
        return false;
    }

    onlineUsers[userId] = true;
    return true;
}

function getOnlineUserIds() {
    const candidates = {};
    [
        onlineUsers,
        adminDutyByUser,
        adminCacheByUser,
        chatUiReadyByUser,
        userChatSettings,
        chatTypingStateByUser
    ].forEach(function(store) {
        Object.keys(store || {}).forEach(function(key) {
            const userId = Number(key);
            if (isFinite(userId) && userId !== INVALID_USER_ID) {
                candidates[userId] = true;
            }
        });
    });

    return Object.keys(candidates)
        .map(function(key) { return Number(key); })
        .filter(function(userId) {
            return rememberOnlineUser(userId);
        });
}

function findUserById(raw) {
    const normalized = String(raw || "").trim();
    if (!/^\d+$/.test(normalized)) return null;

    const targetUserId = parseInt(normalized, 10);
    if (!onlineUsers[targetUserId]) return null;
    try {
        const actorId = mp.getUserActor(targetUserId);
        if (!actorId) return null;
    } catch (e) {
        return null;
    }
    return targetUserId;
}

function getAuditTargetByUserId(userId) {
    const account = getAccountByUserId(userId);
    if (!account) {
        return { accountId: null, characterId: null };
    }

    return {
        accountId: Number(account.account_id),
        characterId: Number(account.character_id)
    };
}

function canAdminAffectUser(admin, actorUserId, targetUserId, actionLabel, options) {
    options = options || {};
    if (!admin) return false;

    if (targetUserId === actorUserId) {
        if (!options.allowSelf) {
            sendChatMessage(actorUserId, "You cannot " + actionLabel + " yourself.", "#d56b6b");
            return false;
        }
        return true;
    }

    const targetAdmin = getAdminInfo(targetUserId, true);
    if (!targetAdmin) return true;

    if (Number(targetAdmin.rankValue) >= Number(admin.rankValue)) {
        if (!options.silent) {
            const targetRole = targetAdmin.role ? targetAdmin.role.name : "Staff";
            sendChatMessage(actorUserId, "You cannot " + actionLabel + " " + targetAdmin.username + " (" + targetRole + ") because their staff rank is equal or higher.", "#d56b6b");
        }
        return false;
    }

    return true;
}

function safeGetUserActor(userId) {
    try {
        return mp.getUserActor(userId) || 0;
    } catch (e) {
        return 0;
    }
}

function findTargetUserForAdminCommand(raw, actorUserId) {
    const normalized = String(raw || "").trim().toLowerCase();
    if (normalized === "me" || normalized === "self") {
        return actorUserId;
    }
    return findUserById(raw);
}

function clampPercent(value, fallback) {
    const parsed = Number(value);
    if (!isFinite(parsed)) return fallback;
    return Math.max(0, Math.min(1, parsed));
}

function parseActorValueArgument(raw, minValue) {
    const text = String(raw || "").trim().toLowerCase();
    if (!text) return null;
    if (text === "full" || text === "max") return ADMIN_ACTOR_VALUE_MAX;

    const value = Math.round(Number(text));
    if (!isFinite(value)) return null;
    return Math.max(minValue, Math.min(ADMIN_ACTOR_VALUE_MAX, value));
}

function getActorPercentages(actorId) {
    try {
        const current = mp.get(actorId, "percentages") || {};
        return {
            health: clampPercent(current.health, 1),
            magicka: clampPercent(current.magicka, 1),
            stamina: clampPercent(current.stamina, 1)
        };
    } catch (e) {
        return { health: 1, magicka: 1, stamina: 1 };
    }
}

function setActorPercentages(actorId, values) {
    const current = getActorPercentages(actorId);
    const next = {
        health: values.health === undefined ? current.health : clampPercent(values.health, current.health),
        magicka: values.magicka === undefined ? current.magicka : clampPercent(values.magicka, current.magicka),
        stamina: values.stamina === undefined ? current.stamina : clampPercent(values.stamina, current.stamina)
    };
    mp.set(actorId, "percentages", next);
    return next;
}

function setActorValueDirect(actorId, statName, value) {
    if (statName === "health" && value > 0) {
        reviveActor(actorId);
    }

    const actor = { type: "form", desc: mp.getDescFromId(actorId) };
    const actorValueName = statName === "health" ? "Health" : "Stamina";
    mp.callPapyrusFunction("method", "Actor", "SetActorValue", actor, [actorValueName, value]);

    const patch = {};
    patch[statName] = value > 0 ? 1 : 0;
    setActorPercentages(actorId, patch);
}

function setActorRespawnFull(actorId) {
    try {
        mp.set(actorId, "respawnPercentages", {
            health: 1,
            magicka: 1,
            stamina: 1
        });
    } catch (e) {}
}

function reviveActor(actorId) {
    setActorRespawnFull(actorId);
    try {
        mp.set(actorId, "isDead", false);
    } catch (e) {}
}

function healActor(actorId, revive) {
    if (revive) {
        reviveActor(actorId);
    } else {
        setActorRespawnFull(actorId);
    }
    setActorPercentages(actorId, {
        health: 1,
        magicka: 1,
        stamina: 1
    });
}

function protectAdminDutyActor(userId) {
    if (!adminDutyByUser[userId]) return false;

    const actorId = safeGetUserActor(userId);
    if (!actorId) return false;

    try {
        if (mp.get(actorId, "isDead")) {
            reviveActor(actorId);
        }
    } catch (e) {}

    setActorRespawnFull(actorId);
    setActorPercentages(actorId, {
        health: 1
    });
    return true;
}

function setAdminInvisible(userId, enabled) {
    if (enabled) {
        adminInvisibleByUser[userId] = true;
    } else {
        delete adminInvisibleByUser[userId];
    }

    const actorId = safeGetUserActor(userId);
    if (!actorId) return false;

    mp.set(actorId, "rp_adminStealth", enabled ? "1" : "0");
    refreshAdminPresentation(userId);
    return true;
}

function clearAdminInvisibleState(userId) {
    delete adminInvisibleByUser[userId];
    const actorId = safeGetUserActor(userId);
    if (!actorId) return;

    try {
        mp.set(actorId, "rp_adminStealth", "0");
    } catch (e) {}
}

function formatFormId(formId) {
    const parsed = Number(formId);
    if (!isFinite(parsed)) return "0x00000000";
    return "0x" + ((parsed >>> 0).toString(16).padStart(8, "0"));
}

function parseFormIdInput(raw) {
    const text = String(raw || "").trim();
    if (!text) return null;

    try {
        if (text.indexOf(":") !== -1 && typeof mp.getIdFromDesc === "function") {
            const fromDesc = Number(mp.getIdFromDesc(text));
            if (isFinite(fromDesc)) return fromDesc >>> 0;
        }
    } catch (e) {}

    const normalized = text.toLowerCase().replace(/^0x/, "");
    if (!/^[0-9a-f]{1,8}$/.test(normalized)) return null;

    const parsed = parseInt(normalized, 16);
    return isFinite(parsed) ? (parsed >>> 0) : null;
}

function cleanRecordText(value) {
    const text = String(value || "")
        .replace(/\u0000.*$/g, "")
        .replace(/[^\x20-\x7e]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!/[A-Za-z0-9]/.test(text)) return "";
    return text.length > 96 ? text.slice(0, 96).trim() : text;
}

function decodeRecordFieldData(data) {
    try {
        if (data === undefined || data === null) return "";
        if (typeof data === "string") return cleanRecordText(data);
        if (Buffer.isBuffer(data)) return cleanRecordText(data.toString("utf8"));
        if (Array.isArray(data)) return cleanRecordText(Buffer.from(data).toString("utf8"));
        if (ArrayBuffer.isView(data)) return cleanRecordText(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString("utf8"));
        if (data && Array.isArray(data.data)) return cleanRecordText(Buffer.from(data.data).toString("utf8"));
    } catch (e) {}

    return "";
}

function getRecordFieldString(record, fieldName) {
    if (!record || !record.fields) return "";
    const wanted = String(fieldName || "").toUpperCase();

    if (Array.isArray(record.fields)) {
        for (let i = 0; i < record.fields.length; i++) {
            const field = record.fields[i] || {};
            const fieldType = String(field.type || field.name || field.id || field.signature || "").toUpperCase();
            if (fieldType !== wanted) continue;
            const data = field.data !== undefined ? field.data : (field.value !== undefined ? field.value : field.bytes);
            const decoded = decodeRecordFieldData(data);
            if (decoded) return decoded;
        }
        return "";
    }

    const direct = record.fields[wanted] || record.fields[wanted.toLowerCase()];
    if (!direct) return "";
    const data = direct.data !== undefined ? direct.data : (direct.value !== undefined ? direct.value : direct.bytes !== undefined ? direct.bytes : direct);
    return decodeRecordFieldData(data);
}

function getLoadOrderFileName(loadOrder, fileIndex) {
    const entry = Array.isArray(loadOrder) ? loadOrder[Number(fileIndex)] : null;
    if (!entry) return "";
    if (typeof entry === "string") return path.basename(entry);
    if (entry.filename) return path.basename(String(entry.filename));
    if (entry.name) return path.basename(String(entry.name));
    return path.basename(String(entry));
}

function composeGlobalFormId(modIndex, localId) {
    const local = Number(localId) >>> 0;
    if (local > 0xffffff) return local;
    if (!modIndex) return local;
    return ((((Number(modIndex) & 0xff) << 24) | (local & 0x00ffffff)) >>> 0);
}

function makeItemCatalogEntry(formId, record, fileName) {
    if (!record) return null;

    const type = String(record.type || record.recordType || record.signature || "").toUpperCase();
    if (!ADMIN_ITEM_TYPES[type]) return null;

    const editorId = cleanRecordText(record.editorId || getRecordFieldString(record, "EDID"));
    const fullName = getRecordFieldString(record, "FULL");
    const name = fullName || editorId || formatFormId(formId);
    const formIdHex = formatFormId(formId);

    return {
        formId: Number(formId) >>> 0,
        formIdHex: formIdHex,
        editorId: editorId,
        name: name,
        type: type,
        typeName: ADMIN_ITEM_TYPES[type],
        fileName: fileName || "",
        search: [formIdHex, String(Number(formId) >>> 0), editorId, name, type, ADMIN_ITEM_TYPES[type], fileName || ""]
            .join(" ")
            .toLowerCase()
    };
}

function lookupItemRecordByFormId(formId, loadOrder) {
    if (typeof mp.lookupEspmRecordById !== "function") return null;

    try {
        const lookup = mp.lookupEspmRecordById(Number(formId) >>> 0);
        const record = lookup && (lookup.record || lookup);
        const fileName = lookup && lookup.fileIndex !== undefined
            ? getLoadOrderFileName(loadOrder || [], lookup.fileIndex)
            : "";
        return makeItemCatalogEntry(Number(formId) >>> 0, record, fileName);
    } catch (e) {
        return null;
    }
}

function getAdminItemCatalog() {
    if (adminItemCatalogCache && Array.isArray(adminItemCatalogCache.items)) {
        return adminItemCatalogCache.items;
    }

    const items = [];
    const seen = {};
    let loadOrder = [];

    if (typeof mp.getEspmLoadOrder !== "function" || typeof mp.getAllForms !== "function" || typeof mp.lookupEspmRecordById !== "function") {
        adminItemCatalogCache = { builtAt: Date.now(), items: [] };
        return adminItemCatalogCache.items;
    }

    try {
        loadOrder = mp.getEspmLoadOrder() || [];
    } catch (e) {
        loadOrder = [];
    }

    for (let modIndex = 0; modIndex < loadOrder.length && items.length < ADMIN_ITEM_CATALOG_LIMIT; modIndex++) {
        let forms = [];
        try {
            forms = mp.getAllForms(modIndex) || [];
        } catch (e) {
            continue;
        }

        const fileName = getLoadOrderFileName(loadOrder, modIndex);
        for (let formIndex = 0; formIndex < forms.length && items.length < ADMIN_ITEM_CATALOG_LIMIT; formIndex++) {
            const localId = Number(forms[formIndex]) >>> 0;
            const formId = composeGlobalFormId(modIndex, localId);
            const key = String(formId >>> 0);
            if (seen[key]) continue;
            seen[key] = true;

            const entry = lookupItemRecordByFormId(formId, loadOrder);
            if (!entry) continue;
            if (!entry.fileName && fileName) entry.fileName = fileName;
            items.push(entry);
        }
    }

    items.sort(function(left, right) {
        const typeCompare = String(left.typeName).localeCompare(String(right.typeName));
        if (typeCompare) return typeCompare;
        return String(left.name).localeCompare(String(right.name));
    });

    adminItemCatalogCache = {
        builtAt: Date.now(),
        items: items
    };
    return items;
}

function resolveItemInput(raw) {
    const formId = parseFormIdInput(raw);
    if (formId !== null) {
        return lookupItemRecordByFormId(formId, null) || {
            formId: formId >>> 0,
            formIdHex: formatFormId(formId),
            editorId: "",
            name: formatFormId(formId),
            type: "",
            typeName: "Item",
            fileName: ""
        };
    }

    const needle = String(raw || "").trim().toLowerCase();
    if (!needle) return null;

    const catalog = getAdminItemCatalog();
    let fallback = null;
    for (let i = 0; i < catalog.length; i++) {
        const item = catalog[i];
        const editorId = String(item.editorId || "").toLowerCase();
        const name = String(item.name || "").toLowerCase();
        if (editorId === needle || name === needle) return item;
        if (!fallback && (editorId.indexOf(needle) !== -1 || name.indexOf(needle) !== -1)) {
            fallback = item;
        }
    }
    return fallback;
}

function addItemToActor(actorId, formId, count) {
    const actor = { type: "form", desc: mp.getDescFromId(actorId) };
    const item = { type: "espm", desc: mp.getDescFromId(Number(formId) >>> 0) };
    mp.callPapyrusFunction("method", "ObjectReference", "AddItem", actor, [item, count, false, null]);
}

function findAccountForAdminTarget(raw) {
    const search = normalizeAccountSearch(raw);
    if (!search) return null;

    const onlineTarget = findUserById(search);
    if (onlineTarget !== null) {
        const account = getAccountByUserId(onlineTarget);
        if (account) {
            return {
                accountId: Number(account.account_id),
                username: String(account.username),
                characterId: Number(account.character_id),
                userId: onlineTarget
            };
        }
    }

    const db = ensureUcpAdminStore();
    if (!db) return null;

    const row = dbGet(db, `
        SELECT id, username
        FROM accounts
        WHERE username = ? COLLATE NOCASE OR CAST(id AS TEXT) = ?
        LIMIT 1
    `, [search, search]);
    if (!row) return null;

    return {
        accountId: Number(row.id),
        username: String(row.username),
        characterId: null,
        userId: null
    };
}

function getOnlineAdmins(includeInvisible) {
    return getOnlineUserIds()
        .map(function(userId) {
            const admin = getAdminInfo(userId, false);
            if (!admin) return null;
            if (adminInvisibleByUser[userId] && !includeInvisible) return null;
            return {
                userId: userId,
                username: admin.username,
                characterName: admin.characterName,
                roleName: admin.role ? admin.role.name : "Staff",
                roleCode: admin.role ? admin.role.code : "STAFF",
                rankValue: admin.rankValue,
                onDuty: adminDutyByUser[userId] === true,
                invisible: adminInvisibleByUser[userId] === true
            };
        })
        .filter(Boolean)
        .sort(function(left, right) {
            if (left.onDuty !== right.onDuty) return left.onDuty ? -1 : 1;
            if (left.rankValue !== right.rankValue) return right.rankValue - left.rankValue;
            return left.username.localeCompare(right.username);
        });
}

function getOnlinePlayerSummaries() {
    return getOnlineUserIds()
        .map(function(userId) {
            const actorId = safeGetUserActor(userId);
            if (!actorId) return null;

            const account = getAccountByUserId(userId);
            const admin = getAdminInfo(userId, false);
            const displayName = getDisplayName(actorId);
            const username = account && account.username ? String(account.username) : displayName;
            const characterName = account && account.character_name ? String(account.character_name) : displayName;

            return {
                userId: userId,
                username: username,
                characterName: characterName,
                displayName: displayName,
                ping: getUserPingValue(userId),
                isStaff: !!admin,
                roleName: admin && admin.role ? admin.role.name : "",
                roleCode: admin && admin.role ? admin.role.code : "",
                rankValue: admin ? Number(admin.rankValue) : 0,
                onDuty: adminDutyByUser[userId] === true,
                invisible: adminInvisibleByUser[userId] === true
            };
        })
        .filter(Boolean)
        .sort(function(left, right) {
            if (left.isStaff !== right.isStaff) return left.isStaff ? -1 : 1;
            if (left.rankValue !== right.rankValue) return right.rankValue - left.rankValue;
            return String(left.characterName || left.username).localeCompare(String(right.characterName || right.username));
        });
}

function getActiveStaffAccountCount() {
    const db = ensureUcpAdminStore();
    if (!db) return 0;

    const row = dbGet(db, `
        SELECT COUNT(DISTINCT asr.account_id) AS count
        FROM account_staff_roles asr
        JOIN staff_role_permissions rp ON rp.role_id = asr.role_id
        JOIN staff_permissions p ON p.id = rp.permission_id
        WHERE asr.revoked_at IS NULL
          AND (asr.valid_until IS NULL OR asr.valid_until = '' OR asr.valid_until > ?)
          AND p.code = 'panel.access'
    `, [nowIso()]);

    return row ? Number(row.count) || 0 : 0;
}

function getPublicAdminAvailability() {
    const onlineAdmins = getOnlineAdmins();
    const publicAdmins = onlineAdmins.map(function(admin) {
        return {
            userId: admin.userId,
            username: admin.username,
            roleName: admin.roleName,
            onDuty: admin.onDuty === true,
            ping: getUserPingValue(admin.userId)
        };
    });

    return {
        admins: publicAdmins,
        offlineCount: Math.max(0, getActiveStaffAccountCount() - publicAdmins.length)
    };
}

function refreshAdminPresentation(userId) {
    const actorId = mp.getUserActor(userId);
    if (!actorId) return;

    let admin = null;
    try {
        admin = getAdminInfo(userId, false);
    } catch (e) {
        console.log("[gamemode] Failed to refresh admin presentation:", e);
    }

    if (adminInvisibleByUser[userId]) {
        mp.set(actorId, "rp_nameplateOwner", "");
        return;
    }

    if (admin && adminDutyByUser[userId]) {
        mp.set(actorId, "rp_nameplateOwner", JSON.stringify({
            text: admin.username,
            color: ADMIN_DUTY_RGBA
        }));
        return;
    }

    mp.set(actorId, "rp_nameplateOwner", getDisplayName(actorId));
}

function refreshAllAdminPresentations() {
    getOnlineUserIds().forEach(function(userId) {
        refreshAdminPresentation(userId);
    });
}

const CHAT_BOOTSTRAP_BROWSER_JS = `
(function() {
  function getChatSettings() {
    var defaults = {
      left: ${CHAT_SETTINGS.left},
      top: ${CHAT_SETTINGS.top},
      width: ${CHAT_SETTINGS.width},
      inputWidth: ${CHAT_SETTINGS.inputWidth},
      visibleLines: ${CHAT_SETTINGS.visibleLines},
      historyLines: ${CHAT_SETTINGS.historyLines},
      fontSize: ${CHAT_SETTINGS.fontSize},
      inputFontSize: ${CHAT_SETTINGS.inputFontSize},
      lineHeight: ${CHAT_SETTINGS.lineHeight},
      inputGap: ${CHAT_SETTINGS.inputGap},
      timestamps: false
    };
    var current = window.__skrpChatSettings || {};
    for (var key in current) {
      if (Object.prototype.hasOwnProperty.call(defaults, key) && current[key] !== undefined) {
        defaults[key] = Number(current[key]) || defaults[key];
      }
    }
    return defaults;
  }

  function getChatInputTop(settings) {
    return settings.top + (settings.visibleLines * settings.lineHeight) + settings.inputGap;
  }

  function getChatInputWidth(settings) {
    void settings;
    return ${CHAT_SETTINGS.inputWidth};
  }

  function applyChatSettings(shouldRenderLog) {
    var settings = getChatSettings();
    var root = document.getElementById('skrp-chat-root');
    var log = document.getElementById('skrp-chat-log');
    var input = document.getElementById('skrp-chat-input');

    if (root) {
      root.style.left = settings.left + 'px';
      root.style.top = getChatInputTop(settings) + 'px';
      root.style.width = getChatInputWidth(settings) + 'px';
      root.style.maxWidth = getChatInputWidth(settings) + 'px';
    }

    if (log) {
      log.style.display = 'none';
      log.style.maxHeight = '0';
      log.style.fontSize = settings.fontSize + 'px';
      log.style.lineHeight = settings.lineHeight + 'px';
      log.innerHTML = '';
    }

    if (input) {
      input.style.fontSize = settings.inputFontSize + 'px';
      input.style.height = Math.max(44, settings.inputFontSize + 22) + 'px';
    }

    if (Array.isArray(window.__skrpChatMessages)) {
      var historyLines = Math.max(10, Math.min(120, Number(settings.historyLines) || ${CHAT_SETTINGS.historyLines}));
      while (window.__skrpChatMessages.length > historyLines) {
        window.__skrpChatMessages.shift();
      }
    }

    void shouldRenderLog;
  }

  function cancelChatIdleHide() {
    if (window.__skrpChatHideTimer) {
      clearTimeout(window.__skrpChatHideTimer);
      window.__skrpChatHideTimer = 0;
    }
  }

  function scheduleChatIdleHide() {
    cancelChatIdleHide();
  }

  function installChatWheelScroll(root, log) {
    if (!root || !log || root.__skrpChatWheelInstalled) return;
    root.__skrpChatWheelInstalled = true;

    root.addEventListener('wheel', function(event) {
      event.preventDefault();
      event.stopPropagation();
      log.scrollTop += event.deltaY;
    }, { passive: false });
  }

  function getChatInputHistory() {
    if (!Array.isArray(window.__skrpChatInputHistory)) {
      window.__skrpChatInputHistory = [];
    }
    return window.__skrpChatInputHistory;
  }

  function resetChatHistoryCursor() {
    window.__skrpChatHistoryIndex = null;
    window.__skrpChatDraft = '';
  }

  function storeSentChatMessage(text) {
    var history = getChatInputHistory();
    if (history[history.length - 1] !== text) {
      history.push(text);
    }
    while (history.length > 50) {
      history.shift();
    }
    resetChatHistoryCursor();
  }

  function showChatHistory(direction, input) {
    var history = getChatInputHistory();
    if (!history.length) return;

    if (window.__skrpChatHistoryIndex === null || window.__skrpChatHistoryIndex === undefined) {
      window.__skrpChatDraft = input.value;
      window.__skrpChatHistoryIndex = history.length;
    }

    var nextIndex = window.__skrpChatHistoryIndex + direction;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex > history.length) nextIndex = history.length;

    window.__skrpChatHistoryIndex = nextIndex;
    input.value = nextIndex === history.length ? (window.__skrpChatDraft || '') : history[nextIndex];
    setTimeout(function() {
      input.selectionStart = input.value.length;
      input.selectionEnd = input.value.length;
    }, 0);
  }

  function shouldRenderChatPayload(payload, color, text) {
    window.__skrpRenderedChatKeys = window.__skrpRenderedChatKeys || {};
    window.__skrpRenderedChatOrder = Array.isArray(window.__skrpRenderedChatOrder) ? window.__skrpRenderedChatOrder : [];

    var keys = [];
    if (payload && payload.seq !== undefined && payload.seq !== null) {
      keys.push('seq:' + String(payload.seq));
    }
    keys.push('text:' + color + '|' + text);

    var now = Date.now();
    for (var i = 0; i < keys.length; i++) {
      var previous = window.__skrpRenderedChatKeys[keys[i]];
      if (previous && (keys[i].indexOf('seq:') === 0 || now - previous < 5000)) {
        return false;
      }
    }

    for (var j = 0; j < keys.length; j++) {
      if (!window.__skrpRenderedChatKeys[keys[j]]) {
        window.__skrpRenderedChatOrder.push(keys[j]);
      }
      window.__skrpRenderedChatKeys[keys[j]] = now;
    }

    while (window.__skrpRenderedChatOrder.length > 300) {
      var oldKey = window.__skrpRenderedChatOrder.shift();
      delete window.__skrpRenderedChatKeys[oldKey];
    }

    return true;
  }

  function shouldSendChatSubmit(text) {
    if (isLikelySyntheticChatInput(text)) {
      return false;
    }
    var now = Date.now();
    var last = window.__skrpLastChatSubmit;
    var lastAt = Number(window.__skrpLastChatSubmitAt || 0);
    if (lastAt && now - lastAt < 350) {
      return false;
    }
    if (last && last.text === text && now - last.at < 750) {
      return false;
    }
    window.__skrpLastChatSubmit = { text: text, at: now };
    window.__skrpLastChatSubmitAt = now;
    return true;
  }

  function isLikelySyntheticChatInput(text) {
    text = String(text || '').trim();
    if (text.length < 6) return false;
    var compact = text.replace(/\\s+/g, '');
    if (compact.length < 6) return false;
    if (/^(.)\\1{5,}$/i.test(compact)) return true;
    var counts = {};
    var maxCount = 0;
    for (var i = 0; i < compact.length; i++) {
      var ch = compact.charAt(i).toLowerCase();
      counts[ch] = (counts[ch] || 0) + 1;
      if (counts[ch] > maxCount) maxCount = counts[ch];
    }
    return compact.length >= 10 && maxCount / compact.length >= 0.85;
  }

  function isPrintableChatKey(event) {
    return !!(event
      && typeof event.key === 'string'
      && event.key.length === 1
      && !event.ctrlKey
      && !event.altKey
      && !event.metaKey);
  }

  function isChatClipboardShortcut(event) {
    if (!event || !(event.ctrlKey || event.metaKey) || event.altKey) return false;
    var key = String(event.key || '').toLowerCase();
    return key === 'a' || key === 'c' || key === 'v';
  }

  function noteAllowedChatTextInput(text) {
    text = String(text || '');
    if (!text) return;
    window.__skrpLastAllowedTextInput = text;
    window.__skrpLastAllowedTextInputAt = Date.now();
  }

  function allowNextClipboardChatInput(text) {
    window.__skrpAllowClipboardInputAt = Date.now();
    noteAllowedChatTextInput(text || '');
  }

  function hasRecentAllowedChatTextInput(text) {
    text = String(text || '');
    var at = Number(window.__skrpLastAllowedTextInputAt || 0);
    if (!at || Date.now() - at > 220) return false;
    var expected = String(window.__skrpLastAllowedTextInput || '');
    if (!expected || !text) return true;
    return expected.toLowerCase() === text.toLowerCase();
  }

  function shouldSuppressUnexpectedChatText(text, inputType) {
    text = String(text || '');
    if (!text) return false;
    inputType = String(inputType || '');
    var clipboardAt = Number(window.__skrpAllowClipboardInputAt || 0);
    if (clipboardAt && Date.now() - clipboardAt < 650) return false;
    if (inputType.indexOf('insertFromPaste') === 0) return false;
    if (hasRecentAllowedChatTextInput(text)) return false;
    return text.length === 1 || isLikelySyntheticChatInput(text);
  }

  function rememberChatInputValue(input) {
    window.__skrpChatLastInputValue = input ? String(input.value || '') : '';
  }

  function resetChatInputGate(value) {
    window.__skrpLastAllowedTextInput = '';
    window.__skrpLastAllowedTextInputAt = 0;
    window.__skrpChatLastInputValue = String(value || '');
  }

  function rollbackUnexpectedChatInput(input) {
    if (!input) return false;
    var value = String(input.value || '');
    var previous = String(window.__skrpChatLastInputValue || '');
    if (value === previous) return false;

    if (previous && value.indexOf(previous) === 0) {
      var inserted = value.slice(previous.length);
      if (shouldSuppressUnexpectedChatText(inserted, 'input-fallback')) {
        input.value = previous;
        rememberChatInputValue(input);
        return true;
      }
    }

    if (!previous && shouldSuppressUnexpectedChatText(value, 'input-fallback')) {
      input.value = '';
      rememberChatInputValue(input);
      return true;
    }

    return false;
  }

  function trimSyntheticChatRun(input) {
    if (!input) return false;
    var value = String(input.value || '');
    if (!isLikelySyntheticChatInput(value)) return false;
    input.value = '';
    rememberChatInputValue(input);
    return true;
  }

  function sendChatTypingState(active) {
    active = !!active;
    if (window.__skrpChatTypingState === active) return;
    window.__skrpChatTypingState = active;
    if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
      window.skyrimPlatform.sendMessage('rpChatTyping', JSON.stringify({
        active: active
      }));
    }
  }

  function sendChatClose(reason) {
    if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
      window.skyrimPlatform.sendMessage('rpChatClose', reason || 'close');
    }
  }

  function hideChatInputLocally() {
    var root = document.getElementById('skrp-chat-root');
    var input = document.getElementById('skrp-chat-input');
    if (input) {
      input.value = '';
      input.style.display = 'none';
      if (typeof input.blur === 'function') input.blur();
    }
    if (root) {
      root.setAttribute('data-chat-open', 'false');
      root.style.pointerEvents = 'none';
      root.style.display = 'none';
    }
  }

  function submitChatInput(input, reason) {
    var text = input ? input.value.trim() : '';
    if (text && shouldSendChatSubmit(text)) {
      storeSentChatMessage(text);
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.__skrpChatSubmitSeq = (window.__skrpChatSubmitSeq || 0) + 1;
        window.skyrimPlatform.sendMessage('rpChatSubmit', JSON.stringify({
          id: Date.now() + ':' + window.__skrpChatSubmitSeq,
          text: text
        }));
      }
    }

    sendChatTypingState(false);
    hideChatInputLocally();
    sendChatClose(reason || 'submit');
  }

  function normalizeChatPayload(payload) {
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = { text: payload };
      }
    }

    var createdAt = payload && payload.createdAt ? String(payload.createdAt) : new Date().toISOString();
    var segments = [];
    if (payload && Array.isArray(payload.segments)) {
      for (var i = 0; i < payload.segments.length; i++) {
        var segment = payload.segments[i];
        if (!segment || segment.text === undefined || segment.text === null) continue;
        segments.push({
          text: String(segment.text),
          color: segment.color ? String(segment.color) : '#f8f2df'
        });
      }
    }
    return {
      seq: payload && payload.seq !== undefined && payload.seq !== null ? String(payload.seq) : null,
      text: payload && payload.text !== undefined ? String(payload.text) : String(payload),
      color: payload && payload.color ? String(payload.color) : '#f8f2df',
      createdAt: createdAt,
      segments: segments
    };
  }

  function formatChatTimestamp(createdAt) {
    var date = new Date(createdAt);
    if (isNaN(date.getTime())) date = new Date();
    var hours = String(date.getHours()).padStart(2, '0');
    var minutes = String(date.getMinutes()).padStart(2, '0');
    var seconds = String(date.getSeconds()).padStart(2, '0');
    return '[ ' + hours + ':' + minutes + ':' + seconds + ':] ';
  }

  function formatChatLine(entry) {
    var settings = getChatSettings();
    return (settings.timestamps ? formatChatTimestamp(entry.createdAt) : '') + entry.text;
  }

  function createChatLine(entry) {
    var line = document.createElement('div');
    line.style.color = entry.color;
    var settings = getChatSettings();
    if (settings.timestamps) {
      line.appendChild(document.createTextNode(formatChatTimestamp(entry.createdAt)));
    }
    if (entry.segments && entry.segments.length) {
      for (var i = 0; i < entry.segments.length; i++) {
        var span = document.createElement('span');
        span.textContent = entry.segments[i].text;
        span.style.color = entry.segments[i].color || entry.color;
        line.appendChild(span);
      }
    } else {
      line.appendChild(document.createTextNode(entry.text));
    }
    return line;
  }

  function renderChatLog(forceFull) {
    var log = document.getElementById('skrp-chat-log');
    if (!log) return;

    var messages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
    var renderedCount = Number(window.__skrpRenderedChatCount || 0);
    if (forceFull || renderedCount > messages.length || log.childNodes.length > messages.length) {
      log.innerHTML = '';
      renderedCount = 0;
    }

    for (var i = renderedCount; i < messages.length; i++) {
      log.appendChild(createChatLine(messages[i]));
    }

    while (log.childNodes.length > messages.length) {
      log.removeChild(log.firstChild);
    }

    window.__skrpRenderedChatCount = messages.length;
    log.scrollTop = log.scrollHeight;
  }

  function ensurePlainChat() {
    if (!document.body) return null;

    var settings = getChatSettings();
    var root = document.getElementById('skrp-chat-root');
    if (!root) {
      window.__skrpChatMessages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
      root = document.createElement('div');
      root.id = 'skrp-chat-root';
      root.style.position = 'fixed';
      root.style.left = settings.left + 'px';
      root.style.top = getChatInputTop(settings) + 'px';
      root.style.width = getChatInputWidth(settings) + 'px';
      root.style.maxWidth = getChatInputWidth(settings) + 'px';
      root.style.zIndex = '2147483647';
      root.style.fontFamily = 'Din-pro, \"Trebuchet MS\", Arial, sans-serif';
      root.style.fontWeight = '700';
      root.style.letterSpacing = '0.25px';
      root.style.pointerEvents = 'none';
      root.style.display = 'none';
      root.style.contain = 'layout style paint';
      root.style.webkitFontSmoothing = 'antialiased';
      root.style.textRendering = 'geometricPrecision';
      root.setAttribute('data-chat-open', 'false');

      var log = document.createElement('div');
      log.id = 'skrp-chat-log';
      log.style.display = 'none';
      log.style.maxHeight = '0';
      log.style.overflow = 'hidden';
      log.style.margin = '0';
      log.style.padding = '0';
      log.style.background = 'transparent';
      log.style.color = '#f5f5f5';
      log.style.fontSize = settings.fontSize + 'px';
      log.style.lineHeight = settings.lineHeight + 'px';
      log.style.textShadow = '0 0 2px rgba(0, 0, 0, 0.98), 1px 1px 0 rgba(0, 0, 0, 0.98), -1px 1px 0 rgba(0, 0, 0, 0.85)';
      log.style.contain = 'content';
      root.appendChild(log);
      installChatWheelScroll(root, log);

      var input = document.createElement('input');
      input.id = 'skrp-chat-input';
      input.type = 'text';
      input.maxLength = 240;
      input.autocomplete = 'off';
      input.placeholder = 'Enter message...';
      input.style.boxSizing = 'border-box';
      input.style.width = '100%';
      input.style.maxWidth = ${CHAT_SETTINGS.inputWidth} + 'px';
      input.style.height = '44px';
      input.style.padding = '7px 12px';
      input.style.border = '2px solid rgba(255, 255, 255, 0.34)';
      input.style.borderRadius = '10px';
      input.style.background = 'rgba(0, 0, 0, 0.76)';
      input.style.color = '#ffffff';
      input.style.fontFamily = 'Din-pro, \"Trebuchet MS\", Arial, sans-serif';
      input.style.fontWeight = '700';
      input.style.letterSpacing = '0.25px';
      input.style.fontSize = settings.inputFontSize + 'px';
      input.style.height = Math.max(44, settings.inputFontSize + 22) + 'px';
      input.style.textShadow = '0 0 2px rgba(0, 0, 0, 0.98), 1px 1px 0 rgba(0, 0, 0, 0.98)';
      input.style.outline = 'none';
      input.style.display = 'none';

      if (!input.__skrpChatListenersInstalled) {
        input.__skrpChatListenersInstalled = true;

        input.addEventListener('keydown', function(event) {
          if (isChatClipboardShortcut(event)) {
            var shortcutKey = String(event.key || '').toLowerCase();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            if (shortcutKey === 'a') {
              event.preventDefault();
              input.select();
              return;
            }
            if (shortcutKey === 'v') {
              allowNextClipboardChatInput('');
            }
            return;
          }

          if (event.repeat && isPrintableChatKey(event)) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            return;
          }

          if (isPrintableChatKey(event)) {
            noteAllowedChatTextInput(event.key);
          }

          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            showChatHistory(event.key === 'ArrowUp' ? -1 : 1, input);
            return;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            sendChatTypingState(false);
            hideChatInputLocally();
            sendChatClose('escape');
            return;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            if (event.repeat) return;
            submitChatInput(input, 'submit');
          }
        });

        input.addEventListener('paste', function(event) {
          var pastedText = '';
          if (event.clipboardData && event.clipboardData.getData) {
            pastedText = event.clipboardData.getData('text') || '';
          }
          allowNextClipboardChatInput(pastedText);
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        });

        input.addEventListener('copy', function(event) {
          event.stopPropagation();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        });

        input.addEventListener('beforeinput', function(event) {
          if (shouldSuppressUnexpectedChatText(event.data || '', event.inputType || 'beforeinput')) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          }
        });

        input.addEventListener('input', function() {
          resetChatHistoryCursor();
          if (rollbackUnexpectedChatInput(input) || trimSyntheticChatRun(input)) {
            sendChatTypingState(input.value.trim().length > 0);
            return;
          }
          rememberChatInputValue(input);
          sendChatTypingState(input.value.trim().length > 0);
        });

        input.addEventListener('blur', function() {
          sendChatTypingState(false);
        });
      }

      root.appendChild(input);
      document.body.appendChild(root);
    } else {
      installChatWheelScroll(root, document.getElementById('skrp-chat-log'));
    }

    applyChatSettings(false);
    return root;
  }

  window._skrpChatApplySettings = function(settings) {
    window.__skrpChatSettings = Object.assign({}, window.__skrpChatSettings || {}, settings || {});
    ensurePlainChat();
    applyChatSettings(true);
  };

  window._skrpOpenChat = function(prefill) {
    var root = ensurePlainChat();
    if (!root) {
      setTimeout(function() {
        window._skrpOpenChat(prefill);
      }, 250);
      return;
    }

    cancelChatIdleHide();
    var wasOpen = root.getAttribute('data-chat-open') === 'true';
    root.style.display = 'block';
    root.style.pointerEvents = 'auto';
    root.setAttribute('data-chat-open', 'true');
    applyChatSettings(false);
    setTimeout(function() {
      var input = document.getElementById('skrp-chat-input');
      if (input) {
        input.style.display = 'block';
        var openPrefill = typeof prefill === 'string'
          ? prefill
          : (typeof window.__skrpChatOpenPrefill === 'string' ? window.__skrpChatOpenPrefill : '');
        if (!wasOpen || openPrefill) {
          input.value = openPrefill || '';
        }
        window.__skrpChatOpenPrefill = '';
        resetChatInputGate(input.value || '');
        input.focus();
      }
    }, 25);
  };

  window._skrpChatPush = function(payload) {
    var log = document.getElementById('skrp-chat-log');
    if (log) log.innerHTML = '';
    window.__skrpChatMessages = [];
    window.__skrpPendingChat = [];
    void payload;
  };

  var pending = Array.isArray(window.__skrpPendingChat) ? window.__skrpPendingChat : [];
  window.__skrpPendingChat = [];

  ensurePlainChat();

  void pending;

  if (!window.__skrpChatFocusHooked) {
    window.__skrpChatFocusHooked = true;
    window.addEventListener('skymp5-client:browserFocused', function() {
      window._skrpOpenChat();
    });
  }
})();
`.trim();

const UPDATE_OWNER_JS = `
    if (ctx.value === undefined || ctx.value === null) return;
    if (ctx.state.last === ctx.value) return;
    ctx.state.last = ctx.value;

    if (String(ctx.value).trim() === "") return;

    function destroyTextIds() {
        var textIds = ctx.sp.storage && Array.isArray(ctx.sp.storage.__skrpNativeChatTextIds)
            ? ctx.sp.storage.__skrpNativeChatTextIds
            : [];
        ctx.state.textIds = Array.isArray(ctx.state.textIds) ? ctx.state.textIds : [];
        for (var stateIndex = 0; stateIndex < ctx.state.textIds.length; stateIndex++) {
            if (textIds.indexOf(ctx.state.textIds[stateIndex]) === -1) {
                textIds.push(ctx.state.textIds[stateIndex]);
            }
        }
        for (var i = 0; i < textIds.length; i++) {
            if (!textIds[i]) continue;
            try {
                ctx.sp.destroyText(textIds[i]);
            } catch (e) {}
        }
        ctx.state.textIds = [];
        if (ctx.sp.storage) {
            ctx.sp.storage.__skrpNativeChatTextIds = [];
        }
    }

    function parseColor(rawColor) {
        var color = String(rawColor || "#f8f2df").trim();
        var match = /^#?([0-9a-f]{6})$/i.exec(color);
        if (!match) return [0.97, 0.95, 0.87, 1];
        var hex = match[1];
        return [
            parseInt(hex.slice(0, 2), 16) / 255,
            parseInt(hex.slice(2, 4), 16) / 255,
            parseInt(hex.slice(4, 6), 16) / 255,
            1
        ];
    }

    function formatTimestamp(createdAt) {
        var date = new Date(createdAt);
        if (isNaN(date.getTime())) date = new Date();
        return "[ " + String(date.getHours()).padStart(2, "0") + ":" +
            String(date.getMinutes()).padStart(2, "0") + ":" +
            String(date.getSeconds()).padStart(2, "0") + ":] ";
    }

    function wrapText(text, maxChars) {
        text = String(text || "");
        maxChars = Math.max(18, maxChars || 62);
        var lines = [];
        var sourceLines = text.split(/\\r?\\n/);
        for (var sourceIndex = 0; sourceIndex < sourceLines.length; sourceIndex++) {
            var words = sourceLines[sourceIndex].split(/\\s+/).filter(function(word) { return word.length > 0; });
            var line = "";
            for (var i = 0; i < words.length; i++) {
                var word = words[i];
                while (word.length > maxChars) {
                    var chunk = word.slice(0, maxChars);
                    word = word.slice(maxChars);
                    if (line) {
                        lines.push(line);
                        line = "";
                    }
                    lines.push(chunk);
                }
                var candidate = line ? line + " " + word : word;
                if (candidate.length > maxChars && line) {
                    lines.push(line);
                    line = word;
                } else {
                    line = candidate;
                }
            }
            if (line || words.length === 0) lines.push(line);
        }
        return lines.length ? lines : [""];
    }

    function getNativeChatLeft(settings) {
        var left = Number(settings.left);
        if (!isFinite(left) || left < 4) left = ${CHAT_SETTINGS.left};
        return left;
    }

    var NATIVE_GLYPH_METRICS = ${JSON.stringify(NATIVE_CHAT_GLYPH_METRICS)};

    function getNativeTextScale(fontSize, textSize) {
        var scale = Number(textSize);
        if (!isFinite(scale) || scale <= 0) {
            scale = Math.max(0.32, Math.min(1.35, fontSize / 38));
        }
        return scale;
    }

    function getNativeGlyphMetric(character) {
        var code = character && character.charCodeAt ? character.charCodeAt(0) : 63;
        return NATIVE_GLYPH_METRICS[code] || NATIVE_GLYPH_METRICS[63] || [6, 13, -4];
    }

    function getNativeTextLayout(text) {
        text = String(text || "");
        var x = 0;
        var measured = 0;
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i);
            if (ch === "\\r") continue;
            if (ch === "\\n") {
                x = 0;
                continue;
            }
            var glyph = getNativeGlyphMetric(ch);
            var glyphWidth = Number(glyph[1]) || 0;
            x += Number(glyph[0]) || 0;
            if (x < 0) x = 0;
            if (!(ch === " " && glyphWidth <= 1)) {
                measured = Math.max(measured, x + glyphWidth);
            }
            x += glyphWidth + (Number(glyph[2]) || 0);
        }
        return {
            measured: Math.max(0, measured),
            advance: Math.max(0, x)
        };
    }

    function measureNativeSegmentWidth(fontSize, text, textSize) {
        return getNativeTextLayout(text).measured * getNativeTextScale(fontSize, textSize);
    }

    function estimateNativeSegmentWidth(fontSize, text, textSize) {
        return getNativeTextLayout(text).advance * getNativeTextScale(fontSize, textSize);
    }

    function getNativeChatTextX(settings, fontSize, text, textSize) {
        var textWidth = measureNativeSegmentWidth(fontSize, text, textSize);
        return Math.round(getNativeChatLeft(settings) + textWidth / 2);
    }

    function getNativeTextOrigin(fontSize, text, textSize, measuredWidth) {
        void fontSize;
        void text;
        void textSize;
        void measuredWidth;
        return [0, 0];
    }

    function applyNativeChatTextStyle(textId, fontSize, text, textSize, measuredWidth) {
        if (!textId) return;
        try { if (ctx.sp.setTextFont) ctx.sp.setTextFont(textId, ${JSON.stringify(NATIVE_CHAT_FONT)}); } catch (e) {}
        try { if (ctx.sp.setTextSize) ctx.sp.setTextSize(textId, textSize); } catch (e) {}
        try { if (ctx.sp.setTextOrigin) ctx.sp.setTextOrigin(textId, getNativeTextOrigin(fontSize, text, textSize, measuredWidth)); } catch (e) {}
    }

    function renderNativeSegmentText(targetTextIds, fontSize, textY, cursorX, segment, fallbackColor, textSize) {
        var segmentText = String((segment && segment.text) || "");
        if (!segmentText) return cursorX;

        var leading = (segmentText.match(/^\\s*/) || [""])[0];
        var trailing = (segmentText.match(/\\s*$/) || [""])[0];
        var visibleText = segmentText.slice(leading.length, segmentText.length - trailing.length);
        if (!visibleText) return cursorX + estimateNativeSegmentWidth(fontSize, segmentText, textSize);

        cursorX += estimateNativeSegmentWidth(fontSize, leading, textSize);
        if (visibleText) {
            var visibleWidth = measureNativeSegmentWidth(fontSize, visibleText, textSize);
            var segmentTextX = Math.round(cursorX + visibleWidth / 2);
            var segmentTextId = ctx.sp.createText(segmentTextX, textY, visibleText, parseColor((segment && segment.color) || fallbackColor), ${JSON.stringify(NATIVE_CHAT_FONT)});
            if (segmentTextId) {
                targetTextIds.push(segmentTextId);
                applyNativeChatTextStyle(segmentTextId, fontSize, visibleText, textSize);
            }
            cursorX += estimateNativeSegmentWidth(fontSize, visibleText, textSize);
        }
        cursorX += estimateNativeSegmentWidth(fontSize, trailing, textSize);
        return cursorX;
    }

    function normalizeNativeSegments(segments, fallbackText, fallbackColor) {
        if (!Array.isArray(segments) || !segments.length) {
            return [{ text: String(fallbackText || ""), color: fallbackColor || "#f8f2df" }];
        }

        var normalized = [];
        for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            var segment = segments[segmentIndex];
            if (!segment || segment.text === undefined || segment.text === null) continue;
            normalized.push({
                text: String(segment.text),
                color: segment.color ? String(segment.color) : (fallbackColor || "#f8f2df")
            });
        }

        return normalized.length
            ? normalized
            : [{ text: String(fallbackText || ""), color: fallbackColor || "#f8f2df" }];
    }

    function getNativeSegmentsText(segments) {
        var result = "";
        for (var i = 0; i < segments.length; i++) {
            result += String(segments[i].text || "");
        }
        return result;
    }

    function pushNativeSegment(segments, text, color) {
        text = String(text || "");
        if (!text) return;
        var last = segments.length ? segments[segments.length - 1] : null;
        if (last && last.color === color) {
            last.text += text;
            return;
        }
        segments.push({ text: text, color: color });
    }

    function wrapNativeSegments(segments, maxChars, fallbackColor) {
        var lines = [];
        var currentSegments = [];
        var currentLength = 0;

        function flushLine() {
            if (!currentSegments.length) return;
            lines.push({
                text: getNativeSegmentsText(currentSegments),
                color: fallbackColor || "#f8f2df",
                segments: currentSegments.slice()
            });
            currentSegments = [];
            currentLength = 0;
        }

        function appendToken(token, color) {
            token = String(token || "");
            if (!token) return;

            while (token.length > maxChars) {
                if (currentLength > 0) flushLine();
                pushNativeSegment(currentSegments, token.slice(0, maxChars), color);
                currentLength = maxChars;
                flushLine();
                token = token.slice(maxChars);
            }

            if (currentLength > 0 && currentLength + token.length > maxChars && !/^\\s+$/.test(token)) {
                flushLine();
            }

            if (!currentSegments.length && /^\\s+$/.test(token)) {
                return;
            }

            pushNativeSegment(currentSegments, token, color);
            currentLength += token.length;
        }

        for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            var segment = segments[segmentIndex];
            var color = segment.color || fallbackColor || "#f8f2df";
            var tokens = String(segment.text || "").split(/(\\s+)/);
            for (var tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
                appendToken(tokens[tokenIndex], color);
            }
        }

        flushLine();
        return lines.length ? lines : [{ text: "", color: fallbackColor || "#f8f2df", segments: [] }];
    }

    function renderNativeChatLine(settings, fontSize, textY, line, textSize) {
        var segments = Array.isArray(line.segments) && line.segments.length ? line.segments : null;
        if (!segments) {
            var textX = getNativeChatTextX(settings, fontSize, line.text, textSize);
            var textId = ctx.sp.createText(textX, textY, line.text, parseColor(line.color), ${JSON.stringify(NATIVE_CHAT_FONT)});
            if (textId) {
                ctx.state.textIds.push(textId);
                applyNativeChatTextStyle(textId, fontSize, line.text, textSize);
            }
            return;
        }

        var cursorX = getNativeChatLeft(settings);
        for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
            var segment = segments[segmentIndex];
            cursorX = renderNativeSegmentText(ctx.state.textIds, fontSize, textY, cursorX, segment, line.color, textSize);
        }
    }

    function renderNativeChat() {
        ctx.state.messages = Array.isArray(ctx.state.messages) ? ctx.state.messages : [];
        if (ctx.sp.storage) {
            ctx.sp.storage.__skrpNativeChatMessages = ctx.state.messages;
        }
        var settings = ctx.sp.storage && ctx.sp.storage.__skrpNativeChatSettings
            ? ctx.sp.storage.__skrpNativeChatSettings
            : { left: ${CHAT_SETTINGS.left}, top: ${CHAT_SETTINGS.top}, width: ${CHAT_SETTINGS.width}, visibleLines: ${CHAT_SETTINGS.visibleLines}, historyLines: ${CHAT_SETTINGS.historyLines}, fontSize: ${CHAT_SETTINGS.fontSize}, lineHeight: ${CHAT_SETTINGS.lineHeight}, timestamps: false };
        var fontSize = Math.max(${CHAT_SETTING_LIMITS.fontSize.min}, Math.min(${CHAT_SETTING_LIMITS.fontSize.max}, Number(settings.fontSize) || ${CHAT_SETTINGS.fontSize}));
        var requestedLineHeight = Number(settings.lineHeight) || Math.round(fontSize * 1.35);
        var lineHeight = Math.max(28, Math.min(70, requestedLineHeight));
        var visibleLines = Math.max(3, Math.min(18, Number(settings.visibleLines) || 9));
        var width = Math.max(300, Math.min(${CHAT_SETTING_LIMITS.width.max}, Number(settings.width) || ${CHAT_SETTINGS.width}));
        var horizontalPad = Math.max(22, fontSize * 0.8);
        var usableWidth = Math.max(260, width - horizontalPad * 2);
        var maxChars = Math.max(18, Math.floor(usableWidth / Math.max(8, fontSize * 0.66)));
        var displayLines = [];
        for (var i = 0; i < ctx.state.messages.length; i++) {
            var entry = ctx.state.messages[i];
            var entrySegments = normalizeNativeSegments(entry.segments, entry.text, entry.color);
            if (settings.timestamps) {
                entrySegments = [{ text: formatTimestamp(entry.createdAt), color: entry.color }].concat(entrySegments);
            }
            var wrapped = wrapNativeSegments(entrySegments, maxChars, entry.color);
            for (var j = 0; j < wrapped.length; j++) {
                displayLines.push(wrapped[j]);
            }
        }
        var recentLines = displayLines.slice(-visibleLines);
        var textSize = Math.max(0.32, Math.min(1.35, fontSize / 38));
        destroyTextIds();
        for (var lineIndex = 0; lineIndex < recentLines.length; lineIndex++) {
            var line = recentLines[lineIndex];
            try {
                var textY = (Number(settings.top) || 38) + lineIndex * lineHeight;
                renderNativeChatLine(settings, fontSize, textY, line, textSize);
            } catch (e) {}
        }
        if (ctx.sp.storage) {
            ctx.sp.storage.__skrpNativeChatTextIds = ctx.state.textIds;
        }
    }

    var payloadForNative = {
        text: String(ctx.value),
        color: "#f8f2df",
        seq: null,
        createdAt: null,
        segments: null
    };
    var payload = null;
    try {
        payload = JSON.parse(ctx.value);
        if (payload && payload.control === "refresh") {
            renderNativeChat();
            return;
        }
        if (payload && payload.text !== undefined) {
            payloadForNative.text = String(payload.text);
        }
        if (payload && payload.color !== undefined) {
            payloadForNative.color = String(payload.color);
        }
        if (payload && payload.seq !== undefined) {
            payloadForNative.seq = String(payload.seq);
        }
        if (payload && payload.createdAt !== undefined) {
            payloadForNative.createdAt = String(payload.createdAt);
        }
        if (payload && Array.isArray(payload.segments)) {
            payloadForNative.segments = normalizeNativeSegments(payload.segments, payloadForNative.text, payloadForNative.color);
        }
    } catch (e) {}

    payloadForNative.text = String(payloadForNative.text || "").trim();
    if (!payloadForNative.text) return;
    payloadForNative.createdAt = payloadForNative.createdAt || new Date().toISOString();

    ctx.state.messages = Array.isArray(ctx.state.messages) ? ctx.state.messages : [];
    ctx.state.recentPayloads = ctx.state.recentPayloads || {};
    var now = Date.now();
    var payloadKey = payloadForNative.seq !== null && payloadForNative.seq !== undefined
        ? "seq:" + String(payloadForNative.seq)
        : "text:" + payloadForNative.color + "|" + payloadForNative.text.toLowerCase();
    var recentAt = ctx.state.recentPayloads[payloadKey];
    if (recentAt && now - recentAt < 5000) {
        return;
    }
    ctx.state.recentPayloads[payloadKey] = now;
    Object.keys(ctx.state.recentPayloads).forEach(function(key) {
        if (now - ctx.state.recentPayloads[key] > 10000) {
            delete ctx.state.recentPayloads[key];
        }
    });
    var lastMessage = ctx.state.messages.length ? ctx.state.messages[ctx.state.messages.length - 1] : null;
    if (lastMessage &&
        lastMessage.text === payloadForNative.text &&
        lastMessage.color === payloadForNative.color &&
        Math.abs(new Date(payloadForNative.createdAt).getTime() - new Date(lastMessage.createdAt).getTime()) < 5000) {
        return;
    }
    ctx.state.messages.push(payloadForNative);
    var settingsForHistory = ctx.sp.storage && ctx.sp.storage.__skrpNativeChatSettings ? ctx.sp.storage.__skrpNativeChatSettings : {};
    var historyLines = Math.max(10, Math.min(120, Number(settingsForHistory.historyLines) || 60));
    while (ctx.state.messages.length > historyLines) ctx.state.messages.shift();
    renderNativeChat();
`.trim();

const CHAT_UI_UPDATE_OWNER_JS = `
    if (ctx.state.installed) return;
    if (!ctx.sp.browser) return;
    ctx.state.installed = true;
    ctx.sp.browser.executeJavaScript(${JSON.stringify(CHAT_BOOTSTRAP_BROWSER_JS)});
`.trim();

const CHAT_SETTINGS_UPDATE_OWNER_JS = `
    if (ctx.value === undefined || ctx.value === null) return;
    if (ctx.state.last === ctx.value) return;
    ctx.state.last = ctx.value;

    var settingsForNative = {};
    try {
        settingsForNative = JSON.parse(String(ctx.value));
    } catch (e) {}

    if (ctx.sp.storage) {
        ctx.sp.storage.__skrpNativeChatSettings = settingsForNative;
    }
    if (ctx.sp.browser) {
        var script = [
            "(function() {",
            "  var settings = " + JSON.stringify(settingsForNative) + ";",
            "  window.__skrpChatSettings = Object.assign({}, window.__skrpChatSettings || {}, settings);",
            "  if (window._skrpChatApplySettings) {",
            "    window._skrpChatApplySettings(settings);",
            "  }",
            "})();"
        ].join("\\n");
        ctx.sp.browser.executeJavaScript(script);
    }
    if (ctx.sp.storage) {
        var messages = Array.isArray(ctx.sp.storage.__skrpNativeChatMessages)
            ? ctx.sp.storage.__skrpNativeChatMessages
            : [];
        var textIds = Array.isArray(ctx.sp.storage.__skrpNativeChatTextIds)
            ? ctx.sp.storage.__skrpNativeChatTextIds
            : [];
        for (var textIndex = 0; textIndex < textIds.length; textIndex++) {
            if (!textIds[textIndex]) continue;
            try {
                ctx.sp.destroyText(textIds[textIndex]);
            } catch (e) {}
        }
        textIds = [];

        function parseColor(rawColor) {
            var color = String(rawColor || "#f8f2df").trim();
            var match = /^#?([0-9a-f]{6})$/i.exec(color);
            if (!match) return [0.97, 0.95, 0.87, 1];
            var hex = match[1];
            return [
                parseInt(hex.slice(0, 2), 16) / 255,
                parseInt(hex.slice(2, 4), 16) / 255,
                parseInt(hex.slice(4, 6), 16) / 255,
                1
            ];
        }

        function formatTimestamp(createdAt) {
            var date = new Date(createdAt);
            if (isNaN(date.getTime())) date = new Date();
            return "[ " + String(date.getHours()).padStart(2, "0") + ":" +
                String(date.getMinutes()).padStart(2, "0") + ":" +
                String(date.getSeconds()).padStart(2, "0") + ":] ";
        }

        function wrapText(text, maxChars) {
            text = String(text || "");
            maxChars = Math.max(18, maxChars || 62);
            var lines = [];
            var sourceLines = text.split(/\\r?\\n/);
            for (var sourceIndex = 0; sourceIndex < sourceLines.length; sourceIndex++) {
                var words = sourceLines[sourceIndex].split(/\\s+/).filter(function(word) { return word.length > 0; });
                var line = "";
                for (var i = 0; i < words.length; i++) {
                    var word = words[i];
                    while (word.length > maxChars) {
                        var chunk = word.slice(0, maxChars);
                        word = word.slice(maxChars);
                        if (line) {
                            lines.push(line);
                            line = "";
                        }
                        lines.push(chunk);
                    }
                    var candidate = line ? line + " " + word : word;
                    if (candidate.length > maxChars && line) {
                        lines.push(line);
                        line = word;
                    } else {
                        line = candidate;
                    }
                }
                if (line || words.length === 0) lines.push(line);
            }
            return lines.length ? lines : [""];
        }

        function getNativeChatLeft(settings) {
            var left = Number(settings.left);
            if (!isFinite(left) || left < 4) left = ${CHAT_SETTINGS.left};
            return left;
        }

        var NATIVE_GLYPH_METRICS = ${JSON.stringify(NATIVE_CHAT_GLYPH_METRICS)};

        function getNativeTextScale(fontSize, textSize) {
            var scale = Number(textSize);
            if (!isFinite(scale) || scale <= 0) {
                scale = Math.max(0.32, Math.min(1.35, fontSize / 38));
            }
            return scale;
        }

        function getNativeGlyphMetric(character) {
            var code = character && character.charCodeAt ? character.charCodeAt(0) : 63;
            return NATIVE_GLYPH_METRICS[code] || NATIVE_GLYPH_METRICS[63] || [6, 13, -4];
        }

        function getNativeTextLayout(text) {
            text = String(text || "");
            var x = 0;
            var measured = 0;
            for (var i = 0; i < text.length; i++) {
                var ch = text.charAt(i);
                if (ch === "\\r") continue;
                if (ch === "\\n") {
                    x = 0;
                    continue;
                }
                var glyph = getNativeGlyphMetric(ch);
                var glyphWidth = Number(glyph[1]) || 0;
                x += Number(glyph[0]) || 0;
                if (x < 0) x = 0;
                if (!(ch === " " && glyphWidth <= 1)) {
                    measured = Math.max(measured, x + glyphWidth);
                }
                x += glyphWidth + (Number(glyph[2]) || 0);
            }
            return {
                measured: Math.max(0, measured),
                advance: Math.max(0, x)
            };
        }

        function measureNativeSegmentWidth(fontSize, text, textSize) {
            return getNativeTextLayout(text).measured * getNativeTextScale(fontSize, textSize);
        }

        function estimateNativeSegmentWidth(fontSize, text, textSize) {
            return getNativeTextLayout(text).advance * getNativeTextScale(fontSize, textSize);
        }

        function getNativeChatTextX(settings, fontSize, text, textSize) {
            var textWidth = measureNativeSegmentWidth(fontSize, text, textSize);
            return Math.round(getNativeChatLeft(settings) + textWidth / 2);
        }

        function getNativeTextOrigin(fontSize, text, textSize, measuredWidth) {
            void fontSize;
            void text;
            void textSize;
            void measuredWidth;
            return [0, 0];
        }

        function applyNativeChatTextStyle(textId, fontSize, text, textSize, measuredWidth) {
            if (!textId) return;
            try { if (ctx.sp.setTextFont) ctx.sp.setTextFont(textId, ${JSON.stringify(NATIVE_CHAT_FONT)}); } catch (e) {}
            try { if (ctx.sp.setTextSize) ctx.sp.setTextSize(textId, textSize); } catch (e) {}
            try { if (ctx.sp.setTextOrigin) ctx.sp.setTextOrigin(textId, getNativeTextOrigin(fontSize, text, textSize, measuredWidth)); } catch (e) {}
        }

        function renderNativeSegmentText(targetTextIds, fontSize, textY, cursorX, segment, fallbackColor, textSize) {
            var segmentText = String((segment && segment.text) || "");
            if (!segmentText) return cursorX;

            var leading = (segmentText.match(/^\\s*/) || [""])[0];
            var trailing = (segmentText.match(/\\s*$/) || [""])[0];
            var visibleText = segmentText.slice(leading.length, segmentText.length - trailing.length);
            if (!visibleText) return cursorX + estimateNativeSegmentWidth(fontSize, segmentText, textSize);

            cursorX += estimateNativeSegmentWidth(fontSize, leading, textSize);
            if (visibleText) {
                var visibleWidth = measureNativeSegmentWidth(fontSize, visibleText, textSize);
                var segmentTextX = Math.round(cursorX + visibleWidth / 2);
                var segmentTextId = ctx.sp.createText(segmentTextX, textY, visibleText, parseColor((segment && segment.color) || fallbackColor), ${JSON.stringify(NATIVE_CHAT_FONT)});
                if (segmentTextId) {
                    targetTextIds.push(segmentTextId);
                    applyNativeChatTextStyle(segmentTextId, fontSize, visibleText, textSize);
                }
                cursorX += estimateNativeSegmentWidth(fontSize, visibleText, textSize);
            }
            cursorX += estimateNativeSegmentWidth(fontSize, trailing, textSize);
            return cursorX;
        }

        function normalizeNativeSegments(segments, fallbackText, fallbackColor) {
            if (!Array.isArray(segments) || !segments.length) {
                return [{ text: String(fallbackText || ""), color: fallbackColor || "#f8f2df" }];
            }

            var normalized = [];
            for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
                var segment = segments[segmentIndex];
                if (!segment || segment.text === undefined || segment.text === null) continue;
                normalized.push({
                    text: String(segment.text),
                    color: segment.color ? String(segment.color) : (fallbackColor || "#f8f2df")
                });
            }

            return normalized.length
                ? normalized
                : [{ text: String(fallbackText || ""), color: fallbackColor || "#f8f2df" }];
        }

        function getNativeSegmentsText(segments) {
            var result = "";
            for (var i = 0; i < segments.length; i++) {
                result += String(segments[i].text || "");
            }
            return result;
        }

        function pushNativeSegment(segments, text, color) {
            text = String(text || "");
            if (!text) return;
            var last = segments.length ? segments[segments.length - 1] : null;
            if (last && last.color === color) {
                last.text += text;
                return;
            }
            segments.push({ text: text, color: color });
        }

        function wrapNativeSegments(segments, maxChars, fallbackColor) {
            var lines = [];
            var currentSegments = [];
            var currentLength = 0;

            function flushLine() {
                if (!currentSegments.length) return;
                lines.push({
                    text: getNativeSegmentsText(currentSegments),
                    color: fallbackColor || "#f8f2df",
                    segments: currentSegments.slice()
                });
                currentSegments = [];
                currentLength = 0;
            }

            function appendToken(token, color) {
                token = String(token || "");
                if (!token) return;

                while (token.length > maxChars) {
                    if (currentLength > 0) flushLine();
                    pushNativeSegment(currentSegments, token.slice(0, maxChars), color);
                    currentLength = maxChars;
                    flushLine();
                    token = token.slice(maxChars);
                }

                if (currentLength > 0 && currentLength + token.length > maxChars && !/^\\s+$/.test(token)) {
                    flushLine();
                }

                if (!currentSegments.length && /^\\s+$/.test(token)) {
                    return;
                }

                pushNativeSegment(currentSegments, token, color);
                currentLength += token.length;
            }

            for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
                var segment = segments[segmentIndex];
                var color = segment.color || fallbackColor || "#f8f2df";
                var tokens = String(segment.text || "").split(/(\\s+)/);
                for (var tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
                    appendToken(tokens[tokenIndex], color);
                }
            }

            flushLine();
            return lines.length ? lines : [{ text: "", color: fallbackColor || "#f8f2df", segments: [] }];
        }

        function renderStoredNativeChatLine(settings, fontSize, textY, line, textSize) {
            var segments = Array.isArray(line.segments) && line.segments.length ? line.segments : null;
            if (!segments) {
                var textX = getNativeChatTextX(settings, fontSize, line.text, textSize);
                var textId = ctx.sp.createText(textX, textY, line.text, parseColor(line.color), ${JSON.stringify(NATIVE_CHAT_FONT)});
                if (textId) {
                    textIds.push(textId);
                    applyNativeChatTextStyle(textId, fontSize, line.text, textSize);
                }
                return;
            }

            var cursorX = getNativeChatLeft(settings);
            for (var segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
                var segment = segments[segmentIndex];
                cursorX = renderNativeSegmentText(textIds, fontSize, textY, cursorX, segment, line.color, textSize);
            }
        }

        var fontSize = Math.max(${CHAT_SETTING_LIMITS.fontSize.min}, Math.min(${CHAT_SETTING_LIMITS.fontSize.max}, Number(settingsForNative.fontSize) || ${CHAT_SETTINGS.fontSize}));
        var requestedLineHeight = Number(settingsForNative.lineHeight) || Math.round(fontSize * 1.35);
        var lineHeight = Math.max(28, Math.min(70, requestedLineHeight));
        var visibleLines = Math.max(3, Math.min(18, Number(settingsForNative.visibleLines) || 9));
        var width = Math.max(300, Math.min(${CHAT_SETTING_LIMITS.width.max}, Number(settingsForNative.width) || ${CHAT_SETTINGS.width}));
        var historyLines = Math.max(10, Math.min(120, Number(settingsForNative.historyLines) || 60));
        var horizontalPad = Math.max(22, fontSize * 0.8);
        var usableWidth = Math.max(260, width - horizontalPad * 2);
        var maxChars = Math.max(18, Math.floor(usableWidth / Math.max(8, fontSize * 0.66)));
        var displayLines = [];
        while (messages.length > historyLines) messages.shift();
        for (var messageIndex = 0; messageIndex < messages.length; messageIndex++) {
            var entry = messages[messageIndex];
            var entrySegments = normalizeNativeSegments(entry.segments, entry.text, entry.color);
            if (settingsForNative.timestamps) {
                entrySegments = [{ text: formatTimestamp(entry.createdAt), color: entry.color }].concat(entrySegments);
            }
            var wrapped = wrapNativeSegments(entrySegments, maxChars, entry.color);
            for (var wrapIndex = 0; wrapIndex < wrapped.length; wrapIndex++) {
                displayLines.push(wrapped[wrapIndex]);
            }
        }
        var recentLines = displayLines.slice(-visibleLines);
        var textSize = Math.max(0.32, Math.min(1.35, fontSize / 38));
        for (var lineIndex = 0; lineIndex < recentLines.length; lineIndex++) {
            var line = recentLines[lineIndex];
            try {
                var textY = (Number(settingsForNative.top) || 38) + lineIndex * lineHeight;
                renderStoredNativeChatLine(settingsForNative, fontSize, textY, line, textSize);
            } catch (e) {}
        }
        ctx.sp.storage.__skrpNativeChatMessages = messages;
        ctx.sp.storage.__skrpNativeChatTextIds = textIds;
    }
`.trim();

const EVENT_SOURCE_JS = `
    if (!ctx.state.listenerInstalled) {
        ctx.state.listenerInstalled = true;

        ctx.sp.on("browserMessage", function(event) {
            if (ctx._expired) return;
            if (!event || !Array.isArray(event.arguments)) return;

            var key = event.arguments[0];

            if (key === "rpChatSubmit" || key === "cef::chat:send") {
                var message = String(event.arguments[1] || "").trim();
                if (message) {
                    ctx.sendEvent(message);
                }
            }
        });
    }
`.trim();

const TYPING_EVENT_SOURCE_JS = `
    if (!ctx.state.listenerInstalledTyping) {
        ctx.state.listenerInstalledTyping = true;

        ctx.sp.on("browserMessage", function(event) {
            if (ctx._expired) return;
            if (!event || !Array.isArray(event.arguments)) return;

            var key = event.arguments[0];

            if (key === "rpChatTyping") {
                ctx.sendEvent(String(event.arguments[1] || ""));
            }
        });
    }
`.trim();

const TYPING_UPDATE_NEIGHBOR_JS = `
    function removeTypingIndicator() {
        if (ctx.state.typingIndicatorTextId) {
            ctx.sp.destroyText(ctx.state.typingIndicatorTextId);
            ctx.state.typingIndicatorTextId = 0;
        }
    }

    if ((ctx.value === undefined || ctx.value === null || String(ctx.value).trim() === "") &&
        !ctx.state.typingIndicatorTextId) {
        return;
    }

    var payload;
    var isActive = false;
    try {
        payload = typeof ctx.value === "string" ? JSON.parse(ctx.value) : ctx.value;
        isActive = !!(payload && payload.active);
    } catch (e) {
        isActive = String(ctx.value || "").trim() !== "";
    }

    if (!isActive || !ctx.refr) {
        removeTypingIndicator();
        return;
    }

    var playerActor = ctx.sp.Game.getPlayer();
    var isOwnerActor = !!(playerActor &&
        ctx.refr &&
        playerActor.getFormID() === ctx.refr.getFormID());
    if (!playerActor ||
        (!isOwnerActor &&
            (playerActor.getDistance(ctx.refr) > 1000 ||
                !playerActor.hasLOS(ctx.refr)))) {
        removeTypingIndicator();
        return;
    }

    if (!ctx.state.screenResolution) {
        ctx.state.screenResolution = {
            width: ctx.sp.Utility.getINIInt("iSize W:Display"),
            height: ctx.sp.Utility.getINIInt("iSize H:Display")
        };
    }

    function getTypingWorldPoint() {
        var headPart = "NPC Head [Head]";
        try {
            return [
                ctx.sp.NetImmerse.getNodeWorldPositionX(ctx.refr, headPart, false),
                ctx.sp.NetImmerse.getNodeWorldPositionY(ctx.refr, headPart, false),
                ctx.sp.NetImmerse.getNodeWorldPositionZ(ctx.refr, headPart, false) + 76
            ];
        } catch (e) {}

        try {
            return [
                ctx.refr.getPositionX(),
                ctx.refr.getPositionY(),
                ctx.refr.getPositionZ() + 130
            ];
        } catch (e) {}

        return null;
    }

    var typingWorldPoint = getTypingWorldPoint();
    if (!typingWorldPoint) {
        removeTypingIndicator();
        return;
    }

    var headScreenPos;
    try {
        headScreenPos = ctx.sp.worldPointToScreenPoint(typingWorldPoint)[0];
    } catch (e) {
        removeTypingIndicator();
        return;
    }

    if (!headScreenPos || headScreenPos[2] <= 0) {
        removeTypingIndicator();
        return;
    }

    var resolution = ctx.state.screenResolution;
    var typingText = "[. . .]";
    var typingTextSize = 0.58;
    var textXPos = Math.round(headScreenPos[0] * resolution.width);
    var textYPos = Math.round((1 - headScreenPos[1]) * resolution.height);

    if (!ctx.state.typingIndicatorTextId) {
        ctx.state.typingIndicatorTextId = ctx.sp.createText(textXPos, textYPos, typingText, [1, 0.64, 0.22, 0.95], "Tavern");
        ctx.sp.setTextFont(ctx.state.typingIndicatorTextId, "Tavern");
        ctx.sp.setTextSize(ctx.state.typingIndicatorTextId, typingTextSize);
    } else {
        ctx.sp.setTextString(ctx.state.typingIndicatorTextId, typingText);
        ctx.sp.setTextPos(ctx.state.typingIndicatorTextId, textXPos, textYPos);
    }
`.trim();

const AME_UPDATE_NEIGHBOR_JS = `
    function removeAmeText() {
        if (ctx.state.ameTextId) {
            ctx.sp.destroyText(ctx.state.ameTextId);
            ctx.state.ameTextId = 0;
        }
        var existingTextIds = ctx.state.ameTextIds || [];
        for (var textIndex = 0; textIndex < existingTextIds.length; textIndex++) {
            if (existingTextIds[textIndex]) {
                ctx.sp.destroyText(existingTextIds[textIndex]);
            }
        }
        ctx.state.ameTextIds = [];
        ctx.state.ameLineCount = 0;
        ctx.state.ameToken = "";
    }

    if (ctx.value === undefined || ctx.value === null || String(ctx.value).trim() === "") {
        removeAmeText();
        return;
    }

    var payload = {};
    try {
        payload = typeof ctx.value === "string" ? JSON.parse(ctx.value) : ctx.value;
    } catch (e) {
        payload = { text: String(ctx.value || "") };
    }

    var ameText = String((payload && payload.text) || "").trim();
    var ameLines = [];
    if (payload && Array.isArray(payload.lines)) {
        for (var lineIndex = 0; lineIndex < payload.lines.length && ameLines.length < ${AME_MAX_LINES}; lineIndex++) {
            var payloadLine = String(payload.lines[lineIndex] || "").trim();
            if (payloadLine) {
                ameLines.push(payloadLine);
            }
        }
    }
    if (!ameLines.length && ameText) {
        ameLines.push(ameText);
    }
    if (!ameLines.length || !ctx.refr) {
        removeAmeText();
        return;
    }

    ameText = ameLines.join(" ");

    var expiresAt = Number(payload.expiresAt) || 0;
    if (expiresAt && Date.now() > expiresAt) {
        removeAmeText();
        return;
    }

    var playerActor = ctx.sp.Game.getPlayer();
    var isOwnerActor = !!(playerActor &&
        ctx.refr &&
        playerActor.getFormID() === ctx.refr.getFormID());
    if (!playerActor ||
        (!isOwnerActor &&
            (playerActor.getDistance(ctx.refr) > ${SAY_RADIUS} ||
                !playerActor.hasLOS(ctx.refr)))) {
        removeAmeText();
        return;
    }

    if (!ctx.state.screenResolution) {
        ctx.state.screenResolution = {
            width: ctx.sp.Utility.getINIInt("iSize W:Display"),
            height: ctx.sp.Utility.getINIInt("iSize H:Display")
        };
    }

    function clampColor(value, fallback) {
        var numberValue = Number(value);
        if (!isFinite(numberValue)) return fallback;
        return Math.max(0, Math.min(1, numberValue));
    }

    var displayColor = [0.75, 0.54, 0.82, 0.96];
    if (payload && Array.isArray(payload.color) && payload.color.length >= 3) {
        displayColor = [
            clampColor(payload.color[0], 0.75),
            clampColor(payload.color[1], 0.54),
            clampColor(payload.color[2], 0.82),
            payload.color[3] === undefined ? 0.96 : clampColor(payload.color[3], 0.96)
        ];
    }

    function getAmeWorldPoint() {
        var headPart = "NPC Head [Head]";
        try {
            return [
                ctx.sp.NetImmerse.getNodeWorldPositionX(ctx.refr, headPart, false),
                ctx.sp.NetImmerse.getNodeWorldPositionY(ctx.refr, headPart, false),
                ctx.sp.NetImmerse.getNodeWorldPositionZ(ctx.refr, headPart, false) + 78
            ];
        } catch (e) {}

        try {
            return [
                ctx.refr.getPositionX(),
                ctx.refr.getPositionY(),
                ctx.refr.getPositionZ() + 136
            ];
        } catch (e) {}

        return null;
    }

    var worldPoint = getAmeWorldPoint();
    if (!worldPoint) {
        removeAmeText();
        return;
    }

    var headScreenPos;
    try {
        headScreenPos = ctx.sp.worldPointToScreenPoint(worldPoint)[0];
    } catch (e) {
        removeAmeText();
        return;
    }

    if (!headScreenPos || headScreenPos[2] <= 0) {
        removeAmeText();
        return;
    }

    var resolution = ctx.state.screenResolution;
    var textXPos = Math.round(headScreenPos[0] * resolution.width);
    var textYPos = Math.round((1 - headScreenPos[1]) * resolution.height);
    var textSize = 0.62;
    var lineGap = 28;
    var firstTextYPos = textYPos - Math.round((ameLines.length - 1) * lineGap);
    var token = String((payload && payload.seq) || ameLines.join("\\n"));

    if (!ctx.state.ameTextIds || ctx.state.ameToken !== token || ctx.state.ameLineCount !== ameLines.length) {
        removeAmeText();
        ctx.state.ameToken = token;
        ctx.state.ameLineCount = ameLines.length;
        ctx.state.ameTextIds = [];
        for (var createIndex = 0; createIndex < ameLines.length; createIndex++) {
            var newTextId = ctx.sp.createText(textXPos, firstTextYPos + createIndex * lineGap, ameLines[createIndex], displayColor, "Tavern");
            ctx.sp.setTextFont(newTextId, "Tavern");
            ctx.sp.setTextSize(newTextId, textSize);
            ctx.state.ameTextIds.push(newTextId);
        }
    } else {
        for (var updateIndex = 0; updateIndex < ameLines.length; updateIndex++) {
            var textId = ctx.state.ameTextIds[updateIndex];
            if (!textId) continue;
            ctx.sp.setTextString(textId, ameLines[updateIndex]);
            if (ctx.sp.setTextColor) ctx.sp.setTextColor(textId, displayColor);
            ctx.sp.setTextPos(textId, textXPos, firstTextYPos + updateIndex * lineGap);
        }
    }
`.trim();
const OWNER_NAMEPLATE_UPDATE_JS = `
    function removeOwnerNameplate() {
        if (ctx.state.ownerNameplateTextId) {
            ctx.sp.destroyText(ctx.state.ownerNameplateTextId);
            ctx.state.ownerNameplateTextId = 0;
        }
    }

    if (!ctx.refr) {
        removeOwnerNameplate();
        return;
    }

    function normalizeNameplateText(value) {
        value = String(value || "").trim();
        return value && value !== "Unknown" ? value : "";
    }

    function clampColor(value, fallback) {
        var numberValue = Number(value);
        if (!isFinite(numberValue)) return fallback;
        return Math.max(0, Math.min(1, numberValue));
    }

    var displayName = "";
    var displayColor = [1, 1, 1, 0.95];
    var rawDisplayName = String(ctx.value || "").trim();
    try {
        var parsedDisplay = JSON.parse(rawDisplayName);
        if (parsedDisplay && parsedDisplay.text !== undefined) {
            displayName = normalizeNameplateText(parsedDisplay.text);
        }
        if (parsedDisplay && Array.isArray(parsedDisplay.color) && parsedDisplay.color.length >= 3) {
            displayColor = [
                clampColor(parsedDisplay.color[0], 1),
                clampColor(parsedDisplay.color[1], 1),
                clampColor(parsedDisplay.color[2], 1),
                parsedDisplay.color[3] === undefined ? 0.95 : clampColor(parsedDisplay.color[3], 0.95)
            ];
        }
    } catch (e) {}

    if (!displayName) {
        try {
            displayName = normalizeNameplateText(ctx.refr.getDisplayName());
        } catch (e) {
            displayName = "";
        }
    }

    if (!displayName) {
        displayName = normalizeNameplateText(rawDisplayName);
    }

    if (!displayName) {
        removeOwnerNameplate();
        return;
    }

    if (!ctx.state.screenResolution) {
        ctx.state.screenResolution = {
            width: ctx.sp.Utility.getINIInt("iSize W:Display"),
            height: ctx.sp.Utility.getINIInt("iSize H:Display")
        };
    }

    function getNameplateWorldPoint() {
        var headPart = "NPC Head [Head]";
        try {
            return [
                ctx.sp.NetImmerse.getNodeWorldPositionX(ctx.refr, headPart, false),
                ctx.sp.NetImmerse.getNodeWorldPositionY(ctx.refr, headPart, false),
                ctx.sp.NetImmerse.getNodeWorldPositionZ(ctx.refr, headPart, false) + 58
            ];
        } catch (e) {}

        try {
            return [
                ctx.refr.getPositionX(),
                ctx.refr.getPositionY(),
                ctx.refr.getPositionZ() + 120
            ];
        } catch (e) {}

        return null;
    }

    var worldPoint = getNameplateWorldPoint();
    if (!worldPoint) {
        removeOwnerNameplate();
        return;
    }

    var headScreenPos;
    try {
        headScreenPos = ctx.sp.worldPointToScreenPoint(worldPoint)[0];
    } catch (e) {
        removeOwnerNameplate();
        return;
    }

    if (!headScreenPos || headScreenPos[2] <= 0) {
        removeOwnerNameplate();
        return;
    }

    var resolution = ctx.state.screenResolution;
    var nameplateTextSize = 0.72;
    var textXPos = Math.round(headScreenPos[0] * resolution.width);
    var textYPos = Math.round((1 - headScreenPos[1]) * resolution.height);

    if (!ctx.state.ownerNameplateTextId) {
        ctx.state.ownerNameplateTextId = ctx.sp.createText(textXPos, textYPos, displayName, displayColor, "Tavern");
        ctx.sp.setTextFont(ctx.state.ownerNameplateTextId, "Tavern");
        ctx.sp.setTextSize(ctx.state.ownerNameplateTextId, nameplateTextSize);
    } else {
        ctx.sp.setTextString(ctx.state.ownerNameplateTextId, displayName);
        if (ctx.sp.setTextColor) ctx.sp.setTextColor(ctx.state.ownerNameplateTextId, displayColor);
        ctx.sp.setTextPos(ctx.state.ownerNameplateTextId, textXPos, textYPos);
    }
`.trim();

const ROLEPLAY_SCENE_UPDATE_OWNER_JS = `
    function destroySceneText(textId) {
        if (!textId) return;
        try {
            ctx.sp.destroyText(textId);
        } catch (e) {}
    }

    function removeRoleplaySceneTexts() {
        var existingTextIds = ctx.state.roleplaySceneTextIds || {};
        Object.keys(existingTextIds).forEach(function(key) {
            destroySceneText(existingTextIds[key]);
        });
        ctx.state.roleplaySceneTextIds = {};
    }

    var rawValue = ctx.value === undefined || ctx.value === null ? "" : String(ctx.value);
    if (rawValue.trim() === "") {
        removeRoleplaySceneTexts();
        return;
    }

    var payload = {};
    try {
        payload = JSON.parse(rawValue);
    } catch (e) {
        removeRoleplaySceneTexts();
        return;
    }

    var scenes = Array.isArray(payload.scenes) ? payload.scenes : [];
    if (!scenes.length) {
        removeRoleplaySceneTexts();
        return;
    }

    var playerActor = ctx.sp.Game.getPlayer();
    if (!playerActor) {
        removeRoleplaySceneTexts();
        return;
    }

    if (!ctx.state.screenResolution) {
        ctx.state.screenResolution = {
            width: ctx.sp.Utility.getINIInt("iSize W:Display"),
            height: ctx.sp.Utility.getINIInt("iSize H:Display")
        };
    }

    function getPlayerPos() {
        try {
            return [
                playerActor.getPositionX(),
                playerActor.getPositionY(),
                playerActor.getPositionZ()
            ];
        } catch (e) {
            return null;
        }
    }

    function distanceSquared(a, b) {
        var dx = Number(a[0]) - Number(b[0]);
        var dy = Number(a[1]) - Number(b[1]);
        var dz = Number(a[2]) - Number(b[2]);
        return dx * dx + dy * dy + dz * dz;
    }

    function clampColor(value, fallback) {
        var numberValue = Number(value);
        if (!isFinite(numberValue)) return fallback;
        return Math.max(0, Math.min(1, numberValue));
    }

    function normalizeColor(rawColor) {
        if (!Array.isArray(rawColor) || rawColor.length < 3) {
            return ${JSON.stringify(RP_SCENE_MARKER_COLOR)};
        }

        return [
            clampColor(rawColor[0], 1),
            clampColor(rawColor[1], 0.86),
            clampColor(rawColor[2], 0.34),
            rawColor[3] === undefined ? 0.96 : clampColor(rawColor[3], 0.96)
        ];
    }

    var playerPos = getPlayerPos();
    if (!playerPos) {
        removeRoleplaySceneTexts();
        return;
    }

    var resolution = ctx.state.screenResolution;
    var textIdsByScene = ctx.state.roleplaySceneTextIds || {};
    var activeSceneKeys = {};
    var now = Date.now();

    for (var sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
        var scene = scenes[sceneIndex] || {};
        var sceneId = scene.id === undefined || scene.id === null ? "" : String(scene.id);
        var pos = Array.isArray(scene.pos) ? scene.pos : [];
        if (!sceneId || pos.length < 3) continue;

        var expiresAt = Number(scene.expiresAt) || 0;
        if (expiresAt && now > expiresAt) continue;

        var scenePos = [Number(pos[0]), Number(pos[1]), Number(pos[2])];
        if (!isFinite(scenePos[0]) || !isFinite(scenePos[1]) || !isFinite(scenePos[2])) continue;

        var maxDistance = Math.max(
            Number(scene.renderRadius) || ${RP_SCENE_RENDER_RADIUS},
            ${RP_SCENE_TRIGGER_RADIUS}
        );
        if (distanceSquared(playerPos, scenePos) > maxDistance * maxDistance) continue;

        var markerWorldPoint = [
            scenePos[0],
            scenePos[1],
            scenePos[2] + ${RP_SCENE_MARKER_Z_OFFSET}
        ];

        var screenPos = null;
        try {
            screenPos = ctx.sp.worldPointToScreenPoint(markerWorldPoint)[0];
        } catch (e) {
            screenPos = null;
        }

        if (!screenPos || screenPos[2] <= 0) continue;

        activeSceneKeys[sceneId] = true;
        var textXPos = Math.round(screenPos[0] * resolution.width);
        var textYPos = Math.round((1 - screenPos[1]) * resolution.height);
        var displayColor = normalizeColor(scene.color);

        if (!textIdsByScene[sceneId]) {
            textIdsByScene[sceneId] = ctx.sp.createText(textXPos, textYPos, "?", displayColor, "Tavern");
            try { ctx.sp.setTextFont(textIdsByScene[sceneId], "Tavern"); } catch (e) {}
            try { ctx.sp.setTextSize(textIdsByScene[sceneId], 1.15); } catch (e) {}
            try { if (ctx.sp.setTextOrigin) ctx.sp.setTextOrigin(textIdsByScene[sceneId], [0.5, 0.5]); } catch (e) {}
        } else {
            ctx.sp.setTextString(textIdsByScene[sceneId], "?");
            if (ctx.sp.setTextColor) ctx.sp.setTextColor(textIdsByScene[sceneId], displayColor);
            ctx.sp.setTextPos(textIdsByScene[sceneId], textXPos, textYPos);
        }
    }

    Object.keys(textIdsByScene).forEach(function(sceneId) {
        if (activeSceneKeys[sceneId]) return;
        destroySceneText(textIdsByScene[sceneId]);
        delete textIdsByScene[sceneId];
    });

    ctx.state.roleplaySceneTextIds = textIdsByScene;
`.trim();

const ADMIN_STEALTH_UPDATE_JS = `
    var enabled = String(ctx.value || "").trim() === "1";
    if (ctx.state.lastAdminStealthEnabled === enabled) return;
    ctx.state.lastAdminStealthEnabled = enabled;

    if (!ctx.refr) return;

    try {
        if (ctx.refr.setAlpha) {
            ctx.refr.setAlpha(enabled ? 0 : 1, false);
        }
    } catch (e) {}

    try {
        if (ctx.sp && ctx.sp.setCollision && ctx.refr.getFormID) {
            ctx.sp.setCollision(ctx.refr.getFormID(), !enabled);
        }
    } catch (e) {}
`.trim();

const ADMIN_PANEL_UPDATE_OWNER_JS = `
    var adminPanelValue = ctx.value === undefined || ctx.value === null ? "" : String(ctx.value);
    if (ctx.state.lastAdminPanelValue === adminPanelValue) return;
    ctx.state.lastAdminPanelValue = adminPanelValue;

    if (adminPanelValue.trim() === "") {
        if (ctx.sp.browser) {
            ctx.sp.browser.executeJavaScript("(function(){var p=document.getElementById('skrp-admin-panel');var wasOpen=window.__skrpAdminPanelOpen===true||(p&&p.style.display!=='none');window.__skrpAdminPanelOpen=false;window.__skrpAdminPanelPayloadJson='';if(window._skrpCloseAdminPanel){if(wasOpen)window._skrpCloseAdminPanel();return;}if(p)p.style.display='none';try{if(wasOpen&&window.skyrimPlatform&&window.skyrimPlatform.sendMessage)window.skyrimPlatform.sendMessage('rpAdminPanelClose','panel-empty');}catch(e){}})();");
        }
        return;
    }

    if (!ctx.sp.browser) return;

    var panelPayload = {};
    try {
        panelPayload = JSON.parse(String(adminPanelValue || "{}"));
    } catch (e) {
        panelPayload = { admins: [] };
    }

    var script = [
        "(function() {",
        "  var payload = " + JSON.stringify(panelPayload) + ";",
        "  function setText(el, text) { el.textContent = text == null ? '' : String(text); }",
        "  function clearNode(node) { while (node.firstChild) node.removeChild(node.firstChild); }",
        "  function appendMany(parent) { for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]); }",
        "  function hasViewerPermission(permission) {",
        "    var viewer = payload.viewer || {};",
        "    var permissions = Array.isArray(viewer.permissions) ? viewer.permissions : [];",
        "    return permissions.indexOf(permission) !== -1;",
        "  }",
        "  function runAdminCommand(commandText) {",
        "    try {",
        "      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {",
        "        window.skyrimPlatform.sendMessage('rpChatSubmit', JSON.stringify({ id: 'admin-panel:' + Date.now() + ':' + Math.random(), text: commandText }));",
        "      }",
        "    } catch (e) {}",
        "  }",
        "  function prefillCommand(commandText) {",
        "    closePanel();",
        "    try {",
        "      if (window._skrpOpenChat) { window._skrpOpenChat(commandText); return; }",
        "    } catch (e) {}",
        "    runAdminCommand(commandText);",
        "  }",
        "  function styleMiniButton(button, tone) {",
        "    button.style.display = 'flex';",
        "    button.style.alignItems = 'center';",
        "    button.style.justifyContent = 'center';",
        "    button.style.width = '100%';",
        "    button.style.minHeight = '52px';",
        "    button.style.boxSizing = 'border-box';",
        "    button.style.padding = '14px 14px';",
        "    button.style.borderRadius = '6px';",
        "    button.style.border = tone === 'danger' ? '1px solid rgba(213,107,107,0.45)' : '1px solid rgba(255,255,255,0.12)';",
        "    button.style.background = tone === 'danger' ? 'rgba(120,45,45,0.42)' : 'rgba(255,255,255,0.075)';",
        "    button.style.color = tone === 'danger' ? '#ffd5d5' : '#eef1f0';",
        "    button.style.fontSize = '14px';",
        "    button.style.fontWeight = '850';",
        "    button.style.lineHeight = '1.05';",
        "    button.style.cursor = 'pointer';",
        "    button.style.pointerEvents = 'auto';",
        "    button.style.textTransform = 'uppercase';",
        "  }",
        "  function makeMiniButton(label, onClick, tone) {",
        "    var button = document.createElement('button');",
        "    button.type = 'button';",
        "    button.textContent = label;",
        "    styleMiniButton(button, tone);",
        "    button.onclick = function(event) { event.preventDefault(); event.stopPropagation(); onClick(); };",
        "    return button;",
        "  }",
        "  function styleField(field) {",
        "    field.style.minHeight = '34px';",
        "    field.style.boxSizing = 'border-box';",
        "    field.style.border = '1px solid rgba(255,255,255,0.12)';",
        "    field.style.borderRadius = '6px';",
        "    field.style.background = 'rgba(0,0,0,0.24)';",
        "    field.style.color = '#eef1f0';",
        "    field.style.padding = '7px 9px';",
        "    field.style.fontFamily = 'Consolas, monospace';",
        "    field.style.fontSize = '12px';",
        "    field.style.outline = 'none';",
        "  }",
        "  function closePanel() {",
        "    var panel = document.getElementById('skrp-admin-panel');",
        "    var wasOpen = window.__skrpAdminPanelOpen === true || (panel && panel.style.display !== 'none');",
        "    window.__skrpAdminPanelOpen = false;",
        "    window.__skrpAdminPanelPayloadJson = '';",
        "    if (window.__skrpAdminPanelSeq !== undefined) window.__skrpAdminPanelClosedSeq = window.__skrpAdminPanelSeq;",
        "    if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();",
        "    if (panel) panel.style.display = 'none';",
        "    if (!wasOpen) return;",
        "    try {",
        "      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {",
        "        window.skyrimPlatform.sendMessage('rpAdminPanelClose', 'panel-close');",
        "      }",
        "    } catch (e) {}",
        "  }",
        "  window._skrpCloseAdminPanel = closePanel;",
        "  var previousSeq = window.__skrpAdminPanelSeq;",
        "  var payloadJson = '';",
        "  try { payloadJson = JSON.stringify(payload); } catch (e) { payloadJson = String(payload && payload.seq || ''); }",
        "  var root = document.getElementById('skrp-admin-panel');",
        "  if (!root) {",
        "    root = document.createElement('div');",
        "    root.id = 'skrp-admin-panel';",
        "    root.style.position = 'fixed';",
        "    root.style.inset = '0';",
        "    root.style.display = 'none';",
        "    root.style.padding = '16px';",
        "    root.style.boxSizing = 'border-box';",
        "    root.style.zIndex = '2147483646';",
        "    root.style.pointerEvents = 'auto';",
        "    root.style.background = 'transparent';",
        "    root.style.alignItems = 'center';",
        "    root.style.justifyContent = 'center';",
        "    root.style.contain = 'layout style paint';",
        "    document.body.appendChild(root);",
        "    root.addEventListener('click', function(event) {",
        "      if (event.target === root) closePanel();",
        "    });",
        "    document.addEventListener('keydown', function(event) {",
        "      if (event.key === 'Escape') {",
        "        var panel = document.getElementById('skrp-admin-panel');",
        "        if (panel && panel.style.display !== 'none') closePanel();",
        "        return;",
        "      }",
        "      if ((event.key === 'F3' || event.key === 'F4') && (window.__skrpAdminPanelOpen || (root && root.style.display !== 'none'))) {",
        "        event.preventDefault();",
        "        event.stopPropagation();",
        "        if (event.stopImmediatePropagation) event.stopImmediatePropagation();",
        "        if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {",
        "          window.skyrimPlatform.sendMessage(event.key === 'F4' ? 'rpCloseAllUi' : 'rpToggleCursorUi', 'admin-panel-hotkey');",
        "        }",
        "      }",
        "    }, true);",
        "  }",
        "  if (payload.seq !== undefined && window.__skrpAdminPanelClosedSeq === payload.seq) {",
        "    window.__skrpAdminPanelOpen = false;",
        "    window.__skrpAdminPanelPayloadJson = payloadJson;",
        "    if (root) root.style.display = 'none';",
        "    return;",
        "  }",
        "  var alreadyOpenSamePayload = window.__skrpAdminPanelOpen === true && root && root.style.display !== 'none' && window.__skrpAdminPanelPayloadJson === payloadJson;",
        "  if (alreadyOpenSamePayload) return;",
        "  var shouldNotifyOpen = !(window.__skrpAdminPanelOpen === true && previousSeq === payload.seq);",
        "  window.__skrpAdminPanelSeq = payload.seq;",
        "  window.__skrpAdminPanelPayloadJson = payloadJson;",
        "  window.__skrpAdminPanelOpen = true;",
        "  root.style.display = 'flex';",
        "  try {",
        "    if (shouldNotifyOpen && window.skyrimPlatform && window.skyrimPlatform.sendMessage) {",
        "      window.skyrimPlatform.sendMessage('rpAdminPanelOpen', 'panel-open');",
        "    }",
        "  } catch (e) {}",
        "  clearNode(root);",
        "  var isPublic = payload.mode === 'public';",
        "  var panel = document.createElement('div');",
        "  panel.id = 'skrp-admin-panel-card';",
        "  panel.style.position = 'relative';",
        "  panel.style.width = isPublic ? 'min(744px, calc(100vw - 32px))' : 'min(1224px, calc(100vw - 32px))';",
        "  panel.style.maxHeight = 'min(864px, calc(100vh - 32px))';",
        "  panel.style.overflow = 'hidden';",
        "  panel.style.border = '1px solid rgba(255,255,255,0.12)';",
        "  panel.style.borderRadius = '8px';",
        "  panel.style.background = 'rgba(18,20,22,0.94)';",
        "  panel.style.boxShadow = '0 8px 22px rgba(0,0,0,0.34)';",
        "  panel.style.color = '#eef1f0';",
        "  panel.style.fontFamily = 'Din-pro, Trebuchet MS, Arial, sans-serif';",
        "  panel.style.pointerEvents = 'auto';",
        "  panel.style.contain = 'layout style paint';",
        "  panel.addEventListener('click', function(event) { event.stopPropagation(); });",
        "  var header = document.createElement('div');",
        "  header.style.display = 'flex';",
        "  header.style.alignItems = 'center';",
        "  header.style.justifyContent = 'space-between';",
        "  header.style.gap = '18px';",
        "  header.style.padding = '20px 22px 15px';",
        "  header.style.borderBottom = '1px solid rgba(255,255,255,0.1)';",
        "  header.style.background = '#202326';",
        "  var titleWrap = document.createElement('div');",
        "  var eyebrow = document.createElement('div');",
        "  eyebrow.textContent = isPublic ? 'Staff Availability' : 'Staff Panel';",
        "  eyebrow.style.color = '#4e9a66';",
        "  eyebrow.style.fontSize = '12px';",
        "  eyebrow.style.fontWeight = '800';",
        "  eyebrow.style.textTransform = 'uppercase';",
        "  var title = document.createElement('div');",
        "  title.textContent = isPublic ? 'Admins' : 'Admin Commands';",
        "  title.style.fontSize = '24px';",
        "  title.style.fontWeight = '800';",
        "  title.style.marginTop = '5px';",
        "  appendMany(titleWrap, eyebrow, title);",
        "  var close = document.createElement('button');",
        "  close.type = 'button';",
        "  close.textContent = 'X';",
        "  close.style.width = '58px';",
        "  close.style.height = '58px';",
        "  close.style.borderRadius = '6px';",
        "  close.style.border = '1px solid rgba(255,255,255,0.12)';",
        "  close.style.background = '#2b2f30';",
        "  close.style.color = '#ffd5d5';",
        "  close.style.fontWeight = '800';",
        "  close.style.cursor = 'pointer';",
        "  close.onclick = function(event) { event.preventDefault(); event.stopPropagation(); closePanel(); };",
        "  appendMany(header, titleWrap, close);",
        "  panel.appendChild(header);",
        "  var admins = Array.isArray(payload.admins) ? payload.admins : [];",
        "  var commands = Array.isArray(payload.commands) ? payload.commands : [];",
        "  var players = Array.isArray(payload.players) ? payload.players : [];",
        "  var itemCatalog = Array.isArray(payload.itemCatalog) ? payload.itemCatalog : [];",
        "  var viewer = payload.viewer || null;",
        "  var onDuty = admins.filter(function(admin) { return !!admin.onDuty; }).length;",
        "  var offlineCount = Math.max(0, Number(payload.offlineCount) || 0);",
        "  var summary = document.createElement('div');",
        "  summary.style.display = 'grid';",
        "  summary.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';",
        "  summary.style.borderBottom = '1px solid rgba(255,255,255,0.08)';",
        "  function stat(value, label) {",
        "    var cell = document.createElement('div');",
        "    cell.style.padding = '14px 22px';",
        "    var strong = document.createElement('div');",
        "    strong.style.fontSize = '28px';",
        "    strong.style.fontWeight = '850';",
        "    setText(strong, value);",
        "    var small = document.createElement('div');",
        "    small.style.marginTop = '5px';",
        "    small.style.color = '#aab2ad';",
        "    small.style.fontSize = '12px';",
        "    small.style.fontWeight = '800';",
        "    small.style.textTransform = 'uppercase';",
        "    setText(small, label);",
        "    appendMany(cell, strong, small);",
        "    return cell;",
        "  }",
        "  if (isPublic) {",
        "    appendMany(summary, stat(admins.length, 'online'), stat(onDuty, 'on duty'), stat(offlineCount, 'offline'));",
        "  } else {",
        "    appendMany(summary, stat(players.length || admins.length, 'players'), stat(onDuty, 'on duty'), stat(commands.length, 'commands'));",
        "  }",
        "  panel.appendChild(summary);",
        "  if (isPublic) {",
        "    var publicList = document.createElement('div');",
        "    publicList.style.display = 'grid';",
        "    publicList.style.gap = '8px';",
        "    publicList.style.maxHeight = '564px';",
        "    publicList.style.overflowY = 'auto';",
        "    publicList.style.padding = '14px';",
        "    if (!admins.length) {",
        "      var emptyPublic = document.createElement('div');",
        "      emptyPublic.textContent = 'No admins are online.';",
        "      emptyPublic.style.padding = '36px 16px';",
        "      emptyPublic.style.color = '#aab2ad';",
        "      emptyPublic.style.textAlign = 'center';",
        "      emptyPublic.style.fontWeight = '700';",
        "      publicList.appendChild(emptyPublic);",
        "    }",
        "    admins.forEach(function(admin) {",
        "      var row = document.createElement('div');",
        "      row.style.display = 'grid';",
        "      row.style.gridTemplateColumns = 'minmax(0,1fr) auto';",
        "      row.style.alignItems = 'center';",
        "      row.style.gap = '14px';",
        "      row.style.minHeight = '64px';",
        "      row.style.padding = '12px 14px';",
        "      row.style.border = '1px solid rgba(255,255,255,0.09)';",
        "      row.style.borderRadius = '8px';",
        "      row.style.background = 'rgba(255,255,255,0.035)';",
        "      var detail = document.createElement('div');",
        "      var name = document.createElement('div');",
        "      name.style.overflow = 'hidden';",
        "      name.style.textOverflow = 'ellipsis';",
        "      name.style.whiteSpace = 'nowrap';",
        "      name.style.fontSize = '16px';",
        "      name.style.fontWeight = '800';",
        "      setText(name, admin.username || 'Unknown Admin');",
        "      var meta = document.createElement('div');",
        "      meta.style.marginTop = '7px';",
        "      meta.style.color = '#aab2ad';",
        "      meta.style.fontSize = '12px';",
        "      meta.style.fontWeight = '700';",
        "      var pingText = admin.ping === null || admin.ping === undefined ? 'N/A' : String(admin.ping) + 'ms';",
        "      setText(meta, (admin.roleName || 'Staff') + ' | ID ' + admin.userId + ' | Ping ' + pingText);",
        "      appendMany(detail, name, meta);",
        "      var badge = document.createElement('div');",
        "      badge.style.minHeight = '24px';",
        "      badge.style.padding = '5px 10px 0';",
        "      badge.style.borderRadius = '999px';",
        "      badge.style.fontSize = '11px';",
        "      badge.style.fontWeight = '850';",
        "      badge.style.textTransform = 'uppercase';",
        "      badge.style.border = admin.onDuty ? '1px solid rgba(78,154,102,0.45)' : '1px solid rgba(211,163,77,0.42)';",
        "      badge.style.background = admin.onDuty ? 'rgba(78,154,102,0.18)' : 'rgba(211,163,77,0.16)';",
        "      badge.style.color = admin.onDuty ? '#dff2e4' : '#ffe7b8';",
        "      setText(badge, admin.onDuty ? 'On Duty' : 'Off Duty');",
        "      appendMany(row, detail, badge);",
        "      publicList.appendChild(row);",
        "    });",
        "    panel.appendChild(publicList);",
        "    root.appendChild(panel);",
        "    return;",
        "  }",
        "  var content = document.createElement('div');",
        "  content.style.display = 'grid';",
        "  content.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(0, 1fr)';",
        "  content.style.gap = '1px';",
        "  content.style.background = 'rgba(255,255,255,0.08)';",
        "  content.style.maxHeight = '564px';",
        "  content.style.overflow = 'hidden';",
        "  function makeSection(titleText) {",
        "    var section = document.createElement('div');",
        "    section.style.minWidth = '0';",
        "    section.style.background = 'rgba(18,20,22,0.88)';",
        "    var title = document.createElement('div');",
        "    title.style.padding = '13px 14px 10px';",
        "    title.style.borderBottom = '1px solid rgba(255,255,255,0.08)';",
        "    title.style.color = '#dfe7e2';",
        "    title.style.fontSize = '12px';",
        "    title.style.fontWeight = '850';",
        "    title.style.textTransform = 'uppercase';",
        "    setText(title, titleText);",
        "    var list = document.createElement('div');",
        "    list.style.display = 'grid';",
        "    list.style.gap = '8px';",
        "    list.style.maxHeight = '504px';",
        "    list.style.overflowY = 'auto';",
        "    list.style.padding = '14px';",
        "    appendMany(section, title, list);",
        "    return { section: section, list: list };",
        "  }",
        "  var staffSection = makeSection('Online Players');",
        "  var commandSection = makeSection(viewer ? 'Your Commands | ' + (viewer.roleName || 'Staff') : 'Your Commands');",
        "  var list = staffSection.list;",
        "  var playerList = players.length ? players : admins;",
        "  if (!playerList.length) {",
        "    var empty = document.createElement('div');",
        "    empty.textContent = 'No players online.';",
        "    empty.style.padding = '36px 16px';",
        "    empty.style.color = '#aab2ad';",
        "    empty.style.textAlign = 'center';",
        "    empty.style.fontWeight = '700';",
        "    list.appendChild(empty);",
        "  }",
        "  playerList.forEach(function(player) {",
        "    var row = document.createElement('div');",
        "    row.style.display = 'grid';",
        "    row.style.gridTemplateColumns = 'minmax(0,1fr) minmax(220px, auto)';",
        "    row.style.alignItems = 'start';",
        "    row.style.gap = '14px';",
        "    row.style.minHeight = '132px';",
        "    row.style.padding = '12px 14px';",
        "    row.style.border = '1px solid rgba(255,255,255,0.09)';",
        "    row.style.borderRadius = '8px';",
        "    row.style.background = 'rgba(255,255,255,0.035)';",
        "    var detail = document.createElement('div');",
        "    var name = document.createElement('div');",
        "    name.style.overflow = 'hidden';",
        "    name.style.textOverflow = 'ellipsis';",
        "    name.style.whiteSpace = 'nowrap';",
        "    name.style.fontSize = '16px';",
        "    name.style.fontWeight = '800';",
        "    setText(name, player.characterName || player.displayName || player.username || 'Unknown Player');",
        "    var meta = document.createElement('div');",
        "    meta.style.marginTop = '7px';",
        "    meta.style.color = '#aab2ad';",
        "    meta.style.fontSize = '12px';",
        "    meta.style.fontWeight = '700';",
        "    var pingText = player.ping === null || player.ping === undefined ? 'N/A' : String(player.ping) + 'ms';",
        "    var bits = ['ID ' + player.userId, 'Ping ' + pingText];",
        "    if (player.username && player.username !== player.characterName) bits.push(player.username);",
        "    if (player.isStaff) bits.push(player.roleName || 'Staff');",
        "    if (player.onDuty) bits.push('Duty');",
        "    if (player.invisible) bits.push('Invisible');",
        "    setText(meta, bits.join(' | '));",
        "    appendMany(detail, name, meta);",
        "    var actions = document.createElement('div');",
        "    actions.style.display = 'grid';",
        "    actions.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';",
        "    actions.style.gap = '10px';",
        "    var playerId = String(player.userId);",
        "    if (hasViewerPermission('teleport.force')) {",
        "      actions.appendChild(makeMiniButton('Goto', function() { runAdminCommand('/goto ' + playerId); }));",
        "      actions.appendChild(makeMiniButton('Bring', function() { runAdminCommand('/bring ' + playerId); }));",
        "    }",
        "    if (hasViewerPermission('moderation.freeze')) {",
        "      actions.appendChild(makeMiniButton('Freeze', function() { runAdminCommand('/freeze ' + playerId); }));",
        "      actions.appendChild(makeMiniButton('Unfreeze', function() { runAdminCommand('/unfreeze ' + playerId); }));",
        "    }",
        "    if (hasViewerPermission('inventory.restore')) {",
        "      actions.appendChild(makeMiniButton('Heal', function() { runAdminCommand('/heal ' + playerId); }));",
        "      actions.appendChild(makeMiniButton('Revive', function() { runAdminCommand('/revive ' + playerId); }));",
        "    }",
        "    if (hasViewerPermission('moderation.kick')) {",
        "      actions.appendChild(makeMiniButton('Kick', function() { prefillCommand('/akick ' + playerId + ' '); }, 'danger'));",
        "    }",
        "    if (!actions.children.length) {",
        "      var badge = document.createElement('div');",
        "      badge.style.minHeight = '24px';",
        "      badge.style.padding = '5px 10px 0';",
        "      badge.style.borderRadius = '999px';",
        "      badge.style.fontSize = '11px';",
        "      badge.style.fontWeight = '850';",
        "      badge.style.textTransform = 'uppercase';",
        "      badge.style.border = player.onDuty ? '1px solid rgba(78,154,102,0.45)' : '1px solid rgba(149,168,182,0.35)';",
        "      badge.style.background = player.onDuty ? 'rgba(78,154,102,0.18)' : 'rgba(149,168,182,0.13)';",
        "      badge.style.color = player.onDuty ? '#dff2e4' : '#dbe6ee';",
        "      setText(badge, player.onDuty ? 'On Duty' : 'Online');",
        "      actions.appendChild(badge);",
        "    }",
        "    appendMany(row, detail, actions);",
        "    list.appendChild(row);",
        "  });",
        "  var commandList = commandSection.list;",
        "  commandList.style.gap = '10px';",
        "  var tabBar = document.createElement('div');",
        "  tabBar.style.display = 'grid';",
        "  tabBar.style.gridTemplateColumns = hasViewerPermission('inventory.restore') ? 'repeat(2, minmax(0, 1fr))' : '1fr';",
        "  tabBar.style.gap = '8px';",
        "  var commandsPane = document.createElement('div');",
        "  commandsPane.style.display = 'grid';",
        "  commandsPane.style.gap = '8px';",
        "  var itemsPane = document.createElement('div');",
        "  itemsPane.style.display = 'grid';",
        "  itemsPane.style.gap = '8px';",
        "  function styleTab(button, active) {",
        "    button.style.minHeight = '52px';",
        "    button.style.borderRadius = '6px';",
        "    button.style.border = active ? '1px solid rgba(78,154,102,0.55)' : '1px solid rgba(255,255,255,0.11)';",
        "    button.style.background = active ? 'rgba(78,154,102,0.2)' : 'rgba(255,255,255,0.055)';",
        "    button.style.color = active ? '#e7f6ea' : '#aab2ad';",
        "    button.style.fontWeight = '850';",
        "    button.style.fontSize = '14px';",
        "    button.style.cursor = 'pointer';",
        "    button.style.textTransform = 'uppercase';",
        "  }",
        "  function setAdminTab(tab) {",
        "    window.__skrpAdminPanelTab = tab;",
        "    commandsPane.style.display = tab === 'items' ? 'none' : 'grid';",
        "    itemsPane.style.display = tab === 'items' ? 'grid' : 'none';",
        "    styleTab(commandsTab, tab !== 'items');",
        "    styleTab(itemsTab, tab === 'items');",
        "  }",
        "  var commandsTab = document.createElement('button');",
        "  commandsTab.type = 'button';",
        "  commandsTab.textContent = 'Commands';",
        "  var itemsTab = document.createElement('button');",
        "  itemsTab.type = 'button';",
        "  itemsTab.textContent = 'Item Spawn';",
        "  commandsTab.onclick = function(event) { event.preventDefault(); event.stopPropagation(); setAdminTab('commands'); };",
        "  itemsTab.onclick = function(event) { event.preventDefault(); event.stopPropagation(); setAdminTab('items'); };",
        "  tabBar.appendChild(commandsTab);",
        "  if (hasViewerPermission('inventory.restore')) tabBar.appendChild(itemsTab);",
        "  commandList.appendChild(tabBar);",
        "  commandList.appendChild(commandsPane);",
        "  if (hasViewerPermission('inventory.restore')) commandList.appendChild(itemsPane);",
        "  if (viewer) {",
        "    var quickActions = document.createElement('div');",
        "    quickActions.style.display = 'grid';",
        "    quickActions.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';",
        "    quickActions.style.gap = '10px';",
        "    quickActions.appendChild(makeMiniButton(viewer.onDuty ? 'Off Duty' : 'Aduty', function() { runAdminCommand('/aduty'); }));",
        "    if (hasViewerPermission('teleport.force')) {",
        "      quickActions.appendChild(makeMiniButton(viewer.invisible ? 'Visible' : 'Invisible', function() { runAdminCommand('/invisible'); }));",
        "    }",
        "    if (hasViewerPermission('inventory.restore')) {",
        "      quickActions.appendChild(makeMiniButton('Heal Me', function() { runAdminCommand('/heal me'); }));",
        "    }",
        "    commandsPane.appendChild(quickActions);",
        "  }",
        "  if (!viewer) {",
        "    var noAccess = document.createElement('div');",
        "    noAccess.textContent = 'No admin command access.';",
        "    noAccess.style.padding = '36px 16px';",
        "    noAccess.style.color = '#aab2ad';",
        "    noAccess.style.textAlign = 'center';",
        "    noAccess.style.fontWeight = '700';",
        "    commandsPane.appendChild(noAccess);",
        "  } else if (!commands.length) {",
        "    var noCommands = document.createElement('div');",
        "    noCommands.textContent = 'No commands available for this role.';",
        "    noCommands.style.padding = '36px 16px';",
        "    noCommands.style.color = '#aab2ad';",
        "    noCommands.style.textAlign = 'center';",
        "    noCommands.style.fontWeight = '700';",
        "    commandsPane.appendChild(noCommands);",
        "  }",
        "  commands.forEach(function(command) {",
        "    var row = document.createElement('div');",
        "    row.style.display = 'grid';",
        "    row.style.gap = '9px';",
        "    row.style.minHeight = '78px';",
        "    row.style.padding = '12px 14px';",
        "    row.style.border = '1px solid rgba(255,255,255,0.09)';",
        "    row.style.borderRadius = '8px';",
        "    row.style.background = 'rgba(255,255,255,0.035)';",
        "    var top = document.createElement('div');",
        "    top.style.display = 'grid';",
        "    top.style.gridTemplateColumns = 'minmax(0, 1fr) auto';",
        "    top.style.gap = '10px';",
        "    top.style.alignItems = 'start';",
        "    var usage = document.createElement('div');",
        "    usage.style.minWidth = '0';",
        "    usage.style.color = '#eef1f0';",
        "    usage.style.fontFamily = 'Consolas, monospace';",
        "    usage.style.fontSize = '13px';",
        "    usage.style.fontWeight = '800';",
        "    usage.style.lineHeight = '1.35';",
        "    usage.style.overflowWrap = 'anywhere';",
        "    setText(usage, command.usage || ('/' + (command.name || 'command')));",
        "    var badges = document.createElement('div');",
        "    badges.style.display = 'flex';",
        "    badges.style.flexWrap = 'wrap';",
        "    badges.style.justifyContent = 'flex-end';",
        "    badges.style.gap = '6px';",
        "    function smallBadge(text, color, border, background) {",
        "      var badge = document.createElement('div');",
        "      badge.style.minHeight = '22px';",
        "      badge.style.padding = '4px 8px 0';",
        "      badge.style.borderRadius = '999px';",
        "      badge.style.border = border;",
        "      badge.style.background = background;",
        "      badge.style.color = color;",
        "      badge.style.fontSize = '10px';",
        "      badge.style.fontWeight = '850';",
        "      badge.style.textTransform = 'uppercase';",
        "      setText(badge, text);",
        "      return badge;",
        "    }",
        "    var minRole = command.minimumRole && command.minimumRole.name ? command.minimumRole.name : (command.public ? 'Public' : 'Staff');",
        "    badges.appendChild(smallBadge(minRole, '#dbe6ee', '1px solid rgba(149,168,182,0.35)', 'rgba(149,168,182,0.13)'));",
        "    if (command.dutyOnly) badges.appendChild(smallBadge('Duty', '#dff2e4', '1px solid rgba(78,154,102,0.45)', 'rgba(78,154,102,0.18)'));",
        "    appendMany(top, usage, badges);",
        "    var description = document.createElement('div');",
        "    description.style.color = '#aab2ad';",
        "    description.style.fontSize = '13px';",
        "    description.style.fontWeight = '650';",
        "    description.style.lineHeight = '1.45';",
        "    setText(description, command.description || 'No description available.');",
        "    appendMany(row, top, description);",
        "    commandsPane.appendChild(row);",
        "  });",
        "  if (hasViewerPermission('inventory.restore')) {",
        "    var controls = document.createElement('div');",
        "    controls.style.display = 'grid';",
        "    controls.style.gridTemplateColumns = '86px 1fr 72px';",
        "    controls.style.gap = '8px';",
        "    var targetField = document.createElement('input');",
        "    targetField.id = 'skrp-admin-item-target';",
        "    targetField.value = viewer && viewer.userId !== undefined ? String(viewer.userId) : 'me';",
        "    targetField.placeholder = 'ID';",
        "    styleField(targetField);",
        "    var searchField = document.createElement('input');",
        "    searchField.id = 'skrp-admin-item-search';",
        "    searchField.placeholder = 'Search item';",
        "    styleField(searchField);",
        "    var countField = document.createElement('input');",
        "    countField.id = 'skrp-admin-item-count';",
        "    countField.type = 'number';",
        "    countField.min = '1';",
        "    countField.max = '9999';",
        "    countField.value = '1';",
        "    styleField(countField);",
        "    appendMany(controls, targetField, searchField, countField);",
        "    var results = document.createElement('div');",
        "    results.style.display = 'grid';",
        "    results.style.gap = '8px';",
        "    function renderItemResults() {",
        "      clearNode(results);",
        "      var needle = String(searchField.value || '').toLowerCase().trim();",
        "      var shown = 0;",
        "      for (var itemIndex = 0; itemIndex < itemCatalog.length && shown < 45; itemIndex++) {",
        "        var item = itemCatalog[itemIndex] || {};",
        "        var haystack = String(item.search || ((item.formIdHex || '') + ' ' + (item.editorId || '') + ' ' + (item.name || '') + ' ' + (item.typeName || ''))).toLowerCase();",
        "        if (needle && haystack.indexOf(needle) === -1) continue;",
        "        shown += 1;",
        "        var row = document.createElement('div');",
        "        row.style.display = 'grid';",
        "        row.style.gridTemplateColumns = 'minmax(0, 1fr) auto';",
        "        row.style.alignItems = 'center';",
        "        row.style.gap = '10px';",
        "        row.style.minHeight = '76px';",
        "        row.style.padding = '10px 12px';",
        "        row.style.border = '1px solid rgba(255,255,255,0.09)';",
        "        row.style.borderRadius = '8px';",
        "        row.style.background = 'rgba(255,255,255,0.035)';",
        "        var detail = document.createElement('div');",
        "        detail.style.minWidth = '0';",
        "        var itemName = document.createElement('div');",
        "        itemName.style.overflow = 'hidden';",
        "        itemName.style.textOverflow = 'ellipsis';",
        "        itemName.style.whiteSpace = 'nowrap';",
        "        itemName.style.fontSize = '14px';",
        "        itemName.style.fontWeight = '850';",
        "        setText(itemName, item.name || item.editorId || item.formIdHex || 'Item');",
        "        var itemMeta = document.createElement('div');",
        "        itemMeta.style.marginTop = '6px';",
        "        itemMeta.style.color = '#aab2ad';",
        "        itemMeta.style.fontFamily = 'Consolas, monospace';",
        "        itemMeta.style.fontSize = '11px';",
        "        itemMeta.style.fontWeight = '700';",
        "        setText(itemMeta, (item.formIdHex || '') + (item.editorId ? ' | ' + item.editorId : '') + (item.typeName ? ' | ' + item.typeName : ''));",
        "        appendMany(detail, itemName, itemMeta);",
        "        var spawnButton = makeMiniButton('Spawn', function(selectedItem) {",
        "          return function() {",
        "            var target = String(targetField.value || 'me').trim() || 'me';",
        "            var count = Math.max(1, Math.min(9999, parseInt(countField.value || '1', 10) || 1));",
        "            runAdminCommand('/giveitem ' + target + ' ' + (selectedItem.formIdHex || selectedItem.formId) + ' ' + count);",
        "          };",
        "        }(item));",
        "        appendMany(row, detail, spawnButton);",
        "        results.appendChild(row);",
        "      }",
        "      if (!shown) {",
        "        var emptyItems = document.createElement('div');",
        "        emptyItems.style.padding = '34px 16px';",
        "        emptyItems.style.color = '#aab2ad';",
        "        emptyItems.style.textAlign = 'center';",
        "        emptyItems.style.fontWeight = '700';",
        "        setText(emptyItems, itemCatalog.length ? 'No items found.' : 'Item database unavailable.');",
        "        results.appendChild(emptyItems);",
        "      }",
        "    }",
        "    searchField.oninput = renderItemResults;",
        "    appendMany(itemsPane, controls, results);",
        "    renderItemResults();",
        "  }",
        "  setAdminTab(window.__skrpAdminPanelTab === 'items' && hasViewerPermission('inventory.restore') ? 'items' : 'commands');",
        "  appendMany(content, staffSection.section, commandSection.section);",
        "  panel.appendChild(content);",
        "  root.appendChild(panel);",
        "})();"
    ].join("\\n");

    try {
        if (ctx.sp.browser.setVisible) ctx.sp.browser.setVisible(true);
        ctx.sp.browser.executeJavaScript(script);
    } catch (e) {}
`.trim();

mp.makeProperty("ff_chatMsg", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: UPDATE_OWNER_JS,
    updateNeighbor: ``
});

mp.makeProperty("rp_chatUi", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: CHAT_UI_UPDATE_OWNER_JS,
    updateNeighbor: ``
});

mp.makeProperty("rp_chatSettings", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: CHAT_SETTINGS_UPDATE_OWNER_JS,
    updateNeighbor: ``
});

mp.makeProperty("rp_chatTyping", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: true,
    updateOwner: TYPING_UPDATE_NEIGHBOR_JS,
    updateNeighbor: TYPING_UPDATE_NEIGHBOR_JS
});

mp.makeProperty("rp_ameText", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: true,
    updateOwner: AME_UPDATE_NEIGHBOR_JS,
    updateNeighbor: AME_UPDATE_NEIGHBOR_JS
});

mp.makeProperty("rp_nameplateOwner", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: true,
    updateOwner: OWNER_NAMEPLATE_UPDATE_JS,
    updateNeighbor: OWNER_NAMEPLATE_UPDATE_JS
});

mp.makeProperty("rp_adminStealth", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: true,
    updateOwner: ADMIN_STEALTH_UPDATE_JS,
    updateNeighbor: ADMIN_STEALTH_UPDATE_JS
});

mp.makeProperty("rp_scenes", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: ROLEPLAY_SCENE_UPDATE_OWNER_JS,
    updateNeighbor: ``
});

mp.makeProperty("rp_adminPanel", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: ADMIN_PANEL_UPDATE_OWNER_JS,
    updateNeighbor: ``
});

mp.makeEventSource("_rpChatSubmit", EVENT_SOURCE_JS);
mp.makeEventSource("_rpChatTyping", TYPING_EVENT_SOURCE_JS);

function normalizeChatSegments(segments) {
    if (!Array.isArray(segments)) return null;

    const normalized = segments
        .map(function(segment) {
            if (!segment || segment.text === undefined || segment.text === null) return null;
            return {
                text: String(segment.text),
                color: segment.color ? String(segment.color) : "#f8f2df"
            };
        })
        .filter(function(segment) {
            return !!(segment && segment.text);
        });

    return normalized.length ? normalized : null;
}

function makeChatPayload(message, color, segments) {
    chatMessageSeq += 1;
    const payload = {
        seq: chatMessageSeq,
        text: String(message),
        color: color || "#f8f2df",
        createdAt: new Date().toISOString()
    };

    const normalizedSegments = normalizeChatSegments(segments);
    if (normalizedSegments) {
        payload.segments = normalizedSegments;
    }

    return JSON.stringify(payload);
}

function pruneRecentChatStore(store, maxAgeMs) {
    const now = Date.now();
    Object.keys(store).forEach(function(existingKey) {
        if (!store[existingKey] || now - store[existingKey].at > maxAgeMs) {
            delete store[existingKey];
        }
    });
}

function isDuplicateOutgoingChat(userId, message, color) {
    const now = Date.now();
    const key = String(userId) + "|" + String(color || "#f8f2df") + "|" + String(message);
    const previous = recentOutgoingChat[key];

    recentOutgoingChat[key] = {
        at: now
    };

    pruneRecentChatStore(recentOutgoingChat, 1000);
    return !!previous && now - previous.at < 250;
}

function setChatTypingState(userId, actorId, isActive) {
    const key = String(userId);
    if (isActive) {
        if (chatTypingStateByUser[key] && chatTypingStateByUser[key].active) {
            return;
        }

        chatTypingStateByUser[key] = {
            active: true,
            at: Date.now()
        };
        mp.set(actorId, "rp_chatTyping", JSON.stringify({
            active: true,
            at: new Date().toISOString()
        }));
        return;
    }

    if (!chatTypingStateByUser[key] || !chatTypingStateByUser[key].active) {
        return;
    }

    delete chatTypingStateByUser[key];
    mp.set(actorId, "rp_chatTyping", "");
}

function sendChatMessage(userId, message, color, options) {
    options = options || {};
    const actorId = mp.getUserActor(userId);
    if (!actorId) return;

    const text = String(message || "");
    const chatColor = color || "#f8f2df";
    if (!text.trim() || isDuplicateOutgoingChat(userId, text, chatColor)) {
        return;
    }

    const payload = makeChatPayload(text, chatColor, options.segments);
    lastChatPayloadByActor[actorId] = payload;
    mp.set(actorId, "ff_chatMsg", payload);

    setTimeout(function() {
        if (lastChatPayloadByActor[actorId] !== payload) return;
        delete lastChatPayloadByActor[actorId];
        mp.set(actorId, "ff_chatMsg", "");
    }, 2000);
}

function cloneDefaultChatSettings() {
    return {
        chatDefaultsVersion: CHAT_DEFAULT_VERSION,
        left: CHAT_SETTINGS.left,
        top: CHAT_SETTINGS.top,
        width: CHAT_SETTINGS.width,
        inputWidth: CHAT_SETTINGS.inputWidth,
        visibleLines: CHAT_SETTINGS.visibleLines,
        historyLines: CHAT_SETTINGS.historyLines,
        fontSize: CHAT_SETTINGS.fontSize,
        inputFontSize: CHAT_SETTINGS.inputFontSize,
        lineHeight: CHAT_SETTINGS.lineHeight,
        timestamps: false,
        autoGrammar: false,
        customFontSize: false,
        customWidth: false
    };
}

function normalizeChatLeft(value) {
    const parsed = Number(value);
    if (!isFinite(parsed) || parsed < 4) {
        return CHAT_SETTINGS.left;
    }

    if (parsed === 12 || parsed === 24 || parsed === 34 || parsed === 64) {
        return CHAT_SETTINGS.left;
    }

    return Math.max(CHAT_SETTINGS.left, parsed);
}

function sanitizeChatSettings(settings) {
    settings = settings || {};
    const version = Number(settings.chatDefaultsVersion || 0);
    const rawFontSize = clampInt(settings.fontSize, CHAT_SETTING_LIMITS.fontSize.min, CHAT_SETTING_LIMITS.fontSize.max);
    const rawWidth = clampInt(settings.width, CHAT_SETTING_LIMITS.width.min, CHAT_SETTING_LIMITS.width.max);
    const customFontSize = settings.customFontSize === true ||
        (version < CHAT_DEFAULT_VERSION && rawFontSize !== null && rawFontSize !== 20 && rawFontSize !== 34 && rawFontSize !== CHAT_SETTINGS.fontSize);
    const customWidth = settings.customWidth === true ||
        (version < CHAT_DEFAULT_VERSION && rawWidth !== null && rawWidth !== 720 && rawWidth !== 1100 && rawWidth !== CHAT_SETTINGS.width);
    const fontSize = customFontSize && rawFontSize !== null ? rawFontSize : CHAT_SETTINGS.fontSize;
    const inputFontSize = clampInt(settings.inputFontSize, CHAT_SETTING_LIMITS.fontSize.min + 1, CHAT_SETTING_LIMITS.fontSize.max + 1);
    const lineHeight = clampInt(settings.lineHeight, CHAT_SETTING_LIMITS.fontSize.min + 7, CHAT_SETTING_LIMITS.fontSize.max + 20);
    const visibleLines = clampInt(settings.visibleLines, CHAT_SETTING_LIMITS.visibleLines.min, CHAT_SETTING_LIMITS.visibleLines.max);
    const width = customWidth && rawWidth !== null ? rawWidth : CHAT_SETTINGS.width;
    const resolvedFontSize = fontSize;
    const resolvedInputFontSize = inputFontSize === null ? resolvedFontSize + 1 : Math.max(inputFontSize, resolvedFontSize + 1);
    const resolvedLineHeight = lineHeight === null ? resolvedFontSize + 7 : Math.max(lineHeight, resolvedFontSize + 7);

    return {
        chatDefaultsVersion: CHAT_DEFAULT_VERSION,
        left: normalizeChatLeft(settings.left),
        top: Number(settings.top) || CHAT_SETTINGS.top,
        width: width,
        inputWidth: CHAT_SETTINGS.inputWidth,
        visibleLines: visibleLines === null ? CHAT_SETTINGS.visibleLines : visibleLines,
        historyLines: Number(settings.historyLines) || CHAT_SETTINGS.historyLines,
        fontSize: resolvedFontSize,
        inputFontSize: resolvedInputFontSize,
        lineHeight: resolvedLineHeight,
        timestamps: !!settings.timestamps,
        autoGrammar: !!settings.autoGrammar,
        customFontSize: customFontSize,
        customWidth: customWidth
    };
}

function getUserSettingsKey(userId) {
    let ip = "";
    try {
        const userIp = mp.getUserIp(userId);
        if (userIp !== undefined && userIp !== null && String(userIp).trim()) {
            ip = String(userIp).trim();
        }
    } catch (e) {}

    try {
        const actorId = mp.getUserActor(userId);
        const actorName = getDisplayName(actorId);
        if (actorName && actorName !== "Unknown") {
            return "player:" + actorName.toLowerCase() + "@" + (ip || "unknown-ip");
        }
    } catch (e) {}

    if (ip) {
        return "ip:" + ip;
    }

    try {
        const guid = mp.getUserGuid(userId);
        if (guid !== undefined && guid !== null && String(guid).trim()) {
            return "guid:" + String(guid);
        }
    } catch (e) {}

    return "user:" + String(userId);
}

function getUserChatSettings(userId) {
    if (!userChatSettings[userId]) {
        const settingsKey = getUserSettingsKey(userId);
        userChatSettingKeys[userId] = settingsKey;
        userChatSettings[userId] = sanitizeChatSettings(Object.assign(
            cloneDefaultChatSettings(),
            persistedChatSettings[settingsKey] || {}
        ));
    }
    return userChatSettings[userId];
}

function saveUserChatSettings(userId) {
    const settingsKey = userChatSettingKeys[userId] || getUserSettingsKey(userId);
    userChatSettingKeys[userId] = settingsKey;
    persistedChatSettings[settingsKey] = sanitizeChatSettings(getUserChatSettings(userId));

    try {
        fs.writeFileSync(CHAT_USER_SETTINGS_FILE, JSON.stringify(persistedChatSettings, null, 2));
    } catch (e) {
        console.log("[gamemode] Failed to save chat user settings:", e);
    }
}

function clampInt(value, min, max) {
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) return null;
    return Math.max(min, Math.min(max, parsed));
}

function applyUserChatSettings(userId) {
    const actorId = mp.getUserActor(userId);
    if (!actorId) return;

    const refreshSeq = Date.now();
    mp.set(actorId, "rp_chatSettings", JSON.stringify(Object.assign({}, getUserChatSettings(userId), {
        refreshSeq: refreshSeq
    })));

    [80, 260].forEach(function(delayMs, index) {
        setTimeout(function() {
            let currentActorId = actorId;
            try {
                currentActorId = mp.getUserActor(userId);
            } catch (e) {}
            if (!currentActorId) return;

            mp.set(currentActorId, "ff_chatMsg", JSON.stringify({
                control: "refresh",
                seq: "settings:" + refreshSeq + ":" + index
            }));
        }, delayMs);
    });
}

function describeUserChatSettings(userId) {
    const settings = getUserChatSettings(userId);
    return "Chat settings: font size " + settings.fontSize +
        ", lines " + settings.visibleLines +
        ", width " + settings.width +
        ", timestamps " + (settings.timestamps ? "on" : "off") +
        ", autogrammar " + (settings.autoGrammar ? "on" : "off") + ".";
}

function getDisplayName(actorId) {
    if (!actorId) return "Unknown";

    try {
        const name = mp.getActorName(actorId);
        if (typeof name === "string" && name.trim()) {
            return name.trim();
        }
    } catch (e) {
        console.log("[gamemode] Failed to get actor name:", e);
    }

    return "Unknown";
}

function getActorProfileId(actorId) {
    if (!actorId) return null;

    const propertyNames = [
        "private.skrpProfileId",
        "private.indexed.profileId"
    ];

    for (let i = 0; i < propertyNames.length; i++) {
        try {
            const raw = mp.get(actorId, propertyNames[i]);
            const profileId = Number(raw);
            if (isFinite(profileId) && profileId > 0) {
                return Math.floor(profileId);
            }
        } catch (e) {
            // ignore missing actor property lookups
        }
    }

    return null;
}

function maybePruneWitnessedChatLog(nowMs) {
    const db = ensureWitnessedChatLogStore();
    if (!db || !pruneWitnessedChatLogStmt) {
        return;
    }

    if (lastWitnessedChatPruneAt && nowMs - lastWitnessedChatPruneAt < 15 * 60 * 1000) {
        return;
    }

    lastWitnessedChatPruneAt = nowMs;

    try {
        const threshold = new Date(nowMs - CHATLOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
        pruneWitnessedChatLogStmt.run(threshold);
    } catch (e) {
        console.log("[gamemode] Failed to prune witnessed chat log:", e);
    }
}

function storeWitnessedChat(actorId, nearbyUserIds, radius, message, color, chatKind) {
    const db = ensureWitnessedChatLogStore();
    if (!db || !insertWitnessedChatLogStmt || !Array.isArray(nearbyUserIds) || !nearbyUserIds.length) {
        return;
    }

    const speakerName = getDisplayName(actorId);
    const speakerProfileId = getActorProfileId(actorId);
    const createdAt = new Date().toISOString();
    const nowMs = Date.now();
    maybePruneWitnessedChatLog(nowMs);

    let worldDesc = "";
    try {
        worldDesc = String(mp.getDescFromId(mp.getActorCellOrWorld(actorId)) || "");
    } catch (e) {
        worldDesc = "";
    }

    nearbyUserIds.forEach(function(userId) {
        try {
            const witnessActorId = mp.getUserActor(userId);
            const witnessProfileId = getActorProfileId(witnessActorId);
            if (!witnessProfileId) {
                return;
            }

            insertWitnessedChatLogStmt.run(
                witnessProfileId,
                speakerProfileId,
                speakerName,
                String(message || ""),
                String(chatKind || "say"),
                Number(radius || 0),
                color ? String(color) : null,
                worldDesc,
                createdAt
            );
        } catch (e) {
            console.log("[gamemode] Failed to store witnessed chat entry:", e);
        }
    });
}

function distanceSquared(a, b) {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    const dz = a[2] - b[2];
    return dx * dx + dy * dy + dz * dz;
}

function getNearbyUserIds(actorId, radius) {
    if (!actorId) return [];

    const seen = {};
    const result = [];

    function addUserId(userId) {
        if (typeof userId !== "number" || userId === INVALID_USER_ID || seen[userId]) {
            return;
        }
        seen[userId] = true;
        result.push(userId);
    }

    addUserId(mp.getUserByActor(actorId));

    const sourcePos = mp.getActorPos(actorId);
    if (!Array.isArray(sourcePos) || sourcePos.length < 3) {
        return result;
    }

    const cellOrWorldDesc = mp.getDescFromId(mp.getActorCellOrWorld(actorId));
    const nearbyRefs = mp.getNeighborsByPosition(cellOrWorldDesc, sourcePos) || [];
    const maxDistanceSquared = radius * radius;

    nearbyRefs.forEach(function(refId) {
        const userId = mp.getUserByActor(refId);
        if (typeof userId !== "number" || userId === INVALID_USER_ID) {
            return;
        }

        const targetPos = mp.getActorPos(refId);
        if (!Array.isArray(targetPos) || targetPos.length < 3) {
            return;
        }

        if (distanceSquared(sourcePos, targetPos) <= maxDistanceSquared) {
            addUserId(userId);
        }
    });

    return result;
}

function sendChatToNearby(actorId, radius, message, color, chatKind, options) {
    const nearbyUserIds = getNearbyUserIds(actorId, radius);
    nearbyUserIds.forEach(function(userId) {
        sendChatMessage(userId, message, color, Object.assign({ timestamp: true }, options || {}));
    });
    storeWitnessedChat(actorId, nearbyUserIds, radius, message, color, chatKind);
}

function sanitizeRoleplaySceneText(text) {
    let result = String(text || "").trim().replace(/\s+/g, " ");
    if (result.length > RP_SCENE_TEXT_MAX_LENGTH) {
        result = result.slice(0, RP_SCENE_TEXT_MAX_LENGTH).trim();
    }
    return result;
}

function parsePositiveInt(raw) {
    const normalized = String(raw || "").trim();
    if (!/^\d+$/.test(normalized)) return null;
    const parsed = parseInt(normalized, 10);
    return isFinite(parsed) && parsed > 0 ? parsed : null;
}

function normalizeRoleplayScene(raw) {
    if (!raw || typeof raw !== "object") return null;

    const id = parsePositiveInt(raw.id);
    const pos = Array.isArray(raw.pos) ? raw.pos.map(function(value) { return Number(value); }) : [];
    if (!id || pos.length < 3 || !isFinite(pos[0]) || !isFinite(pos[1]) || !isFinite(pos[2])) {
        return null;
    }

    const text = sanitizeRoleplaySceneText(raw.text);
    if (!text) return null;

    const createdAtMs = Number(raw.createdAtMs) || Date.parse(raw.createdAt) || Date.now();
    let expiresAtMs = Number(raw.expiresAtMs) || Date.parse(raw.expiresAt) || (createdAtMs + RP_SCENE_MAX_DURATION_MS);
    if (!isFinite(expiresAtMs)) {
        expiresAtMs = createdAtMs + RP_SCENE_MAX_DURATION_MS;
    }
    expiresAtMs = Math.min(expiresAtMs, createdAtMs + RP_SCENE_MAX_DURATION_MS);

    return {
        id: id,
        ownerKey: String(raw.ownerKey || ""),
        ownerUserId: Number(raw.ownerUserId) || null,
        ownerProfileId: Number(raw.ownerProfileId) || null,
        ownerName: String(raw.ownerName || "Unknown"),
        text: text,
        radius: RP_SCENE_TRIGGER_RADIUS,
        pos: [pos[0], pos[1], pos[2]],
        cellOrWorldDesc: String(raw.cellOrWorldDesc || ""),
        createdAtMs: createdAtMs,
        expiresAtMs: expiresAtMs,
        createdAt: new Date(createdAtMs).toISOString(),
        expiresAt: new Date(expiresAtMs).toISOString()
    };
}

function loadPersistedRoleplayScenes() {
    try {
        if (!fs.existsSync(RP_SCENE_STORE_FILE)) {
            return [];
        }

        const raw = JSON.parse(fs.readFileSync(RP_SCENE_STORE_FILE, "utf8"));
        const sourceScenes = Array.isArray(raw) ? raw : (Array.isArray(raw.scenes) ? raw.scenes : []);
        const now = Date.now();
        return sourceScenes
            .map(normalizeRoleplayScene)
            .filter(function(scene) {
                return !!(scene && scene.expiresAtMs > now);
            });
    } catch (e) {
        console.log("[gamemode] Failed to load RP scenes:", e);
        return [];
    }
}

function getMaxRoleplaySceneId(scenes) {
    if (!Array.isArray(scenes)) return 0;
    return scenes.reduce(function(maxId, scene) {
        const id = Number(scene && scene.id);
        return isFinite(id) ? Math.max(maxId, id) : maxId;
    }, 0);
}

function saveRoleplayScenes() {
    try {
        fs.writeFileSync(RP_SCENE_STORE_FILE, JSON.stringify({
            scenes: roleplayScenes
        }, null, 2));
    } catch (e) {
        console.log("[gamemode] Failed to save RP scenes:", e);
    }
}

function cleanupRoleplayScenePresence() {
    const activeIds = {};
    roleplayScenes.forEach(function(scene) {
        activeIds[String(scene.id)] = true;
    });

    Object.keys(roleplayScenePresenceByUser).forEach(function(userKey) {
        const presence = roleplayScenePresenceByUser[userKey] || {};
        Object.keys(presence).forEach(function(sceneId) {
            if (!activeIds[String(sceneId)]) {
                delete presence[sceneId];
            }
        });
        if (!Object.keys(presence).length) {
            delete roleplayScenePresenceByUser[userKey];
        }
    });
}

function pruneExpiredRoleplayScenes() {
    const now = Date.now();
    let removed = false;
    for (let i = roleplayScenes.length - 1; i >= 0; i--) {
        if (!roleplayScenes[i] || Number(roleplayScenes[i].expiresAtMs) <= now) {
            roleplayScenes.splice(i, 1);
            removed = true;
        }
    }

    if (removed) {
        cleanupRoleplayScenePresence();
        saveRoleplayScenes();
    }

    return removed;
}

function getRoleplaySceneModerator(userId, forceRefresh) {
    const admin = getAdminInfo(userId, !!forceRefresh);
    return hasPermission(admin, "scene.moderate") ? admin : null;
}

function canUseMultipleRoleplayScenes(userId) {
    return !!getRoleplaySceneModerator(userId, false);
}

function getRoleplaySceneOwnerInfo(userId, actorId) {
    const profileId = getActorProfileId(actorId);
    const displayName = getDisplayName(actorId);
    let ownerKey = "";

    if (profileId) {
        ownerKey = "profile:" + profileId;
    } else if (displayName && displayName !== "Unknown") {
        ownerKey = "name:" + displayName.toLowerCase();
    } else {
        ownerKey = "user:" + String(userId);
    }

    return {
        ownerKey: ownerKey,
        ownerUserId: userId,
        ownerProfileId: profileId,
        ownerName: displayName
    };
}

function getActorCellOrWorldDesc(actorId) {
    try {
        const desc = mp.getDescFromId(mp.getActorCellOrWorld(actorId));
        return desc ? String(desc) : "";
    } catch (e) {}

    try {
        return String(mp.get(actorId, "worldOrCellDesc") || "");
    } catch (e) {}

    return "";
}

function getRoleplayScenesByOwner(ownerKey) {
    pruneExpiredRoleplayScenes();
    return roleplayScenes.filter(function(scene) {
        return scene.ownerKey === ownerKey;
    });
}

function findRoleplaySceneById(sceneId) {
    pruneExpiredRoleplayScenes();
    const id = Number(sceneId);
    if (!isFinite(id)) return null;
    return roleplayScenes.find(function(scene) {
        return Number(scene.id) === id;
    }) || null;
}

function canManageRoleplayScene(userId, ownerKey, scene) {
    if (!scene) return false;
    if (scene.ownerKey === ownerKey) return true;
    return !!getRoleplaySceneModerator(userId, false);
}

function parseRoleplaySceneCreateOptions(rawValue) {
    const parsed = Number(rawValue);
    if (!isFinite(parsed) || parsed <= 0 || parsed > 24) {
        return null;
    }

    return {
        radius: RP_SCENE_TRIGGER_RADIUS,
        durationMs: parsed * 60 * 60 * 1000,
        mode: "hours"
    };
}

function nextRoleplaySceneId() {
    roleplaySceneSeq += 1;
    globalThis.__skrpRoleplaySceneSeq = roleplaySceneSeq;
    return roleplaySceneSeq;
}

function markRoleplayScenePresence(userId, sceneId, present) {
    const userKey = String(userId);
    roleplayScenePresenceByUser[userKey] = roleplayScenePresenceByUser[userKey] || {};
    if (present) {
        roleplayScenePresenceByUser[userKey][String(sceneId)] = true;
        return;
    }

    delete roleplayScenePresenceByUser[userKey][String(sceneId)];
    if (!Object.keys(roleplayScenePresenceByUser[userKey]).length) {
        delete roleplayScenePresenceByUser[userKey];
    }
}

function isRoleplayScenePresenceMarked(userId, sceneId) {
    const presence = roleplayScenePresenceByUser[String(userId)] || {};
    return !!presence[String(sceneId)];
}

function getRoleplayScenesNearActor(actorId, renderOnly) {
    const actorPos = mp.getActorPos(actorId);
    if (!Array.isArray(actorPos) || actorPos.length < 3) {
        return [];
    }

    const cellOrWorldDesc = getActorCellOrWorldDesc(actorId);
    return roleplayScenes.filter(function(scene) {
        if (!scene || scene.expiresAtMs <= Date.now()) return false;
        if (scene.cellOrWorldDesc && cellOrWorldDesc && scene.cellOrWorldDesc !== cellOrWorldDesc) return false;

        const maxDistance = renderOnly
            ? RP_SCENE_RENDER_RADIUS
            : RP_SCENE_TRIGGER_RADIUS;
        return distanceSquared(actorPos, scene.pos) <= maxDistance * maxDistance;
    });
}

function makeRoleplayScenePayloadForActor(actorId) {
    const scenes = getRoleplayScenesNearActor(actorId, true).map(function(scene) {
        return {
            id: scene.id,
            pos: scene.pos,
            radius: RP_SCENE_TRIGGER_RADIUS,
            renderRadius: RP_SCENE_RENDER_RADIUS,
            expiresAt: scene.expiresAtMs,
            color: RP_SCENE_MARKER_COLOR
        };
    });

    if (!scenes.length) {
        return "";
    }

    return JSON.stringify({
        scenes: scenes
    });
}

function refreshRoleplaySceneViewForUser(userId, force) {
    let actorId = 0;
    try {
        actorId = mp.getUserActor(userId);
    } catch (e) {
        actorId = 0;
    }
    if (!actorId) return;

    const payload = makeRoleplayScenePayloadForActor(actorId);
    if (!force && lastRoleplayScenePayloadByActor[actorId] === payload) {
        return;
    }

    lastRoleplayScenePayloadByActor[actorId] = payload;
    mp.set(actorId, "rp_scenes", payload);
}

function refreshAllRoleplaySceneViews(force) {
    getOnlineUserIds().forEach(function(userId) {
        refreshRoleplaySceneViewForUser(userId, !!force);
    });
}

function notifyUserEnteredRoleplayScenes(userId, actorId) {
    const nearbyScenes = getRoleplayScenesNearActor(actorId, false);
    const nearbyIds = {};

    nearbyScenes.forEach(function(scene) {
        nearbyIds[String(scene.id)] = true;
        if (isRoleplayScenePresenceMarked(userId, scene.id)) {
            return;
        }

        markRoleplayScenePresence(userId, scene.id, true);
        sendChatMessage(userId, "*" + scene.text + "*", EMOTE_COLOR, { timestamp: true });
    });

    const presence = roleplayScenePresenceByUser[String(userId)] || {};
    Object.keys(presence).forEach(function(sceneId) {
        if (!nearbyIds[String(sceneId)]) {
            markRoleplayScenePresence(userId, sceneId, false);
        }
    });
}

function tickRoleplayScenesForUser(userId) {
    let actorId = 0;
    try {
        actorId = mp.getUserActor(userId);
    } catch (e) {
        actorId = 0;
    }
    if (!actorId) return;

    notifyUserEnteredRoleplayScenes(userId, actorId);
    refreshRoleplaySceneViewForUser(userId, false);
}

function getRoleplaySceneTimeLeftText(scene) {
    const remainingMs = Math.max(0, Number(scene.expiresAtMs) - Date.now());
    const minutes = Math.max(1, Math.ceil(remainingMs / 60000));
    if (minutes >= 60) {
        const hours = Math.ceil(minutes / 60);
        return hours + "h";
    }
    return minutes + "m";
}

function formatRoleplaySceneLine(scene, includeOwner) {
    const preview = scene.text.length > 96 ? scene.text.slice(0, 93).trim() + "..." : scene.text;
    const owner = includeOwner ? " | by " + scene.ownerName : "";
    return "ID: " + scene.id + " - *" + preview + "* (" + getRoleplaySceneTimeLeftText(scene) + " left" + owner + ")";
}

function sendRoleplaySceneList(userId, scenes, title, includeOwner) {
    if (!scenes.length) {
        sendChatMessage(userId, title + ": no active scenes.");
        return;
    }

    sendChatMessage(userId, title + ":");
    scenes.forEach(function(scene) {
        sendChatMessage(userId, formatRoleplaySceneLine(scene, includeOwner));
    });
}

function handleCreateSceneCommand(userId, actorId, parts) {
    pruneExpiredRoleplayScenes();

    const options = parseRoleplaySceneCreateOptions(parts[1]);
    const description = sanitizeRoleplaySceneText(parts.slice(2).join(" "));
    if (!options || !description) {
        sendChatMessage(userId, "Usage: /sc <hours> <description>. Example: /sc 24 Footprints remain in the mud.");
        sendChatMessage(userId, "Scenes cannot last more than 24h. The chat text appears only when a player enters the ? marker.");
        return;
    }

    const ownerInfo = getRoleplaySceneOwnerInfo(userId, actorId);
    const ownScenes = getRoleplayScenesByOwner(ownerInfo.ownerKey);
    if (ownScenes.length && !canUseMultipleRoleplayScenes(userId)) {
        sendChatMessage(userId, "You already have an active scene. Use /myscene, /editscene <text>, or /deletescene confirm.");
        return;
    }

    const pos = mp.getActorPos(actorId);
    if (!Array.isArray(pos) || pos.length < 3) {
        sendChatMessage(userId, "Could not create the scene at your current position.", "#d56b6b");
        return;
    }

    const now = Date.now();
    const scene = {
        id: nextRoleplaySceneId(),
        ownerKey: ownerInfo.ownerKey,
        ownerUserId: ownerInfo.ownerUserId,
        ownerProfileId: ownerInfo.ownerProfileId,
        ownerName: ownerInfo.ownerName,
        text: description,
        radius: RP_SCENE_TRIGGER_RADIUS,
        pos: [Number(pos[0]), Number(pos[1]), Number(pos[2])],
        cellOrWorldDesc: getActorCellOrWorldDesc(actorId),
        createdAtMs: now,
        expiresAtMs: Math.min(now + options.durationMs, now + RP_SCENE_MAX_DURATION_MS),
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(Math.min(now + options.durationMs, now + RP_SCENE_MAX_DURATION_MS)).toISOString()
    };

    roleplayScenes.push(scene);
    saveRoleplayScenes();
    markRoleplayScenePresence(userId, scene.id, true);
    refreshAllRoleplaySceneViews(true);

    sendChatMessage(userId, "Scene ID " + scene.id + " created. It expires in " + getRoleplaySceneTimeLeftText(scene) + ".");
}

function handleMyScenesCommand(userId) {
    const actorId = mp.getUserActor(userId);
    const ownerInfo = getRoleplaySceneOwnerInfo(userId, actorId);
    sendRoleplaySceneList(userId, getRoleplayScenesByOwner(ownerInfo.ownerKey), "Your scenes", false);
}

function removeRoleplayScene(scene) {
    const index = roleplayScenes.findIndex(function(existingScene) {
        return Number(existingScene.id) === Number(scene.id);
    });
    if (index === -1) return false;

    roleplayScenes.splice(index, 1);
    cleanupRoleplayScenePresence();
    saveRoleplayScenes();
    refreshAllRoleplaySceneViews(true);
    return true;
}

function handleDeleteSceneCommand(userId, parts) {
    pruneExpiredRoleplayScenes();

    const actorId = mp.getUserActor(userId);
    const ownerInfo = getRoleplaySceneOwnerInfo(userId, actorId);
    const args = parts.slice(1);
    const hasConfirm = args.map(function(arg) {
        return String(arg || "").toLowerCase();
    }).indexOf("confirm") !== -1;

    if (!args.length) {
        sendChatMessage(userId, "You must confirm scene deletion: /deletescene confirm, or /deletescene <id> confirm.");
        return;
    }

    let scene = null;
    if (String(args[0] || "").toLowerCase() === "confirm") {
        const ownScenes = getRoleplayScenesByOwner(ownerInfo.ownerKey);
        if (!ownScenes.length) {
            sendChatMessage(userId, "You have no active scene.");
            return;
        }
        if (ownScenes.length > 1) {
            sendChatMessage(userId, "You have multiple scenes. Use /deletescene <id> confirm.");
            sendRoleplaySceneList(userId, ownScenes, "Your scenes", false);
            return;
        }
        scene = ownScenes[0];
    } else {
        const sceneId = parsePositiveInt(args[0]);
        if (!sceneId) {
            sendChatMessage(userId, "Usage: /deletescene <id> confirm");
            return;
        }
        scene = findRoleplaySceneById(sceneId);
    }

    if (!scene) {
        sendChatMessage(userId, "Scene not found.");
        return;
    }

    if (!canManageRoleplayScene(userId, ownerInfo.ownerKey, scene)) {
        sendChatMessage(userId, "You can only delete your own scene.", "#d56b6b");
        return;
    }

    if (!hasConfirm) {
        sendChatMessage(userId, "To delete scene ID " + scene.id + ", use /deletescene " + scene.id + " confirm.");
        return;
    }

    if (removeRoleplayScene(scene)) {
        sendChatMessage(userId, "Scene ID " + scene.id + " deleted.");
        if (scene.ownerKey !== ownerInfo.ownerKey) {
            const admin = getRoleplaySceneModerator(userId, false);
            writeAdminAudit(admin, "scene.delete", { sceneId: scene.id, ownerName: scene.ownerName }, null, scene.ownerProfileId);
        }
    }
}

function handleEditSceneCommand(userId, parts) {
    pruneExpiredRoleplayScenes();

    const actorId = mp.getUserActor(userId);
    const ownerInfo = getRoleplaySceneOwnerInfo(userId, actorId);
    const args = parts.slice(1);
    const ownScenes = getRoleplayScenesByOwner(ownerInfo.ownerKey);
    const sceneId = parsePositiveInt(args[0]);
    let scene = null;
    let description = "";

    if (!args.length) {
        sendChatMessage(userId, "Usage: /editscene <text>, or /editscene <id> <text>.");
        return;
    }

    if (sceneId) {
        if (args.length < 2) {
            sendChatMessage(userId, "Usage: /editscene <id> <text>");
            return;
        }

        const candidate = findRoleplaySceneById(sceneId);
        if (!candidate || !canManageRoleplayScene(userId, ownerInfo.ownerKey, candidate)) {
            sendChatMessage(userId, "Scene not found or you cannot edit it.", "#d56b6b");
            return;
        }

        scene = candidate;
        description = sanitizeRoleplaySceneText(args.slice(1).join(" "));
    } else if (ownScenes.length === 1) {
        scene = ownScenes[0];
        description = sanitizeRoleplaySceneText(args.join(" "));
    }

    if (!scene) {
        sendChatMessage(userId, "You have multiple/no scenes. Use /myscene, then /editscene <id> <text>.");
        return;
    }

    if (!description) {
        sendChatMessage(userId, "Usage: /editscene <text>, or /editscene <id> <text>.");
        return;
    }

    scene.text = description;
    saveRoleplayScenes();
    refreshAllRoleplaySceneViews(true);
    sendChatMessage(userId, "Scene ID " + scene.id + " updated.");

    if (scene.ownerKey !== ownerInfo.ownerKey) {
        const admin = getRoleplaySceneModerator(userId, false);
        writeAdminAudit(admin, "scene.edit", { sceneId: scene.id, ownerName: scene.ownerName }, null, scene.ownerProfileId);
    }
}

function handleCheckSceneCommand(userId, parts) {
    const admin = requireAdmin(userId, "scene.moderate");
    if (!admin) return;

    const targetUserId = findUserById(parts[1]);
    if (targetUserId === null) {
        sendChatMessage(userId, "Usage: /checkscene <player id>");
        return;
    }

    const targetActorId = mp.getUserActor(targetUserId);
    const targetOwnerInfo = getRoleplaySceneOwnerInfo(targetUserId, targetActorId);
    sendRoleplaySceneList(
        userId,
        getRoleplayScenesByOwner(targetOwnerInfo.ownerKey),
        "Scenes for " + targetOwnerInfo.ownerName + " (ID " + targetUserId + ")",
        true
    );
}

function hasEndingPunctuation(text) {
    return /[.!?)]$/.test(String(text || "").trim());
}

function normalizeGrammarText(text, capitalizeStart) {
    let result = String(text || "").trim().replace(/\s+/g, " ");
    if (!result) return result;

    result = result.replace(/\bi\b/g, "I");
    result = result.replace(/\bgod\b/gi, "God");

    if (capitalizeStart) {
        result = result.replace(/(^|[.!?]\s+)([a-z])/g, function(match, prefix, letter) {
            return prefix + letter.toUpperCase();
        });
    } else {
        result = result.replace(/([.!?]\s+)([a-z])/g, function(match, prefix, letter) {
            return prefix + letter.toUpperCase();
        });
    }

    if (!hasEndingPunctuation(result)) {
        result += ".";
    }

    return result;
}

function applyAutoGrammar(userId, text, capitalizeStart) {
    const settings = getUserChatSettings(userId);
    if (!settings.autoGrammar) {
        return String(text || "").trim();
    }
    return normalizeGrammarText(text, capitalizeStart);
}

function normalizeShoutText(userId, text) {
    let result = applyAutoGrammar(userId, text, true);
    result = String(result || "").trim().replace(/\s+/g, " ");
    if (!result) {
        return result;
    }

    result = result.replace(/[.!?]+$/g, "");
    return result + "!";
}

function normalizeAmeText(userId, text) {
    let result = String(text || "").trim().replace(/\s+/g, " ");
    if (result.length > AME_MAX_LENGTH) {
        result = result.slice(0, AME_MAX_LENGTH).trim();
    }
    result = applyAutoGrammar(userId, result, false);
    return String(result || "").trim().replace(/\s+/g, " ");
}

function markAmeLineOverflow(lines) {
    if (!lines.length) return;
    const lastIndex = lines.length - 1;
    const suffix = "...";
    const availableLength = Math.max(0, AME_MAX_LINE_LENGTH - suffix.length);
    lines[lastIndex] = lines[lastIndex].slice(0, availableLength).trim() + suffix;
}

function pushAmeLine(lines, line) {
    line = String(line || "").trim();
    if (!line) return true;
    if (lines.length >= AME_MAX_LINES) {
        markAmeLineOverflow(lines);
        return false;
    }
    lines.push(line);
    return true;
}

function wrapAmeTextLines(text) {
    const words = String(text || "").trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
    const lines = [];
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
        let word = words[i];
        while (word.length > AME_MAX_LINE_LENGTH) {
            const available = currentLine ? AME_MAX_LINE_LENGTH - currentLine.length - 1 : AME_MAX_LINE_LENGTH;
            if (available > 8) {
                currentLine = currentLine ? currentLine + " " + word.slice(0, available) : word.slice(0, available);
                word = word.slice(available);
            } else {
                if (!pushAmeLine(lines, currentLine)) return lines;
                currentLine = "";
            }
        }

        if (!word) continue;
        const candidateLine = currentLine ? currentLine + " " + word : word;
        if (candidateLine.length <= AME_MAX_LINE_LENGTH) {
            currentLine = candidateLine;
            continue;
        }

        if (!pushAmeLine(lines, currentLine)) return lines;
        currentLine = word;
    }

    if (currentLine) {
        pushAmeLine(lines, currentLine);
    }

    return lines.length ? lines : [String(text || "").trim()];
}

function getDutyAdmin(userId) {
    if (!adminDutyByUser[userId]) return null;
    return getAdminInfo(userId, false);
}

function getChatDisplayName(userId, actorId) {
    const admin = getDutyAdmin(userId);
    return admin ? admin.username : getDisplayName(actorId);
}

function getChatColor(userId, fallbackColor) {
    return fallbackColor || ADMIN_DEFAULT_CHAT_COLOR;
}

function makeDutyNameSegments(userId, name, restText, textColor) {
    if (!getDutyAdmin(userId)) return null;
    return [
        { text: name, color: ADMIN_DUTY_COLOR },
        { text: restText, color: textColor || ADMIN_DEFAULT_CHAT_COLOR }
    ];
}

function handleSay(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    const rest = " says: " + applyAutoGrammar(userId, text, true);
    sendChatToNearby(actorId, SAY_RADIUS, name + rest, getChatColor(userId), "say", {
        segments: makeDutyNameSegments(userId, name, rest, ADMIN_DEFAULT_CHAT_COLOR)
    });
}

function handleLow(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    const rest = " says (low): " + applyAutoGrammar(userId, text, true);
    sendChatToNearby(actorId, LOW_RADIUS, name + rest, getChatColor(userId), "low", {
        segments: makeDutyNameSegments(userId, name, rest, ADMIN_DEFAULT_CHAT_COLOR)
    });
}

function handleLower(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    const rest = " says (lower): " + applyAutoGrammar(userId, text, true);
    sendChatToNearby(actorId, LOWER_RADIUS, name + rest, getChatColor(userId), "lower", {
        segments: makeDutyNameSegments(userId, name, rest, ADMIN_DEFAULT_CHAT_COLOR)
    });
}

function handleShout(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    const rest = " shouts: " + normalizeShoutText(userId, text);
    sendChatToNearby(actorId, SHOUT_RADIUS, name + rest, getChatColor(userId), "shout", {
        segments: makeDutyNameSegments(userId, name, rest, ADMIN_DEFAULT_CHAT_COLOR)
    });
}

function handleMe(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    sendChatToNearby(actorId, SAY_RADIUS, name + " " + applyAutoGrammar(userId, text, false), getChatColor(userId, EMOTE_COLOR), "me");
}

function handleAme(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    const action = normalizeAmeText(userId, text);
    if (!action) {
        sendChatMessage(userId, "Usage: /ame <action>");
        return;
    }

    const displayText = name + " " + action;
    const payload = JSON.stringify({
        text: displayText,
        lines: wrapAmeTextLines(displayText),
        color: [0.75, 0.54, 0.82, 0.96],
        seq: ++ameTextSeq,
        expiresAt: Date.now() + AME_DURATION_MS
    });

    lastAmePayloadByActor[actorId] = payload;
    mp.set(actorId, "rp_ameText", payload);
    setTimeout(function() {
        if (lastAmePayloadByActor[actorId] !== payload) return;
        delete lastAmePayloadByActor[actorId];
        mp.set(actorId, "rp_ameText", "");
    }, AME_DURATION_MS + 250);

    sendChatMessage(userId, "> " + displayText, getChatColor(userId, EMOTE_COLOR));
    storeWitnessedChat(
        actorId,
        getNearbyUserIds(actorId, SAY_RADIUS),
        SAY_RADIUS,
        displayText,
        getChatColor(userId, EMOTE_COLOR),
        "ame"
    );
}

function handleMeLow(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    sendChatToNearby(actorId, LOW_RADIUS, name + " " + applyAutoGrammar(userId, text, false), getChatColor(userId, EMOTE_COLOR), "me-low");
}

function handleMeLower(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    sendChatToNearby(actorId, LOWER_RADIUS, name + " " + applyAutoGrammar(userId, text, false), getChatColor(userId, EMOTE_COLOR), "me-lower");
}

function handleDo(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    sendChatToNearby(actorId, SAY_RADIUS, applyAutoGrammar(userId, text, true) + " ((" + name + "))", getChatColor(userId, EMOTE_COLOR), "do");
}

function handleMy(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    sendChatToNearby(actorId, SAY_RADIUS, name + "'s " + applyAutoGrammar(userId, text, false), getChatColor(userId, EMOTE_COLOR), "my");
}

function handleOoc(userId, actorId, text) {
    const name = getChatDisplayName(userId, actorId);
    const before = "(( ";
    const rest = " says: " + applyAutoGrammar(userId, text, true) + " ))";
    sendChatToNearby(actorId, OOC_RADIUS, before + name + rest, OOC_CHAT_COLOR, "ooc", {
        segments: getDutyAdmin(userId) ? [
            { text: before, color: OOC_CHAT_COLOR },
            { text: name, color: ADMIN_DUTY_COLOR },
            { text: rest, color: OOC_CHAT_COLOR }
        ] : null
    });
}

function sendPublicAdminsPanel(userId) {
    if (rateLimit(userId, "admins", ADMIN_PANEL_RATE_LIMIT_MS)) return;

    const actorId = mp.getUserActor(userId);
    if (!actorId) return;

    const availability = getPublicAdminAvailability();

    mp.set(actorId, "rp_adminPanel", JSON.stringify({
        mode: "public",
        seq: Date.now(),
        admins: availability.admins,
        offlineCount: availability.offlineCount
    }));
}

function sendAdminCommandPanel(userId) {
    if (rateLimit(userId, "admin", ADMIN_PANEL_RATE_LIMIT_MS)) return;

    const actorId = mp.getUserActor(userId);
    if (!actorId) return;
    rememberOnlineUser(userId, actorId);

    const admin = getAdminInfo(userId, false);
    if (!admin || !hasPermission(admin, "panel.access")) {
        const availability = getPublicAdminAvailability();
        mp.set(actorId, "rp_adminPanel", JSON.stringify({
            mode: "public",
            seq: Date.now(),
            admins: availability.admins,
            offlineCount: availability.offlineCount
        }));
        return;
    }

    mp.set(actorId, "rp_adminPanel", JSON.stringify({
        mode: "staff",
        seq: Date.now(),
        admins: getOnlineAdmins(true),
        players: getOnlinePlayerSummaries(),
        itemCatalog: hasPermission(admin, "inventory.restore") ? getAdminItemCatalog() : [],
        viewer: admin ? {
            userId: userId,
            username: admin.username,
            roleName: admin.role ? admin.role.name : "Staff",
            roleCode: admin.role ? admin.role.code : "STAFF",
            rankValue: admin.rankValue,
            permissions: Array.isArray(admin.permissions) ? admin.permissions : [],
            onDuty: adminDutyByUser[userId] === true,
            invisible: adminInvisibleByUser[userId] === true
        } : null,
        commands: getAvailableAdminCommands(admin)
    }));
}

function handleAdminsCommand(userId) {
    sendPublicAdminsPanel(userId);
}

function handleAdminCommand(userId) {
    sendAdminCommandPanel(userId);
}

function handleAdutyCommand(userId) {
    if (rateLimit(userId, "aduty", 1200)) return;

    const admin = requireAdmin(userId, "panel.access", { forceRefresh: true });
    if (!admin) return;

    adminDutyByUser[userId] = !adminDutyByUser[userId];
    if (adminDutyByUser[userId]) {
        protectAdminDutyActor(userId);
    } else if (adminInvisibleByUser[userId]) {
        setAdminInvisible(userId, false);
    }
    refreshAdminPresentation(userId);

    const stateText = adminDutyByUser[userId] ? "on duty" : "off duty";
    sendChatMessage(userId, "You are now " + stateText + " as " + admin.username + ".", adminDutyByUser[userId] ? ADMIN_DUTY_COLOR : ADMIN_DEFAULT_CHAT_COLOR);
    writeAdminAudit(admin, "game.aduty", { onDuty: adminDutyByUser[userId] }, admin.accountId, admin.characterId);
}

function handleAdminHelpCommand(userId) {
    const admin = requireAdmin(userId, "panel.access");
    if (!admin) return;

    sendChatMessage(userId, "Staff commands for " + admin.username + " (" + (admin.role ? admin.role.name : "Staff") + "):", ADMIN_DUTY_COLOR);
    getAvailableAdminCommands(admin).forEach(function(command) {
        const suffix = command.dutyOnly ? " (requires /aduty)" : "";
        sendChatMessage(userId, command.usage + " - " + command.description + suffix);
    });
}

function sendStaffChat(senderAdmin, text) {
    getOnlineUserIds().forEach(function(targetUserId) {
        const targetAdmin = getAdminInfo(targetUserId, false);
        if (!targetAdmin) return;
        sendChatMessage(targetUserId, "[Staff] " + senderAdmin.username + " [" + (senderAdmin.role ? senderAdmin.role.name : "Staff") + "]: " + text, ADMIN_DUTY_COLOR);
    });
}

function handleStaffChatCommand(userId, text) {
    const admin = requireAdmin(userId, "panel.access");
    if (!admin) return;

    if (!text) {
        sendChatMessage(userId, "Usage: /a <message>");
        return;
    }

    sendStaffChat(admin, text);
}

function handleChangeCharacterCommand(userId) {
    if (!mp.sendCustomPacket) {
        sendChatMessage(userId, "Character selection is unavailable in this server build.", "#d56b6b");
        return;
    }

    const now = Date.now();
    const nextAllowedAt = Number(changeCharacterCooldownByUser[userId] || 0);
    if (nextAllowedAt > now) {
        const secondsLeft = Math.ceil((nextAllowedAt - now) / 1000);
        sendChatMessage(userId, "Please wait " + secondsLeft + " seconds before using /changechar again.", "#d3a34d");
        return;
    }

    changeCharacterCooldownByUser[userId] = now + CHANGE_CHARACTER_COOLDOWN_MS;
    sendChatMessage(userId, "Opening character selection...");
    try {
        mp.sendCustomPacket(userId, JSON.stringify({
            customPacketType: CHANGE_CHARACTER_PACKET_TYPE
        }));
    } catch (e) {
        delete changeCharacterCooldownByUser[userId];
        sendChatMessage(userId, "Could not open character selection.", "#d56b6b");
    }
}

function getOffsetLocationalData(actorId, offsetX) {
    const loc = mp.get(actorId, "locationalData");
    if (!loc || !Array.isArray(loc.pos) || !Array.isArray(loc.rot)) {
        return null;
    }

    return {
        cellOrWorldDesc: String(loc.cellOrWorldDesc || mp.get(actorId, "worldOrCellDesc") || ""),
        pos: [
            Number(loc.pos[0]) + (offsetX || 0),
            Number(loc.pos[1]),
            Number(loc.pos[2])
        ],
        rot: [
            Number(loc.rot[0]) || 0,
            Number(loc.rot[1]) || 0,
            Number(loc.rot[2]) || 0
        ]
    };
}

function teleportActorToActor(sourceActorId, targetActorId, offsetX) {
    const loc = getOffsetLocationalData(targetActorId, offsetX || 96);
    if (!loc) return false;
    mp.set(sourceActorId, "locationalData", loc);
    return true;
}

function handleGotoCommand(userId, targetArg) {
    const admin = requireAdmin(userId, "teleport.force", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findUserById(targetArg);
    if (targetUserId === null) {
        sendChatMessage(userId, "Usage: /goto <id>");
        return;
    }

    const actorId = mp.getUserActor(userId);
    const targetActorId = mp.getUserActor(targetUserId);
    if (!teleportActorToActor(actorId, targetActorId, 96)) {
        sendChatMessage(userId, "Could not teleport to that player.", "#d56b6b");
        return;
    }

    sendChatMessage(userId, "Teleported to player ID " + targetUserId + ".");
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, "game.goto", { targetUserId: targetUserId }, target.accountId, target.characterId);
}

function handleBringCommand(userId, targetArg) {
    const admin = requireAdmin(userId, "teleport.force", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findUserById(targetArg);
    if (targetUserId === null) {
        sendChatMessage(userId, "Usage: /bring <id>");
        return;
    }

    if (!canAdminAffectUser(admin, userId, targetUserId, "bring")) {
        return;
    }

    const actorId = mp.getUserActor(userId);
    const targetActorId = mp.getUserActor(targetUserId);
    if (!teleportActorToActor(targetActorId, actorId, 96)) {
        sendChatMessage(userId, "Could not bring that player.", "#d56b6b");
        return;
    }

    sendChatMessage(userId, "Brought player ID " + targetUserId + ".");
    sendChatMessage(targetUserId, "You were brought by " + admin.username + ".", ADMIN_DUTY_COLOR);
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, "game.bring", { targetUserId: targetUserId }, target.accountId, target.characterId);
}

function setFrozenUser(userId, frozen, admin) {
    const actorId = mp.getUserActor(userId);
    if (!actorId) return false;

    if (!frozen) {
        delete frozenUsers[userId];
        return true;
    }

    const loc = getOffsetLocationalData(actorId, 0);
    if (!loc) return false;

    frozenUsers[userId] = {
        locationalData: loc,
        by: admin ? admin.username : "Staff",
        at: Date.now()
    };
    return true;
}

function handleFreezeCommand(userId, targetArg, frozen) {
    const admin = requireAdmin(userId, "moderation.freeze", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findUserById(targetArg);
    if (targetUserId === null) {
        sendChatMessage(userId, frozen ? "Usage: /freeze <id>" : "Usage: /unfreeze <id>");
        return;
    }

    if (!canAdminAffectUser(admin, userId, targetUserId, frozen ? "freeze" : "unfreeze")) {
        return;
    }

    if (!setFrozenUser(targetUserId, frozen, admin)) {
        sendChatMessage(userId, "Could not update freeze state for that player.", "#d56b6b");
        return;
    }

    sendChatMessage(userId, "Player ID " + targetUserId + " " + (frozen ? "frozen" : "unfrozen") + ".");
    sendChatMessage(targetUserId, "You were " + (frozen ? "frozen" : "unfrozen") + " by " + admin.username + ".", ADMIN_DUTY_COLOR);
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, frozen ? "game.freeze" : "game.unfreeze", { targetUserId: targetUserId }, target.accountId, target.characterId);
}

function handleKickCommand(userId, targetArg, reason) {
    const admin = requireAdmin(userId, "moderation.kick", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findUserById(targetArg);
    if (targetUserId === null) {
        sendChatMessage(userId, "Usage: /akick <id> [reason]");
        return;
    }

    if (!canAdminAffectUser(admin, userId, targetUserId, "kick")) {
        return;
    }

    sendChatMessage(targetUserId, "You were kicked by " + admin.username + ". " + (reason || ""));
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, "game.kick", { targetUserId: targetUserId, reason: reason || "Kicked by staff." }, target.accountId, target.characterId);

    setTimeout(function() {
        try {
            if (typeof mp.kick === "function") {
                mp.kick(targetUserId);
            } else {
                sendChatMessage(userId, "Kick API is unavailable in this runtime.", "#d56b6b");
            }
        } catch (e) {
            sendChatMessage(userId, "Kick failed: " + e.message, "#d56b6b");
        }
    }, 250);
}

function handleHealCommand(userId, targetArg) {
    const admin = requireAdmin(userId, "inventory.restore", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findTargetUserForAdminCommand(targetArg, userId);
    if (targetUserId === null) {
        sendChatMessage(userId, "Usage: /heal <id|me>");
        return;
    }

    if (!canAdminAffectUser(admin, userId, targetUserId, "heal", { allowSelf: true })) {
        return;
    }

    const targetActorId = safeGetUserActor(targetUserId);
    if (!targetActorId) {
        sendChatMessage(userId, "Target player is not spawned.", "#d56b6b");
        return;
    }

    try {
        healActor(targetActorId, true);
    } catch (e) {
        sendChatMessage(userId, "Heal failed: " + e.message, "#d56b6b");
        return;
    }

    sendChatMessage(userId, "Player ID " + targetUserId + " healed.");
    if (targetUserId !== userId) {
        sendChatMessage(targetUserId, "You were healed by " + admin.username + ".", ADMIN_DUTY_COLOR);
    }
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, "game.heal", { targetUserId: targetUserId }, target.accountId, target.characterId);
}

function handleReviveCommand(userId, targetArg) {
    const admin = requireAdmin(userId, "inventory.restore", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findTargetUserForAdminCommand(targetArg, userId);
    if (targetUserId === null) {
        sendChatMessage(userId, "Usage: /revive <id|me>");
        return;
    }

    if (!canAdminAffectUser(admin, userId, targetUserId, "revive", { allowSelf: true })) {
        return;
    }

    const targetActorId = safeGetUserActor(targetUserId);
    if (!targetActorId) {
        sendChatMessage(userId, "Target player is not spawned.", "#d56b6b");
        return;
    }

    try {
        healActor(targetActorId, true);
    } catch (e) {
        sendChatMessage(userId, "Revive failed: " + e.message, "#d56b6b");
        return;
    }

    sendChatMessage(userId, "Player ID " + targetUserId + " revived.");
    if (targetUserId !== userId) {
        sendChatMessage(targetUserId, "You were revived by " + admin.username + ".", ADMIN_DUTY_COLOR);
    }
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, "game.revive", { targetUserId: targetUserId }, target.accountId, target.characterId);
}

function handleHealAllCommand(userId, radiusArg) {
    const admin = requireAdmin(userId, "inventory.restore", { dutyOnly: true });
    if (!admin) return;

    const actorId = safeGetUserActor(userId);
    if (!actorId) return;

    const radius = radiusArg === undefined || radiusArg === null || String(radiusArg).trim() === ""
        ? ADMIN_HEAL_RADIUS_DEFAULT
        : clampInt(radiusArg, 1, ADMIN_HEAL_RADIUS_MAX);
    if (radius === null) {
        sendChatMessage(userId, "Usage: /healall <radius>");
        return;
    }

    let healed = 0;
    let skipped = 0;
    getNearbyUserIds(actorId, radius).forEach(function(targetUserId) {
        if (!canAdminAffectUser(admin, userId, targetUserId, "heal", { allowSelf: true, silent: true })) {
            skipped += 1;
            return;
        }

        const targetActorId = safeGetUserActor(targetUserId);
        if (!targetActorId) {
            skipped += 1;
            return;
        }

        try {
            healActor(targetActorId, true);
            healed += 1;
            if (targetUserId !== userId) {
                sendChatMessage(targetUserId, "You were healed by " + admin.username + ".", ADMIN_DUTY_COLOR);
            }
        } catch (e) {
            skipped += 1;
        }
    });

    sendChatMessage(userId, "Healed " + healed + " player(s) within " + radius + ". " + (skipped ? "Skipped " + skipped + "." : ""));
    writeAdminAudit(admin, "game.healall", { radius: radius, healed: healed, skipped: skipped }, admin.accountId, admin.characterId);
}

function handleSetActorValueCommand(userId, targetArg, valueArg, statName) {
    const admin = requireAdmin(userId, "inventory.restore", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findTargetUserForAdminCommand(targetArg, userId);
    const value = parseActorValueArgument(valueArg, statName === "health" ? 1 : 0);
    const usage = statName === "health" ? "Usage: /sethp <id|me> <1-9999>" : "Usage: /setstamina <id|me> <0-9999>";
    if (targetUserId === null || value === null) {
        sendChatMessage(userId, usage);
        return;
    }

    if (!canAdminAffectUser(admin, userId, targetUserId, "set " + statName, { allowSelf: true })) {
        return;
    }

    const targetActorId = safeGetUserActor(targetUserId);
    if (!targetActorId) {
        sendChatMessage(userId, "Target player is not spawned.", "#d56b6b");
        return;
    }

    try {
        setActorValueDirect(targetActorId, statName, value);
    } catch (e) {
        sendChatMessage(userId, "Could not set " + statName + ": " + e.message, "#d56b6b");
        return;
    }

    sendChatMessage(userId, "Player ID " + targetUserId + " " + statName + " set to " + value + ".");
    if (targetUserId !== userId) {
        sendChatMessage(targetUserId, admin.username + " set your " + statName + " to " + value + ".", ADMIN_DUTY_COLOR);
    }
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, statName === "health" ? "game.sethp" : "game.setstamina", {
        targetUserId: targetUserId,
        value: value
    }, target.accountId, target.characterId);
}

function handleGiveItemCommand(userId, parts) {
    const admin = requireAdmin(userId, "inventory.restore", { dutyOnly: true });
    if (!admin) return;

    const targetUserId = findTargetUserForAdminCommand(parts[1], userId);
    const item = resolveItemInput(parts[2]);
    const count = clampInt(parts[3] || "1", 1, 9999);
    if (targetUserId === null || !item || count === null) {
        sendChatMessage(userId, "Usage: /giveitem <id|me> <formId|editorId> [count]");
        return;
    }

    if (!canAdminAffectUser(admin, userId, targetUserId, "spawn items for", { allowSelf: true })) {
        return;
    }

    const targetActorId = safeGetUserActor(targetUserId);
    if (!targetActorId) {
        sendChatMessage(userId, "Target player is not spawned.", "#d56b6b");
        return;
    }

    try {
        addItemToActor(targetActorId, item.formId, count);
    } catch (e) {
        sendChatMessage(userId, "Item spawn failed: " + e.message, "#d56b6b");
        return;
    }

    const itemName = item.name || item.editorId || item.formIdHex || formatFormId(item.formId);
    sendChatMessage(userId, "Spawned " + count + "x " + itemName + " for player ID " + targetUserId + ".");
    if (targetUserId !== userId) {
        sendChatMessage(targetUserId, admin.username + " added " + count + "x " + itemName + " to your inventory.", ADMIN_DUTY_COLOR);
    }
    const target = getAuditTargetByUserId(targetUserId);
    writeAdminAudit(admin, "game.giveitem", {
        targetUserId: targetUserId,
        formId: item.formIdHex || formatFormId(item.formId),
        count: count,
        itemName: itemName
    }, target.accountId, target.characterId);
}

function handleInvisibleCommand(userId) {
    const admin = requireAdmin(userId, "teleport.force", { dutyOnly: true });
    if (!admin) return;

    const enabled = adminInvisibleByUser[userId] !== true;
    if (!setAdminInvisible(userId, enabled)) {
        sendChatMessage(userId, "Could not update invisible mode.", "#d56b6b");
        return;
    }

    sendChatMessage(userId, "Invisible observer mode " + (enabled ? "enabled" : "disabled") + ".", enabled ? ADMIN_DUTY_COLOR : ADMIN_DEFAULT_CHAT_COLOR);
    writeAdminAudit(admin, "game.invisible", { enabled: enabled }, admin.accountId, admin.characterId);
}

function handleReloadAdminsCommand(userId) {
    const admin = requireAdmin(userId, "staff.roles.assign", { forceRefresh: true });
    if (!admin) return;

    Object.keys(adminCacheByUser).forEach(function(key) {
        delete adminCacheByUser[key];
    });
    refreshAllAdminPresentations();
    sendChatMessage(userId, "Online staff permissions reloaded from UCP database.");
    writeAdminAudit(admin, "game.reload_admins", {}, null, null);
}

function handleSetAdminCommand(userId, parts) {
    const admin = requireAdmin(userId, "staff.roles.assign", { forceRefresh: true });
    if (!admin) return;

    const target = findAccountForAdminTarget(parts[1]);
    const role = getRoleByCode(parts[2]);
    const note = parts.slice(3).join(" ").trim() || "Granted in game by " + admin.username;

    if (!target || !role) {
        sendChatMessage(userId, "Usage: /setadmin <id|username> <role_code> [note]");
        return;
    }

    if (admin.rankValue <= Number(role.rank_value)) {
        sendChatMessage(userId, "You can only grant roles below your rank.", "#d56b6b");
        return;
    }

    const db = ensureUcpAdminStore();
    if (!db) {
        sendChatMessage(userId, "UCP database is unavailable.", "#d56b6b");
        return;
    }

    const existing = dbGet(db, `
        SELECT id
        FROM account_staff_roles
        WHERE account_id = ? AND role_id = ? AND revoked_at IS NULL
        LIMIT 1
    `, [target.accountId, role.id]);

    if (existing) {
        sendChatMessage(userId, target.username + " already has " + role.name + ".");
        return;
    }

    const inserted = dbRun(db, `
        INSERT INTO account_staff_roles (account_id, role_id, granted_by_account_id, note, created_at, revoked_at)
        VALUES (?, ?, ?, ?, ?, NULL)
    `, [target.accountId, role.id, admin.accountId, note, nowIso()]);

    if (!inserted) {
        sendChatMessage(userId, "Could not grant staff role.", "#d56b6b");
        return;
    }

    if (target.userId !== null) {
        delete adminCacheByUser[target.userId];
        refreshAdminPresentation(target.userId);
        sendChatMessage(target.userId, "Your staff role is now " + role.name + ".", ADMIN_DUTY_COLOR);
    }

    sendChatMessage(userId, "Granted " + role.name + " to " + target.username + ".");
    writeAdminAudit(admin, "staff.role_grant.game", { roleCode: role.code, targetUsername: target.username }, target.accountId, target.characterId);
}

function handleRemoveAdminCommand(userId, parts) {
    const admin = requireAdmin(userId, "staff.roles.assign", { forceRefresh: true });
    if (!admin) return;

    const target = findAccountForAdminTarget(parts[1]);
    const roleCode = parts[2] ? normalizeRoleCode(parts[2]) : null;
    if (!target) {
        sendChatMessage(userId, "Usage: /removeadmin <id|username> [role_code]");
        return;
    }

    const db = ensureUcpAdminStore();
    if (!db) {
        sendChatMessage(userId, "UCP database is unavailable.", "#d56b6b");
        return;
    }

    const assignments = dbAll(db, `
        SELECT asr.id, sr.code, sr.name, sr.rank_value
        FROM account_staff_roles asr
        JOIN staff_roles sr ON sr.id = asr.role_id
        WHERE asr.account_id = ?
          AND asr.revoked_at IS NULL
          AND (? IS NULL OR sr.code = ?)
    `, [target.accountId, roleCode, roleCode]);

    if (!assignments.length) {
        sendChatMessage(userId, "No matching active staff role found for " + target.username + ".");
        return;
    }

    for (let i = 0; i < assignments.length; i++) {
        if (admin.rankValue <= Number(assignments[i].rank_value)) {
            sendChatMessage(userId, "You can only revoke roles below your rank.", "#d56b6b");
            return;
        }
    }

    assignments.forEach(function(assignment) {
        dbRun(db, `
            UPDATE account_staff_roles
            SET revoked_at = ?, revoked_by_account_id = ?
            WHERE id = ?
        `, [nowIso(), admin.accountId, assignment.id]);
    });

    if (target.userId !== null) {
        delete adminCacheByUser[target.userId];
        adminDutyByUser[target.userId] = false;
        setAdminInvisible(target.userId, false);
        refreshAdminPresentation(target.userId);
        sendChatMessage(target.userId, "Your staff access was updated.", "#d3a34d");
    }

    sendChatMessage(userId, "Revoked " + assignments.length + " staff role(s) from " + target.username + ".");
    writeAdminAudit(admin, "staff.role_revoke.game", { roleCode: roleCode, targetUsername: target.username, count: assignments.length }, target.accountId, target.characterId);
}

if (globalThis.__skrpFreezeIntervalId) {
    clearInterval(globalThis.__skrpFreezeIntervalId);
}
globalThis.__skrpFreezeIntervalId = setInterval(function() {
    Object.keys(frozenUsers).forEach(function(key) {
        const targetUserId = Number(key);
        try {
            if (!onlineUsers[targetUserId]) {
                delete frozenUsers[targetUserId];
                return;
            }

            const actorId = mp.getUserActor(targetUserId);
            if (!actorId || !frozenUsers[targetUserId] || !frozenUsers[targetUserId].locationalData) {
                delete frozenUsers[targetUserId];
                return;
            }

            mp.set(actorId, "locationalData", frozenUsers[targetUserId].locationalData);
        } catch (e) {
            delete frozenUsers[targetUserId];
        }
    });
}, ADMIN_FREEZE_TICK_MS);

if (globalThis.__skrpAdminGodmodeIntervalId) {
    clearInterval(globalThis.__skrpAdminGodmodeIntervalId);
}
globalThis.__skrpAdminGodmodeIntervalId = setInterval(function() {
    Object.keys(adminDutyByUser).forEach(function(key) {
        const userId = Number(key);
        try {
            if (!onlineUsers[userId] || !adminDutyByUser[userId]) {
                return;
            }
            protectAdminDutyActor(userId);
        } catch (e) {}
    });
}, ADMIN_GODMODE_TICK_MS);

if (!globalThis.__skrpOriginalOnDeathCaptured) {
    globalThis.__skrpOriginalOnDeathCaptured = true;
    globalThis.__skrpOriginalOnDeathHandler = typeof mp.onDeath === "function" ? mp.onDeath : null;
}
mp.onDeath = function(actorId, killerId) {
    let userId = INVALID_USER_ID;
    try {
        userId = mp.getUserByActor(actorId);
    } catch (e) {
        userId = INVALID_USER_ID;
    }
    if (typeof userId === "number" && userId !== INVALID_USER_ID && adminDutyByUser[userId]) {
        setTimeout(function() {
            try {
                protectAdminDutyActor(userId);
            } catch (e) {}
        }, 0);
        return false;
    }

    if (typeof globalThis.__skrpOriginalOnDeathHandler === "function") {
        return globalThis.__skrpOriginalOnDeathHandler.apply(mp, arguments);
    }
    return true;
};

if (globalThis.__skrpRoleplaySceneIntervalId) {
    clearInterval(globalThis.__skrpRoleplaySceneIntervalId);
}
globalThis.__skrpRoleplaySceneIntervalId = setInterval(function() {
    const pruned = pruneExpiredRoleplayScenes();
    getOnlineUserIds().forEach(function(userId) {
        try {
            tickRoleplayScenesForUser(userId);
        } catch (e) {
            delete roleplayScenePresenceByUser[String(userId)];
        }
    });
    if (pruned) {
        refreshAllRoleplaySceneViews(true);
    }
}, RP_SCENE_CHECK_TICK_MS);

function handleCommand(userId, raw) {
    const actorId = mp.getUserActor(userId);
    if (!actorId) return;

    const parts = raw.slice(1).trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const text = parts.slice(1).join(" ").trim();

    switch (cmd) {
        case "admins":
            handleAdminsCommand(userId);
            break;

        case "admin":
            handleAdminCommand(userId);
            break;

        case "aduty":
            handleAdutyCommand(userId);
            break;

        case "adminhelp":
            handleAdminHelpCommand(userId);
            break;

        case "a":
        case "asay":
            handleStaffChatCommand(userId, text);
            break;

        case "goto":
            handleGotoCommand(userId, parts[1]);
            break;

        case "bring":
            handleBringCommand(userId, parts[1]);
            break;

        case "freeze":
            handleFreezeCommand(userId, parts[1], true);
            break;

        case "unfreeze":
            handleFreezeCommand(userId, parts[1], false);
            break;

        case "akick":
            handleKickCommand(userId, parts[1], parts.slice(2).join(" ").trim() || "Kicked by staff.");
            break;

        case "heal":
            handleHealCommand(userId, parts[1]);
            break;

        case "healall":
            handleHealAllCommand(userId, parts[1]);
            break;

        case "revive":
            handleReviveCommand(userId, parts[1]);
            break;

        case "sethp":
            handleSetActorValueCommand(userId, parts[1], parts[2], "health");
            break;

        case "setstamina":
            handleSetActorValueCommand(userId, parts[1], parts[2], "stamina");
            break;

        case "giveitem":
        case "aitem":
        case "spawnitem":
            handleGiveItemCommand(userId, parts);
            break;

        case "invisible":
            handleInvisibleCommand(userId);
            break;

        case "sc":
        case "createscene":
            handleCreateSceneCommand(userId, actorId, parts);
            break;

        case "myscene":
        case "myscenes":
            handleMyScenesCommand(userId);
            break;

        case "deletescene":
            handleDeleteSceneCommand(userId, parts);
            break;

        case "editscene":
            handleEditSceneCommand(userId, parts);
            break;

        case "checkscene":
            handleCheckSceneCommand(userId, parts);
            break;

        case "areloadadmins":
            handleReloadAdminsCommand(userId);
            break;

        case "setadmin":
            handleSetAdminCommand(userId, parts);
            break;

        case "removeadmin":
            handleRemoveAdminCommand(userId, parts);
            break;

        case "help":
            sendChatMessage(userId, "/admins | /admin | /aduty | /changechar | /heal <id|me> | /healall <radius> | /revive <id|me> | /sethp <id|me> <1-9999> | /setstamina <id|me> <0-9999> | /giveitem <id|me> <formId|editorId> [count] | /invisible");
            sendChatMessage(userId, "/low <text> | /lower <text> | /s <text> | /shout <text> | /me <action> | /ame <action> | /melow <action> | /melower <action> | /my <text> | /do <text> | /b <text> | /timestamps | /ag");
            sendChatMessage(userId, "/sc <hours> <text> | /myscene | /editscene [id] <text> | /deletescene [id] confirm");
            break;

        case "changechar":
        case "charselect":
            handleChangeCharacterCommand(userId);
            break;

        case "chatsettings":
            sendChatMessage(userId, describeUserChatSettings(userId));
            sendChatMessage(userId, "Use /fontsize <25-50>, /chatlines <3-18>, /chatwidth <360-2000>, /timestamps, /ag, or /chatreset.");
            break;

        case "timestamps": {
            const settings = getUserChatSettings(userId);
            settings.timestamps = !settings.timestamps;
            saveUserChatSettings(userId);
            applyUserChatSettings(userId);
            sendChatMessage(userId, "Chat timestamps " + (settings.timestamps ? "enabled" : "disabled") + ".");
            break;
        }

        case "ag":
        case "autogrammar": {
            const settings = getUserChatSettings(userId);
            settings.autoGrammar = !settings.autoGrammar;
            saveUserChatSettings(userId);
            sendChatMessage(userId, "Auto grammar " + (settings.autoGrammar ? "enabled" : "disabled") + ".");
            break;
        }

        case "fontsize": {
            const size = clampInt(parts[1], CHAT_SETTING_LIMITS.fontSize.min, CHAT_SETTING_LIMITS.fontSize.max);
            if (size === null) {
                sendChatMessage(userId, "Usage: /fontsize <25-50>");
                return;
            }

            const settings = getUserChatSettings(userId);
            settings.fontSize = size;
            settings.inputFontSize = size + 1;
            settings.lineHeight = size + 7;
            settings.customFontSize = true;
            saveUserChatSettings(userId);
            applyUserChatSettings(userId);
            sendChatMessage(userId, "Chat font size set to " + size + ".");
            break;
        }

        case "chatlines": {
            const lines = clampInt(parts[1], CHAT_SETTING_LIMITS.visibleLines.min, CHAT_SETTING_LIMITS.visibleLines.max);
            if (lines === null) {
                sendChatMessage(userId, "Usage: /chatlines <3-18>");
                return;
            }

            const settings = getUserChatSettings(userId);
            settings.visibleLines = lines;
            saveUserChatSettings(userId);
            applyUserChatSettings(userId);
            sendChatMessage(userId, "Visible chat lines set to " + lines + ".");
            break;
        }

        case "chatwidth": {
            const width = clampInt(parts[1], CHAT_SETTING_LIMITS.width.min, CHAT_SETTING_LIMITS.width.max);
            if (width === null) {
                sendChatMessage(userId, "Usage: /chatwidth <360-2000>");
                return;
            }

            const settings = getUserChatSettings(userId);
            settings.width = width;
            settings.customWidth = true;
            saveUserChatSettings(userId);
            applyUserChatSettings(userId);
            sendChatMessage(userId, "Chat width set to " + width + ".");
            break;
        }

        case "chatreset":
            userChatSettings[userId] = cloneDefaultChatSettings();
            saveUserChatSettings(userId);
            applyUserChatSettings(userId);
            sendChatMessage(userId, "Chat settings reset.");
            break;

        case "low":
            if (!text) {
                sendChatMessage(userId, "Usage: /low <text>");
                return;
            }
            handleLow(userId, actorId, text);
            break;

        case "lower":
            if (!text) {
                sendChatMessage(userId, "Usage: /lower <text>");
                return;
            }
            handleLower(userId, actorId, text);
            break;

        case "s":
        case "shout":
            if (!text) {
                sendChatMessage(userId, "Usage: /shout <text>");
                return;
            }
            handleShout(userId, actorId, text);
            break;

        case "me":
            if (!text) {
                sendChatMessage(userId, "Usage: /me <action>");
                return;
            }
            handleMe(userId, actorId, text);
            break;

        case "ame":
            if (!text) {
                sendChatMessage(userId, "Usage: /ame <action>");
                return;
            }
            handleAme(userId, actorId, text);
            break;

        case "melow":
            if (!text) {
                sendChatMessage(userId, "Usage: /melow <action>");
                return;
            }
            handleMeLow(userId, actorId, text);
            break;

        case "melower":
            if (!text) {
                sendChatMessage(userId, "Usage: /melower <action>");
                return;
            }
            handleMeLower(userId, actorId, text);
            break;

        case "do":
            if (!text) {
                sendChatMessage(userId, "Usage: /do <text>");
                return;
            }
            handleDo(userId, actorId, text);
            break;

        case "my":
            if (!text) {
                sendChatMessage(userId, "Usage: /my <text>");
                return;
            }
            handleMy(userId, actorId, text);
            break;

        case "b":
            if (!text) {
                sendChatMessage(userId, "Usage: /b <text>");
                return;
            }
            handleOoc(userId, actorId, text);
            break;

        default:
            sendChatMessage(userId, "Unknown command: /" + cmd + ". Type /help.");
    }
}

function handleIncomingMessage(userId, actorId, message) {
    if (!message) return;

    rememberOnlineUser(userId, actorId);
    setChatTypingState(userId, actorId, false);

    if (message.startsWith("/")) {
        handleCommand(userId, message);
        return;
    }

    handleSay(userId, actorId, message);
}

function parseSubmittedChatMessage(message) {
    const raw = String(message || "").trim();
    if (!raw) {
        return { id: null, text: "" };
    }

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.text !== undefined) {
            return {
                id: parsed.id !== undefined ? String(parsed.id) : null,
                text: String(parsed.text || "").trim()
            };
        }
    } catch (e) {}

    return {
        id: null,
        text: raw
    };
}

function isLikelySyntheticChatSpam(message) {
    const text = String(message || "").trim();
    if (text.length < 6) return false;

    const compact = text.replace(/\s+/g, "");
    if (compact.length < 6) return false;
    if (/^(.)\1{5,}$/i.test(compact)) return true;

    const counts = {};
    let maxCount = 0;
    for (let i = 0; i < compact.length; i++) {
        const ch = compact.charAt(i).toLowerCase();
        counts[ch] = (counts[ch] || 0) + 1;
        if (counts[ch] > maxCount) {
            maxCount = counts[ch];
        }
    }

    return compact.length >= 10 && maxCount / compact.length >= 0.85;
}

function isDuplicateChatSubmit(userId, submitId, message) {
    const now = Date.now();
    const idKey = submitId ? String(userId) + ":id:" + submitId : null;
    const textKey = String(userId) + ":text:" + message.toLowerCase();
    const previousById = idKey ? recentChatSubmits[idKey] : null;
    const previousByText = recentChatSubmits[textKey];
    const entry = {
        message: message,
        at: now
    };

    if (idKey) {
        recentChatSubmits[idKey] = entry;
    }
    recentChatSubmits[textKey] = entry;

    pruneRecentChatStore(recentChatSubmits, 10000);

    return (!!previousById && previousById.message === message && now - previousById.at < 10000) ||
        (!!previousByText && previousByText.message === message && now - previousByText.at < 400);
}

mp._rpChatSubmit = function(actorId, message) {
    if (!actorId) return;

    const userId = mp.getUserByActor(actorId);
    if (typeof userId !== "number" || userId === INVALID_USER_ID) {
        return;
    }

    const submitted = parseSubmittedChatMessage(message);
    const cleanMessage = submitted.text;
    if (!cleanMessage || isLikelySyntheticChatSpam(cleanMessage) || isDuplicateChatSubmit(userId, submitted.id, cleanMessage)) {
        return;
    }

    handleIncomingMessage(userId, actorId, cleanMessage);
};

mp._rpChatTyping = function(actorId, payload) {
    if (!actorId) return;

    const userId = mp.getUserByActor(actorId);
    if (typeof userId !== "number" || userId === INVALID_USER_ID) {
        return;
    }
    rememberOnlineUser(userId, actorId);

    let parsed;
    try {
        parsed = JSON.parse(String(payload || ""));
    } catch (e) {
        return;
    }

    setChatTypingState(userId, actorId, !!(parsed && parsed.active));
};

function applyUserPresentation(userId, attempt) {
    attempt = attempt || 0;

    let actorId = 0;
    try {
        actorId = mp.getUserActor(userId);
    } catch (e) {
        actorId = 0;
    }

    if (!actorId) {
        if (attempt < 40) {
            setTimeout(function() {
                applyUserPresentation(userId, attempt + 1);
            }, 500);
        }
        return;
    }

    getUserChatSettings(userId);
    if (!chatUiReadyByUser[userId]) {
        mp.set(actorId, "ff_chatMsg", "");
        mp.set(actorId, "rp_adminPanel", "");
        mp.set(actorId, "rp_adminStealth", adminInvisibleByUser[userId] ? "1" : "0");
        mp.set(actorId, "rp_chatUi", "ready");
        chatUiReadyByUser[userId] = true;
    }

    const displayName = getDisplayName(actorId);
    refreshAdminPresentation(userId);
    applyUserChatSettings(userId);
    refreshRoleplaySceneViewForUser(userId, true);

    if (attempt === 0) {
        setTimeout(function() {
            refreshAdminPresentation(userId);
        }, 1000);
        setTimeout(function() {
            refreshAdminPresentation(userId);
        }, 3000);
        setTimeout(function() {
            refreshRoleplaySceneViewForUser(userId, true);
        }, 1200);
    }

    if (displayName === "Unknown" && attempt < 40) {
        setTimeout(function() {
            applyUserPresentation(userId, attempt + 1);
        }, 500);
    }
}

mp.on("connect", function(userId) {
    console.log("[gamemode] connect:", userId);
    onlineUsers[userId] = true;
    delete chatUiReadyByUser[userId];
    delete adminDutyByUser[userId];
    delete adminInvisibleByUser[userId];
    applyUserPresentation(userId, 0);
});

mp.on("disconnect", function(userId) {
    console.log("[gamemode] disconnect:", userId);
    try {
        const actorId = mp.getUserActor(userId);
        if (actorId) {
            delete lastAmePayloadByActor[actorId];
            delete lastRoleplayScenePayloadByActor[actorId];
        }
    } catch (e) {}
    delete userChatSettings[userId];
    delete userChatSettingKeys[userId];
    delete chatTypingStateByUser[String(userId)];
    delete chatUiReadyByUser[userId];
    delete roleplayScenePresenceByUser[String(userId)];
    delete onlineUsers[userId];
    delete adminCacheByUser[userId];
    delete adminDutyByUser[userId];
    delete adminInvisibleByUser[userId];
    delete changeCharacterCooldownByUser[userId];
    delete frozenUsers[userId];
    Object.keys(recentChatSubmits).forEach(function(key) {
        if (key.indexOf(String(userId) + ":") === 0) {
            delete recentChatSubmits[key];
        }
    });
    Object.keys(recentOutgoingChat).forEach(function(key) {
        if (key.indexOf(String(userId) + "|") === 0) {
            delete recentOutgoingChat[key];
        }
    });
    Object.keys(adminLastActionByUser).forEach(function(key) {
        if (key.indexOf(String(userId) + ":") === 0) {
            delete adminLastActionByUser[key];
        }
    });
    refreshAllAdminPresentations();
});

mp.on("customPacket", function(userId, content) {
    let data;
    try {
        data = JSON.parse(content);
    } catch (e) {
        return;
    }

    if (data.customPacketType !== "consoleCommand" && data.t !== 12) {
        return;
    }

    const message = Array.isArray(data.args) ? data.args.join(" ").trim() : "";
    if (!message) return;

    const actorId = mp.getUserActor(userId);
    if (!actorId) return;
    rememberOnlineUser(userId, actorId);
    if (isDuplicateChatSubmit(userId, null, message)) return;

    handleIncomingMessage(userId, actorId, message);
});

console.log("[gamemode] SK:RP loaded.");
