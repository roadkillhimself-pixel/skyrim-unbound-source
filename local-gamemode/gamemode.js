if (globalThis.__skrpGamemodeLoaded) {
    console.log("[gamemode] SK:RP already loaded; skipping duplicate registration.");
} else {
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
const CHATLOG_RETENTION_DAYS = 7;
const CHAT_USER_SETTINGS_FILE = path.join(process.cwd(), "skrp-chat-user-settings.json");
const CHAT_SETTINGS = {
    left: 34,
    top: 38,
    width: 720,
    visibleLines: 9,
    historyLines: 60,
    fontSize: 20,
    inputFontSize: 21,
    lineHeight: 27
};
const CHAT_SETTING_LIMITS = {
    fontSize: { min: 12, max: 34 },
    visibleLines: { min: 3, max: 18 },
    width: { min: 360, max: 1100 }
};

let chatMessageSeq = 0;
const userChatSettings = {};
const userChatSettingKeys = {};
globalThis.__skrpRecentChatSubmits = globalThis.__skrpRecentChatSubmits || {};
const recentChatSubmits = globalThis.__skrpRecentChatSubmits;
globalThis.__skrpRecentOutgoingChat = globalThis.__skrpRecentOutgoingChat || {};
const recentOutgoingChat = globalThis.__skrpRecentOutgoingChat;
globalThis.__skrpLastChatPayloadByActor = globalThis.__skrpLastChatPayloadByActor || {};
const lastChatPayloadByActor = globalThis.__skrpLastChatPayloadByActor;
globalThis.__skrpChatTypingStateByUser = globalThis.__skrpChatTypingStateByUser || {};
const chatTypingStateByUser = globalThis.__skrpChatTypingStateByUser;
const CHATLOG_DB_PATH = resolveUcpDbPath();

let chatLogDb = null;
let insertWitnessedChatLogStmt = null;
let pruneWitnessedChatLogStmt = null;
let lastWitnessedChatPruneAt = 0;

let persistedChatSettings = {};
try {
    if (fs.existsSync(CHAT_USER_SETTINGS_FILE)) {
        persistedChatSettings = JSON.parse(fs.readFileSync(CHAT_USER_SETTINGS_FILE, "utf8")) || {};
    }
} catch (e) {
    console.log("[gamemode] Failed to load chat user settings:", e);
    persistedChatSettings = {};
}

function resolveUcpDbPath() {
    try {
        const settingsPath = path.join(process.cwd(), "server-settings.json");
        if (fs.existsSync(settingsPath)) {
            const raw = fs.readFileSync(settingsPath, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.ucpDbPath === "string" && parsed.ucpDbPath.trim()) {
                return path.isAbsolute(parsed.ucpDbPath)
                    ? parsed.ucpDbPath
                    : path.resolve(process.cwd(), parsed.ucpDbPath);
            }
        }
    } catch (e) {
        console.log("[gamemode] Failed to resolve custom UCP DB path, falling back to default:", e);
    }

    return path.resolve(process.cwd(), "ucp", "skyrim-unbound-ucp.sqlite");
}

function ensureWitnessedChatLogStore() {
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

const CHAT_BOOTSTRAP_BROWSER_JS = `
(function() {
  function getChatSettings() {
    var defaults = {
      left: ${CHAT_SETTINGS.left},
      top: ${CHAT_SETTINGS.top},
      width: ${CHAT_SETTINGS.width},
      visibleLines: ${CHAT_SETTINGS.visibleLines},
      historyLines: ${CHAT_SETTINGS.historyLines},
      fontSize: ${CHAT_SETTINGS.fontSize},
      inputFontSize: ${CHAT_SETTINGS.inputFontSize},
      lineHeight: ${CHAT_SETTINGS.lineHeight},
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

  function applyChatSettings() {
    var settings = getChatSettings();
    var root = document.getElementById('skrp-chat-root');
    var log = document.getElementById('skrp-chat-log');
    var input = document.getElementById('skrp-chat-input');

    if (root) {
      root.style.left = settings.left + 'px';
      root.style.top = settings.top + 'px';
      root.style.width = settings.width + 'px';
    }

    if (log) {
      log.style.maxHeight = (settings.visibleLines * settings.lineHeight + 20) + 'px';
      log.style.fontSize = settings.fontSize + 'px';
      log.style.lineHeight = settings.lineHeight + 'px';
    }

    if (input) {
      input.style.fontSize = settings.inputFontSize + 'px';
    }

    renderChatLog();
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
    var now = Date.now();
    var last = window.__skrpLastChatSubmit;
    if (last && last.text === text && now - last.at < 750) {
      return false;
    }
    window.__skrpLastChatSubmit = { text: text, at: now };
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

  function normalizeChatPayload(payload) {
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        payload = { text: payload };
      }
    }

    var createdAt = payload && payload.createdAt ? String(payload.createdAt) : new Date().toISOString();
    return {
      seq: payload && payload.seq !== undefined && payload.seq !== null ? String(payload.seq) : null,
      text: payload && payload.text !== undefined ? String(payload.text) : String(payload),
      color: payload && payload.color ? String(payload.color) : '#f8f2df',
      createdAt: createdAt
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

  function renderChatLog() {
    var log = document.getElementById('skrp-chat-log');
    if (!log) return;

    var shouldStickToBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 12;
    log.innerHTML = '';

    var messages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
    for (var i = 0; i < messages.length; i++) {
      var line = document.createElement('div');
      line.textContent = formatChatLine(messages[i]);
      line.style.color = messages[i].color;
      log.appendChild(line);
    }

    if (shouldStickToBottom) {
      log.scrollTop = log.scrollHeight;
    }
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
      root.style.top = settings.top + 'px';
      root.style.width = settings.width + 'px';
      root.style.zIndex = '2147483647';
      root.style.fontFamily = 'Din-pro, \"Trebuchet MS\", Arial, sans-serif';
      root.style.fontWeight = '700';
      root.style.letterSpacing = '0.25px';
      root.style.pointerEvents = 'auto';

      var log = document.createElement('div');
      log.id = 'skrp-chat-log';
      log.style.maxHeight = (settings.visibleLines * settings.lineHeight + 20) + 'px';
      log.style.overflowY = 'hidden';
      log.style.marginBottom = '10px';
      log.style.padding = '8px 12px 10px';
      log.style.background = 'linear-gradient(180deg, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.34))';
      log.style.color = '#f5f5f5';
      log.style.fontSize = settings.fontSize + 'px';
      log.style.lineHeight = settings.lineHeight + 'px';
      log.style.textShadow = '0 0 2px rgba(0, 0, 0, 0.98), 1px 1px 0 rgba(0, 0, 0, 0.98), -1px 1px 0 rgba(0, 0, 0, 0.98), 1px -1px 0 rgba(0, 0, 0, 0.98), -1px -1px 0 rgba(0, 0, 0, 0.98)';
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
      input.style.textShadow = '0 0 2px rgba(0, 0, 0, 0.98), 1px 1px 0 rgba(0, 0, 0, 0.98)';
      input.style.outline = 'none';

      if (!input.__skrpChatListenersInstalled) {
        input.__skrpChatListenersInstalled = true;

        input.addEventListener('keydown', function(event) {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            showChatHistory(event.key === 'ArrowUp' ? -1 : 1, input);
            return;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            var text = input.value.trim();
            if (!text) return;
            if (!shouldSendChatSubmit(text)) return;
            storeSentChatMessage(text);
            sendChatTypingState(false);
            input.value = '';
            if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
              window.__skrpChatSubmitSeq = (window.__skrpChatSubmitSeq || 0) + 1;
              window.skyrimPlatform.sendMessage('rpChatSubmit', JSON.stringify({
                id: Date.now() + ':' + window.__skrpChatSubmitSeq,
                text: text
              }));
            }
          }
        });

        input.addEventListener('input', function() {
          resetChatHistoryCursor();
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

    applyChatSettings();
    return root;
  }

  window._skrpChatApplySettings = function(settings) {
    window.__skrpChatSettings = Object.assign({}, window.__skrpChatSettings || {}, settings || {});
    ensurePlainChat();
    applyChatSettings();
    renderChatLog();
  };

  window._skrpOpenChat = function() {
    var root = ensurePlainChat();
    if (!root) {
      setTimeout(window._skrpOpenChat, 250);
      return;
    }

    root.style.display = 'block';
    setTimeout(function() {
      var input = document.getElementById('skrp-chat-input');
      if (input) input.focus();
    }, 25);
  };

  window._skrpChatPush = function(payload) {
    var root = ensurePlainChat();
    if (!root) return;

    var log = document.getElementById('skrp-chat-log');
    if (!log) return;

    var entry = normalizeChatPayload(payload);
    var text = entry.text;
    var color = entry.color;

    if (!shouldRenderChatPayload(entry, color, text)) {
      return;
    }

    window.__skrpChatMessages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
    window.__skrpChatMessages.push(entry);
    while (window.__skrpChatMessages.length > ${CHAT_SETTINGS.historyLines}) {
      window.__skrpChatMessages.shift();
    }

    renderChatLog();
  };

  var pending = Array.isArray(window.__skrpPendingChat) ? window.__skrpPendingChat : [];
  window.__skrpPendingChat = [];

  ensurePlainChat();

  for (var j = 0; j < pending.length; j++) {
    window._skrpChatPush(pending[j]);
  }

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

    var payloadForBrowser = {
        text: String(ctx.value),
        color: "#f8f2df",
        seq: null,
        createdAt: null
    };
    try {
        var payload = JSON.parse(ctx.value);
        if (payload && payload.text !== undefined) {
            payloadForBrowser.text = String(payload.text);
        }
        if (payload && payload.color !== undefined) {
            payloadForBrowser.color = String(payload.color);
        }
        if (payload && payload.seq !== undefined) {
            payloadForBrowser.seq = String(payload.seq);
        }
        if (payload && payload.createdAt !== undefined) {
            payloadForBrowser.createdAt = String(payload.createdAt);
        }
    } catch (e) {}

    if (ctx.sp.browser) {
        var script = [
            "(function() {",
            "  var payload = " + JSON.stringify(payloadForBrowser) + ";",
            "  if (window._skrpChatPush) {",
            "    window._skrpChatPush(payload);",
            "  } else {",
            "    window.__skrpPendingChat = Array.isArray(window.__skrpPendingChat) ? window.__skrpPendingChat : [];",
            "    window.__skrpPendingChat.push(payload);",
            "  }",
            "})();"
        ].join("\\n");
        ctx.sp.browser.executeJavaScript(script);
    }
`.trim();

const CHAT_UI_UPDATE_OWNER_JS = `
    if (ctx.state.installed) return;
    ctx.state.installed = true;
    if (!ctx.sp.browser) return;
    ctx.sp.browser.executeJavaScript(${JSON.stringify(CHAT_BOOTSTRAP_BROWSER_JS)});
`.trim();

const CHAT_SETTINGS_UPDATE_OWNER_JS = `
    if (ctx.value === undefined || ctx.value === null) return;
    if (ctx.state.last === ctx.value) return;
    ctx.state.last = ctx.value;
    if (!ctx.sp.browser) return;

    var settingsForBrowser = {};
    try {
        settingsForBrowser = JSON.parse(String(ctx.value));
    } catch (e) {}

    var script = [
        "(function() {",
        "  var settings = " + JSON.stringify(settingsForBrowser) + ";",
        "  window.__skrpChatSettings = Object.assign({}, window.__skrpChatSettings || {}, settings);",
        "  if (window._skrpChatApplySettings) {",
        "    window._skrpChatApplySettings(settings);",
        "  }",
        "})();"
    ].join("\\n");

    ctx.sp.browser.executeJavaScript(script);
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

    var headPart = "NPC Head [Head]";
    var headScreenPos = ctx.sp.worldPointToScreenPoint([
        ctx.sp.NetImmerse.getNodeWorldPositionX(ctx.refr, headPart, false),
        ctx.sp.NetImmerse.getNodeWorldPositionY(ctx.refr, headPart, false),
        ctx.sp.NetImmerse.getNodeWorldPositionZ(ctx.refr, headPart, false) + 76
    ])[0];

    if (!headScreenPos || headScreenPos[2] <= 0) {
        removeTypingIndicator();
        return;
    }

    var resolution = ctx.state.screenResolution;
    var textXPos = Math.round(headScreenPos[0] * resolution.width);
    var textYPos = Math.round((1 - headScreenPos[1]) * resolution.height);

    if (!ctx.state.typingIndicatorTextId) {
        ctx.state.typingIndicatorTextId = ctx.sp.createText(textXPos, textYPos, "[. . .]", [1, 0.64, 0.22, 0.95], "Tavern");
        ctx.sp.setTextFont(ctx.state.typingIndicatorTextId, "Tavern");
        ctx.sp.setTextSize(ctx.state.typingIndicatorTextId, 0.58);
    } else {
        ctx.sp.setTextString(ctx.state.typingIndicatorTextId, "[. . .]");
        ctx.sp.setTextPos(ctx.state.typingIndicatorTextId, textXPos, textYPos);
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

    var displayName = "";
    try {
        displayName = String(ctx.refr.getDisplayName() || "").trim();
    } catch (e) {
        displayName = "";
    }

    if (!displayName) {
        displayName = String(ctx.value || "").trim();
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

    var headPart = "NPC Head [Head]";
    var headScreenPos = ctx.sp.worldPointToScreenPoint([
        ctx.sp.NetImmerse.getNodeWorldPositionX(ctx.refr, headPart, false),
        ctx.sp.NetImmerse.getNodeWorldPositionY(ctx.refr, headPart, false),
        ctx.sp.NetImmerse.getNodeWorldPositionZ(ctx.refr, headPart, false) + 58
    ])[0];

    if (!headScreenPos || headScreenPos[2] <= 0) {
        removeOwnerNameplate();
        return;
    }

    var resolution = ctx.state.screenResolution;
    var textXPos = Math.round(headScreenPos[0] * resolution.width);
    var textYPos = Math.round((1 - headScreenPos[1]) * resolution.height);

    if (!ctx.state.ownerNameplateTextId) {
        ctx.state.ownerNameplateTextId = ctx.sp.createText(textXPos, textYPos, displayName, [1, 1, 1, 0.95], "Tavern");
        ctx.sp.setTextFont(ctx.state.ownerNameplateTextId, "Tavern");
        ctx.sp.setTextSize(ctx.state.ownerNameplateTextId, 0.72);
    } else {
        ctx.sp.setTextString(ctx.state.ownerNameplateTextId, displayName);
        ctx.sp.setTextPos(ctx.state.ownerNameplateTextId, textXPos, textYPos);
    }
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

mp.makeProperty("rp_nameplateOwner", {
    isVisibleByOwner: true,
    isVisibleByNeighbors: false,
    updateOwner: OWNER_NAMEPLATE_UPDATE_JS,
    updateNeighbor: ``
});

mp.makeEventSource("_rpChatSubmit", EVENT_SOURCE_JS);
mp.makeEventSource("_rpChatTyping", TYPING_EVENT_SOURCE_JS);

function makeChatPayload(message, color) {
    chatMessageSeq += 1;
    return JSON.stringify({
        seq: chatMessageSeq,
        text: String(message),
        color: color || "#f8f2df",
        createdAt: new Date().toISOString()
    });
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

    pruneRecentChatStore(recentOutgoingChat, 5000);
    return !!previous && now - previous.at < 5000;
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

    delete chatTypingStateByUser[key];
    mp.set(actorId, "rp_chatTyping", "");
}

function sendChatMessage(userId, message, color, options) {
    const actorId = mp.getUserActor(userId);
    if (!actorId) return;

    const text = String(message || "");
    const chatColor = color || "#f8f2df";
    if (!text.trim() || isDuplicateOutgoingChat(userId, text, chatColor)) {
        return;
    }

    const payload = makeChatPayload(text, chatColor);
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
        left: CHAT_SETTINGS.left,
        top: CHAT_SETTINGS.top,
        width: CHAT_SETTINGS.width,
        visibleLines: CHAT_SETTINGS.visibleLines,
        historyLines: CHAT_SETTINGS.historyLines,
        fontSize: CHAT_SETTINGS.fontSize,
        inputFontSize: CHAT_SETTINGS.inputFontSize,
        lineHeight: CHAT_SETTINGS.lineHeight,
        timestamps: false,
        autoGrammar: false
    };
}

function sanitizeChatSettings(settings) {
    return {
        left: Number(settings.left) || CHAT_SETTINGS.left,
        top: Number(settings.top) || CHAT_SETTINGS.top,
        width: Number(settings.width) || CHAT_SETTINGS.width,
        visibleLines: Number(settings.visibleLines) || CHAT_SETTINGS.visibleLines,
        historyLines: Number(settings.historyLines) || CHAT_SETTINGS.historyLines,
        fontSize: Number(settings.fontSize) || CHAT_SETTINGS.fontSize,
        inputFontSize: Number(settings.inputFontSize) || CHAT_SETTINGS.inputFontSize,
        lineHeight: Number(settings.lineHeight) || CHAT_SETTINGS.lineHeight,
        timestamps: !!settings.timestamps,
        autoGrammar: !!settings.autoGrammar
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

    mp.set(actorId, "rp_chatSettings", JSON.stringify(getUserChatSettings(userId)));
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

    const sourcePos = mp.getActorPos(actorId);
    if (!Array.isArray(sourcePos) || sourcePos.length < 3) {
        return [];
    }

    const cellOrWorldDesc = mp.getDescFromId(mp.getActorCellOrWorld(actorId));
    const nearbyRefs = mp.getNeighborsByPosition(cellOrWorldDesc, sourcePos) || [];
    const maxDistanceSquared = radius * radius;
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

function sendChatToNearby(actorId, radius, message, color, chatKind) {
    const nearbyUserIds = getNearbyUserIds(actorId, radius);
    nearbyUserIds.forEach(function(userId) {
        sendChatMessage(userId, message, color, { timestamp: true });
    });
    storeWitnessedChat(actorId, nearbyUserIds, radius, message, color, chatKind);
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

function handleSay(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, SAY_RADIUS, name + " says: " + applyAutoGrammar(userId, text, true), undefined, "say");
}

function handleLow(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, LOW_RADIUS, name + " says (low): " + applyAutoGrammar(userId, text, true), undefined, "low");
}

function handleLower(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, LOWER_RADIUS, name + " says (lower): " + applyAutoGrammar(userId, text, true), undefined, "lower");
}

function handleShout(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, SHOUT_RADIUS, name + " shouts: " + normalizeShoutText(userId, text), undefined, "shout");
}

function handleMe(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, SAY_RADIUS, name + " " + applyAutoGrammar(userId, text, false), EMOTE_COLOR, "me");
}

function handleMeLow(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, LOW_RADIUS, name + " " + applyAutoGrammar(userId, text, false), EMOTE_COLOR, "me-low");
}

function handleMeLower(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, LOWER_RADIUS, name + " " + applyAutoGrammar(userId, text, false), EMOTE_COLOR, "me-lower");
}

function handleDo(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, SAY_RADIUS, applyAutoGrammar(userId, text, true) + " ((" + name + "))", EMOTE_COLOR, "do");
}

function handleMy(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, SAY_RADIUS, name + "'s " + applyAutoGrammar(userId, text, false), EMOTE_COLOR, "my");
}

function handleOoc(userId, actorId, text) {
    const name = getDisplayName(actorId);
    sendChatToNearby(actorId, OOC_RADIUS, "(( " + name + " says: " + applyAutoGrammar(userId, text, true) + " ))", undefined, "ooc");
}

function handleCommand(userId, raw) {
    const actorId = mp.getUserActor(userId);
    if (!actorId) return;

    const parts = raw.slice(1).trim().split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();
    const text = parts.slice(1).join(" ").trim();

    switch (cmd) {
        case "help":
            sendChatMessage(userId, "/low <text> | /lower <text> | /s <text> | /shout <text> | /me <action> | /melow <action> | /melower <action> | /my <text> | /do <text> | /b <text> | /timestamps | /ag");
            break;

        case "chatsettings":
            sendChatMessage(userId, describeUserChatSettings(userId));
            sendChatMessage(userId, "Use /fontsize <12-34>, /chatlines <3-18>, /chatwidth <360-1100>, /timestamps, /ag, or /chatreset.");
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
                sendChatMessage(userId, "Usage: /fontsize <12-34>");
                return;
            }

            const settings = getUserChatSettings(userId);
            settings.fontSize = size;
            settings.inputFontSize = size + 1;
            settings.lineHeight = size + 7;
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
                sendChatMessage(userId, "Usage: /chatwidth <360-1100>");
                return;
            }

            const settings = getUserChatSettings(userId);
            settings.width = width;
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
        (!!previousByText && previousByText.message === message && now - previousByText.at < 1500);
}

mp._rpChatSubmit = function(actorId, message) {
    if (!actorId) return;

    const userId = mp.getUserByActor(actorId);
    if (typeof userId !== "number" || userId === INVALID_USER_ID) {
        return;
    }

    const submitted = parseSubmittedChatMessage(message);
    const cleanMessage = submitted.text;
    if (!cleanMessage || isDuplicateChatSubmit(userId, submitted.id, cleanMessage)) {
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

    let parsed;
    try {
        parsed = JSON.parse(String(payload || ""));
    } catch (e) {
        return;
    }

    setChatTypingState(userId, actorId, !!(parsed && parsed.active));
};

mp.on("connect", function(userId) {
    console.log("[gamemode] connect:", userId);

    setTimeout(function() {
        const actorId = mp.getUserActor(userId);
        if (!actorId) return;

        getUserChatSettings(userId);
        mp.set(actorId, "ff_chatMsg", "");
        mp.set(actorId, "rp_chatTyping", "");
        mp.set(actorId, "rp_nameplateOwner", getDisplayName(actorId));
        applyUserChatSettings(userId);
    }, 1000);
});

mp.on("disconnect", function(userId) {
    console.log("[gamemode] disconnect:", userId);
    delete userChatSettings[userId];
    delete userChatSettingKeys[userId];
    delete chatTypingStateByUser[String(userId)];
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

    handleIncomingMessage(userId, actorId, message);
});

console.log("[gamemode] SK:RP loaded.");
}
