
// TODO: send event instead of direct dependency on FormView class
import { FormView } from "../../view/formView";
import { QueryKeyCodeBindings } from "../events/queryKeyCodeBindings";
import * as messages from "../../messages";

import { ClientListener, CombinedController, Sp } from "./clientListener";
import { NetworkingService } from "./networkingService";
import { ConnectionMessage } from "../events/connectionMessage";
import { CreateActorMessage } from "../messages/createActorMessage";
import { BrowserMessageEvent, ButtonEvent, DxScanCode, Menu, MenuCloseEvent, MenuOpenEvent, storage } from "skyrimPlatform";

const CHAT_OPEN_BINDING = [DxScanCode.T];
const CHAT_SLASH_OPEN_BINDING = [DxScanCode.ForwardSlash];
const CHAT_NUMPAD_SLASH_OPEN_BINDING = [DxScanCode.NumSlash];
const CHAT_OPEN_BINDINGS = [
  CHAT_OPEN_BINDING,
  CHAT_SLASH_OPEN_BINDING,
  CHAT_NUMPAD_SLASH_OPEN_BINDING,
];
const CHAT_FOCUS_BLOCKER_KEYS = [
  DxScanCode.W,
  DxScanCode.A,
  DxScanCode.S,
  DxScanCode.D,
  DxScanCode.LeftShift,
  DxScanCode.RightShift,
  DxScanCode.LeftAlt,
  DxScanCode.RightAlt,
  DxScanCode.Spacebar,
];
const CHAT_INPUT_FOCUS_BLOCKER_KEYS = [
  ...CHAT_FOCUS_BLOCKER_KEYS,
];
const CURSOR_FOCUS_BLOCKER_KEYS = [
  ...CHAT_FOCUS_BLOCKER_KEYS,
  DxScanCode.F3,
  DxScanCode.F4,
];

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
      root.style.pointerEvents = 'none';
      if (window.__skrpChatHideTimer) clearTimeout(window.__skrpChatHideTimer);
      window.__skrpChatHideTimer = 0;
      root.style.display = 'none';
    }
    window.dispatchEvent(new CustomEvent('skymp5-client:browserUnfocused', {}));
  })();
`;
const resetChatStateEventString = `
  (function() {
    var root = document.getElementById('skrp-chat-root');
    if (root && root.parentNode) root.parentNode.removeChild(root);
    var adminPanel = document.getElementById('skrp-admin-panel');
    if (adminPanel && adminPanel.parentNode) adminPanel.parentNode.removeChild(adminPanel);
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
    window.__skrpRenderedChatCount = 0;
    window.__skrpLastChatSubmit = undefined;
    window.__skrpLastChatSubmitAt = 0;
    window.__skrpChatTypingState = false;
    window.__skrpChatOpenPrefill = '';
    window.__skrpChatOpenSuppressedKey = '';
    window.__skrpChatOpenSuppressedCodes = [];
    window.__skrpChatOpenSuppressedTexts = [];
    window.__skrpChatOpenMovementHeld = false;
    window.__skrpChatOpenMovementHeldUntil = 0;
    window.__skrpChatInternalBlur = false;
    window.__skrpManualCursorMode = false;
    window.__skrpAdminPanelOpen = false;
    window.__skrpAdminPanelSeq = undefined;
    window.__skrpAdminPanelClosedSeq = undefined;
    window._skrpCloseAdminPanel = undefined;
    window._skrpOpenChat = undefined;
    window._skrpChatPush = undefined;
    window._skrpChatApplySettings = undefined;
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

const closeAllUiEventString = `
  (function() {
    if (window._skrpCloseAdminPanel) {
      window._skrpCloseAdminPanel();
    } else {
      var adminPanel = document.getElementById('skrp-admin-panel');
      if (adminPanel) adminPanel.style.display = 'none';
      if (window.__skrpAdminPanelSeq !== undefined) {
        window.__skrpAdminPanelClosedSeq = window.__skrpAdminPanelSeq;
      }
    }
    window.__skrpAdminPanelOpen = false;
    window.__skrpManualCursorMode = false;

    var root = document.getElementById('skrp-chat-root');
    var input = document.getElementById('skrp-chat-input');
    var counter = document.getElementById('skrp-chat-counter');
    if (input) {
      if (typeof input.blur === 'function') input.blur();
      input.style.display = 'none';
    }
    if (counter) counter.style.display = 'none';
    if (root) {
      root.setAttribute('data-chat-open', 'false');
      root.style.pointerEvents = 'none';
      root.style.display = 'none';
    }
  })();
`;

const cursorModeHotkeysEventString = `
  (function() {
    window.__skrpManualCursorMode = true;
    if (window.__skrpGlobalUiHotkeysInstalled) return;
    window.__skrpGlobalUiHotkeysInstalled = true;
    document.addEventListener('keydown', function(event) {
      var key = event && typeof event.key === 'string' ? event.key : '';
      if (key !== 'F3' && key !== 'F4') return;
      if (event.repeat) return;
      var chatRoot = document.getElementById('skrp-chat-root');
      var adminPanel = document.getElementById('skrp-admin-panel');
      var chatOpen = !!(chatRoot && chatRoot.getAttribute('data-chat-open') === 'true');
      var panelOpen = !!(adminPanel && adminPanel.style.display !== 'none');
      var cursorOpen = window.__skrpManualCursorMode === true;
      if (!chatOpen && !panelOpen && !window.__skrpAdminPanelOpen && !cursorOpen) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.skyrimPlatform.sendMessage(key === 'F4' ? 'rpCloseAllUi' : 'rpToggleCursorUi', 'browser-hotkey');
      }
    }, true);
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
      left: 64,
      top: 38,
      width: 2000,
      inputWidth: 800,
      visibleLines: 9,
      historyLines: 60,
      fontSize: 40,
      inputFontSize: 41,
      lineHeight: 47,
      inputGap: 14,
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

    function getChatInputTop(s) {
      return s.top + (s.visibleLines * s.lineHeight) + (Number(s.inputGap) || 14);
    }

    function getChatInputWidth(s) {
      void s;
      return 800;
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
      if (isLikelySyntheticSpam(text)) {
        return false;
      }
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

    function isLikelySyntheticSpam(text) {
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

    function trimSyntheticRun(input) {
      if (!input) return false;
      var value = String(input.value || '');
      if (value.length < 6) return false;

      if (/^(.)\\1{5,}$/i.test(value.replace(/\\s+/g, ''))) {
        input.value = '';
        sendChatDebugState('synthetic-run-cleared', {
          important: true,
          valueLength: value.length
        });
        return true;
      }

      var suffixMatch = /(.)\\1{8,}$/i.exec(value);
      if (suffixMatch && suffixMatch.index > 0) {
        input.value = value.slice(0, suffixMatch.index);
        sendChatDebugState('synthetic-run-trimmed', {
          important: true,
          valueLength: value.length
        });
        return true;
      }

      return false;
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

    function sendChatClose(reason) {
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.skyrimPlatform.sendMessage('rpChatClose', reason || 'close');
      }
    }

    function hideChatInputLocally() {
      var root = document.getElementById('skrp-chat-root');
      var input = document.getElementById('skrp-chat-input');
      var counter = document.getElementById('skrp-chat-counter');
      if (input) {
        window.__skrpChatInternalBlur = true;
        input.style.display = 'none';
        if (typeof input.blur === 'function') input.blur();
        setTimeout(function() {
          window.__skrpChatInternalBlur = false;
        }, 120);
      }
      if (counter) counter.style.display = 'none';
      if (root) {
        root.setAttribute('data-chat-open', 'false');
        root.style.pointerEvents = 'none';
        root.style.display = 'none';
      }
    }

    function submitChatInput(input, reason) {
      var text = input ? input.value.trim() : '';
      var shouldSend = text && shouldSendSubmit(text);
      if (text && !shouldSend) {
        sendChatDebugState('submit-blocked', {
          important: true,
          textLength: text.length,
          preview: text.slice(0, 80)
        });
      }
      if (shouldSend) {
        remember(text);
        if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
          window.__skrpChatSubmitSeq = (window.__skrpChatSubmitSeq || 0) + 1;
          window.skyrimPlatform.sendMessage('rpChatSubmit', JSON.stringify({
            id: Date.now() + ':' + window.__skrpChatSubmitSeq,
            text: text
          }));
        }
      }

      sendChatTypingState(false);
      if (input) {
        input.value = '';
        updateCounter(input);
      }
      hideChatInputLocally();
      sendChatClose(reason || 'submit');
    }

    function armOpeningInputGuard(input, durationMs) {
      var until = Date.now() + durationMs;
      window.__skrpChatSuppressInputUntil = Math.max(Number(window.__skrpChatSuppressInputUntil || 0), until);
      window.__skrpChatOpenValue = input ? input.value : '';
      window.__skrpChatOpenSuppressedHeld = true;
      window.__skrpChatOpenSuppressedHeldAt = Date.now();
      window.__skrpChatOpenMovementHeld = false;
      window.__skrpChatOpenMovementHeldUntil = 0;
    }

    function getOpenedWith() {
      return typeof window.__skrpChatOpenValue === 'string'
        ? window.__skrpChatOpenValue
        : '';
    }

    function getSuppressedOpeningKey() {
      return typeof window.__skrpChatOpenSuppressedKey === 'string'
        ? window.__skrpChatOpenSuppressedKey.toLowerCase()
        : '';
    }

    function getSuppressedOpeningCodes() {
      return Array.isArray(window.__skrpChatOpenSuppressedCodes)
        ? window.__skrpChatOpenSuppressedCodes
        : [];
    }

    function getSuppressedOpeningTexts() {
      return Array.isArray(window.__skrpChatOpenSuppressedTexts)
        ? window.__skrpChatOpenSuppressedTexts
        : [];
    }

    function matchesSuppressedOpeningKey(event) {
      var suppressedKey = getSuppressedOpeningKey();
      var eventKey = event && typeof event.key === 'string' ? event.key.toLowerCase() : '';
      var codes = getSuppressedOpeningCodes();
      return !!(suppressedKey && eventKey === suppressedKey)
        || !!(event && event.code && codes.indexOf(event.code) !== -1);
    }

    function matchesSuppressedOpeningText(text) {
      text = String(text || '').toLowerCase();
      if (!text) return false;
      var suppressedTexts = getSuppressedOpeningTexts();
      for (var i = 0; i < suppressedTexts.length; i++) {
        if (String(suppressedTexts[i]).toLowerCase() === text) return true;
      }
      var suppressedKey = getSuppressedOpeningKey();
      return !!(suppressedKey && text === suppressedKey);
    }

    function isSuppressedOpeningKeyHeld() {
      if (window.__skrpChatOpenSuppressedHeld !== true) return false;
      var heldAt = Number(window.__skrpChatOpenSuppressedHeldAt || 0);
      if (heldAt && Date.now() - heldAt > 30000) {
        window.__skrpChatOpenSuppressedHeld = false;
        return false;
      }
      return true;
    }

    function isPrintableKey(event) {
      return !!(event
        && typeof event.key === 'string'
        && event.key.length === 1
        && !event.ctrlKey
        && !event.altKey
        && !event.metaKey);
    }

    function normalizeTextInput(text) {
      return String(text || '').toLowerCase();
    }

    function noteAllowedTextInput(text, source) {
      text = String(text || '');
      if (!text) return;
      window.__skrpLastAllowedTextInput = text;
      window.__skrpLastAllowedTextInputAt = Date.now();
      window.__skrpLastAllowedTextInputSource = source || '';
    }

    function hasRecentAllowedTextInput(text) {
      text = String(text || '');
      var at = Number(window.__skrpLastAllowedTextInputAt || 0);
      if (!at || Date.now() - at > 220) return false;
      var expected = String(window.__skrpLastAllowedTextInput || '');
      if (!expected || !text) return true;
      return normalizeTextInput(expected) === normalizeTextInput(text);
    }

    function shouldSuppressUnexpectedTextInput(text, inputType) {
      text = String(text || '');
      if (!text) return false;
      inputType = String(inputType || '');
      if (inputType.indexOf('insertFromPaste') === 0) return false;
      if (hasRecentAllowedTextInput(text)) return false;
      if (isLikelySyntheticSpam(text)) {
        sendChatDebugState('unexpected-input-suppressed', {
          important: true,
          dataLength: text.length,
          inputType: inputType,
          synthetic: true
        });
        return true;
      }
      if (text.length === 1) {
        sendChatDebugState('unexpected-input-suppressed', {
          important: true,
          dataLength: text.length,
          inputType: inputType,
          synthetic: false
        });
        return true;
      }
      return false;
    }

    function rememberChatInputValue(input) {
      window.__skrpChatLastInputValue = input ? String(input.value || '') : '';
    }

    function resetTextInputGate(value) {
      window.__skrpLastAllowedTextInput = '';
      window.__skrpLastAllowedTextInputAt = 0;
      window.__skrpLastAllowedTextInputSource = '';
      window.__skrpChatLastInputValue = String(value || '');
    }

    function rollbackUnexpectedTextInput(input) {
      if (!input) return false;
      var value = String(input.value || '');
      var previous = String(window.__skrpChatLastInputValue || '');
      if (value === previous) return false;

      if (previous && value.indexOf(previous) === 0) {
        var inserted = value.slice(previous.length);
        if (shouldSuppressUnexpectedTextInput(inserted, 'input-fallback')) {
          input.value = previous;
          rememberChatInputValue(input);
          return true;
        }
      }

      if (!previous && shouldSuppressUnexpectedTextInput(value, 'input-fallback')) {
        input.value = '';
        rememberChatInputValue(input);
        return true;
      }

      return false;
    }

    function isMovementRepeatKey(event) {
      var key = event && typeof event.key === 'string' ? event.key.toLowerCase() : '';
      var code = event && typeof event.code === 'string' ? event.code : '';
      return key === 'w' || key === 'a' || key === 's' || key === 'd'
        || key === 'shift' || key === 'alt' || key === ' '
        || code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD'
        || code === 'ShiftLeft' || code === 'ShiftRight'
        || code === 'AltLeft' || code === 'AltRight'
        || code === 'Space';
    }

    function isOpeningMovementHeld() {
      if (window.__skrpChatOpenMovementHeld !== true) return false;
      var until = Number(window.__skrpChatOpenMovementHeldUntil || 0);
      if (until && Date.now() > until) {
        window.__skrpChatOpenMovementHeld = false;
        window.__skrpChatOpenMovementHeldUntil = 0;
        return false;
      }
      return true;
    }

    function isMovementText(text) {
      text = String(text || '').toLowerCase();
      return text === 'w' || text === 'a' || text === 's' || text === 'd' || text === ' ';
    }

    function shouldSuppressOpeningKey(event, input) {
      var until = Number(window.__skrpChatSuppressInputUntil || 0);
      if (!event) return false;
      var withinGuard = Date.now() <= until;
      if (matchesSuppressedOpeningKey(event) && (withinGuard || event.repeat || isSuppressedOpeningKeyHeld())) {
        sendChatDebugState('opening-key-suppressed', {
          important: true,
          key: event.key || '',
          code: event.code || '',
          repeat: event.repeat === true
        });
        return true;
      }
      if ((withinGuard || isOpeningMovementHeld()) && isMovementRepeatKey(event)) {
        window.__skrpChatOpenMovementHeld = true;
        window.__skrpChatOpenMovementHeldUntil = Date.now() + 4000;
        sendChatDebugState('opening-key-suppressed', {
          important: true,
          key: event.key || '',
          code: event.code || '',
          repeat: event.repeat === true
        });
        return true;
      }
      return false;
    }

    function shouldSuppressOpeningText(input, text) {
      var until = Number(window.__skrpChatSuppressInputUntil || 0);
      var held = isSuppressedOpeningKeyHeld();
      var movementHeld = isOpeningMovementHeld();
      if (!text || (!held && !movementHeld && Date.now() > until)) return false;

      if (held && matchesSuppressedOpeningText(text)) {
        sendChatDebugState('opening-text-suppressed', {
          important: true,
          dataLength: String(text).length
        });
        return true;
      }

      if (movementHeld && isMovementText(text)) {
        sendChatDebugState('opening-text-suppressed', {
          important: true,
          dataLength: String(text).length
        });
        return true;
      }

      var suppressedKey = getSuppressedOpeningKey();
      if (held && suppressedKey && String(text).toLowerCase() === suppressedKey) {
        return true;
      }

      var openedWith = getOpenedWith();
      var currentValue = input ? String(input.value || '') : '';

      var normalizedText = String(text).toLowerCase();
      var suffix = currentValue.indexOf(openedWith) === 0
        ? currentValue.slice(openedWith.length)
        : currentValue;
      if (!suffix || suffix.length < 2 || normalizedText.length !== 1) return false;
      suffix = String(suffix).toLowerCase();
      for (var i = 0; i < suffix.length; i++) {
        if (suffix.charAt(i) !== normalizedText) return false;
      }
      return suffix.length > 0;
    }

    function rollbackOpeningKeyRun(input) {
      var until = Number(window.__skrpChatSuppressInputUntil || 0);
      if (!input || (Date.now() > until && !isSuppressedOpeningKeyHeld() && !isOpeningMovementHeld())) return false;

      var value = input.value || '';
      var openedWith = getOpenedWith();
      if (openedWith && value.indexOf(openedWith) === 0) {
        var suffix = value.slice(openedWith.length);
        if (shouldSuppressOpeningText(input, suffix)) {
          input.value = openedWith;
          return true;
        }
        return false;
      }

      if (shouldSuppressOpeningText(input, value)) {
        input.value = openedWith;
        return true;
      }

      return false;
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
        var shouldSend = eventName === 'input-focus'
          || eventName === 'input-blur'
          || eventName === 'chat-opened'
          || eventName.indexOf('opening-') === 0
          || !!(extra && extra.important === true);
        if (!shouldSend) return;
        if (!(window.skyrimPlatform && window.skyrimPlatform.sendMessage)) return;
        window.skyrimPlatform.sendMessage('rpChatDebugState', JSON.stringify(Object.assign({
          event: eventName,
          at: new Date().toISOString()
        }, extra || {})));
      } catch (e) {}
    }

    function installGlobalUiHotkeys() {
      if (window.__skrpGlobalUiHotkeysInstalled) return;
      window.__skrpGlobalUiHotkeysInstalled = true;
      document.addEventListener('keydown', function(event) {
        var key = event && typeof event.key === 'string' ? event.key : '';
        if (key !== 'F3' && key !== 'F4') return;
        var chatRoot = document.getElementById('skrp-chat-root');
        var adminPanel = document.getElementById('skrp-admin-panel');
        var chatOpen = !!(chatRoot && chatRoot.getAttribute('data-chat-open') === 'true');
        var panelOpen = !!(adminPanel && adminPanel.style.display !== 'none');
        var cursorOpen = window.__skrpManualCursorMode === true;
        if (!chatOpen && !panelOpen && !window.__skrpAdminPanelOpen && !cursorOpen) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
          window.skyrimPlatform.sendMessage(key === 'F4' ? 'rpCloseAllUi' : 'rpToggleCursorUi', 'browser-hotkey');
        }
      }, true);
    }

    function normalizePayload(payload) {
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (e) { payload = { text: payload }; }
      }

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
        createdAt: payload && payload.createdAt ? String(payload.createdAt) : new Date().toISOString(),
        segments: segments
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

    function createChatLine(entry) {
      var line = document.createElement('div');
      line.style.color = entry.color;
      if (settings().timestamps) {
        line.appendChild(document.createTextNode(formatTimestamp(entry.createdAt)));
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

    function renderLog(forceFull) {
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

    function applySettings(shouldRenderLog) {
      var s = settings();
      var root = document.getElementById('skrp-chat-root');
      var log = document.getElementById('skrp-chat-log');
      var input = document.getElementById('skrp-chat-input');
      if (root) {
        root.style.left = s.left + 'px';
        root.style.top = getChatInputTop(s) + 'px';
        root.style.width = getChatInputWidth(s) + 'px';
        root.style.maxWidth = getChatInputWidth(s) + 'px';
      }
      if (log) {
        log.style.display = 'none';
        log.style.maxHeight = '0';
        log.style.margin = '0';
        log.style.padding = '0';
        log.style.overflow = 'hidden';
        log.style.fontSize = s.fontSize + 'px';
        log.style.lineHeight = s.lineHeight + 'px';
        log.innerHTML = '';
      }
      if (input) input.style.fontSize = s.inputFontSize + 'px';
      if (Array.isArray(window.__skrpChatMessages)) {
        var historyLines = Math.max(10, Math.min(120, Number(s.historyLines) || defaults.historyLines));
        while (window.__skrpChatMessages.length > historyLines) {
          window.__skrpChatMessages.shift();
        }
      }
      void shouldRenderLog;
    }

    function ensureChat() {
      if (!document.body) return null;
      installGlobalUiHotkeys();
      var s = settings();
      var root = document.getElementById('skrp-chat-root');
      if (!root) {
        window.__skrpChatMessages = Array.isArray(window.__skrpChatMessages) ? window.__skrpChatMessages : [];
        root = document.createElement('div');
        root.id = 'skrp-chat-root';
        root.style.position = 'fixed';
        root.style.left = s.left + 'px';
        root.style.top = getChatInputTop(s) + 'px';
        root.style.width = getChatInputWidth(s) + 'px';
        root.style.maxWidth = getChatInputWidth(s) + 'px';
        root.style.zIndex = '2147483647';
        root.style.fontFamily = 'Georgia, serif';
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
        log.style.color = '#f8f2df';
        log.style.fontSize = s.fontSize + 'px';
        log.style.lineHeight = s.lineHeight + 'px';
        log.style.textShadow = '0 0 2px rgba(0, 0, 0, 0.98), 1px 1px 0 rgba(0, 0, 0, 0.98), -1px 1px 0 rgba(0, 0, 0, 0.85)';
        log.style.contain = 'content';
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
        input.style.maxWidth = '800px';
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
          if (shouldSuppressOpeningKey(event, input)) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            return;
          }
          if (event.repeat && isPrintableKey(event)) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            return;
          }
          if (isPrintableKey(event)) {
            noteAllowedTextInput(event.key, event.code || 'keydown');
          }
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            showHistory(event.key === 'ArrowUp' ? -1 : 1, input);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            sendChatDebugState('escape-keydown', {
              important: true,
              valueLength: input.value.length
            });
            sendChatTypingState(false);
            input.value = '';
            updateCounter(input);
            hideChatInputLocally();
            sendChatClose('escape');
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            if (event.repeat) return;
            sendChatDebugState('submit-enter', {
              important: true,
              textLength: input.value.trim().length,
              preview: input.value.trim().slice(0, 80)
            });
            submitChatInput(input, 'submit');
          }
        });
        input.addEventListener('beforeinput', function(event) {
          var data = event.data || '';
          if (shouldSuppressOpeningText(input, data) || shouldSuppressUnexpectedTextInput(data, event.inputType || 'beforeinput')) {
            event.preventDefault();
            event.stopPropagation();
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          }
        });
        input.addEventListener('keyup', function(event) {
          if (matchesSuppressedOpeningKey(event)) {
            if (event && event.code && Array.isArray(window.__skrpChatOpenSuppressedCodes)) {
              window.__skrpChatOpenSuppressedCodes = window.__skrpChatOpenSuppressedCodes.filter(function(code) {
                return code !== event.code;
              });
            }
            if (!Array.isArray(window.__skrpChatOpenSuppressedCodes) || window.__skrpChatOpenSuppressedCodes.length === 0) {
              window.__skrpChatOpenSuppressedHeld = false;
              window.__skrpChatSuppressInputUntil = 0;
            }
          }
          if (isMovementRepeatKey(event)) {
            window.__skrpChatOpenMovementHeld = false;
            window.__skrpChatOpenMovementHeldUntil = 0;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            sendChatDebugState('escape-keyup', {
              important: true,
              valueLength: input.value.length
            });
            if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
              window.skyrimPlatform.sendMessage('rpChatClose', 'escape');
            }
          }
        });

        input.addEventListener('input', function() {
          resetCursor();
          if (rollbackOpeningKeyRun(input)) {
            rememberChatInputValue(input);
            sendChatTypingState(input.value.trim().length > 0);
            updateCounter(input);
            return;
          }
          if (rollbackUnexpectedTextInput(input)) {
            sendChatTypingState(input.value.trim().length > 0);
            updateCounter(input);
            return;
          }
          if (trimSyntheticRun(input)) {
            rememberChatInputValue(input);
            sendChatTypingState(input.value.trim().length > 0);
            updateCounter(input);
            return;
          }
          rememberChatInputValue(input);
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
          if (window.__skrpChatInternalBlur) return;
          setTimeout(function() {
            var root = document.getElementById('skrp-chat-root');
            var currentInput = document.getElementById('skrp-chat-input');
            var isStillOpen = !!(root && root.getAttribute('data-chat-open') === 'true');
            var isStillFocused = currentInput === document.activeElement;
            if (isStillOpen && !isStillFocused) {
              hideChatInputLocally();
              sendChatClose('blur');
            }
          }, 40);
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
      applySettings(false);
      return root;
    }

    function openChatInput(root) {
      if (!root) return null;
      cancelChatIdleHide();
      var wasOpen = root.getAttribute('data-chat-open') === 'true';
      if (root) root.setAttribute('data-chat-open', 'true');
      root.style.display = 'block';
      root.style.pointerEvents = 'auto';
      var input = document.getElementById('skrp-chat-input');
      if (input) {
        input.style.display = 'block';
        var counter = document.getElementById('skrp-chat-counter');
        if (counter) {
          counter.style.display = 'block';
        }
        var prefill = typeof window.__skrpChatOpenPrefill === 'string' ? window.__skrpChatOpenPrefill : '';
        if (!wasOpen || prefill) {
          input.value = prefill || '';
        }
        window.__skrpChatOpenPrefill = '';
        resetTextInputGate(input.value || '');
        armOpeningInputGuard(input, 0);
        updateCounter(input);
      }
      sendChatDebugState('chat-opened', {
        important: true,
        existingValueLength: input ? input.value.length : 0
      });
      applySettings(false);
      return root;
    }

    function clampSelection(input) {
      var fallback = input.value.length;
      var start = Number(input.selectionStart);
      var end = Number(input.selectionEnd);
      if (!isFinite(start)) start = fallback;
      if (!isFinite(end)) end = start;
      start = Math.max(0, Math.min(input.value.length, start));
      end = Math.max(start, Math.min(input.value.length, end));
      return { start: start, end: end };
    }

    function dispatchNativeInput(input) {
      updateCounter(input);
      sendChatTypingState(input.value.trim().length > 0);
      try {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      } catch (e) {}
    }

    function replaceSelection(input, text) {
      text = String(text || '');
      if (!text) return;
      window.__skrpChatSuppressInputUntil = 0;
      noteAllowedTextInput(text, 'native');
      var selection = clampSelection(input);
      input.value = input.value.slice(0, selection.start) + text + input.value.slice(selection.end);
      var next = selection.start + text.length;
      input.selectionStart = next;
      input.selectionEnd = next;
      dispatchNativeInput(input);
    }

    function backspaceSelection(input) {
      window.__skrpChatSuppressInputUntil = 0;
      var selection = clampSelection(input);
      if (selection.start === selection.end) {
        if (selection.start <= 0) return;
        selection.start -= 1;
      }
      input.value = input.value.slice(0, selection.start) + input.value.slice(selection.end);
      input.selectionStart = selection.start;
      input.selectionEnd = selection.start;
      dispatchNativeInput(input);
    }

    function deleteSelection(input) {
      window.__skrpChatSuppressInputUntil = 0;
      var selection = clampSelection(input);
      if (selection.start === selection.end) {
        if (selection.start >= input.value.length) return;
        selection.end += 1;
      }
      input.value = input.value.slice(0, selection.start) + input.value.slice(selection.end);
      input.selectionStart = selection.start;
      input.selectionEnd = selection.start;
      dispatchNativeInput(input);
    }

    window._skrpChatNativeKey = function(payload) {
      payload = payload || {};
      var root = ensureChat();
      if (!root) return false;
      if (root.getAttribute('data-chat-open') !== 'true') {
        openChatInput(root);
      }
      var input = document.getElementById('skrp-chat-input');
      if (!input) return false;
      input.style.display = 'block';
      var counter = document.getElementById('skrp-chat-counter');
      if (counter) counter.style.display = 'block';
      root.style.display = 'block';
      root.style.pointerEvents = 'auto';
      root.setAttribute('data-chat-open', 'true');

      if (payload.kind === 'text') {
        replaceSelection(input, payload.text || '');
        return true;
      }
      if (payload.kind === 'backspace') {
        backspaceSelection(input);
        return true;
      }
      if (payload.kind === 'delete') {
        deleteSelection(input);
        return true;
      }
      if (payload.kind === 'enter') {
        submitChatInput(input, 'submit');
        return true;
      }
      if (payload.kind === 'escape') {
        sendChatTypingState(false);
        input.value = '';
        updateCounter(input);
        hideChatInputLocally();
        sendChatClose('escape');
        return true;
      }
      return false;
    };

    window._skrpChatApplySettings = function(newSettings) {
      window.__skrpChatSettings = Object.assign({}, window.__skrpChatSettings || {}, newSettings || {});
      ensureChat();
      applySettings(true);
    };

    window._skrpChatPush = function(payload) {
      var log = document.getElementById('skrp-chat-log');
      if (log) log.innerHTML = '';
      window.__skrpChatMessages = [];
      window.__skrpPendingChat = [];
      void payload;
    };

    var root = openChatInput(ensureChat());
    var pending = Array.isArray(window.__skrpPendingChat) ? window.__skrpPendingChat : [];
    window.__skrpPendingChat = [];
    for (var i = 0; i < pending.length; i++) window._skrpChatPush(pending[i]);
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
      window.__skrpChatOpenValue = input.value || '';
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
    try {
      this.sp.setTextsVisibility("on");
    } catch (error) {
      this.pushChatDebugEntry("setTextsVisibilityError", {
        important: true,
        error: `${error}`,
      });
    }
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
    this.manualCursorMode = false;
    this.chatOpenCooldownUntil = 0;
    this.chatOpenHotkeyLockoutUntil = 0;
    this.lastChatOpenBindingEventAt = 0;
    this.lastChatMovementKeyEventAt = 0;
    this.chatOpenButtonBurstStartedAt = 0;
    this.chatOpenButtonBurstCount = 0;
    this.chatInputFocusConfirmedAt = 0;
    this.chatNativeInputGuardUntil = 0;
    this.chatOpeningSuppressedKeyCodes.clear();
    this.clearChatFocusRecovery("connectionAccepted");
    this.gameplayUiVisible = false;
    this.chatRequestedVisible = false;
    this.trySetChatMenuControlsSuppressed(false, "connectionAccepted");
    this.requestPlayerControlsRecovery("connectionAccepted");
    this.gracefulDisconnectSent = false;
    this.serverInitiatedQuitSeen = false;
    this.clearServerInitiatedQuitFlag();
    this.sp.browser.setFocused(false);
    this.restoreBrowserVisibilityIfNeeded();
  }

  private onConnectionDisconnect() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.pushChatDebugEntry("connectionDisconnect", { important: true });
    this.markChatStateForReset();
    browserChatHotkeyState.openLatch = false;
    this.manualCursorMode = false;
    this.chatOpenHotkeyLockoutUntil = 0;
    this.lastChatOpenBindingEventAt = 0;
    this.lastChatMovementKeyEventAt = 0;
    this.chatOpenButtonBurstStartedAt = 0;
    this.chatOpenButtonBurstCount = 0;
    this.chatInputFocusConfirmedAt = 0;
    this.chatNativeInputGuardUntil = 0;
    this.chatOpeningSuppressedKeyCodes.clear();
    this.clearChatFocusRecovery("connectionDisconnect");
    this.gameplayUiVisible = false;
    this.chatRequestedVisible = false;
    this.trySetChatMenuControlsSuppressed(false, "connectionDisconnect");
    this.requestPlayerControlsRecovery("connectionDisconnect");
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
      FormView.isDisplayingNicknames = true;
      this.pushChatDebugEntry("f1-nicknamesOn", { important: true });
    }
    if (e.isDown([DxScanCode.F2])) {
      this.sp.browser.setVisible(!this.sp.browser.isVisible());
    }
    // Chat opening is edge-triggered from buttonEvent. Polling Input.isKeyPressed
    // can read a stuck T as held for many seconds and reopen chat repeatedly.
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

    this.isProcessingUpdate = true;
    try {
      this.releaseChatOpenHotkeyLatchIfNeeded();
      this.retryChatFocusIfNeeded();
      this.retryCursorFocusIfNeeded();
      this.applyPendingChatMenuControlsIfNeeded();
      this.recoverPlayerControlsIfNeeded();
      this.restoreBrowserVisibilityIfNeeded();
      this.sampleBlackBoxStateIfNeeded();
    } finally {
      this.isProcessingUpdate = false;
    }
  }

  private onButtonEvent(e: ButtonEvent) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.pushButtonDebugEntry(e);

    const now = Date.now();
    const isOpenBindingButton = this.isChatOpenBindingButton(e);
    const msSinceOpenBindingEvent = isOpenBindingButton && this.lastChatOpenBindingEventAt
      ? now - this.lastChatOpenBindingEventAt
      : Number.MAX_SAFE_INTEGER;
    if (isOpenBindingButton) {
      this.lastChatOpenBindingEventAt = now;
    }
    if (this.isChatFocusBlockerButton(e)) {
      this.lastChatMovementKeyEventAt = now;
    }
    if (e.isUp || e.value === 0) {
      this.chatOpeningSuppressedKeyCodes.delete(e.code);
    }

    if (e.isDown && !e.isRepeating) {
      if (e.code === DxScanCode.F4) {
        this.closeAllBrowserUi();
        return;
      }
      if (e.code === DxScanCode.F3) {
        this.toggleBrowserCursorMode();
        return;
      }
      if (isOpenBindingButton) {
        const prefillText = this.getChatOpenPrefillForButton(e);
        this.tryOpenChatFromBinding(prefillText ? "slash-button" : "t-button", e, msSinceOpenBindingEvent, prefillText);
        return;
      }
    }

    if (isOpenBindingButton && (e.isUp || e.value === 0)) {
      if (now < this.chatOpenCooldownUntil || now < this.chatOpenHotkeyLockoutUntil) {
        this.pushChatDebugEntry("chatOpenHotkeyReleaseIgnored", {
          important: true,
          keyCode: e.code,
          cooldownRemainingMs: Math.max(0, this.chatOpenCooldownUntil - now),
          lockoutRemainingMs: Math.max(0, this.chatOpenHotkeyLockoutUntil - now),
        });
        return;
      }
      if (!this.isChatOpenBindingPressed()) {
        browserChatHotkeyState.openLatch = false;
      }
      this.pushChatDebugEntry("chatOpenHotkeyReleased", {
        important: true,
        keyCode: e.code,
        latchCleared: !browserChatHotkeyState.openLatch,
      });
    }

    if (this.chatRequestedVisible && this.handleNativeChatButtonEvent(e)) {
      return;
    }

    return;
  }

  private isChatOpenBindingPressed() {
    try {
      return CHAT_OPEN_BINDINGS.some((binding) => binding.every((keyCode) => this.sp.Input.isKeyPressed(keyCode)));
    } catch (error) {
      this.pushChatDebugEntry("chatOpenBindingReadError", {
        important: true,
        error: `${error}`,
      });
      return false;
    }
  }

  private isChatOpenBindingButton(e: ButtonEvent) {
    return CHAT_OPEN_BINDINGS.some((binding) => binding.includes(e.code));
  }

  private getChatOpenBindingForButton(e: ButtonEvent) {
    return CHAT_OPEN_BINDINGS.find((binding) => binding.includes(e.code));
  }

  private getChatOpenPrefillForButton(e?: ButtonEvent) {
    if (!e) return "";
    return e.code === DxScanCode.ForwardSlash || e.code === DxScanCode.NumSlash ? "/" : "";
  }

  private isChatFocusBlockerButton(e: ButtonEvent) {
    return CHAT_FOCUS_BLOCKER_KEYS.includes(e.code);
  }

  private tryOpenChatFromBinding(debugSource: string, e?: ButtonEvent, msSinceOpenBindingEvent = Number.MAX_SAFE_INTEGER, prefillText = "") {
    if (this.badMenusOpen.size !== 0 || this.sp.browser.isFocused() || this.chatRequestedVisible) {
      return;
    }

    if (e && !this.isChatOpenBindingButton(e)) {
      return;
    }

    if (!e && !this.isChatOpenBindingPressed()) {
      return;
    }

    const now = Date.now();
    if (now < this.chatOpenHotkeyLockoutUntil) {
      this.pushChatDebugEntry("chatOpenHotkeyLockoutSuppressed", {
        important: true,
        debugSource,
        remainingMs: this.chatOpenHotkeyLockoutUntil - now,
      });
      return;
    }

    if (!this.tryAcquireChatOpenHotkeyLatch()) {
      this.pushChatDebugEntry("chatOpenHotkeySuppressed", {
        important: true,
        debugSource,
      });
      return;
    }

    const releaseKeyCode = e ? (this.getChatOpenBindingForButton(e) || CHAT_OPEN_BINDING) : CHAT_OPEN_BINDING;
    this.prepareChatOpenKey(releaseKeyCode);
    this.pushChatDebugEntry("chat-combo-open", { important: true, debugSource, msSinceOpenBindingEvent, prefillText });
    this.openChat({ releaseKeyCode, prefillText, debugSource });
  }

  private tryAcquireChatOpenHotkeyLatch() {
    if (browserChatHotkeyState.openLatch) {
      return false;
    }

    browserChatHotkeyState.openLatch = true;
    return true;
  }

  private trackChatOpenButtonBurst() {
    const now = Date.now();
    if (!this.chatOpenButtonBurstStartedAt || now - this.chatOpenButtonBurstStartedAt > 7000) {
      this.chatOpenButtonBurstStartedAt = now;
      this.chatOpenButtonBurstCount = 0;
    }

    this.chatOpenButtonBurstCount += 1;
    if (this.chatOpenButtonBurstCount <= 3) {
      return true;
    }

    this.chatOpenHotkeyLockoutUntil = now + 4000;
    this.chatOpenCooldownUntil = Math.max(this.chatOpenCooldownUntil, this.chatOpenHotkeyLockoutUntil);
    browserChatHotkeyState.openLatch = true;
    this.pushChatDebugEntry("chatOpenHotkeyBurstLockout", {
      important: true,
      count: this.chatOpenButtonBurstCount,
      lockoutMs: 4000,
    });
    return false;
  }

  private releaseChatOpenHotkeyLatchIfNeeded() {
    if (!browserChatHotkeyState.openLatch) {
      return;
    }
    if (Date.now() < this.chatOpenCooldownUntil) {
      return;
    }

    const chatOpenKeys = CHAT_OPEN_BINDINGS.reduce<DxScanCode[]>((keys, binding) => keys.concat(binding), []);

    if (chatOpenKeys.some((keyCode) => this.sp.Input.isKeyPressed(keyCode))) {
      return;
    }

    browserChatHotkeyState.openLatch = false;
  }

  private getChatInputCandidateKeyCodes() {
    return [
      DxScanCode.A,
      DxScanCode.B,
      DxScanCode.C,
      DxScanCode.D,
      DxScanCode.E,
      DxScanCode.F,
      DxScanCode.G,
      DxScanCode.H,
      DxScanCode.I,
      DxScanCode.J,
      DxScanCode.K,
      DxScanCode.L,
      DxScanCode.M,
      DxScanCode.N,
      DxScanCode.O,
      DxScanCode.P,
      DxScanCode.Q,
      DxScanCode.R,
      DxScanCode.S,
      DxScanCode.T,
      DxScanCode.U,
      DxScanCode.V,
      DxScanCode.W,
      DxScanCode.X,
      DxScanCode.Y,
      DxScanCode.Z,
      DxScanCode.N1,
      DxScanCode.N2,
      DxScanCode.N3,
      DxScanCode.N4,
      DxScanCode.N5,
      DxScanCode.N6,
      DxScanCode.N7,
      DxScanCode.N8,
      DxScanCode.N9,
      DxScanCode.N0,
      DxScanCode.ForwardSlash,
      DxScanCode.Num0,
      DxScanCode.Num1,
      DxScanCode.Num2,
      DxScanCode.Num3,
      DxScanCode.Num4,
      DxScanCode.Num5,
      DxScanCode.Num6,
      DxScanCode.Num7,
      DxScanCode.Num8,
      DxScanCode.Num9,
      DxScanCode.NumSlash,
      DxScanCode.Spacebar,
      DxScanCode.LeftShift,
      DxScanCode.RightShift,
      DxScanCode.LeftAlt,
      DxScanCode.RightAlt,
    ];
  }

  private getPressedOpeningSuppressedKeyCodes(keyCode?: DxScanCode | DxScanCode[]) {
    const keys = Array.isArray(keyCode) ? keyCode : keyCode !== undefined ? [keyCode] : [];
    const pressed = new Set<DxScanCode>(keys);

    for (const candidate of this.getChatInputCandidateKeyCodes()) {
      try {
        if (this.sp.Input.isKeyPressed(candidate)) {
          pressed.add(candidate);
        }
      } catch (error) {
        this.pushChatDebugEntry("chatOpeningHeldKeyReadError", {
          important: true,
          keyCode: candidate,
          error: `${error}`,
        });
      }
    }

    return Array.from(pressed.values());
  }

  private getBrowserCodeForChatInputKey(key: DxScanCode) {
    const keyName = this.getDxScanCodeName(key);
    if (/^[A-Z]$/.test(keyName)) return `Key${keyName}`;
    if (/^N[0-9]$/.test(keyName)) return `Digit${keyName.slice(1)}`;
    if (/^Num[0-9]$/.test(keyName)) return `Numpad${keyName.slice(3)}`;

    const text = this.getNativeChatTextForKey(key);
    if (text && /^[a-z]$/i.test(text)) return `Key${text.toUpperCase()}`;

    switch (key) {
      case DxScanCode.N0: return "Digit0";
      case DxScanCode.N1: return "Digit1";
      case DxScanCode.N2: return "Digit2";
      case DxScanCode.N3: return "Digit3";
      case DxScanCode.N4: return "Digit4";
      case DxScanCode.N5: return "Digit5";
      case DxScanCode.N6: return "Digit6";
      case DxScanCode.N7: return "Digit7";
      case DxScanCode.N8: return "Digit8";
      case DxScanCode.N9: return "Digit9";
      case DxScanCode.Num0: return "Numpad0";
      case DxScanCode.Num1: return "Numpad1";
      case DxScanCode.Num2: return "Numpad2";
      case DxScanCode.Num3: return "Numpad3";
      case DxScanCode.Num4: return "Numpad4";
      case DxScanCode.Num5: return "Numpad5";
      case DxScanCode.Num6: return "Numpad6";
      case DxScanCode.Num7: return "Numpad7";
      case DxScanCode.Num8: return "Numpad8";
      case DxScanCode.Num9: return "Numpad9";
      case DxScanCode.Spacebar: return "Space";
      case DxScanCode.LeftShift: return "ShiftLeft";
      case DxScanCode.RightShift: return "ShiftRight";
      case DxScanCode.LeftAlt: return "AltLeft";
      case DxScanCode.RightAlt: return "AltRight";
      case DxScanCode.ForwardSlash: return "Slash";
      case DxScanCode.NumPlus: return "NumpadAdd";
      case DxScanCode.NumSlash: return "NumpadDivide";
      case DxScanCode.NumEnter:
      case DxScanCode.Enter: return "Enter";
      default:
        return "";
    }
  }

  private getChatOpenSuppressedInput(keys: DxScanCode[]) {
    const codes: string[] = [];
    const texts: string[] = [];
    let printableKey = "";

    for (const key of keys) {
      const browserCode = this.getBrowserCodeForChatInputKey(key);
      if (browserCode && !codes.includes(browserCode)) {
        codes.push(browserCode);
      }

      const text = this.getNativeChatTextForKey(key);
      if (text !== null) {
        const lowerText = text.toLowerCase();
        if (!texts.includes(lowerText)) texts.push(lowerText);
        if (!texts.includes(text)) texts.push(text);
        if (!printableKey && text.length === 1) printableKey = lowerText;
      }

      switch (key) {
        case DxScanCode.T:
          printableKey = printableKey || "t";
          break;
        case DxScanCode.ForwardSlash:
          printableKey = printableKey || "/";
          if (!codes.includes("Slash")) codes.push("Slash");
          break;
        case DxScanCode.NumSlash:
          printableKey = printableKey || "/";
          if (!codes.includes("NumpadDivide")) codes.push("NumpadDivide");
          break;
        case DxScanCode.NumPlus:
          printableKey = printableKey || "+";
          break;
        case DxScanCode.NumEnter:
        case DxScanCode.Enter:
          printableKey = printableKey || "enter";
          if (!codes.includes("NumpadEnter")) codes.push("NumpadEnter");
          break;
        default:
          break;
      }
    }

    return { key: printableKey, codes, texts };
  }

  private shouldSuppressOpeningNativeChatButtonEvent(e: ButtonEvent) {
    if (e.code === DxScanCode.Enter
      || e.code === DxScanCode.NumEnter
      || e.code === DxScanCode.Escape
      || e.code === DxScanCode.Backspace
      || e.code === DxScanCode.Delete) {
      return false;
    }

    const isOpeningHeldKey = this.chatOpeningSuppressedKeyCodes.has(e.code);
    if (!isOpeningHeldKey && !(e.isRepeating && this.isPrintableChatInputKey(e.code))) {
      return false;
    }

    const now = Date.now();
    if (now - this.lastNativeInputSuppressedLogAt >= 300) {
      this.lastNativeInputSuppressedLogAt = now;
      this.pushChatDebugEntry("nativeChatOpeningHeldKeySuppressed", {
        important: true,
        keyCode: e.code,
        key: this.getDxScanCodeName(e.code),
        heldAtOpen: isOpeningHeldKey,
        inputFocusConfirmed: !!this.chatInputFocusConfirmedAt,
        isRepeating: (e as any).isRepeating === true,
      });
    }

    return true;
  }

  private handleNativeChatButtonEvent(e: ButtonEvent) {
    if (!e.isDown) {
      return false;
    }

    if (this.isChatOpenBindingButton(e) && (e.isRepeating || Date.now() - this.lastChatOpenAt < 1000)) {
      return true;
    }

    if (this.shouldSuppressOpeningNativeChatButtonEvent(e)) {
      return true;
    }

    if (this.chatInputFocusConfirmedAt && this.sp.browser.isFocused()) {
      return false;
    }

    if (this.isChatOpenBindingButton(e) && Date.now() - this.lastChatOpenAt < 350) {
      return true;
    }

    if (e.isRepeating && this.isMovementChatInputKey(e.code)) {
      return true;
    }

    const payload = this.getNativeChatButtonPayload(e);
    if (!payload) {
      return false;
    }

    const device = Number((e as any).device ?? 0);
    if (payload.kind === "text" && device !== 0) {
      const now = Date.now();
      if (now - this.lastNativeInputSuppressedLogAt >= 300) {
        this.lastNativeInputSuppressedLogAt = now;
        this.pushChatDebugEntry("nativeChatNonKeyboardTextSuppressed", {
          important: true,
          keyCode: e.code,
          key: this.getDxScanCodeName(e.code),
          device,
        });
      }
      return true;
    }

    if (e.isRepeating && (payload.kind === "enter" || payload.kind === "escape")) {
      return true;
    }

    if (e.isRepeating && payload.kind === "text" && this.isPrintableChatInputKey(e.code)) {
      return true;
    }

    try {
      this.sp.browser.setVisible(true);
      this.trySetChatMenuControlsSuppressed(true, "nativeChatInput");
      this.sp.browser.executeJavaScript(`
        (function() {
          if (window._skrpChatNativeKey) {
            window._skrpChatNativeKey(${JSON.stringify(payload)});
          }
        })();
      `);
    } catch (error) {
      this.pushChatDebugEntry("nativeChatInputError", {
        important: true,
        error: `${error}`,
      });
    }

    return true;
  }

  private getNativeChatButtonPayload(e: ButtonEvent): { kind: string; text?: string } | null {
    switch (e.code) {
      case DxScanCode.Escape:
        return { kind: "escape" };
      case DxScanCode.Enter:
      case DxScanCode.NumEnter:
        return { kind: "enter" };
      case DxScanCode.Backspace:
        return { kind: "backspace" };
      case DxScanCode.Delete:
        return { kind: "delete" };
      default:
        break;
    }

    if (this.isChatInputControlModifierPressed()) {
      return null;
    }

    const text = this.getNativeChatTextForKey(e.code);
    return text === null ? null : { kind: "text", text };
  }

  private getNativeChatTextForKey(code: DxScanCode) {
    const shift = this.isChatInputShiftPressed();

    switch (code) {
      case DxScanCode.A: return shift ? "A" : "a";
      case DxScanCode.B: return shift ? "B" : "b";
      case DxScanCode.C: return shift ? "C" : "c";
      case DxScanCode.D: return shift ? "D" : "d";
      case DxScanCode.E: return shift ? "E" : "e";
      case DxScanCode.F: return shift ? "F" : "f";
      case DxScanCode.G: return shift ? "G" : "g";
      case DxScanCode.H: return shift ? "H" : "h";
      case DxScanCode.I: return shift ? "I" : "i";
      case DxScanCode.J: return shift ? "J" : "j";
      case DxScanCode.K: return shift ? "K" : "k";
      case DxScanCode.L: return shift ? "L" : "l";
      case DxScanCode.M: return shift ? "M" : "m";
      case DxScanCode.N: return shift ? "N" : "n";
      case DxScanCode.O: return shift ? "O" : "o";
      case DxScanCode.P: return shift ? "P" : "p";
      case DxScanCode.Q: return shift ? "Q" : "q";
      case DxScanCode.R: return shift ? "R" : "r";
      case DxScanCode.S: return shift ? "S" : "s";
      case DxScanCode.T: return shift ? "T" : "t";
      case DxScanCode.U: return shift ? "U" : "u";
      case DxScanCode.V: return shift ? "V" : "v";
      case DxScanCode.W: return shift ? "W" : "w";
      case DxScanCode.X: return shift ? "X" : "x";
      case DxScanCode.Y: return shift ? "Y" : "y";
      case DxScanCode.Z: return shift ? "Z" : "z";
      case DxScanCode.N1: return shift ? "!" : "1";
      case DxScanCode.N2: return shift ? "@" : "2";
      case DxScanCode.N3: return shift ? "#" : "3";
      case DxScanCode.N4: return shift ? "$" : "4";
      case DxScanCode.N5: return shift ? "%" : "5";
      case DxScanCode.N6: return shift ? "^" : "6";
      case DxScanCode.N7: return shift ? "&" : "7";
      case DxScanCode.N8: return shift ? "*" : "8";
      case DxScanCode.N9: return shift ? "(" : "9";
      case DxScanCode.N0: return shift ? ")" : "0";
      case DxScanCode.Spacebar: return " ";
      case DxScanCode.Minus: return shift ? "_" : "-";
      case DxScanCode.Equals: return shift ? "+" : "=";
      case DxScanCode.LeftBracket: return shift ? "{" : "[";
      case DxScanCode.RightBracket: return shift ? "}" : "]";
      case DxScanCode.BackSlash: return shift ? "|" : "\\";
      case DxScanCode.Semicolon: return shift ? ":" : ";";
      case DxScanCode.Apostrophe: return shift ? "\"" : "'";
      case DxScanCode.Console: return shift ? "~" : "`";
      case DxScanCode.Comma: return shift ? "<" : ",";
      case DxScanCode.Period: return shift ? ">" : ".";
      case DxScanCode.ForwardSlash: return shift ? "?" : "/";
      case DxScanCode.Num0: return "0";
      case DxScanCode.Num1: return "1";
      case DxScanCode.Num2: return "2";
      case DxScanCode.Num3: return "3";
      case DxScanCode.Num4: return "4";
      case DxScanCode.Num5: return "5";
      case DxScanCode.Num6: return "6";
      case DxScanCode.Num7: return "7";
      case DxScanCode.Num8: return "8";
      case DxScanCode.Num9: return "9";
      case DxScanCode.NumDot: return ".";
      case DxScanCode.NumPlus: return "+";
      case DxScanCode.NumMinus: return "-";
      case DxScanCode.NumMult: return "*";
      case DxScanCode.NumSlash: return "/";
      default:
        return null;
    }
  }

  private isChatInputShiftPressed() {
    try {
      return this.sp.Input.isKeyPressed(DxScanCode.LeftShift)
        || this.sp.Input.isKeyPressed(DxScanCode.RightShift);
    } catch (error) {
      return false;
    }
  }

  private isChatInputControlModifierPressed() {
    try {
      return this.sp.Input.isKeyPressed(DxScanCode.LeftControl)
        || this.sp.Input.isKeyPressed(DxScanCode.RightControl)
        || this.sp.Input.isKeyPressed(DxScanCode.LeftAlt)
        || this.sp.Input.isKeyPressed(DxScanCode.RightAlt);
    } catch (error) {
      return false;
    }
  }

  private isMovementChatInputKey(code: DxScanCode) {
    return code === DxScanCode.W
      || code === DxScanCode.A
      || code === DxScanCode.S
      || code === DxScanCode.D
      || code === DxScanCode.LeftShift
      || code === DxScanCode.RightShift
      || code === DxScanCode.LeftAlt
      || code === DxScanCode.RightAlt
      || code === DxScanCode.Spacebar;
  }

  private isPrintableChatInputKey(code: DxScanCode) {
    return this.getNativeChatTextForKey(code) !== null;
  }

  private armBrowserChatOpeningInputGuard(keyCode?: DxScanCode | DxScanCode[]) {
    const suppressedKeyCodes = this.getPressedOpeningSuppressedKeyCodes(keyCode);
    this.chatOpeningSuppressedKeyCodes = new Set(suppressedKeyCodes);
    const guard = this.getChatOpenSuppressedInput(suppressedKeyCodes);
    this.sp.browser.executeJavaScript(`
      (function() {
        window.__skrpChatSuppressInputUntil = Date.now();
        window.__skrpChatOpenSuppressedKey = ${JSON.stringify(guard.key)};
        window.__skrpChatOpenSuppressedCodes = ${JSON.stringify(guard.codes)};
        window.__skrpChatOpenSuppressedTexts = ${JSON.stringify(guard.texts)};
        window.__skrpChatOpenMovementHeld = false;
        window.__skrpChatOpenMovementHeldUntil = 0;
      })();
    `);
    this.pushChatDebugEntry("chatOpeningHeldKeysCaptured", {
      important: true,
      heldKeys: suppressedKeyCodes.map((key) => this.getDxScanCodeName(key)),
    });
  }

  private prepareChatOpenKey(keyCode: DxScanCode | DxScanCode[]) {
    this.sp.Game.enableFastTravel(false);
    this.sp.Game.setInChargen(true, true, false);
    this.manualCursorMode = false;
    this.trySetChatMenuControlsSuppressed(true, "prepareChatOpenKey");
    this.pushChatDebugEntry("chat-open-button-down", { important: true, keyCode });
  }

  private closeChat(releaseKeys = false) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.clearChatFocusRecovery("closeChat");
    this.chatInputFocusConfirmedAt = 0;
    this.chatNativeInputGuardUntil = 0;
    this.chatOpeningSuppressedKeyCodes.clear();
    this.trySetChatMenuControlsSuppressed(false, "closeChat");
    this.chatRequestedVisible = false;
    this.pushChatDebugEntry("closeChat", {
      important: true,
      releaseKeys,
      browserFocused: this.sp.browser.isFocused(),
      browserVisible: this.sp.browser.isVisible(),
    });
    if (releaseKeys) {
      browserChatHotkeyState.openLatch = true;
      this.chatOpenCooldownUntil = 0;
    }
    this.sp.browser.setFocused(false);
    this.manualCursorMode = false;
    this.requestPlayerControlsRecovery("closeChat");
    this.sp.browser.executeJavaScript(unfocusEventString);
    this.restoreBrowserVisibilityIfNeeded();
  }

  private toggleBrowserCursorMode() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (this.chatRequestedVisible) {
      this.pushChatDebugEntry("f3-closeChat", { important: true });
      this.closeChat(true);
      return;
    }

    this.manualCursorMode = !this.manualCursorMode;
    this.pushChatDebugEntry("f3-cursorToggle", {
      important: true,
      enabled: this.manualCursorMode,
    });

    if (this.manualCursorMode) {
      this.sp.browser.setVisible(true);
      this.sp.browser.setFocused(false);
      this.sp.browser.executeJavaScript(cursorModeHotkeysEventString);
      this.trySetChatMenuControlsSuppressed(true, "f3CursorOn");
      this.armCursorFocusRecovery("f3CursorOn");
      return;
    }

    this.clearCursorFocusRecovery("f3CursorOff");
    this.sp.browser.setFocused(false);
    this.sp.browser.executeJavaScript(`window.__skrpManualCursorMode = false;`);
    this.trySetChatMenuControlsSuppressed(false, "f3CursorOff");
    this.requestPlayerControlsRecovery("f3CursorOff");
    this.restoreBrowserVisibilityIfNeeded();
  }

  private closeAllBrowserUi() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.pushChatDebugEntry("f4-closeAllUi", { important: true });
    this.clearChatFocusRecovery("f4CloseAllUi");
    this.chatInputFocusConfirmedAt = 0;
    this.chatRequestedVisible = false;
    this.adminPanelVisible = false;
    this.manualCursorMode = false;
    this.trySetChatMenuControlsSuppressed(false, "f4CloseAllUi");
    this.clearCursorFocusRecovery("f4CloseAllUi");
    this.sp.browser.setFocused(false);
    this.sp.browser.executeJavaScript(closeAllUiEventString);
    this.requestPlayerControlsRecovery("f4CloseAllUi");
    this.restoreBrowserVisibilityIfNeeded();
  }

  private openChat(options: { releaseKeyCode?: DxScanCode | DxScanCode[]; prefillText?: string; debugSource?: string } = {}) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    const wasAlreadyRequested = this.chatRequestedVisible;
    this.chatRequestedVisible = true;
    this.chatNativeInputGuardUntil = 0;
    this.trySetChatMenuControlsSuppressed(true, "openChat");
    this.armBrowserChatOpeningInputGuard(options.releaseKeyCode);
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(false);

    if (wasAlreadyRequested) {
      if (typeof options.prefillText === "string") {
        this.sp.browser.executeJavaScript(`window.__skrpChatOpenPrefill = ${JSON.stringify(options.prefillText)};`);
      }

      if (this.sp.browser.isFocused() && this.chatInputFocusConfirmedAt) {
        return;
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

    this.armBrowserChatOpeningInputGuard(options.releaseKeyCode);
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

    let isConnected = false;
    try {
      isConnected = this.controller.lookupListener(NetworkingService).isConnected();
    } catch (error) {
      isConnected = false;
    }

    const shouldShowBrowser = !isConnected
      || this.chatRequestedVisible
      || this.manualCursorMode
      || this.adminPanelVisible
      || this.disconnectNoticeVisible;

    this.sp.browser.setVisible(shouldShowBrowser);
    if (!shouldShowBrowser && this.sp.browser.isFocused()) {
      this.sp.browser.setFocused(false);
    }
  }

  private requestPlayerControlsRecovery(reason: string, durationMs = 1500) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    this.playerControlsRecoveryUntil = Math.max(this.playerControlsRecoveryUntil, Date.now() + durationMs);
    this.pushChatDebugEntry("requestPlayerControlsRecovery", {
      important: true,
      reason,
      until: this.playerControlsRecoveryUntil,
    });
  }

  private recoverPlayerControlsIfNeeded() {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (!this.playerControlsRecoveryUntil) {
      return;
    }

    const now = Date.now();
    if (now > this.playerControlsRecoveryUntil) {
      this.playerControlsRecoveryUntil = 0;
      return;
    }

    if (this.chatRequestedVisible || this.adminPanelVisible || this.manualCursorMode || this.badMenusOpen.size !== 0) {
      return;
    }

    try {
      if (this.sp.browser.isFocused()) {
        this.sp.browser.setFocused(false);
      }
      this.sp.Game.enablePlayerControls(true, false, false, true, false, true, true, true, 0);
      this.chatMenuControlsSuppressed = false;
      this.playerControlsRecoveryUntil = 0;
      this.pushChatDebugEntry("recoverPlayerControls", { important: true });
    } catch (error) {
      this.pushChatDebugEntry("recoverPlayerControlsError", {
        important: true,
        error: `${error}`,
      });
    }
  }

  private deferChatMenuControlsSuppressed(suppressed: boolean, reason: string) {
    if (this.chatMenuControlsSuppressed === suppressed) {
      if (this.pendingChatMenuControlsSuppressed !== null) {
        this.pendingChatMenuControlsSuppressed = null;
        this.pendingChatMenuControlsReason = "";
      }
      return;
    }

    if (this.pendingChatMenuControlsSuppressed === suppressed) {
      return;
    }

    this.pendingChatMenuControlsSuppressed = suppressed;
    this.pendingChatMenuControlsReason = reason;
    this.pushChatDebugEntry("chatMenuControlsDeferred", {
      important: true,
      suppressed,
      reason,
    });
  }

  private trySetChatMenuControlsSuppressed(suppressed: boolean, reason: string) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    if (!this.isProcessingUpdate) {
      this.deferChatMenuControlsSuppressed(suppressed, reason);
      return;
    }

    if (this.chatMenuControlsSuppressed === suppressed) {
      if (this.pendingChatMenuControlsSuppressed !== null) {
        this.pendingChatMenuControlsSuppressed = null;
        this.pendingChatMenuControlsReason = "";
      }
      return;
    }

    try {
      if (suppressed) {
        this.sp.Game.disablePlayerControls(false, false, false, false, false, true, true, true, 0);
      } else {
        this.sp.Game.enablePlayerControls(true, false, false, true, false, true, true, true, 0);
      }

      this.chatMenuControlsSuppressed = suppressed;
      this.pushChatDebugEntry("chatMenuControls", {
        important: true,
        suppressed,
        reason,
      });
      this.pendingChatMenuControlsSuppressed = null;
      this.pendingChatMenuControlsReason = "";
    } catch (error) {
      this.pendingChatMenuControlsSuppressed = suppressed;
      this.pendingChatMenuControlsReason = reason;
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

  private applyPendingChatMenuControlsIfNeeded() {
    if (this.pendingChatMenuControlsSuppressed === null) {
      return;
    }

    const suppressed = this.pendingChatMenuControlsSuppressed;
    const reason = this.pendingChatMenuControlsReason || "deferred";
    this.pendingChatMenuControlsSuppressed = null;
    this.pendingChatMenuControlsReason = "";
    this.trySetChatMenuControlsSuppressed(suppressed, `${reason}:deferred`);
  }

  private shouldResetChatState = true;

  private onBrowserMessage(e: BrowserMessageEvent) {
    if (!this.isActiveBrowserServiceInstance()) {
      return;
    }

    const onLegacyFrontLoadedEventKey = "front-loaded";
    const onAuthFrontLoadedEventKey = "front-loaded-auth";
    const onUiFrontLoadedEventKey = "front-loaded-ui";
    const onChatSubmitEventKey = "rpChatSubmit";
    const onChatCloseEventKey = "rpChatClose";
    const onChatDebugStateEventKey = "rpChatDebugState";
    const onCloseAllUiEventKey = "rpCloseAllUi";
    const onToggleCursorUiEventKey = "rpToggleCursorUi";
    const onAdminPanelOpenEventKey = "rpAdminPanelOpen";
    const onAdminPanelCloseEventKey = "rpAdminPanelClose";

    if (e.arguments[0] === onAuthFrontLoadedEventKey) {
      this.pushChatDebugEntry("front-loaded-auth", { important: true });
      this.controller.emitter.emit("browserWindowLoaded", {});
      return;
    }

    if (e.arguments[0] === onUiFrontLoadedEventKey) {
      this.pushChatDebugEntry("front-loaded-ui", { important: true });
      if (this.shouldResetChatState) {
        this.sp.browser.executeJavaScript(resetChatStateEventString);
        this.shouldResetChatState = false;
      }
      return;
    }

    if (e.arguments[0] === onLegacyFrontLoadedEventKey) {
      this.pushChatDebugEntry("front-loaded-legacyIgnored", { important: true });
      return;
    }

    if (e.arguments[0] === onChatSubmitEventKey) {
      this.pushChatDebugEntry("rpChatSubmit", { important: true });
      if (this.chatRequestedVisible || this.sp.browser.isFocused() || this.chatMenuControlsSuppressed) {
        this.closeChat(true);
      }
      return;
    }

    if (e.arguments[0] === onCloseAllUiEventKey) {
      this.pushChatDebugEntry("rpCloseAllUi", { important: true, source: `${e.arguments[1] || ""}` });
      this.closeAllBrowserUi();
      return;
    }

    if (e.arguments[0] === onToggleCursorUiEventKey) {
      this.pushChatDebugEntry("rpToggleCursorUi", { important: true, source: `${e.arguments[1] || ""}` });
      this.toggleBrowserCursorMode();
      return;
    }

    if (e.arguments[0] === onAdminPanelOpenEventKey) {
      this.pushChatDebugEntry("rpAdminPanelOpen", { important: true });
      this.adminPanelVisible = true;
      this.manualCursorMode = false;
      this.clearCursorFocusRecovery("adminPanelOpen");
      this.sp.browser.setVisible(true);
      this.sp.browser.setFocused(true);
      this.trySetChatMenuControlsSuppressed(true, "adminPanelOpen");
      return;
    }

    if (e.arguments[0] === onAdminPanelCloseEventKey) {
      this.pushChatDebugEntry("rpAdminPanelClose", { important: true });
      this.adminPanelVisible = false;
      this.manualCursorMode = false;
      this.clearCursorFocusRecovery("adminPanelClose");
      this.sp.browser.setFocused(false);
      this.trySetChatMenuControlsSuppressed(false, "adminPanelClose");
      this.requestPlayerControlsRecovery("adminPanelClose");
      this.restoreBrowserVisibilityIfNeeded();
      return;
    }

    if (e.arguments[0] === onChatCloseEventKey) {
      const closeReason = `${e.arguments[1] || ""}`;
      const forceClose = closeReason === "submit" || closeReason === "escape" || closeReason === "blur";
      const msSinceOpen = this.lastChatOpenAt ? Date.now() - this.lastChatOpenAt : Number.MAX_SAFE_INTEGER;
      const awaitingInputFocus = this.chatRequestedVisible
        && this.chatFocusRetryDeadline !== 0
        && this.chatInputFocusConfirmedAt === 0;
      const browserFocused = this.sp.browser.isFocused();
      if (!forceClose && (awaitingInputFocus || msSinceOpen < 250 || (!browserFocused && msSinceOpen < 900))) {
        this.pushChatDebugEntry("rpChatCloseIgnored", {
          important: true,
          closeReason,
          msSinceOpen,
          awaitingInputFocus,
          browserFocused,
        });
        return;
      }

      this.pushChatDebugEntry("rpChatClose", { important: true, closeReason });
      this.closeChat(true);
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
          this.chatNativeInputGuardUntil = Math.max(this.chatNativeInputGuardUntil, Date.now() + 250);
          this.clearChatFocusRecovery("inputFocusConfirmed");
        }
        if (browserEvent === "input-blur" && this.chatRequestedVisible) {
          this.chatInputFocusConfirmedAt = 0;
          if (!this.sp.browser.isFocused()) {
            this.closeChat(true);
          }
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
      if (this.chatRequestedVisible || this.manualCursorMode || this.chatMenuControlsSuppressed || this.sp.browser.isFocused()) {
        this.closeGameplayMenu(e.name, "uiOpen");
        this.sp.browser.setVisible(true);
        this.trySetChatMenuControlsSuppressed(true, `menuBlocked:${e.name}`);
        if (this.chatRequestedVisible) {
          this.sp.browser.setFocused(false);
          this.armChatFocusRecovery(this.chatFocusRetryReleaseKeyCode, `menuBlocked:${e.name}`);
        } else if (this.manualCursorMode) {
          this.sp.browser.setFocused(false);
          this.armCursorFocusRecovery(`menuBlocked:${e.name}`);
        } else if (this.adminPanelVisible) {
          this.clearCursorFocusRecovery(`menuBlocked:${e.name}`);
          this.sp.browser.setFocused(true);
        } else {
          this.sp.browser.setFocused(false);
        }
        this.pushChatDebugEntry("menuBlockedDuringUi", { important: true, menu: e.name });
        return;
      }
      this.badMenusOpen.add(e.name);
      this.sp.browser.setVisible(false);
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

  private closeGameplayMenu(menuName: Menu | string, reason: string) {
    const closeMenu = (phase: string) => {
      try {
        (this.sp.TESModPlatform as any).CloseMenu(menuName);
      } catch (error) {
        this.pushChatDebugEntry("closeGameplayMenuError", {
          important: true,
          menu: `${menuName}`,
          reason,
          phase,
          error: `${error}`,
        });
      }
    };

    closeMenu("immediate");
    setTimeout(() => closeMenu("delay-80"), 80);
    setTimeout(() => closeMenu("delay-220"), 220);
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

  private armChatFocusRecovery(releaseKeyCode?: DxScanCode | DxScanCode[], debugSource?: string) {
    this.chatFocusRetryDeadline = Date.now() + 5000;
    this.chatFocusRetryNextAttemptAt = 0;
    this.chatFocusRetryAttempts = 0;
    this.chatFocusRetryReleaseKeyCode = releaseKeyCode;
    this.chatFocusHeldKeysLogNextAt = 0;
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
    this.chatFocusHeldKeysLogNextAt = 0;
  }

  private getBrowserFocusHeldBlockers(blockers: DxScanCode[]) {
    const pressed: DxScanCode[] = [];

    for (const keyCode of blockers) {
      try {
        if (this.sp.Input.isKeyPressed(keyCode)) {
          pressed.push(keyCode);
        }
      } catch (error) {
        this.pushChatDebugEntry("chatFocusHeldKeyReadError", {
          important: true,
          keyCode,
          error: `${error}`,
        });
      }
    }

    return pressed;
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

    const heldBlockers = this.getBrowserFocusHeldBlockers(CHAT_INPUT_FOCUS_BLOCKER_KEYS);
    if (heldBlockers.length !== 0) {
      this.chatFocusRetryNextAttemptAt = now + 80;
      this.chatNativeInputGuardUntil = Math.max(this.chatNativeInputGuardUntil, now + 400);
      if (now >= this.chatFocusHeldKeysLogNextAt) {
        this.chatFocusHeldKeysLogNextAt = now + 600;
        this.pushChatDebugEntry("chatFocusWaitingForKeyUp", {
          important: true,
          heldBlockers,
        });
      }
      return;
    }

    this.chatFocusRetryNextAttemptAt = now + 120;
    this.chatFocusRetryAttempts += 1;

    if (this.chatFocusRetryAttempts > 3) {
      this.clearChatFocusRecovery("attemptLimit");
      return;
    }

    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);
    this.trySetChatMenuControlsSuppressed(true, "chatFocusRecovery");
    this.sp.browser.executeJavaScript(focusChatInputEventString);

    if (this.chatFocusRetryAttempts === 1 || this.chatFocusRetryAttempts % 6 === 0) {
      this.pushChatDebugEntry("chatFocusRecoveryRetry", {
        important: true,
        attempts: this.chatFocusRetryAttempts,
        releaseKeyCode: this.chatFocusRetryReleaseKeyCode,
      });
    }
  }

  private armCursorFocusRecovery(reason: string) {
    this.cursorFocusRetryDeadline = Date.now() + 5000;
    this.cursorFocusRetryNextAttemptAt = 0;
    this.cursorFocusHeldKeysLogNextAt = 0;
    this.pushChatDebugEntry("cursorFocusRecoveryArmed", {
      important: true,
      reason,
    });
  }

  private clearCursorFocusRecovery(reason: string) {
    if (!this.cursorFocusRetryDeadline) {
      return;
    }

    this.pushChatDebugEntry("cursorFocusRecoveryCleared", {
      important: true,
      reason,
    });
    this.cursorFocusRetryDeadline = 0;
    this.cursorFocusRetryNextAttemptAt = 0;
    this.cursorFocusHeldKeysLogNextAt = 0;
  }

  private retryCursorFocusIfNeeded() {
    if (!this.manualCursorMode || this.chatRequestedVisible || this.badMenusOpen.size !== 0) {
      this.clearCursorFocusRecovery("notNeeded");
      return;
    }

    if (!this.cursorFocusRetryDeadline) {
      return;
    }

    if (this.sp.browser.isFocused()) {
      this.clearCursorFocusRecovery("focused");
      return;
    }

    const now = Date.now();
    if (now > this.cursorFocusRetryDeadline) {
      this.clearCursorFocusRecovery("timedOut");
      return;
    }

    if (now < this.cursorFocusRetryNextAttemptAt) {
      return;
    }

    const heldBlockers = this.getBrowserFocusHeldBlockers(CURSOR_FOCUS_BLOCKER_KEYS);
    if (heldBlockers.length !== 0) {
      this.cursorFocusRetryNextAttemptAt = now + 80;
      if (now >= this.cursorFocusHeldKeysLogNextAt) {
        this.cursorFocusHeldKeysLogNextAt = now + 600;
        this.pushChatDebugEntry("cursorFocusWaitingForKeyUp", {
          important: true,
          heldBlockers,
        });
      }
      return;
    }

    this.cursorFocusRetryNextAttemptAt = now + 120;
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);
    this.trySetChatMenuControlsSuppressed(true, "cursorFocusRecovery");
  }

  private badMenusOpen = new Set<string>();
  private readonly chatDebugPluginName = "skrp-blackbox";
  private readonly chatDebugEntryLimit = 360;
  private chatDebugEntries: Array<Record<string, unknown>> = [];
  private chatDebugSeq = 0;
  private lastChatDebugPersistAt = 0;
  private lastBlackBoxRepeatKeyLogAt = 0;
  private lastBlackBoxStateSampleAt = 0;
  private lastBlackBoxSampledBrowserVisible: unknown = undefined;
  private lastBlackBoxSampledBrowserFocused: unknown = undefined;
  private gracefulDisconnectSent = false;
  private serverInitiatedQuitSeen = false;
  private gameplayUiVisible = false;
  private chatMenuControlsSuppressed = false;
  private pendingChatMenuControlsSuppressed: boolean | null = null;
  private pendingChatMenuControlsReason = "";
  private chatRequestedVisible = false;
  private adminPanelVisible = false;
  private disconnectNoticeVisible = false;
  private chatFocusRetryDeadline = 0;
  private chatFocusRetryNextAttemptAt = 0;
  private chatFocusRetryAttempts = 0;
  private chatFocusRetryReleaseKeyCode: DxScanCode | DxScanCode[] | undefined = undefined;
  private chatInputFocusConfirmedAt = 0;
  private chatNativeInputGuardUntil = 0;
  private chatOpeningSuppressedKeyCodes = new Set<DxScanCode>();
  private chatFocusHeldKeysLogNextAt = 0;
  private chatOpenCooldownUntil = 0;
  private chatOpenHotkeyLockoutUntil = 0;
  private lastChatOpenBindingEventAt = 0;
  private lastChatMovementKeyEventAt = 0;
  private chatOpenButtonBurstStartedAt = 0;
  private chatOpenButtonBurstCount = 0;
  private manualCursorMode = false;
  private cursorFocusRetryDeadline = 0;
  private cursorFocusRetryNextAttemptAt = 0;
  private cursorFocusHeldKeysLogNextAt = 0;
  private playerControlsRecoveryUntil = 0;
  private lastChatOpenAt = 0;
  private lastNativeInputSuppressedLogAt = 0;
  private isProcessingUpdate = false;
  private readonly gameplayBrowserUrl = "file:///Data/Platform/UI/ui.html?v=skyrim-unbound-ui-20260422-10";
  private readonly startupBrowserUrl = "file:///Data/Platform/UI/startup.html?v=skyrim-unbound-startup-20260422-10";

  private pushChatDebugEntry(event: string, details?: Record<string, unknown>) {
    const now = Date.now();
    const sanitizedDetails = this.sanitizeDebugValue(details || {}) as Record<string, unknown>;
    const important = sanitizedDetails.important === true;

    this.chatDebugEntries.push({
      seq: ++this.chatDebugSeq,
      at: new Date(now).toISOString(),
      event,
      details: sanitizedDetails,
      state: this.collectBlackBoxState(),
    });

    while (this.chatDebugEntries.length > this.chatDebugEntryLimit) {
      this.chatDebugEntries.shift();
    }

    if (important || now - this.lastChatDebugPersistAt >= 1000) {
      this.persistChatDebugState();
    }
  }

  private persistChatDebugState() {
    this.lastChatDebugPersistAt = Date.now();

    try {
      const snapshot = {
        version: 2,
        at: new Date().toISOString(),
        source: "skymp5-client BrowserService",
        note: "Sensitive string fields are redacted. Screenshots are captured only by the optional external recorder.",
        state: this.collectBlackBoxState(),
        entries: this.chatDebugEntries,
      };
      this.sp.writePlugin(
        this.chatDebugPluginName,
        `// ${JSON.stringify(snapshot, null, 2)}`,
        // @ts-expect-error Skyrim Platform runtime API supports overrideFolder.
        "PluginsNoLoad",
      );
    } catch (error) {
      try {
        this.sp.printConsole(`[skrp-blackbox] persist failed: ${error}`);
      } catch (printError) {}
    }
  }

  private sampleBlackBoxStateIfNeeded() {
    const now = Date.now();
    const browserState = this.getBrowserDebugState();
    const browserStateChanged = browserState.visible !== this.lastBlackBoxSampledBrowserVisible
      || browserState.focused !== this.lastBlackBoxSampledBrowserFocused;

    if (!browserStateChanged && now - this.lastBlackBoxStateSampleAt < 1000) {
      return;
    }

    const shouldSample = this.chatRequestedVisible
      || this.adminPanelVisible
      || this.manualCursorMode
      || this.chatMenuControlsSuppressed
      || this.badMenusOpen.size !== 0
      || browserState.visible === true
      || browserState.focused === true
      || browserStateChanged;

    if (!shouldSample) {
      return;
    }

    this.lastBlackBoxStateSampleAt = now;
    this.lastBlackBoxSampledBrowserVisible = browserState.visible;
    this.lastBlackBoxSampledBrowserFocused = browserState.focused;
    this.pushChatDebugEntry("stateSample", {
      important: browserStateChanged,
      browserStateChanged,
    });
  }

  private pushButtonDebugEntry(e: ButtonEvent) {
    const now = Date.now();
    const rawEvent = e as any;
    const isRepeating = rawEvent.isRepeating === true;

    if (isRepeating && now - this.lastBlackBoxRepeatKeyLogAt < 250) {
      return;
    }
    if (isRepeating) {
      this.lastBlackBoxRepeatKeyLogAt = now;
    }

    this.pushChatDebugEntry("buttonEvent", {
      important: false,
      code: e.code,
      key: this.getDxScanCodeName(e.code),
      userEventName: this.sanitizeScalarDebugValue(rawEvent.userEventName),
      device: this.sanitizeScalarDebugValue(rawEvent.device),
      value: this.sanitizeScalarDebugValue(rawEvent.value),
      heldDuration: this.sanitizeScalarDebugValue(rawEvent.heldDuration),
      isRepeating,
      isDown: this.getButtonEventPhase(e, "isDown"),
      isUp: this.getButtonEventPhase(e, "isUp"),
      isPressed: this.getButtonEventPhase(e, "isPressed"),
      isHeld: this.getButtonEventPhase(e, "isHeld"),
    });
  }

  private getButtonEventPhase(e: ButtonEvent, propertyName: string) {
    const rawEvent = e as any;
    const value = rawEvent[propertyName];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "function") {
      try {
        return value.call(e, [e.code]);
      } catch (error) {
        return `error:${error}`;
      }
    }

    return undefined;
  }

  private collectBlackBoxState() {
    return {
      connected: this.getConnectedDebugState(),
      browser: this.getBrowserDebugState(),
      ui: {
        gameplayUiVisible: this.gameplayUiVisible,
        chatRequestedVisible: this.chatRequestedVisible,
        adminPanelVisible: this.adminPanelVisible,
        manualCursorMode: this.manualCursorMode,
        disconnectNoticeVisible: this.disconnectNoticeVisible,
        chatMenuControlsSuppressed: this.chatMenuControlsSuppressed,
        badMenusOpen: Array.from(this.badMenusOpen.values()),
        chatFocusRetryDeadline: this.chatFocusRetryDeadline,
        cursorFocusRetryDeadline: this.cursorFocusRetryDeadline,
        chatFocusRetryAttempts: this.chatFocusRetryAttempts,
        chatInputFocusConfirmedAt: this.chatInputFocusConfirmedAt,
        chatNativeInputGuardUntil: this.chatNativeInputGuardUntil,
        lastChatOpenAt: this.lastChatOpenAt,
        chatOpenCooldownUntil: this.chatOpenCooldownUntil,
        chatOpenHotkeyLockoutUntil: this.chatOpenHotkeyLockoutUntil,
        lastChatOpenBindingEventAt: this.lastChatOpenBindingEventAt,
        lastChatMovementKeyEventAt: this.lastChatMovementKeyEventAt,
        chatOpenButtonBurstCount: this.chatOpenButtonBurstCount,
        playerControlsRecoveryUntil: this.playerControlsRecoveryUntil,
      },
      keys: this.getKeyDebugState(),
    };
  }

  private getConnectedDebugState() {
    try {
      return this.controller.lookupListener(NetworkingService).isConnected();
    } catch (error) {
      return `error:${error}`;
    }
  }

  private getBrowserDebugState() {
    const state: Record<string, unknown> = {};

    try {
      state.visible = this.sp.browser.isVisible();
    } catch (error) {
      state.visible = `error:${error}`;
    }

    try {
      state.focused = this.sp.browser.isFocused();
    } catch (error) {
      state.focused = `error:${error}`;
    }

    return state;
  }

  private getKeyDebugState() {
    const watchedKeys: Array<{ name: string; code: DxScanCode }> = [
      { name: "W", code: DxScanCode.W },
      { name: "A", code: DxScanCode.A },
      { name: "S", code: DxScanCode.S },
      { name: "D", code: DxScanCode.D },
      { name: "G", code: DxScanCode.G },
      { name: "T", code: DxScanCode.T },
      { name: "N4", code: DxScanCode.N4 },
      { name: "Num4", code: DxScanCode.Num4 },
      { name: "F3", code: DxScanCode.F3 },
      { name: "F4", code: DxScanCode.F4 },
      { name: "Enter", code: DxScanCode.Enter },
      { name: "NumEnter", code: DxScanCode.NumEnter },
      { name: "Escape", code: DxScanCode.Escape },
      { name: "Backspace", code: DxScanCode.Backspace },
      { name: "ForwardSlash", code: DxScanCode.ForwardSlash },
      { name: "Spacebar", code: DxScanCode.Spacebar },
      { name: "LeftShift", code: DxScanCode.LeftShift },
      { name: "RightShift", code: DxScanCode.RightShift },
      { name: "LeftAlt", code: DxScanCode.LeftAlt },
      { name: "RightAlt", code: DxScanCode.RightAlt },
      { name: "LeftControl", code: DxScanCode.LeftControl },
      { name: "RightControl", code: DxScanCode.RightControl },
    ];
    const result: Record<string, unknown> = {};

    watchedKeys.forEach((key) => {
      try {
        result[key.name] = this.sp.Input.isKeyPressed(key.code);
      } catch (error) {
        result[key.name] = `error:${error}`;
      }
    });

    return result;
  }

  private sanitizeDebugValue(value: unknown, key = "", depth = 0): unknown {
    const lowerKey = key.toLowerCase();
    if (lowerKey.indexOf("password") !== -1
      || lowerKey.indexOf("token") !== -1
      || lowerKey.indexOf("secret") !== -1
      || lowerKey.indexOf("auth") !== -1
      || lowerKey === "text"
      || lowerKey === "preview"
      || lowerKey === "raw"
      || lowerKey.indexOf("content") !== -1
      || lowerKey.indexOf("body") !== -1
      || lowerKey.indexOf("login") !== -1) {
      if (typeof value === "string") {
        return `[redacted:${value.length}]`;
      }
      return "[redacted]";
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === "string") {
      return value.length > 160 ? `${value.slice(0, 80)}...[len=${value.length}]` : value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return value;
    }

    if (depth >= 4) {
      return "[truncated]";
    }

    if (Array.isArray(value)) {
      return value.slice(0, 32).map((item) => this.sanitizeDebugValue(item, key, depth + 1));
    }

    if (typeof value === "object") {
      const result: Record<string, unknown> = {};
      Object.keys(value as Record<string, unknown>).slice(0, 40).forEach((childKey) => {
        result[childKey] = this.sanitizeDebugValue((value as Record<string, unknown>)[childKey], childKey, depth + 1);
      });
      return result;
    }

    return `${value}`;
  }

  private sanitizeScalarDebugValue(value: unknown) {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return value;
    }
    return `${value}`;
  }

  private getDxScanCodeName(code: DxScanCode) {
    const namesByCode: Record<number, string> = {
      [DxScanCode.Escape]: "Escape",
      [DxScanCode.W]: "W",
      [DxScanCode.A]: "A",
      [DxScanCode.S]: "S",
      [DxScanCode.D]: "D",
      [DxScanCode.G]: "G",
      [DxScanCode.T]: "T",
      [DxScanCode.N1]: "N1",
      [DxScanCode.N2]: "N2",
      [DxScanCode.N3]: "N3",
      [DxScanCode.N4]: "N4",
      [DxScanCode.N5]: "N5",
      [DxScanCode.N6]: "N6",
      [DxScanCode.N7]: "N7",
      [DxScanCode.N8]: "N8",
      [DxScanCode.N9]: "N9",
      [DxScanCode.N0]: "N0",
      [DxScanCode.F3]: "F3",
      [DxScanCode.F4]: "F4",
      [DxScanCode.Enter]: "Enter",
      [DxScanCode.NumEnter]: "NumEnter",
      [DxScanCode.Backspace]: "Backspace",
      [DxScanCode.Delete]: "Delete",
      [DxScanCode.ForwardSlash]: "ForwardSlash",
      [DxScanCode.Spacebar]: "Spacebar",
      [DxScanCode.LeftShift]: "LeftShift",
      [DxScanCode.RightShift]: "RightShift",
      [DxScanCode.LeftAlt]: "LeftAlt",
      [DxScanCode.RightAlt]: "RightAlt",
      [DxScanCode.LeftControl]: "LeftControl",
      [DxScanCode.RightControl]: "RightControl",
      [DxScanCode.NumPlus]: "NumPlus",
      [DxScanCode.Num4]: "Num4",
    };

    return namesByCode[Number(code)] || `DxScanCode:${code}`;
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
