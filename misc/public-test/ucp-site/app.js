const WHITELIST_WELCOME_STORAGE_PREFIX = "skyrim_unbound_whitelist_welcome_";
const SECURITY_QUESTION_COUNT = 1;
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
  notificationsOpen: false,
  expandedUcpMenus: new Set(["quickAccess"]),
  collapsedUcpMenus: new Set(),
  activeCharacterView: "dashboard",
  events: {
    month: getMonthKey(new Date()),
    items: [],
    selectedEventId: 0,
    loading: false,
    error: "",
  },
  chatlogs: {
    characterId: "",
    month: getMonthKey(new Date()),
    day: "",
    items: [],
    total: 0,
    hasMore: false,
    offset: 0,
    windowDays: 7,
    loading: false,
    exporting: false,
    error: "",
  },
};

const elements = {
  serverName: document.getElementById("serverName"),
  serverStatus: document.getElementById("serverStatus"),
  serverHealthPill: document.getElementById("serverHealthPill"),
  topbarStats: document.getElementById("topbarStats"),
  notificationButton: document.getElementById("notificationButton"),
  notificationTray: document.getElementById("notificationTray"),
  notificationList: document.getElementById("notificationList"),
  notificationSources: document.getElementById("notificationSources"),
  notificationCount: document.getElementById("notificationCount"),
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
  profileTitle: document.getElementById("profileTitle"),
  profileSubtitle: document.getElementById("profileSubtitle"),
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

function getUcpMenuIcon(iconKey) {
  const icons = {
    characters: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12.3a4.8 4.8 0 1 0 0-9.6 4.8 4.8 0 0 0 0 9.6Z" fill="currentColor"/>
        <path d="M4 21.2v-1.7c0-3.6 3.2-6.5 7.2-6.5h1.6c4 0 7.2 2.9 7.2 6.5v1.7H4Z" fill="currentColor"/>
      </svg>`,
    factions: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.2 4.4A2.4 2.4 0 0 1 10.6 2h2.8a2.4 2.4 0 0 1 2.4 2.4v1.4H20a2 2 0 0 1 2 2v10.6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7.8a2 2 0 0 1 2-2h4.2V4.4Zm2.2 1.4h3.2V4.6a.5.5 0 0 0-.5-.5h-2.2a.5.5 0 0 0-.5.5v1.2Z" fill="currentColor"/>
        <path d="M2 11.4h20v2.4H2v-2.4Zm8.7-.2h2.6v3.2h-2.6v-3.2Z" fill="rgba(8,12,16,0.58)"/>
      </svg>`,
    myProperties: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m2.4 11.2 9.6-8 9.6 8-2 2.4-1.3-1.1v8.1H5.7v-8.1l-1.3 1.1-2-2.4Z" fill="currentColor"/>
        <path d="M10 20.6v-5.8h4v5.8h-4Z" fill="rgba(8,12,16,0.58)"/>
      </svg>`,
    properties: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3.3h14a1.7 1.7 0 0 1 1.7 1.7v16H3.3V5A1.7 1.7 0 0 1 5 3.3Z" fill="currentColor"/>
        <path d="M7.2 7h2.4v2.4H7.2V7Zm4.8 0h2.4v2.4H12V7Zm4.8 0h2.4v2.4h-2.4V7Zm-9.6 5h2.4v2.4H7.2V12Zm4.8 0h2.4v2.4H12V12Zm4.8 0h2.4v2.4h-2.4V12ZM10.4 21v-3.8h3.2V21h-3.2Z" fill="rgba(8,12,16,0.58)"/>
      </svg>`,
    reports: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.4 3.4h13.2A1.8 1.8 0 0 1 20.4 5v14a1.8 1.8 0 0 1-1.8 1.6H5.4A1.8 1.8 0 0 1 3.6 19V5a1.8 1.8 0 0 1 1.8-1.6Z" fill="currentColor"/>
        <path d="M8 8.4h8m-8 4h8m-8 4h5.6" fill="none" stroke="rgba(8,12,16,0.72)" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`,
    quickAccess: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.4 4.4h6.4v6.4H4.4V4.4Zm8.8 0h6.4v6.4h-6.4V4.4Zm-8.8 8.8h6.4v6.4H4.4v-6.4Zm8.8 0h6.4v6.4h-6.4v-6.4Z" fill="currentColor"/>
        <path d="M6.7 7.6h1.8m8.8 0h-1.8M6.7 16.4h1.8m8.8 0h-1.8" fill="none" stroke="rgba(8,12,16,0.58)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    events: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.2 4.2h13.6a1.8 1.8 0 0 1 1.8 1.8v12.2a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V6a1.8 1.8 0 0 1 1.8-1.8Z" fill="currentColor"/>
        <path d="M7.2 2.8v3.4M16.8 2.8v3.4M5.4 9h13.2M8 12.5h2.2m3.6 0H16M8 16h2.2" fill="none" stroke="rgba(8,12,16,0.68)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    settings: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 2.8 2.1.9.8 2.1 2.2.9 2.1-.8 2 3.4-1.7 1.5.3 2.4 1.7 1.5-2 3.4-2.1-.8-2.2.9-.8 2.1-2.1.9-2.1-.9-.8-2.1-2.2-.9-2.1.8-2-3.4 1.7-1.5-.3-2.4-1.7-1.5 2-3.4 2.1.8 2.2-.9.8-2.1 2.1-.9Z" fill="currentColor"/>
        <circle cx="12" cy="12" r="3.1" fill="rgba(8,12,16,0.62)"/>
      </svg>`,
    security: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.2 10h11.6a1.8 1.8 0 0 1 1.8 1.8v6.4a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8v-6.4A1.8 1.8 0 0 1 6.2 10Zm1.7-.1V7.5a4.1 4.1 0 0 1 8.2 0v2.4h-2.2V7.5a1.9 1.9 0 0 0-3.8 0v2.4H7.9Z" fill="currentColor"/>
        <path d="M12 14v2.3" fill="none" stroke="rgba(8,12,16,0.7)" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`,
    record: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3.2h9.6l3.4 3.5v14.1H6V3.2Z" fill="currentColor"/>
        <path d="M15.2 3.5v3.6h3.4M8.6 10.2h6.8m-6.8 3.5h6.8m-6.8 3.5h4.2" fill="none" stroke="rgba(8,12,16,0.68)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    chatlogs: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.2 5.2h15.6a1.8 1.8 0 0 1 1.8 1.8v8.4a1.8 1.8 0 0 1-1.8 1.8H10l-5.2 3.4v-3.4h-.6a1.8 1.8 0 0 1-1.8-1.8V7a1.8 1.8 0 0 1 1.8-1.8Z" fill="currentColor"/>
        <path d="M7 9.6h10m-10 3.6h7" fill="none" stroke="rgba(8,12,16,0.68)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    communityPages: getSocialPlatformIcon("discord"),
    legalDocuments: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.4 9.7V7a4.6 4.6 0 0 1 9.2 0v2.7h1.2a1.8 1.8 0 0 1 1.8 1.8v6.7a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8v-6.7a1.8 1.8 0 0 1 1.8-1.8h1.2Zm2.2 0h4.8V7a2.4 2.4 0 0 0-4.8 0v2.7Z" fill="currentColor"/>
        <path d="M12 14v2.2" fill="none" stroke="rgba(8,12,16,0.72)" stroke-width="1.7" stroke-linecap="round"/>
      </svg>`,
    myFactions: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7.2 3h9.6v4.2H20a1.8 1.8 0 0 1 1.8 1.8v9.2A1.8 1.8 0 0 1 20 20H4a1.8 1.8 0 0 1-1.8-1.8V9A1.8 1.8 0 0 1 4 7.2h3.2V3Z" fill="currentColor"/>
        <path d="M9.3 7.2h5.4V5H9.3v2.2Zm1.3 5.1h2.8m-1.4-1.4v2.8" fill="none" stroke="rgba(8,12,16,0.72)" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`,
    legalFactions: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.2 7.2h9.2v9.6H4.2a2 2 0 0 1-2-2V9.2a2 2 0 0 1 2-2Zm9.2 3.2h2.8l2.2 2.2h1a2.4 2.4 0 0 1 0 4.8h-6v-7Z" fill="currentColor"/>
        <path d="M6.2 12h5.2m-2.6-2.6v5.2" fill="none" stroke="rgba(8,12,16,0.72)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    illegalFactions: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.4 10.8h9.9l2.1-2.1h4.8v3.1l-3.4.7-1.6 1.8h-4.1l-.7 4H7.6l.7-4H5.9l-1.1 2H2.6v-3.1l.8-2.4Z" fill="currentColor"/>
        <path d="M14.2 9.7h2.4" fill="none" stroke="rgba(8,12,16,0.72)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    businesses: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h10.2v16H4V4Zm11.6 6.2H20V20h-4.4v-9.8Z" fill="currentColor"/>
        <path d="M6.6 7.2h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Zm5.9 2.1h1.6v1.6h-1.6v-1.6Zm-8.7 6.7v-3.6h2.6V20H7.8Z" fill="rgba(8,12,16,0.58)"/>
      </svg>`,
    requests: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.2 4h15.6v16H4.2V4Zm2.6 3.2h2v2h-2v-2Zm4.2 0h2v2h-2v-2Zm4.2 0h2v2h-2v-2Zm-8.4 4.2h2v2h-2v-2Zm4.2 0h2v2h-2v-2Zm4.2 0h2v2h-2v-2Z" fill="currentColor"/>
        <path d="M9.8 20v-4h4.4v4H9.8Z" fill="rgba(8,12,16,0.58)"/>
      </svg>`,
    mappingRequests: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 11.2a7 7 0 0 1 14 0v2.1H5v-2.1Zm-1.8 4.1h17.6v3.1H3.2v-3.1Z" fill="currentColor"/>
        <path d="M8.2 13.3v-2.2a3.8 3.8 0 0 1 7.6 0v2.2" fill="none" stroke="rgba(8,12,16,0.64)" stroke-width="1.4" stroke-linecap="round"/>
      </svg>`,
  };

  return icons[iconKey] || icons.characters;
}

function renderUcpMenu() {
  const characterOptions = [
    { label: "Dashboard", tab: "profile", characterView: "dashboard", selected: state.activeCharacterView === "dashboard" },
    ...state.characters.map((character) => ({
      label: getCharacterName(character),
      characterId: character.id,
      tab: "profile",
      characterView: "profile",
      selected: state.activeCharacterView === "profile" && state.selectedCharacter && Number(state.selectedCharacter.id) === Number(character.id),
    })),
  ];
  const quickAccessOptions = [
    { label: "Profile", tab: "profile", icon: "characters", selected: state.activeTab === "profile" },
    { label: "Events", tab: "events", icon: "events", selected: state.activeTab === "events" },
    { label: "Settings", tab: "settings", icon: "settings", selected: state.activeTab === "settings" },
    { label: "Security", tab: "security", icon: "security", selected: state.activeTab === "security" },
    { label: "Server Record", tab: "record", icon: "record", selected: state.activeTab === "record" },
    { label: "My Chatlogs", tab: "chatlogs", icon: "chatlogs", selected: state.activeTab === "chatlogs" },
    { label: "Community Pages", tab: "friends", icon: "communityPages", expandable: true, selected: state.activeTab === "friends" },
    { label: "Legal Documents", href: "/terms/", icon: "legalDocuments", expandable: true },
  ];
  const items = [
    { key: "characters", label: "Characters", active: state.activeTab === "profile", children: characterOptions },
    {
      key: "factions",
      label: "Factions",
      children: [
        { label: "My Factions", icon: "myFactions", expandable: true },
        { label: "Legal Factions", icon: "legalFactions", expandable: true },
        { label: "Illegal Factions", icon: "illegalFactions", expandable: true },
      ],
    },
    {
      key: "myProperties",
      label: "My Properties",
      children: [
        { label: "101 Occupation Avenue - Floor 3, Room 12" },
        { label: "232 Alta Street" },
      ],
    },
    {
      key: "properties",
      label: "Properties & Businesses",
      children: [
        { label: "My Businesses", icon: "businesses", expandable: true },
        { label: "Requests", icon: "requests", expandable: true },
        { label: "Mapping Requests", icon: "mappingRequests", expandable: true },
      ],
    },
    {
      key: "reports",
      label: "Reports, Appeals, and Refunds",
      active: state.activeTab === "record",
      children: [
        { label: "Refund Requests", expandable: true, tab: "record" },
        { label: "Ban Appeals", expandable: true, tab: "record" },
        { label: "Staff Reports", expandable: true, tab: "record" },
        { label: "Asset Transfers", expandable: true, tab: "record" },
      ],
    },
    ...(!state.whitelist?.gateRequired ? [{ key: "quickAccess", label: "Quick Access", children: quickAccessOptions }] : []),
  ];

  return `
    <nav class="ucp-menu" aria-label="UCP navigation">
      ${items.map((item) => {
        const isCollapsed = state.collapsedUcpMenus?.has(item.key);
        const isOpen = !isCollapsed && (item.active || state.expandedUcpMenus?.has(item.key));
        return `
          <div class="ucp-menu__group">
            <button class="ucp-menu__item${item.active ? " active" : ""}${isOpen ? " is-open" : ""}" type="button" data-ucp-menu-toggle="${escapeHtml(item.key)}" aria-expanded="${isOpen ? "true" : "false"}">
              <span class="ucp-menu__icon">${getUcpMenuIcon(item.key)}</span>
              <span class="ucp-menu__label">${escapeHtml(item.label)}</span>
              <span class="ucp-menu__chevron" aria-hidden="true"></span>
            </button>
            <div class="ucp-menu__submenu${isOpen ? " is-open" : ""}" aria-hidden="${isOpen ? "false" : "true"}"${isOpen ? "" : " inert"}>
              <div class="ucp-menu__submenu-inner">
                ${item.children.map((child) => {
                  const itemClass = `ucp-menu__subitem${child.icon ? " ucp-menu__subitem--with-icon" : ""}${child.selected ? " ucp-menu__subitem--selected" : ""}`;
                  const itemContent = `
                    ${child.icon ? `<span class="ucp-menu__subicon">${getUcpMenuIcon(child.icon)}</span>` : ""}
                    <span class="ucp-menu__sublabel" title="${escapeHtml(child.label)}">${escapeHtml(child.label)}</span>
                    ${child.expandable ? `<span class="ucp-menu__subchevron" aria-hidden="true"></span>` : ""}
                  `;

                  if (child.href) {
                    return `
                      <a class="${itemClass}" href="${escapeHtml(child.href)}"${child.target ? ` target="${escapeHtml(child.target)}" rel="noopener noreferrer"` : ""}>
                        ${itemContent}
                      </a>
                    `;
                  }

                  return `
                    <button class="${itemClass}" type="button"${child.tab ? ` data-open-tab="${escapeHtml(child.tab)}"` : ""}${child.characterView ? ` data-character-view="${escapeHtml(child.characterView)}"` : ""}${child.characterId ? ` data-select-character="${escapeHtml(child.characterId)}"` : ""}>
                      ${itemContent}
                    </button>
                  `;
                }).join("")}
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </nav>
  `;
}

function setUcpMenuExpanded(button, isOpen, options = {}) {
  if (!button) {
    return;
  }

  const submenu = button.nextElementSibling;
  button.classList.toggle("is-open", isOpen);
  button.setAttribute("aria-expanded", isOpen ? "true" : "false");

  if (!submenu?.classList?.contains("ucp-menu__submenu")) {
    return;
  }

  if (submenu._ucpMenuTransitionEnd) {
    submenu.removeEventListener("transitionend", submenu._ucpMenuTransitionEnd);
    submenu._ucpMenuTransitionEnd = null;
  }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const animate = options.animate !== false && !reduceMotion;
  const setMeasuredHeight = () => `${submenu.scrollHeight}px`;
  const getCurrentHeight = (fallbackToContent = false) => {
    const height = submenu.getBoundingClientRect().height;
    return `${height || (fallbackToContent ? submenu.scrollHeight : 0)}px`;
  };
  const finishTransition = () => {
    if (submenu._ucpMenuTransitionEnd) {
      submenu.removeEventListener("transitionend", submenu._ucpMenuTransitionEnd);
    }

    if (isOpen && submenu.classList.contains("is-open")) {
      submenu.style.height = "auto";
    } else {
      submenu.style.height = "0px";
      submenu.setAttribute("inert", "");
    }

    submenu._ucpMenuTransitionEnd = null;
  };

  if (isOpen) {
    submenu.removeAttribute("inert");
    submenu.setAttribute("aria-hidden", "false");
    submenu.style.height = getCurrentHeight();
    submenu.classList.add("is-open");

    if (!animate) {
      submenu.style.height = "auto";
      return;
    }

    submenu.getBoundingClientRect();
    submenu._ucpMenuTransitionEnd = (event) => {
      if (event.target !== submenu || event.propertyName !== "height") {
        return;
      }
      finishTransition();
    };
    submenu.addEventListener("transitionend", submenu._ucpMenuTransitionEnd);
    requestAnimationFrame(() => {
      if (!submenu.isConnected) {
        return;
      }
      submenu.style.height = setMeasuredHeight();
    });
    return;
  }

  submenu.style.height = getCurrentHeight(true);
  submenu.classList.remove("is-open");
  submenu.setAttribute("aria-hidden", "true");

  if (!animate) {
    submenu.style.height = "0px";
    submenu.setAttribute("inert", "");
    return;
  }

  submenu.getBoundingClientRect();
  submenu._ucpMenuTransitionEnd = (event) => {
    if (event.target !== submenu || event.propertyName !== "height") {
      return;
    }
    finishTransition();
  };
  submenu.addEventListener("transitionend", submenu._ucpMenuTransitionEnd);
  requestAnimationFrame(() => {
    if (!submenu.isConnected) {
      return;
    }
    submenu.style.height = "0px";
  });
}

function syncUcpMenuHeights() {
  if (!elements.aboutCard) {
    return;
  }

  elements.aboutCard.querySelectorAll("[data-ucp-menu-toggle]").forEach((button) => {
    setUcpMenuExpanded(button, button.getAttribute("aria-expanded") === "true", { animate: false });
  });
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

function formatTotalHours(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds || 0));
  return `${(seconds / 3600).toFixed(1)} HOURS`;
}

function getDateMs(value) {
  const dateMs = new Date(String(value || "")).getTime();
  return Number.isFinite(dateMs) ? dateMs : 0;
}

function formatLastOnline(value, isOnline = false) {
  if (isOnline) {
    return "Last online now";
  }

  const dateMs = getDateMs(value);
  if (!dateMs) {
    return "Last online never";
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = Math.max(0, Math.floor((Date.now() - dateMs) / dayMs));
  if (daysAgo === 0) {
    return "Last online today";
  }
  if (daysAgo === 1) {
    return "Last online 1 day ago";
  }
  return `Last online ${daysAgo} days ago`;
}

function getCharacterTotalPlaySeconds(character) {
  return Math.max(0, Number(character?.total_play_seconds || 0));
}

function isCharacterOnline(character) {
  return Boolean(String(character?.current_session_started_at || "").trim());
}

function getCharacterLastOnlineAt(character) {
  return character?.current_session_started_at || character?.last_used_at || "";
}

function getAccountTotalPlaySeconds() {
  const hubSeconds = Number(state.hub?.stats?.totalPlaySeconds);
  if (Number.isFinite(hubSeconds)) {
    return Math.max(0, hubSeconds);
  }
  return state.characters.reduce((sum, character) => sum + getCharacterTotalPlaySeconds(character), 0);
}

function getAccountLastOnlineAt() {
  const hubLastOnlineAt = String(state.hub?.stats?.lastOnlineAt || "").trim();
  if (hubLastOnlineAt) {
    return hubLastOnlineAt;
  }

  return state.characters.reduce((latest, character) => {
    const candidate = getCharacterLastOnlineAt(character);
    return getDateMs(candidate) > getDateMs(latest) ? candidate : latest;
  }, "");
}

function formatStatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function getStandingLabel(standing) {
  return String(standing || "Good Standing");
}

function getStandingClass(standing) {
  return getStandingLabel(standing).trim().toLowerCase() === "good standing"
    ? "standing-value--good"
    : "standing-value--bad";
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

function getActiveChatlogMonth() {
  const month = String(state.chatlogs.month || "").trim();
  return /^\d{4}-\d{2}$/.test(month) ? month : getMonthKey(new Date());
}

function getActiveChatlogDay() {
  const day = String(state.chatlogs.day || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

function getActiveChatlogDayOfMonth() {
  const day = getActiveChatlogDay();
  return day ? String(Number(day.slice(8, 10))) : "";
}

function getDaysInMonth(monthKey) {
  const [yearText, monthText] = String(monthKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) {
    return 31;
  }
  return new Date(year, month, 0).getDate();
}

function getChatlogDayDate(monthKey, dayOfMonthRaw) {
  const month = /^\d{4}-\d{2}$/.test(String(monthKey || "")) ? String(monthKey) : getActiveChatlogMonth();
  const dayOfMonth = Number(dayOfMonthRaw || 0);
  const daysInMonth = getDaysInMonth(month);
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > daysInMonth) {
    return "";
  }
  return `${month}-${String(dayOfMonth).padStart(2, "0")}`;
}

function getLastDateOfMonth(monthKey) {
  const [yearText, monthText] = String(monthKey || "").split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) {
    return "";
  }
  const last = new Date(year, month, 0);
  return getDateKey(last);
}

function buildChatlogQuery(options = {}) {
  const params = new URLSearchParams();
  params.set("characterId", String(options.characterId || getActiveChatlogCharacterId() || 0));
  params.set("month", String(options.month || getActiveChatlogMonth()));
  const day = options.day !== undefined ? String(options.day || "") : getActiveChatlogDay();
  if (day) {
    params.set("day", day);
  }
  if (options.offset !== undefined) {
    params.set("offset", String(options.offset));
  }
  if (options.limit !== undefined) {
    params.set("limit", String(options.limit));
  }
  params.set("tzOffsetMinutes", String(new Date().getTimezoneOffset()));
  return params.toString();
}

function getSelectedChatlogCharacter() {
  const activeCharacterId = getActiveChatlogCharacterId();
  return state.characters.find((character) => Number(character.id) === Number(activeCharacterId)) || null;
}

function getChatlogDownloadFileName(response) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  if (match && match[1]) {
    return match[1];
  }

  const character = getSelectedChatlogCharacter();
  const characterName = getCharacterName(character).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "character";
  return `chatlogs-${characterName}-${getActiveChatlogDay() || getActiveChatlogMonth()}.txt`;
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
      linkMode: null,
      linkLabel: null,
      linkUrl: null,
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

function getTopbarStatIcon(icon) {
  const icons = {
    users: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.4 11.4a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" fill="currentColor"/>
        <path d="M15.9 11.1a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z" fill="currentColor" opacity="0.82"/>
        <path d="M3.4 20.2v-1.5c0-3 2.5-5.5 5.6-5.5h.8c3.1 0 5.6 2.5 5.6 5.5v1.5H3.4Z" fill="currentColor"/>
        <path d="M14.2 20.2v-1.7c0-1.9-.8-3.7-2.1-4.9.7-.3 1.5-.4 2.3-.4h.7c3 0 5.5 2.4 5.5 5.4v1.6h-6.4Z" fill="currentColor" opacity="0.74"/>
      </svg>`,
    applications: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h8.6l3.9 4v12a1.9 1.9 0 0 1-1.9 1.9H6.5a1.9 1.9 0 0 1-1.9-1.9V5.4a1.9 1.9 0 0 1 1.9-1.9Z" fill="currentColor"/>
        <path d="M14.7 3.8v4.1h4.1" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 12h7.4M8 15.2h5.2" fill="none" stroke="rgba(255,255,255,0.92)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>`,
    horses: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.1 18.8c.5-2.6 1.7-4.8 3.6-6.6l1.5-1.4-.3-3.1 2.4 1 2.4-2.1 1.4 3.1 2.7 1.2-1.1 2.5 1.1 2.6-2.9.2-1.9 2.6h-3.3l-1.4-2.3-2 2.3H5.1Z" fill="currentColor"/>
        <path d="M9.9 7.7 7 5.4l.5 5.8" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14.9 11.4h.1" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M13.3 15.4c-1.2.3-2.2.1-3.1-.7" fill="none" stroke="rgba(255,255,255,0.72)" stroke-width="1.35" stroke-linecap="round"/>
      </svg>`,
    properties: `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3.2 11.4 8.8-7.8 8.8 7.8-1.7 2-1.2-1.1v7.6H6.1v-7.6l-1.2 1.1-1.7-2Z" fill="currentColor"/>
        <path d="M10 19.9v-5.5h4v5.5" fill="rgba(20,13,10,0.72)"/>
      </svg>`,
  };
  return icons[icon] || icons.users;
}

function renderTopbarStats() {
  if (!elements.topbarStats) {
    return;
  }

  const stats = state.server?.publicStats || {};
  const applications = stats.applications || {};
  const cards = [
    {
      tone: "blue",
      icon: "users",
      label: "Registered Users",
      value: stats.registeredUsers || 0,
    },
    {
      tone: "red",
      icon: "applications",
      label: "User Applications",
      value: applications.total || 0,
    },
    {
      tone: "teal",
      icon: "horses",
      label: "Player Horses",
      value: stats.playerHorses || 0,
    },
    {
      tone: "slate",
      icon: "properties",
      label: "Properties",
      value: stats.properties || 0,
    },
  ];

  elements.topbarStats.innerHTML = cards.map((card) => `
    <article class="ledger-stat ledger-stat--${escapeHtml(card.tone)}">
      <div class="ledger-stat__icon">${getTopbarStatIcon(card.icon)}</div>
      <div class="ledger-stat__body">
        <div class="ledger-stat__label">${escapeHtml(card.label)}</div>
        <div class="ledger-stat__value">${escapeHtml(formatStatNumber(card.value))}</div>
      </div>
    </article>
  `).join("");
}

function formatNotificationStatus(statusRaw) {
  return String(statusRaw || "")
    .trim()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function addNotification(items, item) {
  if (!item || !item.title) {
    return;
  }
  items.push({
    kind: item.kind || "system",
    label: item.label || "UCP",
    title: item.title,
    detail: item.detail || "",
    at: item.at || "",
    targetTab: item.targetTab || "",
    countable: item.countable !== false,
  });
}

function buildNotificationItems() {
  const items = [];
  if (!state.me) {
    addNotification(items, {
      kind: "system",
      label: "Account",
      title: "Account notifications",
      detail: "Ticket updates, forum reports, admin flags, request decisions, and changelogs appear after login.",
      countable: false,
    });
    return items;
  }

  const tickets = state.hub?.tickets || {};
  const recentTickets = Array.isArray(tickets.recent) ? tickets.recent : [];
  recentTickets
    .filter((ticket) => !["CLOSED", "RESOLVED"].includes(String(ticket.status || "").toUpperCase()))
    .slice(0, 2)
    .forEach((ticket) => {
      const status = String(ticket.status || "OPEN").toUpperCase();
      addNotification(items, {
        kind: "ticket",
        label: "Ticket",
        title: `Ticket #${ticket.id || "new"}`,
        detail: `${ticket.subject || "Support ticket"} - ${formatNotificationStatus(status)}`,
        at: String(ticket.updated_at || ticket.created_at || ""),
        targetTab: "record",
        countable: status === "WAITING_PLAYER" || status === "OPEN",
      });
    });

  const applications = state.hub?.applications || {};
  const recentApplications = Array.isArray(applications.recent) ? applications.recent : [];
  recentApplications
    .filter((submission) => ["APPROVED", "DENIED", "UNDER_REVIEW"].includes(String(submission.status || "").toUpperCase()))
    .slice(0, 2)
    .forEach((submission) => {
      const status = String(submission.status || "SUBMITTED").toUpperCase();
      addNotification(items, {
        kind: "application",
        label: "Application",
        title: status === "APPROVED" || status === "DENIED" ? "Application decision" : "Application review",
        detail: `${submission.form_name || "Request"} - ${formatNotificationStatus(status)}`,
        at: String(submission.updated_at || submission.created_at || ""),
        targetTab: "record",
        countable: status === "APPROVED" || status === "DENIED",
      });
    });

  const serverRecord = state.hub?.serverRecord || {};
  const recentRecord = Array.isArray(serverRecord.recent) ? serverRecord.recent : [];
  recentRecord.slice(0, 2).forEach((entry) => {
    addNotification(items, {
      kind: "flag",
      label: "Admin flag",
      title: `${formatNotificationStatus(entry.type || "Notice")} notice`,
      detail: String(entry.reasonPublic || entry.status || "Server record updated"),
      at: String(entry.issuedAt || ""),
      targetTab: "record",
      countable: true,
    });
  });

  const community = getCommunityState();
  const missingClaimableGroups = Array.isArray(community.discord?.missingClaimableGroups)
    ? community.discord.missingClaimableGroups
    : [];
  if (missingClaimableGroups.length) {
    addNotification(items, {
      kind: "forum",
      label: "Forum",
      title: "Forum badge update",
      detail: `${missingClaimableGroups.map((group) => group.label).join(", ")} ready for community sync`,
      targetTab: "friends",
      countable: true,
    });
  }

  addNotification(items, {
    kind: "changelog",
    label: "Changelog",
    title: "Changelogs",
    detail: "Server update notes will appear here as they are published.",
    countable: false,
  });

  if (!items.some((item) => item.countable)) {
    items.unshift({
      kind: "quiet",
      label: "UCP",
      title: "No unread notifications",
      detail: "Tickets, reports, admin flags, request decisions, and changelogs are ready for this feed.",
      at: "",
      targetTab: "",
      countable: false,
    });
  }

  return items.slice(0, 7);
}

function renderNotifications() {
  if (!elements.notificationButton || !elements.notificationTray || !elements.notificationList) {
    return;
  }

  const items = buildNotificationItems();
  const count = items.filter((item) => item.countable).length;
  elements.notificationButton.setAttribute("aria-expanded", state.notificationsOpen ? "true" : "false");
  elements.notificationTray.classList.toggle("hidden", !state.notificationsOpen);

  if (elements.notificationCount) {
    elements.notificationCount.textContent = count > 9 ? "9+" : String(count);
    elements.notificationCount.classList.toggle("hidden", count <= 0);
  }

  elements.notificationList.innerHTML = items.map((item) => `
    <button class="notification-item notification-item--${escapeHtml(item.kind)}" type="button" ${item.targetTab ? `data-notification-tab="${escapeHtml(item.targetTab)}"` : ""}>
      <span class="notification-item__rail" aria-hidden="true"></span>
      <span class="notification-item__body">
        <span class="notification-item__meta">${escapeHtml(item.label)}${item.at ? ` - ${escapeHtml(formatDateShort(item.at))}` : ""}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml(item.detail)}</span>
      </span>
    </button>
  `).join("");

  if (elements.notificationSources) {
    const sources = ["Tickets", "Forum reports", "Admin flags", "Request decisions", "Changelogs"];
    elements.notificationSources.innerHTML = sources.map((source) => `<span>${escapeHtml(source)}</span>`).join("");
  }
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

function processDiscordLinkResult() {
  const url = new URL(window.location.href);
  const result = String(url.searchParams.get("discordLink") || "").trim().toLowerCase();
  if (!result) {
    return;
  }

  const message = String(url.searchParams.get("discordMessage") || "").trim();
  if (result === "success") {
    setMessage(elements.globalMessage, "success", "Discord account linked.");
  } else {
    setMessage(elements.globalMessage, "error", message || "Discord linking failed.");
  }

  url.searchParams.delete("discordLink");
  url.searchParams.delete("discordMessage");
  window.history.replaceState({}, document.title, url.toString());
}

function renderServer() {
  if (!state.server) {
    elements.serverName.textContent = "Unified Control Panel";
    elements.serverStatus.textContent = "Backend not reachable yet.";
    elements.serverHealthPill.textContent = "Offline";
    elements.serverHealthPill.dataset.tone = "error";
    renderTopbarStats();
    return;
  }

  elements.serverName.textContent = "Unified Control Panel";
  elements.serverStatus.textContent = state.server.ok === false ? "Backend offline" : "";
  elements.serverHealthPill.textContent = state.server.ok === false ? "Offline" : "Online";
  elements.serverHealthPill.dataset.tone = state.server.ok === false ? "error" : "success";
  renderTopbarStats();
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
  elements.aboutCard.classList.toggle("ucp-menu-card", !!state.me);

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

  elements.aboutCard.innerHTML = renderUcpMenu();
  syncUcpMenuHeights();

  elements.utilityCard.innerHTML = renderSocialLinksCard();
}

function renderCharacterSelectList() {
  if (!state.characters.length) {
    return `<div class="character-select-list character-select-list--empty">
      <div class="empty-copy">No character slots reserved yet.</div>
    </div>`;
  }

  return `
    <div class="character-select-list">
      ${state.characters.map((character) => {
        const isSelected = state.selectedCharacter && Number(state.selectedCharacter.id) === Number(character.id);
        const isOnline = isCharacterOnline(character);
        const lastOnlineAt = getCharacterLastOnlineAt(character);
        return `
          <button class="character-select-list__item ${isSelected ? "character-select-list__item--selected" : ""}" type="button" data-select-character="${escapeHtml(character.id)}" aria-pressed="${isSelected ? "true" : "false"}">
            <span class="character-select-list__main">
              <span class="character-select-list__name">${escapeHtml(getCharacterName(character))}</span>
              <span class="character-select-list__slot">Slot ${escapeHtml(character.slot_index)}</span>
              <span class="character-select-list__last-online">(${escapeHtml(formatLastOnline(lastOnlineAt, isOnline))})</span>
            </span>
            <span class="character-select-list__hours">${escapeHtml(formatTotalHours(getCharacterTotalPlaySeconds(character)))}</span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderRightRail() {
  const accountAgeDays = Number(state.hub?.stats?.accountAgeDays || 0);
  const activeSessions = Number(state.hub?.security?.activeSessions || 0);
  const characterCount = Number(state.hub?.stats?.characterCount || 0);
  const totalPlaySeconds = getAccountTotalPlaySeconds();
  const lastOnlineAt = getAccountLastOnlineAt();
  const hasOnlineCharacter = state.characters.some((character) => isCharacterOnline(character));
  const record = state.hub?.serverRecord || {};
  const standingLabel = getStandingLabel(record.standing);
  const standingClass = getStandingClass(record.standing);

  elements.profileStatCard.classList.remove("hidden");
  elements.profileStatCard.classList.add("stat-card--characters");
  elements.activityStatCard.classList.remove("hidden");
  elements.recordStatCard.classList.remove("hidden");

  elements.profileStatCard.innerHTML = `
    <div class="stat-card__label">Characters</div>
    <div class="stat-card__value">${escapeHtml(characterCount)} slots</div>
    <div class="stat-card__meta">${escapeHtml(state.selectedCharacter ? getCharacterName(state.selectedCharacter) : "No active slot selected")}</div>
    ${renderCharacterSelectList()}
  `;

  elements.activityStatCard.innerHTML = `
    <div class="stat-card__label">Account Activity</div>
    <div class="stat-card__value">${escapeHtml(formatTotalHours(totalPlaySeconds))}</div>
    <div class="stat-card__meta">(${escapeHtml(formatLastOnline(lastOnlineAt, hasOnlineCharacter))})</div>
    <div class="stat-card__submeta">${escapeHtml(activeSessions)} active web session${activeSessions === 1 ? "" : "s"} | ${escapeHtml(accountAgeDays)} account days</div>
  `;

  elements.recordStatCard.innerHTML = `
    <div class="stat-card__label">Server Standing</div>
    <div class="stat-card__value standing-value ${standingClass}">${escapeHtml(standingLabel)}</div>
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

const CHARACTER_DASHBOARD_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const EMPTY_MONTHLY_ACTIVITY = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const CHARACTER_DASHBOARD_FALLBACKS = [
  {
    role: "Rrjeti Kriminal Shqiptar",
    activity: EMPTY_MONTHLY_ACTIVITY,
    wallet: 1422,
    bank: 79713,
    propertiesValue: 0,
    properties: [],
    shops: ["1649 - Cafe Tirana | Cashier", "2667 - Club Shqiponja | Security", "3365 - Drenica Bar | Drenica Bartender"],
    faction: { name: "Rrjeti Kriminal Shqiptar", rank: "Associate (2)", leadership: "No" },
  },
  {
    role: "Romanian-Diaspora Criminal Enterprise",
    activity: EMPTY_MONTHLY_ACTIVITY,
    wallet: 0,
    bank: 113791,
    propertiesValue: 240000,
    properties: ["791 - 232 Alta Street (LS)", "3117 - 101 Occupation Avenue - Floor 3, Room 12 (LS)"],
    shops: ["2957 - PTM Grill | Owner", "1914 - Dracula Brewing & Co | Conte"],
    faction: { name: "Romanian-Diaspora Criminal Enterprise", rank: "Leadership (15)", leadership: "Yes" },
  },
  {
    role: "Civilian",
    activity: EMPTY_MONTHLY_ACTIVITY,
    wallet: 375,
    bank: 46650,
    propertiesValue: 0,
    properties: [],
    shops: [],
    faction: null,
  },
];

function formatMoney(value) {
  return `$${formatStatNumber(Math.max(0, Number(value || 0)))}`;
}

function getCharacterDashboardFallback(character, index) {
  return CHARACTER_DASHBOARD_FALLBACKS[index % CHARACTER_DASHBOARD_FALLBACKS.length] || CHARACTER_DASHBOARD_FALLBACKS[0];
}

function normalizeDashboardList(value, fallback = []) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item?.label || item?.name || item || "").trim()).filter(Boolean);
  }
  const raw = String(value || "").trim();
  return raw ? [raw] : fallback;
}

function getCharacterDashboardData(character, index) {
  const fallback = getCharacterDashboardFallback(character, index);
  const activity = Array.isArray(character?.activity_by_month)
    ? character.activity_by_month
    : Array.isArray(character?.monthly_activity)
      ? character.monthly_activity
      : null;
  const faction = character?.faction || character?.primaryFaction || fallback.faction;

  const hasMonthlyActivity = Array.isArray(activity) && character?.monthly_activity_recorded !== false;

  return {
    role: String(character?.role || character?.occupation || character?.faction_name || fallback.role || "Civilian"),
    activity: CHARACTER_DASHBOARD_MONTHS.map((_, monthIndex) => Math.max(0, Number(activity?.[monthIndex] || 0))),
    hasMonthlyActivity,
    wallet: Number(character?.wallet ?? character?.cash ?? fallback.wallet ?? 0),
    bank: Number(character?.bank ?? character?.bank_balance ?? fallback.bank ?? 0),
    propertiesValue: Number(character?.properties_value ?? character?.property_value ?? fallback.propertiesValue ?? 0),
    properties: normalizeDashboardList(character?.properties, fallback.properties),
    shops: normalizeDashboardList(character?.shops || character?.jobs, fallback.shops),
    faction: faction ? {
      name: String(faction.name || faction.label || fallback.faction?.name || ""),
      rank: String(faction.rank || faction.rankLabel || fallback.faction?.rank || "Member"),
      leadership: String(faction.leadership || faction.leadershipPermissions || fallback.faction?.leadership || "No"),
    } : null,
  };
}

function getNiceActivityStep(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  if (residual <= 1.5) {
    return magnitude;
  }
  if (residual <= 3) {
    return 2 * magnitude;
  }
  if (residual <= 7) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}

function getActivityChartScale(maxValue) {
  const paddedMax = Math.max(1, Number(maxValue || 0) * 1.1);
  const step = getNiceActivityStep(paddedMax / 5);
  const max = Math.max(step, Math.ceil(paddedMax / step) * step);
  const ticks = [];

  for (let tick = 0; tick <= max + step / 2; tick += step) {
    ticks.push(Number(tick.toFixed(4)));
  }

  return { max, ticks };
}

function formatActivityNumber(value) {
  const number = Number(value || 0);
  const rounded = Math.round(number);
  if (Math.abs(number - rounded) < 0.05) {
    return String(rounded);
  }
  return number < 10
    ? number.toFixed(1).replace(/\.0$/, "")
    : number.toFixed(0);
}

function formatActivityHours(value) {
  const hours = Math.max(0, Number(value || 0));
  if (hours > 0 && hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  return `${formatActivityNumber(hours)}h`;
}

function renderCharacterActivityChart(character, index) {
  const dashboard = getCharacterDashboardData(character, index);
  const values = dashboard.activity;
  const currentMonthIndex = new Date().getMonth();
  const year = new Date().getFullYear();
  const width = 720;
  const height = 210;
  const padX = 48;
  const padTop = 28;
  const padBottom = 40;
  const chartHeight = height - padTop - padBottom;
  const stepX = (width - padX - 12) / (CHARACTER_DASHBOARD_MONTHS.length - 1);

  if (!dashboard.hasMonthlyActivity) {
    const totalPlaySeconds = getCharacterTotalPlaySeconds(character);
    const isOnline = isCharacterOnline(character);
    const lastOnlineAt = getCharacterLastOnlineAt(character);

    return `
      <svg class="character-dashboard__chart-svg character-dashboard__chart-svg--empty" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly playtime history is not recorded yet">
        <text class="character-dashboard__axis-title" x="${padX}" y="13">Hours played, ${year}</text>
        ${[0, 1, 2, 3].map((tick) => {
          const y = padTop + chartHeight - (tick / 3) * chartHeight;
          return `<line class="character-dashboard__grid-line ${tick === 0 ? "character-dashboard__grid-line--baseline" : ""}" x1="${padX}" y1="${y.toFixed(1)}" x2="${width - 12}" y2="${y.toFixed(1)}"></line>`;
        }).join("")}
        <text class="character-dashboard__empty-chart-title" x="${width / 2}" y="${(padTop + chartHeight / 2 - 8).toFixed(1)}" text-anchor="middle">Monthly history not recorded yet</text>
        <text class="character-dashboard__empty-chart-body" x="${width / 2}" y="${(padTop + chartHeight / 2 + 15).toFixed(1)}" text-anchor="middle">Showing the tracked character total instead of invented monthly values.</text>
        ${CHARACTER_DASHBOARD_MONTHS.map((month, monthIndex) => {
          const x = padX + monthIndex * stepX;
          const monthClass = monthIndex > currentMonthIndex ? " character-dashboard__month-label--future" : "";
          return `<text class="character-dashboard__month-label${monthClass}" x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle">${month}</text>`;
        }).join("")}
      </svg>
      <div class="character-dashboard__chart-summary">
        <span><strong>${escapeHtml(formatTotalHours(totalPlaySeconds))}</strong>Tracked total</span>
        <span><strong>${escapeHtml(formatLastOnline(lastOnlineAt, isOnline))}</strong>Last online</span>
        <span><strong>Not available</strong>Monthly history</span>
        <span><strong>Live total only</strong>Data source</span>
      </div>
    `;
  }

  const chartData = CHARACTER_DASHBOARD_MONTHS.map((month, monthIndex) => {
    const value = Math.max(0, Number(values?.[monthIndex] || 0));
    const isFuture = monthIndex > currentMonthIndex;
    return {
      month,
      monthIndex,
      value,
      isFuture,
      isPlotted: !isFuture || value > 0,
    };
  });
  const plottedData = chartData.filter((item) => item.isPlotted);
  const maxValue = Math.max(0, ...plottedData.map((item) => item.value));
  const scale = getActivityChartScale(maxValue);
  const baselineY = padTop + chartHeight;
  const gradientId = `activityFill-${String(character?.id || index || "chart").replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const xFor = (monthIndex) => padX + monthIndex * stepX;
  const yFor = (value) => padTop + chartHeight - (value / scale.max) * chartHeight;
  const points = plottedData.map((item) => ({
    ...item,
    x: xFor(item.monthIndex),
    y: yFor(item.value),
  }));
  const linePoints = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const areaPath = points.length > 1
    ? [
      `M ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)}`,
      ...points.map((point) => `L ${point.x.toFixed(1)} ${point.y.toFixed(1)}`),
      `L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)}`,
      "Z",
    ].join(" ")
    : "";
  const futureStartX = currentMonthIndex < CHARACTER_DASHBOARD_MONTHS.length - 1
    ? xFor(currentMonthIndex + 0.5)
    : 0;
  const totalHours = plottedData.reduce((sum, item) => sum + item.value, 0);
  const activeMonths = plottedData.filter((item) => item.value > 0).length;
  const peakMonth = plottedData.reduce((peak, item) => item.value > peak.value ? item : peak, plottedData[0] || { value: 0, month: "" });
  const lastRecordedMonth = [...plottedData].reverse().find((item) => item.value > 0);
  const averageHours = activeMonths ? totalHours / activeMonths : 0;

  return `
    <svg class="character-dashboard__chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Monthly character activity">
      <defs>
        <linearGradient id="${gradientId}" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="rgba(239, 184, 102, 0.3)"></stop>
          <stop offset="100%" stop-color="rgba(239, 184, 102, 0)"></stop>
        </linearGradient>
      </defs>
      ${currentMonthIndex < CHARACTER_DASHBOARD_MONTHS.length - 1 ? `
        <rect class="character-dashboard__future-zone" x="${futureStartX.toFixed(1)}" y="${padTop}" width="${(width - 12 - futureStartX).toFixed(1)}" height="${chartHeight}" rx="6"></rect>
      ` : ""}
      <text class="character-dashboard__axis-title" x="${padX}" y="13">Hours played, ${year}</text>
      ${scale.ticks.map((tick) => {
        const y = yFor(tick);
        return `
          <line class="character-dashboard__grid-line ${tick === 0 ? "character-dashboard__grid-line--baseline" : ""}" x1="${padX}" y1="${y.toFixed(1)}" x2="${width - 12}" y2="${y.toFixed(1)}"></line>
          <text class="character-dashboard__axis-label" x="${padX - 12}" y="${(y + 4).toFixed(1)}" text-anchor="end">${formatActivityNumber(tick)}</text>
        `;
      }).join("")}
      ${areaPath ? `<path class="character-dashboard__plot-area" d="${areaPath}" fill="url(#${gradientId})"></path>` : ""}
      ${linePoints ? `<polyline class="character-dashboard__line" points="${linePoints}"></polyline>` : ""}
      ${points.map((point) => {
        const valueLabel = formatActivityHours(point.value);
        return `
          <g class="character-dashboard__point-group">
            <title>${escapeHtml(`${point.month}: ${valueLabel} played`)}</title>
            ${point.value > 0 ? `<text class="character-dashboard__value-label" x="${point.x.toFixed(1)}" y="${Math.max(16, point.y - 10).toFixed(1)}" text-anchor="middle">${escapeHtml(valueLabel)}</text>` : ""}
            <circle class="character-dashboard__point ${point.value <= 0 ? "character-dashboard__point--empty" : ""}" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${point.value > 0 ? "4.1" : "3.1"}"></circle>
            <circle class="character-dashboard__point-hit" cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="10"></circle>
          </g>
        `;
      }).join("")}
      ${chartData.map((item) => {
        const x = xFor(item.monthIndex);
        const monthClass = item.isFuture && item.value <= 0 ? " character-dashboard__month-label--future" : "";
        return `<text class="character-dashboard__month-label${monthClass}" x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle">${item.month}</text>`;
      }).join("")}
    </svg>
    <div class="character-dashboard__chart-summary">
      <span><strong>${escapeHtml(formatActivityHours(totalHours))}</strong>Year to date</span>
      <span><strong>${activeMonths ? escapeHtml(formatActivityHours(averageHours)) : "--"}</strong>Avg active month</span>
      <span><strong>${peakMonth?.value ? escapeHtml(formatActivityHours(peakMonth.value)) : "--"}</strong>${peakMonth?.value ? `${escapeHtml(peakMonth.month)} peak` : "No peak yet"}</span>
      <span><strong>${lastRecordedMonth ? escapeHtml(lastRecordedMonth.month) : "--"}</strong>Last recorded</span>
    </div>
  `;
}

function renderDashboardSection(title, items, options = {}) {
  const toneClass = options.tone ? ` character-dashboard__section--${options.tone}` : "";
  return `
    <section class="character-dashboard__section${toneClass}">
      <h4>${escapeHtml(title)}</h4>
      ${items.length ? `
        <div class="character-dashboard__section-list">
          ${items.map((item) => `<div>${escapeHtml(item)}</div>`).join("")}
        </div>
      ` : `<div class="character-dashboard__empty">None</div>`}
    </section>
  `;
}

function renderCharacterDashboardCard(character, index) {
  const dashboard = getCharacterDashboardData(character, index);
  const name = getCharacterName(character);
  const initials = name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "C";
  const isOnline = isCharacterOnline(character);
  const lastOnlineAt = getCharacterLastOnlineAt(character);
  const profileItems = [
    `Public: ${character?.is_public ? "Yes" : "No"}`,
    `Link: ${name}`,
  ];
  const wealthItems = [
    `Wallet: ${formatMoney(dashboard.wallet)}`,
    `Bank: ${formatMoney(dashboard.bank)}`,
    `Properties: ${formatMoney(dashboard.propertiesValue)}`,
  ];
  const factionItems = dashboard.faction ? [
    `Faction: ${dashboard.faction.name}`,
    `Rank: ${dashboard.faction.rank}`,
    `Leadership Permissions: ${dashboard.faction.leadership}`,
  ] : [];

  return `
    <article class="character-dashboard-card">
      <header class="character-dashboard-card__hero">
        <div class="character-dashboard-card__avatar">${escapeHtml(initials)}</div>
        <div>
          <h3>${escapeHtml(name)}</h3>
          <p>${escapeHtml(dashboard.role)}</p>
          <span>${escapeHtml(formatLastOnline(lastOnlineAt, isOnline))}</span>
        </div>
      </header>
      <div class="character-dashboard-card__body">
        ${renderDashboardSection("Profile", profileItems)}
        ${renderDashboardSection("Wealth", wealthItems)}
        ${renderDashboardSection("Properties", dashboard.properties, { tone: "property" })}
        ${renderDashboardSection("Shops", dashboard.shops, { tone: "shop" })}
        ${renderDashboardSection("Factions", factionItems)}
      </div>
    </article>
  `;
}

function renderCharacterDashboardPanel() {
  if (!state.characters.length) {
    return `
      <section class="content-card">
        <div class="card-title">Character Dashboard</div>
        <div class="empty-copy">No character slots reserved yet.</div>
      </section>
    `;
  }

  const activeCharacter = state.selectedCharacter || state.characters[0];
  const activeIndex = Math.max(0, state.characters.findIndex((character) => Number(character.id) === Number(activeCharacter?.id)));
  const activeDashboard = getCharacterDashboardData(activeCharacter, activeIndex);
  return `
    <section class="character-dashboard">
      <section class="character-dashboard__activity">
        <div class="character-dashboard__header">
          <div>
            <div class="card-title">Playtime by Month</div>
            <div class="character-dashboard__chart-caption">${activeDashboard.hasMonthlyActivity ? "Character activity is shown year to date." : "Monthly history is not tracked yet; total playtime remains live."}</div>
            <label class="character-dashboard__selector">
              <span>Character</span>
              <select data-dashboard-character-select>
                ${state.characters.map((character) => `
                  <option value="${escapeHtml(character.id)}" ${Number(character.id) === Number(activeCharacter?.id) ? "selected" : ""}>${escapeHtml(getCharacterName(character))}</option>
                `).join("")}
              </select>
            </label>
          </div>
        </div>
        ${renderCharacterActivityChart(activeCharacter, activeIndex)}
      </section>

      <div class="character-dashboard__cards">
        ${state.characters.map((character, index) => renderCharacterDashboardCard(character, index)).join("")}
      </div>
    </section>
  `;
}

function renderCharacterCards() {
  if (!state.characters.length) {
    return `<div class="empty-copy">No character slots reserved yet.</div>`;
  }

  return state.characters.map((character) => {
    const isSelected = state.selectedCharacter && Number(state.selectedCharacter.id) === Number(character.id);
    const canSelect = !isSelected;
    const isOnline = isCharacterOnline(character);
    const lastOnlineAt = getCharacterLastOnlineAt(character);
    const characterStatus = character.last_used_at
      ? `Last used ${formatDate(character.last_used_at)}`
      : "Creation pending in game";
    return `
      <article class="character-card ${isSelected ? "character-card--selected" : ""}">
        <div class="character-card__slot">Slot ${escapeHtml(character.slot_index)}</div>
        <div class="character-card__name">${escapeHtml(getCharacterName(character))}</div>
        <div class="character-card__hours">${escapeHtml(formatTotalHours(getCharacterTotalPlaySeconds(character)))}</div>
        <div class="character-card__last-online">(${escapeHtml(formatLastOnline(lastOnlineAt, isOnline))})</div>
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

  const isDashboard = state.activeCharacterView === "dashboard";
  if (elements.profileTitle) {
    elements.profileTitle.textContent = isDashboard ? "Character Dashboard" : "Profile";
  }
  if (elements.profileSubtitle) {
    elements.profileSubtitle.textContent = isDashboard
      ? "Monthly activity, character profiles, finances, properties, shops, and faction standing."
      : "Identity, badges, and persistent character roster.";
  }

  if (isDashboard) {
    elements.profilePanel.innerHTML = renderCharacterDashboardPanel();
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
  const selectedOnline = isCharacterOnline(state.selectedCharacter);
  const selectedLastOnlineAt = getCharacterLastOnlineAt(state.selectedCharacter);

  elements.settingsPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Selected Character</div>
      <div class="meta-grid">
        <div class="meta-tile"><span>Current Slot</span><strong>${escapeHtml(state.selectedCharacter ? `Slot ${state.selectedCharacter.slot_index}` : "None")}</strong></div>
        <div class="meta-tile"><span>Name State</span><strong>${escapeHtml(selectedNeedsName ? "Needs final name" : "Ready")}</strong></div>
        <div class="meta-tile"><span>Total Hours</span><strong>${escapeHtml(formatTotalHours(getCharacterTotalPlaySeconds(state.selectedCharacter)))}</strong></div>
        <div class="meta-tile"><span>Last Online</span><strong>${escapeHtml(formatLastOnline(selectedLastOnlineAt, selectedOnline))}</strong></div>
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
  const questionRows = Array.from({ length: SECURITY_QUESTION_COUNT }, (_, index) => (
    configuredQuestions[index] || { slotIndex: index + 1, questionKey: "" }
  ));
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
      <div class="card-title">Security Question</div>
      <div class="form-note">Pick one question and answer. This can be used to recover the account later if you lose access to email.</div>
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
  const standingLabel = getStandingLabel(record.standing);
  const standingClass = getStandingClass(record.standing);

  elements.recordPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Standing</div>
      <div class="record-strip">
        <div class="record-metric"><span>Standing</span><strong class="standing-value ${standingClass}">${escapeHtml(standingLabel)}</strong></div>
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
  const activeMonth = getActiveChatlogMonth();
  const activeDay = getActiveChatlogDay();
  const activeDayOfMonth = getActiveChatlogDayOfMonth();
  const daysInMonth = getDaysInMonth(activeMonth);
  const dayOptions = [
    `<option value="">All days</option>`,
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1);
      return `<option value="${day}" ${day === activeDayOfMonth ? "selected" : ""}>${day}</option>`;
    }),
  ].join("");
  const characterOptions = state.characters.map((character) => `
    <option value="${escapeHtml(character.id)}" ${Number(character.id) === Number(activeCharacterId) ? "selected" : ""}>${escapeHtml(getCharacterName(character))}</option>
  `).join("");
  const chatlogs = state.chatlogs || {};
  const rangeLabel = activeDay || activeMonth;

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
              <span>${escapeHtml(entry.speakerName || "Unknown")} - ${escapeHtml(formatChatKind(entry.chatKind))} - ${escapeHtml(entry.radius || 0)} radius${entry.world ? ` - ${escapeHtml(entry.world)}` : ""}</span>
            </div>
            <div class="chatlog-entry__message">${escapeHtml(entry.message)}</div>
          </article>
        `).join("")}
      </div>
    `
    : `<div class="empty-copy">${chatlogs.loading ? "Loading chat history..." : "No chat entries were found for this character in the selected date range."}</div>`;

  elements.chatlogsPanel.innerHTML = `
    <section class="content-card">
      <div class="card-title">Witnessed Chat History</div>
      <div class="inline-form">
        <label class="field field--inline">
          <span>Character</span>
          <select id="chatlogCharacterSelect">
            ${characterOptions}
          </select>
        </label>
        <label class="field field--inline">
          <span>Month</span>
          <input id="chatlogMonthSelect" type="month" value="${escapeHtml(activeMonth)}" />
        </label>
        <label class="field field--inline">
          <span>Day</span>
          <select id="chatlogDaySelect">
            ${dayOptions}
          </select>
        </label>
        <button class="button button--ghost" id="refreshChatlogsButton" type="button">Refresh</button>
        <button class="button button--primary" id="downloadChatlogsButton" type="button" ${chatlogs.exporting ? "disabled" : ""}>${chatlogs.exporting ? "Preparing..." : "Download TXT"}</button>
      </div>
      ${chatlogs.error ? `<div class="message-box" data-tone="error">${escapeHtml(chatlogs.error)}</div>` : ""}
      <div class="form-note">Showing ${escapeHtml(chatlogs.items?.length || 0)} of ${escapeHtml(chatlogs.total || 0)} retained entries for ${escapeHtml(rangeLabel)}.</div>
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
  const discordMode = String(discord.linkMode || "").trim().toLowerCase();
  const discordLinkAvailable = Boolean(discord.linkFlowAvailable || discord.linkUrl);
  const discordNoticeCopy = discord.linked
    ? `Discord is linked as ${discord.displayName || "Unknown account"}. You can re-link it here if you change Discord accounts.`
    : discordLinkAvailable
      ? (discordMode === "oauth"
        ? "Discord linking is active. Connect your Discord account here so UCP can recognize it for future community perks."
        : "Discord is active for this shard. Use the button below to open the official Skyrim Unbound Discord server.")
      : "Discord linking is not configured on this shard yet.";
  const discordButtonLabel = discord.linked
    ? (discordMode === "oauth" ? "Relink Discord" : "Open Discord")
    : (discordMode === "oauth" ? "Link your Discord" : "Join Discord");
  const discordFormNote = !discordLinkAvailable
    ? "Add a Discord invite or OAuth settings to the server configuration to enable this action."
    : discordMode === "oauth"
      ? "Discord account linking uses Discord authorization and returns you here automatically."
      : "This opens the official Skyrim Unbound Discord invite configured for the UCP.";

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
        ${escapeHtml(discordNoticeCopy)}
      </div>
      <div class="meta-grid">
        <div class="meta-tile"><span>Link State</span><strong>${escapeHtml(discord.linked ? "Linked" : "Not linked")}</strong></div>
        <div class="meta-tile"><span>Claimable Ranks</span><strong>${escapeHtml(missingClaimableGroups.length ? missingClaimableGroups.map((group) => group.label).join(", ") : "None waiting")}</strong></div>
      </div>
      <div class="inline-form">
        <button class="button button--ghost" id="linkDiscordButton" type="button" ${discordLinkAvailable ? "" : "disabled"}>${escapeHtml(discordButtonLabel)}</button>
      </div>
      <div class="form-note">${escapeHtml(discordFormNote)}</div>
    </section>
  `;
}

function renderAll() {
  renderServer();
  renderNotifications();
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
    month: getMonthKey(new Date()),
    day: "",
    items: [],
    total: 0,
    hasMore: false,
    offset: 0,
    error: "",
    loading: false,
    exporting: false,
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
  const targetMonth = String(options.month || getActiveChatlogMonth());
  const targetDay = options.day !== undefined ? String(options.day || "") : getActiveChatlogDay();
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
    month: targetMonth,
    day: targetDay,
    loading: true,
    error: "",
    ...(append ? {} : { items: [], total: 0, hasMore: false, offset: 0 }),
  };
  renderChatlogsPanel();

  try {
    const payload = await apiFetch(`/ucp/api/chatlogs?${buildChatlogQuery({
      characterId: targetCharacterId,
      month: targetMonth,
      day: targetDay,
      offset: currentLength,
      limit: 100,
    })}`);
    state.chatlogs = {
      ...state.chatlogs,
      characterId: String(payload.character?.id || targetCharacterId),
      month: String(payload.range?.month || targetMonth),
      day: String(payload.range?.day || targetDay),
      items: append ? [...(state.chatlogs.items || []), ...(payload.items || [])] : (payload.items || []),
      total: Number(payload.total || 0),
      hasMore: !!payload.hasMore,
      offset: Number(payload.offset || 0),
      windowDays: Number(payload.windowDays || payload.range?.windowDays || 7),
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

async function downloadChatlogs() {
  const targetCharacterId = getActiveChatlogCharacterId();
  if (!targetCharacterId || state.chatlogs.exporting) {
    return;
  }

  state.chatlogs = {
    ...state.chatlogs,
    exporting: true,
    error: "",
  };
  renderChatlogsPanel();

  try {
    const response = await fetch(`/ucp/api/chatlogs/export?${buildChatlogQuery({ characterId: targetCharacterId })}`, {
      credentials: "same-origin",
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getChatlogDownloadFileName(response);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    state.chatlogs = {
      ...state.chatlogs,
      exporting: false,
      error: "",
    };
  } catch (error) {
    state.chatlogs = {
      ...state.chatlogs,
      exporting: false,
      error: error.message || "Failed to download chat history.",
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

function bindNotifications() {
  if (!elements.notificationButton || !elements.notificationTray) {
    return;
  }

  elements.notificationButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.notificationsOpen = !state.notificationsOpen;
    renderNotifications();
  });

  elements.notificationTray.addEventListener("click", (event) => {
    event.stopPropagation();
    const target = event.target.closest("[data-notification-tab]");
    if (!target) {
      return;
    }
    const tab = target.dataset.notificationTab || "";
    state.notificationsOpen = false;
    renderNotifications();
    if (WORKSPACE_TABS.has(tab) && !state.whitelist?.gateRequired) {
      activateWorkspaceTab(tab);
    }
  });

  document.addEventListener("click", () => {
    if (!state.notificationsOpen) {
      return;
    }
    state.notificationsOpen = false;
    renderNotifications();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !state.notificationsOpen) {
      return;
    }
    state.notificationsOpen = false;
    renderNotifications();
    elements.notificationButton.focus();
  });
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
      setMessage(elements.authMessage, "success", "Answer your saved question. This recovery method may require staff-enabled policy before it can reset a password.");
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

  elements.aboutCard.addEventListener("click", (event) => {
    const button = event.target.closest("[data-ucp-menu-toggle]");
    if (!button || state.whitelist?.gateRequired) {
      return;
    }
    const menuKey = button.dataset.ucpMenuToggle || "characters";
    if (!state.expandedUcpMenus) {
      state.expandedUcpMenus = new Set();
    }
    if (!state.collapsedUcpMenus) {
      state.collapsedUcpMenus = new Set();
    }
    const isCurrentlyOpen = button.getAttribute("aria-expanded") === "true";
    if (isCurrentlyOpen) {
      state.expandedUcpMenus.delete(menuKey);
      state.collapsedUcpMenus.add(menuKey);
    } else {
      state.expandedUcpMenus.add(menuKey);
      state.collapsedUcpMenus.delete(menuKey);
    }
    setUcpMenuExpanded(button, !isCurrentlyOpen, { animate: true });
  });

  const handleSidebarNavClick = (event) => {
    const button = event.target.closest("[data-open-tab]");
    if (!button || state.whitelist?.gateRequired) {
      return;
    }
    if (button.dataset.characterView) {
      state.activeCharacterView = button.dataset.characterView || "dashboard";
    }
    activateWorkspaceTab(button.dataset.openTab || "profile");
    renderSidebar();
  };
  elements.aboutCard.addEventListener("click", handleSidebarNavClick);
  elements.utilityCard.addEventListener("click", handleSidebarNavClick);

  const handleCharacterSelectClick = async (event) => {
    const button = event.target.closest("[data-select-character]");
    if (!button) {
      return;
    }
    const characterId = Number(button.dataset.selectCharacter);
    if (button.dataset.characterView) {
      state.activeCharacterView = button.dataset.characterView || "profile";
    }
    if (state.selectedCharacter && Number(state.selectedCharacter.id) === characterId) {
      if (button.dataset.openTab) {
        activateWorkspaceTab(button.dataset.openTab || "profile");
      }
      return;
    }
    try {
      await apiFetch("/ucp/api/characters/select", {
        method: "POST",
        body: { characterId },
      });
      setMessage(elements.globalMessage, "success", "Selected character updated.");
      await refreshMe();
      if (button.dataset.openTab) {
        activateWorkspaceTab(button.dataset.openTab || "profile");
      }
    } catch (error) {
      setMessage(elements.globalMessage, "error", error.message);
    }
  };

  elements.aboutCard.addEventListener("click", handleCharacterSelectClick);
  elements.profilePanel.addEventListener("click", handleCharacterSelectClick);
  elements.profileStatCard.addEventListener("click", handleCharacterSelectClick);
  elements.profilePanel.addEventListener("change", async (event) => {
    const select = event.target.closest("[data-dashboard-character-select]");
    if (!select) {
      return;
    }
    const characterId = Number(select.value || 0);
    if (!characterId || (state.selectedCharacter && Number(state.selectedCharacter.id) === characterId)) {
      return;
    }
    state.activeCharacterView = "dashboard";
    try {
      await apiFetch("/ucp/api/characters/select", {
        method: "POST",
        body: { characterId },
      });
      await refreshMe();
    } catch (error) {
      setMessage(elements.globalMessage, "error", error.message);
      renderProfilePanel();
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
      const questions = Array.from({ length: SECURITY_QUESTION_COUNT }, (_, index) => ({
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
        setMessage(elements.globalMessage, "success", "Security question updated.");
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
    const characterSelect = event.target.closest("#chatlogCharacterSelect");
    if (characterSelect) {
      loadChatlogs({ characterId: Number(characterSelect.value || 0) });
      return;
    }

    const monthSelect = event.target.closest("#chatlogMonthSelect");
    if (monthSelect) {
      const month = String(monthSelect.value || getMonthKey(new Date()));
      loadChatlogs({ characterId: getActiveChatlogCharacterId(), month, day: "" });
      return;
    }

    const daySelect = event.target.closest("#chatlogDaySelect");
    if (daySelect) {
      const month = getActiveChatlogMonth();
      const day = getChatlogDayDate(month, daySelect.value);
      loadChatlogs({
        characterId: getActiveChatlogCharacterId(),
        month,
        day,
      });
    }
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
      return;
    }

    const downloadButton = event.target.closest("#downloadChatlogsButton");
    if (downloadButton) {
      downloadChatlogs();
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
    if (linkButton.disabled) {
      return;
    }

    event.preventDefault();
    linkButton.disabled = true;
    setMessage(elements.globalMessage, "success", "Opening Discord...");

    apiFetch("/ucp/api/community/discord/link", {
      method: "POST",
      body: {},
    }).then((payload) => {
      const targetUrl = String(payload?.url || "").trim();
      if (!targetUrl) {
        throw new Error("Discord link response did not include a URL.");
      }
      window.location.assign(targetUrl);
    }).catch((error) => {
      linkButton.disabled = false;
      setMessage(elements.globalMessage, "error", error.message || "Could not open Discord link.");
    });
  });
}

async function boot() {
  state.activeAuthTab = getRequestedAuthTab() || state.activeAuthTab || "register";
  state.activeTab = getRequestedWorkspaceTab() || state.activeTab || "profile";
  bindNotifications();
  bindAuth();
  bindWhitelist();
  bindHub();
  renderAll();
  await loadServerHealth();
  await processConfirmationLink();
  processDiscordLinkResult();
  await refreshMe();
}

boot();
