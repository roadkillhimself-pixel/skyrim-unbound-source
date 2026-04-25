
// TODO: send event instead of direct dependency on FormView class
import { FormView } from "../../view/formView";
import { QueryKeyCodeBindings } from "../events/queryKeyCodeBindings";
import * as messages from "../../messages";

import { ClientListener, CombinedController, Sp } from "./clientListener";
import { NetworkingService } from "./networkingService";
import { ConnectionMessage } from "../events/connectionMessage";
import { CreateActorMessage } from "../messages/createActorMessage";
import { BrowserMessageEvent, ButtonEvent, DxScanCode, Menu, MenuCloseEvent, MenuOpenEvent, storage } from "skyrimPlatform";

const unfocusEventString = `
  (function() {
    var root = document.getElementById('skrp-chat-root');
    var input = document.getElementById('skrp-chat-input');
    var counter = document.getElementById('skrp-chat-counter');
    if (input) {
      if (typeof input.blur === 'function') input.blur();
      input.style.display = 'none';
    }
    if (counter) {
      counter.style.display = 'none';
    }
    if (root) {
      root.setAttribute('data-chat-open', 'false');
    }
    try {
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.skyrimPlatform.sendMessage('rpChatDebugState', JSON.stringify({
          event: 'chat-unfocus',
          important: true,
          at: new Date().toISOString()
        }));
      }
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('skymp5-client:browserUnfocused', {}));
  })();
`;
const resetChatStateEventString = `
  (function() {
    var root = document.getElementById('skrp-chat-root');
    if (root && root.parentNode) root.parentNode.removeChild(root);
    var disconnectNotice = document.getElementById('skrp-connection-error');
    if (disconnectNotice && disconnectNotice.parentNode) disconnectNotice.parentNode.removeChild(disconnectNotice);
    window.__skrpPendingChat = [];
    window.__skrpChatInputHistory = [];
    window.__skrpChatHistoryIndex = null;
    window.__skrpChatDraft = '';
    window.__skrpChatSettings = undefined;
    window.__skrpChatMessages = [];
    window.__skrpRenderedChatKeys = {};
    window.__skrpRenderedChatOrder = [];
    window.__skrpLastChatSubmit = undefined;
    window.__skrpChatTypingState = false;
    window.__skrpChatOpenPrefill = '';
    window._skrpOpenChat = undefined;
    window._skrpChatPush = undefined;
    window._skrpChatApplySettings = undefined;
    try {
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.skyrimPlatform.sendMessage('rpChatDebugState', JSON.stringify({
          event: 'chat-reset',
          important: true,
          at: new Date().toISOString()
        }));
      }
    } catch (e) {}
  })();
`;

const clearDisconnectNoticeEventString = `
  (function() {
    var disconnectNotice = document.getElementById('skrp-connection-error');
    if (disconnectNotice && disconnectNotice.parentNode) {
      disconnectNotice.parentNode.removeChild(disconnectNotice);
    }
  })();
`;

const serverInitiatedQuitStorageKey = "skymp-server-initiated-main-menu-quit";
const gracefulDisconnectPacketType = "gracefulDisconnect";
const browserChatHotkeyState = (() => {
  const stateHolder = globalThis as typeof globalThis & {
    __skympBrowserChatHotkeyState?: {
      openLatch: boolean;
    };
  };

  if (!stateHolder.__skympBrowserChatHotkeyState) {
    stateHolder.__skympBrowserChatHotkeyState = {
      openLatch: false,
    };
  }

  return stateHolder.__skympBrowserChatHotkeyState;
})();
const browserServiceRuntime = (() => {
  const stateHolder = globalThis as typeof globalThis & {
    __skympBrowserServiceRuntime?: {
      nextInstanceId: number;
      activeInstanceId: number;
    };
  };

  if (!stateHolder.__skympBrowserServiceRuntime) {
    stateHolder.__skympBrowserServiceRuntime = {
      nextInstanceId: 0,
      activeInstanceId: 0,
    };
  }

  return stateHolder.__skympBrowserServiceRuntime;
})();

const showDisconnectNoticeEventString = `
  (function showDisconnectNotice() {
    if (!document.body) {
      setTimeout(showDisconnectNotice, 250);
      return;
    }

    var disconnectNotice = document.getElementById('skrp-connection-error');
    if (disconnectNotice && disconnectNotice.parentNode) {
      disconnectNotice.parentNode.removeChild(disconnectNotice);
    }

    var box = document.createElement('div');
    box.id = 'skrp-connection-error';
    box.textContent = 'Server Closed Connection';
    box.style.position = 'fixed';
    box.style.left = '50%';
    box.style.top = '20%';
    box.style.transform = 'translateX(-50%)';
    box.style.zIndex = '2147483647';
    box.style.padding = '12px 20px';
    box.style.background = 'rgba(90, 10, 10, 0.92)';
    box.style.border = '2px solid rgba(255, 230, 230, 0.95)';
    box.style.borderRadius = '6px';
    box.style.color = '#fff4f4';
    box.style.fontFamily = 'Georgia, serif';
    box.style.fontSize = '28px';
    box.style.letterSpacing = '0.02em';
    box.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';
    box.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.45)';
    document.body.appendChild(box);
  })();
`;

const openChatEventString = `
  (function() {
    var defaults = {
      left: 34,
      top: 38,
      width: 720,
      visibleLines: 9,
      historyLines: 60,
      fontSize: 20,
      inputFontSize: 21,
      lineHeight: 27,
      timestamps: false
    };
    var maxInputLength = 300;

    function settings() {
      var current = window.__skrpChatSettings || {};
      var result = Object.assign({}, defaults);
      for (var key in current) {
        if (Object.prototype.hasOwnProperty.call(result, key) && current[key] !== undefined) {
          result[key] = Number(current[key]) || result[key];
        }
      }
      return result;
    }

    function installWheel(root, log) {
      if (!root || !log || root.__skrpWheelInstalled) return;
      root.__skrpWheelInstalled = true;
      root.addEventListener('wheel', function(event) {
        event.preventDefault();
        event.stopPropagation();
        log.scrollTop += event.deltaY;
      }, { passive: false });
    }

    function ensureHistory() {
      if (!Array.isArray(window.__skrpChatInputHistory)) window.__skrpChatInputHistory = [];
      return window.__skrpChatInputHistory;
    }

    function resetCursor() {
      window.__skrpChatHistoryIndex = null;
      window.__skrpChatDraft = '';
    }

    function remember(text) {
      var history = ensureHistory();
      if (history[history.length - 1] !== text) history.push(text);
      while (history.length > 50) history.shift();
      resetCursor();
    }

    function showHistory(direction, input) {
      var history = ensureHistory();
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

    function shouldRenderPayload(payload, color, text) {
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

    function shouldSendSubmit(text) {
      var now = Date.now();
      var last = window.__skrpLastChatSubmit;
      if (last && last.text === text && now - last.at < 750) {
        return false;
      }
      window.__skrpLastChatSubmit = { text: text, at: now };
      return true;
    }

    function getCounterColor(length) {
      if (length >= maxInputLength) return '#d86a5f';
      if (length >= 250) return '#d89453';
      if (length >= 200) return '#d7c86f';
      return 'rgba(248, 242, 223, 0.68)';
    }

    function updateCounter(input) {
      var counter = document.getElementById('skrp-chat-counter');
      if (!counter || !input) return;
      var length = input.value.length;
      counter.textContent = length + '/' + maxInputLength;
      counter.style.color = getCounterColor(length);
    }

    function sendChatTypingState(active) {
      active = !!active;
      if (window.__skrpChatTypingState === active) {
        return;
      }
      window.__skrpChatTypingState = active;
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.skyrimPlatform.sendMessage('rpChatTyping', JSON.stringify({
          active: active
        }));
      }
    }

    function sendChatDebugState(eventName, extra) {
      try {
        if (!(window.skyrimPlatform && window.skyrimPlatform.sendMessage)) return;
        window.skyrimPlatform.sendMessage('rpChatDebugState', JSON.stringify(Object.assign({
          event: eventName,
          at: new Date().toISOString()
        }, extra || {})));
      } catch (e) {}
    }

    function normalizePayload(payload) {
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = { text: payload }; }
      }

      return {
        seq: payload && payload.seq !== undefined && payload.seq !== null ? String(payload.seq) : null,
        text: payload && payload.text !== undefined ? String(payload.text) : String(payload),
        color: payload && payload.color ? String(payload.color) : '#f8f2df',
        createdAt: payload && payload.createdAt ? String(payload.createdAt) : new Date().toISOString()
      };
    }

    function formatTimestamp(createdAt) {
      var date = new Date(createdAt);
      if (isNaN(date.getTime())) date = new Date();
      var hours = String(date.getHours()).padStart(2, '0');
      var minutes = String(date.getMinutes()).padStart(2, '0');
      var seconds = String(date.getSeconds()).padStart(2, '0');
      return '[ ' + hours + ':' + minutes + ':' + seconds + ':] ';
    }

    function formatLine(entry) {
      return (settings().timestamps ? formatTimestamp(entry.createdAt) : '') + entry.text;
    }

    function renderLog() {
      var log = document.getElementById('skrp-chat-log');
      if (!log) return;

      var shouldStick = log.scrollTop + log.clientHeight >= log.scrollHeight - 12;
      log.innerHTML = '';

      var messages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
      for (var i = 0; i < messages.length; i++) {
        var line = document.createElement('div');
        line.textContent = formatLine(messages[i]);
        line.style.color = messages[i].color;
        log.appendChild(line);
      }

      if (shouldStick) log.scrollTop = log.scrollHeight;
    }

    function applySettings() {
      var s = settings();
      var root = document.getElementById('skrp-chat-root');
      var log = document.getElementById('skrp-chat-log');
      var input = document.getElementById('skrp-chat-input');
      if (root) {
        root.style.left = s.left + 'px';
        root.style.top = s.top + 'px';
        root.style.width = s.width + 'px';
      }
      if (log) {
        log.style.maxHeight = (s.visibleLines * s.lineHeight + 20) + 'px';
        log.style.fontSize = s.fontSize + 'px';
        log.style.lineHeight = s.lineHeight + 'px';
      }
      if (input) input.style.fontSize = s.inputFontSize + 'px';
      renderLog();
    }

    function ensureChat() {
      if (!document.body) return null;
      var s = settings();
      var root = document.getElementById('skrp-chat-root');
      if (!root) {
        window.__skrpChatMessages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
        root = document.createElement('div');
        root.id = 'skrp-chat-root';
        root.style.position = 'fixed';
        root.style.left = s.left + 'px';
        root.style.top = s.top + 'px';
        root.style.width = s.width + 'px';
        root.style.zIndex = '2147483647';
        root.style.fontFamily = 'Georgia, serif';
        root.style.pointerEvents = 'auto';

        var log = document.createElement('div');
        log.id = 'skrp-chat-log';
        log.style.maxHeight = (s.visibleLines * s.lineHeight + 20) + 'px';
        log.style.overflowY = 'auto';
        log.style.marginBottom = '10px';
        log.style.padding = '10px 12px';
        log.style.background = 'rgba(0, 0, 0, 0.34)';
        log.style.color = '#f8f2df';
        log.style.fontSize = s.fontSize + 'px';
        log.style.lineHeight = s.lineHeight + 'px';
        log.style.textShadow = '1px 1px 2px #000';
        root.appendChild(log);
        installWheel(root, log);

        var input = document.createElement('input');
        input.id = 'skrp-chat-input';
        input.type = 'text';
        input.maxLength = maxInputLength;
        input.autocomplete = 'off';
        input.placeholder = 'Say something in character...';
        input.style.boxSizing = 'border-box';
        input.style.width = '100%';
        input.style.height = '44px';
        input.style.padding = '7px 12px';
        input.style.border = '1px solid rgba(248, 242, 223, 0.75)';
        input.style.borderRadius = '3px';
        input.style.background = 'rgba(0, 0, 0, 0.72)';
        input.style.color = '#fff7df';
        input.style.fontSize = s.inputFontSize + 'px';
        input.style.outline = 'none';
        input.style.display = 'none';

        var inputWrap = document.createElement('div');
        inputWrap.style.display = 'grid';
        inputWrap.style.gap = '6px';

        var counter = document.createElement('div');
        counter.id = 'skrp-chat-counter';
        counter.textContent = '0/' + maxInputLength;
        counter.style.alignSelf = 'end';
        counter.style.justifySelf = 'end';
        counter.style.fontSize = '13px';
        counter.style.lineHeight = '1';
        counter.style.letterSpacing = '0.04em';
        counter.style.color = 'rgba(248, 242, 223, 0.68)';
        counter.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.9)';

        input.addEventListener('keydown', function(event) {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            showHistory(event.key === 'ArrowUp' ? -1 : 1, input);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            sendChatDebugState('escape-keydown', {
              important: true,
              valueLength: input.value.length
            });
            sendChatTypingState(false);
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            var text = input.value.trim();
            if (!text) return;
            if (!shouldSendSubmit(text)) return;
            remember(text);
            sendChatDebugState('submit-enter', {
              important: true,
              textLength: text.length,
              preview: text.slice(0, 80)
            });
            sendChatTypingState(false);
            input.value = '';
            updateCounter(input);
            if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
              window.__skrpChatSubmitSeq = (window.__skrpChatSubmitSeq || 0) + 1;
              window.skyrimPlatform.sendMessage('rpChatSubmit', JSON.stringify({
                id: Date.now() + ':' + window.__skrpChatSubmitSeq,
                text: text
              }));
              setTimeout(function() {
                window.skyrimPlatform.sendMessage('rpChatClose', '');
              }, 75);
            }
          }
        });
        input.addEventListener('keyup', function(event) {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            sendChatDebugState('escape-keyup', {
              important: true,
              valueLength: input.value.length
            });
            if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
              window.skyrimPlatform.sendMessage('rpChatClose', '');
            }
          }
        });

        input.addEventListener('input', function() {
          resetCursor();
          sendChatDebugState('draft-changed', {
            valueLength: input.value.length,
            preview: input.value.slice(0, 80)
          });
          sendChatTypingState(input.value.trim().length > 0);
          updateCounter(input);
        });
        input.addEventListener('focus', function() {
          sendChatDebugState('input-focus', {
            important: true,
            valueLength: input.value.length
          });
          updateCounter(input);
        });
        input.addEventListener('blur', function() {
          sendChatDebugState('input-blur', {
            important: true,
            valueLength: input.value.length
          });
          sendChatTypingState(false);
          updateCounter(input);
        });
        inputWrap.appendChild(input);
        inputWrap.appendChild(counter);
        root.appendChild(inputWrap);
        document.body.appendChild(root);
        sendChatDebugState('chat-ui-created', {
          important: true
        });
      } else {
        installWheel(root, document.getElementById('skrp-chat-log'));
      }
      if (root) root.setAttribute('data-chat-open', 'true');
      var input = document.getElementById('skrp-chat-input');
      if (input) {
        input.style.display = 'block';
        var counter = document.getElementById('skrp-chat-counter');
        if (counter) {
          counter.style.display = 'block';
        }
        var prefill = typeof window.__skrpChatOpenPrefill === 'string' ? window.__skrpChatOpenPrefill : '';
        if (prefill && !input.value) {
          input.value = prefill;
        }
        window.__skrpChatOpenPrefill = '';
        updateCounter(input);
      }
      sendChatDebugState('chat-opened', {
        important: true,
        existingValueLength: input ? input.value.length : 0
      });
      applySettings();
      return root;
    }

    window._skrpChatApplySettings = function(newSettings) {
      window.__skrpChatSettings = Object.assign({}, window.__skrpChatSettings || {}, newSettings || {});
      ensureChat();
      applySettings();
      renderLog();
    };

    window._skrpChatPush = function(payload) {
      var root = ensureChat();
      if (!root) return;
      var log = document.getElementById('skrp-chat-log');
      if (!log) return;
      var entry = normalizePayload(payload);
      var text = entry.text;
      var color = entry.color;
      if (!shouldRenderPayload(entry, color, text)) {
        return;
      }

      window.__skrpChatMessages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
      window.__skrpChatMessages.push(entry);
      while (window.__skrpChatMessages.length > defaults.historyLines) window.__skrpChatMessages.shift();
      renderLog();
    };

    var root = ensureChat();
    var pending = Array.isArray(window.__skrpPendingChat) ? window.__skrpPendingChat : [];
    window.__skrpPendingChat = [];
    for (var i = 0; i < pending.length; i++) window._skrpChatPush(pending[i]);
    if (root) root.style.display = 'block';
    setTimeout(function() {
      var input = document.getElementById('skrp-chat-input');
      if (input) {
        input.focus();
        input.selectionStart = input.value.length;
        input.selectionEnd = input.value.length;
      }
    }, 25);
  })();
`;

const focusChatInputEventString = `
  (function() {
    var root = document.getElementById('skrp-chat-root');
    var input = document.getElementById('skrp-chat-input');
    var counter = document.getElementById('skrp-chat-counter');
    if (root) {
      root.style.display = 'block';
      root.setAttribute('data-chat-open', 'true');
    }
    if (input) {
      input.style.display = 'block';
      if (typeof input.focus === 'function') input.focus();
      input.selectionStart = input.value.length;
      input.selectionEnd = input.value.length;
    }
    if (counter) {
      counter.style.display = 'block';
    }
  })();
`;

export class BrowserService extends ClientListener {
  private readonly browserServiceInstanceId: number;

  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.browserServiceInstanceId = ++browserServiceRuntime.nextInstanceId;
    browserServiceRuntime.activeInstanceId = this.browserServiceInstanceId;
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(false);
    try {
      this.sp.browser.loadUrl(this.startupBrowserUrl);
    } catch (error) {
      this.pushChatDebugEntry("startupBrowserLoadUrlError", {
        important: true,
        error: `${error}`,
      });
    }

    this.controller.emitter.on("queryKeyCodeBindings", (e) => this.onQueryKeyCodeBindings(e));
    this.controller.emitter.on("connectionAccepted", () => this.onConnectionAccepted());
    this.controller.emitter.on("createActorMessage", (e) => this.onCreateActorMessage(e));
    this.controller.emitter.on("connectionDisconnect", () => this.onConnectionDisconnect());
    this.controller.once("update", () => this.onceUpdate());
    this.controller.on("update", () => this.onUpdate());
    this.controller.on("buttonEvent", (e) => this.onButtonEvent(e));
    this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));
    this.controller.on("menuOpen", (e) => this.onMenuOpen(e));
    this.controller.on("menuClose", (e) => this.onMenuClose(e));

    this.pushChatDebugEntry("browserServiceActivated", { important: true });
  }

  private isActiveBrowserServiceInstance() {
    return browserServiceRuntime.activeInstanceId === this.browserServiceInstanceId;
  }

  private onConnectionAccepted() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.pushChatDebugEntry("connectionAccepted", { important: true });
    this.markChatStateForReset();
    this.clearDisconnectNotice();
    browserChatHotkeyState.openLatch = false;
    this.chatInputFocusConfirmedAt = 0;
    this.clearChatFocusRecovery("connectionAccepted");
    this.gameplayUiVisible = false;
    this.chatMenuControlsSuppressed = false;
    this.gracefulDisconnectSent = false;
    this.serverInitiatedQuitSeen = false;
    this.clearServerInitiatedQuitFlag();
  }

  private onConnectionDisconnect() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.pushChatDebugEntry("connectionDisconnect", { important: true });
    this.markChatStateForReset();
    browserChatHotkeyState.openLatch = false;
    this.chatInputFocusConfirmedAt = 0;
    this.clearChatFocusRecovery("connectionDisconnect");
    this.gameplayUiVisible = false;
    this.chatRequestedVisible = false;
    this.trySetChatMenuControlsSuppressed(false, "connectionDisconnect");
    this.sp.browser.setFocused(false);
    this.sp.browser.executeJavaScript(unfocusEventString);
    const suppressDisconnectNotice = this.gracefulDisconnectSent || this.serverInitiatedQuitSeen || this.hasServerInitiatedQuitFlag();
    if (suppressDisconnectNotice) {
      this.clearDisconnectNotice();
    } else {
      this.showDisconnectNotice();
    }
    this.gracefulDisconnectSent = false;
    this.serverInitiatedQuitSeen = false;
    this.clearServerInitiatedQuitFlag();
  }

  // TODO: keycodes should be configurable
  private onQueryKeyCodeBindings(e: QueryKeyCodeBindings) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (e.isDown([DxScanCode.F1])) {
      FormView.isDisplayingNicknames = !FormView.isDisplayingNicknames;
    }
    if (e.isDown([DxScanCode.F2])) {
      this.sp.browser.setVisible(!this.sp.browser.isVisible());
    }
    if (this.badMenusOpen.size === 0 && e.isDown([DxScanCode.F6])) {
      if (this.sp.browser.isFocused()) {
        this.pushChatDebugEntry("f6-close", { important: true });
        this.closeChat(true);
      } else {
        this.pushChatDebugEntry("f6-open", { important: true });
        this.openChat();
      }
    }
  }

  private onceUpdate() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (!this.controller.lookupListener(NetworkingService).isConnected()) {
      this.sp.browser.setVisible(true);
      this.sp.browser.setFocused(false);
    }
  }

  private onUpdate() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.releaseChatOpenHotkeyLatchIfNeeded();
    this.retryChatFocusIfNeeded();

    if (!this.gameplayUiVisible || this.badMenusOpen.size !== 0 || this.sp.browser.isVisible()) {
      return;
    }

    this.restoreBrowserVisibilityIfNeeded();
  }

  private onButtonEvent(e: ButtonEvent) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (this.badMenusOpen.size !== 0 || !e.isDown || e.isRepeating || this.sp.browser.isFocused()) {
      return;
    }

    if (!this.isChatOpenHotkey(e.code)) {
      return;
    }

    if (!this.tryAcquireChatOpenHotkeyLatch()) {
      this.pushChatDebugEntry("chatOpenHotkeySuppressed", {
        important: true,
        keyCode: e.code,
      });
      return;
    }

    switch (e.code) {
      case DxScanCode.T:
        this.prepareChatOpenKey(e.code);
        this.pushChatDebugEntry("t-open", { important: true });
        this.openChat({ releaseKeyCode: DxScanCode.T, debugSource: "t" });
        return;
      case DxScanCode.Enter:
        this.prepareChatOpenKey(e.code);
        this.pushChatDebugEntry("enter-open", { important: true });
        this.openChat({ releaseKeyCode: DxScanCode.Enter, debugSource: "enter" });
        return;
      case DxScanCode.ForwardSlash:
      case DxScanCode.NumSlash:
        this.prepareChatOpenKey(e.code);
        this.pushChatDebugEntry("slash-open", { important: true, keyCode: e.code });
        this.openChat({
          releaseKeyCode: e.code,
          prefillText: "/",
          debugSource: "slash",
        });
        return;
      default:
        return;
    }
  }

  private isChatOpenHotkey(keyCode: DxScanCode) {
    switch (keyCode) {
      case DxScanCode.T:
      case DxScanCode.Enter:
      case DxScanCode.ForwardSlash:
      case DxScanCode.NumSlash:
        return true;
      default:
        return false;
    }
  }

  private tryAcquireChatOpenHotkeyLatch() {
    if (browserChatHotkeyState.openLatch) {
      return false;
    }

    browserChatHotkeyState.openLatch = true;
    return true;
  }

  private releaseChatOpenHotkeyLatchIfNeeded() {
    if (!browserChatHotkeyState.openLatch) {
      return;
    }

    const chatOpenKeys = [
      DxScanCode.T,
      DxScanCode.Enter,
      DxScanCode.ForwardSlash,
      DxScanCode.NumSlash,
    ];

    if (chatOpenKeys.some((keyCode) => this.sp.Input.isKeyPressed(keyCode))) {
      return;
    }

    browserChatHotkeyState.openLatch = false;
  }

  private prepareChatOpenKey(keyCode: DxScanCode) {
    this.sp.Game.enableFastTravel(false);
    this.sp.Game.setInChargen(true, true, false);
    this.trySetChatMenuControlsSuppressed(true, "prepareChatOpenKey");
    this.releaseMovementKeys();
    this.sp.Input.releaseKey(keyCode);
    this.pushChatDebugEntry("chat-open-button-down", { important: true, keyCode });
  }

  private releaseMovementKeys() {
    [
      DxScanCode.W,
      DxScanCode.A,
      DxScanCode.S,
      DxScanCode.D,
      DxScanCode.LeftShift,
      DxScanCode.RightShift,
      DxScanCode.Spacebar,
    ].forEach((keyCode) => this.sp.Input.releaseKey(keyCode));
  }

  private closeChat(releaseKeys = false) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (releaseKeys) {
      this.releaseMovementKeys();
    }
    this.clearChatFocusRecovery("closeChat");
    this.chatInputFocusConfirmedAt = 0;
    this.trySetChatMenuControlsSuppressed(false, "closeChat");
    this.chatRequestedVisible = false;
    this.pushChatDebugEntry("closeChat", {
      important: true,
      releaseKeys,
      browserFocused: this.sp.browser.isFocused(),
      browserVisible: this.sp.browser.isVisible(),
    });
    this.sp.browser.setFocused(false);
    this.sp.browser.executeJavaScript(unfocusEventString);
    this.restoreBrowserVisibilityIfNeeded();
  }

  private openChat(options: { releaseKeyCode?: DxScanCode; prefillText?: string; debugSource?: string } = {}) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    const wasAlreadyRequested = this.chatRequestedVisible;
    this.chatRequestedVisible = true;
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);

    if (wasAlreadyRequested) {
      if (typeof options.prefillText === "string") {
        this.sp.browser.executeJavaScript(`window.__skrpChatOpenPrefill = ${JSON.stringify(options.prefillText)};`);
      }

      this.lastChatOpenAt = Date.now();
      this.armChatFocusRecovery(options.releaseKeyCode, `${options.debugSource || "chat"}-refocus`);
      this.pushChatDebugEntry("openChatRefocus", {
        important: true,
        releaseKeyCode: options.releaseKeyCode,
        prefillText: options.prefillText || "",
        debugSource: options.debugSource || "",
      });
      this.sp.browser.executeJavaScript(openChatEventString);
      return;
    }

    this.chatInputFocusConfirmedAt = 0;
    this.pushChatDebugEntry("openChat", {
      important: true,
      releaseKeyCode: options.releaseKeyCode,
      prefillText: options.prefillText || "",
      debugSource: options.debugSource || "",
      shouldResetChatState: this.shouldResetChatState,
    });
    this.lastChatOpenAt = Date.now();

    if (this.shouldResetChatState) {
      this.sp.browser.executeJavaScript(resetChatStateEventString);
      this.shouldResetChatState = false;
    }

    if (typeof options.prefillText === "string") {
      this.sp.browser.executeJavaScript(`window.__skrpChatOpenPrefill = ${JSON.stringify(options.prefillText)};`);
    }

    this.armChatFocusRecovery(options.releaseKeyCode, options.debugSource);
    this.sp.browser.executeJavaScript(openChatEventString);
  }

  private onCreateActorMessage(e: ConnectionMessage<CreateActorMessage>) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (!e.message.isMe) {
      return;
    }

    this.loadGameplayBrowserPage("createActorMessage");
    this.gameplayUiVisible = true;
    this.clearChatFocusRecovery("createActorMessage");
    this.pushChatDebugEntry("createActorMessage", { important: true, isMe: true });
    this.restoreBrowserVisibilityIfNeeded();
  }

  private loadGameplayBrowserPage(reason: string) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    try {
      this.sp.browser.loadUrl(this.gameplayBrowserUrl);
      this.pushChatDebugEntry("gameplayBrowserLoadUrl", {
        important: true,
        reason,
        url: this.gameplayBrowserUrl,
      });
    } catch (error) {
      this.pushChatDebugEntry("gameplayBrowserLoadUrlError", {
        important: true,
        reason,
        error: `${error}`,
      });
    }
  }

  private markChatStateForReset() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.shouldResetChatState = true;
    this.pushChatDebugEntry("markChatStateForReset", { important: true });
  }

  private clearDisconnectNotice() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.disconnectNoticeVisible = false;
    this.sp.browser.executeJavaScript(clearDisconnectNoticeEventString);
    this.restoreBrowserVisibilityIfNeeded();
  }

  private showDisconnectNotice() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.disconnectNoticeVisible = true;
    this.sp.browser.setVisible(true);
    this.sp.browser.executeJavaScript(showDisconnectNoticeEventString);
  }

  private restoreBrowserVisibilityIfNeeded() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (this.badMenusOpen.size !== 0) {
      this.sp.browser.setVisible(false);
      return;
    }

    this.sp.browser.setVisible(this.gameplayUiVisible || this.chatRequestedVisible || this.disconnectNoticeVisible);
  }

  private trySetChatMenuControlsSuppressed(suppressed: boolean, reason: string) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (this.chatMenuControlsSuppressed === suppressed) {
      return;
    }

    try {
      if (suppressed) {
        this.sp.Game.disablePlayerControls(false, false, false, false, false, true, true, true, 0);
      } else {
        this.sp.Game.enablePlayerControls(false, false, false, false, false, true, true, true, 0);
      }

      this.chatMenuControlsSuppressed = suppressed;
      this.pushChatDebugEntry("chatMenuControls", {
        important: true,
        suppressed,
        reason,
      });
    } catch (error) {
      if (!suppressed) {
        this.chatMenuControlsSuppressed = false;
      }

      this.pushChatDebugEntry("chatMenuControlsError", {
        important: true,
        suppressed,
        reason,
        error: `${error}`,
      });
    }
  }

  private shouldResetChatState = true;

  private onBrowserMessage(e: BrowserMessageEvent) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    const onLegacyFrontLoadedEventKey = "front-loaded";
    const onAuthFrontLoadedEventKey = "front-loaded-auth";
    const onUiFrontLoadedEventKey = "front-loaded-ui";
    const onChatCloseEventKey = "rpChatClose";
    const onChatDebugStateEventKey = "rpChatDebugState";

    if (e.arguments[0] === onAuthFrontLoadedEventKey) {
      this.pushChatDebugEntry("front-loaded-auth", { important: true });
      this.controller.emitter.emit("browserWindowLoaded", {});
      return;
    }

    if (e.arguments[0] === onUiFrontLoadedEventKey) {
      this.pushChatDebugEntry("front-loaded-ui", { important: true });
      return;
    }

    if (e.arguments[0] === onLegacyFrontLoadedEventKey) {
      this.pushChatDebugEntry("front-loaded-legacyIgnored", { important: true });
      return;
    }

    if (e.arguments[0] === onChatCloseEventKey) {
      const msSinceOpen = this.lastChatOpenAt ? Date.now() - this.lastChatOpenAt : Number.MAX_SAFE_INTEGER;
      const awaitingInputFocus = this.chatRequestedVisible
        && this.chatFocusRetryDeadline !== 0
        && this.chatInputFocusConfirmedAt === 0;
      const browserFocused = this.sp.browser.isFocused();
      if (awaitingInputFocus || msSinceOpen < 250 || (!browserFocused && msSinceOpen < 900)) {
        this.pushChatDebugEntry("rpChatCloseIgnored", {
          important: true,
          msSinceOpen,
          awaitingInputFocus,
          browserFocused,
        });
        return;
      }

      this.pushChatDebugEntry("rpChatClose", { important: true });
      this.closeChat(false);
      return;
    }

    if (e.arguments[0] === onChatDebugStateEventKey) {
      try {
        const payload = JSON.parse(`${e.arguments[1] || "{}"}`) as Record<string, unknown>;
        const { event: browserEvent, ...restPayload } = payload;
        this.pushChatDebugEntry("browserDebug", {
          ...(browserEvent !== undefined ? { browserEvent } : {}),
          ...restPayload,
        });
        if (browserEvent === "input-focus" && this.chatRequestedVisible) {
          this.chatInputFocusConfirmedAt = Date.now();
          this.clearChatFocusRecovery("inputFocusConfirmed");
        }
        if (browserEvent === "input-blur" && this.chatRequestedVisible) {
          this.chatInputFocusConfirmedAt = 0;
        }
      } catch (error) {
        this.pushChatDebugEntry("browserDebugParseError", {
          important: true,
          raw: `${e.arguments[1] || ""}`,
          error: `${error}`,
        });
      }
    }
  }

  private onMenuOpen(e: MenuOpenEvent) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (e.name === Menu.Sleep) {
      return;
    }

    if (e.name === Menu.Main) {
      this.handleMainMenuOpen();
    }

    if (this.isBadMenu(e.name)) {
      this.sp.browser.setVisible(false);
      this.badMenusOpen.add(e.name);
      this.clearChatFocusRecovery(`menuOpen:${e.name}`);
      this.pushChatDebugEntry("menuOpen", { important: true, menu: e.name });
    }
  }

  private onMenuClose(e: MenuCloseEvent) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (this.badMenusOpen.delete(e.name)) {
      this.pushChatDebugEntry("menuClose", { important: true, menu: e.name });
      if (this.badMenusOpen.size === 0) {
        this.restoreBrowserVisibilityIfNeeded();
      }
    }

    if (e.name === Menu.HUD) {
      this.restoreBrowserVisibilityIfNeeded();
    }
  }

  private isBadMenu(menu: string) {
    return this.badMenus.includes(menu as Menu);
  }

  private handleMainMenuOpen() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (this.consumeServerInitiatedQuitFlag()) {
      this.serverInitiatedQuitSeen = true;
      this.pushChatDebugEntry("serverQuitToMainMenu", { important: true });
      return;
    }

    if (this.gracefulDisconnectSent) {
      return;
    }

    const networkingService = this.controller.lookupListener(NetworkingService);
    if (!networkingService.isConnected()) {
      return;
    }

    this.gracefulDisconnectSent = true;
    this.pushChatDebugEntry("gracefulDisconnectRequested", { important: true });
    this.controller.emitter.emit("sendMessage", {
      message: {
        t: messages.MsgType.CustomPacket,
        contentJsonDump: JSON.stringify({
          customPacketType: gracefulDisconnectPacketType,
        }),
      },
      reliability: "reliable",
    });
  }

  private hasServerInitiatedQuitFlag() {
    return !!storage[serverInitiatedQuitStorageKey];
  }

  private consumeServerInitiatedQuitFlag() {
    if (!this.hasServerInitiatedQuitFlag()) {
      return false;
    }

    delete storage[serverInitiatedQuitStorageKey];
    return true;
  }

  private clearServerInitiatedQuitFlag() {
    delete storage[serverInitiatedQuitStorageKey];
  }

  private armChatFocusRecovery(releaseKeyCode?: DxScanCode, debugSource?: string) {
    this.chatFocusRetryDeadline = Date.now() + 1500;
    this.chatFocusRetryNextAttemptAt = 0;
    this.chatFocusRetryAttempts = 0;
    this.chatFocusRetryReleaseKeyCode = releaseKeyCode;
    this.pushChatDebugEntry("chatFocusRecoveryArmed", {
      important: true,
      releaseKeyCode,
      debugSource: debugSource || "",
    });
  }

  private clearChatFocusRecovery(reason: string) {
    if (!this.chatFocusRetryDeadline) {
      return;
    }

    this.pushChatDebugEntry("chatFocusRecoveryCleared", {
      important: true,
      reason,
      attempts: this.chatFocusRetryAttempts,
      releaseKeyCode: this.chatFocusRetryReleaseKeyCode,
    });
    this.chatFocusRetryDeadline = 0;
    this.chatFocusRetryNextAttemptAt = 0;
    this.chatFocusRetryAttempts = 0;
    this.chatFocusRetryReleaseKeyCode = undefined;
  }

  private retryChatFocusIfNeeded() {
    if (!this.chatRequestedVisible || this.badMenusOpen.size !== 0) {
      this.clearChatFocusRecovery("notNeeded");
      return;
    }

    if (!this.chatFocusRetryDeadline) {
      return;
    }

    if (this.chatInputFocusConfirmedAt) {
      this.clearChatFocusRecovery("inputFocusConfirmed");
      return;
    }

    const now = Date.now();
    if (now > this.chatFocusRetryDeadline) {
      this.clearChatFocusRecovery("timedOut");
      return;
    }

    if (now < this.chatFocusRetryNextAttemptAt) {
      return;
    }

    this.chatFocusRetryNextAttemptAt = now + 45;
    this.chatFocusRetryAttempts += 1;

    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);
    this.trySetChatMenuControlsSuppressed(true, "chatFocusRecovery");
    this.releaseMovementKeys();
    if (this.chatFocusRetryReleaseKeyCode !== undefined) {
      this.sp.Input.releaseKey(this.chatFocusRetryReleaseKeyCode);
    }
    this.sp.browser.executeJavaScript(focusChatInputEventString);

    if (this.chatFocusRetryAttempts === 1 || this.chatFocusRetryAttempts % 6 === 0) {
      this.pushChatDebugEntry("chatFocusRecoveryRetry", {
        important: true,
        attempts: this.chatFocusRetryAttempts,
        releaseKeyCode: this.chatFocusRetryReleaseKeyCode,
      });
    }
  }

  private badMenusOpen = new Set<string>();
  private readonly chatDebugPluginName = "skymp-chat-debug-state";
  private readonly chatDebugEntryLimit = 160;
  private chatDebugEntries: Array<Record<string, unknown>> = [];
  private lastChatDebugPersistAt = 0;
  private gracefulDisconnectSent = false;
  private serverInitiatedQuitSeen = false;
  private gameplayUiVisible = false;
  private chatMenuControlsSuppressed = false;
  private chatRequestedVisible = false;
  private disconnectNoticeVisible = false;
  private chatFocusRetryDeadline = 0;
  private chatFocusRetryNextAttemptAt = 0;
  private chatFocusRetryAttempts = 0;
  private chatFocusRetryReleaseKeyCode: DxScanCode | undefined = undefined;
  private chatInputFocusConfirmedAt = 0;
  private lastChatOpenAt = 0;
  private readonly gameplayBrowserUrl = "file:///Data/Platform/UI/ui.html?v=skyrim-unbound-ui-20260422-10";
  private readonly startupBrowserUrl = "file:///Data/Platform/UI/startup.html?v=skyrim-unbound-startup-20260422-10";

  private pushChatDebugEntry(event: string, details?: Record<string, unknown>) {
    void event;
    void details;
  }

  private persistChatDebugState() {
    return;
  }

  private readonly badMenus: Menu[] = [
    Menu.Barter,
    Menu.Book,
    Menu.Container,
    Menu.Crafting,
    Menu.Gift,
    Menu.Inventory,
    Menu.Journal,
    Menu.Lockpicking,
    Menu.Map,
    Menu.RaceSex,
    Menu.Stats,
    Menu.Tween,
    Menu.Console,
  ];
}
