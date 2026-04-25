const state = {
  bootstrap: null,
  bootstrapErrorStatus: 0,
  dashboard: null,
  tickets: [],
  selectedTicketThread: null,
  submissions: [],
  selectedSubmission: null,
  events: [],
  selectedEvent: null,
  cases: [],
  selectedCase: null,
  roles: [],
  assignments: [],
  audit: [],
  activeView: "dashboard",
};

const elements = {
  nav: document.getElementById("nav"),
  sessionStatus: document.getElementById("sessionStatus"),
  serverLine: document.getElementById("serverLine"),
  globalMessage: document.getElementById("globalMessage"),
  bootstrapBanner: document.getElementById("bootstrapBanner"),
  bootstrapFounderButton: document.getElementById("bootstrapFounderButton"),
  unauthorizedBanner: document.getElementById("unauthorizedBanner"),
  forbiddenBanner: document.getElementById("forbiddenBanner"),
  refreshButton: document.getElementById("refreshButton"),
  summaryGrid: document.getElementById("summaryGrid"),
  identityCard: document.getElementById("identityCard"),
  permissionList: document.getElementById("permissionList"),
  ticketCreateForm: document.getElementById("ticketCreateForm"),
  ticketStatusFilter: document.getElementById("ticketStatusFilter"),
  ticketMineFilter: document.getElementById("ticketMineFilter"),
  ticketsTable: document.getElementById("ticketsTable"),
  ticketDetailEmpty: document.getElementById("ticketDetailEmpty"),
  ticketDetail: document.getElementById("ticketDetail"),
  ticketDetailMeta: document.getElementById("ticketDetailMeta"),
  ticketThread: document.getElementById("ticketThread"),
  ticketReplyForm: document.getElementById("ticketReplyForm"),
  assignTicketToMeButton: document.getElementById("assignTicketToMeButton"),
  resolveTicketButton: document.getElementById("resolveTicketButton"),
  closeTicketButton: document.getElementById("closeTicketButton"),
  applicationStatusFilter: document.getElementById("applicationStatusFilter"),
  applicationsTable: document.getElementById("applicationsTable"),
  applicationDetailEmpty: document.getElementById("applicationDetailEmpty"),
  applicationDetail: document.getElementById("applicationDetail"),
  applicationAnswers: document.getElementById("applicationAnswers"),
  applicationReviews: document.getElementById("applicationReviews"),
  applicationReviewForm: document.getElementById("applicationReviewForm"),
  applicationFailureChecklist: document.getElementById("applicationFailureChecklist"),
  eventsMonthFilter: document.getElementById("eventsMonthFilter"),
  eventsStatusFilter: document.getElementById("eventsStatusFilter"),
  eventsTable: document.getElementById("eventsTable"),
  eventEditorForm: document.getElementById("eventEditorForm"),
  eventEditorHeading: document.getElementById("eventEditorHeading"),
  eventEditorHint: document.getElementById("eventEditorHint"),
  eventSaveButton: document.getElementById("eventSaveButton"),
  eventResetButton: document.getElementById("eventResetButton"),
  eventArchiveButton: document.getElementById("eventArchiveButton"),
  caseCreateForm: document.getElementById("caseCreateForm"),
  caseStatusFilter: document.getElementById("caseStatusFilter"),
  casesTable: document.getElementById("casesTable"),
  caseDetailEmpty: document.getElementById("caseDetailEmpty"),
  caseDetail: document.getElementById("caseDetail"),
  caseSummary: document.getElementById("caseSummary"),
  casePunishments: document.getElementById("casePunishments"),
  punishmentCreateForm: document.getElementById("punishmentCreateForm"),
  staffAssignForm: document.getElementById("staffAssignForm"),
  accountSearchResults: document.getElementById("accountSearchResults"),
  staffRoleSelect: document.getElementById("staffRoleSelect"),
  staffAssignmentsTable: document.getElementById("staffAssignmentsTable"),
  roleMatrix: document.getElementById("roleMatrix"),
  auditTable: document.getElementById("auditTable"),
};

const VIEW_CONFIG = {
  dashboard: { label: "Dashboard", access: () => hasPermission("panel.access"), count: null },
  tickets: { label: "Tickets", access: () => hasPermission("tickets.view"), count: () => state.dashboard?.stats?.openTickets ?? 0 },
  applications: { label: "Applications", access: () => hasPermission("applications.view"), count: () => state.dashboard?.stats?.waitingApplications ?? 0 },
  events: { label: "Events", access: () => hasPermission("events.manage"), count: () => state.events.length },
  moderation: { label: "Moderation", access: () => hasPermission("notes.create"), count: () => state.dashboard?.stats?.openCases ?? 0 },
  staff: { label: "Staff", access: () => hasPermission("staff.roles.assign"), count: () => state.dashboard?.stats?.staffMembers ?? 0 },
  audit: { label: "Audit", access: () => hasPermission("audit.view"), count: null },
};

const PUNISHMENT_OPTIONS = [
  { value: "WARNING", label: "Warning", permission: "moderation.warn" },
  { value: "MUTE", label: "Mute", permission: "moderation.mute" },
  { value: "JAIL", label: "Jail", permission: "moderation.jail" },
  { value: "FREEZE", label: "Freeze", permission: "moderation.freeze" },
  { value: "TEMP_BAN", label: "Temp Ban", permission: "moderation.temp_ban" },
  { value: "PERM_BAN", label: "Perm Ban", permission: "moderation.perm_ban" },
  { value: "NAME_FORCED_CHANGE", label: "Force Rename", permission: "characters.force_rename" },
];

let accountSearchDebounce = null;

if (elements.eventsMonthFilter && !elements.eventsMonthFilter.value) {
  elements.eventsMonthFilter.value = getCurrentMonthKey();
}

function setMessage(tone, text) {
  elements.globalMessage.dataset.tone = tone || "";
  elements.globalMessage.textContent = text || "";
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
    const message = payload && typeof payload === "object" && payload.error
      ? payload.error
      : `${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return payload;
}

function hasPermission(code) {
  return !!state.bootstrap?.staff?.permissions?.includes(code);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hours = String(parsed.getHours()).padStart(2, "0");
  const minutes = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseAnswerDisplayValue(answer) {
  if (answer.answer_text) {
    return answer.answer_text;
  }
  if (!answer.answer_json) {
    return "";
  }
  try {
    const parsed = JSON.parse(answer.answer_json);
    return parsed?.value == null ? "" : String(parsed.value);
  } catch {
    return String(answer.answer_json);
  }
}

function parseJsonObject(value) {
  if (!value) {
    return {};
  }
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function clearPanelState() {
  state.dashboard = null;
  state.tickets = [];
  state.selectedTicketThread = null;
  state.submissions = [];
  state.selectedSubmission = null;
  state.events = [];
  state.selectedEvent = null;
  state.cases = [];
  state.selectedCase = null;
  state.roles = [];
  state.assignments = [];
  state.audit = [];
}

function canAccessView(viewName) {
  const config = VIEW_CONFIG[viewName];
  return config ? config.access() : false;
}

function getFirstAccessibleView() {
  return Object.keys(VIEW_CONFIG).find((viewName) => canAccessView(viewName)) || "dashboard";
}

function buildQueryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === false) {
      return;
    }
    search.set(key, String(value));
  });
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

function formField(form, selector) {
  return form ? form.querySelector(selector) : null;
}

function renderNavigation() {
  const showNav = hasPermission("panel.access");
  elements.nav.classList.toggle("hidden", !showNav);

  if (!canAccessView(state.activeView)) {
    state.activeView = getFirstAccessibleView();
  }

  document.querySelectorAll(".nav__button").forEach((button) => {
    const viewName = button.dataset.view;
    const config = VIEW_CONFIG[viewName];
    const accessible = canAccessView(viewName);
    button.classList.toggle("hidden", !accessible);
    button.classList.toggle("active", accessible && state.activeView === viewName);
    if (!config) {
      return;
    }

    const count = typeof config.count === "function" ? Number(config.count() || 0) : 0;
    button.innerHTML = count > 0
      ? `<span>${escapeHtml(config.label)}</span><span class="nav__badge">${escapeHtml(count)}</span>`
      : `<span>${escapeHtml(config.label)}</span>`;
  });
}

function switchView(viewName) {
  state.activeView = canAccessView(viewName) ? viewName : getFirstAccessibleView();
  renderNavigation();
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.viewPanel === state.activeView);
  });
}

function renderSessionState() {
  const bootstrap = state.bootstrap;
  elements.bootstrapBanner.classList.add("hidden");
  elements.unauthorizedBanner.classList.add("hidden");
  elements.forbiddenBanner.classList.add("hidden");

  if (state.bootstrapErrorStatus === 401 || (!bootstrap && state.bootstrapErrorStatus === 0)) {
    elements.unauthorizedBanner.classList.remove("hidden");
    elements.sessionStatus.textContent = "No UCP session";
    elements.serverLine.textContent = "Sign in to use the panel.";
    return;
  }

  if (state.bootstrapErrorStatus === 403) {
    elements.forbiddenBanner.classList.remove("hidden");
    elements.sessionStatus.textContent = "Authenticated | restricted";
    elements.serverLine.textContent = "This account is signed in, but it does not have admin panel access.";
    return;
  }

  if (!bootstrap) {
    elements.unauthorizedBanner.classList.remove("hidden");
    elements.sessionStatus.textContent = "No UCP session";
    elements.serverLine.textContent = "Sign in to use the panel.";
    return;
  }

  const roleNames = (bootstrap.staff.roles || []).map((role) => role.name);
  elements.sessionStatus.textContent = roleNames.length
    ? `${bootstrap.account.username} | ${roleNames.join(", ")}`
    : `${bootstrap.account.username} | player`;
  elements.serverLine.textContent = `${bootstrap.account.username} on ${bootstrap.selectedCharacter?.name || "no selected character"}`;

  if (bootstrap.founderBootstrapAvailable && !hasPermission("panel.access")) {
    elements.bootstrapBanner.classList.remove("hidden");
  } else if (!hasPermission("panel.access")) {
    elements.forbiddenBanner.classList.remove("hidden");
  }
}

function renderDashboard() {
  const stats = state.dashboard?.stats || {};
  const cards = [
    ["Open Tickets", stats.openTickets ?? 0],
    ["Waiting Applications", stats.waitingApplications ?? 0],
    ["Open Cases", stats.openCases ?? 0],
    ["Active Punishments", stats.activePunishments ?? 0],
    ["Staff Members", stats.staffMembers ?? 0],
  ];

  elements.summaryGrid.innerHTML = cards.map(([label, value]) => `
    <article class="summary-card">
      <div class="summary-card__label">${escapeHtml(label)}</div>
      <div class="summary-card__value">${escapeHtml(value)}</div>
    </article>
  `).join("");

  if (!state.bootstrap) {
    elements.identityCard.innerHTML = "";
    elements.permissionList.innerHTML = "";
    return;
  }

  const rows = [
    ["Account", state.bootstrap.account.username],
    ["Email", state.bootstrap.account.email || "not set"],
    ["Selected Character", state.bootstrap.selectedCharacter?.name || "none"],
    ["Roles", (state.bootstrap.staff.roles || []).map((role) => role.name).join(", ") || "none"],
    ["Rank Value", state.bootstrap.staff.rankValue || 0],
  ];

  elements.identityCard.innerHTML = rows.map(([label, value]) => `
    <div class="key-value__row">
      <div class="key-value__label">${escapeHtml(label)}</div>
      <div>${escapeHtml(value)}</div>
    </div>
  `).join("");

  elements.permissionList.innerHTML = (state.bootstrap.staff.permissions || []).map((permission) => `
    <span class="pill">${escapeHtml(permission)}</span>
  `).join("");
}

function renderTickets() {
  const activeTicketId = Number(state.selectedTicketThread?.ticket?.id || 0);
  const canStaffReply = hasPermission("tickets.reply");
  const canAssign = hasPermission("tickets.assign");
  const canClose = hasPermission("tickets.close");

  const headers = ["ID", "Subject", "Status", "Assigned", "Updated", ""];
  const rows = state.tickets.map((ticket) => `
    <tr data-selected="${Number(ticket.id) === activeTicketId ? 1 : 0}">
      <td>${ticket.id}</td>
      <td>${escapeHtml(ticket.subject)}</td>
      <td>${escapeHtml(ticket.status)}</td>
      <td>${escapeHtml(ticket.assigned_username || "-")}</td>
      <td>${escapeHtml(formatDate(ticket.updated_at))}</td>
      <td><button type="button" data-ticket-open="${ticket.id}">Open</button></td>
    </tr>
  `).join("");

  elements.ticketsTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">No tickets yet.</td></tr>`}</tbody>
  `;

  elements.ticketDetailEmpty.classList.toggle("hidden", !!state.selectedTicketThread);
  elements.ticketDetail.classList.toggle("hidden", !state.selectedTicketThread);
  if (!state.selectedTicketThread) {
    return;
  }

  const { ticket, messages } = state.selectedTicketThread;
  const canReply = canStaffReply || Number(ticket.creator_account_id) === Number(state.bootstrap?.account?.id);
  const internalNoteToggle = formField(elements.ticketReplyForm, 'input[name="internalNote"]');
  const internalNoteLabel = internalNoteToggle?.closest("label");
  const replyButton = formField(elements.ticketReplyForm, 'button[type="submit"]');
  const replyTextarea = formField(elements.ticketReplyForm, 'textarea[name="message"]');

  elements.ticketDetailMeta.innerHTML = `
    <span class="pill">#${ticket.id}</span>
    <span class="pill">${escapeHtml(ticket.status)}</span>
    <span class="pill">${escapeHtml(ticket.category)}</span>
    <span class="muted">Creator: ${escapeHtml(ticket.creator_username)}</span>
    <span class="muted">Assigned: ${escapeHtml(ticket.assigned_username || "nobody")}</span>
  `;

  elements.ticketThread.innerHTML = messages.map((message) => `
    <article class="thread__entry" data-note="${message.is_internal_note ? 1 : 0}">
      <div class="thread__meta">
        ${escapeHtml(message.author_username || "unknown")} | ${escapeHtml(message.author_role_snapshot || "PLAYER")} | ${escapeHtml(formatDate(message.created_at))}${message.is_internal_note ? " | internal" : ""}
      </div>
      <div>${escapeHtml(message.message_text)}</div>
    </article>
  `).join("");

  if (internalNoteToggle) {
    internalNoteToggle.disabled = !canStaffReply;
    if (!canStaffReply) {
      internalNoteToggle.checked = false;
    }
  }
  if (internalNoteLabel) {
    internalNoteLabel.classList.toggle("hidden", !canStaffReply);
  }
  if (replyButton) {
    replyButton.disabled = !canReply;
  }
  if (replyTextarea) {
    replyTextarea.disabled = !canReply;
  }
  elements.assignTicketToMeButton.classList.toggle("hidden", !canAssign);
  elements.resolveTicketButton.classList.toggle("hidden", !canClose);
  elements.closeTicketButton.classList.toggle("hidden", !canClose);
}

function renderApplications() {
  const activeSubmissionId = Number(state.selectedSubmission?.id || 0);
  const canReview = hasPermission("applications.review");
  const canDecide = hasPermission("applications.decide");
  const headers = ["ID", "Form", "Applicant", "Status", "Assigned", ""];
  const rows = state.submissions.map((submission) => `
    <tr data-selected="${Number(submission.id) === activeSubmissionId ? 1 : 0}">
      <td>${submission.id}</td>
      <td>${escapeHtml(submission.form_name)}</td>
      <td>${escapeHtml(submission.account_username)}</td>
      <td>${escapeHtml(submission.status)}</td>
      <td>${escapeHtml(submission.assigned_username || "-")}</td>
      <td><button type="button" data-submission-open="${submission.id}">Open</button></td>
    </tr>
  `).join("");

  elements.applicationsTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">No submissions yet.</td></tr>`}</tbody>
  `;

  elements.applicationDetailEmpty.classList.toggle("hidden", !!state.selectedSubmission);
  elements.applicationDetail.classList.toggle("hidden", !state.selectedSubmission);
  if (!state.selectedSubmission) {
    return;
  }

  elements.applicationAnswers.innerHTML = (state.selectedSubmission.answers || []).map((answer) => `
    <article class="answer-card">
      <div class="thread__meta">${escapeHtml(answer.prompt)}</div>
      <div>${escapeHtml(parseAnswerDisplayValue(answer))}</div>
    </article>
  `).join("");

  elements.applicationReviews.innerHTML = (state.selectedSubmission.reviews || []).map((review) => `
    <article class="review-card">
      <div class="thread__meta">${escapeHtml(review.reviewer_username)} | ${escapeHtml(review.reviewer_role_snapshot || "")} | ${escapeHtml(review.decision)} | ${escapeHtml(formatDate(review.created_at))}</div>
      <div>${escapeHtml(review.comment_text || "")}</div>
      ${(() => {
        const feedback = parseJsonObject(review.feedback_json);
        const failedQuestionKeys = Array.isArray(feedback.failedQuestionKeys)
          ? feedback.failedQuestionKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
          : [];
        if (!failedQuestionKeys.length) {
          return "";
        }
        const failedQuestions = (state.selectedSubmission.answers || [])
          .filter((answer) => failedQuestionKeys.includes(String(answer.question_key || "")))
          .map((answer) => escapeHtml(answer.prompt));
        return `<div class="thread__meta">Failed sections: ${failedQuestions.join(" | ")}</div>`;
      })()}
    </article>
  `).join("") || `<div class="empty-state">No reviews yet.</div>`;

  const decisionSelect = formField(elements.applicationReviewForm, 'select[name="decision"]');
  const assignToMeLabel = formField(elements.applicationReviewForm, 'input[name="assignToMe"]')?.closest("label");
  const reviewButton = formField(elements.applicationReviewForm, 'button[type="submit"]');
  const failureChecklist = elements.applicationFailureChecklist;
  const allowedDecisions = canDecide
    ? [
        { value: "COMMENT", label: "Comment" },
        { value: "REQUEST_CHANGES", label: "Request Changes" },
        { value: "APPROVE", label: "Approve" },
        { value: "DENY", label: "Deny" },
      ]
    : [
        { value: "COMMENT", label: "Comment" },
        { value: "REQUEST_CHANGES", label: "Request Changes" },
      ];

  if (decisionSelect) {
    const currentValue = decisionSelect.value;
    decisionSelect.innerHTML = allowedDecisions.map((entry) => `
      <option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>
    `).join("");
    if (allowedDecisions.some((entry) => entry.value === currentValue)) {
      decisionSelect.value = currentValue;
    }
  }

  if (failureChecklist) {
    const latestReview = Array.isArray(state.selectedSubmission.reviews) && state.selectedSubmission.reviews.length
      ? state.selectedSubmission.reviews[state.selectedSubmission.reviews.length - 1]
      : null;
    const selectedFeedback = parseJsonObject(latestReview?.feedback_json);
    const selectedFailed = new Set(Array.isArray(selectedFeedback.failedQuestionKeys)
      ? selectedFeedback.failedQuestionKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
      : []);
    failureChecklist.innerHTML = `
      <div class="card-title">Failed Question Sections</div>
      ${state.selectedSubmission.answers.map((answer) => `
        <label class="checkbox">
          <input
            name="failedQuestionKeys"
            type="checkbox"
            value="${escapeHtml(answer.question_key)}"
            ${selectedFailed.has(String(answer.question_key || "")) ? "checked" : ""}
          />
          <span>${escapeHtml(answer.prompt)}</span>
        </label>
      `).join("")}
    `;
  }

  elements.applicationReviewForm.classList.toggle("hidden", !canReview);
  if (assignToMeLabel) {
    assignToMeLabel.classList.toggle("hidden", !canReview);
  }
  if (reviewButton) {
    reviewButton.disabled = !canReview;
  }
  updateApplicationReviewFormState();
}

function updateApplicationReviewFormState() {
  const decisionSelect = formField(elements.applicationReviewForm, 'select[name="decision"]');
  if (!decisionSelect || !elements.applicationFailureChecklist) {
    return;
  }
  const decision = String(decisionSelect.value || "").toUpperCase();
  elements.applicationFailureChecklist.classList.toggle("hidden", !(decision === "DENY" || decision === "REQUEST_CHANGES"));
}

function resetEventEditor() {
  state.selectedEvent = null;
  elements.eventEditorForm.reset();
  formField(elements.eventEditorForm, 'input[name="eventId"]').value = "";
  formField(elements.eventEditorForm, 'select[name="status"]').value = "SCHEDULED";
  elements.eventEditorHeading.textContent = "Create Event";
  elements.eventEditorHint.textContent = "Times use your local browser clock while editing, then save as a shared timestamp for players.";
  elements.eventSaveButton.textContent = "Create Event";
  elements.eventArchiveButton.classList.add("hidden");
}

function renderEvents() {
  const activeEventId = Number(state.selectedEvent?.id || 0);
  const headers = ["When", "Title", "Status", "Interested", "Updated", ""];
  const rows = state.events.map((event) => `
    <tr data-selected="${Number(event.id) === activeEventId ? 1 : 0}">
      <td>${escapeHtml(formatDate(event.startsAt))}</td>
      <td>${escapeHtml(event.title)}</td>
      <td>${escapeHtml(event.status)}</td>
      <td>${escapeHtml(event.interestCount)}</td>
      <td>${escapeHtml(formatDate(event.updatedAt))}</td>
      <td><button type="button" data-event-open="${event.id}">Edit</button></td>
    </tr>
  `).join("");

  elements.eventsTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">No events scheduled for this month yet.</td></tr>`}</tbody>
  `;

  if (!state.selectedEvent) {
    resetEventEditor();
    return;
  }

  formField(elements.eventEditorForm, 'input[name="eventId"]').value = String(state.selectedEvent.id);
  formField(elements.eventEditorForm, 'input[name="title"]').value = state.selectedEvent.title || "";
  formField(elements.eventEditorForm, 'input[name="startsAt"]').value = toDateTimeLocalValue(state.selectedEvent.startsAt);
  formField(elements.eventEditorForm, 'select[name="status"]').value = state.selectedEvent.status || "SCHEDULED";
  formField(elements.eventEditorForm, 'textarea[name="description"]').value = state.selectedEvent.description || "";
  elements.eventEditorHeading.textContent = `Edit Event #${state.selectedEvent.id}`;
  elements.eventEditorHint.textContent = `Created by ${state.selectedEvent.createdByUsername || "unknown"} | ${formatDate(state.selectedEvent.createdAt)} | ${state.selectedEvent.interestCount} interested`;
  elements.eventSaveButton.textContent = "Save Changes";
  elements.eventArchiveButton.classList.toggle("hidden", String(state.selectedEvent.status || "").toUpperCase() === "ARCHIVED");
}

function renderModeration() {
  const activeCaseId = Number(state.selectedCase?.id || 0);
  const allowedPunishments = PUNISHMENT_OPTIONS.filter((option) => hasPermission(option.permission));
  const headers = ["ID", "Category", "Severity", "Status", "Summary", ""];
  const rows = state.cases.map((entry) => `
    <tr data-selected="${Number(entry.id) === activeCaseId ? 1 : 0}">
      <td>${entry.id}</td>
      <td>${escapeHtml(entry.category)}</td>
      <td>${escapeHtml(entry.severity)}</td>
      <td>${escapeHtml(entry.status)}</td>
      <td>${escapeHtml(entry.summary)}</td>
      <td><button type="button" data-case-open="${entry.id}">Open</button></td>
    </tr>
  `).join("");

  elements.casesTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted">No moderation cases yet.</td></tr>`}</tbody>
  `;

  elements.caseDetailEmpty.classList.toggle("hidden", !state.selectedCase);
  elements.caseDetail.classList.toggle("hidden", !state.selectedCase);
  if (!state.selectedCase) {
    return;
  }

  const caseInfo = state.selectedCase;
  elements.caseSummary.innerHTML = `
    <article class="answer-card">
      <div><strong>${escapeHtml(caseInfo.summary)}</strong></div>
      <div class="thread__meta">${escapeHtml(caseInfo.category)} | severity ${escapeHtml(caseInfo.severity)} | ${escapeHtml(caseInfo.status)}</div>
      <div>${escapeHtml(caseInfo.description || "")}</div>
    </article>
  `;

  elements.casePunishments.innerHTML = (caseInfo.punishments || []).map((punishment) => `
    <article class="answer-card">
      <div><strong>${escapeHtml(punishment.punishment_type)}</strong></div>
      <div class="thread__meta">${escapeHtml(punishment.status)} | issued ${escapeHtml(formatDate(punishment.issued_at))}</div>
      <div>${escapeHtml(punishment.reason_public || punishment.reason_internal || "")}</div>
    </article>
  `).join("") || `<div class="empty-state">No punishments yet.</div>`;

  const punishmentTypeSelect = formField(elements.punishmentCreateForm, 'select[name="punishmentType"]');
  if (punishmentTypeSelect) {
    punishmentTypeSelect.innerHTML = allowedPunishments.map((option) => `
      <option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>
    `).join("");
  }
  elements.punishmentCreateForm.classList.toggle("hidden", allowedPunishments.length === 0);
}

function renderStaff() {
  elements.staffAssignForm.classList.toggle("hidden", !hasPermission("staff.roles.assign"));
  elements.staffRoleSelect.innerHTML = state.roles.map((role) => `
    <option value="${escapeHtml(role.code)}">${escapeHtml(role.name)}</option>
  `).join("");

  const headers = ["Account", "Role", "Granted", "", ""];
  const rows = state.assignments.map((assignment) => `
    <tr>
      <td>${escapeHtml(assignment.username)}</td>
      <td>${escapeHtml(assignment.role_name)}</td>
      <td>${escapeHtml(formatDate(assignment.created_at))}</td>
      <td>${escapeHtml(assignment.note || "")}</td>
      <td>${hasPermission("staff.roles.assign") ? `<button type="button" data-assignment-revoke="${assignment.id}">Revoke</button>` : ""}</td>
    </tr>
  `).join("");

  elements.staffAssignmentsTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted">No active staff assignments.</td></tr>`}</tbody>
  `;

  elements.roleMatrix.innerHTML = state.roles.map((role) => `
    <article class="role-card">
      <div><strong>${escapeHtml(role.name)}</strong> <span class="muted">(${escapeHtml(role.code)})</span></div>
      <div class="thread__meta">Rank ${escapeHtml(role.rank_value)}</div>
      <div class="pill-list">${(role.permissions || []).map((permission) => `<span class="pill">${escapeHtml(permission)}</span>`).join("")}</div>
    </article>
  `).join("");
}

function renderAudit() {
  const headers = ["When", "Actor", "Action", "Refs", "Details"];
  const rows = state.audit.map((event) => `
    <tr>
      <td>${escapeHtml(formatDate(event.created_at))}</td>
      <td>${escapeHtml(event.actor_account_id || "-")} / ${escapeHtml(event.actor_role_snapshot || "-")}</td>
      <td>${escapeHtml(event.action_code)}</td>
      <td>
        ${event.ticket_id ? `T#${escapeHtml(event.ticket_id)} ` : ""}
        ${event.application_submission_id ? `A#${escapeHtml(event.application_submission_id)} ` : ""}
        ${event.moderation_case_id ? `C#${escapeHtml(event.moderation_case_id)} ` : ""}
      </td>
      <td><code>${escapeHtml(event.details_json || "{}")}</code></td>
    </tr>
  `).join("");

  elements.auditTable.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted">No audit events yet.</td></tr>`}</tbody>
  `;
}

function renderAll() {
  renderNavigation();
  renderSessionState();
  renderDashboard();
  renderTickets();
  renderApplications();
  renderEvents();
  renderModeration();
  renderStaff();
  renderAudit();
  switchView(state.activeView);
}

async function refreshBootstrap() {
  try {
    state.bootstrap = await apiFetch("/admin/api/bootstrap");
    state.bootstrapErrorStatus = 0;
  } catch (error) {
    state.bootstrap = null;
    state.bootstrapErrorStatus = Number(error.status || 0);
    throw error;
  }
}

async function fetchTickets() {
  return hasPermission("tickets.view")
    ? apiFetch(`/admin/api/tickets${buildQueryString({
        status: elements.ticketStatusFilter.value,
        assigned: elements.ticketMineFilter.checked ? "mine" : "",
      })}`).then((result) => result.tickets || [])
    : [];
}

async function fetchApplications() {
  return hasPermission("applications.view")
    ? apiFetch(`/admin/api/applications/submissions${buildQueryString({
        status: elements.applicationStatusFilter.value,
      })}`).then((result) => result.submissions || [])
    : [];
}

async function fetchEvents() {
  return hasPermission("events.manage")
    ? apiFetch(`/admin/api/events${buildQueryString({
        month: elements.eventsMonthFilter.value || getCurrentMonthKey(),
        status: elements.eventsStatusFilter.value,
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      })}`).then((result) => result.events || [])
    : [];
}

async function fetchCases() {
  return hasPermission("notes.create")
    ? apiFetch(`/admin/api/moderation/cases${buildQueryString({
        status: elements.caseStatusFilter.value,
      })}`).then((result) => result.cases || [])
    : [];
}

async function refreshAllData() {
  const selectedTicketId = state.selectedTicketThread?.ticket?.id || null;
  const selectedSubmissionId = state.selectedSubmission?.id || null;
  const selectedEventId = state.selectedEvent?.id || null;
  const selectedCaseId = state.selectedCase?.id || null;

  const [dashboard, tickets, submissions, events, cases, roles, assignments, audit] = await Promise.all([
    apiFetch("/admin/api/dashboard"),
    fetchTickets(),
    fetchApplications(),
    fetchEvents(),
    fetchCases(),
    hasPermission("staff.roles.assign") ? apiFetch("/admin/api/staff/roles").then((result) => result.roles || []) : [],
    hasPermission("staff.roles.assign") ? apiFetch("/admin/api/staff/assignments").then((result) => result.assignments || []) : [],
    hasPermission("audit.view") ? apiFetch("/admin/api/audit").then((result) => result.events || []) : [],
  ]);

  state.dashboard = dashboard;
  state.tickets = tickets;
  state.submissions = submissions;
  state.events = events;
  state.cases = cases;
  state.roles = roles;
  state.assignments = assignments;
  state.audit = audit;

  if (selectedTicketId && state.tickets.some((ticket) => Number(ticket.id) === Number(selectedTicketId))) {
    state.selectedTicketThread = await apiFetch(`/admin/api/tickets/${selectedTicketId}`);
  } else {
    state.selectedTicketThread = null;
  }

  if (selectedSubmissionId && state.submissions.some((submission) => Number(submission.id) === Number(selectedSubmissionId))) {
    const detail = await apiFetch(`/admin/api/applications/submissions/${selectedSubmissionId}`);
    state.selectedSubmission = detail.submission || null;
  } else {
    state.selectedSubmission = null;
  }

  if (selectedEventId && state.events.some((event) => Number(event.id) === Number(selectedEventId))) {
    state.selectedEvent = state.events.find((event) => Number(event.id) === Number(selectedEventId)) || null;
  } else {
    state.selectedEvent = null;
  }

  if (selectedCaseId && state.cases.some((entry) => Number(entry.id) === Number(selectedCaseId))) {
    const detail = await apiFetch(`/admin/api/moderation/cases/${selectedCaseId}`);
    state.selectedCase = detail.case || null;
  } else {
    state.selectedCase = null;
  }
}

async function loadPanel() {
  try {
    setMessage("", "");
    await refreshBootstrap();
    if (!hasPermission("panel.access")) {
      clearPanelState();
      renderAll();
      return;
    }
    await refreshAllData();
    renderAll();
  } catch (error) {
    state.bootstrap = null;
    clearPanelState();
    renderAll();
    if (Number(error.status || 0) === 403) {
      setMessage("", "");
      return;
    }
    setMessage("error", error.message);
  }
}

async function openTicket(ticketId) {
  state.selectedTicketThread = await apiFetch(`/admin/api/tickets/${ticketId}`);
  renderTickets();
}

async function openSubmission(submissionId) {
  const detail = await apiFetch(`/admin/api/applications/submissions/${submissionId}`);
  state.selectedSubmission = detail.submission || null;
  renderApplications();
}

function openEvent(eventId) {
  state.selectedEvent = state.events.find((event) => Number(event.id) === Number(eventId)) || null;
  renderEvents();
}

async function openCase(caseId) {
  const detail = await apiFetch(`/admin/api/moderation/cases/${caseId}`);
  state.selectedCase = detail.case || null;
  renderModeration();
}

function wireNavigation() {
  elements.nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-view]");
    if (!button) {
      return;
    }
    switchView(button.dataset.view);
  });

  elements.refreshButton.addEventListener("click", async () => {
    await loadPanel();
  });
}

function wireBootstrap() {
  elements.bootstrapFounderButton.addEventListener("click", async () => {
    try {
      state.bootstrap = await apiFetch("/admin/api/bootstrap/founder", { method: "POST" });
      await refreshAllData();
      renderAll();
      setMessage("success", "Founder role claimed.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });
}

function wireTicketEvents() {
  elements.ticketStatusFilter.addEventListener("change", loadPanel);
  elements.ticketMineFilter.addEventListener("change", loadPanel);

  elements.ticketCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(elements.ticketCreateForm);
      await apiFetch("/admin/api/tickets", {
        method: "POST",
        body: {
          subject: formData.get("subject"),
          category: formData.get("category"),
          message: formData.get("message"),
        },
      });
      elements.ticketCreateForm.reset();
      await loadPanel();
      setMessage("success", "Ticket opened.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.ticketsTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-ticket-open]");
    if (!button) {
      return;
    }
    try {
      await openTicket(Number(button.dataset.ticketOpen));
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.ticketReplyForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedTicketThread?.ticket?.id) {
      return;
    }
    try {
      const formData = new FormData(elements.ticketReplyForm);
      await apiFetch(`/admin/api/tickets/${state.selectedTicketThread.ticket.id}/messages`, {
        method: "POST",
        body: {
          message: formData.get("message"),
          internalNote: formData.get("internalNote") === "on",
        },
      });
      elements.ticketReplyForm.reset();
      await loadPanel();
      setMessage("success", "Ticket updated.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.assignTicketToMeButton.addEventListener("click", async () => {
    if (!state.selectedTicketThread?.ticket?.id) {
      return;
    }
    try {
      await apiFetch(`/admin/api/tickets/${state.selectedTicketThread.ticket.id}/assign`, {
        method: "POST",
        body: {},
      });
      await loadPanel();
      setMessage("success", "Ticket assigned to you.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.resolveTicketButton.addEventListener("click", async () => {
    if (!state.selectedTicketThread?.ticket?.id) {
      return;
    }
    try {
      await apiFetch(`/admin/api/tickets/${state.selectedTicketThread.ticket.id}/status`, {
        method: "POST",
        body: { status: "RESOLVED" },
      });
      await loadPanel();
      setMessage("success", "Ticket resolved.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.closeTicketButton.addEventListener("click", async () => {
    if (!state.selectedTicketThread?.ticket?.id) {
      return;
    }
    try {
      await apiFetch(`/admin/api/tickets/${state.selectedTicketThread.ticket.id}/status`, {
        method: "POST",
        body: { status: "CLOSED" },
      });
      await loadPanel();
      setMessage("success", "Ticket closed.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });
}

function wireApplicationEvents() {
  elements.applicationStatusFilter.addEventListener("change", loadPanel);

  elements.applicationsTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-submission-open]");
    if (!button) {
      return;
    }
    try {
      await openSubmission(Number(button.dataset.submissionOpen));
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.applicationReviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedSubmission?.id) {
      return;
    }
    try {
      const formData = new FormData(elements.applicationReviewForm);
      await apiFetch(`/admin/api/applications/submissions/${state.selectedSubmission.id}/reviews`, {
        method: "POST",
        body: {
          decision: formData.get("decision"),
          comment: formData.get("comment"),
          assignToMe: formData.get("assignToMe") === "on",
          failedQuestionKeys: formData.getAll("failedQuestionKeys"),
        },
      });
      await loadPanel();
      setMessage("success", "Application review saved.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  formField(elements.applicationReviewForm, 'select[name="decision"]')?.addEventListener("change", updateApplicationReviewFormState);
}

function wireEventEvents() {
  elements.eventsMonthFilter.addEventListener("change", loadPanel);
  elements.eventsStatusFilter.addEventListener("change", loadPanel);

  elements.eventResetButton.addEventListener("click", () => {
    resetEventEditor();
    renderEvents();
  });

  elements.eventsTable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-open]");
    if (!button) {
      return;
    }
    openEvent(Number(button.dataset.eventOpen));
  });

  elements.eventEditorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const isEditing = !!state.selectedEvent?.id;
      const formData = new FormData(elements.eventEditorForm);
      const startsAtInput = String(formData.get("startsAt") || "").trim();
      const startsAt = new Date(startsAtInput);
      if (Number.isNaN(startsAt.getTime())) {
        throw new Error("Start date and time is invalid");
      }

      const body = {
        title: formData.get("title"),
        startsAt: startsAt.toISOString(),
        description: formData.get("description"),
        status: formData.get("status"),
      };

      const response = state.selectedEvent?.id
        ? await apiFetch(`/admin/api/events/${state.selectedEvent.id}`, {
            method: "POST",
            body,
          })
        : await apiFetch("/admin/api/events", {
            method: "POST",
            body,
          });

      state.selectedEvent = response.event || null;
      await loadPanel();
      setMessage("success", isEditing ? "Event updated." : "Event created.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.eventArchiveButton.addEventListener("click", async () => {
    if (!state.selectedEvent?.id) {
      return;
    }
    try {
      state.selectedEvent = await apiFetch(`/admin/api/events/${state.selectedEvent.id}`, {
        method: "POST",
        body: { status: "ARCHIVED" },
      }).then((result) => result.event || null);
      await loadPanel();
      setMessage("success", "Event archived.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });
}

function wireModerationEvents() {
  elements.caseStatusFilter.addEventListener("change", loadPanel);

  elements.caseCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(elements.caseCreateForm);
      await apiFetch("/admin/api/moderation/cases", {
        method: "POST",
        body: {
          summary: formData.get("summary"),
          category: formData.get("category"),
          severity: Number(formData.get("severity")),
          targetAccountId: formData.get("targetAccountId") ? Number(formData.get("targetAccountId")) : null,
          description: formData.get("description"),
        },
      });
      elements.caseCreateForm.reset();
      await loadPanel();
      setMessage("success", "Moderation case opened.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.casesTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-case-open]");
    if (!button) {
      return;
    }
    try {
      await openCase(Number(button.dataset.caseOpen));
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.punishmentCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedCase?.id) {
      return;
    }
    try {
      const formData = new FormData(elements.punishmentCreateForm);
      await apiFetch(`/admin/api/moderation/cases/${state.selectedCase.id}/punishments`, {
        method: "POST",
        body: {
          punishmentType: formData.get("punishmentType"),
          accountId: formData.get("accountId") ? Number(formData.get("accountId")) : null,
          durationHours: formData.get("durationHours") ? Number(formData.get("durationHours")) : null,
          reasonPublic: formData.get("reasonPublic"),
          reasonInternal: formData.get("reasonInternal"),
        },
      });
      await loadPanel();
      setMessage("success", "Punishment added.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });
}

function wireStaffEvents() {
  const accountQueryInput = formField(elements.staffAssignForm, 'input[name="accountQuery"]');
  const accountIdInput = formField(elements.staffAssignForm, 'input[name="accountId"]');

  accountQueryInput.addEventListener("input", () => {
    clearTimeout(accountSearchDebounce);
    const query = accountQueryInput.value.trim();
    if (!query) {
      elements.accountSearchResults.innerHTML = "";
      return;
    }

    accountSearchDebounce = setTimeout(async () => {
      try {
        const result = await apiFetch(`/admin/api/accounts/search?q=${encodeURIComponent(query)}`);
        elements.accountSearchResults.innerHTML = (result.accounts || []).map((account) => `
          <div class="list-box__item" data-account-pick="${account.id}">
            <strong>${escapeHtml(account.username)}</strong><br />
            <span class="muted">ID ${account.id} | ${escapeHtml(account.email || "no email")} | ${account.character_count} characters</span>
          </div>
        `).join("") || `<div class="list-box__item muted">No accounts found.</div>`;
      } catch (error) {
        setMessage("error", error.message);
      }
    }, 250);
  });

  elements.accountSearchResults.addEventListener("click", (event) => {
    const item = event.target.closest("[data-account-pick]");
    if (!item) {
      return;
    }
    accountIdInput.value = item.dataset.accountPick;
  });

  elements.staffAssignForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const formData = new FormData(elements.staffAssignForm);
      await apiFetch("/admin/api/staff/assignments", {
        method: "POST",
        body: {
          accountId: Number(formData.get("accountId")),
          roleCode: formData.get("roleCode"),
          note: formData.get("note"),
        },
      });
      await loadPanel();
      setMessage("success", "Role granted.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });

  elements.staffAssignmentsTable.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-assignment-revoke]");
    if (!button) {
      return;
    }
    try {
      await apiFetch(`/admin/api/staff/assignments/${button.dataset.assignmentRevoke}/revoke`, {
        method: "POST",
        body: {},
      });
      await loadPanel();
      setMessage("success", "Role revoked.");
    } catch (error) {
      setMessage("error", error.message);
    }
  });
}

function wireEvents() {
  wireNavigation();
  wireBootstrap();
  wireTicketEvents();
  wireApplicationEvents();
  wireEventEvents();
  wireModerationEvents();
  wireStaffEvents();
}

switchView("dashboard");
wireEvents();
loadPanel();
