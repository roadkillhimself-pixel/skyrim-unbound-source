(function () {
  const I18N = window.SKYRIM_UNBOUND_I18N || null;
  const CALENDAR_TIME_MODE_STORAGE_KEY = "skyrim_unbound_calendar_time_mode";
  const CALENDAR_HOST_TIMEZONE_STORAGE_KEY = "skyrim_unbound_calendar_host_timezone";
  const CALENDAR_HOST_TIMEZONE_FALLBACK = "UTC";
  const CALENDAR_TIME_MODES = {
    SERVER: "server",
    LOCAL: "local",
  };
  const CALENDAR_TICKET_CATEGORIES = {
    EVENT_REQUEST: "EVENT_REQUEST",
    EVENT_SUPPORT: "EVENT_SUPPORT",
  };
  const CREATOR_CONTACT_EMAIL = "support@skyrim-unbound.local";
  const CREATOR_CONTACT_TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  const DISCORD_INVITE_CODE = "Bf7drbpWKK";
  const DISCORD_INVITE_METRICS_URL = `https://discord.com/api/v10/invites/${DISCORD_INVITE_CODE}?with_counts=true`;
  const LANGUAGE_STORAGE_KEY = I18N?.STORAGE_KEY || "skyrim_unbound_language";
  const LANGUAGE_OPTIONS = Array.isArray(I18N?.LANGUAGE_OPTIONS) && I18N.LANGUAGE_OPTIONS.length
    ? I18N.LANGUAGE_OPTIONS
    : [{ value: "en", code: "EN", label: "English", langTag: "en" }];
  const storageKeys = ["skyrim-unbound-cookie-dismissed", "skyrim-unbound-cookie-dismissed"];
  const cookieName = "skyrim_unbound_cookie_notice";

  const cookieBar = document.getElementById("cookie-bar");
  const dismissButtons = document.querySelectorAll("[data-cookie-dismiss]");

  const elements = {
    creatorContactOpenButtons: document.querySelectorAll("[data-contact-open]"),
    creatorContactModal: document.getElementById("creatorContactModal"),
    creatorContactClose: document.getElementById("creatorContactClose"),
    creatorContactMessage: document.getElementById("creatorContactMessage"),
    creatorContactForm: document.getElementById("creatorContactForm"),
    creatorContactCaptchaMount: document.getElementById("creatorContactCaptchaMount"),
    creatorContactCaptchaNote: document.getElementById("creatorContactCaptchaNote"),
    creatorContactSubmit: document.getElementById("creatorContactSubmit"),
    topbarLanguageMenu: document.getElementById("topbarLanguageMenu"),
    topbarLanguageButton: document.getElementById("topbarLanguageButton"),
    topbarLanguageFlag: document.getElementById("topbarLanguageFlag"),
    topbarLanguageCode: document.getElementById("topbarLanguageCode"),
    topbarLanguageDropdown: document.getElementById("topbarLanguageDropdown"),
    topbarAccountMenu: document.getElementById("topbarAccountMenu"),
    topbarAccountButton: document.getElementById("topbarAccountButton"),
    topbarAccountName: document.getElementById("topbarAccountName"),
    topbarAccountDropdown: document.getElementById("topbarAccountDropdown"),
    topbarLogoutButton: document.getElementById("topbarLogoutButton"),
    topbarOpenUcpButton: document.getElementById("topbarOpenUcpButton"),
    topbarSessionButton: document.getElementById("topbarSessionButton"),
    heroCalendarAlert: document.getElementById("heroCalendarAlert"),
    heroCalendarAlertTitle: document.getElementById("heroCalendarAlertTitle"),
    heroCalendarAlertCountdown: document.getElementById("heroCalendarAlertCountdown"),
    heroCalendarAlertTime: document.getElementById("heroCalendarAlertTime"),
    heroCalendarAlertExtra: document.getElementById("heroCalendarAlertExtra"),
    heroCalendarAlertCopy: document.getElementById("heroCalendarAlertCopy"),
    calendarOpenButtons: document.querySelectorAll("[data-calendar-open]"),
    calendarPrevButton: document.getElementById("calendarPrevButton"),
    calendarNextButton: document.getElementById("calendarNextButton"),
    calendarMonthLabel: document.getElementById("calendarMonthLabel"),
    calendarTimeModeInputs: document.querySelectorAll('input[name="calendarTimeMode"]'),
    calendarTimeModeOptions: document.querySelectorAll("[data-calendar-time-mode-option]"),
    calendarTimeModeMeta: document.getElementById("calendarTimeModeMeta"),
    calendarMessage: document.getElementById("calendarMessage"),
    calendarGrid: document.getElementById("calendarGrid"),
    calendarModal: document.getElementById("calendarModal"),
    calendarModalClose: document.getElementById("calendarModalClose"),
    calendarDetailTitle: document.getElementById("calendarDetailTitle"),
    calendarPanelLede: document.getElementById("calendarPanelLede"),
    calendarModalMeta: document.getElementById("calendarModalMeta"),
    calendarDetailEventList: document.getElementById("calendarDetailEventList"),
    calendarModalDescription: document.getElementById("calendarModalDescription"),
    calendarTicketPanel: document.getElementById("calendarTicketPanel"),
    calendarTicketTitle: document.getElementById("calendarTicketTitle"),
    calendarTicketCopy: document.getElementById("calendarTicketCopy"),
    calendarTicketMessage: document.getElementById("calendarTicketMessage"),
    calendarTicketActionRow: document.getElementById("calendarTicketActionRow"),
    calendarTicketRequestButton: document.getElementById("calendarTicketRequestButton"),
    calendarTicketSupportButton: document.getElementById("calendarTicketSupportButton"),
    calendarTicketForm: document.getElementById("calendarTicketForm"),
    calendarTicketFormTitle: document.getElementById("calendarTicketFormTitle"),
    calendarTicketCategory: document.getElementById("calendarTicketCategory"),
    calendarTicketSupportChoiceInputs: document.querySelectorAll('input[name="needsAdminSupport"]'),
    calendarTicketSubject: document.getElementById("calendarTicketSubject"),
    calendarTicketBody: document.getElementById("calendarTicketBody"),
    calendarTicketFormNote: document.getElementById("calendarTicketFormNote"),
    calendarTicketSubmit: document.getElementById("calendarTicketSubmit"),
    calendarTicketCancel: document.getElementById("calendarTicketCancel"),
    calendarModalInterestCount: document.getElementById("calendarModalInterestCount"),
    calendarInterestButton: document.getElementById("calendarInterestButton"),
    authAwareLinks: document.querySelectorAll("[data-ucp-link]"),
    websiteAuthModal: document.getElementById("websiteAuthModal"),
    websiteAuthClose: document.getElementById("websiteAuthClose"),
    websiteAuthMessage: document.getElementById("websiteAuthMessage"),
    websiteLoginForm: document.getElementById("websiteLoginForm"),
    websiteLoginChallengeForm: document.getElementById("websiteLoginChallengeForm"),
    websiteLoginChallengeCopy: document.getElementById("websiteLoginChallengeCopy"),
    websiteLoginChallengeEmailField: document.getElementById("websiteLoginChallengeEmailField"),
    websiteLoginChallengeTotpField: document.getElementById("websiteLoginChallengeTotpField"),
    websiteLoginChallengeCancel: document.getElementById("websiteLoginChallengeCancel"),
    mediaSlider: document.getElementById("mediaSlider"),
    mediaSliderTrack: document.getElementById("mediaSliderTrack"),
    mediaSliderDots: document.querySelectorAll("[data-media-dot]"),
  };

  let calendarState = null;

  const initialCalendarTimeMode = getInitialCalendarTimeMode();
  const initialHostTimeZone = getInitialHostTimeZone();
  const initialLanguageSelection = getInitialLanguageSelection();
  const initialCalendarMonth = getMonthKey(new Date(), initialCalendarTimeMode);

  calendarState = {
    month: initialCalendarMonth,
    events: [],
    selectedEventId: 0,
    selectedDateKey: "",
    hostTimeZone: initialHostTimeZone,
    timeMode: initialCalendarTimeMode,
  };

  const mediaSliderState = {
    index: 0,
    intervalId: 0,
  };

  const heroCalendarAlertState = {
    events: [],
    tickIntervalId: 0,
  };

  const creatorContactState = {
    captchaConfig: null,
    captchaToken: "",
    captchaWidgetId: null,
    configPromise: null,
    scriptPromise: null,
    submitting: false,
  };

  const calendarTicketState = {
    dateKey: "",
    open: false,
    submitting: false,
    category: CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST,
    needsSupport: false,
    lastDefaultSubject: "",
  };

  const languageState = {
    value: initialLanguageSelection,
    menuOpen: false,
  };

  const authState = {
    me: null,
    pendingLoginChallenge: null,
    resumeCalendarTicketCategory: "",
    resumeInterestAfterLogin: false,
    accountMenuOpen: false,
  };

  const discordMetricsState = {
    loaded: false,
    memberCount: 0,
    onlineCount: 0,
  };

  const safeStorage = getSafeStorage();

  function getSafeStorage() {
    try {
      const storage = window.localStorage;
      const probeKey = "__skyrim_unbound_storage_probe__";
      storage.setItem(probeKey, "1");
      storage.removeItem(probeKey);
      return storage;
    } catch (_error) {
      return null;
    }
  }

  function normalizeLanguageSelection(value) {
    const normalizedValue = String(value || "").trim().toLowerCase();
    const migratedValue = normalizedValue === "ge" ? "de" : normalizedValue;
    return LANGUAGE_OPTIONS.some((option) => option.value === migratedValue)
      ? migratedValue
      : LANGUAGE_OPTIONS[0].value;
  }

  function getInitialLanguageSelection() {
    try {
      return normalizeLanguageSelection(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
    } catch (_error) {
      return LANGUAGE_OPTIONS[0].value;
    }
  }

  function persistLanguageSelection(value) {
    if (!safeStorage) {
      return;
    }

    safeStorage.setItem(LANGUAGE_STORAGE_KEY, normalizeLanguageSelection(value));
  }

  function getLanguageOption(value) {
    const normalizedValue = normalizeLanguageSelection(value);
    return LANGUAGE_OPTIONS.find((option) => option.value === normalizedValue) || LANGUAGE_OPTIONS[0];
  }

  function getCurrentLanguageOption() {
    return getLanguageOption(languageState.value);
  }

  function getCurrentLocaleTag() {
    return getCurrentLanguageOption().langTag || "en";
  }

  function getTranslationValue(path) {
    return I18N?.get ? I18N.get(path, languageState.value) : "";
  }

  function t(path, params) {
    return I18N?.t ? I18N.t(languageState.value, path, params || {}) : "";
  }

  function getTranslatedWeekdayLabels() {
    const labels = getTranslationValue("calendar.weekdayLabels");
    return Array.isArray(labels) && labels.length === 7
      ? labels
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  }

  function getTranslatedMonthLabels() {
    const labels = getTranslationValue("calendar.monthLabels");
    return Array.isArray(labels) && labels.length === 12
      ? labels
      : [
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
  }

  function formatLocalizedCount(value) {
    const number = Math.max(0, Math.floor(Number(value) || 0));
    try {
      return new Intl.NumberFormat(getCurrentLocaleTag()).format(number);
    } catch (_error) {
      return String(number);
    }
  }

  function getStarPoints(cx, cy, outerRadius, innerRadius, rotationDegrees = -90) {
    const points = [];

    for (let index = 0; index < 10; index += 1) {
      const radius = index % 2 === 0 ? outerRadius : innerRadius;
      const angle = ((rotationDegrees + index * 36) * Math.PI) / 180;
      points.push(`${(cx + Math.cos(angle) * radius).toFixed(2)} ${(cy + Math.sin(angle) * radius).toFixed(2)}`);
    }

    return points.join(" ");
  }

  function renderFlagSvg(content) {
    return `<svg class="language-flag-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
  }

  function getLanguageFlagMarkup(option) {
    switch (normalizeLanguageSelection(option?.value)) {
      case "en":
        return renderFlagSvg(`
          <rect width="64" height="64" fill="#1e4aa8"/>
          <path d="M0 0h14l50 50v14H50L0 14Z" fill="#ffffff"/>
          <path d="M64 0H50L0 50v14h14L64 14Z" fill="#ffffff"/>
          <path d="M26 0h12v64H26Z" fill="#ffffff"/>
          <path d="M0 26h64v12H0Z" fill="#ffffff"/>
          <path d="M0 0h8l56 56v8h-8L0 8Z" fill="#c81d25"/>
          <path d="M64 0h-8L0 56v8h8L64 8Z" fill="#c81d25"/>
          <path d="M28.5 0h7v64h-7Z" fill="#c81d25"/>
          <path d="M0 28.5h64v7H0Z" fill="#c81d25"/>
        `);
      case "fr":
        return renderFlagSvg(`
          <rect width="21.33" height="64" fill="#21468b"/>
          <rect x="21.33" width="21.34" height="64" fill="#ffffff"/>
          <rect x="42.67" width="21.33" height="64" fill="#d81e34"/>
        `);
      case "de":
        return renderFlagSvg(`
          <rect width="64" height="21.33" fill="#111111"/>
          <rect y="21.33" width="64" height="21.34" fill="#dd0000"/>
          <rect y="42.67" width="64" height="21.33" fill="#ffce00"/>
        `);
      case "tr":
        return renderFlagSvg(`
          <rect width="64" height="64" fill="#e01f26"/>
          <circle cx="27" cy="32" r="14" fill="#ffffff"/>
          <circle cx="31" cy="32" r="11" fill="#e01f26"/>
          <polygon points="${getStarPoints(40.5, 32, 6.5, 2.7)}" fill="#ffffff"/>
        `);
      case "es":
        return renderFlagSvg(`
          <rect width="64" height="64" fill="#c61f2a"/>
          <rect y="16" width="64" height="32" fill="#f0bf2f"/>
          <rect x="16" y="24" width="7" height="16" rx="2" fill="#aa1f2d"/>
          <rect x="23" y="27" width="4" height="10" rx="1.5" fill="#d9a41f"/>
        `);
      case "ru":
        return renderFlagSvg(`
          <rect width="64" height="21.33" fill="#ffffff"/>
          <rect y="21.33" width="64" height="21.34" fill="#22408c"/>
          <rect y="42.67" width="64" height="21.33" fill="#cf2b37"/>
        `);
      default:
        return `<span class="language-flag-fallback">${escapeHtml(option?.code || "")}</span>`;
    }
  }

  function setTextContent(target, value) {
    if (target) {
      target.textContent = value;
    }
  }

  function setInnerHtml(target, value) {
    if (target) {
      target.innerHTML = value;
    }
  }

  function setAttributeValue(target, name, value) {
    if (target) {
      target.setAttribute(name, value);
    }
  }

  function rebuildButtonWithIcon(target, label) {
    if (!target) {
      return;
    }

    const iconMarkup = target.querySelector(".button__icon")?.outerHTML || "";
    target.innerHTML = `${iconMarkup}<span>${escapeHtml(label)}</span>`;
  }

  function rebuildCommunityCta(target, label) {
    if (!target) {
      return;
    }

    const iconMarkup = target.querySelector(".community-showcase__cta-icon")?.outerHTML || "";
    const arrowMarkup = target.querySelector(".community-showcase__cta-arrow")?.outerHTML || "";
    target.innerHTML = `${iconMarkup}<span>${escapeHtml(label)}</span>${arrowMarkup}`;
  }

  function formatMetricCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      const discordCopy = (getTranslationValue("community.cards") || [])[0] || {};
      return discordCopy.stats?.[0]?.value || "Live";
    }

    return new Intl.NumberFormat(getCurrentLocaleTag(), {
      maximumFractionDigits: 0,
    }).format(number);
  }

  function applyCommunityRuntimeState() {
    const forumCard = document.querySelector('[data-community-card="forum"]');
    if (forumCard) {
      const forumCopy = (getTranslationValue("community.cards") || [])[1] || {};
      const cta = forumCard.querySelector(".community-showcase__cta");
      setInnerHtml(forumCard.querySelector(".community-showcase__body p"), forumCopy.bodyHtml || "");
      if (cta) {
        cta.setAttribute("href", "#community");
        cta.setAttribute("aria-disabled", "true");
        cta.setAttribute("tabindex", "-1");
        cta.classList.add("community-showcase__cta--disabled");
        rebuildCommunityCta(cta, forumCopy.cta || "");
      }

    }

    if (discordMetricsState.loaded) {
      renderDiscordMetrics();
    }
  }

  function renderDiscordMetrics() {
    const discordCard = document.querySelector('[data-community-card="discord"]');
    if (!discordCard) {
      return;
    }

    const memberText = formatMetricCount(discordMetricsState.memberCount);
    const onlineText = formatMetricCount(discordMetricsState.onlineCount);
    const memberCopy = discordCard.querySelector("[data-discord-member-copy]") || discordCard.querySelector(".community-showcase__body p strong");
    setTextContent(memberCopy, memberText);
  }

  async function loadDiscordMetrics() {
    const discordCard = document.querySelector('[data-community-card="discord"]');
    if (!discordCard || !window.fetch) {
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 6000);
      const response = await fetch(DISCORD_INVITE_METRICS_URL, {
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }

      const payload = await response.json();
      const profile = payload?.profile || {};
      discordMetricsState.memberCount = Number(payload?.approximate_member_count || profile.member_count || 0);
      discordMetricsState.onlineCount = Number(payload?.approximate_presence_count || profile.online_count || 0);
      discordMetricsState.loaded = discordMetricsState.memberCount > 0 || discordMetricsState.onlineCount > 0;
      if (discordMetricsState.loaded) {
        renderDiscordMetrics();
      }
    } catch (_error) {
      const discordCopy = (getTranslationValue("community.cards") || [])[0] || {};
      setTextContent(discordCard.querySelector("[data-discord-member-copy]"), discordCopy.stats?.[0]?.value || "Live");
    }
  }

  function applyStaticTranslations() {
    const metaDescription = document.querySelector('meta[name="description"]');
    const navLinks = document.querySelectorAll(".nav a");
    const heroButtons = document.querySelectorAll(".hero__actions a");
    const worldFeatures = document.querySelectorAll("#world .feature");
    const joinCards = document.querySelectorAll("#join .step-card");
    const communityCards = document.querySelectorAll(".community-showcase__card");
    const mediaDots = document.querySelectorAll("[data-media-dot]");
    const footerQuickLinks = document.querySelectorAll(".footer__column .footer__links a");
    const footerMetaLinks = document.querySelectorAll(".footer__meta-links a");
    const cookieButtons = document.querySelectorAll("[data-cookie-dismiss]");
    const calendarFieldLabels = document.querySelectorAll(".calendar-ticket__form .calendar-ticket__field > span:first-child");
    const calendarChoiceLabels = document.querySelectorAll(".calendar-ticket__choice span");
    const timeModeCopies = document.querySelectorAll(".calendar-time-toggle__copy");
    const contactFieldLabels = document.querySelectorAll(".contact-modal__field > span:first-child");
    const authFieldLabels = document.querySelectorAll("#websiteLoginForm .auth-modal__field > span");
    const challengeFieldLabels = [
      elements.websiteLoginChallengeEmailField?.querySelector("span"),
      elements.websiteLoginChallengeTotpField?.querySelector("span"),
    ];

    document.title = t("meta.title");
    if (metaDescription) {
      metaDescription.setAttribute("content", t("meta.description"));
    }

    setAttributeValue(document.querySelector(".nav"), "aria-label", t("nav.primary"));
    [
      ["nav.home", navLinks[0]],
      ["nav.join", navLinks[1]],
      ["nav.world", navLinks[2]],
      ["nav.community", navLinks[3]],
      ["nav.media", navLinks[4]],
      ["nav.events", navLinks[5]],
      ["nav.contact", navLinks[6]],
    ].forEach(([key, node]) => setTextContent(node, t(key)));

    setAttributeValue(elements.topbarLanguageButton, "aria-label", t("language.select"));
    setAttributeValue(elements.topbarLanguageDropdown, "aria-label", t("language.selector"));
    setAttributeValue(elements.topbarAccountDropdown, "aria-label", t("account.defaultName"));
    setTextContent(elements.topbarLogoutButton, t("account.logOut"));
    setTextContent(elements.topbarOpenUcpButton, t("account.openUcp"));
    setTextContent(elements.topbarSessionButton, t("account.signIn"));
    setTextContent(document.querySelector(".topbar__actions .button--install > span:first-child"), t("account.install"));

    setTextContent(document.querySelector(".hero__title"), t("hero.title"));
    setTextContent(heroButtons[0], t("hero.createAccount"));
    rebuildButtonWithIcon(heroButtons[1], t("hero.joinDiscord"));
    setTextContent(document.querySelector(".hero__calendar-eyebrow"), t("hero.calendarEyebrow"));
    setTextContent(document.querySelector(".hero__calendar-intro"), t("hero.calendarIntro"));
    setTextContent(document.querySelector(".hero__calendar-alert-cta"), t("calendar.heroAlert.openNow"));
    setTextContent(document.querySelector(".hero__calendar-actions .button"), t("hero.openCalendar"));
    setTextContent(document.querySelector(".hero__trailer-meta strong"), t("hero.trailerTitle"));
    setTextContent(document.querySelector(".hero__trailer-meta span"), t("hero.trailerSubtitle"));
    setTextContent(document.querySelector("#world .section-heading h2"), t("hero.worldTitle"));

    const translatedFeatures = getTranslationValue("hero.features") || [];
    worldFeatures.forEach((feature, index) => {
      const copy = translatedFeatures[index] || {};
      setTextContent(feature.querySelector("h3"), copy.title || "");
      setTextContent(feature.querySelector("p"), copy.body || "");
    });

    setTextContent(document.querySelector("#join .section-heading h2"), t("join.title"));
    setTextContent(document.querySelector("#join .section-heading p"), t("join.intro"));
    const translatedSteps = getTranslationValue("join.steps") || [];
    joinCards.forEach((card, index) => {
      const step = translatedSteps[index] || {};
      setTextContent(card.querySelector("h3"), step.title || "");
      setTextContent(card.querySelector("p"), step.body || "");
      setTextContent(card.querySelector("a"), step.cta || "");
    });

    setInnerHtml(document.querySelector(".community-showcase__title"), t("community.titleHtml"));
    setTextContent(document.querySelector(".community-showcase__intro"), t("community.intro"));
    const translatedCommunityCards = getTranslationValue("community.cards") || [];
    communityCards.forEach((card, index) => {
      const copy = translatedCommunityCards[index] || {};
      setInnerHtml(card.querySelector("h3"), copy.titleHtml || "");
      setInnerHtml(card.querySelector("p"), copy.bodyHtml || "");
      rebuildCommunityCta(card.querySelector(".community-showcase__cta"), copy.cta || "");
    });

    setTextContent(document.querySelector("#media .section-heading h2"), t("media.title"));
    setTextContent(document.querySelector("#media .section-heading p"), t("media.intro"));
    const mediaLabels = getTranslationValue("media.labels") || [];
    mediaDots.forEach((dot, index) => {
      setAttributeValue(dot, "aria-label", mediaLabels[index] || "");
    });

    setTextContent(document.querySelector(".contact-band .section-heading__eyebrow"), t("contact.eyebrow"));
    setTextContent(document.querySelector(".contact-band h2"), t("contact.title"));
    setTextContent(document.querySelector(".contact-band p"), t("contact.body"));
    setTextContent(document.querySelector("#creatorContactOpen"), t("contact.cta"));

    setTextContent(document.querySelector(".youtube-callout__text"), t("youtube.text"));
    rebuildButtonWithIcon(document.querySelector(".button--youtube"), t("youtube.cta"));

    setTextContent(document.querySelector(".footer__legal h3"), t("footer.legalTitle"));
    setTextContent(document.querySelector(".footer__legal p"), t("footer.legalBody"));
    setTextContent(document.querySelector(".footer__column h3"), t("footer.quickLinksTitle"));
    const quickLinks = getTranslationValue("footer.quickLinks") || [];
    footerQuickLinks.forEach((link, index) => setTextContent(link, quickLinks[index] || ""));
    setTextContent(document.querySelector(".footer__column--powered h3"), t("footer.poweredTitle"));
    setInnerHtml(document.querySelector(".footer__note"), t("footer.poweredHtml"));
    setTextContent(document.querySelector(".footer__meta-inner > p"), t("footer.meta"));
    const legalLinks = getTranslationValue("footer.legalLinks") || [];
    footerMetaLinks.forEach((link, index) => setTextContent(link, legalLinks[index] || ""));

    setAttributeValue(cookieBar, "aria-label", t("cookie.notice"));
    setTextContent(document.querySelector("#cookie-bar p"), t("cookie.notice"));
    setTextContent(cookieButtons[0], t("cookie.close"));
    setTextContent(cookieButtons[1], t("cookie.allow"));

    setAttributeValue(elements.calendarModalClose, "aria-label", t("calendar.closeLabel"));
    setTextContent(document.querySelector(".calendar-modal__eyebrow"), t("hero.calendarEyebrow"));
    setTextContent(document.querySelector(".calendar-ticket__eyebrow"), t("calendar.playerRequests"));
    [
      t("calendar.ticketType"),
      t("calendar.supportQuestion"),
      t("calendar.subject"),
      t("calendar.details"),
    ].forEach((label, index) => setTextContent(calendarFieldLabels[index], label));
    setTextContent(document.querySelector(".calendar-ticket__static-value"), t("calendar.eventRequest"));
    setAttributeValue(document.querySelector(".calendar-ticket__choice-row"), "aria-label", t("calendar.supportQuestionAria"));
    setTextContent(calendarChoiceLabels[0], t("calendar.no"));
    setTextContent(calendarChoiceLabels[1], t("calendar.yes"));
    setAttributeValue(elements.calendarTicketBody, "placeholder", t("calendar.ticket.placeholder"));
    setTextContent(elements.calendarTicketSubmit, t("calendar.openTicket"));
    setTextContent(elements.calendarTicketCancel, t("calendar.cancel"));
    setTextContent(elements.calendarPrevButton, t("calendar.previous"));
    setTextContent(elements.calendarNextButton, t("calendar.next"));
    if (!elements.calendarMonthLabel.textContent || elements.calendarMonthLabel.textContent === "Loading events...") {
      setTextContent(elements.calendarMonthLabel, t("calendar.loading"));
    }
    setAttributeValue(document.querySelector(".calendar-time-toggle"), "aria-label", t("calendar.timeDisplayLabel"));
    setTextContent(timeModeCopies[0], t("calendar.serverTime"));
    setTextContent(timeModeCopies[1], t("calendar.localTime"));
    setAttributeValue(elements.calendarGrid, "aria-label", t("calendar.gridLabel"));

    setAttributeValue(elements.creatorContactClose, "aria-label", t("contactModal.closeLabel"));
    setTextContent(document.querySelector("#creatorContactTitle"), t("contactModal.title"));
    setTextContent(document.querySelector(".contact-modal__header p"), t("contactModal.intro"));
    [
      t("contactModal.name"),
      t("contactModal.email"),
      t("contactModal.subject"),
      t("contactModal.message"),
    ].forEach((label, index) => setTextContent(contactFieldLabels[index], `${label} ${index < 4 ? "*" : ""}`.trim()));
    setAttributeValue(document.querySelector('input[name="name"]'), "placeholder", t("contactModal.yourName"));
    setAttributeValue(document.querySelector('input[name="email"]'), "placeholder", t("contactModal.yourEmail"));
    setAttributeValue(document.querySelector('input[name="subject"]'), "placeholder", t("contactModal.about"));
    setAttributeValue(document.querySelector('textarea[name="message"]'), "placeholder", t("contactModal.messagePlaceholder"));
    if (!elements.creatorContactCaptchaNote.textContent || elements.creatorContactCaptchaNote.textContent === "Loading verification...") {
      setTextContent(elements.creatorContactCaptchaNote, t("contactModal.loadingVerification"));
    }
    rebuildButtonWithIcon(elements.creatorContactSubmit, t("contactModal.sendMessage"));

    setAttributeValue(elements.websiteAuthClose, "aria-label", t("auth.closeLabel"));
    setTextContent(document.querySelector(".auth-modal__eyebrow"), t("auth.eyebrow"));
    setTextContent(document.querySelector("#websiteAuthTitle"), t("auth.title"));
    setTextContent(document.querySelector(".auth-modal__header p"), t("auth.intro"));
    setTextContent(authFieldLabels[0], t("auth.login"));
    setTextContent(authFieldLabels[1], t("auth.password"));
    setTextContent(document.querySelector('#websiteLoginForm button[type="submit"]'), t("auth.signIn"));
    setTextContent(document.querySelector('#websiteLoginForm a[data-ucp-link="register"]'), t("auth.createAccount"));
    setTextContent(challengeFieldLabels[0], t("auth.emailOtp"));
    setTextContent(challengeFieldLabels[1], t("auth.totpCode"));
    setAttributeValue(elements.websiteLoginChallengeEmailField?.querySelector("input"), "placeholder", t("auth.emailOtpPlaceholder"));
    setAttributeValue(elements.websiteLoginChallengeTotpField?.querySelector("input"), "placeholder", t("auth.totpPlaceholder"));
    setTextContent(document.querySelector('#websiteLoginChallengeForm button[type="submit"]'), t("auth.verifyContinue"));
    setTextContent(elements.websiteLoginChallengeCancel, t("auth.cancel"));
    setInnerHtml(document.querySelector(".auth-modal__footer"), t("auth.footerHtml"));
    elements.authAwareLinks = document.querySelectorAll("[data-ucp-link]");
  }

  function normalizeTimeZoneId(value) {
    const normalizedValue = String(value || "").trim();
    if (!normalizedValue) {
      return "";
    }

    try {
      new Intl.DateTimeFormat(undefined, { timeZone: normalizedValue }).format(new Date());
      return normalizedValue;
    } catch (_error) {
      return "";
    }
  }

  function getBrowserTimeZone() {
    try {
      return normalizeTimeZoneId(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch (_error) {
      return "";
    }
  }

  function getInitialHostTimeZone() {
    try {
      return normalizeTimeZoneId(window.localStorage.getItem(CALENDAR_HOST_TIMEZONE_STORAGE_KEY));
    } catch (_error) {
      return "";
    }
  }

  function persistHostTimeZone(timeZone) {
    if (!safeStorage) {
      return;
    }

    const normalizedTimeZone = normalizeTimeZoneId(timeZone);
    if (!normalizedTimeZone) {
      safeStorage.removeItem(CALENDAR_HOST_TIMEZONE_STORAGE_KEY);
      return;
    }

    safeStorage.setItem(CALENDAR_HOST_TIMEZONE_STORAGE_KEY, normalizedTimeZone);
  }

  function getHostTimeZone() {
    return normalizeTimeZoneId((calendarState && calendarState.hostTimeZone) || initialHostTimeZone)
      || CALENDAR_HOST_TIMEZONE_FALLBACK;
  }

  function normalizeCalendarTimeMode(value) {
    return String(value || "").trim().toLowerCase() === CALENDAR_TIME_MODES.SERVER
      ? CALENDAR_TIME_MODES.SERVER
      : CALENDAR_TIME_MODES.LOCAL;
  }

  function getInitialCalendarTimeMode() {
    try {
      return normalizeCalendarTimeMode(window.localStorage.getItem(CALENDAR_TIME_MODE_STORAGE_KEY));
    } catch (_error) {
      return CALENDAR_TIME_MODES.LOCAL;
    }
  }

  function persistCalendarTimeMode(mode) {
    if (!safeStorage) {
      return;
    }

    safeStorage.setItem(CALENDAR_TIME_MODE_STORAGE_KEY, normalizeCalendarTimeMode(mode));
  }

  function getMediaSlideCount() {
    if (!elements.mediaSliderTrack) {
      return 0;
    }

    return elements.mediaSliderTrack.children.length;
  }

  function renderMediaSlider() {
    if (!elements.mediaSliderTrack) {
      return;
    }

    elements.mediaSliderTrack.style.transform = `translate3d(-${mediaSliderState.index * 100}%, 0, 0)`;
    elements.mediaSliderDots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === mediaSliderState.index;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setMediaSlide(index) {
    const slideCount = getMediaSlideCount();
    if (!slideCount) {
      return;
    }

    mediaSliderState.index = ((Number(index) % slideCount) + slideCount) % slideCount;
    renderMediaSlider();
  }

  function stopMediaSliderAutoplay() {
    if (!mediaSliderState.intervalId) {
      return;
    }

    window.clearInterval(mediaSliderState.intervalId);
    mediaSliderState.intervalId = 0;
  }

  function startMediaSliderAutoplay() {
    if (!elements.mediaSlider || getMediaSlideCount() < 2) {
      return;
    }

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    stopMediaSliderAutoplay();
    mediaSliderState.intervalId = window.setInterval(() => {
      setMediaSlide(mediaSliderState.index + 1);
    }, 6500);
  }

  function initMediaSlider() {
    if (!elements.mediaSlider || !elements.mediaSliderTrack) {
      return;
    }

    renderMediaSlider();
    elements.mediaSliderDots.forEach((dot) => {
      dot.addEventListener("click", () => {
        setMediaSlide(Number(dot.getAttribute("data-media-dot") || 0));
      });
    });

    elements.mediaSlider.addEventListener("mouseenter", stopMediaSliderAutoplay);
    elements.mediaSlider.addEventListener("mouseleave", startMediaSliderAutoplay);
    elements.mediaSlider.addEventListener("focusin", stopMediaSliderAutoplay);
    elements.mediaSlider.addEventListener("focusout", startMediaSliderAutoplay);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopMediaSliderAutoplay();
        return;
      }
      startMediaSliderAutoplay();
    });

    startMediaSliderAutoplay();
  }

  function hasWebsiteSession() {
    return !!authState.me?.account;
  }

  function resetForm(form) {
    if (form && typeof form.reset === "function") {
      form.reset();
    }
  }

  function syncBodyModalLock() {
    const hasOpenModal =
      (elements.creatorContactModal && !elements.creatorContactModal.hidden) ||
      (elements.calendarModal && !elements.calendarModal.hidden) ||
      (elements.websiteAuthModal && !elements.websiteAuthModal.hidden);
    document.body.classList.toggle("modal-open", !!hasOpenModal);
  }

  function setContactMessage(tone, text) {
    if (!elements.creatorContactMessage) {
      return;
    }

    elements.creatorContactMessage.dataset.tone = tone || "";
    elements.creatorContactMessage.textContent = text || "";
  }

  function setCreatorContactCaptchaNote(text, tone = "") {
    if (!elements.creatorContactCaptchaNote) {
      return;
    }

    elements.creatorContactCaptchaNote.dataset.tone = tone || "";
    elements.creatorContactCaptchaNote.textContent = text || "";
  }

  function updateCreatorContactSubmitState() {
    if (!elements.creatorContactSubmit) {
      return;
    }

    const captchaEnabled = !!creatorContactState.captchaConfig?.enabled;
    const hasToken = !!creatorContactState.captchaToken;
    elements.creatorContactSubmit.disabled = creatorContactState.submitting || !captchaEnabled || !hasToken;
  }

  function setCreatorContactSubmitting(isSubmitting) {
    creatorContactState.submitting = !!isSubmitting;
    updateCreatorContactSubmitState();
  }

  function setAuthMessage(tone, text) {
    if (!elements.websiteAuthMessage) {
      return;
    }
    elements.websiteAuthMessage.dataset.tone = tone || "";
    elements.websiteAuthMessage.textContent = text || "";
  }

  function getResolvedUcpHref(mode) {
    if (authState.me) {
      return "/ucp/";
    }
    return String(mode || "").toLowerCase() === "register" ? "/ucp/?auth=register" : "/ucp/?auth=login";
  }

  function setLanguageMenuOpen(isOpen) {
    languageState.menuOpen = !!isOpen;

    if (!elements.topbarLanguageDropdown || !elements.topbarLanguageButton) {
      return;
    }

    elements.topbarLanguageDropdown.classList.toggle("hidden", !languageState.menuOpen);
    elements.topbarLanguageButton.setAttribute("aria-expanded", languageState.menuOpen ? "true" : "false");
  }

  function renderLanguageSelector() {
    const selectedLanguage = getLanguageOption(languageState.value);
    const selectedFlagMarkup = getLanguageFlagMarkup(selectedLanguage);

    if (elements.topbarLanguageFlag) {
      elements.topbarLanguageFlag.innerHTML = selectedFlagMarkup;
    }

    if (elements.topbarLanguageCode) {
      elements.topbarLanguageCode.textContent = selectedLanguage.code;
    }

    document.documentElement.setAttribute("lang", selectedLanguage.langTag || selectedLanguage.value);
    setAttributeValue(elements.topbarLanguageButton, "aria-label", t("language.select"));
    setAttributeValue(elements.topbarLanguageDropdown, "aria-label", t("language.selector"));

    if (!elements.topbarLanguageDropdown) {
      return;
    }

    elements.topbarLanguageDropdown.innerHTML = LANGUAGE_OPTIONS.map((option) => {
      const isActive = option.value === selectedLanguage.value;
      return `
        <button
          class="language-menu__item ${isActive ? "is-active" : ""}"
          type="button"
          data-language-option="${escapeHtml(option.value)}"
          role="option"
          aria-selected="${isActive ? "true" : "false"}"
        >
          <span class="language-menu__item-flag" aria-hidden="true">${getLanguageFlagMarkup(option)}</span>
          <span class="language-menu__item-copy">
            <strong>${escapeHtml(option.label)}</strong>
            <span>${escapeHtml(option.code)}</span>
          </span>
        </button>
      `;
    }).join("");

    elements.topbarLanguageDropdown.querySelectorAll("[data-language-option]").forEach((button) => {
      button.addEventListener("click", () => {
        languageState.value = normalizeLanguageSelection(button.getAttribute("data-language-option"));
        persistLanguageSelection(languageState.value);
        applyCurrentLanguage();
        setLanguageMenuOpen(false);
      });
    });
  }

  function setAccountMenuOpen(isOpen) {
    authState.accountMenuOpen = !!isOpen && !!authState.me;

    if (authState.accountMenuOpen) {
      setLanguageMenuOpen(false);
    }

    if (!elements.topbarAccountDropdown || !elements.topbarAccountButton) {
      return;
    }

    elements.topbarAccountDropdown.classList.toggle("hidden", !authState.accountMenuOpen);
    elements.topbarAccountButton.setAttribute("aria-expanded", authState.accountMenuOpen ? "true" : "false");
  }

  function renderAuthAwareLinks() {
    const signedIn = !!authState.me;
    const username = String(authState.me?.account?.username || "").trim();

    if (elements.topbarSessionButton) {
      elements.topbarSessionButton.classList.toggle("hidden", signedIn);
    }

    if (elements.topbarOpenUcpButton) {
      elements.topbarOpenUcpButton.classList.toggle("hidden", !signedIn);
    }

    if (elements.topbarAccountMenu) {
      elements.topbarAccountMenu.classList.toggle("hidden", !signedIn);
    }

    if (elements.topbarAccountName) {
      elements.topbarAccountName.textContent = username || t("account.defaultName");
    }

    if (!signedIn) {
      setAccountMenuOpen(false);
    }

    elements.authAwareLinks.forEach((link) => {
      link.setAttribute("href", getResolvedUcpHref(link.getAttribute("data-ucp-link")));
    });
  }

  function applyCurrentLanguage() {
    applyStaticTranslations();
    renderLanguageSelector();
    renderAuthAwareLinks();
    renderWebsiteAuthModal();
    renderCalendarTimeModeControls();
    renderCalendarDetail();
    renderHeroCalendarAlert();
    applyCommunityRuntimeState();
  }

  function renderWebsiteAuthModal() {
    const challenge = authState.pendingLoginChallenge;
    const isChallengeStep = !!challenge;

    elements.websiteLoginForm.classList.toggle("hidden", isChallengeStep);
    elements.websiteLoginChallengeForm.classList.toggle("hidden", !isChallengeStep);
    elements.websiteLoginChallengeEmailField.classList.toggle("hidden", !challenge?.requiresEmailOtp);
    elements.websiteLoginChallengeTotpField.classList.toggle("hidden", !challenge?.requiresTotp);

    if (!challenge) {
      elements.websiteLoginChallengeCopy.textContent = t("auth.challengeDefault");
      return;
    }

    const copy = [];
    if (challenge.requiresEmailOtp) {
      copy.push(t("auth.challengeEmail", { email: challenge.emailMasked || t("contactModal.yourEmail") }));
    }
    if (challenge.requiresTotp) {
      copy.push(t("auth.challengeTotp"));
    }
    elements.websiteLoginChallengeCopy.textContent = copy.join(" ");
  }

  function openWebsiteAuthModal(options = {}) {
    if (!options.preserveMessage) {
      setAuthMessage(options.tone || "", options.message || "");
    }
    renderWebsiteAuthModal();
    elements.websiteAuthModal.hidden = false;
    syncBodyModalLock();
  }

  function closeWebsiteAuthModal() {
    elements.websiteAuthModal.hidden = true;
    syncBodyModalLock();
  }

  function openCreatorContactModal(options = {}) {
    if (!options.preserveMessage) {
      setContactMessage(options.tone || "", options.message || "");
    }

    elements.creatorContactModal.hidden = false;
    syncBodyModalLock();
    setCreatorContactCaptchaNote(t("contactModal.loadingVerification"));
    void ensureCreatorContactCaptchaReady();
  }

  function closeCreatorContactModal() {
    elements.creatorContactModal.hidden = true;
    syncBodyModalLock();
    resetCreatorContactCaptcha();
  }

  function getTrimmedFormValue(form, name) {
    return String(form.get(name) || "").trim();
  }

  function buildCreatorContactMailto(form) {
    const name = getTrimmedFormValue(form, "name");
    const email = getTrimmedFormValue(form, "email");
    const subject = getTrimmedFormValue(form, "subject");
    const message = getTrimmedFormValue(form, "message");
    const subjectLine = `${t("contactModal.mailto.subjectPrefix")} ${subject}`;
    const body = [
      t("contactModal.mailto.greeting"),
      "",
      t("contactModal.mailto.interest"),
      "",
      `${t("contactModal.mailto.labelName")}: ${name}`,
      `${t("contactModal.mailto.labelEmail")}: ${email}`,
      `${t("contactModal.mailto.labelSubject")}: ${subject}`,
      "",
      `${t("contactModal.mailto.labelMessage")}:`,
      message,
    ].join("\n");

    return `mailto:${CREATOR_CONTACT_EMAIL}?subject=${encodeURIComponent(subjectLine)}&body=${encodeURIComponent(body)}`;
  }

  async function loadCreatorContactCaptchaConfig(force = false) {
    if (!force && creatorContactState.captchaConfig?.enabled) {
      return creatorContactState.captchaConfig;
    }

    if (!force && creatorContactState.configPromise) {
      return creatorContactState.configPromise;
    }

    creatorContactState.configPromise = (async () => {
      try {
        const payload = await apiFetch("/ucp/api/contact/creator/config");
        const captcha = payload && typeof payload === "object" ? payload.captcha : null;
        const siteKey = captcha && typeof captcha.siteKey === "string" ? captcha.siteKey.trim() : "";
        const config = {
          enabled: !!(captcha && captcha.provider === "turnstile" && siteKey),
          provider: captcha && typeof captcha.provider === "string" ? captcha.provider : "",
          siteKey,
          usesTestKey: !!(captcha && captcha.usesTestKey === true),
        };
        creatorContactState.captchaConfig = config;

        if (!config.enabled) {
          setCreatorContactCaptchaNote(t("contactModal.verificationUnavailable"), "error");
        } else if (config.usesTestKey) {
          setCreatorContactCaptchaNote(t("contactModal.verificationTest"));
        } else {
          setCreatorContactCaptchaNote(t("contactModal.verificationPrompt"));
        }

        updateCreatorContactSubmitState();
        return config;
      } catch (_error) {
        creatorContactState.captchaConfig = null;
        setCreatorContactCaptchaNote(t("contactModal.verificationLoadFailed"), "error");
        updateCreatorContactSubmitState();
        return null;
      } finally {
        creatorContactState.configPromise = null;
      }
    })();

    return creatorContactState.configPromise;
  }

  function ensureCreatorContactCaptchaScript() {
    if (window.turnstile) {
      return Promise.resolve(window.turnstile);
    }

    if (creatorContactState.scriptPromise) {
      return creatorContactState.scriptPromise;
    }

    creatorContactState.scriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-turnstile-script="creator-contact"]');

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(window.turnstile), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Failed to load Turnstile")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = CREATOR_CONTACT_TURNSTILE_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = "creator-contact";
      script.addEventListener("load", () => resolve(window.turnstile), { once: true });
      script.addEventListener("error", () => reject(new Error("Failed to load Turnstile")), { once: true });
      document.head.appendChild(script);
    }).catch((error) => {
      creatorContactState.scriptPromise = null;
      throw error;
    });

    return creatorContactState.scriptPromise;
  }

  function resetCreatorContactCaptcha(options = {}) {
    creatorContactState.captchaToken = "";
    updateCreatorContactSubmitState();

    if (window.turnstile && creatorContactState.captchaWidgetId !== null) {
      try {
        window.turnstile.reset(creatorContactState.captchaWidgetId);
      } catch (_error) {
        // Ignore widget reset issues during modal close or page transitions.
      }
    }

    if (options.keepNote) {
      return;
    }

    if (!creatorContactState.captchaConfig) {
      setCreatorContactCaptchaNote(t("contactModal.loadingVerification"));
    } else if (!creatorContactState.captchaConfig.enabled) {
      setCreatorContactCaptchaNote(t("contactModal.verificationUnavailable"), "error");
    } else if (creatorContactState.captchaConfig.usesTestKey) {
      setCreatorContactCaptchaNote(t("contactModal.verificationTest"));
    } else {
      setCreatorContactCaptchaNote(t("contactModal.verificationPrompt"));
    }
  }

  async function ensureCreatorContactCaptchaReady() {
    if (!elements.creatorContactCaptchaMount) {
      return false;
    }

    const config = await loadCreatorContactCaptchaConfig(!creatorContactState.captchaConfig?.enabled);
    if (!config || !config.enabled) {
      return false;
    }

    try {
      await ensureCreatorContactCaptchaScript();
      await new Promise((resolve) => window.turnstile.ready(resolve));
    } catch (_error) {
      setCreatorContactCaptchaNote(t("contactModal.verificationScriptFailed"), "error");
      return false;
    }

    creatorContactState.captchaToken = "";

    if (creatorContactState.captchaWidgetId === null) {
      elements.creatorContactCaptchaMount.innerHTML = "";
      creatorContactState.captchaWidgetId = window.turnstile.render("#creatorContactCaptchaMount", {
        sitekey: config.siteKey,
        theme: "dark",
        size: "flexible",
        callback(token) {
          creatorContactState.captchaToken = String(token || "").trim();
          setContactMessage("", "");
          setCreatorContactCaptchaNote(
            config.usesTestKey
              ? t("contactModal.verificationCompleteTest")
              : t("contactModal.verificationComplete")
          );
          updateCreatorContactSubmitState();
        },
        "expired-callback"() {
          creatorContactState.captchaToken = "";
          setCreatorContactCaptchaNote(t("contactModal.verificationExpired"), "error");
          updateCreatorContactSubmitState();
        },
        "error-callback"() {
          creatorContactState.captchaToken = "";
          setCreatorContactCaptchaNote(t("contactModal.verificationChallengeFailed"), "error");
          updateCreatorContactSubmitState();
        },
      });
    } else {
      resetCreatorContactCaptcha();
    }

    updateCreatorContactSubmitState();
    return true;
  }

  async function handleWebsiteLogout() {
    try {
      await apiFetch("/ucp/api/auth/logout", { method: "POST" });
    } catch (_error) {
      // Local logout still matters even if server-side logout fails.
    }

    authState.me = null;
    authState.pendingLoginChallenge = null;
    authState.resumeCalendarTicketCategory = "";
    authState.resumeInterestAfterLogin = false;
    setAccountMenuOpen(false);
    renderAuthAwareLinks();
    renderWebsiteAuthModal();
    renderCalendarDetail();
    await loadCalendar();
  }

  async function refreshWebsiteSession(options = {}) {
    try {
      const payload = await apiFetch("/ucp/api/auth/me");
      authState.me = payload;
      renderAuthAwareLinks();
      renderWebsiteAuthModal();
      renderCalendarDetail();
      return payload;
    } catch (error) {
      authState.me = null;
      authState.pendingLoginChallenge = null;
      renderAuthAwareLinks();
      renderWebsiteAuthModal();
      renderCalendarDetail();
      if (!options.silent) {
        setAuthMessage("error", error.message || t("auth.sessionExpired"));
      }
      return null;
    }
  }

  async function completeWebsiteSignIn(username) {
    authState.pendingLoginChallenge = null;
    setAccountMenuOpen(false);
    await refreshWebsiteSession({ silent: true });
    await loadCalendar();
    setAuthMessage(
      "success",
      t("auth.welcomeBack", { username: username || authState.me?.account?.username || t("account.defaultName") })
    );
    closeWebsiteAuthModal();

    if (authState.resumeInterestAfterLogin) {
      authState.resumeInterestAfterLogin = false;
      await toggleInterest();
    }

    if (authState.resumeCalendarTicketCategory) {
      const resumeCategory = authState.resumeCalendarTicketCategory;
      authState.resumeCalendarTicketCategory = "";
      openCalendarTicketComposer(resumeCategory);
    }
  }

  function hideCookieBar() {
    if (!cookieBar) {
      return;
    }
    cookieBar.hidden = true;
    cookieBar.setAttribute("aria-hidden", "true");
  }

  function readCookieValue(name) {
    return document.cookie
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(name + "="));
  }

  function initCookieBar() {
    const hasStoredDismissal =
      safeStorage &&
      storageKeys.some((key) => {
        try {
          return safeStorage.getItem(key) === "1";
        } catch (_error) {
          return false;
        }
      });

    if (hasStoredDismissal || readCookieValue(cookieName) === cookieName + "=1") {
      hideCookieBar();
    }

    dismissButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        hideCookieBar();

        if (safeStorage) {
          storageKeys.forEach((key) => {
            try {
              safeStorage.setItem(key, "1");
            } catch (_error) {
              // Ignore write failures and fall back to cookies.
            }
          });
        }

        document.cookie = cookieName + "=1; Max-Age=31536000; Path=/; SameSite=Lax";
      });
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setCalendarMessage(tone, text) {
    if (!elements.calendarMessage) {
      return;
    }
    elements.calendarMessage.dataset.tone = tone || "";
    elements.calendarMessage.textContent = text || "";
  }

  function normalizeCalendarTicketCategory(value) {
    return String(value || "").trim().toUpperCase() === CALENDAR_TICKET_CATEGORIES.EVENT_SUPPORT
      ? CALENDAR_TICKET_CATEGORIES.EVENT_SUPPORT
      : CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST;
  }

  function getCalendarTicketCopy(category) {
    return {
      introTitle: t("calendar.ticket.introTitle"),
      introCopy: t("calendar.ticket.introCopy"),
      formTitle: t("calendar.ticket.formTitle"),
      formNote: t("calendar.ticket.formNote"),
      placeholder: t("calendar.ticket.placeholder"),
      signInMessage: t("calendar.ticket.signInMessage"),
    };
  }

  function buildCalendarTicketDefaultSubject(category, dateKey) {
    const dateLabel = getDateLabel(dateKey) || t("calendar.dateSelected");
    return t("calendar.ticket.defaultSubject", { date: dateLabel });
  }

  function setCalendarTicketMessage(tone, text) {
    if (!elements.calendarTicketMessage) {
      return;
    }
    elements.calendarTicketMessage.dataset.tone = tone || "";
    elements.calendarTicketMessage.textContent = text || "";
  }

  function setCalendarTicketSubmitting(isSubmitting) {
    calendarTicketState.submitting = !!isSubmitting;

    [
      elements.calendarTicketRequestButton,
      elements.calendarTicketSupportButton,
      elements.calendarTicketSubmit,
      elements.calendarTicketCancel,
      elements.calendarTicketCategory,
      elements.calendarTicketSubject,
      elements.calendarTicketBody,
      ...Array.from(elements.calendarTicketSupportChoiceInputs || []),
    ].forEach((element) => {
      if (element) {
        element.disabled = !!isSubmitting;
      }
    });
  }

  function applyCalendarTicketCategory(category, options = {}) {
    const copy = getCalendarTicketCopy(CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST);
    const nextDefaultSubject = buildCalendarTicketDefaultSubject(CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST, getActiveCalendarDateKey() || calendarTicketState.dateKey);
    const nextNeedsSupport = Object.prototype.hasOwnProperty.call(options, "needsSupport")
      ? !!options.needsSupport
      : !!calendarTicketState.needsSupport;

    calendarTicketState.category = CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST;
    calendarTicketState.needsSupport = nextNeedsSupport;

    if (elements.calendarTicketTitle) {
      elements.calendarTicketTitle.textContent = copy.introTitle;
    }
    if (elements.calendarTicketCopy) {
      elements.calendarTicketCopy.textContent = copy.introCopy;
    }
    if (elements.calendarTicketFormTitle) {
      elements.calendarTicketFormTitle.textContent = copy.formTitle;
    }
    if (elements.calendarTicketFormNote) {
      elements.calendarTicketFormNote.textContent = copy.formNote;
    }
    if (elements.calendarTicketCategory) {
      elements.calendarTicketCategory.value = CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST;
    }
    if (elements.calendarTicketSupportChoiceInputs?.length) {
      const supportValue = nextNeedsSupport ? "yes" : "no";
      elements.calendarTicketSupportChoiceInputs.forEach((input) => {
        input.checked = input.value === supportValue;
      });
    }
    if (elements.calendarTicketBody) {
      elements.calendarTicketBody.placeholder = copy.placeholder;
    }
    if (elements.calendarTicketSubject) {
      const currentSubject = String(elements.calendarTicketSubject.value || "").trim();
      if (options.forceSubject || !currentSubject || currentSubject === calendarTicketState.lastDefaultSubject) {
        elements.calendarTicketSubject.value = nextDefaultSubject;
      }
    }

    calendarTicketState.lastDefaultSubject = nextDefaultSubject;
  }

  function resetCalendarTicketComposer(options = {}) {
    calendarTicketState.open = false;
    calendarTicketState.submitting = false;
    calendarTicketState.category = CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST;
    calendarTicketState.needsSupport = !!options.needsSupport;
    calendarTicketState.lastDefaultSubject = "";

    if (elements.calendarTicketForm) {
      resetForm(elements.calendarTicketForm);
      elements.calendarTicketForm.hidden = true;
    }
    if (elements.calendarTicketActionRow) {
      elements.calendarTicketActionRow.hidden = false;
    }
    if (!options.preserveMessage) {
      setCalendarTicketMessage(options.tone || "", options.text || "");
    }

    applyCalendarTicketCategory(calendarTicketState.category, {
      forceSubject: true,
      needsSupport: calendarTicketState.needsSupport,
    });
    setCalendarTicketSubmitting(false);
  }

  function syncCalendarTicketContext(dateKey) {
    const normalizedDateKey = String(dateKey || "");
    if (calendarTicketState.dateKey === normalizedDateKey) {
      return;
    }

    calendarTicketState.dateKey = normalizedDateKey;
    resetCalendarTicketComposer();
  }

  function renderCalendarTicketPanel(visible) {
    if (!elements.calendarTicketPanel) {
      return;
    }

    const shouldShow = !!visible;
    elements.calendarTicketPanel.hidden = !shouldShow;
    if (!shouldShow) {
      return;
    }

    const hasSession = hasWebsiteSession();
    if (!hasSession) {
      calendarTicketState.open = false;
    }

    applyCalendarTicketCategory(calendarTicketState.category);
    if (elements.calendarTicketCopy) {
      elements.calendarTicketCopy.textContent = hasSession
        ? getCalendarTicketCopy(calendarTicketState.category).introCopy
        : t("calendar.ticket.introCopySignedOut");
    }

    if (elements.calendarTicketRequestButton) {
      elements.calendarTicketRequestButton.textContent = hasSession ? t("calendar.requestEvent") : t("calendar.signInRequestEvent");
    }
    if (elements.calendarTicketActionRow) {
      elements.calendarTicketActionRow.hidden = calendarTicketState.open;
    }
    if (elements.calendarTicketForm) {
      elements.calendarTicketForm.hidden = !calendarTicketState.open;
    }

    setCalendarTicketSubmitting(calendarTicketState.submitting);
  }

  function openCalendarTicketComposer(category) {
    const normalizedCategory = normalizeCalendarTicketCategory(category);
    const needsSupport = normalizedCategory === CALENDAR_TICKET_CATEGORIES.EVENT_SUPPORT;
    const activeDateKey = getActiveCalendarDateKey();
    if (!activeDateKey) {
      return;
    }

    if (!hasWebsiteSession()) {
      authState.resumeCalendarTicketCategory = normalizedCategory;
      openWebsiteAuthModal({
        tone: "error",
        message: getCalendarTicketCopy(normalizedCategory).signInMessage,
      });
      return;
    }

    calendarTicketState.open = true;
    setCalendarTicketMessage("", "");
    applyCalendarTicketCategory(CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST, {
      forceSubject: true,
      needsSupport,
    });
    renderCalendarTicketPanel(true);

    if (elements.calendarTicketBody) {
      elements.calendarTicketBody.focus();
    }
  }

  async function apiFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      method: options.method || "GET",
      credentials: options.credentials || "same-origin",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (_error) {
      payload = text;
    }

    if (!response.ok) {
      const message = payload && typeof payload === "object" && payload.error
        ? payload.error
        : `${response.status} ${response.statusText}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  function getMonthReferenceDate(monthKey) {
    const [yearText, monthText] = String(monthKey || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      return new Date();
    }

    return new Date(Date.UTC(year, month - 1, 15, 12, 0, 0, 0));
  }

  function getCalendarModeTimeZone(timeMode) {
    const mode = normalizeCalendarTimeMode(timeMode);
    return mode === CALENDAR_TIME_MODES.SERVER ? getHostTimeZone() : getBrowserTimeZone();
  }

  function getTimeZoneOffsetMinutesForDate(dateRaw, timeZone) {
    const date = new Date(dateRaw);
    const normalizedTimeZone = normalizeTimeZoneId(timeZone);
    if (Number.isNaN(date.getTime()) || !normalizedTimeZone) {
      return 0;
    }

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: normalizedTimeZone,
      hour12: false,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(date).reduce((accumulator, part) => {
      if (part.type !== "literal") {
        accumulator[part.type] = part.value;
      }
      return accumulator;
    }, {});
    const zonedUtcMillis = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );

    return Math.round((date.getTime() - zonedUtcMillis) / 60000);
  }

  function getShiftedDateForTimeZone(dateRaw, timeZone) {
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      return new Date(NaN);
    }

    return new Date(date.getTime() - getTimeZoneOffsetMinutesForDate(date, timeZone) * 60 * 1000);
  }

  function getCalendarDateParts(date, timeMode) {
    const timeZone = getCalendarModeTimeZone(timeMode);
    if (timeZone) {
      const shiftedDate = getShiftedDateForTimeZone(date, timeZone);
      return {
        year: shiftedDate.getUTCFullYear(),
        month: shiftedDate.getUTCMonth() + 1,
        day: shiftedDate.getUTCDate(),
        weekday: shiftedDate.getUTCDay(),
      };
    }

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      weekday: date.getDay(),
    };
  }

  function getMonthKey(date, timeMode) {
    const parts = getCalendarDateParts(date, timeMode);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }

  function shiftMonthKey(monthKey, amount) {
    const [yearText, monthText] = String(monthKey || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const shifted = new Date(Date.UTC(year, month - 1 + amount, 1, 12, 0, 0, 0));
    return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function getTamrielicMonthName(month) {
    return getTranslatedMonthLabels()[month - 1] || "";
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

  function getDateKey(date, timeMode) {
    const parts = getCalendarDateParts(date, timeMode);
    return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  }

  function getEventDateKey(value, timeMode) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : getDateKey(date, timeMode);
  }

  function getCalendarMonthTzOffsetMinutes(monthKey, timeMode) {
    const timeZone = getCalendarModeTimeZone(timeMode);
    if (timeZone) {
      return getTimeZoneOffsetMinutesForDate(getMonthReferenceDate(monthKey), timeZone);
    }

    return getMonthReferenceDate(monthKey).getTimezoneOffset();
  }

  function formatEventTime(value, timeMode) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const mode = normalizeCalendarTimeMode(timeMode || calendarState.timeMode);
    const options = {
      hour: "numeric",
      minute: "2-digit",
    };
    const timeZone = getCalendarModeTimeZone(mode);
    if (timeZone) {
      options.timeZone = timeZone;
    }

    return new Intl.DateTimeFormat(getCurrentLocaleTag(), options).format(date);
  }

  function formatEventDateTime(value, timeMode) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value || "");
    }

    const mode = normalizeCalendarTimeMode(timeMode || calendarState.timeMode);
    const dateParts = getCalendarDateParts(date, mode);
    const monthName = getTamrielicMonthName(dateParts.month);
    if (!monthName) {
      return String(value || "");
    }

    const weekdayOptions = {
      weekday: "long",
    };
    const timeOptions = {
      hour: "numeric",
      minute: "2-digit",
    };
    const timeZone = getCalendarModeTimeZone(mode);
    if (timeZone) {
      weekdayOptions.timeZone = timeZone;
      timeOptions.timeZone = timeZone;
    }

    const weekday = new Intl.DateTimeFormat(getCurrentLocaleTag(), weekdayOptions).format(date);
    const timeLabel = new Intl.DateTimeFormat(getCurrentLocaleTag(), timeOptions).format(date);

    return `${weekday}, ${dateParts.day} ${monthName} ${dateParts.year}, ${timeLabel}`;
  }

  function buildCalendarCells(monthKey, timeMode) {
    const [yearText, monthText] = String(monthKey || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const mode = normalizeCalendarTimeMode(timeMode || calendarState.timeMode);
    const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const cells = [];
    const todayKey = getDateKey(new Date(), mode);

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({
        dateKey,
        dayNumber: day,
        isToday: dateKey === todayKey,
      });
    }

    return {
      leadingSpacerCount: firstWeekday,
      trailingSpacerCount: Math.max(0, Math.ceil((firstWeekday + daysInMonth) / 7) * 7 - (firstWeekday + daysInMonth)),
      weekRowCount: Math.max(1, Math.ceil((firstWeekday + daysInMonth) / 7)),
      cells,
    };
  }

  function getEventMap(events) {
    return events.reduce((map, event) => {
      const dateKey = getEventDateKey(event.startsAt, calendarState.timeMode);
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

  function getEventsForDateKey(dateKey) {
    if (!dateKey) {
      return [];
    }

    return getEventMap(calendarState.events).get(String(dateKey)) || [];
  }

  function isCancelledEvent(event) {
    return String(event?.status || "").toUpperCase() === "CANCELLED";
  }

  function isUpcomingEvent(event) {
    const startsAt = new Date(event?.startsAt).getTime();
    return !Number.isNaN(startsAt) && startsAt > Date.now() && !isCancelledEvent(event);
  }

  function getHeroCalendarAlertMode(event, now = Date.now()) {
    const startsAt = new Date(event?.startsAt).getTime();
    if (Number.isNaN(startsAt) || isCancelledEvent(event)) {
      return "";
    }
    if (startsAt <= now && startsAt >= now - 60 * 60 * 1000) {
      return "live";
    }
    if (startsAt > now && startsAt <= now + 24 * 60 * 60 * 1000) {
      return "upcoming";
    }
    return "";
  }

  function getHeroCalendarAlertCandidates(events, now = Date.now()) {
    return (Array.isArray(events) ? events : [])
      .map((event) => {
        const startsAt = new Date(event?.startsAt).getTime();
        return {
          event,
          startsAt,
          mode: getHeroCalendarAlertMode(event, now),
        };
      })
      .filter((entry) => entry.mode && !Number.isNaN(entry.startsAt))
      .sort((left, right) => {
        if (left.mode !== right.mode) {
          return left.mode === "live" ? -1 : 1;
        }
        return left.mode === "live"
          ? right.startsAt - left.startsAt
          : left.startsAt - right.startsAt;
      });
  }

  function getPrimaryHeroCalendarAlert(now = Date.now()) {
    return getHeroCalendarAlertCandidates(heroCalendarAlertState.events, now)[0] || null;
  }

  function formatHeroCalendarAlertCountdown(mode, startsAt, now = Date.now()) {
    const differenceMinutes = Math.max(1, Math.ceil(Math.abs(startsAt - now) / 60000));
    if (mode === "live") {
      return t("calendar.heroAlert.startedAt", { time: formatOffsetDifference(differenceMinutes) });
    }
    return `${formatOffsetDifference(differenceMinutes)}`;
  }

  function renderHeroCalendarAlert() {
    if (!elements.heroCalendarAlert) {
      return;
    }

    const now = Date.now();
    const candidates = getHeroCalendarAlertCandidates(heroCalendarAlertState.events, now);
    const primary = candidates[0];

    if (!primary) {
      elements.heroCalendarAlert.hidden = true;
      elements.heroCalendarAlert.removeAttribute("data-mode");
      return;
    }

    const { event, mode, startsAt } = primary;
    const extraCount = Math.max(0, candidates.length - 1);
    const isLive = mode === "live";

    elements.heroCalendarAlert.hidden = false;
    elements.heroCalendarAlert.dataset.mode = mode;
    elements.heroCalendarAlert.setAttribute(
      "aria-label",
      isLive
        ? t("calendar.heroAlert.liveAria", { title: String(event.title || t("hero.calendarEyebrow")) })
        : t("calendar.heroAlert.upcomingAria", { title: String(event.title || t("hero.calendarEyebrow")) })
    );

    if (elements.heroCalendarAlertTitle) {
      elements.heroCalendarAlertTitle.textContent = String(event.title || t("hero.calendarEyebrow"));
    }
    elements.heroCalendarAlert.querySelector(".hero__calendar-alert-kicker").textContent = isLive
      ? t("calendar.heroAlert.liveKicker")
      : t("calendar.heroAlert.upcomingKicker");

    if (elements.heroCalendarAlertCountdown) {
      elements.heroCalendarAlertCountdown.textContent = formatHeroCalendarAlertCountdown(mode, startsAt, now);
    }
    if (elements.heroCalendarAlertTime) {
      elements.heroCalendarAlertTime.textContent = isLive
        ? t("calendar.heroAlert.startedAt", { time: formatEventDateTime(event.startsAt, CALENDAR_TIME_MODES.LOCAL) })
        : formatEventDateTime(event.startsAt, CALENDAR_TIME_MODES.LOCAL);
    }
    if (elements.heroCalendarAlertExtra) {
      elements.heroCalendarAlertExtra.hidden = extraCount < 1;
      elements.heroCalendarAlertExtra.textContent = extraCount
        ? t("calendar.heroAlert.plusMore", { count: formatCountWord(extraCount) })
        : "";
    }
    if (elements.heroCalendarAlertCopy) {
      elements.heroCalendarAlertCopy.textContent = isLive
        ? extraCount
          ? t("calendar.heroAlert.liveCopyMore")
          : t("calendar.heroAlert.liveCopy")
        : extraCount
          ? t("calendar.heroAlert.upcomingCopyMore")
          : t("calendar.heroAlert.upcomingCopy");
    }
  }

  function scheduleHeroCalendarAlertTicker() {
    if (heroCalendarAlertState.tickIntervalId) {
      window.clearInterval(heroCalendarAlertState.tickIntervalId);
    }
    heroCalendarAlertState.tickIntervalId = window.setInterval(() => {
      renderHeroCalendarAlert();
    }, 60000);
  }

  async function loadHeroCalendarAlertEvents() {
    if (!elements.heroCalendarAlert) {
      return;
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const monthKeys = Array.from(new Set([
      getMonthKey(windowStart, CALENDAR_TIME_MODES.LOCAL),
      getMonthKey(now, CALENDAR_TIME_MODES.LOCAL),
      getMonthKey(windowEnd, CALENDAR_TIME_MODES.LOCAL),
    ]));

    try {
      const results = await Promise.all(monthKeys.map((monthKey) => {
        const tzOffsetMinutes = getCalendarMonthTzOffsetMinutes(monthKey, CALENDAR_TIME_MODES.LOCAL);
        return apiFetch(`/ucp/api/community/events?month=${encodeURIComponent(monthKey)}&tzOffsetMinutes=${encodeURIComponent(tzOffsetMinutes)}`);
      }));

      const seenEventIds = new Set();
      heroCalendarAlertState.events = results.flatMap((result) => Array.isArray(result?.events) ? result.events : [])
        .filter((event) => {
          const eventId = String(event?.id || "");
          if (!eventId || seenEventIds.has(eventId)) {
            return false;
          }
          seenEventIds.add(eventId);
          return true;
        });
    } catch (_error) {
      heroCalendarAlertState.events = [];
    }

    renderHeroCalendarAlert();
    scheduleHeroCalendarAlertTicker();
  }

  function getDateLabel(dateKey) {
    const [yearText, monthText, dayText] = String(dateKey || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const monthName = getTamrielicMonthName(month);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || !monthName) {
      return String(dateKey || "");
    }

    return `${formatLocalizedCount(day)} ${monthName} ${formatLocalizedCount(year)}`;
  }

  function getActiveCalendarDateKey() {
    const selectedEvent = getSelectedEvent();
    if (selectedEvent) {
      return getEventDateKey(selectedEvent.startsAt, calendarState.timeMode);
    }

    return String(calendarState.selectedDateKey || "");
  }

  function getDefaultEventIdForDateKey(dateKey) {
    const dateEvents = getEventsForDateKey(dateKey);
    const upcomingEvent = dateEvents.find((event) => isUpcomingEvent(event));
    if (upcomingEvent) {
      return Number(upcomingEvent.id || 0);
    }

    return dateEvents.length ? Number(dateEvents[0].id || 0) : 0;
  }

  function getSelectedEvent() {
    return calendarState.events.find((event) => Number(event.id) === Number(calendarState.selectedEventId)) || null;
  }

  function selectCalendarEvent(eventId) {
    calendarState.selectedEventId = Number(eventId || 0);
    const selectedEvent = getSelectedEvent();
    calendarState.selectedDateKey = selectedEvent
      ? getEventDateKey(selectedEvent.startsAt, calendarState.timeMode)
      : calendarState.selectedDateKey;
    renderCalendarDetail();
  }

  function selectCalendarDate(dateKey) {
    calendarState.selectedDateKey = String(dateKey || "");
    const dateEvents = getEventsForDateKey(calendarState.selectedDateKey);
    const selectedEvent = getSelectedEvent();
    const selectedEventDateKey = selectedEvent
      ? getEventDateKey(selectedEvent.startsAt, calendarState.timeMode)
      : "";

    if (!dateEvents.length) {
      calendarState.selectedEventId = 0;
      renderCalendarDetail();
      return;
    }

    if (selectedEvent && selectedEventDateKey === calendarState.selectedDateKey) {
      renderCalendarDetail();
      return;
    }

    calendarState.selectedEventId = getDefaultEventIdForDateKey(calendarState.selectedDateKey);
    renderCalendarDetail();
  }

  function getNextUpcomingEvent() {
    const now = Date.now();
    return calendarState.events.find((event) => {
      const startsAt = new Date(event.startsAt).getTime();
      return !Number.isNaN(startsAt) && startsAt > now && String(event.status || "").toUpperCase() !== "CANCELLED";
    }) || null;
  }

  function getDefaultCalendarEventId() {
    const nextEvent = getNextUpcomingEvent();
    if (nextEvent) {
      return Number(nextEvent.id);
    }

    return calendarState.events.length ? Number(calendarState.events[0].id) : 0;
  }

  function formatUtcOffset(offsetMinutes) {
    const totalMinutes = -Number(offsetMinutes || 0);
    const sign = totalMinutes >= 0 ? "+" : "-";
    const absoluteMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absoluteMinutes / 60);
    const minutes = absoluteMinutes % 60;

    return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
  }

  function formatOffsetDifference(minutes) {
    const absoluteMinutes = Math.abs(Number(minutes || 0));
    const hours = Math.floor(absoluteMinutes / 60);
    const remainderMinutes = absoluteMinutes % 60;

    if (hours && remainderMinutes) {
      return `${hours}h ${remainderMinutes}m`;
    }
    if (hours) {
      return `${hours}h`;
    }
    return `${remainderMinutes}m`;
  }

  function formatCountWord(value) {
    return formatLocalizedCount(value);
  }

  function getCalendarTimeSyncCopy() {
    const hostOffsetMinutes = getCalendarMonthTzOffsetMinutes(calendarState.month, CALENDAR_TIME_MODES.SERVER);
    const localOffsetMinutes = getCalendarMonthTzOffsetMinutes(calendarState.month, CALENDAR_TIME_MODES.LOCAL);
    const differenceMinutes = localOffsetMinutes - hostOffsetMinutes;
    const modeLead = normalizeCalendarTimeMode(calendarState.timeMode) === CALENDAR_TIME_MODES.SERVER
      ? t("calendar.timeMeta.showingHost")
      : t("calendar.timeMeta.showingLocal");

    if (!differenceMinutes) {
      return `${modeLead} ${t("calendar.timeMeta.hostMatches", { offset: formatUtcOffset(hostOffsetMinutes) })}`;
    }

    return `${modeLead} ${differenceMinutes > 0
      ? t("calendar.timeMeta.hostBehind", {
          offset: formatUtcOffset(hostOffsetMinutes),
          difference: formatOffsetDifference(differenceMinutes),
        })
      : t("calendar.timeMeta.hostAhead", {
          offset: formatUtcOffset(hostOffsetMinutes),
          difference: formatOffsetDifference(differenceMinutes),
        })}`;
  }

  function renderCalendarTimeModeControls() {
    const activeMode = normalizeCalendarTimeMode(calendarState.timeMode);
    elements.calendarTimeModeInputs.forEach((input) => {
      input.checked = String(input.value) === activeMode;
    });
    elements.calendarTimeModeOptions.forEach((option) => {
      option.classList.toggle("is-active", option.getAttribute("data-calendar-time-mode-option") === activeMode);
    });
    if (elements.calendarTimeModeMeta) {
      elements.calendarTimeModeMeta.textContent = getCalendarTimeSyncCopy();
    }
  }

  function renderCalendarGrid() {
    if (!elements.calendarGrid || !elements.calendarMonthLabel) {
      return;
    }

    elements.calendarMonthLabel.textContent = getMonthLabel(calendarState.month);
    const eventMap = getEventMap(calendarState.events);
    const activeDateKey = getActiveCalendarDateKey();
    const calendarGridData = buildCalendarCells(calendarState.month, calendarState.timeMode);
    const leadingSpacerCount = Number(calendarGridData.leadingSpacerCount || 0);
    const trailingSpacerCount = Number(calendarGridData.trailingSpacerCount || 0);
    const weekRowCount = Number(calendarGridData.weekRowCount || 1);
    const cells = Array.isArray(calendarGridData.cells) ? calendarGridData.cells : [];
    elements.calendarGrid.style.gridTemplateRows = `auto repeat(${weekRowCount}, minmax(0, 1fr))`;
    elements.calendarGrid.classList.toggle("calendar-grid--dense", weekRowCount > 5);

    const weekdayMarkup = getTranslatedWeekdayLabels().map((label) => `
      <div class="calendar-weekday">${escapeHtml(label)}</div>
    `).join("");

    const leadingSpacerMarkup = Array.from({ length: leadingSpacerCount }, () => `
      <div class="calendar-day-spacer calendar-day-spacer--leading" aria-hidden="true"></div>
    `).join("");

    const trailingSpacerMarkup = Array.from({ length: trailingSpacerCount }, () => `
      <div class="calendar-day-spacer calendar-day-spacer--trailing" aria-hidden="true"></div>
    `).join("");

    const cellMarkup = cells.map((cell) => {
      const events = eventMap.get(cell.dateKey) || [];
      const upcomingCount = events.filter((event) => isUpcomingEvent(event)).length;
      const noticeText = upcomingCount
        ? t("calendar.monthMetaLede", { count: formatCountWord(upcomingCount) })
        : events.length
          ? t("calendar.listedCount", { count: formatCountWord(events.length) })
          : "";
      const isSelectedDay = cell.dateKey === activeDateKey;

      return `
        <button
          class="calendar-day ${events.length ? "calendar-day--has-events" : ""} ${cell.isToday ? "calendar-day--today" : ""} ${isSelectedDay ? "calendar-day--selected" : ""}"
          type="button"
          data-calendar-date-key="${escapeHtml(cell.dateKey)}"
          aria-pressed="${isSelectedDay ? "true" : "false"}"
          aria-label="${escapeHtml(`${getDateLabel(cell.dateKey)}${noticeText ? `. ${noticeText}.` : `. ${t("calendar.noEvents")}.`}`)}"
        >
          <div class="calendar-day__header">
            <span class="calendar-day__number">${escapeHtml(cell.dayNumber)}</span>
          </div>
          ${noticeText ? `<span class="calendar-day__notice">${escapeHtml(noticeText)}</span>` : ""}
        </button>
      `;
    }).join("");

    elements.calendarGrid.innerHTML = weekdayMarkup + leadingSpacerMarkup + cellMarkup + trailingSpacerMarkup;
    elements.calendarGrid.querySelectorAll("[data-calendar-date-key]").forEach((button) => {
      button.addEventListener("click", () => {
        selectCalendarDate(button.getAttribute("data-calendar-date-key"));
      });
    });
  }

  function renderCalendarDetail() {
    let event = getSelectedEvent();
    const activeDateKey = getActiveCalendarDateKey();
    const dateEvents = activeDateKey ? getEventsForDateKey(activeDateKey) : [];
    const upcomingCount = dateEvents.filter((entry) => isUpcomingEvent(entry)).length;
    const monthLabel = getMonthLabel(calendarState.month);
    const monthEventCount = Math.max(0, Number(calendarState.events.length || 0));

    const setCalendarDetailTitle = (text, mode = "event") => {
      elements.calendarDetailTitle.textContent = text;
      elements.calendarDetailTitle.classList.toggle("calendar-modal__title--context", mode === "context");
    };

    elements.calendarPanelLede.hidden = true;
    elements.calendarPanelLede.textContent = "";
    elements.calendarDetailEventList.hidden = true;
    elements.calendarDetailEventList.innerHTML = "";

    if (!activeDateKey && !event) {
      syncCalendarTicketContext("");
      setCalendarDetailTitle(monthEventCount ? t("calendar.openLedger") : monthLabel, "context");
      elements.calendarModalMeta.innerHTML = monthEventCount
        ? `
        <span class="calendar-modal__meta-item">${escapeHtml(monthLabel)}</span>
        <span class="calendar-modal__meta-item">${escapeHtml(t("calendar.monthMetaLede", { count: formatCountWord(monthEventCount) }))}</span>
      `
        : `<span class="calendar-modal__meta-item">${escapeHtml(monthLabel)}</span>`;
      if (!monthEventCount) {
        elements.calendarPanelLede.hidden = false;
        elements.calendarPanelLede.textContent = t("calendar.noEventsForMonth", { month: monthLabel });
        elements.calendarModalDescription.textContent = t("calendar.quietMonth");
      } else {
        elements.calendarModalDescription.textContent = t("calendar.ledgerIntro");
      }
      renderCalendarTicketPanel(false);
      elements.calendarModalInterestCount.hidden = true;
      elements.calendarInterestButton.hidden = true;
      renderCalendarGrid();
      return;
    }

    if (activeDateKey && !dateEvents.length) {
      syncCalendarTicketContext(activeDateKey);
      setCalendarDetailTitle(getDateLabel(activeDateKey) || t("calendar.dateSelected"), "context");
      elements.calendarPanelLede.hidden = false;
      elements.calendarPanelLede.textContent = t("calendar.noEventsForDate");
      elements.calendarModalMeta.innerHTML = `
        <span class="calendar-modal__meta-item">${escapeHtml(getDateLabel(activeDateKey))}</span>
        <span class="calendar-modal__meta-item">${escapeHtml(t("calendar.noEvents"))}</span>
      `;
      elements.calendarModalDescription.textContent = t("calendar.quietDate");
      renderCalendarTicketPanel(true);
      elements.calendarModalInterestCount.hidden = true;
      elements.calendarInterestButton.hidden = true;
      renderCalendarGrid();
      return;
    }

    if (!event && dateEvents.length) {
      calendarState.selectedEventId = getDefaultEventIdForDateKey(activeDateKey);
      event = getSelectedEvent();
    }

    syncCalendarTicketContext("");
    setCalendarDetailTitle(event.title || t("hero.calendarEyebrow"));
    elements.calendarPanelLede.hidden = false;
    elements.calendarPanelLede.textContent = upcomingCount
      ? t("calendar.dateSelectUpcoming", { count: formatCountWord(upcomingCount), date: getDateLabel(activeDateKey) })
      : t("calendar.dateSelectListed", { count: formatCountWord(dateEvents.length), date: getDateLabel(activeDateKey) });
    const detailMetaItems = [
      `<span class="calendar-modal__meta-item">${escapeHtml(formatEventDateTime(event.startsAt, calendarState.timeMode))}</span>`,
      `<span class="calendar-modal__meta-item calendar-modal__meta-item--status">${escapeHtml(t(`calendar.eventStatus.${String(event.status || "SCHEDULED").toUpperCase()}`) || String(event.status || "SCHEDULED").toUpperCase())}</span>`,
    ];
    if (String(event.createdBy || "").trim()) {
      detailMetaItems.push(`<span class="calendar-modal__meta-item">${escapeHtml(t("calendar.createdBy", { name: event.createdBy }))}</span>`);
    }
    elements.calendarModalMeta.innerHTML = detailMetaItems.join("");
    elements.calendarDetailEventList.hidden = false;
    elements.calendarDetailEventList.innerHTML = dateEvents.map((entry) => `
      <button
        class="calendar-event-chip ${isCancelledEvent(entry) ? "calendar-event-chip--cancelled" : ""} ${Number(entry.id) === Number(calendarState.selectedEventId) ? "calendar-event-chip--selected" : ""}"
        type="button"
        data-detail-event-id="${escapeHtml(entry.id)}"
        aria-pressed="${Number(entry.id) === Number(calendarState.selectedEventId) ? "true" : "false"}"
      >
        <span class="calendar-event-chip__time">${escapeHtml(formatEventTime(entry.startsAt, calendarState.timeMode))}</span>
        <span class="calendar-event-chip__title">${escapeHtml(entry.title)}</span>
      </button>
    `).join("");
    elements.calendarDetailEventList.querySelectorAll("[data-detail-event-id]").forEach((button) => {
      button.addEventListener("click", () => {
        selectCalendarEvent(button.getAttribute("data-detail-event-id"));
      });
    });
    const interestCount = Math.max(0, Number(event.interestCount || 0));
    elements.calendarModalDescription.textContent = event.description || t("calendar.noDescription");
    renderCalendarTicketPanel(false);
    elements.calendarModalInterestCount.hidden = interestCount < 1;
    elements.calendarInterestButton.hidden = false;
    if (interestCount > 0) {
      elements.calendarModalInterestCount.textContent = t("calendar.interestCount", { count: formatCountWord(interestCount) });
    } else {
      elements.calendarModalInterestCount.textContent = "";
    }

    const isUpcoming = isUpcomingEvent(event);
    const isCancelled = isCancelledEvent(event);
    const hasSession = hasWebsiteSession();

    elements.calendarInterestButton.disabled = false;
    if (isCancelled) {
      elements.calendarInterestButton.textContent = t("calendar.cancelled");
      elements.calendarInterestButton.disabled = true;
      renderCalendarGrid();
      return;
    }

    if (!isUpcoming) {
      elements.calendarInterestButton.textContent = t("calendar.eventStarted");
      elements.calendarInterestButton.disabled = true;
      renderCalendarGrid();
      return;
    }

    if (!hasSession) {
      elements.calendarInterestButton.textContent = t("calendar.signInInterest");
      renderCalendarGrid();
      return;
    }

    elements.calendarInterestButton.textContent = event.isInterested ? t("calendar.removeInterest") : t("calendar.markInterested");
    renderCalendarGrid();
  }

  async function setCalendarTimeMode(mode) {
    const nextMode = normalizeCalendarTimeMode(mode);
    if (nextMode === calendarState.timeMode) {
      return;
    }

    const selectedEvent = getSelectedEvent();
    calendarState.timeMode = nextMode;
    persistCalendarTimeMode(nextMode);
    renderCalendarTimeModeControls();
    calendarState.month = getMonthKey(selectedEvent ? new Date(selectedEvent.startsAt) : new Date(), nextMode);
    calendarState.selectedDateKey = selectedEvent
      ? getEventDateKey(selectedEvent.startsAt, nextMode)
      : "";
    await loadCalendar();
  }

  function openCalendarModal(eventId) {
    const requestedEventId = Number(eventId || 0);
    calendarState.selectedEventId = requestedEventId || getDefaultCalendarEventId();
    calendarState.selectedDateKey = calendarState.selectedEventId
      ? getEventDateKey(getSelectedEvent()?.startsAt, calendarState.timeMode)
      : "";
    renderCalendarDetail();
    elements.calendarModal.hidden = false;
    syncBodyModalLock();
  }

  async function openHeroCalendarAlert() {
    const primary = getPrimaryHeroCalendarAlert();
    if (!primary) {
      openCalendarModal(0);
      return;
    }

    calendarState.month = getMonthKey(new Date(primary.event.startsAt), calendarState.timeMode);
    calendarState.selectedEventId = 0;
    calendarState.selectedDateKey = "";
    await loadCalendar();
    openCalendarModal(primary.event.id);
  }

  function closeCalendarModal() {
    elements.calendarModal.hidden = true;
    syncBodyModalLock();
  }

  async function loadCalendar(options = {}) {
    setCalendarMessage("", t("calendar.loading"));
    try {
      const requestedTzOffsetMinutes = getCalendarMonthTzOffsetMinutes(calendarState.month, calendarState.timeMode);
      const hadKnownHostTimeZone = !!normalizeTimeZoneId(calendarState.hostTimeZone);
      const result = await apiFetch(`/ucp/api/community/events?month=${encodeURIComponent(calendarState.month)}&tzOffsetMinutes=${encodeURIComponent(requestedTzOffsetMinutes)}`);
      const resolvedHostTimeZone = normalizeTimeZoneId(result?.hostTimeZone);
      const hostTimeZoneChanged = !!resolvedHostTimeZone && resolvedHostTimeZone !== normalizeTimeZoneId(calendarState.hostTimeZone);

      if (resolvedHostTimeZone) {
        calendarState.hostTimeZone = resolvedHostTimeZone;
        persistHostTimeZone(resolvedHostTimeZone);
      }
      renderCalendarTimeModeControls();

      if (
        normalizeCalendarTimeMode(calendarState.timeMode) === CALENDAR_TIME_MODES.SERVER &&
        !options.skipHostResync &&
        (hostTimeZoneChanged || !hadKnownHostTimeZone)
      ) {
        calendarState.month = getMonthKey(getSelectedEvent()?.startsAt ? new Date(getSelectedEvent().startsAt) : new Date(), CALENDAR_TIME_MODES.SERVER);
        await loadCalendar({ skipHostResync: true });
        return;
      }

      calendarState.month = String(result?.month || calendarState.month);
      calendarState.events = Array.isArray(result?.events) ? result.events : [];

      if (calendarState.selectedEventId && !getSelectedEvent()) {
        calendarState.selectedEventId = 0;
      }
      if (calendarState.selectedDateKey && !getEventsForDateKey(calendarState.selectedDateKey).length) {
        calendarState.selectedDateKey = "";
      }
      if (!calendarState.selectedEventId && !elements.calendarModal.hidden) {
        calendarState.selectedEventId = getDefaultCalendarEventId();
        if (calendarState.selectedEventId) {
          calendarState.selectedDateKey = getEventDateKey(getSelectedEvent()?.startsAt, calendarState.timeMode);
        }
      }

      renderCalendarGrid();
      renderCalendarDetail();

      if (!calendarState.events.length) {
        setCalendarMessage("", t("calendar.noEventsForMonth", { month: getMonthLabel(calendarState.month) }));
      } else {
        setCalendarMessage("", `${t("calendar.listedCount", { count: formatCountWord(calendarState.events.length) })} · ${getMonthLabel(calendarState.month)}`);
      }
    } catch (error) {
      if (error.status === 401 && hasWebsiteSession()) {
        authState.me = null;
        authState.pendingLoginChallenge = null;
        renderAuthAwareLinks();
        renderWebsiteAuthModal();
        renderCalendarDetail();
        await loadCalendar();
        return;
      }
      calendarState.events = [];
      calendarState.selectedEventId = 0;
      calendarState.selectedDateKey = "";
      renderCalendarGrid();
      renderCalendarDetail();
      setCalendarMessage("error", error.message || t("calendar.messages.loadError"));
    }
  }

  async function toggleInterest() {
    const event = getSelectedEvent();
    if (!event) {
      return;
    }

    if (!hasWebsiteSession()) {
      authState.resumeInterestAfterLogin = true;
      openWebsiteAuthModal({
        tone: "",
        message: t("calendar.messages.signInCarry"),
      });
      return;
    }

    try {
      elements.calendarInterestButton.disabled = true;
      const result = await apiFetch(`/ucp/api/community/events/${event.id}/interest`, {
        method: "POST",
        body: {
          interested: !event.isInterested,
        },
      });

      const updatedEvent = result?.event || null;
      if (!updatedEvent) {
        throw new Error(t("calendar.messages.interestError"));
      }

      calendarState.events = calendarState.events.map((entry) =>
        Number(entry.id) === Number(updatedEvent.id) ? updatedEvent : entry
      );

      renderCalendarGrid();
      renderCalendarDetail();
      setCalendarMessage("success", updatedEvent.isInterested ? t("calendar.messages.interestAdded") : t("calendar.messages.interestRemoved"));
    } catch (error) {
      if (error.status === 401) {
        authState.me = null;
        authState.pendingLoginChallenge = null;
        authState.resumeInterestAfterLogin = true;
        renderAuthAwareLinks();
        renderCalendarDetail();
        openWebsiteAuthModal({
          tone: "error",
          message: t("calendar.messages.sessionExpiredInterest"),
        });
        return;
      }
      renderCalendarDetail();
      setCalendarMessage("error", error.message || t("calendar.messages.interestError"));
    }
  }

  async function submitCalendarTicket(event) {
    event.preventDefault();

    const activeDateKey = getActiveCalendarDateKey();
    if (!activeDateKey) {
      setCalendarTicketMessage("error", t("calendar.messages.pickDate"));
      return;
    }

    const category = CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST;
    const form = new FormData(event.currentTarget);
    const needsAdminSupport = String(form.get("needsAdminSupport") || "no").trim().toLowerCase() === "yes";
    const subject = getTrimmedFormValue(form, "subject") || buildCalendarTicketDefaultSubject(category, activeDateKey);
    const message = getTrimmedFormValue(form, "message");

    if (!message) {
      setCalendarTicketMessage("error", t("calendar.messages.addDetails"));
      return;
    }

    if (!hasWebsiteSession()) {
      authState.resumeCalendarTicketCategory = needsAdminSupport ? CALENDAR_TICKET_CATEGORIES.EVENT_SUPPORT : category;
      openWebsiteAuthModal({
        tone: "error",
        message: getCalendarTicketCopy(category).signInMessage,
      });
      return;
    }

    setCalendarTicketSubmitting(true);
    setCalendarTicketMessage("", "");

    try {
      const payload = await apiFetch("/ucp/api/community/tickets", {
        method: "POST",
        body: {
          category,
          subject,
          message: t("calendar.ticket.directSupport", {
            value: needsAdminSupport ? t("calendar.yes") : t("calendar.no"),
            message,
          }),
          requestedDateKey: activeDateKey,
          requestedDateLabel: getDateLabel(activeDateKey),
        },
      });
      const ticketId = Number(payload?.ticket?.id || 0);

      resetCalendarTicketComposer({
        preserveMessage: true,
        category,
        needsSupport: false,
      });
      setCalendarTicketMessage(
        "success",
        ticketId
          ? t("calendar.messages.ticketOpenedWithId", { id: ticketId })
          : t("calendar.messages.ticketOpened")
      );
      renderCalendarTicketPanel(true);
    } catch (error) {
      if (error.status === 401) {
        authState.me = null;
        authState.pendingLoginChallenge = null;
        authState.resumeCalendarTicketCategory = needsAdminSupport ? CALENDAR_TICKET_CATEGORIES.EVENT_SUPPORT : category;
        renderAuthAwareLinks();
        renderCalendarDetail();
        openWebsiteAuthModal({
          tone: "error",
          message: t("calendar.messages.sessionExpiredTicket"),
        });
        return;
      }

      setCalendarTicketMessage("error", error.message || t("calendar.messages.ticketError"));
    } finally {
      setCalendarTicketSubmitting(false);
      renderCalendarTicketPanel(true);
    }
  }

  function wireCalendarEvents() {
    renderCalendarTimeModeControls();

    elements.creatorContactOpenButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openCreatorContactModal();
      });
    });

    elements.calendarOpenButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        openCalendarModal(0);
      });
    });

    if (elements.heroCalendarAlert) {
      elements.heroCalendarAlert.addEventListener("click", async (event) => {
        event.preventDefault();
        await openHeroCalendarAlert();
      });
    }

    elements.calendarTimeModeInputs.forEach((input) => {
      input.addEventListener("change", async () => {
        if (!input.checked) {
          return;
        }

        await setCalendarTimeMode(input.value);
      });
    });

    elements.calendarPrevButton.addEventListener("click", async () => {
      calendarState.month = shiftMonthKey(calendarState.month, -1, calendarState.timeMode);
      calendarState.selectedEventId = 0;
      await loadCalendar();
    });

    elements.calendarNextButton.addEventListener("click", async () => {
      calendarState.month = shiftMonthKey(calendarState.month, 1, calendarState.timeMode);
      calendarState.selectedEventId = 0;
      await loadCalendar();
    });

    elements.calendarModal.addEventListener("click", (event) => {
      if (event.target.closest("[data-calendar-close]")) {
        closeCalendarModal();
      }
    });

    elements.calendarModalClose.addEventListener("click", closeCalendarModal);
    elements.calendarInterestButton.addEventListener("click", toggleInterest);
    elements.calendarTicketRequestButton.addEventListener("click", () => {
      openCalendarTicketComposer(CALENDAR_TICKET_CATEGORIES.EVENT_REQUEST);
    });
    elements.calendarTicketSupportChoiceInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (input.checked) {
          calendarTicketState.needsSupport = input.value === "yes";
        }
      });
    });
    elements.calendarTicketCancel.addEventListener("click", () => {
      resetCalendarTicketComposer({
        category: calendarTicketState.category,
        needsSupport: calendarTicketState.needsSupport,
      });
      renderCalendarTicketPanel(true);
    });
    elements.calendarTicketForm.addEventListener("submit", submitCalendarTicket);
    elements.topbarSessionButton.addEventListener("click", () => {
      openWebsiteAuthModal();
    });

    elements.creatorContactModal.addEventListener("click", (event) => {
      if (event.target.closest("[data-contact-close]")) {
        closeCreatorContactModal();
      }
    });

    elements.creatorContactClose.addEventListener("click", closeCreatorContactModal);
    updateCreatorContactSubmitState();
    elements.creatorContactForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = new FormData(event.currentTarget);
      if (!creatorContactState.captchaToken) {
        setContactMessage("error", t("contactModal.verificationPrompt"));
        await ensureCreatorContactCaptchaReady();
        return;
      }

      setCreatorContactSubmitting(true);
      setContactMessage("", "");

      try {
        await apiFetch("/ucp/api/contact/creator/verify", {
          method: "POST",
          body: {
            turnstileToken: creatorContactState.captchaToken,
          },
        });

        const mailtoHref = buildCreatorContactMailto(form);
        setContactMessage("success", t("contactModal.verificationPassed"));
        resetCreatorContactCaptcha({ keepNote: true });
        window.location.href = mailtoHref;
      } catch (error) {
        setContactMessage("error", error.message || t("contactModal.verificationFailed"));
        await ensureCreatorContactCaptchaReady();
      } finally {
        setCreatorContactSubmitting(false);
      }
    });

    elements.topbarLanguageButton.addEventListener("click", (event) => {
      event.preventDefault();
      setAccountMenuOpen(false);
      setLanguageMenuOpen(!languageState.menuOpen);
    });

    elements.topbarAccountButton.addEventListener("click", (event) => {
      event.preventDefault();
      setLanguageMenuOpen(false);
      setAccountMenuOpen(!authState.accountMenuOpen);
    });

    elements.topbarLogoutButton.addEventListener("click", async () => {
      await handleWebsiteLogout();
    });

    elements.websiteAuthModal.addEventListener("click", (event) => {
      if (event.target.closest("[data-auth-close]")) {
        closeWebsiteAuthModal();
      }
    });

    elements.websiteAuthClose.addEventListener("click", closeWebsiteAuthModal);
    elements.websiteLoginChallengeCancel.addEventListener("click", () => {
      authState.pendingLoginChallenge = null;
      renderWebsiteAuthModal();
      setAuthMessage("", "");
    });

    elements.websiteLoginForm.addEventListener("submit", async (event) => {
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
          authState.pendingLoginChallenge = payload.challenge;
          resetForm(event.currentTarget);
          renderWebsiteAuthModal();
          setAuthMessage("success", t("auth.primaryAccepted"));
          return;
        }

        resetForm(event.currentTarget);
        await completeWebsiteSignIn(payload.account?.username);
      } catch (error) {
        setAuthMessage("error", error.message || t("auth.signInError"));
      }
    });

    elements.websiteLoginChallengeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);

      try {
        const payload = await apiFetch("/ucp/api/auth/login/challenge", {
          method: "POST",
          body: {
            challengeToken: authState.pendingLoginChallenge?.token,
            emailOtp: form.get("emailOtp"),
            totpCode: form.get("totpCode"),
          },
        });

        resetForm(event.currentTarget);
        await completeWebsiteSignIn(payload.account?.username);
      } catch (error) {
        setAuthMessage("error", error.message || t("auth.verificationFailed"));
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !elements.creatorContactModal.hidden) {
        closeCreatorContactModal();
        return;
      }
      if (event.key === "Escape" && !elements.calendarModal.hidden) {
        closeCalendarModal();
        return;
      }
      if (event.key === "Escape" && languageState.menuOpen) {
        setLanguageMenuOpen(false);
        return;
      }
      if (event.key === "Escape" && authState.accountMenuOpen) {
        setAccountMenuOpen(false);
        return;
      }
      if (event.key === "Escape" && !elements.websiteAuthModal.hidden) {
        closeWebsiteAuthModal();
      }
    });

    document.addEventListener("click", (event) => {
      if (authState.accountMenuOpen && !event.target.closest("#topbarAccountMenu")) {
        setAccountMenuOpen(false);
      }

      if (languageState.menuOpen && !event.target.closest("#topbarLanguageMenu")) {
        setLanguageMenuOpen(false);
      }
    });

    window.addEventListener("storage", (event) => {
      if (event.key === LANGUAGE_STORAGE_KEY) {
        languageState.value = normalizeLanguageSelection(event.newValue);
        applyCurrentLanguage();
      }
    });

    window.addEventListener("focus", () => {
      refreshWebsiteSession({ silent: true }).then(() => loadCalendar());
    });
  }

  async function boot() {
    initCookieBar();
    initMediaSlider();
    applyCurrentLanguage();
    await loadDiscordMetrics();
    wireCalendarEvents();
    await refreshWebsiteSession({ silent: true });
    await loadCalendar();
    await loadHeroCalendarAlertEvents();
  }

  boot();
})();
