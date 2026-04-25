import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseSync, SupportedValueType } from "node:sqlite";
import { Settings } from "./settings";
import {
  COMMUNITY_EVENT_SCHEMA_SQL,
  getCommunityEventMonthWindow,
  normalizeCommunityEventStartsAt,
  normalizeCommunityEventStatus,
} from "./communityEvents";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  LEGACY_ACCOUNT_SESSION_COOKIE_NAMES,
  isFounderBootstrapAllowed,
  shouldUseSecureCookies,
} from "./httpSecurity";

type KoaContext = any;
type KoaRouter = any;

type SessionContext = {
  session: {
    id: string;
    account_id: number;
    selected_character_id: number | null;
    expires_at: string;
  };
  account: {
    id: number;
    username: string;
    email: string | null;
  };
  selectedCharacter: {
    id: number;
    account_id: number;
    profile_id: number;
    name: string;
    slot_index: number;
  } | null;
};

type StaffSummary = {
  rankValue: number;
  roles: Array<{
    id: number;
    code: string;
    name: string;
    rankValue: number;
  }>;
  permissions: string[];
};

type ApplicationFormRow = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  target_scope: string;
  minimum_reviewer_rank: number | null;
  is_active: number;
  created_at?: string;
  updated_at?: string;
};

type ApplicationQuestionRow = {
  id: number;
  position: number;
  question_key: string;
  prompt: string;
  help_text: string | null;
  field_type: string;
  is_required: number;
  validation_json: string | null;
};

type ApplicationSubmissionDetail = {
  id: number;
  form_id: number;
  account_id: number;
  character_id: number | null;
  status: string;
  assigned_to_account_id: number | null;
  final_decision_by_account_id: number | null;
  final_reason: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  snapshot_json: string | null;
  form_code: string;
  form_name: string;
  account_username: string;
  character_name: string | null;
  assigned_username: string | null;
  answers: Array<Record<string, unknown>>;
  reviews: Array<Record<string, unknown>>;
};

type StaffRoleRow = {
  id: number;
  code: string;
  name: string;
  rank_value: number;
  description: string;
};

type CommunityEventAdminRow = {
  id: number;
  title: string;
  starts_at: string;
  description: string;
  status: string;
  created_by_account_id: number | null;
  updated_by_account_id: number | null;
  created_at: string;
  updated_at: string;
  created_by_username: string | null;
  updated_by_username: string | null;
  interest_count: number;
};

class AdminHttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "AdminHttpError";
  }
}

type WhitelistScenario = {
  id: string;
  prompt: string;
};

const WHITELIST_FORM_CODE = "WHITELIST_RP";
const WHITELIST_WELCOME_MESSAGE = "Welcome to Skyrim: RP. Your application has been approved and your account is now whitelisted.";
const WHITELIST_SCENARIOS: WhitelistScenario[] = [
  {
    id: "market_brawl",
    prompt: "You see your character's close friend start a tavern brawl after getting insulted by a local merchant. Guards have not arrived yet, but several townsfolk are watching. Write how your character would respond while keeping fear, reputation, risk, and consequences believable.",
  },
  {
    id: "wounded_traveler",
    prompt: "A wounded traveler collapses outside the city gate and claims bandits are nearby. Your character has their own plans and limited supplies. Write how they would react realistically, including what they would and would not know ICly.",
  },
  {
    id: "noble_pressure",
    prompt: "A minor noble demands special treatment at a crowded inn and tries to order your character around. The innkeeper looks nervous. Write how your character handles the scene without forcing an outcome or ignoring the social risks.",
  },
  {
    id: "stolen_purse",
    prompt: "Your character notices someone quietly steal a purse in a crowded market. Nobody else seems to see it. Write what your character does, how certain they are, and how they avoid acting on information they could not reasonably prove.",
  },
  {
    id: "dangerous_secret",
    prompt: "Your character overhears part of a suspicious conversation about a planned robbery, but only catches fragments. Write how they respond while respecting uncertainty, rumor, and the difference between suspicion and proof.",
  },
  {
    id: "winter_shortage",
    prompt: "Your character is responsible for helping a household or small business through a harsh winter, but food and coin are running low. Write how they would make decisions under pressure while staying grounded and believable.",
  },
  {
    id: "injured_companion",
    prompt: "A companion of your character is badly injured after a foolish decision that was clearly their fault. Write how your character reacts in the moment and afterward, balancing emotion, realism, and practical survival.",
  },
  {
    id: "guard_questioning",
    prompt: "City guards stop your character for questioning after a crime happened nearby. Your character is innocent, but they dislike authority and have reasons to stay cautious. Write how they handle the interaction without escalating unrealistically.",
  },
];

const STAFF_ROLE_SEEDS = [
  { code: "SUPPORTER", name: "Supporter", rankValue: 10, description: "Half-admin support role for tickets and application review." },
  { code: "EVENT_ORGANISER", name: "Event Organiser", rankValue: 15, description: "Community event role with access to calendar event management only." },
  { code: "ADMIN_1", name: "Admin I", rankValue: 20, description: "Entry moderation role for warnings, kicks, and low-risk interventions." },
  { code: "ADMIN_2", name: "Admin II", rankValue: 30, description: "Intermediate moderation role for mutes, jails, and corrective actions." },
  { code: "ADMIN_3", name: "Admin III", rankValue: 40, description: "Advanced moderation role for temp bans and serious live intervention." },
  { code: "SENIOR_ADMIN", name: "Senior Admin", rankValue: 50, description: "High-trust moderation and case approval role." },
  { code: "MANAGEMENT", name: "Management", rankValue: 60, description: "Staff management, policy, and admin panel governance role." },
  { code: "FOUNDER", name: "Founder", rankValue: 70, description: "Top-level owner role with full system control." },
];

const STAFF_PERMISSION_SEEDS = [
  ["panel.access", "panel", "Access the admin panel."],
  ["players.view", "players", "View player account data."],
  ["players.search", "players", "Search accounts and characters."],
  ["characters.view", "characters", "View character records."],
  ["characters.force_rename", "characters", "Force character rename."],
  ["tickets.view", "tickets", "View support tickets."],
  ["tickets.reply", "tickets", "Reply to support tickets."],
  ["tickets.assign", "tickets", "Assign support tickets."],
  ["tickets.close", "tickets", "Close or reopen support tickets."],
  ["applications.view", "applications", "View RP applications."],
  ["applications.review", "applications", "Review RP applications."],
  ["applications.decide", "applications", "Approve or deny RP applications."],
  ["applications.forms.manage", "applications", "Manage RP application forms."],
  ["events.manage", "community", "Create and update community events."],
  ["notes.create", "moderation", "Create moderation cases and staff notes."],
  ["moderation.warn", "moderation", "Issue warnings."],
  ["moderation.kick", "moderation", "Kick players."],
  ["moderation.mute", "moderation", "Mute players."],
  ["moderation.jail", "moderation", "Jail players/characters."],
  ["moderation.freeze", "moderation", "Freeze players."],
  ["moderation.temp_ban", "moderation", "Issue temporary bans."],
  ["moderation.perm_ban", "moderation", "Issue permanent bans."],
  ["economy.adjust", "gameplay", "Adjust economic state."],
  ["inventory.restore", "gameplay", "Restore or remove items."],
  ["teleport.force", "gameplay", "Force teleport or extraction."],
  ["chat.moderate", "gameplay", "Moderate chat."],
  ["scene.moderate", "gameplay", "Moderate RP scenes."],
  ["audit.view", "security", "View audit events."],
  ["staff.roles.assign", "staff", "Assign or revoke staff roles."],
  ["staff.permissions.override", "staff", "Grant permission overrides."],
  ["reports.export", "reports", "Export reports."],
];

const ROLE_PERMISSION_SEEDS: Record<string, string[]> = {
  SUPPORTER: [
    "panel.access",
    "players.view",
    "characters.view",
    "tickets.view",
    "tickets.reply",
    "tickets.assign",
    "tickets.close",
    "applications.view",
    "applications.review",
    "applications.decide",
  ],
  EVENT_ORGANISER: [
    "panel.access",
    "events.manage",
  ],
  ADMIN_1: [
    "panel.access",
    "players.view",
    "players.search",
    "characters.view",
    "tickets.view",
    "tickets.reply",
    "tickets.assign",
    "tickets.close",
    "applications.view",
    "applications.review",
    "applications.decide",
    "events.manage",
    "notes.create",
    "moderation.warn",
    "moderation.kick",
    "chat.moderate",
    "scene.moderate",
  ],
  ADMIN_2: [
    "panel.access",
    "players.view",
    "players.search",
    "characters.view",
    "characters.force_rename",
    "tickets.view",
    "tickets.reply",
    "tickets.assign",
    "tickets.close",
    "applications.view",
    "applications.review",
    "applications.decide",
    "events.manage",
    "notes.create",
    "moderation.warn",
    "moderation.kick",
    "moderation.mute",
    "moderation.jail",
    "economy.adjust",
    "inventory.restore",
    "chat.moderate",
    "scene.moderate",
  ],
  ADMIN_3: [
    "panel.access",
    "players.view",
    "players.search",
    "characters.view",
    "characters.force_rename",
    "tickets.view",
    "tickets.reply",
    "tickets.assign",
    "tickets.close",
    "applications.view",
    "applications.review",
    "applications.decide",
    "events.manage",
    "notes.create",
    "moderation.warn",
    "moderation.kick",
    "moderation.mute",
    "moderation.jail",
    "moderation.freeze",
    "moderation.temp_ban",
    "economy.adjust",
    "inventory.restore",
    "teleport.force",
    "chat.moderate",
    "scene.moderate",
    "audit.view",
  ],
  SENIOR_ADMIN: [
    "panel.access",
    "players.view",
    "players.search",
    "characters.view",
    "characters.force_rename",
    "tickets.view",
    "tickets.reply",
    "tickets.assign",
    "tickets.close",
    "applications.view",
    "applications.review",
    "applications.decide",
    "events.manage",
    "notes.create",
    "moderation.warn",
    "moderation.kick",
    "moderation.mute",
    "moderation.jail",
    "moderation.freeze",
    "moderation.temp_ban",
    "moderation.perm_ban",
    "economy.adjust",
    "inventory.restore",
    "teleport.force",
    "chat.moderate",
    "scene.moderate",
    "audit.view",
    "reports.export",
  ],
  MANAGEMENT: [
    "panel.access",
    "players.view",
    "players.search",
    "characters.view",
    "characters.force_rename",
    "tickets.view",
    "tickets.reply",
    "tickets.assign",
    "tickets.close",
    "applications.view",
    "applications.review",
    "applications.decide",
    "applications.forms.manage",
    "events.manage",
    "notes.create",
    "moderation.warn",
    "moderation.kick",
    "moderation.mute",
    "moderation.jail",
    "moderation.freeze",
    "moderation.temp_ban",
    "moderation.perm_ban",
    "economy.adjust",
    "inventory.restore",
    "teleport.force",
    "chat.moderate",
    "scene.moderate",
    "audit.view",
    "staff.roles.assign",
    "staff.permissions.override",
    "reports.export",
  ],
  FOUNDER: STAFF_PERMISSION_SEEDS.map((entry) => entry[0]),
};

export const ADMIN_PANEL_ACCESS_COOKIE_NAME = "skyrim_admin_panel_access";
const ADMIN_PANEL_ACCESS_TTL_MS = 1000 * 60 * 60 * 12;

class AdminDatabase {
  constructor(private dbFilePath: string) {
    fs.mkdirSync(path.dirname(this.dbFilePath), { recursive: true });
    this.db = new DatabaseSync(this.dbFilePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.ensureCoreTables();
    this.db.exec(COMMUNITY_EVENT_SCHEMA_SQL);
    this.accountSessionColumns = this.getColumnNames("account_sessions");
    this.ensureAdminTables();
    this.seedStaffModel();
    this.seedDefaultApplicationForm();
  }

  getPanelBootstrap(sessionToken: string, allowFounderBootstrap = false) {
    const session = this.requireSession(sessionToken);
    const staff = this.getStaffSummary(session.account.id);
    const founderBootstrapAvailable = allowFounderBootstrap && this.isFounderBootstrapAvailable();
    if (!founderBootstrapAvailable && !staff.permissions.includes("panel.access")) {
      throw new AdminHttpError(403, "This account does not have admin panel access");
    }
    return {
      account: session.account,
      selectedCharacter: session.selectedCharacter,
      staff,
      founderBootstrapAvailable,
    };
  }

  bootstrapFounder(sessionToken: string, meta: { remoteIp?: string | null }, allowFounderBootstrap = false) {
    if (!allowFounderBootstrap) {
      throw new AdminHttpError(403, "Founder bootstrap is disabled");
    }
    if (!this.isFounderBootstrapAvailable()) {
      throw new AdminHttpError(409, "Founder bootstrap is no longer available");
    }

    const session = this.requireSession(sessionToken);
    const founderRole = this.getRoleByCode("FOUNDER");
    if (!founderRole) {
      throw new Error("Founder role is not configured");
    }

    this.db.prepare(`
      INSERT INTO account_staff_roles (account_id, role_id, granted_by_account_id, note, created_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(session.account.id, founderRole.id, session.account.id, "one-time founder bootstrap", this.nowIso());

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: "FOUNDER",
      actionCode: "staff.bootstrap_founder",
      remoteIp: meta.remoteIp ?? null,
      details: { accountId: session.account.id },
    });

    return this.getPanelBootstrap(sessionToken, allowFounderBootstrap);
  }

  assertPanelAccess(sessionToken: string) {
    return this.requirePermission(sessionToken, "panel.access");
  }

  issuePanelAccessGrant(sessionToken: string, meta: { remoteIp?: string | null }, allowFounderBootstrap = false) {
    const bootstrap = this.getPanelBootstrap(sessionToken, allowFounderBootstrap);
    const token = crypto.randomBytes(32).toString("hex");
    const issuedAt = this.nowIso();
    const expiresAt = new Date(Date.now() + ADMIN_PANEL_ACCESS_TTL_MS).toISOString();

    this.pruneExpiredPanelAccessGrants();
    this.db.prepare(`
      DELETE FROM admin_panel_access_grants
      WHERE account_id = ?
    `).run(bootstrap.account.id);
    this.db.prepare(`
      INSERT INTO admin_panel_access_grants (
        token,
        account_id,
        issued_at,
        expires_at
      )
      VALUES (?, ?, ?, ?)
    `).run(token, bootstrap.account.id, issuedAt, expiresAt);

    this.writeAudit({
      actorAccountId: bootstrap.account.id,
      actorRoleSnapshot: this.getHighestRoleName(bootstrap.account.id),
      actionCode: "panel.access_grant",
      remoteIp: meta.remoteIp ?? null,
      details: { expiresAt },
    });

    return {
      token,
      expiresAt,
      founderBootstrapAvailable: !!bootstrap.founderBootstrapAvailable,
    };
  }

  validatePanelAccessGrant(token: string) {
    const normalizedToken = String(token || "").trim();
    if (!normalizedToken) {
      return null;
    }

    this.pruneExpiredPanelAccessGrants();
    const grant = this.db.prepare(`
      SELECT token, account_id, issued_at, expires_at
      FROM admin_panel_access_grants
      WHERE token = ?
    `).get(normalizedToken) as {
      token: string;
      account_id: number;
      issued_at: string;
      expires_at: string;
    } | undefined;

    if (!grant) {
      return null;
    }

    if (!this.canAccountOpenPanel(Number(grant.account_id))) {
      this.db.prepare(`
        DELETE FROM admin_panel_access_grants
        WHERE token = ?
      `).run(normalizedToken);
      return null;
    }

    return {
      accountId: Number(grant.account_id),
      issuedAt: grant.issued_at,
      expiresAt: grant.expires_at,
    };
  }

  getDashboard(sessionToken: string) {
    const { session, staff } = this.requirePermission(sessionToken, "panel.access");
    const scalar = (sql: string, ...params: SupportedValueType[]) => {
      const row = this.db.prepare(sql).get(...params) as { value: number } | undefined;
      return Number(row?.value || 0);
    };

    return {
      me: session.account,
      staff,
      stats: {
        openTickets: scalar(`SELECT COUNT(*) AS value FROM support_tickets WHERE status IN ('OPEN', 'WAITING_PLAYER', 'WAITING_STAFF')`),
        waitingApplications: scalar(`SELECT COUNT(*) AS value FROM application_submissions WHERE status IN ('SUBMITTED', 'UNDER_REVIEW')`),
        openCases: scalar(`SELECT COUNT(*) AS value FROM moderation_cases WHERE status IN ('OPEN', 'UNDER_REVIEW')`),
        activePunishments: scalar(`SELECT COUNT(*) AS value FROM punishments WHERE status = 'ACTIVE'`),
        staffMembers: scalar(`
          SELECT COUNT(DISTINCT account_id) AS value
          FROM account_staff_roles
          WHERE revoked_at IS NULL
        `),
      },
    };
  }

  listCommunityEvents(sessionToken: string, filters: { month?: string; status?: string; tzOffsetMinutes?: unknown }) {
    this.requirePermission(sessionToken, "events.manage");
    const window = getCommunityEventMonthWindow(filters.month, filters.tzOffsetMinutes, new Date());
    const params: SupportedValueType[] = [window.startIso, window.endIso];
    let statusClause = `e.status <> 'ARCHIVED'`;

    if (filters.status) {
      const status = normalizeCommunityEventStatus(filters.status, { allowArchived: true });
      statusClause = `e.status = ?`;
      params.push(status);
    }

    const rows = this.db.prepare(`
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.description,
        e.status,
        e.created_by_account_id,
        e.updated_by_account_id,
        e.created_at,
        e.updated_at,
        ca.username AS created_by_username,
        ua.username AS updated_by_username,
        COALESCE(ic.interest_count, 0) AS interest_count
      FROM community_events e
      LEFT JOIN accounts ca ON ca.id = e.created_by_account_id
      LEFT JOIN accounts ua ON ua.id = e.updated_by_account_id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS interest_count
        FROM community_event_interests
        GROUP BY event_id
      ) ic ON ic.event_id = e.id
      WHERE e.starts_at >= ?
        AND e.starts_at < ?
        AND ${statusClause}
      ORDER BY e.starts_at ASC, e.id ASC
    `).all(...params) as CommunityEventAdminRow[];

    return {
      month: window.month,
      tzOffsetMinutes: window.tzOffsetMinutes,
      events: rows.map((row) => this.mapCommunityEvent(row)),
    };
  }

  createCommunityEvent(
    sessionToken: string,
    payload: { title?: string; startsAt?: string; description?: string; status?: string },
    meta: { remoteIp?: string | null }
  ) {
    const { session } = this.requirePermission(sessionToken, "events.manage");
    const title = this.normalizeCommunityEventTitle(payload.title);
    const startsAt = normalizeCommunityEventStartsAt(payload.startsAt);
    const description = this.normalizeCommunityEventDescription(payload.description);
    const status = normalizeCommunityEventStatus(payload.status, { allowArchived: false });
    const now = this.nowIso();

    const insert = this.db.prepare(`
      INSERT INTO community_events (
        title,
        starts_at,
        description,
        status,
        created_by_account_id,
        updated_by_account_id,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      startsAt,
      description,
      status,
      session.account.id,
      session.account.id,
      now,
      now
    );

    const eventId = Number(insert.lastInsertRowid);
    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "events.create",
      remoteIp: meta.remoteIp ?? null,
      details: { eventId, title, startsAt, status },
    });

    const created = this.getCommunityEventById(eventId);
    if (!created) {
      throw new AdminHttpError(404, "Event not found");
    }

    return created;
  }

  updateCommunityEvent(
    sessionToken: string,
    eventId: number,
    payload: { title?: string; startsAt?: string; description?: string; status?: string },
    meta: { remoteIp?: string | null }
  ) {
    const { session } = this.requirePermission(sessionToken, "events.manage");
    const existing = this.getCommunityEventById(eventId);
    if (!existing) {
      throw new AdminHttpError(404, "Event not found");
    }

    const title = payload.title === undefined
      ? String(existing.title)
      : this.normalizeCommunityEventTitle(payload.title);
    const startsAt = payload.startsAt === undefined
      ? String(existing.startsAt)
      : normalizeCommunityEventStartsAt(payload.startsAt);
    const description = payload.description === undefined
      ? String(existing.description)
      : this.normalizeCommunityEventDescription(payload.description);
    const status = payload.status === undefined
      ? String(existing.status)
      : normalizeCommunityEventStatus(payload.status, { allowArchived: true });
    const now = this.nowIso();

    this.db.prepare(`
      UPDATE community_events
      SET
        title = ?,
        starts_at = ?,
        description = ?,
        status = ?,
        updated_by_account_id = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      title,
      startsAt,
      description,
      status,
      session.account.id,
      now,
      eventId
    );

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: status === "ARCHIVED" ? "events.archive" : "events.update",
      remoteIp: meta.remoteIp ?? null,
      details: {
        eventId,
        title,
        startsAt,
        status,
        previousStatus: existing.status,
      },
    });

    const updated = this.getCommunityEventById(eventId);
    if (!updated) {
      throw new AdminHttpError(404, "Event not found");
    }

    return updated;
  }

  listTickets(sessionToken: string, filters: { status?: string; assignedToMe?: boolean }) {
    const { session } = this.requirePermission(sessionToken, "tickets.view");
    const conditions: string[] = [];
    const params: SupportedValueType[] = [];

    if (filters.status) {
      conditions.push(`t.status = ?`);
      params.push(filters.status);
    }
    if (filters.assignedToMe) {
      conditions.push(`t.assigned_to_account_id = ?`);
      params.push(session.account.id);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db.prepare(`
      SELECT
        t.id,
        t.subject,
        t.category,
        t.status,
        t.priority,
        t.creator_account_id,
        t.creator_character_id,
        t.assigned_to_account_id,
        t.created_at,
        t.updated_at,
        t.last_staff_reply_at,
        t.last_player_reply_at,
        a.username AS creator_username,
        aa.username AS assigned_username,
        (
          SELECT COUNT(*)
          FROM support_ticket_messages tm
          WHERE tm.ticket_id = t.id
        ) AS message_count
      FROM support_tickets t
      JOIN accounts a ON a.id = t.creator_account_id
      LEFT JOIN accounts aa ON aa.id = t.assigned_to_account_id
      ${whereClause}
      ORDER BY t.updated_at DESC, t.id DESC
      LIMIT 200
    `).all(...params) as Array<Record<string, unknown>>;

    return rows;
  }

  createTicket(sessionToken: string, payload: { subject?: string; category?: string; message?: string }, meta: { remoteIp?: string | null }) {
    const session = this.requireSession(sessionToken);
    const subject = String(payload.subject || "").trim();
    const category = String(payload.category || "GENERAL").trim() || "GENERAL";
    const message = String(payload.message || "").trim();

    if (!subject) {
      throw new Error("Ticket subject is required");
    }
    if (!message) {
      throw new Error("Ticket message is required");
    }

    const now = this.nowIso();
    const insert = this.db.prepare(`
      INSERT INTO support_tickets (
        creator_account_id,
        creator_character_id,
        subject,
        category,
        status,
        priority,
        created_at,
        updated_at,
        last_player_reply_at
      )
      VALUES (?, ?, ?, ?, 'OPEN', 'NORMAL', ?, ?, ?)
    `).run(
      session.account.id,
      session.selectedCharacter?.id ?? null,
      subject,
      category,
      now,
      now,
      now
    );

    const ticketId = Number(insert.lastInsertRowid);
    this.db.prepare(`
      INSERT INTO support_ticket_messages (
        ticket_id,
        author_account_id,
        author_character_id,
        author_role_snapshot,
        is_internal_note,
        message_text,
        created_at
      )
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(
      ticketId,
      session.account.id,
      session.selectedCharacter?.id ?? null,
      this.getHighestRoleName(session.account.id),
      message,
      now
    );

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "tickets.create",
      ticketId,
      remoteIp: meta.remoteIp ?? null,
      details: { subject, category },
    });

    return this.getTicketById(ticketId);
  }

  replyToTicket(sessionToken: string, ticketId: number, payload: { message?: string; internalNote?: boolean }, meta: { remoteIp?: string | null }) {
    const session = this.requireSession(sessionToken);
    const ticket = this.getTicketById(ticketId);
    if (!ticket) {
      throw new AdminHttpError(404, "Ticket not found");
    }

    const message = String(payload.message || "").trim();
    if (!message) {
      throw new Error("Reply message is required");
    }

    const isInternalNote = payload.internalNote === true;
    const staff = this.getStaffSummary(session.account.id);
    if (isInternalNote && !staff.permissions.includes("tickets.reply")) {
      throw new AdminHttpError(403, "Missing permission tickets.reply");
    }

    const isOwner = Number(ticket.creator_account_id) === session.account.id;
    if (!isOwner && !staff.permissions.includes("tickets.reply")) {
      throw new AdminHttpError(403, "You are not allowed to reply to this ticket");
    }

    const now = this.nowIso();
    this.db.prepare(`
      INSERT INTO support_ticket_messages (
        ticket_id,
        author_account_id,
        author_character_id,
        author_role_snapshot,
        is_internal_note,
        message_text,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      ticketId,
      session.account.id,
      session.selectedCharacter?.id ?? null,
      this.getHighestRoleName(session.account.id),
      isInternalNote ? 1 : 0,
      message,
      now
    );

    const nextStatus = staff.permissions.includes("tickets.reply")
      ? "WAITING_PLAYER"
      : "WAITING_STAFF";

    this.db.prepare(`
      UPDATE support_tickets
      SET
        status = ?,
        updated_at = ?,
        last_staff_reply_at = CASE WHEN ? = 1 THEN ? ELSE last_staff_reply_at END,
        last_player_reply_at = CASE WHEN ? = 0 THEN ? ELSE last_player_reply_at END
      WHERE id = ?
    `).run(
      nextStatus,
      now,
      staff.permissions.includes("tickets.reply") ? 1 : 0,
      now,
      staff.permissions.includes("tickets.reply") ? 1 : 0,
      now,
      ticketId
    );

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: isInternalNote ? "tickets.internal_note" : "tickets.reply",
      ticketId,
      remoteIp: meta.remoteIp ?? null,
      details: { byStaff: staff.permissions.includes("tickets.reply") },
    });

    return this.getTicketThread(ticketId);
  }

  assignTicket(sessionToken: string, ticketId: number, assignedToAccountId: number | null, meta: { remoteIp?: string | null }) {
    const { session } = this.requirePermission(sessionToken, "tickets.assign");
    if (!this.getTicketById(ticketId)) {
      throw new AdminHttpError(404, "Ticket not found");
    }

    const assignedTo = assignedToAccountId ?? session.account.id;
    const targetStaff = this.getStaffSummary(assignedTo);
    if (!targetStaff.permissions.includes("tickets.reply")) {
      throw new Error("Target account is not staff-capable for tickets");
    }

    const now = this.nowIso();
    this.db.prepare(`
      UPDATE support_tickets
      SET assigned_to_account_id = ?, updated_at = ?
      WHERE id = ?
    `).run(assignedTo, now, ticketId);

    this.db.prepare(`
      INSERT INTO support_ticket_assignments (
        ticket_id,
        assigned_to_account_id,
        assigned_by_account_id,
        note,
        assigned_at,
        unassigned_at
      )
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(ticketId, assignedTo, session.account.id, "assigned from admin panel", now);

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "tickets.assign",
      ticketId,
      remoteIp: meta.remoteIp ?? null,
      details: { assignedToAccountId: assignedTo },
    });

    return this.getTicketById(ticketId);
  }

  setTicketStatus(sessionToken: string, ticketId: number, status: string, meta: { remoteIp?: string | null }) {
    const { session } = this.requirePermission(sessionToken, "tickets.close");
    const normalized = String(status || "").trim().toUpperCase();
    const allowed = new Set(["OPEN", "WAITING_PLAYER", "WAITING_STAFF", "RESOLVED", "CLOSED"]);
    if (!allowed.has(normalized)) {
      throw new AdminHttpError(400, "Invalid ticket status");
    }

    if (!this.getTicketById(ticketId)) {
      throw new AdminHttpError(404, "Ticket not found");
    }

    const now = this.nowIso();
    this.db.prepare(`
      UPDATE support_tickets
      SET
        status = ?,
        updated_at = ?,
        closed_at = CASE WHEN ? = 'CLOSED' THEN ? ELSE closed_at END
      WHERE id = ?
    `).run(normalized, now, normalized, now, ticketId);

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "tickets.status",
      ticketId,
      remoteIp: meta.remoteIp ?? null,
      details: { status: normalized },
    });

    return this.getTicketById(ticketId);
  }

  listTicketThread(sessionToken: string, ticketId: number) {
    const session = this.requireSession(sessionToken);
    const ticket = this.getTicketById(ticketId);
    if (!ticket) {
      throw new AdminHttpError(404, "Ticket not found");
    }
    const staff = this.getStaffSummary(session.account.id);
    const isOwner = Number(ticket.creator_account_id) === session.account.id;
    if (!isOwner && !staff.permissions.includes("tickets.view")) {
      throw new AdminHttpError(403, "Missing permission tickets.view");
    }
    return this.getTicketThread(ticketId, !staff.permissions.includes("tickets.view"));
  }

  listApplicationForms(sessionToken: string | null, includeInactive = false) {
    if (sessionToken) {
      this.requireSession(sessionToken);
    }
    const where = includeInactive ? "" : "WHERE is_active = 1";
    const forms = this.db.prepare(`
      SELECT id, code, name, description, target_scope, minimum_reviewer_rank, is_active, created_at, updated_at
      FROM application_forms
      ${where}
      ORDER BY id ASC
    `).all() as ApplicationFormRow[];

    return forms.map((form) => ({
      ...form,
      questions: this.db.prepare(`
        SELECT id, position, question_key, prompt, help_text, field_type, is_required, validation_json
        FROM application_questions
        WHERE form_id = ?
        ORDER BY position ASC, id ASC
      `).all(form.id) as ApplicationQuestionRow[],
    }));
  }

  submitApplication(sessionToken: string, payload: { formCode?: string; characterId?: number | null; answers?: Array<{ questionKey?: string; value?: unknown }> }, meta: { remoteIp?: string | null }) {
    const session = this.requireSession(sessionToken);
    const formCode = String(payload.formCode || "").trim();
    if (!formCode) {
      throw new Error("formCode is required");
    }

    const form = this.db.prepare(`
      SELECT id, code, name, description, target_scope, minimum_reviewer_rank, is_active
      FROM application_forms
      WHERE code = ? AND is_active = 1
    `).get(formCode) as ApplicationFormRow | undefined;
    if (!form) {
      throw new AdminHttpError(404, "Application form not found");
    }

    let characterId: number | null = null;
    if (String(form.target_scope) === "CHARACTER") {
      const requestedCharacterId = payload.characterId === undefined || payload.characterId === null
        ? session.selectedCharacter?.id ?? null
        : Number(payload.characterId);
      if (!requestedCharacterId || !Number.isInteger(requestedCharacterId)) {
        throw new Error("characterId is required for this application");
      }
      const ownedCharacter = this.db.prepare(`
        SELECT id
        FROM characters
        WHERE id = ? AND account_id = ?
      `).get(requestedCharacterId, session.account.id) as { id: number } | undefined;
      if (!ownedCharacter) {
        throw new AdminHttpError(404, "Character not found");
      }
      characterId = ownedCharacter.id;
    }

    const answersInput = Array.isArray(payload.answers) ? payload.answers : [];
    const questions = this.db.prepare(`
      SELECT id, question_key, prompt, field_type, is_required
      FROM application_questions
      WHERE form_id = ?
      ORDER BY position ASC, id ASC
    `).all(form.id) as Array<Pick<ApplicationQuestionRow, "id" | "question_key" | "prompt" | "field_type" | "is_required">>;

    const answerMap = new Map<string, unknown>();
    for (const answer of answersInput) {
      const key = String(answer?.questionKey || "").trim();
      if (!key) {
        continue;
      }
      answerMap.set(key, answer?.value ?? "");
    }

    for (const question of questions) {
      if (Number(question.is_required) === 1) {
        const value = answerMap.get(String(question.question_key));
        const normalized = typeof value === "string" ? value.trim() : value;
        if (normalized === undefined || normalized === null || normalized === "") {
          throw new Error(`Missing answer for "${question.prompt}"`);
        }
      }
    }

    const now = this.nowIso();
    const insert = this.db.prepare(`
      INSERT INTO application_submissions (
        form_id,
        account_id,
        character_id,
        status,
        created_at,
        updated_at,
        submitted_at,
        snapshot_json
      )
      VALUES (?, ?, ?, 'SUBMITTED', ?, ?, ?, ?)
    `).run(
      form.id,
      session.account.id,
      characterId,
      now,
      now,
      now,
      JSON.stringify({ formCode })
    );

    const submissionId = Number(insert.lastInsertRowid);
    for (const question of questions) {
      const value = answerMap.get(String(question.question_key));
      const answerText = typeof value === "string" ? value : null;
      this.db.prepare(`
        INSERT INTO application_answers (
          submission_id,
          question_id,
          answer_text,
          answer_json
        )
        VALUES (?, ?, ?, ?)
      `).run(
        submissionId,
        question.id,
        answerText,
        JSON.stringify({ value: value ?? null })
      );
    }

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "applications.submit",
      applicationSubmissionId: submissionId,
      remoteIp: meta.remoteIp ?? null,
      details: { formCode, characterId },
    });

    return this.getApplicationSubmissionById(submissionId);
  }

  listApplicationSubmissions(sessionToken: string, filters: { status?: string }) {
    this.requirePermission(sessionToken, "applications.view");
    const params: SupportedValueType[] = [];
    const conditions: string[] = [];

    if (filters.status) {
      conditions.push(`s.status = ?`);
      params.push(filters.status);
    } else {
      conditions.push(`s.status <> 'DRAFT'`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(`
      SELECT
        s.id,
        s.form_id,
        s.account_id,
        s.character_id,
        s.status,
        s.assigned_to_account_id,
        s.final_decision_by_account_id,
        s.final_reason,
        s.created_at,
        s.updated_at,
        s.submitted_at,
        s.decided_at,
        s.snapshot_json,
        f.code AS form_code,
        f.name AS form_name,
        a.username AS account_username,
        c.name AS character_name,
        aa.username AS assigned_username
      FROM application_submissions s
      JOIN application_forms f ON f.id = s.form_id
      JOIN accounts a ON a.id = s.account_id
      LEFT JOIN characters c ON c.id = s.character_id
      LEFT JOIN accounts aa ON aa.id = s.assigned_to_account_id
      ${whereClause}
      ORDER BY s.updated_at DESC, s.id DESC
      LIMIT 200
    `).all(...params) as Array<Record<string, unknown>>;
  }

  getApplicationSubmission(sessionToken: string, submissionId: number) {
    const session = this.requireSession(sessionToken);
    const submission = this.getApplicationSubmissionById(submissionId);
    if (!submission) {
      throw new AdminHttpError(404, "Application submission not found");
    }

    const staff = this.getStaffSummary(session.account.id);
    const isOwner = Number(submission.account_id) === session.account.id;
    if (!isOwner && !staff.permissions.includes("applications.view")) {
      throw new AdminHttpError(403, "Missing permission applications.view");
    }

    return submission;
  }

  reviewApplication(sessionToken: string, submissionId: number, payload: { decision?: string; comment?: string; assignToMe?: boolean; failedQuestionKeys?: unknown }, meta: { remoteIp?: string | null }) {
    const { session, staff } = this.requirePermission(sessionToken, "applications.review");
    const submission = this.getApplicationSubmissionById(submissionId);
    if (!submission) {
      throw new AdminHttpError(404, "Application submission not found");
    }

    const decision = String(payload.decision || "COMMENT").trim().toUpperCase();
    const comment = String(payload.comment || "").trim();
    const allowed = new Set(["COMMENT", "REQUEST_CHANGES", "APPROVE", "DENY"]);
    if (!allowed.has(decision)) {
      throw new AdminHttpError(400, "Invalid review decision");
    }
    if ((decision === "APPROVE" || decision === "DENY" || decision === "REQUEST_CHANGES") && !staff.permissions.includes("applications.decide")) {
      throw new AdminHttpError(403, "Missing permission applications.decide");
    }

    const failedQuestionKeys = Array.isArray(payload.failedQuestionKeys)
      ? Array.from(new Set(payload.failedQuestionKeys
        .map((entry) => String(entry || "").trim())
        .filter(Boolean)))
      : [];
    const validQuestionKeys = new Set((submission.answers || []).map((answer) => String(answer.question_key || "").trim()).filter(Boolean));
    for (const questionKey of failedQuestionKeys) {
      if (!validQuestionKeys.has(questionKey)) {
        throw new AdminHttpError(400, `Unknown failed question key "${questionKey}"`);
      }
    }
    if ((decision === "DENY" || decision === "REQUEST_CHANGES") && failedQuestionKeys.length === 0) {
      throw new AdminHttpError(400, "Select at least one failed question before denying an application");
    }

    const reviewComment = decision === "APPROVE"
      ? (comment || WHITELIST_WELCOME_MESSAGE)
      : comment;
    const feedbackJson = JSON.stringify({ failedQuestionKeys });

    const now = this.nowIso();
    this.db.prepare(`
      INSERT INTO application_reviews (
        submission_id,
        reviewer_account_id,
        reviewer_role_snapshot,
        decision,
        comment_text,
        feedback_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      submissionId,
      session.account.id,
      this.getHighestRoleName(session.account.id),
      decision,
      reviewComment || null,
      feedbackJson,
      now
    );

    let nextStatus = String(submission.status || "SUBMITTED");
    if (decision === "APPROVE") {
      nextStatus = "APPROVED";
    } else if (decision === "DENY" || decision === "REQUEST_CHANGES") {
      nextStatus = "DENIED";
    } else {
      nextStatus = "UNDER_REVIEW";
    }

    this.db.prepare(`
      UPDATE application_submissions
      SET
        status = ?,
        assigned_to_account_id = CASE WHEN ? = 1 THEN ? ELSE assigned_to_account_id END,
        final_decision_by_account_id = CASE WHEN ? IN ('APPROVE', 'DENY') THEN ? ELSE final_decision_by_account_id END,
        final_reason = CASE WHEN ? IN ('APPROVE', 'DENY') THEN ? ELSE final_reason END,
        decided_at = CASE WHEN ? IN ('APPROVE', 'DENY') THEN ? ELSE decided_at END,
        updated_at = ?
      WHERE id = ?
    `).run(
      nextStatus,
      payload.assignToMe === true ? 1 : 0,
      session.account.id,
      decision === "REQUEST_CHANGES" ? "DENY" : decision,
      session.account.id,
      decision === "REQUEST_CHANGES" ? "DENY" : decision,
      reviewComment || null,
      decision === "REQUEST_CHANGES" ? "DENY" : decision,
      now,
      now,
      submissionId
    );

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "applications.review",
      applicationSubmissionId: submissionId,
      remoteIp: meta.remoteIp ?? null,
      details: { decision, assignToMe: payload.assignToMe === true, failedQuestionKeys },
    });

    return this.getApplicationSubmissionById(submissionId);
  }

  getWhitelistState(sessionToken: string) {
    const session = this.requireSession(sessionToken);
    const staff = this.getStaffSummary(session.account.id);
    const form = this.getApplicationFormByCode(WHITELIST_FORM_CODE, true);
    if (!form) {
      throw new AdminHttpError(500, "Whitelist form is not configured");
    }

    const approvedSubmission = this.getLatestApplicationSubmissionForAccount(form.id, session.account.id, ["APPROVED"]);
    const bypassForStaff = staff.roles.length > 0;
    const approved = !!approvedSubmission;
    const gateRequired = !bypassForStaff && !approved;
    const submission = gateRequired
      ? this.ensureWhitelistEditableSubmission(session.account.id, form)
      : (approvedSubmission ? this.getApplicationSubmissionById(approvedSubmission.id) : null);
    const snapshot = this.parseJsonObject<Record<string, unknown>>(submission?.snapshot_json);
    const scenarioPrompt = String(snapshot.scenarioPrompt || "");
    const scenarioId = String(snapshot.scenarioId || "");
    const latestReview = Array.isArray(submission?.reviews) && submission?.reviews.length
      ? submission.reviews[submission.reviews.length - 1]
      : null;
    const latestFeedback = this.parseJsonObject<Record<string, unknown>>(latestReview?.feedback_json);
    const answers = this.buildSubmissionAnswerMap(submission);

    return {
      gateRequired,
      approved,
      bypassForStaff,
      form: {
        code: form.code,
        name: form.name,
        description: form.description || "Before you can access the rest of the UCP, you need to submit a whitelist application for Skyrim: RP.",
        questions: this.getWhitelistQuestions(form.id).map((question) => ({
          questionKey: question.question_key,
          prompt: question.prompt,
          helpText: question.question_key === "realism_scenario" ? scenarioPrompt : question.help_text,
          fieldType: question.field_type,
          isRequired: Number(question.is_required) === 1,
          validation: this.parseJsonObject<Record<string, unknown>>(question.validation_json),
        })),
      },
      application: submission ? {
        id: submission.id,
        status: submission.status,
        currentStep: this.getWhitelistCurrentStep(submission),
        totalSteps: this.getWhitelistQuestions(form.id).length,
        scenarioId,
        scenarioPrompt,
        answers,
        submittedAt: submission.submitted_at,
        updatedAt: submission.updated_at,
        decidedAt: submission.decided_at,
        latestDecision: latestReview?.decision || submission.status,
        reviewMessage: String(latestReview?.comment_text || submission.final_reason || ""),
        failedQuestionKeys: Array.isArray(latestFeedback.failedQuestionKeys)
          ? latestFeedback.failedQuestionKeys.map((entry) => String(entry || "").trim()).filter(Boolean)
          : [],
        reviewerName: String(latestReview?.reviewer_username || ""),
        welcomeMessage: submission.status === "APPROVED"
          ? String(latestReview?.comment_text || submission.final_reason || WHITELIST_WELCOME_MESSAGE)
          : null,
      } : null,
    };
  }

  saveWhitelistStep(sessionToken: string, payload: { questionKey?: unknown; value?: unknown; finalize?: unknown }, meta: { remoteIp?: string | null }) {
    const session = this.requireSession(sessionToken);
    const staff = this.getStaffSummary(session.account.id);
    if (staff.roles.length > 0) {
      throw new AdminHttpError(409, "Staff accounts do not need a whitelist application");
    }

    const form = this.getApplicationFormByCode(WHITELIST_FORM_CODE, true);
    if (!form) {
      throw new AdminHttpError(500, "Whitelist form is not configured");
    }

    if (this.getLatestApplicationSubmissionForAccount(form.id, session.account.id, ["APPROVED"])) {
      throw new AdminHttpError(409, "This account is already whitelisted");
    }

    const questionKey = String(payload.questionKey || "").trim();
    if (!questionKey) {
      throw new AdminHttpError(400, "questionKey is required");
    }

    const submission = this.ensureWhitelistEditableSubmission(session.account.id, form);
    if (submission.status === "SUBMITTED" || submission.status === "UNDER_REVIEW") {
      throw new AdminHttpError(409, "Your whitelist application is already awaiting review");
    }

    const questions = this.getWhitelistQuestions(form.id);
    const question = questions.find((entry) => String(entry.question_key) === questionKey);
    if (!question) {
      throw new AdminHttpError(404, "Whitelist question not found");
    }

    const answerValue = this.normalizeWhitelistAnswer(question.question_key, payload.value);
    const snapshot = this.parseJsonObject<Record<string, unknown>>(submission.snapshot_json);
    const nextSnapshot = {
      ...snapshot,
      formCode: form.code,
      lastSavedQuestionKey: question.question_key,
    };

    const answerPayload = JSON.stringify({ value: answerValue });
    const updated = this.db.prepare(`
      UPDATE application_answers
      SET answer_text = ?, answer_json = ?
      WHERE submission_id = ? AND question_id = ?
    `).run(
      answerValue,
      answerPayload,
      submission.id,
      question.id
    );
    if (!Number(updated.changes || 0)) {
      this.db.prepare(`
        INSERT INTO application_answers (submission_id, question_id, answer_text, answer_json)
        VALUES (?, ?, ?, ?)
      `).run(
        submission.id,
        question.id,
        answerValue,
        answerPayload
      );
    }

    const now = this.nowIso();
    let nextStatus = submission.status === "DENIED" ? "DRAFT" : submission.status;
    if (nextStatus !== "DRAFT") {
      nextStatus = "DRAFT";
    }

    if (payload.finalize === true || payload.finalize === 1 || payload.finalize === "1") {
      const answerMap = this.buildSubmissionAnswerMap(this.getApplicationSubmissionById(submission.id), {
        [question.question_key]: answerValue,
      });
      for (const entry of questions) {
        if (Number(entry.is_required) !== 1) {
          continue;
        }
        const value = String(answerMap[entry.question_key] || "").trim();
        if (!value) {
          throw new AdminHttpError(400, `Missing answer for "${entry.prompt}"`);
        }
        this.assertWhitelistAnswerValid(entry.question_key, value);
      }
      nextStatus = "SUBMITTED";
    }

    this.db.prepare(`
      UPDATE application_submissions
      SET
        status = ?,
        assigned_to_account_id = CASE WHEN ? = 'SUBMITTED' THEN NULL ELSE assigned_to_account_id END,
        final_decision_by_account_id = CASE WHEN ? = 'SUBMITTED' THEN NULL ELSE final_decision_by_account_id END,
        final_reason = CASE WHEN ? = 'SUBMITTED' THEN NULL ELSE final_reason END,
        decided_at = CASE WHEN ? = 'SUBMITTED' THEN NULL ELSE decided_at END,
        updated_at = ?,
        submitted_at = CASE WHEN ? = 'SUBMITTED' THEN ? ELSE submitted_at END,
        snapshot_json = ?
      WHERE id = ?
    `).run(
      nextStatus,
      nextStatus,
      nextStatus,
      nextStatus,
      nextStatus,
      now,
      nextStatus,
      now,
      JSON.stringify(nextSnapshot),
      submission.id
    );

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: "PLAYER",
      actionCode: nextStatus === "SUBMITTED" ? "applications.whitelist_submitted" : "applications.whitelist_saved",
      applicationSubmissionId: submission.id,
      remoteIp: meta.remoteIp ?? null,
      details: { formCode: form.code, questionKey, finalize: nextStatus === "SUBMITTED" },
    });

    return this.getWhitelistState(sessionToken);
  }

  listModerationCases(sessionToken: string, filters: { status?: string }) {
    this.requirePermission(sessionToken, "notes.create");
    const params: SupportedValueType[] = [];
    const conditions: string[] = [];

    if (filters.status) {
      conditions.push("c.status = ?");
      params.push(filters.status);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db.prepare(`
      SELECT
        c.id,
        c.category,
        c.status,
        c.severity,
        c.summary,
        c.description,
        c.created_at,
        c.updated_at,
        c.closed_at,
        a.username AS opened_by_username,
        (
          SELECT COUNT(*)
          FROM punishments p
          WHERE p.case_id = c.id AND p.status = 'ACTIVE'
        ) AS active_punishments
      FROM moderation_cases c
      LEFT JOIN accounts a ON a.id = c.opened_by_account_id
      ${whereClause}
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT 200
    `).all(...params) as Array<Record<string, unknown>>;
  }

  getModerationCase(sessionToken: string, caseId: number) {
    this.requirePermission(sessionToken, "notes.create");
    const moderationCase = this.getModerationCaseById(caseId);
    if (!moderationCase) {
      throw new AdminHttpError(404, "Moderation case not found");
    }
    return moderationCase;
  }

  createModerationCase(sessionToken: string, payload: {
    category?: string;
    severity?: number;
    summary?: string;
    description?: string;
    targetAccountId?: number | null;
    targetCharacterId?: number | null;
  }, meta: { remoteIp?: string | null }) {
    const { session } = this.requirePermission(sessionToken, "notes.create");
    const summary = String(payload.summary || "").trim();
    if (!summary) {
      throw new Error("Case summary is required");
    }

    const category = String(payload.category || "GENERAL").trim() || "GENERAL";
    const severity = Math.max(1, Math.min(5, Number(payload.severity || 1) || 1));
    const description = String(payload.description || "").trim();
    const now = this.nowIso();

    const insert = this.db.prepare(`
      INSERT INTO moderation_cases (
        opened_by_account_id,
        category,
        status,
        severity,
        summary,
        description,
        required_approval_rank,
        created_at,
        updated_at,
        metadata_json
      )
      VALUES (?, ?, 'OPEN', ?, ?, ?, 0, ?, ?, ?)
    `).run(
      session.account.id,
      category,
      severity,
      summary,
      description || null,
      now,
      now,
      JSON.stringify({})
    );

    const caseId = Number(insert.lastInsertRowid);
    const targetAccountId = payload.targetAccountId === undefined || payload.targetAccountId === null
      ? null
      : Number(payload.targetAccountId);
    const targetCharacterId = payload.targetCharacterId === undefined || payload.targetCharacterId === null
      ? null
      : Number(payload.targetCharacterId);

    if (targetAccountId && Number.isInteger(targetAccountId)) {
      this.db.prepare(`
        INSERT INTO moderation_case_targets (case_id, target_kind, account_id, character_id, profile_id, ip_address, details_json)
        VALUES (?, 'ACCOUNT', ?, NULL, NULL, NULL, ?)
      `).run(caseId, targetAccountId, JSON.stringify({}));
    }
    if (targetCharacterId && Number.isInteger(targetCharacterId)) {
      this.db.prepare(`
        INSERT INTO moderation_case_targets (case_id, target_kind, account_id, character_id, profile_id, ip_address, details_json)
        VALUES (?, 'CHARACTER', NULL, ?, NULL, NULL, ?)
      `).run(caseId, targetCharacterId, JSON.stringify({}));
    }

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "moderation.case_create",
      moderationCaseId: caseId,
      remoteIp: meta.remoteIp ?? null,
      details: { category, severity },
    });

    return this.getModerationCaseById(caseId);
  }

  addPunishment(sessionToken: string, caseId: number, payload: {
    punishmentType?: string;
    accountId?: number | null;
    characterId?: number | null;
    reasonPublic?: string;
    reasonInternal?: string;
    durationHours?: number | null;
  }, meta: { remoteIp?: string | null }) {
    const punishmentType = String(payload.punishmentType || "").trim().toUpperCase();
    const permissionMap: Record<string, string> = {
      WARNING: "moderation.warn",
      MUTE: "moderation.mute",
      JAIL: "moderation.jail",
      FREEZE: "moderation.freeze",
      TEMP_BAN: "moderation.temp_ban",
      PERM_BAN: "moderation.perm_ban",
      NAME_FORCED_CHANGE: "characters.force_rename",
    };

    const requiredPermission = permissionMap[punishmentType];
    if (!requiredPermission) {
      throw new AdminHttpError(400, "Invalid punishment type");
    }

    const { session } = this.requirePermission(sessionToken, requiredPermission);
    const moderationCase = this.getModerationCaseById(caseId);
    if (!moderationCase) {
      throw new AdminHttpError(404, "Moderation case not found");
    }

    const accountId = payload.accountId === undefined || payload.accountId === null ? null : Number(payload.accountId);
    const characterId = payload.characterId === undefined || payload.characterId === null ? null : Number(payload.characterId);
    if ((!accountId || !Number.isInteger(accountId)) && (!characterId || !Number.isInteger(characterId))) {
      throw new Error("Punishment requires accountId or characterId");
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const durationHours = payload.durationHours === undefined || payload.durationHours === null
      ? null
      : Math.max(1, Number(payload.durationHours) || 1);
    const expiresAt = punishmentType === "TEMP_BAN" || punishmentType === "MUTE" || punishmentType === "JAIL" || punishmentType === "FREEZE"
      ? new Date(now.getTime() + (durationHours || 1) * 60 * 60 * 1000).toISOString()
      : null;

    const insert = this.db.prepare(`
      INSERT INTO punishments (
        case_id,
        account_id,
        character_id,
        punishment_type,
        status,
        issued_by_account_id,
        issued_at,
        starts_at,
        expires_at,
        revoked_at,
        revoked_by_account_id,
        revoke_reason,
        reason_public,
        reason_internal,
        metadata_json
      )
      VALUES (?, ?, ?, ?, 'ACTIVE', ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)
    `).run(
      caseId,
      accountId,
      characterId,
      punishmentType,
      session.account.id,
      nowIso,
      nowIso,
      expiresAt,
      String(payload.reasonPublic || "").trim() || null,
      String(payload.reasonInternal || "").trim() || null,
      JSON.stringify({ durationHours: durationHours ?? null })
    );

    const punishmentId = Number(insert.lastInsertRowid);
    this.db.prepare(`
      INSERT INTO moderation_actions (
        case_id,
        actor_account_id,
        action_code,
        reason_internal,
        reason_public,
        payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      caseId,
      session.account.id,
      `punishment.${punishmentType.toLowerCase()}`,
      String(payload.reasonInternal || "").trim() || null,
      String(payload.reasonPublic || "").trim() || null,
      JSON.stringify({ punishmentId }),
      nowIso
    );

    this.db.prepare(`
      UPDATE moderation_cases
      SET updated_at = ?
      WHERE id = ?
    `).run(nowIso, caseId);

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "moderation.punishment_add",
      moderationCaseId: caseId,
      remoteIp: meta.remoteIp ?? null,
      details: { punishmentType, punishmentId, accountId, characterId },
    });

    return this.db.prepare(`
      SELECT id, case_id, account_id, character_id, punishment_type, status, issued_at, starts_at, expires_at, reason_public, reason_internal
      FROM punishments
      WHERE id = ?
    `).get(punishmentId) as Record<string, unknown>;
  }

  listAudit(sessionToken: string) {
    this.requirePermission(sessionToken, "audit.view");
    return this.db.prepare(`
      SELECT
        id,
        actor_account_id,
        actor_role_snapshot,
        action_code,
        target_account_id,
        target_character_id,
        ticket_id,
        application_submission_id,
        moderation_case_id,
        remote_ip,
        details_json,
        created_at
      FROM admin_audit_events
      ORDER BY created_at DESC, id DESC
      LIMIT 250
    `).all() as Array<Record<string, unknown>>;
  }

  listStaffRoles(sessionToken: string) {
    this.requirePermission(sessionToken, "staff.roles.assign");
    const roles = this.db.prepare(`
      SELECT id, code, name, rank_value, description
      FROM staff_roles
      ORDER BY rank_value ASC
    `).all() as StaffRoleRow[];

    return roles.map((role) => ({
      ...role,
      permissions: this.db.prepare(`
        SELECT p.code
        FROM staff_role_permissions rp
        JOIN staff_permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.code ASC
      `).all(role.id).map((entry: any) => entry.code),
    }));
  }

  listStaffAssignments(sessionToken: string) {
    this.requirePermission(sessionToken, "staff.roles.assign");
    return this.db.prepare(`
      SELECT
        asr.id,
        asr.account_id,
        a.username,
        sr.code AS role_code,
        sr.name AS role_name,
        sr.rank_value,
        asr.created_at,
        asr.note,
        asr.revoked_at
      FROM account_staff_roles asr
      JOIN accounts a ON a.id = asr.account_id
      JOIN staff_roles sr ON sr.id = asr.role_id
      WHERE asr.revoked_at IS NULL
      ORDER BY sr.rank_value DESC, a.username COLLATE NOCASE ASC
    `).all() as Array<Record<string, unknown>>;
  }

  searchAccounts(sessionToken: string, query: string) {
    this.requirePermission(sessionToken, "players.search");
    const normalized = `%${String(query || "").trim()}%`;
    return this.db.prepare(`
      SELECT
        a.id,
        a.username,
        a.email,
        (
          SELECT COUNT(*)
          FROM characters c
          WHERE c.account_id = a.id
        ) AS character_count
      FROM accounts a
      WHERE a.username LIKE ? COLLATE NOCASE OR COALESCE(a.email, '') LIKE ? COLLATE NOCASE
      ORDER BY a.username COLLATE NOCASE ASC
      LIMIT 25
    `).all(normalized, normalized) as Array<Record<string, unknown>>;
  }

  grantStaffRole(sessionToken: string, payload: { accountId?: number; roleCode?: string; note?: string }, meta: { remoteIp?: string | null }) {
    const { session, staff } = this.requirePermission(sessionToken, "staff.roles.assign");
    const accountId = Number(payload.accountId);
    const roleCode = String(payload.roleCode || "").trim().toUpperCase();

    if (!Number.isInteger(accountId)) {
      throw new Error("accountId must be an integer");
    }
    const role = this.getRoleByCode(roleCode);
    if (!role) {
      throw new AdminHttpError(404, "Role not found");
    }
    if (staff.rankValue <= Number(role.rank_value)) {
      throw new AdminHttpError(403, "You cannot assign a role at or above your own rank");
    }

    const existing = this.db.prepare(`
      SELECT id
      FROM account_staff_roles
      WHERE account_id = ? AND role_id = ? AND revoked_at IS NULL
    `).get(accountId, role.id) as { id: number } | undefined;
    if (existing) {
      throw new AdminHttpError(409, "Role already assigned");
    }

    this.db.prepare(`
      INSERT INTO account_staff_roles (
        account_id,
        role_id,
        granted_by_account_id,
        note,
        created_at,
        revoked_at
      )
      VALUES (?, ?, ?, ?, ?, NULL)
    `).run(
      accountId,
      role.id,
      session.account.id,
      String(payload.note || "").trim() || null,
      this.nowIso()
    );

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "staff.role_grant",
      targetAccountId: accountId,
      remoteIp: meta.remoteIp ?? null,
      details: { roleCode },
    });

    return this.listStaffAssignments(sessionToken);
  }

  revokeStaffAssignment(sessionToken: string, assignmentId: number, meta: { remoteIp?: string | null }) {
    const { session, staff } = this.requirePermission(sessionToken, "staff.roles.assign");
    const assignment = this.db.prepare(`
      SELECT asr.id, asr.account_id, sr.code, sr.rank_value
      FROM account_staff_roles asr
      JOIN staff_roles sr ON sr.id = asr.role_id
      WHERE asr.id = ? AND asr.revoked_at IS NULL
    `).get(assignmentId) as { id: number; account_id: number; code: string; rank_value: number } | undefined;
    if (!assignment) {
      throw new AdminHttpError(404, "Staff assignment not found");
    }
    if (staff.rankValue <= Number(assignment.rank_value)) {
      throw new AdminHttpError(403, "You cannot revoke a role at or above your own rank");
    }

    this.db.prepare(`
      UPDATE account_staff_roles
      SET revoked_at = ?, revoked_by_account_id = ?
      WHERE id = ?
    `).run(this.nowIso(), session.account.id, assignmentId);

    this.writeAudit({
      actorAccountId: session.account.id,
      actorRoleSnapshot: this.getHighestRoleName(session.account.id),
      actionCode: "staff.role_revoke",
      targetAccountId: assignment.account_id,
      remoteIp: meta.remoteIp ?? null,
      details: { roleCode: assignment.code },
    });

    return this.listStaffAssignments(sessionToken);
  }

  private getCommunityEventById(eventId: number) {
    const row = this.db.prepare(`
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.description,
        e.status,
        e.created_by_account_id,
        e.updated_by_account_id,
        e.created_at,
        e.updated_at,
        ca.username AS created_by_username,
        ua.username AS updated_by_username,
        COALESCE(ic.interest_count, 0) AS interest_count
      FROM community_events e
      LEFT JOIN accounts ca ON ca.id = e.created_by_account_id
      LEFT JOIN accounts ua ON ua.id = e.updated_by_account_id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS interest_count
        FROM community_event_interests
        GROUP BY event_id
      ) ic ON ic.event_id = e.id
      WHERE e.id = ?
    `).get(eventId) as CommunityEventAdminRow | undefined;

    return row ? this.mapCommunityEvent(row) : null;
  }

  private mapCommunityEvent(row: CommunityEventAdminRow) {
    return {
      id: Number(row.id),
      title: String(row.title || ""),
      startsAt: String(row.starts_at || ""),
      description: String(row.description || ""),
      status: String(row.status || "SCHEDULED"),
      interestCount: Number(row.interest_count || 0),
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || ""),
      createdByAccountId: row.created_by_account_id == null ? null : Number(row.created_by_account_id),
      updatedByAccountId: row.updated_by_account_id == null ? null : Number(row.updated_by_account_id),
      createdByUsername: row.created_by_username ? String(row.created_by_username) : null,
      updatedByUsername: row.updated_by_username ? String(row.updated_by_username) : null,
    };
  }

  private normalizeCommunityEventTitle(titleRaw: string | undefined) {
    const title = String(titleRaw || "").trim();
    if (!title) {
      throw new Error("Event title is required");
    }
    if (title.length > 120) {
      throw new Error("Event title must be 120 characters or fewer");
    }
    return title;
  }

  private normalizeCommunityEventDescription(descriptionRaw: string | undefined) {
    const description = String(descriptionRaw || "").trim();
    if (!description) {
      throw new Error("Event description is required");
    }
    if (description.length > 5000) {
      throw new Error("Event description must be 5000 characters or fewer");
    }
    return description;
  }

  private requirePermission(sessionToken: string, permissionCode: string) {
    const session = this.requireSession(sessionToken);
    const staff = this.getStaffSummary(session.account.id);
    if (!staff.permissions.includes(permissionCode)) {
      throw new AdminHttpError(403, `Missing permission ${permissionCode}`);
    }
    return { session, staff };
  }

  private requireSession(sessionToken: string): SessionContext {
    this.pruneExpired();
    const revokedClause = this.accountSessionColumns.has("revoked_at")
      ? " AND (revoked_at IS NULL OR revoked_at = '')"
      : "";
    const session = this.db.prepare(`
      SELECT id, account_id, selected_character_id, expires_at
      FROM account_sessions
      WHERE id = ?${revokedClause} AND expires_at > ?
    `).get(sessionToken, this.nowIso()) as {
      id: string;
      account_id: number;
      selected_character_id: number | null;
      expires_at: string;
    } | undefined;

    if (!session) {
      throw new AdminHttpError(401, "Not authenticated");
    }

    const account = this.db.prepare(`
      SELECT id, username, email
      FROM accounts
      WHERE id = ?
    `).get(session.account_id) as { id: number; username: string; email: string | null } | undefined;
    if (!account) {
      throw new AdminHttpError(401, "Not authenticated");
    }

    if (this.accountSessionColumns.has("last_seen_at")) {
      this.db.prepare(`
        UPDATE account_sessions
        SET last_seen_at = ?
        WHERE id = ?
      `).run(this.nowIso(), session.id);
    }

    const selectedCharacter = session.selected_character_id
      ? this.db.prepare(`
          SELECT id, account_id, profile_id, name, slot_index
          FROM characters
          WHERE id = ?
        `).get(session.selected_character_id) as SessionContext["selectedCharacter"]
      : null;

    return {
      session,
      account,
      selectedCharacter,
    };
  }

  private getStaffSummary(accountId: number): StaffSummary {
    const roles = this.db.prepare(`
      SELECT DISTINCT sr.id, sr.code, sr.name, sr.rank_value
      FROM account_staff_roles asr
      JOIN staff_roles sr ON sr.id = asr.role_id
      WHERE
        asr.account_id = ?
        AND asr.revoked_at IS NULL
        AND (asr.valid_until IS NULL OR asr.valid_until = '' OR asr.valid_until > ?)
      ORDER BY sr.rank_value DESC
    `).all(accountId, this.nowIso()) as Array<{ id: number; code: string; name: string; rank_value: number }>;

    const permissionSet = new Set<string>();
    for (const role of roles) {
      const rolePermissions = this.db.prepare(`
        SELECT p.code
        FROM staff_role_permissions rp
        JOIN staff_permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ?
      `).all(role.id) as Array<{ code: string }>;
      for (const permission of rolePermissions) {
        permissionSet.add(permission.code);
      }
    }

    const overrides = this.db.prepare(`
      SELECT p.code, apo.is_granted
      FROM account_permission_overrides apo
      JOIN staff_permissions p ON p.id = apo.permission_id
      WHERE apo.account_id = ? AND apo.revoked_at IS NULL
    `).all(accountId) as Array<{ code: string; is_granted: number }>;
    for (const override of overrides) {
      if (Number(override.is_granted) === 1) {
        permissionSet.add(override.code);
      } else {
        permissionSet.delete(override.code);
      }
    }

    return {
      rankValue: roles.length ? Number(roles[0].rank_value) : 0,
      roles: roles.map((role) => ({
        id: role.id,
        code: role.code,
        name: role.name,
        rankValue: Number(role.rank_value),
      })),
      permissions: Array.from(permissionSet).sort(),
    };
  }

  private getHighestRoleName(accountId: number) {
    const staff = this.getStaffSummary(accountId);
    return staff.roles.length ? staff.roles[0].name : "PLAYER";
  }

  private getRoleByCode(code: string) {
    return this.db.prepare(`
      SELECT id, code, name, rank_value
      FROM staff_roles
      WHERE code = ?
    `).get(code) as { id: number; code: string; name: string; rank_value: number } | undefined;
  }

  private isFounderBootstrapAvailable() {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM account_staff_roles
      WHERE revoked_at IS NULL
    `).get() as { count: number } | undefined;
    return Number(row?.count || 0) === 0;
  }

  private getTicketById(ticketId: number) {
    return this.db.prepare(`
      SELECT
        t.id,
        t.creator_account_id,
        t.creator_character_id,
        t.subject,
        t.category,
        t.status,
        t.priority,
        t.assigned_to_account_id,
        t.created_at,
        t.updated_at,
        t.last_staff_reply_at,
        t.last_player_reply_at,
        t.closed_at,
        a.username AS creator_username,
        aa.username AS assigned_username
      FROM support_tickets t
      JOIN accounts a ON a.id = t.creator_account_id
      LEFT JOIN accounts aa ON aa.id = t.assigned_to_account_id
      WHERE t.id = ?
    `).get(ticketId) as Record<string, unknown> | undefined;
  }

  private getTicketThread(ticketId: number, playerViewOnly = false) {
    const ticket = this.getTicketById(ticketId);
    if (!ticket) {
      throw new AdminHttpError(404, "Ticket not found");
    }

    const params: SupportedValueType[] = [ticketId];
    const internalFilter = playerViewOnly ? "AND tm.is_internal_note = 0" : "";
    const messages = this.db.prepare(`
      SELECT
        tm.id,
        tm.ticket_id,
        tm.author_account_id,
        tm.author_character_id,
        tm.author_role_snapshot,
        tm.is_internal_note,
        tm.message_text,
        tm.created_at,
        a.username AS author_username,
        c.name AS author_character_name
      FROM support_ticket_messages tm
      LEFT JOIN accounts a ON a.id = tm.author_account_id
      LEFT JOIN characters c ON c.id = tm.author_character_id
      WHERE tm.ticket_id = ?
      ${internalFilter}
      ORDER BY tm.created_at ASC, tm.id ASC
    `).all(...params) as Array<Record<string, unknown>>;

    return { ticket, messages };
  }

  private getApplicationSubmissionById(submissionId: number): ApplicationSubmissionDetail | null {
    const submission = this.db.prepare(`
      SELECT
        s.id,
        s.form_id,
        s.account_id,
        s.character_id,
        s.status,
        s.assigned_to_account_id,
        s.final_decision_by_account_id,
        s.final_reason,
        s.created_at,
        s.updated_at,
        s.submitted_at,
        s.decided_at,
        f.code AS form_code,
        f.name AS form_name,
        a.username AS account_username,
        c.name AS character_name,
        aa.username AS assigned_username
      FROM application_submissions s
      JOIN application_forms f ON f.id = s.form_id
      JOIN accounts a ON a.id = s.account_id
      LEFT JOIN characters c ON c.id = s.character_id
      LEFT JOIN accounts aa ON aa.id = s.assigned_to_account_id
      WHERE s.id = ?
    `).get(submissionId) as Omit<ApplicationSubmissionDetail, "answers" | "reviews"> | undefined;

    if (!submission) {
      return null;
    }

    return {
      ...submission,
      answers: this.db.prepare(`
        SELECT
          q.question_key,
          q.prompt,
          q.field_type,
          aa.answer_text,
          aa.answer_json
        FROM application_answers aa
        JOIN application_questions q ON q.id = aa.question_id
        WHERE aa.submission_id = ?
        ORDER BY q.position ASC, q.id ASC
      `).all(submissionId) as Array<Record<string, unknown>>,
      reviews: this.db.prepare(`
        SELECT
          r.id,
          r.reviewer_account_id,
          r.reviewer_role_snapshot,
          r.decision,
          r.comment_text,
          r.feedback_json,
          r.created_at,
          a.username AS reviewer_username
        FROM application_reviews r
        JOIN accounts a ON a.id = r.reviewer_account_id
        WHERE r.submission_id = ?
        ORDER BY r.created_at ASC, r.id ASC
      `).all(submissionId) as Array<Record<string, unknown>>,
    };
  }

  private getApplicationFormByCode(formCode: string, activeOnly = false) {
    return this.db.prepare(`
      SELECT id, code, name, description, target_scope, minimum_reviewer_rank, is_active, created_at, updated_at
      FROM application_forms
      WHERE code = ?
      ${activeOnly ? "AND is_active = 1" : ""}
      LIMIT 1
    `).get(formCode) as ApplicationFormRow | undefined;
  }

  private getWhitelistQuestions(formId: number) {
    return this.db.prepare(`
      SELECT id, position, question_key, prompt, help_text, field_type, is_required, validation_json
      FROM application_questions
      WHERE form_id = ?
      ORDER BY position ASC, id ASC
    `).all(formId) as ApplicationQuestionRow[];
  }

  private getLatestApplicationSubmissionForAccount(formId: number, accountId: number, statuses?: string[]) {
    const conditions = [`form_id = ?`, `account_id = ?`];
    const params: SupportedValueType[] = [formId, accountId];
    if (Array.isArray(statuses) && statuses.length) {
      conditions.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      params.push(...statuses);
    }

    return this.db.prepare(`
      SELECT id
      FROM application_submissions
      WHERE ${conditions.join(" AND ")}
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get(...params) as { id: number } | undefined;
  }

  private ensureWhitelistEditableSubmission(accountId: number, form: ApplicationFormRow) {
    const latest = this.getLatestApplicationSubmissionForAccount(form.id, accountId);
    if (latest) {
      const detail = this.getApplicationSubmissionById(latest.id);
      if (detail) {
        return detail;
      }
    }

    const now = this.nowIso();
    const scenario = WHITELIST_SCENARIOS[Math.floor(Math.random() * WHITELIST_SCENARIOS.length)];
    const insert = this.db.prepare(`
      INSERT INTO application_submissions (
        form_id,
        account_id,
        character_id,
        status,
        created_at,
        updated_at,
        submitted_at,
        snapshot_json
      )
      VALUES (?, ?, NULL, 'DRAFT', ?, ?, NULL, ?)
    `).run(
      form.id,
      accountId,
      now,
      now,
      JSON.stringify({
        formCode: form.code,
        scenarioId: scenario.id,
        scenarioPrompt: scenario.prompt,
      })
    );

    return this.getApplicationSubmissionById(Number(insert.lastInsertRowid))!;
  }

  private buildSubmissionAnswerMap(
    submission: ApplicationSubmissionDetail | null,
    overrides?: Record<string, string>,
  ) {
    const answers: Record<string, string> = {};
    for (const answer of submission?.answers || []) {
      const questionKey = String(answer.question_key || "").trim();
      if (!questionKey) {
        continue;
      }
      const parsed = this.parseJsonObject<Record<string, unknown>>(answer.answer_json);
      answers[questionKey] = String(parsed.value ?? answer.answer_text ?? "");
    }
    if (overrides) {
      Object.assign(answers, overrides);
    }
    return answers;
  }

  private getWhitelistCurrentStep(submission: ApplicationSubmissionDetail) {
    const questions = this.getWhitelistQuestions(submission.form_id);
    const answers = this.buildSubmissionAnswerMap(submission);

    const firstEmptyIndex = questions.findIndex((question) => !String(answers[question.question_key] || "").trim());
    return firstEmptyIndex >= 0 ? firstEmptyIndex + 1 : questions.length;
  }

  private normalizeWhitelistAnswer(questionKey: string, rawValue: unknown) {
    const value = String(rawValue || "").trim();
    this.assertWhitelistAnswerValid(questionKey, value);
    return value;
  }

  private assertWhitelistAnswerValid(questionKey: string, value: string) {
    if (!value) {
      throw new AdminHttpError(400, "Answer is required");
    }

    if (questionKey === "character_background") {
      const paragraphs = value
        .split(/\r?\n\s*\r?\n/)
        .map((entry) => entry.trim())
        .filter(Boolean);
      if (paragraphs.length < 2) {
        throw new AdminHttpError(400, "Character background must be written in at least two paragraphs");
      }
      if (value.length < 350) {
        throw new AdminHttpError(400, "Character background is too short. Give us a fuller two-paragraph background");
      }
      return;
    }

    if (questionKey === "metagaming_powergaming" && value.length < 260) {
      throw new AdminHttpError(400, "Explain both metagaming and powergaming, with two examples of each");
    }

    if (questionKey === "forbidden_roleplay" && value.length < 120) {
      throw new AdminHttpError(400, "List the forbidden roleplay types and explain them clearly");
    }

    if (questionKey === "realism_scenario" && value.length < 180) {
      throw new AdminHttpError(400, "Respond to the scenario with a more complete realistic IC answer");
    }
  }

  private parseJsonObject<T extends Record<string, unknown>>(value: unknown) {
    if (!value) {
      return {} as T;
    }
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      if (parsed && typeof parsed === "object") {
        return parsed as T;
      }
    } catch {
      // keep legacy malformed rows from breaking the panel
    }
    return {} as T;
  }

  private getModerationCaseById(caseId: number) {
    const moderationCase = this.db.prepare(`
      SELECT
        c.id,
        c.opened_by_account_id,
        c.category,
        c.status,
        c.severity,
        c.summary,
        c.description,
        c.required_approval_rank,
        c.approved_by_account_id,
        c.approved_at,
        c.created_at,
        c.updated_at,
        c.closed_at,
        c.metadata_json,
        a.username AS opened_by_username
      FROM moderation_cases c
      LEFT JOIN accounts a ON a.id = c.opened_by_account_id
      WHERE c.id = ?
    `).get(caseId) as Record<string, unknown> | undefined;

    if (!moderationCase) {
      return null;
    }

    return {
      ...moderationCase,
      targets: this.db.prepare(`
        SELECT id, target_kind, account_id, character_id, profile_id, ip_address, details_json
        FROM moderation_case_targets
        WHERE case_id = ?
        ORDER BY id ASC
      `).all(caseId),
      punishments: this.db.prepare(`
        SELECT id, punishment_type, status, account_id, character_id, issued_by_account_id, issued_at, expires_at, reason_public, reason_internal
        FROM punishments
        WHERE case_id = ?
        ORDER BY issued_at DESC, id DESC
      `).all(caseId),
      actions: this.db.prepare(`
        SELECT id, actor_account_id, action_code, reason_internal, reason_public, payload_json, created_at
        FROM moderation_actions
        WHERE case_id = ?
        ORDER BY created_at ASC, id ASC
      `).all(caseId),
    };
  }

  private writeAudit(args: {
    actorAccountId: number | null;
    actorRoleSnapshot: string | null;
    actionCode: string;
    targetAccountId?: number | null;
    targetCharacterId?: number | null;
    ticketId?: number | null;
    applicationSubmissionId?: number | null;
    moderationCaseId?: number | null;
    remoteIp?: string | null;
    details?: Record<string, unknown>;
  }) {
    this.db.prepare(`
      INSERT INTO admin_audit_events (
        actor_account_id,
        actor_role_snapshot,
        action_code,
        target_account_id,
        target_character_id,
        ticket_id,
        application_submission_id,
        moderation_case_id,
        remote_ip,
        details_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      args.actorAccountId ?? null,
      args.actorRoleSnapshot ?? null,
      args.actionCode,
      args.targetAccountId ?? null,
      args.targetCharacterId ?? null,
      args.ticketId ?? null,
      args.applicationSubmissionId ?? null,
      args.moderationCaseId ?? null,
      args.remoteIp ?? null,
      JSON.stringify(args.details || {}),
      this.nowIso()
    );
  }

  private ensureCoreTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        email TEXT UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL,
        slot_index INTEGER NOT NULL,
        name TEXT NOT NULL,
        profile_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_used_at TEXT
      );

      CREATE TABLE IF NOT EXISTS account_sessions (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        selected_character_id INTEGER,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        user_agent TEXT,
        remote_ip TEXT,
        revoked_at TEXT,
        revoke_reason TEXT
      );
    `);
  }

  private ensureAdminTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS staff_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL UNIQUE,
        rank_value INTEGER NOT NULL UNIQUE,
        description TEXT NOT NULL,
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

      CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        creator_account_id INTEGER NOT NULL,
        creator_character_id INTEGER,
        subject TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        assigned_to_account_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_staff_reply_at TEXT,
        last_player_reply_at TEXT,
        closed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        author_account_id INTEGER NOT NULL,
        author_character_id INTEGER,
        author_role_snapshot TEXT,
        is_internal_note INTEGER NOT NULL DEFAULT 0,
        message_text TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS support_ticket_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        assigned_to_account_id INTEGER NOT NULL,
        assigned_by_account_id INTEGER,
        note TEXT,
        assigned_at TEXT NOT NULL,
        unassigned_at TEXT
      );

      CREATE TABLE IF NOT EXISTS application_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        target_scope TEXT NOT NULL,
        minimum_reviewer_rank INTEGER NOT NULL DEFAULT 10,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS application_questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        question_key TEXT NOT NULL,
        prompt TEXT NOT NULL,
        help_text TEXT,
        field_type TEXT NOT NULL,
        is_required INTEGER NOT NULL DEFAULT 1,
        validation_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(form_id, question_key)
      );

      CREATE TABLE IF NOT EXISTS application_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        form_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        character_id INTEGER,
        status TEXT NOT NULL,
        assigned_to_account_id INTEGER,
        final_decision_by_account_id INTEGER,
        final_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        submitted_at TEXT,
        decided_at TEXT,
        snapshot_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS application_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        answer_text TEXT,
        answer_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS application_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        reviewer_account_id INTEGER NOT NULL,
        reviewer_role_snapshot TEXT,
        decision TEXT NOT NULL,
        comment_text TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS moderation_cases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opened_by_account_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        severity INTEGER NOT NULL,
        summary TEXT NOT NULL,
        description TEXT,
        required_approval_rank INTEGER NOT NULL DEFAULT 0,
        approved_by_account_id INTEGER,
        approved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        closed_at TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS moderation_case_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        target_kind TEXT NOT NULL,
        account_id INTEGER,
        character_id INTEGER,
        profile_id INTEGER,
        ip_address TEXT,
        details_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS moderation_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        actor_account_id INTEGER,
        action_code TEXT NOT NULL,
        reason_internal TEXT,
        reason_public TEXT,
        payload_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS punishments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        case_id INTEGER NOT NULL,
        account_id INTEGER,
        character_id INTEGER,
        punishment_type TEXT NOT NULL,
        status TEXT NOT NULL,
        issued_by_account_id INTEGER,
        issued_at TEXT NOT NULL,
        starts_at TEXT NOT NULL,
        expires_at TEXT,
        revoked_at TEXT,
        revoked_by_account_id INTEGER,
        revoke_reason TEXT,
        reason_public TEXT,
        reason_internal TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}'
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

      CREATE TABLE IF NOT EXISTS admin_panel_access_grants (
        token TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL,
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated
        ON support_tickets(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket
        ON support_ticket_messages(ticket_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_application_submissions_status
        ON application_submissions(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_moderation_cases_status
        ON moderation_cases(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created
        ON admin_audit_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_panel_access_grants_expires
        ON admin_panel_access_grants(expires_at DESC);
    `);

    const reviewColumns = this.getColumnNames("application_reviews");
    if (!reviewColumns.has("feedback_json")) {
      this.db.exec(`ALTER TABLE application_reviews ADD COLUMN feedback_json TEXT NOT NULL DEFAULT '{}'`);
    }
  }

  private seedStaffModel() {
    const now = this.nowIso();
    for (const role of STAFF_ROLE_SEEDS) {
      this.db.prepare(`
        INSERT OR IGNORE INTO staff_roles (code, name, rank_value, description, panel_access, created_at)
        VALUES (?, ?, ?, ?, 1, ?)
      `).run(role.code, role.name, role.rankValue, role.description, now);
    }

    for (const [code, category, description] of STAFF_PERMISSION_SEEDS) {
      this.db.prepare(`
        INSERT OR IGNORE INTO staff_permissions (code, category, description, created_at)
        VALUES (?, ?, ?, ?)
      `).run(code, category, description, now);
    }

    for (const [roleCode, permissionCodes] of Object.entries(ROLE_PERMISSION_SEEDS)) {
      const role = this.getRoleByCode(roleCode);
      if (!role) {
        continue;
      }
      for (const permissionCode of permissionCodes) {
        const permission = this.db.prepare(`
          SELECT id
          FROM staff_permissions
          WHERE code = ?
        `).get(permissionCode) as { id: number } | undefined;
        if (!permission) {
          continue;
        }
        this.db.prepare(`
          INSERT OR IGNORE INTO staff_role_permissions (role_id, permission_id)
          VALUES (?, ?)
        `).run(role.id, permission.id);
      }
    }
  }

  private seedDefaultApplicationForm() {
    const now = this.nowIso();
    this.db.prepare(`
      UPDATE application_forms
      SET is_active = 0, updated_at = ?
      WHERE code = 'SERVER_RP'
    `).run(now);

    const existing = this.getApplicationFormByCode(WHITELIST_FORM_CODE);
    if (existing) {
      this.db.prepare(`
        UPDATE application_forms
        SET
          name = ?,
          description = ?,
          target_scope = 'ACCOUNT',
          minimum_reviewer_rank = 10,
          is_active = 1,
          updated_at = ?
        WHERE id = ?
      `).run(
        "Skyrim: RP Whitelist Application",
        "Mandatory whitelist form for newly created UCP accounts before the rest of the hub unlocks.",
        now,
        existing.id
      );
    } else {
      this.db.prepare(`
        INSERT INTO application_forms (
          code,
          name,
          description,
          target_scope,
          minimum_reviewer_rank,
          is_active,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, 'ACCOUNT', 10, 1, ?, ?)
      `).run(
        WHITELIST_FORM_CODE,
        "Skyrim: RP Whitelist Application",
        "Mandatory whitelist form for newly created UCP accounts before the rest of the hub unlocks.",
        now,
        now
      );
    }

    const form = this.getApplicationFormByCode(WHITELIST_FORM_CODE);
    if (!form) {
      return;
    }

    const questions = [
      {
        questionKey: "character_background",
        prompt: "Write a character background of at least two full paragraphs.",
        helpText: "Explain who your character is, where they came from, what shaped them, and what they want out of life in Skyrim: RP.",
        fieldType: "LONG_TEXT",
        validation: { minLength: 350, requiresParagraphs: 2 },
      },
      {
        questionKey: "metagaming_powergaming",
        prompt: "Define metagaming and powergaming in your own words, and give two examples of each.",
        helpText: "Use your own words. We want to see how you think, not copied rules text.",
        fieldType: "LONG_TEXT",
        validation: { minLength: 260 },
      },
      {
        questionKey: "forbidden_roleplay",
        prompt: "Explain the forbidden forms of roleplay on this server, including abuse content such as pedophilia, necrophilia, rape, and similar material.",
        helpText: "Tell us what is banned and why it has no place on the server.",
        fieldType: "LONG_TEXT",
        validation: { minLength: 120 },
      },
      {
        questionKey: "realism_scenario",
        prompt: "Respond to the randomized realism scenario below in a grounded IC way.",
        helpText: "Your exact scenario will be inserted when the applicant reaches this phase.",
        fieldType: "LONG_TEXT",
        validation: { minLength: 180 },
      },
    ];

    questions.forEach((question, index) => {
      const existingQuestion = this.db.prepare(`
        SELECT id
        FROM application_questions
        WHERE form_id = ? AND question_key = ?
      `).get(form.id, question.questionKey) as { id: number } | undefined;
      if (existingQuestion) {
        this.db.prepare(`
          UPDATE application_questions
          SET
            position = ?,
            prompt = ?,
            help_text = ?,
            field_type = ?,
            is_required = 1,
            validation_json = ?,
            updated_at = ?
          WHERE id = ?
        `).run(
          index + 1,
          question.prompt,
          question.helpText,
          question.fieldType,
          JSON.stringify(question.validation),
          now,
          existingQuestion.id
        );
        return;
      }

      this.db.prepare(`
        INSERT INTO application_questions (
          form_id,
          position,
          question_key,
          prompt,
          help_text,
          field_type,
          is_required,
          validation_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        form.id,
        index + 1,
        question.questionKey,
        question.prompt,
        question.helpText,
        question.fieldType,
        JSON.stringify(question.validation),
        now,
        now
      );
    });
  }

  private pruneExpired() {
    const now = this.nowIso();
    this.db.prepare(`DELETE FROM account_sessions WHERE expires_at <= ?`).run(now);
    this.pruneExpiredPanelAccessGrants();
  }

  private pruneExpiredPanelAccessGrants() {
    this.db.prepare(`
      DELETE FROM admin_panel_access_grants
      WHERE expires_at <= ?
    `).run(this.nowIso());
  }

  private canAccountOpenPanel(accountId: number) {
    return this.getStaffSummary(accountId).permissions.includes("panel.access");
  }

  private nowIso() {
    return new Date().toISOString();
  }

  private getColumnNames(tableName: string) {
    const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return new Set(rows.map((row) => row.name));
  }

  private accountSessionColumns: Set<string> = new Set();
  private db: DatabaseSync;
}

const getDbPath = (settings: Settings) => {
  const explicitPath = settings.allSettings?.ucpDbPath as (string | undefined);
  if (explicitPath && explicitPath.trim()) {
    return path.isAbsolute(explicitPath) ? explicitPath : path.resolve(process.cwd(), explicitPath);
  }
  return path.resolve(process.cwd(), "ucp", "skyrim-unbound-ucp.sqlite");
};

let adminDbSingleton: AdminDatabase | null = null;

const getAdminDb = (settings: Settings) => {
  if (!adminDbSingleton) {
    adminDbSingleton = new AdminDatabase(getDbPath(settings));
  }
  return adminDbSingleton;
};

const getSessionTokenFromRequest = (ctx: KoaContext) => {
  const authHeader = String(ctx.get("authorization") || "");
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const headerToken = String(ctx.get("x-ucp-session") || "").trim();
  if (headerToken) {
    return headerToken;
  }
  for (const cookieName of [ACCOUNT_SESSION_COOKIE_NAME, ...LEGACY_ACCOUNT_SESSION_COOKIE_NAMES]) {
    const cookieToken = String(ctx.cookies?.get?.(cookieName) || "").trim();
    if (cookieToken) {
      return cookieToken;
    }
  }
  return "";
};

const getSessionMeta = (ctx: KoaContext) => ({
  remoteIp: String(ctx.request.ip || "").trim() || null,
});

const writeError = (ctx: KoaContext, status: number, message: string) => {
  ctx.status = status;
  ctx.set("Cache-Control", "no-store");
  ctx.body = { error: message };
};

const getAdminErrorStatus = (error: unknown) => {
  if (error instanceof AdminHttpError) {
    return error.status;
  }
  return 400;
};

const getAdminErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
};

const clearAccountSessionCookie = (ctx: KoaContext, settings: Settings) => {
  for (const cookieName of [ACCOUNT_SESSION_COOKIE_NAME, ...LEGACY_ACCOUNT_SESSION_COOKIE_NAMES]) {
    ctx.cookies?.set?.(cookieName, "", {
      expires: new Date(0),
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(settings, ctx),
      path: "/",
    });
  }
};

const clearAdminPanelAccessCookie = (ctx: KoaContext, settings: Settings) => {
  ctx.cookies?.set?.(ADMIN_PANEL_ACCESS_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    sameSite: "strict",
    secure: shouldUseSecureCookies(settings, ctx),
    path: "/admin",
  });
};

const withSession = (settings: Settings, ctx: KoaContext, handler: (db: AdminDatabase, sessionToken: string) => void) => {
  const sessionToken = getSessionTokenFromRequest(ctx);
  if (!sessionToken) {
    writeError(ctx, 401, "Missing session token");
    return;
  }

  try {
    handler(getAdminDb(settings), sessionToken);
  } catch (error) {
    if (getAdminErrorStatus(error) === 401) {
      clearAccountSessionCookie(ctx, settings);
      clearAdminPanelAccessCookie(ctx, settings);
    }
    writeError(ctx, getAdminErrorStatus(error), getAdminErrorMessage(error));
  }
};

const withPanelSession = (settings: Settings, ctx: KoaContext, handler: (db: AdminDatabase, sessionToken: string) => void) => {
  withSession(settings, ctx, (db, sessionToken) => {
    db.assertPanelAccess(sessionToken);
    handler(db, sessionToken);
  });
};

export const createAdminStaticAccessMiddleware = (settings: Settings) => {
  return async (ctx: KoaContext, next: () => Promise<unknown>) => {
    const requestPath = String(ctx.path || "");
    if (!requestPath.startsWith("/admin") || requestPath.startsWith("/admin/api/")) {
      await next();
      return;
    }

    const grantToken = String(ctx.cookies?.get?.(ADMIN_PANEL_ACCESS_COOKIE_NAME) || "").trim();
    const grant = grantToken ? getAdminDb(settings).validatePanelAccessGrant(grantToken) : null;
    if (!grant) {
      clearAdminPanelAccessCookie(ctx, settings);
      ctx.status = 404;
      ctx.body = "Not found";
      return;
    }

    if (requestPath === "/admin") {
      ctx.redirect("/admin/");
      return;
    }

    await next();
  };
};

export const attachAdminRoutes = (router: KoaRouter, settings: Settings) => {
  router.get("/ucp/api/whitelist/state", (ctx: KoaContext) => {
    withSession(settings, ctx, (db, sessionToken) => {
      ctx.body = db.getWhitelistState(sessionToken);
    });
  });

  router.post("/ucp/api/whitelist/steps", (ctx: KoaContext) => {
    withSession(settings, ctx, (db, sessionToken) => {
      ctx.body = db.saveWhitelistStep(sessionToken, ctx.request.body || {}, getSessionMeta(ctx));
    });
  });

  router.post("/ucp/api/admin/access-link", (ctx: KoaContext) => {
    const sessionToken = getSessionTokenFromRequest(ctx);
    if (!sessionToken) {
      writeError(ctx, 404, "Not found");
      return;
    }

    try {
      const db = getAdminDb(settings);
      const founderBootstrapAllowed = isFounderBootstrapAllowed(settings, ctx);
      const grant = db.issuePanelAccessGrant(sessionToken, getSessionMeta(ctx), founderBootstrapAllowed);
      ctx.cookies.set(ADMIN_PANEL_ACCESS_COOKIE_NAME, grant.token, {
        expires: new Date(grant.expiresAt),
        httpOnly: true,
        sameSite: "strict",
        secure: shouldUseSecureCookies(settings, ctx),
        path: "/admin",
      });
      ctx.body = {
        ok: true,
        url: "/admin/",
        expiresAt: grant.expiresAt,
      };
    } catch (error) {
      const status = getAdminErrorStatus(error);
      writeError(ctx, status === 403 ? 404 : status, status === 403 ? "Not found" : getAdminErrorMessage(error));
    }
  });

  router.get("/admin/api/health", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, () => {
      ctx.body = {
        ok: true,
        serverName: settings.allSettings?.name || "Skyrim Unbound",
      };
    });
  });

  router.get("/admin/api/bootstrap", (ctx: KoaContext) => {
    withSession(settings, ctx, (db, sessionToken) => {
      ctx.body = db.getPanelBootstrap(sessionToken, isFounderBootstrapAllowed(settings, ctx));
    });
  });

  router.post("/admin/api/bootstrap/founder", (ctx: KoaContext) => {
    withSession(settings, ctx, (db, sessionToken) => {
      ctx.body = db.bootstrapFounder(sessionToken, getSessionMeta(ctx), isFounderBootstrapAllowed(settings, ctx));
    });
  });

  router.get("/admin/api/dashboard", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = db.getDashboard(sessionToken);
    });
  });

  router.get("/admin/api/events", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = db.listCommunityEvents(sessionToken, {
        month: String(ctx.query.month || "").trim() || undefined,
        status: String(ctx.query.status || "").trim() || undefined,
        tzOffsetMinutes: ctx.query.tzOffsetMinutes,
      });
    });
  });

  router.post("/admin/api/events", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.status = 201;
      ctx.body = {
        event: db.createCommunityEvent(sessionToken, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.post("/admin/api/events/:eventId", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const eventId = Number(ctx.params.eventId);
      if (!Number.isInteger(eventId)) {
        throw new Error("eventId must be an integer");
      }
      ctx.body = {
        event: db.updateCommunityEvent(sessionToken, eventId, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.get("/admin/api/tickets", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        tickets: db.listTickets(sessionToken, {
          status: String(ctx.query.status || "").trim() || undefined,
          assignedToMe: String(ctx.query.assigned || "").trim().toLowerCase() === "mine",
        }),
      };
    });
  });

  router.post("/admin/api/tickets", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.status = 201;
      ctx.body = {
        ticket: db.createTicket(sessionToken, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.get("/admin/api/tickets/:ticketId", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const ticketId = Number(ctx.params.ticketId);
      if (!Number.isInteger(ticketId)) {
        throw new Error("ticketId must be an integer");
      }
      ctx.body = db.listTicketThread(sessionToken, ticketId);
    });
  });

  router.post("/admin/api/tickets/:ticketId/messages", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const ticketId = Number(ctx.params.ticketId);
      if (!Number.isInteger(ticketId)) {
        throw new Error("ticketId must be an integer");
      }
      ctx.body = db.replyToTicket(sessionToken, ticketId, ctx.request.body || {}, getSessionMeta(ctx));
    });
  });

  router.post("/admin/api/tickets/:ticketId/assign", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const ticketId = Number(ctx.params.ticketId);
      const accountIdRaw = (ctx.request.body || {}).accountId;
      const assignedToAccountId = accountIdRaw === undefined || accountIdRaw === null || accountIdRaw === ""
        ? null
        : Number(accountIdRaw);
      if (!Number.isInteger(ticketId)) {
        throw new Error("ticketId must be an integer");
      }
      if (assignedToAccountId !== null && !Number.isInteger(assignedToAccountId)) {
        throw new Error("accountId must be an integer");
      }
      ctx.body = {
        ticket: db.assignTicket(sessionToken, ticketId, assignedToAccountId, getSessionMeta(ctx)),
      };
    });
  });

  router.post("/admin/api/tickets/:ticketId/status", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const ticketId = Number(ctx.params.ticketId);
      if (!Number.isInteger(ticketId)) {
        throw new Error("ticketId must be an integer");
      }
      ctx.body = {
        ticket: db.setTicketStatus(sessionToken, ticketId, String((ctx.request.body || {}).status || ""), getSessionMeta(ctx)),
      };
    });
  });

  router.get("/admin/api/applications/forms", (ctx: KoaContext) => {
    const token = getSessionTokenFromRequest(ctx);
    try {
      if (!token) {
        throw new AdminHttpError(401, "Missing session token");
      }
      getAdminDb(settings).assertPanelAccess(token);
      ctx.body = {
        forms: getAdminDb(settings).listApplicationForms(token, String(ctx.query.includeInactive || "").trim() === "1"),
      };
    } catch (error) {
      writeError(ctx, getAdminErrorStatus(error), getAdminErrorMessage(error));
    }
  });

  router.post("/admin/api/applications/submissions", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.status = 201;
      ctx.body = {
        submission: db.submitApplication(sessionToken, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.get("/admin/api/applications/submissions", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        submissions: db.listApplicationSubmissions(sessionToken, {
          status: String(ctx.query.status || "").trim() || undefined,
        }),
      };
    });
  });

  router.get("/admin/api/applications/submissions/:submissionId", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const submissionId = Number(ctx.params.submissionId);
      if (!Number.isInteger(submissionId)) {
        throw new Error("submissionId must be an integer");
      }
      ctx.body = {
        submission: db.getApplicationSubmission(sessionToken, submissionId),
      };
    });
  });

  router.post("/admin/api/applications/submissions/:submissionId/reviews", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const submissionId = Number(ctx.params.submissionId);
      if (!Number.isInteger(submissionId)) {
        throw new Error("submissionId must be an integer");
      }
      ctx.body = {
        submission: db.reviewApplication(sessionToken, submissionId, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.get("/admin/api/moderation/cases", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        cases: db.listModerationCases(sessionToken, {
          status: String(ctx.query.status || "").trim() || undefined,
        }),
      };
    });
  });

  router.get("/admin/api/moderation/cases/:caseId", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const caseId = Number(ctx.params.caseId);
      if (!Number.isInteger(caseId)) {
        throw new Error("caseId must be an integer");
      }
      ctx.body = {
        case: db.getModerationCase(sessionToken, caseId),
      };
    });
  });

  router.post("/admin/api/moderation/cases", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.status = 201;
      ctx.body = {
        case: db.createModerationCase(sessionToken, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.post("/admin/api/moderation/cases/:caseId/punishments", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const caseId = Number(ctx.params.caseId);
      if (!Number.isInteger(caseId)) {
        throw new Error("caseId must be an integer");
      }
      ctx.status = 201;
      ctx.body = {
        punishment: db.addPunishment(sessionToken, caseId, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.get("/admin/api/audit", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        events: db.listAudit(sessionToken),
      };
    });
  });

  router.get("/admin/api/accounts/search", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        accounts: db.searchAccounts(sessionToken, String(ctx.query.q || "").trim()),
      };
    });
  });

  router.get("/admin/api/staff/roles", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        roles: db.listStaffRoles(sessionToken),
      };
    });
  });

  router.get("/admin/api/staff/assignments", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        assignments: db.listStaffAssignments(sessionToken),
      };
    });
  });

  router.post("/admin/api/staff/assignments", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      ctx.body = {
        assignments: db.grantStaffRole(sessionToken, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.post("/admin/api/staff/assignments/:assignmentId/revoke", (ctx: KoaContext) => {
    withPanelSession(settings, ctx, (db, sessionToken) => {
      const assignmentId = Number(ctx.params.assignmentId);
      if (!Number.isInteger(assignmentId)) {
        throw new Error("assignmentId must be an integer");
      }
      ctx.body = {
        assignments: db.revokeStaffAssignment(sessionToken, assignmentId, getSessionMeta(ctx)),
      };
    });
  });
};
