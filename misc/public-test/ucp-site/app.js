const WHITELIST_WELCOME_STORAGE_PREFIX = "skyrim_unbound_whitelist_welcome_";
const AUTH_TABS = new Set(["login", "register", "recover"]);
const WORKSPACE_TABS = new Set(["profile", "events", "settings", "security", "record", "chatlogs", "friends"]);
const TAMRIELIC_MONTHS = [
  "Morning Star",
  "Sun's Dawn",
  "First Seed",
  "Rain's Hand",
  "Second Seed",
  "Mid Year",
  "Sun's Height",
  "Last Seed",
  "Hearthfire",
  "Frostfall",
  "Sun's Dusk",
  "Evening Star",
];

const state = {
  server: null,
  me: null,
  hub: null,
  characters: [],
  selectedCharacter: null,
  whitelist: null,
  whitelistStepIndex: 0,
  activeAuthTab: "login",
  activeTab: "profile",
  pendingLoginChallenge: null,
  recoveryChallenge: null,
  pendingTotpSetup: null,
  events: {
    month: getMonthKey(new Date()),
    items: [],
    selectedEventId: 0,
    loading: false,
    error: "",
  },
  chatlogs: {
    characterId: "",
    items: [],
    total: 0,
    hasMore: false,
    offset: 0,
    windowDays: 7,
    loading: false,
    error: "",
  },
};

const elements = {
  serverName: document.getElementById("serverName"),
  serverStatus: document.getElementById("serverStatus"),
  serverHealthPill: document.getElementById("serverHealthPill"),
  adminPanelButton: document.getElementById("adminPanelButton"),
  logoutButton: document.getElementById("logoutButton"),
  globalMessage: document.getElementById("globalMessage"),
  identityCard: document.getElementById("identityCard"),
  badgeCard: document.getElementById("badgeCard"),
  aboutCard: document.getElementById("aboutCard"),
  utilityCard: document.getElementById("utilityCard"),
  authShell: document.getElementById("authShell"),
  hubShell: document.getElementById("hubShell"),
  authTabs: document.getElementById("authTabs"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  recoverPanel: document.getElementById("recoverPanel"),
  forgotPasswordForm: document.getElementById("forgotPasswordForm"),
  securityRecoveryStartForm: document.getElementById("securityRecoveryStartForm"),
  securityRecoveryForm: document.getElementById("securityRecoveryForm"),
  securityRecoveryQuestionFields: document.getElementById("securityRecoveryQuestionFields"),
  loginChallengePanel: document.getElementById("loginChallengePanel"),
  loginChallengeForm: document.getElementById("loginChallengeForm"),
  loginChallengeCopy: document.getElementById("loginChallengeCopy"),
  loginChallengeEmailField: document.getElementById("loginChallengeEmailField"),
  loginChallengeTotpField: document.getElementById("loginChallengeTotpField"),
  cancelLoginChallengeButton: document.getElementById("cancelLoginChallengeButton"),
  authMessage: document.getElementById("authMessage"),
  whitelistShell: document.getElementById("whitelistShell"),
  whitelistNotice: document.getElementById("whitelistNotice"),
  whitelistProgress: document.getElementById("whitelistProgress"),
  whitelistMessage: document.getElementById("whitelistMessage"),
  whitelistFeedback: document.getElementById("whitelistFeedback"),
  whitelistStepForm: document.getElementById("whitelistStepForm"),
  whitelistStepTitle: document.getElementById("whitelistStepTitle"),
  whitelistStepHelp: document.getElementById("whitelistStepHelp"),
  whitelistStepPromptLabel: document.getElementById("whitelistStepPromptLabel"),
  whitelistStepValue: document.getElementById("whitelistStepValue"),
  whitelistBackButton: document.getElementById("whitelistBackButton"),
  whitelistSubmitButton: document.getElementById("whitelistSubmitButton"),
  whitelistWaitingCard: document.getElementById("whitelistWaitingCard"),
  whitelistWaitingTitle: document.getElementById("whitelistWaitingTitle"),
  whitelistWaitingCopy: document.getElementById("whitelistWaitingCopy"),
  profilePanel: document.getElementById("profilePanel"),
  eventsPanel: document.getElementById("eventsPanel"),
  settingsPanel: document.getElementById("settingsPanel"),
  securityPanel: document.getElementById("securityPanel"),
  recordPanel: document.getElementById("recordPanel"),
  chatlogsPanel: document.getElementById("chatlogsPanel"),
  friendsPanel: document.getElementById("friendsPanel"),
  profileTabs: document.getElementById("profileTabs"),
  profileStatCard: document.getElementById("profileStatCard"),
  activityStatCard: document.getElementById("activityStatCard"),
  recordStatCard: document.getElementById("recordStatCard"),
};

let registerRetryCountdownTimer = 0;

function setMessage(target, tone, message) {
  if (!target) {
    return;
  }
  target.dataset.tone = tone || "";
  target.textContent = message || "";
}

function getRegisterSubmitButton() {
  return elements.registerForm?.querySelector('button[type="submit"]') || null;
}

function setRegisterSubmitDisabled(disabled) {
  const button = getRegisterSubmitButton();
  if (button) {
    button.disabled = Boolean(disabled);
  }
}

function clearRegisterRetryCountdown() {
  if (registerRetryCountdownTimer) {
    clearInterval(registerRetryCountdownTimer);
    registerRetryCountdownTimer = 0;
  }
  setRegisterSubmitDisabled(false);
}

function formatRetryDuration(totalSeconds) {
  const secondsRemaining = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;
  const parts = [];

  if (hours) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }
  if (minutes) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }
  if (seconds || !parts.length) {
    parts.push(`${seconds} ${seconds === 1 ? "second" : "seconds"}`);
  }

  return parts.join(" ");
}

function parseRetryAfterSeconds(value) {
  if (!value) {
    return 0;
  }

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.ceil(seconds));
  }

  const retryAt = Date.parse(value);
  if (Number.isFinite(retryAt)) {
    return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
  }

  return 0;
}

function startRegisterRetryCountdown(error) {
  const retryAfterSeconds = Number(error?.retryAfterSeconds || 0);
  if (!Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return false;
  }

  clearRegisterRetryCountdown();
  const retryUntil = Date.now() + retryAfterSeconds * 1000;

  const render = () => {
    const remainingSeconds = Math.max(0, Math.ceil((retryUntil - Date.now()) / 1000));
    if (remainingSeconds <= 0) {
      clearRegisterRetryCountdown();
      setMessage(elements.authMessage, "success", "You can try creating an account now.");
      return;
    }

    setRegisterSubmitDisabled(true);
    setMessage(
      elements.authMessage,
      "error",
      `Too many registration attempts. You can try again in ${formatRetryDuration(remainingSeconds)}.`,
    );
  };

  render();
  registerRetryCountdownTimer = setInterval(render, 1000);
  return true;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getRequestedAuthTab() {
  try {
    const authTab = String(new URL(window.location.href).searchParams.get("auth") || "").trim().toLowerCase();
    return AUTH_TABS.has(authTab) ? authTab : "";
  } catch {
    return "";
  }
}

function getRequestedWorkspaceTab() {
  try {
    const tab = String(new URL(window.location.href).searchParams.get("tab") || "").trim().toLowerCase();
    return WORKSPACE_TABS.has(tab) ? tab : "";
  } catch {
    return "";
  }
}

function isLoopbackHostname(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]";
}

function syncGuestAuthUrl(mode = "replace") {
  try {
    const url = new URL(window.location.href);
    if (state.me) {
      url.searchParams.delete("auth");
    } else if (AUTH_TABS.has(state.activeAuthTab)) {
      url.searchParams.set("auth", state.activeAuthTab);
    } else {
      url.searchParams.set("auth", "register");
    }
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, document.title, url.toString());
  } catch {
    // ignore guest URL sync failures
  }
}

function syncWorkspaceUrl(mode = "replace") {
  try {
    const url = new URL(window.location.href);
    if (state.me && !state.whitelist?.gateRequired && WORKSPACE_TABS.has(state.activeTab) && state.activeTab !== "profile") {
      url.searchParams.set("tab", state.activeTab);
    } else {
      url.searchParams.delete("tab");
    }
    window.history[mode === "push" ? "pushState" : "replaceState"]({}, document.title, url.toString());
  } catch {
    // ignore workspace URL sync failures
  }
}

function getSocialPlatformKey(item) {
  const label = String(item?.label || "").toLowerCase();
  const href = String(item?.href || "").toLowerCase();
  const haystack = `${label} ${href}`;

  if (haystack.includes("discord")) {
    return "discord";
  }
  if (haystack.includes("youtube") || haystack.includes("youtu.be")) {
    return "youtube";
  }
  if (haystack.includes("forum")) {
    return "forums";
  }
  if (haystack.includes("website")) {
    return "website";
  }
  return "generic";
}

function getSocialPlatformIcon(platformKey) {
  const icons = {
    website: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm6.92 9H15.9a15.52 15.52 0 0 0-1.3-5A8.03 8.03 0 0 1 18.92 11ZM12 4.04c.95 1.12 1.92 3.28 2.35 6.96H9.65C10.08 7.32 11.05 5.16 12 4.04ZM4.08 13H7.1a15.52 15.52 0 0 0 1.3 5A8.03 8.03 0 0 1 4.08 13Zm3.02-2H4.08a8.03 8.03 0 0 1 4.32-5 15.52 15.52 0 0 0-1.3 5Zm1.55 0c.48-4.12 1.59-6.46 3.35-7.82 1.76 1.36 2.87 3.7 3.35 7.82Zm6.7 2c-.48 4.12-1.59 6.46-3.35 7.82-1.76-1.36-2.87-3.7-3.35-7.82Zm-.75 5a15.52 15.52 0 0 0 1.3-5h3.02a8.03 8.03 0 0 1-4.32 5Z" fill="currentColor"/>
      </svg>`,
    discord: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19.54 5.34A16.9 16.9 0 0 0 15.6 4l-.19.39a11.5 11.5 0 0 1 3.48 1.33 13.38 13.38 0 0 0-6.89-1.76 13.38 13.38 0 0 0-6.89 1.76 11.5 11.5 0 0 1 3.48-1.33L8.4 4a16.9 16.9 0 0 0-3.94 1.34C1.97 9.05 1.3 12.65 1.6 16.2a16.97 16.97 0 0 0 4.84 2.44l1.18-1.94a10.9 10.9 0 0 1-1.87-.9l.45-.35a12.4 12.4 0 0 0 11.6 0l.45.35a10.9 10.9 0 0 1-1.87.9l1.18 1.94a16.97 16.97 0 0 0 4.84-2.44c.36-4.11-.61-7.68-2.86-10.86ZM9.75 14.1c-.96 0-1.75-.88-1.75-1.96s.77-1.96 1.75-1.96c1 0 1.77.88 1.75 1.96 0 1.08-.77 1.96-1.75 1.96Zm4.5 0c-.96 0-1.75-.88-1.75-1.96s.77-1.96 1.75-1.96c1 0 1.77.88 1.75 1.96 0 1.08-.77 1.96-1.75 1.96Z" fill="currentColor"/>
      </svg>`,
    forums: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm2 4v2h10V8Zm0 4v2h7v-2Z" fill="currentColor"/>
      </svg>`,
    youtube: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21.58 7.19a2.96 2.96 0 0 0-2.08-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.49a2.96 2.96 0 0 0-2.08 2.1A30.82 30.82 0 0 0 2 12a30.82 30.82 0 0 0 .42 4.81 2.96 2.96 0 0 0 2.08 2.1c1.8.49 7.5.49 7.5.49s5.7 0 7.5-.49a2.96 2.96 0 0 0 2.08-2.1A30.82 30.82 0 0 0 22 12a30.82 30.82 0 0 0-.42-4.81ZM10 15.47V8.53L16 12Z" fill="currentColor"/>
      </svg>`,
    generic: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5a1.5 1.5 0 0 1 1.5 1.5V11h4.5a1.5 1.5 0 0 1 0 3H13.5v4.5a1.5 1.5 0 0 1-3 0V14H6a1.5 1.5 0 0 1 0-3h4.5V6.5A1.5 1.5 0 0 1 12 5Z" fill="currentColor"/>
      </svg>`,
  };

  return icons[platformKey] || icons.generic;
}

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && payload.error
        ? payload.error
        : `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("Retry-After"));
    throw error;
  }

  return payload;
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function formatDateShort(value) {
  if (!value) {
    return "N/A";
  }
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value);
  }
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonthKey(monthKey, amount) {
  const [yearText, monthText] = String(monthKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const shifted = new Date(year, month - 1 + amount, 1);
  return getMonthKey(shifted);
}

function getTamrielicMonthName(month) {
  return TAMRIELIC_MONTHS[month - 1] || "";
}

function getMonthLabel(monthKey) {
  const [yearText, monthText] = String(monthKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const monthName = getTamrielicMonthName(month);
  if (!monthName || !year) {
    return String(monthKey || "");
  }

  return `${monthName} ${year}`;
}

function getDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getLocalDateKey(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : getDateKey(date);
}

function formatEventTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatEventDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  const monthName = getTamrielicMonthName(date.getMonth() + 1);
  if (!monthName) {
    return String(value || "");
  }

  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${weekday}, ${date.getDate()} ${monthName} ${date.getFullYear()} at ${timeLabel}`;
}

function buildEventCalendarCells(monthKey) {
  const [yearText, monthText] = String(monthKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const firstOfMonth = new Date(year, month - 1, 1);
  const startDate = new Date(year, month - 1, 1 - firstOfMonth.getDay());
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    cells.push({
      date,
      dateKey: getDateKey(date),
      isCurrentMonth: date.getMonth() === month - 1,
      isToday: getDateKey(date) === getDateKey(new Date()),
    });
  }

  return cells;
}

function getEventCalendarMap(events) {
  return events.reduce((map, event) => {
    const dateKey = getLocalDateKey(event.startsAt);
    if (!dateKey) {
      return map;
    }
    if (!map.has(dateKey)) {
      map.set(dateKey, []);
    }
    map.get(dateKey).push(event);
    return map;
  }, new Map());
}

function getSelectedCommunityEvent() {
  return state.events.items.find((event) => Number(event.id) === Number(state.events.selectedEventId)) || null;
}

function getNextCommunityEvent() {
  const now = Date.now();
  return state.events.items.find((event) => {
    const startsAt = new Date(event.startsAt).getTime();
    return !Number.isNaN(startsAt) && startsAt > now && String(event.status || "").toUpperCase() !== "CANCELLED";
  }) || null;
}

function getDefaultCommunityEventId() {
  const nextEvent = getNextCommunityEvent();
  if (nextEvent) {
    return Number(nextEvent.id);
  }
  return state.events.items.length ? Number(state.events.items[0].id) : 0;
}

function getCharacterName(character) {
  const raw = String(character?.name || "").trim();
  if (!raw) {
    return `Unnamed slot ${Number(character?.slot_index || 0) || "?"}`;
  }
  return raw;
}

function getActiveChatlogCharacterId() {
  const preferred = Number(state.chatlogs.characterId || 0);
  if (preferred && state.characters.some((character) => Number(character.id) === preferred)) {
    return preferred;
  }

  const selected = Number(state.selectedCharacter?.id || 0);
  if (selected) {
    return selected;
  }

  return Number(state.characters[0]?.id || 0) || 0;
}

function formatChatKind(chatKind) {
  const normalized = String(chatKind || "").trim().toLowerCase();
  if (!normalized) {
    return "Local Chat";
  }

  const labels = {
    say: "Say",
    low: "Low",
    lower: "Lower",
    shout: "Shout",
    me: "/me",
    "me-low": "/melow",
    "me-lower": "/melower",
    do: "/do",
    my: "/my",
    ooc: "OOC",
  };

  return labels[normalized] || normalized.replace(/(^|-)([a-z])/g, (_, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
}

function renderSocialLinksCard() {
  const socials = Array.isArray(state.server?.socialLinks) ? state.server.socialLinks : [];
  const available = socials.filter((item) => item && item.href);
  if (!available.length) {
    return `
      <div class="card-title">Socials</div>
      <div class="empty-copy">Social links are not configured on this shard yet.</div>
    `;
  }

  return `
    <div class="card-title">Socials</div>
    <div class="social-link-grid">
      ${available.map((item) => `
        <a
          class="social-link social-link--${escapeHtml(getSocialPlatformKey(item))}"
          href="${escapeHtml(item.href)}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${escapeHtml(item.label)}"
          title="${escapeHtml(item.label)}"
        >
          <span class="social-link__icon" aria-hidden="true">${getSocialPlatformIcon(getSocialPlatformKey(item))}</span>
          <span class="social-link__label">${escapeHtml(item.label)}</span>
        </a>
      `).join("")}
    </div>
  `;
}

function getCommunityState() {
  return state.hub?.community || {
    forumGroups: {
      availableOptions: [],
      eligibleGroups: [],
      primaryGroupCode: null,
      primaryGroupLabel: null,
      secondaryGroupCodes: [],
      secondaryGroups: [],
      selectionEnabled: false,
    },
    discord: {
      linked: false,
      displayName: null,
      discordUserId: null,
      linkedAt: null,
      linkFlowAvailable: false,
      autoClaimPlanned: true,
      missingClaimableGroups: [],
    },
  };
}

function getForumGroupLabel(groupCode) {
  const community = getCommunityState();
  const allGroups = [
    ...(Array.isArray(community.forumGroups?.eligibleGroups) ? community.forumGroups.eligibleGroups : []),
    ...(Array.isArray(community.forumGroups?.availableOptions) ? community.forumGroups.availableOptions : []),
  ];
  return allGroups.find((group) => String(group.code || "") === String(groupCode || ""))?.label || String(groupCode || "");
}

function getSidebarBadges() {
  const staffBadges = Array.isArray(state.hub?.staff?.badges) && state.hub.staff.badges.length
    ? state.hub.staff.badges
    : ["Player"];
  const community = getCommunityState();
  const forumBadgeLabels = [];

  if (community.forumGroups?.primaryGroupCode) {
    forumBadgeLabels.push(getForumGroupLabel(community.forumGroups.primaryGroupCode));
  }

  const secondaryGroupCodes = Array.isArray(community.forumGroups?.secondaryGroupCodes)
    ? community.forumGroups.secondaryGroupCodes
    : [];
  secondaryGroupCodes.forEach((groupCode) => forumBadgeLabels.push(getForumGroupLabel(groupCode)));

  return Array.from(new Set([...forumBadgeLabels.filter(Boolean), ...staffBadges.filter(Boolean)]));
}

function isUnfinalizedCharacter(character) {
  return !String(character?.name || "").trim();
}

function resetForm(formElement) {
  if (formElement && typeof formElement.reset === "function") {
    formElement.reset();
  }
}

function clearConfirmationQueryParams(url) {
  url.searchParams.delete("confirmAction");
  url.searchParams.delete("confirmToken");
  window.history.replaceState({}, document.title, url.toString());
}

async function processConfirmationLink() {
  const url = new URL(window.location.href);
  const action = String(url.searchParams.get("confirmAction") || "").trim();
  const token = String(url.searchParams.get("confirmToken") || "").trim();
  if (!action || !token) {
    return;
  }

  try {
    await apiFetch("/ucp/api/auth/confirm-link", {
      method: "POST",
      body: {
        action,
        token,
      },
    });

    const successMessage = action === "email-change"
      ? "Confirmation accepted. Your recovery email is now updated."
      : "Confirmation accepted. Your password change is now active.";
    setMessage(elements.globalMessage, "success", successMessage);
    setMessage(elements.authMessage, "success", successMessage);
  } catch (error) {
    setMessage(elements.globalMessage, "error", error.message);
    setMessage(elements.authMessage, "error", error.message);
  } finally {
    clearConfirmationQueryParams(url);
  }
}

function renderServer() {
  if (!state.server) {
    elements.serverName.textContent = "Unified Control Panel";
    elements.serverStatus.textContent = "Backend not reachable yet.";
    elements.serverHealthPill.textContent = "Offline";
    elements.serverHealthPill.dataset.tone = "error";
    return;
  }

  elements.serverName.textContent = state.server.serverName || "Unified Control Panel";
  elements.serverStatus.textContent = state.server.ok === false ? "Backend offline" : "Persistent account hub";
  elements.serverHealthPill.textContent = state.server.ok === false ? "Offline" : "Online";
  elements.serverHealthPill.dataset.tone = state.server.ok === false ? "error" : "success";
}

function renderAuthVisibility() {
  const signedIn = !!state.me;
  const canAccessAdmin = !!state.hub?.staff?.hasAdminPanelAccess || isLoopbackHostname(window.location.hostname);
  const gateRequired = !!state.whitelist?.gateRequired;
  const challenge = state.pendingLoginChallenge;
  elements.authShell.classList.toggle("hidden", signedIn);
  elements.whitelistShell.classList.toggle("hidden", !(signedIn && gateRequired));
  elements.hubShell.classList.toggle("hidden", !signedIn || gateRequired);
  elements.logoutButton.classList.toggle("hidden", !signedIn);
  elements.adminPanelButton.classList.toggle("hidden", !(signedIn && canAccessAdmin));

  if (!signedIn) {
    elements.authTabs.classList.toggle("hidden", !!challenge);
    elements.loginChallengePanel.classList.toggle("hidden", !challenge);
    document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", !!challenge || panel.dataset.authPanel !== state.activeAuthTab);
    });
    document.querySelectorAll("[data-auth-tab]").forEach((button) => {
      button.classList.toggle("active", button.dataset.authTab === state.activeAuthTab);
    });
  }
}

async function openAdminPanelFromUcp() {
  try {
    const payload = await apiFetch("/ucp/api/admin/access-link", {
      method: "POST",
      body: {},
    });
    window.location.assign(String(payload?.url || "/admin/"));
  } catch (error) {
    setMessage(elements.globalMessage, "error", error.message || "Unable to open the admin panel right now.");
  }
}

function renderLoginChallengePanel() {
  const challenge = state.pendingLoginChallenge;
  if (!challenge) {
    elements.loginChallengeCopy.textContent = "Enter the verification steps required for this login.";
    elements.loginChallengeEmailField.classList.add("hidden");
    elements.loginChallengeTotpField.classList.add("hidden");
    return;
  }

  const parts = [];
  if (challenge.requiresEmailOtp) {
    parts.push(`Enter the 6-digit code sent to ${challenge.emailMasked || "your email"}.`);
  }
  if (challenge.requiresTotp) {
    parts.push("Enter the current 6-digit code from your authenticator app.");
  }

  elements.loginChallengeCopy.textContent = parts.join(" ");
  elements.loginChallengeEmailField.classList.toggle("hidden", !challenge.requiresEmailOtp);
  elements.loginChallengeTotpField.classList.toggle("hidden", !challenge.requiresTotp);
}

function renderRecoveryForm() {
  const challenge = state.recoveryChallenge;
  if (!challenge) {
    elements.securityRecoveryForm.classList.add("hidden");
    elements.securityRecoveryQuestionFields.innerHTML = "";
    return;
  }

  elements.securityRecoveryForm.classList.remove("hidden");
  elements.securityRecoveryQuestionFields.innerHTML = challenge.questions.map((question, index) => `
    <label class="field">
      <span>${escapeHtml(question.prompt)}</span>
      <input name="answer-${index}" type="text" autocomplete="off" required />
      <input name="questionKey-${index}" type="hidden" value="${escapeHtml(question.questionKey)}" />
    </label>
  `).join("");
}

function renderTabs() {
  const signedIn = !!state.me && !state.whitelist?.gateRequired;
  document.querySelectorAll(".workspace-tab").forEach((button) => {
    button.classList.toggle("active", signedIn && button.dataset.tab === state.activeTab);
  });
  document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
    panel.classList.toggle("active", signedIn && panel.dataset.tabPanel === state.activeTab);
  });
}

function getWhitelistQuestions() {
  return state.whitelist?.form?.questions || [];
}

function getWhitelistApplication() {
  return state.whitelist?.application || null;
}

function getWhitelistAnswer(questionKey) {
  return String(getWhitelistApplication()?.answers?.[questionKey] || "");
}

function syncWhitelistStepIndex() {
  const questions = getWhitelistQuestions();
  if (!questions.length) {
    state.whitelistStepIndex = 0;
    return;
  }
  const application = getWhitelistApplication();
  const failedQuestionKeys = Array.isArray(application?.failedQuestionKeys) ? application.failedQuestionKeys : [];
  if (application?.status === "DENIED" && failedQuestionKeys.length) {
    const failedIndex = questions.findIndex((question) => failedQuestionKeys.includes(question.questionKey));
    if (failedIndex >= 0) {
      state.whitelistStepIndex = failedIndex;
      return;
    }
  }
  const fallbackIndex = Math.max(0, Math.min(questions.length - 1, Number(getWhitelistApplication()?.currentStep || 1) - 1));
  state.whitelistStepIndex = fallbackIndex;
}

function maybeShowWhitelistWelcome() {
  if (!state.me || !state.whitelist?.approved || state.whitelist?.gateRequired) {
    return;
  }
  const applicationId = state.whitelist?.application?.id;
  if (!applicationId) {
    return;
  }
  const storageKey = `${WHITELIST_WELCOME_STORAGE_PREFIX}${state.me.account.id}`;
  const marker = String(applicationId);
  if (sessionStorage.getItem(storageKey) === marker) {
    return;
  }
  sessionStorage.setItem(storageKey, marker);
  setMessage(elements.globalMessage, "success", state.whitelist?.application?.welcomeMessage || "Welcome to Skyrim: RP. Your whitelist application has been approved.");
}

function renderWhitelistShell() {
  if (!state.me || !state.whitelist?.gateRequired) {
    elements.whitelistNotice.textContent = "";
    elements.whitelistProgress.innerHTML = "";
    elements.whitelistFeedback.innerHTML = "";
    return;
  }

  const questions = getWhitelistQuestions();
  const application = getWhitelistApplication();
  const status = String(application?.status || "DRAFT");

  const baseNotice = status === "SUBMITTED" || status === "UNDER_REVIEW"
    ? "Your whitelist application is in the review queue. Supporters or admins will approve or deny it after checking your answers."
    : status === "DENIED"
      ? "Your last application was denied. Your answers are still saved, so you can edit the failed sections and resubmit without starting over."
      : "Before you can access the rest of the UCP, you need to submit this whitelist application and be approved for Skyrim: RP.";
  const successNotice = status === "SUBMITTED" || status === "UNDER_REVIEW";
  elements.whitelistNotice.className = `notice ${successNotice ? "notice--success" : ""}`;
  elements.whitelistNotice.textContent = baseNotice;

  elements.whitelistProgress.innerHTML = questions.map((question, index) => {
    const isActive = index === state.whitelistStepIndex;
    const isComplete = !!getWhitelistAnswer(question.questionKey);
    return `
      <article class="progress-step ${isActive ? "progress-step--active" : ""} ${isComplete ? "progress-step--complete" : ""}">
        <div class="progress-step__index">Phase ${index + 1}</div>
        <div class="progress-step__label">${escapeHtml(question.prompt)}</div>
      </article>
    `;
  }).join("");

  const failedQuestionKeys = Array.isArray(application?.failedQuestionKeys) ? application.failedQuestionKeys : [];
  const feedbackBits = [];
  if (failedQuestionKeys.length) {
    const failedLabels = questions
      .filter((question) => failedQuestionKeys.includes(question.questionKey))
      .map((question) => question.prompt);
    feedbackBits.push(`
      <section class="content-card">
        <div class="card-title">Failed Sections</div>
        <div class="pill-list">${failedLabels.map((label) => `<span class="pill">${escapeHtml(label)}</span>`).join("")}</div>
      </section>
    `);
  }
  if (application?.reviewMessage) {
    feedbackBits.push(`
      <section class="content-card">
        <div class="card-title">${status === "DENIED" ? "Reviewer Message" : "Application Message"}</div>
        <div class="form-note">${escapeHtml(application.reviewMessage)}</div>
      </section>
    `);
  }
  elements.whitelistFeedback.innerHTML = feedbackBits.join("");

  const waiting = status === "SUBMITTED" || status === "UNDER_REVIEW";
  elements.whitelistWaitingCard.classList.toggle("hidden", !waiting);
  elements.whitelistStepForm.classList.toggle("hidden", waiting);

  if (waiting) {
    elements.whitelistWaitingTitle.textContent = status === "UNDER_REVIEW" ? "Application Under Review" : "Application Submitted";
    elements.whitelistWaitingCopy.textContent = application?.reviewMessage
      || "You are still locked to the whitelist queue. Once a Supporter or Admin approves your application, the rest of your UCP will unlock.";
    return;
  }

  const currentQuestion = questions[state.whitelistStepIndex] || questions[0];
  if (!currentQuestion) {
    return;
  }

  elements.whitelistStepTitle.textContent = `Phase ${state.whitelistStepIndex + 1} of ${questions.length}`;
  elements.whitelistStepHelp.textContent = currentQuestion.helpText || "Answer this phase carefully, then submit to continue.";
  elements.whitelistStepPromptLabel.textContent = currentQuestion.prompt;
  elements.whitelistStepValue.value = getWhitelistAnswer(currentQuestion.questionKey);
  elements.whitelistBackButton.disabled = state.whitelistStepIndex === 0;
  elements.whitelistSubmitButton.textContent = state.whitelistStepIndex === questions.length - 1
    ? "Submit Application"
    : "Submit Phase";
}

function renderSidebar() {
  if (!state.me) {
    elements.identityCard.innerHTML = `
      <div class="identity-card__tag">Access Locked</div>
      <div class="identity-card__name">Create an account first</div>
      <p class="identity-card__meta">The UCP opens after you create an account or sign into an existing one.</p>
    `;
    elements.badgeCard.innerHTML = `
      <div class="card-title">Badges</div>
      <div class="empty-copy">Badges and character tools unlock after account access is established.</div>
    `;
    elements.aboutCard.innerHTML = `
      <div class="card-title">About</div>
      <div class="meta-list">
        <div class="meta-row"><span>Status</span><strong>Guest</strong></div>
        <div class="meta-row"><span>Next Step</span><strong>${state.activeAuthTab === "login" ? "Sign in" : "Create account"}</strong></div>
      </div>
    `;
    elements.utilityCard.innerHTML = renderSocialLinksCard();
    return;
  }

  const roleLabel = state.hub?.staff?.primaryRoleLabel || "Player";
  const selected = state.selectedCharacter;
  const badges = getSidebarBadges();
  const whitelistState = state.whitelist?.approved
    ? "Approved"
    : state.whitelist?.gateRequired
      ? (state.whitelist?.application?.status || "Required")
      : "Bypassed";

  elements.identityCard.innerHTML = `
    <div class="identity-card__tag">${escapeHtml(roleLabel)}</div>
    <div class="identity-card__name">${escapeHtml(state.me.account.username)}</div>
    <p class="identity-card__meta">${state.whitelist?.gateRequired ? `Whitelist: ${escapeHtml(whitelistState)}` : (selected ? `Selected: ${escapeHtml(getCharacterName(selected))}` : "No character selected yet")}</p>
  `;

  elements.badgeCard.innerHTML = `
    <div class="card-title">Badges</div>
    <div class="pill-list">
      ${badges.map((badge) => `<span class="pill">${escapeHtml(badge)}</span>`).join("")}
    </div>
  `;

  elements.aboutCard.innerHTML = `
    <div class="card-title">About</div>
    <div class="meta-list">
      <div class="meta-row"><span>Account Created</span><strong>${escapeHtml(formatDateShort(state.me.account.createdAt))}</strong></div>
      <div class="meta-row"><span>Recovery Email</span><strong>${escapeHtml(state.me.account.email || "Not set")}</strong></div>
      <div class="meta-row"><span>Characters</span><strong>${escapeHtml(state.characters.length)}</strong></div>
      <div class="meta-row"><span>Whitelist</span><strong>${escapeHtml(whitelistState)}</strong></div>
    </div>
  `;

  const quickAccess = state.whitelist?.gateRequired
    ? ""
    : `
      <div class="card-title">Quick Access</div>
      <div class="action-list">
        <button class="button button--ghost button--full" type="button" data-open-tab="events">Open Events</button>
        <button class="button button--ghost button--full" type="button" data-open-tab="profile">Open Profile</button>
      </div>
    `;

  elements.utilityCard.innerHTML = `${quickAccess}${renderSocialLinksCard()}`;
}

function renderRightRail() {
  const accountAgeDays = Number(state.hub?.stats?.accountAgeDays || 0);
  const activeSessions = Number(state.hub?.security?.activeSessions || 0);
  const characterCount = Number(state.hub?.stats?.characterCount || 0);
  const record = state.hub?.serverRecord || {};
  const whitelist = state.whitelist || {};

  if (state.me && whitelist.gateRequired) {
    elements.profileStatCard.innerHTML = `
      <div class="stat-card__label">Whitelist Progress</div>
      <div class="stat-card__value">Phase ${escapeHtml(whitelist.application?.currentStep || 1)} / ${escapeHtml(whitelist.application?.totalSteps || getWhitelistQuestions().length || 4)}</div>
      <div class="stat-card__meta">${escapeHtml(whitelist.application?.status || "DRAFT")}</div>
    `;

    elements.activityStatCard.innerHTML = `
      <div class="stat-card__label">Review State</div>
      <div class="stat-card__value">${escapeHtml(whitelist.application?.latestDecision || whitelist.application?.status || "Pending")}</div>
      <div class="stat-card__meta">${escapeHtml(whitelist.application?.reviewerName || "Supporter or Admin review required")}</div>
    `;

    elements.recordStatCard.innerHTML = `
      <div class="stat-card__label">Account Activity</div>
      <div class="stat-card__value">${escapeHtml(accountAgeDays)} days</div>
      <div class="stat-card__meta">${escapeHtml(activeSessions)} active web session${activeSessions === 1 ? "" : "s"}</div>
    `;
    return;
  }

  elements.profileStatCard.innerHTML = `
    <div class="stat-card__label">Characters</div>
    <div class="stat-card__value">${escapeHtml(characterCount)} slots</div>
    <div class="stat-card__meta">${escapeHtml(state.selectedCharacter ? getCharacterName(state.selectedCharacter) : "No active slot selected")}</div>
  `;

  elements.activityStatCard.innerHTML = `
    <div class="stat-card__label">Account Activity</div>
    <div class="stat-card__value">${escapeHtml(accountAgeDays)} days</div>
    <div class="stat-card__meta">${escapeHtml(activeSessions)} active web session${activeSessions === 1 ? "" : "s"}</div>
  `;

  elements.recordStatCard.innerHTML = `
    <div class="stat-card__label">Server Record</div>
    <div class="stat-card__value">${escapeHtml(record.standing || "Good Standing")}</div>
    <div class="stat-card__meta">${escapeHtml(Number(record.warnings || 0))} warnings | ${escapeHtml(Number(record.bans || 0))} bans | ${escapeHtml(Number(record.jails || 0))} jails</div>
  `;
}

function renderTimelineMarkup() {
  const events = state.hub?.timeline || [];
  if (!events.length) {
    return `<div class="empty-copy">No timeline events yet.</div>`;
  }

  return `
    <div class="timeline-list">
      ${events.map((event) => `
    <article class="timeline-item timeline-item--${escapeHtml(event.kind || "general")}">
      <div class="timeline-item__when">${escapeHtml(formatDate(event.at))}</div>
      <div class="timeline-item__title">${escapeHtml(event.title)}</div>
      <div class="timeline-item__detail">${escapeHtml(event.detail)}</div>
    </article>
      `).join("")}
    </div>
  `;
}

function renderCharacterCards() {
  if (!state.characters.length) {
    return `<div class="empty-copy">No character slots reserved yet.</div>`;
  }

  return state.characters.map((character) => {
    const isSelected = state.selectedCharacter && Number(state.selectedCharacter.id) === Number(character.id);
    const canSelect = !isSelected;
    const characterStatus = character.last_used_at
      ? `Last used ${formatDate(character.last_used_at)}`
      : "Creation pending in game";
    return `
      <article class="character-card ${isSelected ? "character-card--selected" : ""}">
        <div class="character-card__slot">Slot ${escapeHtml(character.slot_index)}</div>
        <div class="character-card__name">${escapeHtml(getCharacterName(character))}</div>
        <div class="character-card__meta">${escapeHtml(characterStatus)}</div>
        <div class="character-card__actions">
          <button class="button button--ghost" type="button" data-select-character="${escapeHtml(character.id)}" ${canSelect ? "" : "disabled"}>
            ${isSelected ? "Selected" : "Select"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderProfilePanel() {
  if (!state.me) {
    elements.profilePanel.innerHTML = "";
    return;
  }

  elements.profilePanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Personal Information</div>
      <div class="meta-grid">
        <div class="meta-tile"><span>Username</span><strong>${escapeHtml(state.me.account.username)}</strong></div>
        <div class="meta-tile"><span>Email</span><strong>${escapeHtml(state.me.account.email || "Not set")}</strong></div>
        <div class="meta-tile"><span>Selected Character</span><strong>${escapeHtml(state.selectedCharacter ? getCharacterName(state.selectedCharacter) : "None")}</strong></div>
        <div class="meta-tile"><span>Role</span><strong>${escapeHtml(state.hub?.staff?.primaryRoleLabel || "Player")}</strong></div>
      </div>
    </section>

    <section class="content-card">
      <div class="card-title">Recent Activity</div>
      ${renderTimelineMarkup()}
    </section>

    <section class="content-card">
      <div class="card-title">Character Roster</div>
      <div class="character-grid">${renderCharacterCards()}</div>
    </section>
  `;
}

function renderSettingsPanel() {
  if (!state.me) {
    elements.settingsPanel.innerHTML = "";
    return;
  }

  const selectedNeedsName = state.selectedCharacter && isUnfinalizedCharacter(state.selectedCharacter);
  const canCreateSlot = state.characters.length < 3;

  elements.settingsPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Selected Character</div>
      <div class="meta-grid">
        <div class="meta-tile"><span>Current Slot</span><strong>${escapeHtml(state.selectedCharacter ? `Slot ${state.selectedCharacter.slot_index}` : "None")}</strong></div>
        <div class="meta-tile"><span>Name State</span><strong>${escapeHtml(selectedNeedsName ? "Needs final name" : "Ready")}</strong></div>
        <div class="meta-tile"><span>Last Used</span><strong>${escapeHtml(state.selectedCharacter?.last_used_at ? formatDate(state.selectedCharacter.last_used_at) : "Not yet entered")}</strong></div>
      </div>
      ${selectedNeedsName ? `
        <form class="inline-form inline-form--stack" id="finalizeNameForm">
          <input name="name" type="text" minlength="2" maxlength="24" placeholder="Finalize character name" required />
          <button class="button button--primary" type="submit">Finalize in UCP</button>
        </form>
      ` : `<div class="form-note">This slot is already named. You can still switch active slots from the Profile tab.</div>`}
    </section>

    <section class="content-card">
      <div class="card-title">Reserve New Slot</div>
      <div class="split-row">
        <div class="form-note">${canCreateSlot ? "Reserve an empty persistent slot here, then finish race and appearance on first join." : "All three persistent slots are already reserved."}</div>
        <button class="button button--ghost" id="createSlotButton" type="button" ${canCreateSlot ? "" : "disabled"}>Create slot</button>
      </div>
    </section>
  `;
}

function renderSecurityPanel() {
  if (!state.me) {
    elements.securityPanel.innerHTML = "";
    return;
  }

  const security = state.hub?.security || {};
  const sessionExpiresAt = security.sessionExpiresAt ? formatDate(security.sessionExpiresAt) : "Unknown";
  const recoveryReady = security.passwordRecoveryEnabled && security.hasRecoveryEmail;
  const questionOptions = Array.isArray(security.questionOptions) ? security.questionOptions : [];
  const configuredQuestions = Array.isArray(security.configuredQuestions) ? security.configuredQuestions : [];
  const questionRows = [0, 1, 2].map((index) => configuredQuestions[index] || { slotIndex: index + 1, questionKey: "" });
  const pendingTotpSetup = state.pendingTotpSetup;

  elements.securityPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Session State</div>
      <div class="meta-grid">
        <div class="meta-tile"><span>Current Session</span><strong>Active</strong></div>
        <div class="meta-tile"><span>Expires</span><strong>${escapeHtml(sessionExpiresAt)}</strong></div>
        <div class="meta-tile"><span>Active Sessions</span><strong>${escapeHtml(security.activeSessions || 0)}</strong></div>
        <div class="meta-tile"><span>Trusted IPs</span><strong>${escapeHtml(security.trustedLocationCount || 0)}</strong></div>
      </div>
    </section>

    <section class="content-card">
      <div class="card-title">Password Recovery</div>
      <div class="notice ${recoveryReady ? "notice--success" : "notice--warn"}">
        ${escapeHtml(recoveryReady
          ? "Recovery email is configured. If you ever lose access, use the forgot-password flow from the sign-in screen."
          : "Recovery is not fully ready yet. Add a recovery email and make sure password recovery mail is configured on the server.")}
      </div>
    </section>

    <section class="content-card">
      <div class="card-title">Recovery Email</div>
      <div class="form-note">Use your current password, then confirm the request from the link sent to the new email address before it becomes active.</div>
      <form class="inline-form" id="updateEmailForm" autocomplete="off">
        <input name="email" type="email" value="${escapeHtml(state.me.account.email || "")}" placeholder="name@example.com" required />
        <input name="currentPassword" type="password" placeholder="Current password" required />
        <button class="button button--primary" type="submit">Send confirmation link</button>
      </form>
    </section>

    <section class="content-card">
      <div class="card-title">New IP Email OTP</div>
      <div class="notice ${security.emailOtpAvailable ? "notice--success" : "notice--warn"}">
        ${escapeHtml(
          security.emailOtpAvailable
            ? "When this is enabled, logins from a new IP address will require a 6-digit email code that expires after 15 minutes."
            : "Email OTP needs a recovery email and working SMTP settings before it can protect new-IP logins."
        )}
      </div>
      <form class="inline-form" id="emailOtpToggleForm">
        <label class="field field--inline">
          <span>Email OTP on new IP</span>
          <select name="emailOtpOnNewIp">
            <option value="1" ${security.emailOtpOnNewIp ? "selected" : ""}>Enabled</option>
            <option value="0" ${!security.emailOtpOnNewIp ? "selected" : ""}>Disabled</option>
          </select>
        </label>
        <button class="button button--ghost" type="submit">Save policy</button>
      </form>
    </section>

    <section class="content-card">
      <div class="card-title">Security Questions</div>
      <div class="form-note">Pick three different questions and answers. These can be used to recover the account later if you lose access to email.</div>
      <form class="panel-stack" id="securityQuestionsForm" autocomplete="off">
        ${questionRows.map((question, index) => `
          <div class="meta-grid meta-grid--security">
            <label class="field">
              <span>Question ${index + 1}</span>
              <select name="questionKey-${index}" required>
                <option value="">Choose a question</option>
                ${questionOptions.map((option) => `
                  <option value="${escapeHtml(option.key)}" ${option.key === question.questionKey ? "selected" : ""}>${escapeHtml(option.prompt)}</option>
                `).join("")}
              </select>
            </label>
            <label class="field">
              <span>Answer ${index + 1}</span>
              <input name="answer-${index}" type="text" autocomplete="off" required />
            </label>
          </div>
        `).join("")}
        <div class="inline-form">
          <input name="currentPassword" type="password" placeholder="Current password" required />
          <button class="button button--primary" type="submit">${security.securityQuestionsConfigured ? "Update questions" : "Save questions"}</button>
        </div>
      </form>
    </section>

    <section class="content-card">
      <div class="card-title">Change Password</div>
      <div class="form-note">Use at least 8 characters. A confirmation link will be sent to your recovery email, and the password only changes after that link is accepted.</div>
      <form class="inline-form" id="updatePasswordForm" autocomplete="off">
        <input name="currentPassword" type="password" placeholder="Current password" required />
        <input name="newPassword" type="password" minlength="8" maxlength="128" placeholder="New password" required />
        <input name="confirmPassword" type="password" minlength="8" maxlength="128" placeholder="Confirm new password" required />
        <button class="button button--primary" type="submit">Send password link</button>
      </form>
    </section>

    <section class="content-card">
      <div class="card-title">Authenticator 2FA</div>
      <div class="notice ${security.totpEnabled ? "notice--success" : "notice--warn"}">
        ${escapeHtml(
          security.totpEnabled
            ? "Authenticator 2FA is enabled. Every login will also require your 6-digit app code."
            : "Authenticator 2FA is not enabled yet. You can set it up with any TOTP-compatible authenticator app."
        )}
      </div>
      ${pendingTotpSetup ? `
        <div class="meta-grid meta-grid--security">
          <div class="meta-tile"><span>Manual Secret</span><strong>${escapeHtml(pendingTotpSetup.secretBase32)}</strong></div>
          <div class="meta-tile"><span>Expires</span><strong>${escapeHtml(formatDate(pendingTotpSetup.expiresAt))}</strong></div>
        </div>
        <div class="form-note">If your authenticator app supports manual setup, use issuer <strong>Skyrim Unbound</strong> and account <strong>${escapeHtml(pendingTotpSetup.accountLabel)}</strong>.</div>
        <form class="inline-form" id="enableTotpForm" autocomplete="off">
          <input name="code" type="text" inputmode="numeric" maxlength="6" placeholder="6-digit authenticator code" required />
          <button class="button button--primary" type="submit">Enable 2FA</button>
          <button class="button button--ghost" id="cancelTotpSetupButton" type="button">Cancel setup</button>
        </form>
      ` : security.totpEnabled ? `
        <form class="inline-form" id="disableTotpForm" autocomplete="off">
          <input name="currentPassword" type="password" placeholder="Current password" required />
          <input name="code" type="text" inputmode="numeric" maxlength="6" placeholder="Current authenticator code" required />
          <button class="button button--ghost" type="submit">Disable 2FA</button>
        </form>
      ` : `
        <form class="inline-form" id="beginTotpSetupForm" autocomplete="off">
          <input name="currentPassword" type="password" placeholder="Current password" required />
          <button class="button button--primary" type="submit">Begin 2FA setup</button>
        </form>
      `}
    </section>
  `;
}

function renderRecordPanel() {
  if (!state.me) {
    elements.recordPanel.innerHTML = "";
    return;
  }

  const record = state.hub?.serverRecord || {};
  const tickets = state.hub?.tickets || {};
  const applications = state.hub?.applications || {};
  const recentRecord = record.recent || [];

  elements.recordPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Standing</div>
      <div class="record-strip">
        <div class="record-metric"><span>Standing</span><strong>${escapeHtml(record.standing || "Good Standing")}</strong></div>
        <div class="record-metric"><span>Warnings</span><strong>${escapeHtml(record.warnings || 0)}</strong></div>
        <div class="record-metric"><span>Jails</span><strong>${escapeHtml(record.jails || 0)}</strong></div>
        <div class="record-metric"><span>Bans</span><strong>${escapeHtml(record.bans || 0)}</strong></div>
        <div class="record-metric"><span>Active</span><strong>${escapeHtml(record.active || 0)}</strong></div>
      </div>
      <div class="form-note">Last record update: ${escapeHtml(formatDate(record.lastActionAt))}</div>
    </section>

    <section class="content-card">
      <div class="card-title">Support & Applications</div>
      <div class="meta-grid">
        <div class="meta-tile"><span>Open Tickets</span><strong>${escapeHtml((tickets.open || 0) + (tickets.waitingStaff || 0) + (tickets.waitingPlayer || 0))}</strong></div>
        <div class="meta-tile"><span>Closed Tickets</span><strong>${escapeHtml(tickets.closed || 0)}</strong></div>
        <div class="meta-tile"><span>Submitted Apps</span><strong>${escapeHtml(applications.submitted || 0)}</strong></div>
        <div class="meta-tile"><span>Approved Apps</span><strong>${escapeHtml(applications.approved || 0)}</strong></div>
      </div>
    </section>

    <section class="content-card">
      <div class="card-title">Recent Record Entries</div>
      ${recentRecord.length ? `
        <div class="record-list">
          ${recentRecord.map((entry) => `
            <article class="list-row">
              <div>
                <strong>${escapeHtml(entry.type || "Record")}</strong>
                <div class="list-row__meta">${escapeHtml(entry.reasonPublic || entry.status || "Server record updated")}</div>
              </div>
              <span>${escapeHtml(formatDate(entry.issuedAt))}</span>
            </article>
          `).join("")}
        </div>
      ` : `<div class="empty-copy">No moderation entries are attached to this account yet.</div>`}
    </section>
  `;
}

function renderChatlogsPanel() {
  if (!state.me) {
    elements.chatlogsPanel.innerHTML = "";
    return;
  }

  const activeCharacterId = getActiveChatlogCharacterId();
  const characterOptions = state.characters.map((character) => `
    <option value="${escapeHtml(character.id)}" ${Number(character.id) === Number(activeCharacterId) ? "selected" : ""}>${escapeHtml(getCharacterName(character))}</option>
  `).join("");
  const chatlogs = state.chatlogs || {};

  if (!state.characters.length) {
    elements.chatlogsPanel.innerHTML = `
      <section class="content-card">
        <div class="card-title">No Character Slots</div>
        <div class="empty-copy">Reserve at least one persistent character slot before opening personal chat history.</div>
      </section>
    `;
    return;
  }

  const entriesMarkup = chatlogs.items?.length
    ? `
      <div class="chatlog-list">
        ${chatlogs.items.map((entry) => `
          <article class="chatlog-entry">
            <div class="chatlog-entry__meta">
              <strong>${escapeHtml(formatDate(entry.witnessedAt))}</strong>
              <span>${escapeHtml(formatChatKind(entry.chatKind))} · ${escapeHtml(entry.radius || 0)} radius${entry.world ? ` · ${escapeHtml(entry.world)}` : ""}</span>
            </div>
            <div class="chatlog-entry__message">${escapeHtml(entry.message)}</div>
          </article>
        `).join("")}
      </div>
    `
    : `<div class="empty-copy">${chatlogs.loading ? "Loading witnessed chat..." : "No witnessed chat entries were found for this character in the last 7 days."}</div>`;

  elements.chatlogsPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Witnessed Chat History</div>
      <div class="form-note">This view only shows the last ${escapeHtml(chatlogs.windowDays || 7)} days of messages that the selected character actually witnessed inside local chat radius.</div>
      <div class="inline-form">
        <label class="field field--inline">
          <span>Character</span>
          <select id="chatlogCharacterSelect">
            ${characterOptions}
          </select>
        </label>
        <button class="button button--ghost" id="refreshChatlogsButton" type="button">Refresh</button>
      </div>
      ${chatlogs.error ? `<div class="message-box" data-tone="error">${escapeHtml(chatlogs.error)}</div>` : ""}
      <div class="form-note">Showing ${escapeHtml(chatlogs.items?.length || 0)} of ${escapeHtml(chatlogs.total || 0)} retained entries.</div>
      ${entriesMarkup}
      ${chatlogs.hasMore ? `<button class="button button--ghost" id="loadOlderChatlogsButton" type="button" ${chatlogs.loading ? "disabled" : ""}>Load older entries</button>` : ""}
    </section>
  `;
}

function renderEventsPanel() {
  if (!state.me || state.whitelist?.gateRequired) {
    elements.eventsPanel.innerHTML = "";
    return;
  }

  const selectedEvent = getSelectedCommunityEvent();
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const eventMap = getEventCalendarMap(state.events.items);
  const cells = buildEventCalendarCells(state.events.month);
  const messageTone = state.events.error ? "error" : "";
  const messageText = state.events.error
    ? state.events.error
    : state.events.loading
      ? "Loading community events..."
      : state.events.items.length
        ? `${state.events.items.length} event${state.events.items.length === 1 ? "" : "s"} listed for ${getMonthLabel(state.events.month)}.`
        : `No public events are listed for ${getMonthLabel(state.events.month)} yet.`;

  let eventTitle = "Open the event ledger";
  let eventLede = "Keep an eye on the public calendar, open an entry when it matters, and mark interest so organisers can see the room a gathering is drawing.";
  let eventMeta = `
    <span class="events-hub__meta-pill">${escapeHtml(getMonthLabel(state.events.month))}</span>
    <span class="events-hub__meta-pill">${escapeHtml(state.events.items.length || 0)} listed</span>
  `;
  let eventDescription = "The events tab keeps the calendar close to your profile so you can move from account work to community gatherings without bouncing between panels.";
  let interestCount = "";
  let interestButtonMarkup = "";

  if (selectedEvent) {
    const isUpcoming = new Date(selectedEvent.startsAt).getTime() > Date.now();
    const isCancelled = String(selectedEvent.status || "").toUpperCase() === "CANCELLED";
    let interestLabel = selectedEvent.isInterested ? "Remove Interest" : "Mark Interested";
    let interestDisabled = false;

    if (isCancelled) {
      interestLabel = "Cancelled";
      interestDisabled = true;
    } else if (!isUpcoming) {
      interestLabel = "Event Started";
      interestDisabled = true;
    }

    eventTitle = selectedEvent.title || "Community event";
    eventLede = "Open entries when they matter to you, then keep your interest marked so organisers can gauge turnout before the doors open.";
    eventMeta = [
      `<span class="events-hub__meta-pill">${escapeHtml(formatEventDateTime(selectedEvent.startsAt))}</span>`,
      `<span class="events-hub__meta-pill events-hub__meta-pill--status">${escapeHtml(String(selectedEvent.status || "SCHEDULED").toUpperCase())}</span>`,
    ].join("");
    eventDescription = selectedEvent.description || "No description yet.";
    interestCount = `${Number(selectedEvent.interestCount || 0)} marked interested`;
    interestButtonMarkup = `
      <button class="button button--primary" type="button" data-events-interest ${interestDisabled ? "disabled" : ""}>
        ${escapeHtml(interestLabel)}
      </button>
    `;
  }

  elements.eventsPanel.innerHTML = `
    <section class="content-card events-hub">
      <div class="events-hub__story">
        <span class="events-hub__eyebrow">Community Events</span>
        <h3>${escapeHtml(eventTitle)}</h3>
        <p class="events-hub__lede">${escapeHtml(eventLede)}</p>
        <div class="events-hub__meta">${eventMeta}</div>
        <p class="events-hub__description">${escapeHtml(eventDescription)}</p>
        <div class="events-hub__actions">
          ${selectedEvent ? `<div class="events-hub__interest">${escapeHtml(interestCount)}</div>` : `<div class="events-hub__interest">Pick an entry to read the full details.</div>`}
          ${interestButtonMarkup}
        </div>
      </div>

      <div class="events-hub__calendar">
        <div class="events-hub__toolbar">
          <button class="button button--ghost" type="button" data-events-month="-1">Previous</button>
          <div class="events-hub__toolbar-copy">
            <strong>${escapeHtml(getMonthLabel(state.events.month))}</strong>
            <span>${escapeHtml(Intl.DateTimeFormat().resolvedOptions().timeZone || "Local browser time")}</span>
          </div>
          <button class="button button--ghost" type="button" data-events-month="1">Next</button>
        </div>

        <div class="message-box" data-tone="${escapeHtml(messageTone)}">${escapeHtml(messageText)}</div>

        <div class="events-hub__grid">
          ${weekdayLabels.map((label) => `<div class="events-hub__weekday">${escapeHtml(label)}</div>`).join("")}
          ${cells.map((cell) => {
            const events = eventMap.get(cell.dateKey) || [];
            const isSelectedDay = events.some((event) => Number(event.id) === Number(state.events.selectedEventId));

            return `
              <article class="events-hub__day ${cell.isCurrentMonth ? "" : "events-hub__day--other-month"} ${cell.isToday ? "events-hub__day--today" : ""} ${isSelectedDay ? "events-hub__day--selected" : ""}">
                <div class="events-hub__day-header">
                  <span class="events-hub__day-number">${escapeHtml(cell.date.getDate())}</span>
                  ${events.length ? `<span class="events-hub__day-count">${escapeHtml(events.length)} event${events.length === 1 ? "" : "s"}</span>` : ""}
                </div>
                <div class="events-hub__day-events">
                  ${events.map((event) => `
                    <button
                      class="events-hub__chip ${String(event.status || "").toUpperCase() === "CANCELLED" ? "events-hub__chip--cancelled" : ""} ${Number(event.id) === Number(state.events.selectedEventId) ? "events-hub__chip--selected" : ""}"
                      type="button"
                      data-event-id="${escapeHtml(event.id)}"
                    >
                      <span class="events-hub__chip-time">${escapeHtml(formatEventTime(event.startsAt))}</span>
                      <span class="events-hub__chip-title">${escapeHtml(event.title)}</span>
                    </button>
                  `).join("")}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </div>
    </section>
  `;
}

async function loadCommunityEvents(options = {}) {
  if (!state.me || state.whitelist?.gateRequired) {
    state.events = {
      ...state.events,
      items: [],
      selectedEventId: 0,
      loading: false,
      error: "",
    };
    renderEventsPanel();
    return;
  }

  state.events = {
    ...state.events,
    month: String(options.month || state.events.month),
    loading: true,
    error: "",
  };
  renderEventsPanel();

  try {
    const payload = await apiFetch(`/ucp/api/community/events?month=${encodeURIComponent(state.events.month)}&tzOffsetMinutes=${encodeURIComponent(new Date().getTimezoneOffset())}`);
    const items = Array.isArray(payload?.events) ? payload.events : [];
    const currentSelection = options.resetSelection ? 0 : Number(state.events.selectedEventId || 0);
    const nextSelection = currentSelection && items.some((event) => Number(event.id) === currentSelection)
      ? currentSelection
      : 0;

    state.events = {
      ...state.events,
      month: String(payload?.month || state.events.month),
      items,
      selectedEventId: nextSelection,
      loading: false,
      error: "",
    };

    if (!state.events.selectedEventId) {
      state.events.selectedEventId = getDefaultCommunityEventId();
    }
  } catch (error) {
    state.events = {
      ...state.events,
      items: [],
      selectedEventId: 0,
      loading: false,
      error: error.message || "Could not load community events.",
    };
  }

  renderEventsPanel();
}

async function toggleCommunityEventInterest() {
  const event = getSelectedCommunityEvent();
  if (!event) {
    return;
  }

  try {
    const payload = await apiFetch(`/ucp/api/community/events/${event.id}/interest`, {
      method: "POST",
      body: {
        interested: !event.isInterested,
      },
    });
    const updatedEvent = payload?.event || null;
    if (!updatedEvent) {
      throw new Error("The event response was incomplete");
    }

    state.events = {
      ...state.events,
      items: state.events.items.map((entry) => Number(entry.id) === Number(updatedEvent.id) ? updatedEvent : entry),
    };
    renderEventsPanel();
    setMessage(elements.globalMessage, "success", updatedEvent.isInterested ? "You marked yourself interested." : "Interest removed.");
  } catch (error) {
    if (error.status === 401) {
      await refreshMe();
      return;
    }
    renderEventsPanel();
    setMessage(elements.globalMessage, "error", error.message || "Could not update event interest.");
  }
}

function renderFriendsPanel() {
  if (!state.me) {
    elements.friendsPanel.innerHTML = "";
    return;
  }

  const community = getCommunityState();
  const forumGroups = community.forumGroups || {};
  const discord = community.discord || {};
  const eligibleGroups = Array.isArray(forumGroups.eligibleGroups) ? forumGroups.eligibleGroups : [];
  const secondaryGroups = Array.isArray(forumGroups.secondaryGroups) ? forumGroups.secondaryGroups : [];
  const missingClaimableGroups = Array.isArray(discord.missingClaimableGroups) ? discord.missingClaimableGroups : [];
  const defaultGroupCode = forumGroups.primaryGroupCode || eligibleGroups[0]?.code || "";

  elements.friendsPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Group Addition</div>
      <div class="form-note">Apply forum badge groups this account is eligible for. Donation-backed groups only appear here after the account receives the matching entitlement.</div>
      <form class="panel-stack" id="forumGroupForm">
        <label class="field">
          <span>Select Group</span>
          <select name="groupCode" ${eligibleGroups.length ? "" : "disabled"}>
            <option value="">Select Group</option>
            ${eligibleGroups.map((group) => `
              <option value="${escapeHtml(group.code)}" ${String(group.code) === String(defaultGroupCode) ? "selected" : ""}>${escapeHtml(group.label)}</option>
            `).join("")}
          </select>
        </label>
        <div class="inline-form">
          <button class="button button--primary" name="action" type="submit" value="setPrimary" ${eligibleGroups.length ? "" : "disabled"}>Set Primary</button>
          <button class="button button--ghost" name="action" type="submit" value="addSecondary" ${eligibleGroups.length ? "" : "disabled"}>Add Secondary</button>
        </div>
      </form>
      ${eligibleGroups.length ? `
        <div class="meta-grid">
          <div class="meta-tile"><span>Primary Badge</span><strong>${escapeHtml(forumGroups.primaryGroupLabel || "Not set yet")}</strong></div>
          <div class="meta-tile"><span>Secondary Badges</span><strong>${escapeHtml(secondaryGroups.length ? secondaryGroups.map((group) => group.label).join(", ") : "None applied yet")}</strong></div>
        </div>
        <div class="pill-list">
          ${eligibleGroups.map((group) => `<span class="pill">${escapeHtml(group.label)}</span>`).join("")}
        </div>
      ` : `
        <div class="empty-copy">No forum badge groups are attached to this account yet. Once this account gets a donation-backed forum entitlement, it will appear here.</div>
      `}
    </section>

    <section class="content-card">
      <div class="card-title">Discord</div>
      <div class="notice ${discord.linked ? "notice--success" : "notice--warn"}">
        ${escapeHtml(
          discord.linked
            ? `Discord is linked as ${discord.displayName || "Unknown account"}. Auto-claim can later use this link to sync eligible forum groups to Discord roles.`
            : "Discord linking is planned for later. Once it is live, this section will auto-claim matching donor/community ranks after the account is linked."
        )}
      </div>
      <div class="meta-grid">
        <div class="meta-tile"><span>Link State</span><strong>${escapeHtml(discord.linked ? "Linked" : "Not linked")}</strong></div>
        <div class="meta-tile"><span>Claimable Ranks</span><strong>${escapeHtml(missingClaimableGroups.length ? missingClaimableGroups.map((group) => group.label).join(", ") : "None waiting")}</strong></div>
      </div>
      <div class="inline-form">
        <button class="button button--ghost" id="linkDiscordButton" type="button">${discord.linked ? "Manage Discord Link" : "Link your Discord"}</button>
      </div>
      <div class="form-note">When Discord linking goes live, claimable ranks here will be driven by the same forum badge entitlements shown above.</div>
    </section>
  `;
}

function renderAll() {
  renderServer();
  renderAuthVisibility();
  renderLoginChallengePanel();
  renderRecoveryForm();
  renderTabs();
  renderSidebar();
  renderRightRail();
  renderWhitelistShell();
  renderProfilePanel();
  renderEventsPanel();
  renderSettingsPanel();
  renderSecurityPanel();
  renderRecordPanel();
  renderChatlogsPanel();
  renderFriendsPanel();
}

function clearAuthenticatedState() {
  state.me = null;
  state.hub = null;
  state.characters = [];
  state.selectedCharacter = null;
  state.whitelist = null;
  state.whitelistStepIndex = 0;
  state.pendingLoginChallenge = null;
  state.pendingTotpSetup = null;
  state.chatlogs = {
    ...state.chatlogs,
    characterId: "",
    items: [],
    total: 0,
    hasMore: false,
    offset: 0,
    error: "",
    loading: false,
  };
  state.events = {
    ...state.events,
    items: [],
    selectedEventId: 0,
    loading: false,
    error: "",
  };
}

async function refreshMe() {
  try {
    const payload = await apiFetch("/ucp/api/auth/me");
    const whitelist = await apiFetch("/ucp/api/whitelist/state");
    state.me = payload;
    state.hub = payload.profileHub || null;
    state.characters = payload.characters || [];
    state.selectedCharacter = payload.selectedCharacter || null;
    state.whitelist = whitelist || null;
    state.pendingLoginChallenge = null;
    if (payload.profileHub?.security?.totpEnabled) {
      state.pendingTotpSetup = null;
    }
    syncWhitelistStepIndex();
    const activeChatlogCharacterId = getActiveChatlogCharacterId();
    state.chatlogs = {
      ...state.chatlogs,
      characterId: activeChatlogCharacterId ? String(activeChatlogCharacterId) : "",
      error: "",
    };
    maybeShowWhitelistWelcome();
    renderAll();
    syncGuestAuthUrl();
    syncWorkspaceUrl();
    if (state.activeTab === "events" && !state.whitelist?.gateRequired) {
      await loadCommunityEvents();
    }
    if (state.activeTab === "chatlogs" && !state.whitelist?.gateRequired) {
      await loadChatlogs({ characterId: activeChatlogCharacterId });
    }
  } catch (error) {
    const status = Number(error.status || 0);
    state.activeAuthTab = getRequestedAuthTab() || (state.activeAuthTab === "register" ? "register" : "login");
    clearAuthenticatedState();
    setMessage(
      elements.authMessage,
      status === 401 ? "success" : "error",
      status === 401
        ? (state.activeAuthTab === "login"
            ? "Sign in to unlock your UCP account."
            : "Create an account first to unlock the UCP. If you already have one, switch to Log in.")
        : (error.message || "Session expired. Please log in again."),
    );
    renderAll();
    syncGuestAuthUrl();
    syncWorkspaceUrl();
  }
}

async function loadServerHealth() {
  try {
    state.server = await apiFetch("/ucp/api/health");
  } catch (error) {
    state.server = { serverName: "Unavailable", ok: false, error: error.message };
  }
  renderServer();
}

async function loadChatlogs(options = {}) {
  if (!state.me || state.whitelist?.gateRequired) {
    state.chatlogs = {
      ...state.chatlogs,
      loading: false,
      items: [],
      total: 0,
      hasMore: false,
      offset: 0,
      error: "",
    };
    renderChatlogsPanel();
    return;
  }

  const targetCharacterId = Number(options.characterId || getActiveChatlogCharacterId() || 0);
  if (!targetCharacterId) {
    state.chatlogs = {
      ...state.chatlogs,
      characterId: "",
      loading: false,
      items: [],
      total: 0,
      hasMore: false,
      offset: 0,
      error: "",
    };
    renderChatlogsPanel();
    return;
  }

  const append = options.append === true;
  const currentLength = append ? (state.chatlogs.items?.length || 0) : 0;
  state.chatlogs = {
    ...state.chatlogs,
    characterId: String(targetCharacterId),
    loading: true,
    error: "",
    ...(append ? {} : { items: [], total: 0, hasMore: false, offset: 0 }),
  };
  renderChatlogsPanel();

  try {
    const payload = await apiFetch(`/ucp/api/chatlogs?characterId=${targetCharacterId}&offset=${currentLength}&limit=100`);
    state.chatlogs = {
      ...state.chatlogs,
      characterId: String(payload.character?.id || targetCharacterId),
      items: append ? [...(state.chatlogs.items || []), ...(payload.items || [])] : (payload.items || []),
      total: Number(payload.total || 0),
      hasMore: !!payload.hasMore,
      offset: Number(payload.offset || 0),
      windowDays: Number(payload.windowDays || 7),
      loading: false,
      error: "",
    };
  } catch (error) {
    state.chatlogs = {
      ...state.chatlogs,
      loading: false,
      error: error.message || "Failed to load chat history.",
    };
  }

  renderChatlogsPanel();
}

function activateWorkspaceTab(tab, options = {}) {
  const targetTab = WORKSPACE_TABS.has(tab) ? tab : "profile";
  state.activeTab = targetTab;
  renderTabs();
  syncWorkspaceUrl(options.historyMode || "push");

  if (targetTab === "chatlogs") {
    loadChatlogs({ characterId: getActiveChatlogCharacterId() });
    return;
  }

  if (targetTab === "events") {
    if (options.force || !state.events.items.length) {
      loadCommunityEvents();
    } else {
      renderEventsPanel();
    }
  }
}

function bindAuth() {
  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeAuthTab = button.dataset.authTab || "login";
      state.recoveryChallenge = null;
      renderAuthVisibility();
      renderRecoveryForm();
      syncGuestAuthUrl("push");
      setMessage(elements.authMessage, "", "");
    });
  });

  elements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await apiFetch("/ucp/api/auth/login", {
        method: "POST",
        body: {
          login: form.get("login"),
          password: form.get("password"),
        },
      });
      if (payload.challenge) {
        state.pendingLoginChallenge = payload.challenge;
        resetForm(event.currentTarget);
        renderAll();
        setMessage(elements.authMessage, "success", "Primary password accepted. Finish the remaining sign-in verification.");
        return;
      }
      setMessage(elements.authMessage, "success", `Welcome back, ${payload.account.username}.`);
      resetForm(event.currentTarget);
      await refreshMe();
      syncGuestAuthUrl();
    } catch (error) {
      setMessage(elements.authMessage, "error", error.message);
    }
  });

  elements.loginChallengeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await apiFetch("/ucp/api/auth/login/challenge", {
        method: "POST",
        body: {
          challengeToken: state.pendingLoginChallenge?.token,
          emailOtp: form.get("emailOtp"),
          totpCode: form.get("totpCode"),
        },
      });
      state.pendingLoginChallenge = null;
      setMessage(elements.authMessage, "success", `Welcome back, ${payload.account.username}.`);
      resetForm(event.currentTarget);
      await refreshMe();
      syncGuestAuthUrl();
    } catch (error) {
      setMessage(elements.authMessage, "error", error.message);
    }
  });

  elements.cancelLoginChallengeButton.addEventListener("click", () => {
    state.pendingLoginChallenge = null;
    state.activeAuthTab = "login";
    renderAll();
    syncGuestAuthUrl();
    setMessage(elements.authMessage, "", "");
  });

  elements.registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearRegisterRetryCountdown();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await apiFetch("/ucp/api/auth/register", {
        method: "POST",
        body: {
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
        },
      });
      setMessage(elements.authMessage, "success", `Account ${payload.account.username} created successfully.`);
      resetForm(event.currentTarget);
      await refreshMe();
      syncGuestAuthUrl();
    } catch (error) {
      if (error.status === 429 && startRegisterRetryCountdown(error)) {
        return;
      }
      setMessage(elements.authMessage, "error", error.message);
    }
  });

  elements.forgotPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch("/ucp/api/auth/forgot-password", {
        method: "POST",
        body: {
          login: form.get("login"),
        },
      });
      resetForm(event.currentTarget);
      setMessage(elements.authMessage, "success", "If recovery mail is configured for that account, a reset link has been sent.");
    } catch (error) {
      setMessage(elements.authMessage, "error", error.message);
    }
  });

  elements.securityRecoveryStartForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await apiFetch("/ucp/api/auth/security-recovery/start", {
        method: "POST",
        body: {
          login: form.get("login"),
        },
      });
      state.recoveryChallenge = payload;
      renderRecoveryForm();
      setMessage(elements.authMessage, "success", "Answer your saved questions. This recovery method may require staff-enabled policy before it can reset a password.");
    } catch (error) {
      setMessage(elements.authMessage, "error", error.message);
    }
  });

  elements.securityRecoveryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (newPassword !== confirmPassword) {
      setMessage(elements.authMessage, "error", "New password and confirmation must match.");
      return;
    }

    const answers = Array.from({ length: state.recoveryChallenge?.questions?.length || 0 }, (_, index) => ({
      questionKey: form.get(`questionKey-${index}`),
      answer: form.get(`answer-${index}`),
    }));

    try {
      await apiFetch("/ucp/api/auth/security-recovery/complete", {
        method: "POST",
        body: {
          challengeToken: state.recoveryChallenge?.challengeToken,
          answers,
          newPassword,
        },
      });
      state.recoveryChallenge = null;
      state.activeAuthTab = "login";
      resetForm(event.currentTarget);
      renderAll();
      setMessage(elements.authMessage, "success", "Password reset complete. You can log in now.");
    } catch (error) {
      setMessage(elements.authMessage, "error", error.message);
    }
  });

  elements.logoutButton.addEventListener("click", async () => {
    try {
      await apiFetch("/ucp/api/auth/logout", { method: "POST" });
    } catch {
      // local logout still matters even if server-side logout fails
    }

    clearAuthenticatedState();
    state.recoveryChallenge = null;
    state.activeAuthTab = "login";
    setMessage(elements.globalMessage, "", "");
    setMessage(elements.authMessage, "success", "Logged out.");
    renderAll();
    syncGuestAuthUrl();
    syncWorkspaceUrl();
  });
}

function bindWhitelist() {
  elements.whitelistBackButton.addEventListener("click", () => {
    state.whitelistStepIndex = Math.max(0, state.whitelistStepIndex - 1);
    renderWhitelistShell();
  });

  elements.whitelistStepForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const questions = getWhitelistQuestions();
    const currentQuestion = questions[state.whitelistStepIndex];
    if (!currentQuestion) {
      return;
    }

    try {
      const submittedPhase = state.whitelistStepIndex + 1;
      const payload = await apiFetch("/ucp/api/whitelist/steps", {
        method: "POST",
        body: {
          questionKey: currentQuestion.questionKey,
          value: elements.whitelistStepValue.value,
          finalize: state.whitelistStepIndex === questions.length - 1,
        },
      });
      state.whitelist = payload;
      syncWhitelistStepIndex();
      setMessage(elements.whitelistMessage, "success", state.whitelist?.application?.status === "SUBMITTED"
        ? "Whitelist application submitted. You are now waiting on staff review."
        : `Phase ${submittedPhase} saved.`);
      renderAll();
    } catch (error) {
      setMessage(elements.whitelistMessage, "error", error.message);
    }
  });
}

function bindHub() {
  elements.adminPanelButton.addEventListener("click", async () => {
    await openAdminPanelFromUcp();
  });

  elements.profileTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) {
      return;
    }
    activateWorkspaceTab(button.dataset.tab || "profile");
  });

  elements.utilityCard.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-tab]");
    if (!button || state.whitelist?.gateRequired) {
      return;
    }
    activateWorkspaceTab(button.dataset.openTab || "profile");
  });

  elements.profilePanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-select-character]");
    if (!button) {
      return;
    }
    try {
      await apiFetch("/ucp/api/characters/select", {
        method: "POST",
        body: { characterId: Number(button.dataset.selectCharacter) },
      });
      setMessage(elements.globalMessage, "success", "Selected character updated.");
      await refreshMe();
    } catch (error) {
      setMessage(elements.globalMessage, "error", error.message);
    }
  });

  elements.settingsPanel.addEventListener("submit", async (event) => {
    const form = event.target.closest("form");
    if (!form) {
      return;
    }
    event.preventDefault();

    if (form.id === "finalizeNameForm" && state.selectedCharacter) {
      const formData = new FormData(form);
      try {
        await apiFetch("/ucp/api/characters/finalize-name", {
          method: "POST",
          body: {
            characterId: state.selectedCharacter.id,
            name: formData.get("name"),
          },
        });
        setMessage(elements.globalMessage, "success", "Character name finalized.");
        await refreshMe();
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
    }
  });

  elements.settingsPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("#createSlotButton");
    if (!button) {
      return;
    }
    try {
      await apiFetch("/ucp/api/characters", {
        method: "POST",
        body: {},
      });
      setMessage(elements.globalMessage, "success", "New character slot reserved.");
      await refreshMe();
    } catch (error) {
      setMessage(elements.globalMessage, "error", error.message);
    }
  });

  elements.securityPanel.addEventListener("submit", async (event) => {
    const form = event.target.closest("form");
    if (!form) {
      return;
    }
    event.preventDefault();

    if (form.id === "updateEmailForm") {
      const formData = new FormData(form);
      try {
        const payload = await apiFetch("/ucp/api/auth/update-email", {
          method: "POST",
          body: {
            email: formData.get("email"),
            currentPassword: formData.get("currentPassword"),
          },
        });
        setMessage(
          elements.globalMessage,
          "success",
          `Confirmation email sent to ${payload.deliveryTarget || "the new address"}. Open that link to finish updating your recovery email.`
        );
        form.querySelector('input[name="currentPassword"]').value = "";
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
      return;
    }

    if (form.id === "emailOtpToggleForm") {
      const formData = new FormData(form);
      try {
        await apiFetch("/ucp/api/auth/security-settings", {
          method: "POST",
          body: {
            emailOtpOnNewIp: formData.get("emailOtpOnNewIp"),
          },
        });
        setMessage(elements.globalMessage, "success", "New-IP email OTP policy updated.");
        await refreshMe();
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
      return;
    }

    if (form.id === "securityQuestionsForm") {
      const formData = new FormData(form);
      const questions = [0, 1, 2].map((index) => ({
        questionKey: formData.get(`questionKey-${index}`),
        answer: formData.get(`answer-${index}`),
      }));
      try {
        await apiFetch("/ucp/api/auth/security-questions", {
          method: "POST",
          body: {
            currentPassword: formData.get("currentPassword"),
            questions,
          },
        });
        setMessage(elements.globalMessage, "success", "Security questions updated.");
        resetForm(form);
        await refreshMe();
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
      return;
    }

    if (form.id === "updatePasswordForm") {
      const formData = new FormData(form);
      const newPassword = String(formData.get("newPassword") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");
      if (newPassword !== confirmPassword) {
        setMessage(elements.globalMessage, "error", "New password and confirmation must match.");
        return;
      }
      try {
        const payload = await apiFetch("/ucp/api/auth/update-password", {
          method: "POST",
          body: {
            currentPassword: formData.get("currentPassword"),
            newPassword,
          },
        });
        setMessage(
          elements.globalMessage,
          "success",
          `Password confirmation link sent to ${payload.deliveryTarget || "your recovery email"}. Open it to activate the new password.`
        );
        resetForm(form);
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
      return;
    }

    if (form.id === "beginTotpSetupForm") {
      const formData = new FormData(form);
      try {
        state.pendingTotpSetup = await apiFetch("/ucp/api/auth/2fa/setup", {
          method: "POST",
          body: {
            currentPassword: formData.get("currentPassword"),
          },
        });
        setMessage(elements.globalMessage, "success", "Authenticator setup started. Add the secret to your app and confirm with a code.");
        renderSecurityPanel();
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
      return;
    }

    if (form.id === "enableTotpForm") {
      const formData = new FormData(form);
      try {
        await apiFetch("/ucp/api/auth/2fa/enable", {
          method: "POST",
          body: {
            setupToken: state.pendingTotpSetup?.setupToken,
            code: formData.get("code"),
          },
        });
        state.pendingTotpSetup = null;
        setMessage(elements.globalMessage, "success", "Authenticator 2FA enabled.");
        await refreshMe();
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
      return;
    }

    if (form.id === "disableTotpForm") {
      const formData = new FormData(form);
      try {
        await apiFetch("/ucp/api/auth/2fa/disable", {
          method: "POST",
          body: {
            currentPassword: formData.get("currentPassword"),
            code: formData.get("code"),
          },
        });
        setMessage(elements.globalMessage, "success", "Authenticator 2FA disabled.");
        await refreshMe();
      } catch (error) {
        setMessage(elements.globalMessage, "error", error.message);
      }
    }
  });

  elements.securityPanel.addEventListener("click", (event) => {
    const button = event.target.closest("#cancelTotpSetupButton");
    if (!button) {
      return;
    }
    state.pendingTotpSetup = null;
    renderSecurityPanel();
  });

  elements.chatlogsPanel.addEventListener("change", (event) => {
    const select = event.target.closest("#chatlogCharacterSelect");
    if (!select) {
      return;
    }
    loadChatlogs({ characterId: Number(select.value || 0) });
  });

  elements.chatlogsPanel.addEventListener("click", (event) => {
    const refreshButton = event.target.closest("#refreshChatlogsButton");
    if (refreshButton) {
      loadChatlogs({ characterId: getActiveChatlogCharacterId() });
      return;
    }

    const loadOlderButton = event.target.closest("#loadOlderChatlogsButton");
    if (loadOlderButton) {
      loadChatlogs({ characterId: getActiveChatlogCharacterId(), append: true });
    }
  });

  elements.eventsPanel.addEventListener("click", async (event) => {
    const monthButton = event.target.closest("[data-events-month]");
    if (monthButton) {
      state.events = {
        ...state.events,
        month: shiftMonthKey(state.events.month, Number(monthButton.dataset.eventsMonth || 0)),
        selectedEventId: 0,
      };
      await loadCommunityEvents({ resetSelection: true });
      return;
    }

    const eventButton = event.target.closest("[data-event-id]");
    if (eventButton) {
      state.events = {
        ...state.events,
        selectedEventId: Number(eventButton.dataset.eventId || 0),
      };
      renderEventsPanel();
      return;
    }

    const interestButton = event.target.closest("[data-events-interest]");
    if (interestButton) {
      await toggleCommunityEventInterest();
    }
  });

  elements.friendsPanel.addEventListener("submit", async (event) => {
    const form = event.target.closest("form");
    if (!form || form.id !== "forumGroupForm") {
      return;
    }
    event.preventDefault();

    const formData = new FormData(form);
    const submitter = event.submitter;
    const action = submitter?.value || "";

    try {
      const payload = await apiFetch("/ucp/api/community/forum-groups", {
        method: "POST",
        body: {
          action,
          groupCode: formData.get("groupCode"),
        },
      });
      if (payload?.profileHub) {
        state.hub = payload.profileHub;
      }
      renderFriendsPanel();
      renderSidebar();
      setMessage(elements.globalMessage, "success", action === "setPrimary"
        ? "Primary forum badge updated."
        : "Secondary forum badge added.");
    } catch (error) {
      setMessage(elements.globalMessage, "error", error.message);
    }
  });

  elements.friendsPanel.addEventListener("click", (event) => {
    const linkButton = event.target.closest("#linkDiscordButton");
    if (!linkButton) {
      return;
    }
    setMessage(elements.globalMessage, "success", "Discord auto-claim is planned for a later pass. This account will use the forum badge entitlements shown here once Discord linking is enabled.");
  });
}

async function boot() {
  state.activeAuthTab = getRequestedAuthTab() || state.activeAuthTab || "register";
  state.activeTab = getRequestedWorkspaceTab() || state.activeTab || "profile";
  bindAuth();
  bindWhitelist();
  bindHub();
  renderAll();
  await loadServerHealth();
  await processConfirmationLink();
  await refreshMe();
}

boot();
