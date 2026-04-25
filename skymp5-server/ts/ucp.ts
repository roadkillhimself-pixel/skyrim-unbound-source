import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { DatabaseSync } from "node:sqlite";
import nodemailer from "nodemailer";
import { Settings } from "./settings";
import { ADMIN_PANEL_ACCESS_COOKIE_NAME } from "./admin";
import { COMMUNITY_EVENT_SCHEMA_SQL, getCommunityEventMonthWindow } from "./communityEvents";
import {
  ACCOUNT_SESSION_COOKIE_NAME,
  LEGACY_ACCOUNT_SESSION_COOKIE_NAMES,
  isLocalRequest,
  shouldUseSecureCookies,
} from "./httpSecurity";

type KoaContext = any;
type KoaRouter = any;

type AccountRow = {
  id: number;
  username: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

type PublicAccount = {
  id: number;
  username: string;
  email: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreatorContactTurnstileConfig = {
  siteKey: string;
  secretKey: string;
  usesTestKey: boolean;
};

type TurnstileValidationResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

const FALLBACK_COMMUNITY_EVENT_TIME_ZONE = "UTC";
const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";
const TURNSTILE_TEST_SECRET_KEY = "1x0000000000000000000000000000000AA";

const getResolvedCommunityEventTimeZone = () => {
  try {
    const resolvedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof resolvedTimeZone === "string" && resolvedTimeZone.trim()
      ? resolvedTimeZone
      : FALLBACK_COMMUNITY_EVENT_TIME_ZONE;
  } catch (_error) {
    return FALLBACK_COMMUNITY_EVENT_TIME_ZONE;
  }
};

const getTimeZoneOffsetMinutesForDate = (dateRaw: string | Date, timeZone: string) => {
  const date = dateRaw instanceof Date ? new Date(dateRaw) : new Date(dateRaw);
  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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
  }, {} as Record<string, string>);
  const zonedUtcMillis = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return Math.round((date.getTime() - zonedUtcMillis) / 60000);
};

type AccountAuthRow = AccountRow & {
  password_hash: string;
  password_salt: string;
};

type CharacterRow = {
  id: number;
  account_id: number;
  slot_index: number;
  name: string;
  profile_id: number;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

type AccountSessionRow = {
  id: string;
  account_id: number;
  selected_character_id: number | null;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
};

type PlaySessionRow = {
  id: string;
  account_id: number;
  character_id: number;
  profile_id: number;
  server_master_key: string;
  created_at: string;
  expires_at: string;
};

type PasswordResetTokenRow = {
  id: number;
  account_id: number;
  token_hash: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  requested_ip: string | null;
  user_agent: string | null;
};

type RecoveryMailSettings = {
  publicUrl: string;
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
  resetTokenMinutes: number;
};

type SessionMeta = {
  userAgent?: string | null;
  remoteIp?: string | null;
};

type SecurityQuestionRow = {
  account_id: number;
  slot_index: number;
  question_key: string;
  answer_hash: string;
  answer_salt: string;
  created_at: string;
  updated_at: string;
};

type TotpCredentialRow = {
  account_id: number;
  secret_base32: string;
  created_at: string;
  enabled_at: string;
  updated_at: string;
};

type TrustedLoginLocationRow = {
  id: number;
  account_id: number;
  remote_ip: string;
  user_agent_hash: string | null;
  created_at: string;
  last_seen_at: string;
};

type AuthChallengeRow = {
  id: string;
  account_id: number | null;
  purpose: string;
  state_json: string;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
};

type ForumGroupEntitlementRow = {
  account_id: number;
  group_code: string;
  source: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
  revoked_at: string | null;
};

type ForumGroupPreferenceRow = {
  account_id: number;
  primary_group_code: string | null;
  secondary_group_codes_json: string;
  created_at: string;
  updated_at: string;
};

type DiscordLinkRow = {
  account_id: number;
  discord_user_id: string | null;
  discord_username: string | null;
  linked_at: string;
  updated_at: string;
  claim_state_json: string;
};

type CommunityEventRow = {
  id: number;
  title: string;
  starts_at: string;
  description: string;
  status: string;
  created_by_account_id: number | null;
  created_by_username: string | null;
  updated_by_account_id: number | null;
  created_at: string;
  updated_at: string;
  interest_count: number;
  is_interested: number;
};

type ForumGroupOption = {
  code: string;
  label: string;
  description: string;
};

type SecurityQuestionOption = {
  key: string;
  prompt: string;
};

const SECURITY_QUESTION_OPTIONS: SecurityQuestionOption[] = [
  { key: "first_teacher", prompt: "What was the last name of your favorite teacher?" },
  { key: "childhood_street", prompt: "What street did you grow up on?" },
  { key: "first_pet", prompt: "What was the name of your first pet?" },
  { key: "first_game", prompt: "What was the first video game you loved?" },
  { key: "favorite_book", prompt: "What was your favorite book as a child?" },
  { key: "dream_job", prompt: "What job did you dream of having as a child?" },
  { key: "childhood_friend", prompt: "What was the first name of your childhood best friend?" },
  { key: "family_nickname", prompt: "What nickname did your family call you growing up?" },
  { key: "first_concert", prompt: "What was the first concert or live event you remember attending?" },
  { key: "favorite_food", prompt: "What meal always felt like home growing up?" },
  { key: "favorite_place", prompt: "What place did you most love visiting as a child?" },
  { key: "first_character", prompt: "What was the name of the first roleplay character you ever made?" },
];

const SECURITY_QUESTION_COUNT = 3;
const LOGIN_OTP_TTL_MINUTES = 15;
const AUTH_CHALLENGE_PURPOSE_LOGIN = "LOGIN_STEP_UP";
const AUTH_CHALLENGE_PURPOSE_SECURITY_RECOVERY = "SECURITY_RECOVERY";
const AUTH_CHALLENGE_PURPOSE_TOTP_SETUP = "TOTP_SETUP";
const WHITELIST_FORM_CODE = "WHITELIST_RP";

const FORUM_GROUP_OPTIONS: ForumGroupOption[] = [
  {
    code: "DONATOR_GOLD",
    label: "Gold Donator",
    description: "Premium donor forum badge for accounts with gold-tier support.",
  },
  {
    code: "DONATOR_PLATINUM",
    label: "Platinum",
    description: "High-tier donor forum badge for platinum-level support.",
  },
  {
    code: "DONATOR_SUPPORTER",
    label: "Supporter",
    description: "Supporter forum badge for accounts with entry-level donation support.",
  },
];

const BLOCKED_CHARACTER_NAME_WORDS = new Set([
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "shitter",
  "bitch",
  "bastard",
  "asshole",
  "cunt",
  "whore",
  "slut",
  "prick",
  "piss",
  "idiot",
  "moron",
  "loser",
  "stupid",
  "trash",
  "dumb",
  "jerk",
  "nazi",
  "kkk",
  "supremacist",
  "supremacy",
]);

const BLOCKED_CHARACTER_NAME_COMPACT_TERMS = new Set([
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "shitter",
  "bitch",
  "bastard",
  "asshole",
  "cunt",
  "whore",
  "slut",
  "prick",
  "piss",
  "whitepower",
  "heilhitler",
  "siegheil",
  "nazi",
  "kkk",
]);

const BLOCKED_CHARACTER_NAME_PHRASES: Array<Array<string>> = [
  ["white", "power"],
  ["heil", "hitler"],
  ["sieg", "heil"],
];

class UcpDatabase {
  constructor(private dbFilePath: string) {
    fs.mkdirSync(path.dirname(this.dbFilePath), { recursive: true });
    this.db = new DatabaseSync(this.dbFilePath);
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
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

      CREATE TABLE IF NOT EXISTS account_sessions (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        selected_character_id INTEGER REFERENCES characters(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        user_agent TEXT,
        remote_ip TEXT
      );

      CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 1 AND 3),
        name TEXT NOT NULL,
        profile_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_used_at TEXT,
        UNIQUE(account_id, slot_index)
      );

      CREATE TABLE IF NOT EXISTS play_sessions (
        id TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL,
        server_master_key TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        requested_ip TEXT,
        user_agent TEXT
      );

      CREATE TABLE IF NOT EXISTS account_security_settings (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        email_otp_on_new_ip INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_security_questions (
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 1 AND 3),
        question_key TEXT NOT NULL,
        answer_hash TEXT NOT NULL,
        answer_salt TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY(account_id, slot_index),
        UNIQUE(account_id, question_key)
      );

      CREATE TABLE IF NOT EXISTS account_totp_credentials (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        secret_base32 TEXT NOT NULL,
        created_at TEXT NOT NULL,
        enabled_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS trusted_login_locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        remote_ip TEXT NOT NULL,
        user_agent_hash TEXT,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE(account_id, remote_ip)
      );

      CREATE TABLE IF NOT EXISTS auth_challenges (
        id TEXT PRIMARY KEY,
        account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS account_forum_group_entitlements (
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        group_code TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'manual',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        revoked_at TEXT,
        PRIMARY KEY(account_id, group_code)
      );

      CREATE TABLE IF NOT EXISTS account_forum_group_preferences (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        primary_group_code TEXT,
        secondary_group_codes_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_discord_links (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        discord_user_id TEXT,
        discord_username TEXT,
        linked_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        claim_state_json TEXT NOT NULL DEFAULT '{}'
      );

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

      CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_name_unique_nonempty
      ON characters(name COLLATE NOCASE)
      WHERE length(trim(name)) > 0;

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_account_id
      ON password_reset_tokens(account_id);

      CREATE INDEX IF NOT EXISTS idx_auth_challenges_account_id
      ON auth_challenges(account_id);

      CREATE INDEX IF NOT EXISTS idx_account_forum_group_entitlements_active
      ON account_forum_group_entitlements(account_id, revoked_at, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_character_chatlog_entries_witness_time
      ON character_chatlog_entries(witness_profile_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_character_chatlog_entries_created_at
      ON character_chatlog_entries(created_at);
    `);
    this.db.exec(COMMUNITY_EVENT_SCHEMA_SQL);
    this.repairLegacyCharacterNames();
  }

  registerAccount(usernameRaw: string, passwordRaw: string, emailRaw?: string | null, sessionMeta?: SessionMeta) {
    const username = this.normalizeUsername(usernameRaw);
    const password = this.normalizePassword(passwordRaw);
    const email = this.normalizeEmail(emailRaw);

    const existing = this.db.prepare(`
      SELECT id FROM accounts WHERE username = ? OR (? IS NOT NULL AND email = ?)
    `).get(username, email, email) as { id: number } | undefined;

    if (existing) {
      throw new Error("Account with that username or email already exists");
    }

    const now = this.nowIso();
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = this.hashPassword(password, salt);
    const insert = this.db.prepare(`
      INSERT INTO accounts (username, email, password_hash, password_salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, email, hash, salt, now, now);

    const accountId = Number(insert.lastInsertRowid);
    this.ensureSecuritySettings(accountId);
    this.rememberTrustedLocation(accountId, sessionMeta);
    const session = this.createAccountSession(accountId, sessionMeta);
    return { account: this.getAccountById(accountId)!, session };
  }

  loginAccount(loginRaw: string, passwordRaw: string, sessionMeta?: SessionMeta) {
    const account = this.authenticateAccountCredentials(loginRaw, passwordRaw);
    this.ensureSecuritySettings(account.id);
    this.rememberTrustedLocation(account.id, sessionMeta);
    const session = this.createAccountSession(account.id, sessionMeta);
    return {
      account: this.toPublicAccount(account),
      session,
    };
  }

  authenticateAccountCredentials(loginRaw: string, passwordRaw: string) {
    const login = String(loginRaw || "").trim();
    const password = this.normalizePassword(passwordRaw);
    const account = this.db.prepare(`
      SELECT id, username, email, password_hash, password_salt, created_at, updated_at
      FROM accounts
      WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
    `).get(login, login) as AccountAuthRow | undefined;

    if (!account) {
      throw new Error("Invalid username/email or password");
    }

    if (!this.verifyPassword(password, account.password_salt, account.password_hash)) {
      throw new Error("Invalid username/email or password");
    }

    return account;
  }

  logoutAccountSession(sessionToken: string) {
    this.db.prepare(`DELETE FROM account_sessions WHERE id = ?`).run(sessionToken);
  }

  updateAccountEmail(sessionToken: string, emailRaw: string, currentPasswordRaw: string, expiresInMinutes: number) {
    const ctx = this.requireSession(sessionToken);
    const email = this.normalizeEmail(emailRaw);
    if (!email) {
      throw new Error("Email address is required");
    }

    const currentPassword = this.normalizePassword(currentPasswordRaw);
    const account = this.getAccountAuthById(ctx.account.id);
    if (!account) {
      throw new Error("Account not found");
    }

    if (!this.verifyPassword(currentPassword, account.password_salt, account.password_hash)) {
      throw new Error("Current password is incorrect");
    }

    const existing = this.db.prepare(`
      SELECT id FROM accounts WHERE email = ? COLLATE NOCASE AND id != ?
    `).get(email, ctx.account.id) as { id: number } | undefined;

    if (existing) {
      throw new Error("That email address is already in use");
    }

    const challenge = this.createAuthChallenge({
      accountId: ctx.account.id,
      purpose: "email-change-confirm",
      expiresInMinutes,
      state: {
        newEmail: email,
      },
    });

    return {
      account: this.getAccountById(ctx.account.id)!,
      pendingEmail: email,
      emailMasked: this.maskEmail(email),
      expiresAt: challenge.expires_at,
      token: challenge.id,
    };
  }

  confirmAccountEmailChange(challengeTokenRaw: string) {
    const challengeToken = String(challengeTokenRaw || "").trim();
    if (!challengeToken) {
      throw new Error("Confirmation token is required");
    }

    const challenge = this.requireAuthChallenge(challengeToken, "email-change-confirm");
    const state = this.parseChallengeState<{ newEmail?: string }>(challenge.state_json);
    const newEmail = this.normalizeEmail(state.newEmail);
    if (!challenge.account_id || !newEmail) {
      throw new Error("Confirmation link is invalid or has expired");
    }

    const existing = this.db.prepare(`
      SELECT id FROM accounts WHERE email = ? COLLATE NOCASE AND id != ?
    `).get(newEmail, challenge.account_id) as { id: number } | undefined;

    if (existing) {
      throw new Error("That email address is already in use");
    }

    const now = this.nowIso();
    this.db.prepare(`
      UPDATE accounts
      SET email = ?, updated_at = ?
      WHERE id = ?
    `).run(newEmail, now, challenge.account_id);
    this.completeAuthChallenge(challenge.id);

    return this.getAccountById(challenge.account_id)!;
  }

  updateAccountPassword(sessionToken: string, currentPasswordRaw: string, newPasswordRaw: string, expiresInMinutes: number) {
    const ctx = this.requireSession(sessionToken);
    const currentPassword = this.normalizePassword(currentPasswordRaw);
    const newPassword = this.normalizePassword(newPasswordRaw);
    const account = this.getAccountAuthById(ctx.account.id);
    if (!account) {
      throw new Error("Account not found");
    }

    if (!this.verifyPassword(currentPassword, account.password_salt, account.password_hash)) {
      throw new Error("Current password is incorrect");
    }

    if (currentPassword === newPassword) {
      throw new Error("New password must be different from your current password");
    }

    if (!account.email) {
      throw new Error("Add a recovery email before requesting a password change link");
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = this.hashPassword(newPassword, salt);
    const challenge = this.createAuthChallenge({
      accountId: ctx.account.id,
      purpose: "password-change-confirm",
      expiresInMinutes,
      state: {
        newPasswordHash: hash,
        newPasswordSalt: salt,
        keepSessionToken: sessionToken,
      },
    });

    return {
      account: this.getAccountById(ctx.account.id)!,
      emailMasked: this.maskEmail(account.email),
      expiresAt: challenge.expires_at,
      token: challenge.id,
    };
  }

  confirmAccountPasswordChange(challengeTokenRaw: string) {
    const challengeToken = String(challengeTokenRaw || "").trim();
    if (!challengeToken) {
      throw new Error("Confirmation token is required");
    }

    const challenge = this.requireAuthChallenge(challengeToken, "password-change-confirm");
    const state = this.parseChallengeState<{
      newPasswordHash?: string;
      newPasswordSalt?: string;
      keepSessionToken?: string;
    }>(challenge.state_json);

    if (!challenge.account_id || !state.newPasswordHash || !state.newPasswordSalt) {
      throw new Error("Confirmation link is invalid or has expired");
    }

    const now = this.nowIso();
    this.db.prepare(`
      UPDATE accounts
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(state.newPasswordHash, state.newPasswordSalt, now, challenge.account_id);

    this.invalidateAccountSessions(
      challenge.account_id,
      typeof state.keepSessionToken === "string" && state.keepSessionToken.trim()
        ? state.keepSessionToken
        : null
    );
    this.completeAuthChallenge(challenge.id);

    return this.getAccountById(challenge.account_id)!;
  }

  listSecurityQuestionOptions() {
    return SECURITY_QUESTION_OPTIONS.map((option) => ({ ...option }));
  }

  setEmailOtpOnNewIp(sessionToken: string, enabledRaw: unknown) {
    const ctx = this.requireSession(sessionToken);
    this.ensureSecuritySettings(ctx.account.id);
    const enabled = enabledRaw === true || enabledRaw === 1 || enabledRaw === "1";
    const now = this.nowIso();
    this.db.prepare(`
      UPDATE account_security_settings
      SET email_otp_on_new_ip = ?, updated_at = ?
      WHERE account_id = ?
    `).run(enabled ? 1 : 0, now, ctx.account.id);
    return this.getSecurityProfile(ctx.account.id, ctx.session);
  }

  updateSecurityQuestions(sessionToken: string, currentPasswordRaw: string, questionsRaw: unknown) {
    const ctx = this.requireSession(sessionToken);
    const currentPassword = this.normalizePassword(currentPasswordRaw);
    const account = this.getAccountAuthById(ctx.account.id);
    if (!account) {
      throw new Error("Account not found");
    }
    if (!this.verifyPassword(currentPassword, account.password_salt, account.password_hash)) {
      throw new Error("Current password is incorrect");
    }

    const rows = this.normalizeSecurityQuestionSet(questionsRaw);
    const now = this.nowIso();
    this.db.prepare(`DELETE FROM account_security_questions WHERE account_id = ?`).run(ctx.account.id);
    const insert = this.db.prepare(`
      INSERT INTO account_security_questions (
        account_id,
        slot_index,
        question_key,
        answer_hash,
        answer_salt,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const row of rows) {
      const salt = crypto.randomBytes(16).toString("hex");
      const normalizedAnswer = this.normalizeSecurityAnswer(row.answer);
      insert.run(
        ctx.account.id,
        row.slotIndex,
        row.questionKey,
        this.hashSecurityAnswer(normalizedAnswer, salt),
        salt,
        now,
        now
      );
    }

    return this.getSecurityProfile(ctx.account.id, ctx.session);
  }

  beginTotpSetup(sessionToken: string, currentPasswordRaw: string) {
    const ctx = this.requireSession(sessionToken);
    const currentPassword = this.normalizePassword(currentPasswordRaw);
    const account = this.getAccountAuthById(ctx.account.id);
    if (!account) {
      throw new Error("Account not found");
    }
    if (!this.verifyPassword(currentPassword, account.password_salt, account.password_hash)) {
      throw new Error("Current password is incorrect");
    }

    const secretBase32 = this.generateTotpSecret();
    const challenge = this.createAuthChallenge({
      accountId: ctx.account.id,
      purpose: AUTH_CHALLENGE_PURPOSE_TOTP_SETUP,
      expiresInMinutes: 15,
      state: { secretBase32 },
    });

    return {
      setupToken: challenge.id,
      secretBase32,
      issuer: "Skyrim Unbound",
      accountLabel: account.username,
      otpauthUri: this.buildTotpUri(account.username, secretBase32),
      expiresAt: challenge.expires_at,
    };
  }

  enableTotp(sessionToken: string, setupTokenRaw: string, codeRaw: string) {
    const ctx = this.requireSession(sessionToken);
    const setupToken = String(setupTokenRaw || "").trim();
    const code = this.normalizeNumericCode(codeRaw, 6, "Authenticator code");
    if (!setupToken) {
      throw new Error("2FA setup token is required");
    }

    const challenge = this.requireAuthChallenge(setupToken, AUTH_CHALLENGE_PURPOSE_TOTP_SETUP);
    if (challenge.account_id !== ctx.account.id) {
      throw new Error("2FA setup does not belong to this account");
    }

    const state = this.parseChallengeState<{ secretBase32?: string }>(challenge.state_json);
    const secretBase32 = String(state.secretBase32 || "").trim();
    if (!secretBase32) {
      throw new Error("2FA setup is invalid or has expired");
    }
    if (!this.verifyTotp(secretBase32, code)) {
      throw new Error("Authenticator code is invalid");
    }

    const now = this.nowIso();
    this.db.prepare(`
      INSERT INTO account_totp_credentials (account_id, secret_base32, created_at, enabled_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id) DO UPDATE SET
        secret_base32 = excluded.secret_base32,
        enabled_at = excluded.enabled_at,
        updated_at = excluded.updated_at
    `).run(ctx.account.id, secretBase32, now, now, now);

    this.completeAuthChallenge(challenge.id);
    return this.getSecurityProfile(ctx.account.id, ctx.session);
  }

  disableTotp(sessionToken: string, currentPasswordRaw: string, codeRaw: string) {
    const ctx = this.requireSession(sessionToken);
    const currentPassword = this.normalizePassword(currentPasswordRaw);
    const code = this.normalizeNumericCode(codeRaw, 6, "Authenticator code");
    const account = this.getAccountAuthById(ctx.account.id);
    if (!account) {
      throw new Error("Account not found");
    }
    if (!this.verifyPassword(currentPassword, account.password_salt, account.password_hash)) {
      throw new Error("Current password is incorrect");
    }

    const credential = this.getTotpCredential(ctx.account.id);
    if (!credential) {
      throw new Error("Authenticator 2FA is not enabled");
    }
    if (!this.verifyTotp(credential.secret_base32, code)) {
      throw new Error("Authenticator code is invalid");
    }

    this.db.prepare(`DELETE FROM account_totp_credentials WHERE account_id = ?`).run(ctx.account.id);
    return this.getSecurityProfile(ctx.account.id, ctx.session);
  }

  startSecurityRecovery(loginRaw: string, sessionMeta?: SessionMeta) {
    const login = String(loginRaw || "").trim();
    if (!login) {
      throw new Error("Username or email is required");
    }

    const account = this.findAccountByLogin(login);
    if (!account) {
      throw new Error("Account not found");
    }

    const questions = this.getConfiguredSecurityQuestions(account.id);
    if (questions.length !== SECURITY_QUESTION_COUNT) {
      throw new Error("Security-question recovery is not configured for this account");
    }

    const challenge = this.createAuthChallenge({
      accountId: account.id,
      purpose: AUTH_CHALLENGE_PURPOSE_SECURITY_RECOVERY,
      expiresInMinutes: 15,
      state: {
        questionKeys: questions.map((row) => row.question_key),
        requestedIp: sessionMeta?.remoteIp ?? null,
        userAgent: sessionMeta?.userAgent ?? null,
      },
    });

    return {
      challengeToken: challenge.id,
      expiresAt: challenge.expires_at,
      questions: questions.map((row) => ({
        questionKey: row.question_key,
        prompt: this.getSecurityQuestionPrompt(row.question_key),
      })),
    };
  }

  completeSecurityRecovery(challengeTokenRaw: string, answersRaw: unknown, newPasswordRaw: string) {
    const challengeToken = String(challengeTokenRaw || "").trim();
    if (!challengeToken) {
      throw new Error("Recovery token is required");
    }

    const challenge = this.requireAuthChallenge(challengeToken, AUTH_CHALLENGE_PURPOSE_SECURITY_RECOVERY);
    if (!challenge.account_id) {
      throw new Error("Recovery token is invalid");
    }

    const answers = this.normalizeRecoveryAnswers(answersRaw);
    const questions = this.getConfiguredSecurityQuestions(challenge.account_id);
    if (questions.length !== SECURITY_QUESTION_COUNT) {
      throw new Error("Security-question recovery is not configured for this account");
    }

    for (const question of questions) {
      const answer = answers.get(question.question_key);
      if (!answer) {
        throw new Error("Every recovery question must be answered");
      }
      const expectedHash = this.hashSecurityAnswer(answer, question.answer_salt);
      if (!crypto.timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(question.answer_hash, "hex"))) {
        throw new Error("One or more recovery answers are incorrect");
      }
    }

    const newPassword = this.normalizePassword(newPasswordRaw);
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = this.hashPassword(newPassword, salt);
    const now = this.nowIso();
    this.db.prepare(`
      UPDATE accounts
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(hash, salt, now, challenge.account_id);

    this.completeAuthChallenge(challenge.id);
    this.invalidateAccountSessions(challenge.account_id);
    return this.getAccountById(challenge.account_id)!;
  }

  getLoginChallengeForCredentials(loginRaw: string, passwordRaw: string, sessionMeta: SessionMeta, recoveryMailSettings: RecoveryMailSettings | null): {
    account: PublicAccount;
    session: { token: string; expiresAt: string } | null;
    challenge: {
      token: string;
      requiresEmailOtp: boolean;
      requiresTotp: boolean;
      emailMasked: string | null;
      emailOtpCode: string | null;
      expiresAt: string;
    } | null;
  } {
    const account = this.authenticateAccountCredentials(loginRaw, passwordRaw);
    this.ensureSecuritySettings(account.id);
    const securityProfile = this.getSecurityProfile(account.id);
    const hasTrustedLocations = this.countTrustedLoginLocations(account.id) > 0;
    const currentIp = String(sessionMeta.remoteIp || "").trim();
    const emailOtpAvailable = !!(securityProfile.emailOtpOnNewIp && currentIp && account.email && recoveryMailSettings);
    const requireEmailOtp = emailOtpAvailable && hasTrustedLocations && !this.isTrustedLoginLocation(account.id, currentIp);
    const requireTotp = !!securityProfile.totpEnabled;

    if (!requireEmailOtp && !requireTotp) {
      this.rememberTrustedLocation(account.id, sessionMeta);
      const session = this.createAccountSession(account.id, sessionMeta);
      return {
        account: this.toPublicAccount(account),
        session,
        challenge: null,
      };
    }

    const emailOtpCode = requireEmailOtp ? this.generateNumericCode(6) : null;
    const challenge = this.createAuthChallenge({
      accountId: account.id,
      purpose: AUTH_CHALLENGE_PURPOSE_LOGIN,
      expiresInMinutes: LOGIN_OTP_TTL_MINUTES,
      state: {
        remoteIp: currentIp || null,
        userAgent: sessionMeta.userAgent ?? null,
        requireEmailOtp,
        requireTotp,
        emailOtpHash: emailOtpCode ? this.hashToken(emailOtpCode) : null,
        emailOtpSentTo: requireEmailOtp ? account.email : null,
      },
    });

    return {
      account: this.toPublicAccount(account),
      session: null,
      challenge: {
        token: challenge.id,
        requiresEmailOtp: requireEmailOtp,
        requiresTotp: requireTotp,
        emailMasked: requireEmailOtp ? this.maskEmail(account.email) : null,
        emailOtpCode,
        expiresAt: challenge.expires_at,
      },
    };
  }

  completeLoginChallenge(challengeTokenRaw: string, sessionMeta: SessionMeta, codesRaw: { emailOtp?: unknown; totpCode?: unknown }) {
    const challengeToken = String(challengeTokenRaw || "").trim();
    if (!challengeToken) {
      throw new Error("Challenge token is required");
    }

    const challenge = this.requireAuthChallenge(challengeToken, AUTH_CHALLENGE_PURPOSE_LOGIN);
    if (!challenge.account_id) {
      throw new Error("Challenge is invalid");
    }

    const state = this.parseChallengeState<{
      requireEmailOtp?: boolean;
      requireTotp?: boolean;
      emailOtpHash?: string | null;
      remoteIp?: string | null;
      userAgent?: string | null;
    }>(challenge.state_json);

    if (state.requireEmailOtp) {
      const emailOtp = this.normalizeNumericCode(codesRaw.emailOtp, 6, "Email OTP");
      const expectedHash = String(state.emailOtpHash || "");
      if (!expectedHash || this.hashToken(emailOtp) !== expectedHash) {
        throw new Error("Email OTP code is invalid");
      }
    }

    if (state.requireTotp) {
      const totpCode = this.normalizeNumericCode(codesRaw.totpCode, 6, "Authenticator code");
      const credential = this.getTotpCredential(challenge.account_id);
      if (!credential || !this.verifyTotp(credential.secret_base32, totpCode)) {
        throw new Error("Authenticator code is invalid");
      }
    }

    this.completeAuthChallenge(challenge.id);
    this.rememberTrustedLocation(challenge.account_id, sessionMeta);
    const session = this.createAccountSession(challenge.account_id, sessionMeta);
    return {
      account: this.getAccountById(challenge.account_id)!,
      session,
    };
  }

  createPasswordResetRequest(loginRaw: string, sessionMeta?: SessionMeta) {
    const login = String(loginRaw || "").trim();
    if (!login) {
      throw new Error("Username or email is required");
    }

    const account = this.db.prepare(`
      SELECT id, username, email, created_at, updated_at
      FROM accounts
      WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
    `).get(login, login) as AccountRow | undefined;

    if (!account) {
      return null;
    }

    if (!account.email) {
      throw new Error("This account does not have a recovery email set yet");
    }

    const now = this.nowIso();
    const expiresAt = new Date(this.nowDate().getTime() + 60 * 60 * 1000).toISOString();
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(token);

    this.db.prepare(`
      DELETE FROM password_reset_tokens
      WHERE account_id = ? AND used_at IS NULL
    `).run(account.id);

    const insert = this.db.prepare(`
      INSERT INTO password_reset_tokens (account_id, token_hash, created_at, expires_at, used_at, requested_ip, user_agent)
      VALUES (?, ?, ?, ?, NULL, ?, ?)
    `).run(
      account.id,
      tokenHash,
      now,
      expiresAt,
      sessionMeta?.remoteIp ?? null,
      sessionMeta?.userAgent ?? null
    );

    return {
      id: Number(insert.lastInsertRowid),
      account: this.toPublicAccount(account),
      email: account.email,
      token,
      expiresAt,
    };
  }

  resetPasswordWithToken(tokenRaw: string, passwordRaw: string) {
    const token = String(tokenRaw || "").trim();
    if (!token) {
      throw new Error("Reset token is required");
    }

    const resetRow = this.db.prepare(`
      SELECT id, account_id, token_hash, created_at, expires_at, used_at, requested_ip, user_agent
      FROM password_reset_tokens
      WHERE token_hash = ?
    `).get(this.hashToken(token)) as PasswordResetTokenRow | undefined;

    if (!resetRow) {
      throw new Error("Reset link is invalid or has expired");
    }

    if (resetRow.used_at) {
      throw new Error("Reset link has already been used");
    }

    if (new Date(resetRow.expires_at).getTime() <= Date.now()) {
      throw new Error("Reset link is invalid or has expired");
    }

    const newPassword = this.normalizePassword(passwordRaw);
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = this.hashPassword(newPassword, salt);
    const now = this.nowIso();

    this.db.prepare(`
      UPDATE accounts
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(hash, salt, now, resetRow.account_id);

    this.db.prepare(`
      UPDATE password_reset_tokens
      SET used_at = ?
      WHERE id = ?
    `).run(now, resetRow.id);

    this.invalidateAccountSessions(resetRow.account_id);

    return this.getAccountById(resetRow.account_id)!;
  }

  getSessionContext(sessionToken: string) {
    this.pruneExpired();

    const session = this.db.prepare(`
      SELECT id, account_id, selected_character_id, created_at, expires_at, last_seen_at
      FROM account_sessions
      WHERE id = ?
    `).get(sessionToken) as AccountSessionRow | undefined;

    if (!session) {
      return null;
    }

    const account = this.getAccountById(session.account_id);
    if (!account) {
      return null;
    }

    this.db.prepare(`
      UPDATE account_sessions SET last_seen_at = ? WHERE id = ?
    `).run(this.nowIso(), session.id);

    const selectedCharacter = session.selected_character_id
      ? this.getCharacterById(session.selected_character_id)
      : null;

    return {
      session,
      account,
      selectedCharacter,
    };
  }

  listCommunityEvents(args: { month?: string; tzOffsetMinutes?: unknown; sessionToken?: string | null }) {
    const window = getCommunityEventMonthWindow(args.month, args.tzOffsetMinutes, this.nowDate());
    const hostTimeZone = getResolvedCommunityEventTimeZone();
    const [windowYearText, windowMonthText] = window.month.split("-");
    const hostMonthReferenceDate = new Date(Date.UTC(Number(windowYearText), Number(windowMonthText) - 1, 15, 12, 0, 0, 0));
    const hostTzOffsetMinutes = getTimeZoneOffsetMinutesForDate(hostMonthReferenceDate, hostTimeZone);
    const accountId = args.sessionToken ? this.getSessionContext(args.sessionToken)?.account.id ?? null : null;
    const rows = this.db.prepare(`
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.description,
        e.status,
        e.created_by_account_id,
        a.username AS created_by_username,
        e.updated_by_account_id,
        e.created_at,
        e.updated_at,
        COALESCE(ic.interest_count, 0) AS interest_count,
        CASE
          WHEN ? IS NOT NULL AND EXISTS (
            SELECT 1
            FROM community_event_interests cei
            WHERE cei.event_id = e.id
              AND cei.account_id = ?
          ) THEN 1
          ELSE 0
        END AS is_interested
      FROM community_events e
      LEFT JOIN accounts a ON a.id = e.created_by_account_id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS interest_count
        FROM community_event_interests
        GROUP BY event_id
      ) ic ON ic.event_id = e.id
      WHERE e.status <> 'ARCHIVED'
        AND e.starts_at >= ?
        AND e.starts_at < ?
      ORDER BY e.starts_at ASC, e.id ASC
    `).all(accountId, accountId, window.startIso, window.endIso) as CommunityEventRow[];

    return {
      month: window.month,
      tzOffsetMinutes: window.tzOffsetMinutes,
      hostTimeZone,
      hostTzOffsetMinutes,
      events: rows.map((row) => this.mapCommunityEvent(row)),
    };
  }

  setCommunityEventInterest(sessionToken: string, eventId: number, interested: boolean) {
    const session = this.requireSession(sessionToken);
    const event = this.db.prepare(`
      SELECT id, starts_at, status
      FROM community_events
      WHERE id = ? AND status <> 'ARCHIVED'
    `).get(eventId) as { id: number; starts_at: string; status: string } | undefined;

    if (!event) {
      throw new Error("Event not found");
    }
    if (String(event.status).toUpperCase() === "CANCELLED") {
      throw new Error("Interest is disabled for cancelled events");
    }
    if (new Date(event.starts_at).getTime() <= Date.now()) {
      throw new Error("Interest is only available for upcoming events");
    }

    if (interested) {
      this.db.prepare(`
        INSERT OR IGNORE INTO community_event_interests (
          event_id,
          account_id,
          created_at
        )
        VALUES (?, ?, ?)
      `).run(event.id, session.account.id, this.nowIso());
    } else {
      this.db.prepare(`
        DELETE FROM community_event_interests
        WHERE event_id = ? AND account_id = ?
      `).run(event.id, session.account.id);
    }

    const updated = this.getCommunityEventById(event.id, session.account.id);
    if (!updated) {
      throw new Error("Event not found");
    }

    return updated;
  }

  listCharacters(accountId: number) {
    return this.db.prepare(`
      SELECT id, account_id, slot_index, name, profile_id, created_at, updated_at, last_used_at
      FROM characters
      WHERE account_id = ?
      ORDER BY slot_index ASC
    `).all(accountId) as CharacterRow[];
  }

  createCharacter(sessionToken: string) {
    const ctx = this.requireSession(sessionToken);
    this.assertWhitelistUnlocked(ctx.account.id);
    const characters = this.listCharacters(ctx.account.id);
    if (characters.length >= 3) {
      throw new Error("Character limit reached");
    }

    const usedSlots = new Set(characters.map((c) => c.slot_index));
    const slotIndex = [1, 2, 3].find((slot) => !usedSlots.has(slot));
    if (!slotIndex) {
      throw new Error("No character slot available");
    }

    const now = this.nowIso();
    const profileId = this.allocateProfileId();
    const insert = this.db.prepare(`
      INSERT INTO characters (account_id, slot_index, name, profile_id, created_at, updated_at, last_used_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(ctx.account.id, slotIndex, "", profileId, now, now);

    const characterId = Number(insert.lastInsertRowid);
    this.purgeWorldStateForProfile(profileId);
    this.db.prepare(`
      DELETE FROM play_sessions
      WHERE character_id = ? OR profile_id = ?
    `).run(characterId, profileId);
    this.db.prepare(`
      UPDATE account_sessions SET selected_character_id = ? WHERE id = ?
    `).run(characterId, sessionToken);

    return this.getCharacterById(characterId)!;
  }

  finalizeCharacterName(sessionToken: string, characterId: number, nameRaw: string) {
    const ctx = this.requireSession(sessionToken);
    this.assertWhitelistUnlocked(ctx.account.id);
    const character = this.getCharacterById(characterId);
    if (!character || character.account_id !== ctx.account.id) {
      throw new Error("Character not found");
    }

    const name = this.normalizeCharacterName(nameRaw);
    const existingByName = this.db.prepare(`
      SELECT id FROM characters WHERE name = ? COLLATE NOCASE AND id != ?
    `).get(name, character.id) as { id: number } | undefined;
    if (existingByName) {
      throw new Error("Character name is already taken");
    }

    const now = this.nowIso();
    try {
      this.db.prepare(`
        UPDATE characters
        SET name = ?, updated_at = ?, last_used_at = COALESCE(last_used_at, ?)
        WHERE id = ?
      `).run(name, now, now, character.id);
    } catch (error) {
      if (`${error}`.toLowerCase().includes("unique")) {
        throw new Error("Character name is already taken");
      }
      throw error;
    }

    this.syncWorldCharacterName(character.profile_id, name);
    return this.getCharacterById(character.id)!;
  }

  selectCharacter(sessionToken: string, characterId: number) {
    const ctx = this.requireSession(sessionToken);
    this.assertWhitelistUnlocked(ctx.account.id);
    const character = this.getCharacterById(characterId);
    if (!character || character.account_id !== ctx.account.id) {
      throw new Error("Character not found");
    }

    this.db.prepare(`
      UPDATE account_sessions SET selected_character_id = ? WHERE id = ?
    `).run(character.id, sessionToken);

    return this.getCharacterById(character.id)!;
  }

  getProfileHub(sessionToken: string) {
    const ctx = this.requireSession(sessionToken);
    const characters = this.listCharacters(ctx.account.id);
    const staff = this.getStaffProfile(ctx.account.id);
    const community = this.getCommunityProfile(ctx.account.id);
    const tickets = this.getTicketSummary(ctx.account.id);
    const applications = this.getApplicationSummary(ctx.account.id, ctx.selectedCharacter?.id ?? null);
    const serverRecord = this.getServerRecord(ctx.account.id, ctx.selectedCharacter?.id ?? null);
    const activeSessionCount = this.countActiveSessions(ctx.account.id);
    const accountCreatedAt = String(ctx.account.createdAt || "");
    const timeline = this.buildTimeline({
      accountCreatedAt,
      characters,
      tickets,
      applications,
      serverRecord,
    });

    return {
      staff,
      community,
      stats: {
        profileComments: 0,
        accountAgeDays: accountCreatedAt ? Math.max(0, Math.floor((Date.now() - new Date(accountCreatedAt).getTime()) / (24 * 60 * 60 * 1000))) : 0,
        characterCount: characters.length,
        activeSessions: activeSessionCount,
      },
      tickets,
      applications,
      serverRecord,
      security: this.getSecurityProfile(ctx.account.id, ctx.session),
      timeline,
    };
  }

  updateForumGroupSelection(sessionToken: string, actionRaw: unknown, groupCodeRaw: unknown) {
    const ctx = this.requireSession(sessionToken);
    this.assertWhitelistUnlocked(ctx.account.id);
    const action = String(actionRaw || "").trim();
    const groupCode = String(groupCodeRaw || "").trim().toUpperCase();

    if (!groupCode) {
      throw new Error("Choose a forum badge group first");
    }

    const community = this.getCommunityProfile(ctx.account.id);
    const eligibleCodes = new Set<string>(
      Array.isArray(community?.forumGroups?.eligibleGroups)
        ? community.forumGroups.eligibleGroups.map((group) => String(group.code || "").trim().toUpperCase()).filter(Boolean)
        : []
    );

    if (!eligibleCodes.size) {
      throw new Error("No forum badge groups are attached to this account yet");
    }

    if (!eligibleCodes.has(groupCode)) {
      throw new Error("That forum badge group is not available on this account");
    }

    const preferences = this.getForumGroupPreferences(ctx.account.id);
    const secondary = new Set(this.parseStringListJson(preferences?.secondary_group_codes_json, eligibleCodes));
    let primaryGroupCode = preferences?.primary_group_code && eligibleCodes.has(preferences.primary_group_code)
      ? preferences.primary_group_code
      : null;

    if (action === "setPrimary") {
      primaryGroupCode = groupCode;
      secondary.delete(groupCode);
    } else if (action === "addSecondary") {
      if (primaryGroupCode === groupCode) {
        throw new Error("That group is already your primary badge");
      }
      secondary.add(groupCode);
    } else {
      throw new Error("Unsupported forum badge action");
    }

    this.saveForumGroupPreferences(ctx.account.id, primaryGroupCode, Array.from(secondary));
    return this.getCommunityProfile(ctx.account.id);
  }

  private getCommunityProfile(accountId: number) {
    this.ensureForumGroupPreferences(accountId);
    const eligibleGroups = this.getActiveForumGroupEntitlements(accountId)
      .map((row) => this.getForumGroupOption(row.group_code))
      .filter((row): row is ForumGroupOption => !!row);
    const eligibleCodeSet = new Set(eligibleGroups.map((group) => group.code));
    const preferences = this.getForumGroupPreferences(accountId);
    const primaryGroupCode = preferences?.primary_group_code && eligibleCodeSet.has(preferences.primary_group_code)
      ? preferences.primary_group_code
      : null;
    const secondaryGroupCodes = this.parseStringListJson(preferences?.secondary_group_codes_json, eligibleCodeSet)
      .filter((code) => code !== primaryGroupCode);
    const discordLink = this.getDiscordLink(accountId);
    const claimedGroupCodes = this.parseClaimedGroupCodes(discordLink?.claim_state_json, eligibleCodeSet);
    const missingClaimableGroups = eligibleGroups.filter((group) => !claimedGroupCodes.includes(group.code));

    if (
      preferences
      && (
        preferences.primary_group_code !== primaryGroupCode
        || JSON.stringify(this.parseStringListJson(preferences.secondary_group_codes_json)) !== JSON.stringify(secondaryGroupCodes)
      )
    ) {
      this.saveForumGroupPreferences(accountId, primaryGroupCode, secondaryGroupCodes);
    }

    return {
      forumGroups: {
        availableOptions: FORUM_GROUP_OPTIONS.map((option) => ({ ...option })),
        eligibleGroups: eligibleGroups.map((option) => ({ ...option })),
        primaryGroupCode,
        primaryGroupLabel: primaryGroupCode ? this.getForumGroupOption(primaryGroupCode)?.label || null : null,
        secondaryGroupCodes,
        secondaryGroups: secondaryGroupCodes
          .map((code) => this.getForumGroupOption(code))
          .filter((row): row is ForumGroupOption => !!row)
          .map((option) => ({ ...option })),
        selectionEnabled: eligibleGroups.length > 0,
      },
      discord: {
        linked: !!discordLink?.discord_user_id,
        displayName: discordLink?.discord_username || null,
        discordUserId: discordLink?.discord_user_id || null,
        linkedAt: discordLink?.linked_at || null,
        linkFlowAvailable: false,
        autoClaimPlanned: true,
        missingClaimableGroups: missingClaimableGroups.map((option) => ({ ...option })),
      },
    };
  }

  private ensureForumGroupPreferences(accountId: number) {
    const now = this.nowIso();
    this.db.prepare(`
      INSERT INTO account_forum_group_preferences (account_id, primary_group_code, secondary_group_codes_json, created_at, updated_at)
      VALUES (?, NULL, '[]', ?, ?)
      ON CONFLICT(account_id) DO NOTHING
    `).run(accountId, now, now);
  }

  private getForumGroupPreferences(accountId: number) {
    return this.db.prepare(`
      SELECT account_id, primary_group_code, secondary_group_codes_json, created_at, updated_at
      FROM account_forum_group_preferences
      WHERE account_id = ?
    `).get(accountId) as ForumGroupPreferenceRow | undefined;
  }

  private saveForumGroupPreferences(accountId: number, primaryGroupCode: string | null, secondaryGroupCodesRaw: string[]) {
    this.ensureForumGroupPreferences(accountId);
    const secondaryGroupCodes = Array.from(new Set(
      secondaryGroupCodesRaw
        .map((code) => String(code || "").trim().toUpperCase())
        .filter(Boolean)
        .filter((code) => code !== primaryGroupCode)
    )).sort();
    const now = this.nowIso();
    this.db.prepare(`
      UPDATE account_forum_group_preferences
      SET primary_group_code = ?, secondary_group_codes_json = ?, updated_at = ?
      WHERE account_id = ?
    `).run(primaryGroupCode, JSON.stringify(secondaryGroupCodes), now, accountId);
  }

  private getActiveForumGroupEntitlements(accountId: number) {
    return this.db.prepare(`
      SELECT account_id, group_code, source, metadata_json, created_at, updated_at, revoked_at
      FROM account_forum_group_entitlements
      WHERE account_id = ? AND revoked_at IS NULL
      ORDER BY updated_at DESC, created_at DESC
    `).all(accountId) as ForumGroupEntitlementRow[];
  }

  private getForumGroupOption(groupCodeRaw: string) {
    const groupCode = String(groupCodeRaw || "").trim().toUpperCase();
    return FORUM_GROUP_OPTIONS.find((option) => option.code === groupCode) || null;
  }

  private getDiscordLink(accountId: number) {
    return this.db.prepare(`
      SELECT account_id, discord_user_id, discord_username, linked_at, updated_at, claim_state_json
      FROM account_discord_links
      WHERE account_id = ?
    `).get(accountId) as DiscordLinkRow | undefined;
  }

  private parseStringListJson(raw: string | null | undefined, allowedCodes?: Set<string>) {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return Array.from(new Set(
        parsed
          .map((value) => String(value || "").trim().toUpperCase())
          .filter(Boolean)
          .filter((code) => !allowedCodes || allowedCodes.has(code))
      )).sort();
    } catch {
      return [];
    }
  }

  private parseClaimedGroupCodes(raw: string | null | undefined, allowedCodes: Set<string>) {
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return [];
      }
      const claimedRaw = Array.isArray((parsed as Record<string, unknown>).claimedGroupCodes)
        ? (parsed as Record<string, unknown>).claimedGroupCodes as unknown[]
        : [];
      return Array.from(new Set(
        claimedRaw
          .map((value) => String(value || "").trim().toUpperCase())
          .filter((code) => allowedCodes.has(code))
      )).sort();
    } catch {
      return [];
    }
  }

  private getSecurityProfile(accountId: number, session?: AccountSessionRow | null) {
    this.ensureSecuritySettings(accountId);
    const settings = this.db.prepare(`
      SELECT email_otp_on_new_ip
      FROM account_security_settings
      WHERE account_id = ?
    `).get(accountId) as { email_otp_on_new_ip?: number } | undefined;
    const account = this.getAccountById(accountId);
    const questions = this.getConfiguredSecurityQuestions(accountId);
    const totp = this.getTotpCredential(accountId);

    return {
      sessionExpiresAt: session?.expires_at ?? null,
      activeSessions: this.countActiveSessions(accountId),
      hasRecoveryEmail: !!account?.email,
      emailOtpOnNewIp: Number(settings?.email_otp_on_new_ip ?? 1) === 1,
      totpEnabled: !!totp,
      securityQuestionsConfigured: questions.length === SECURITY_QUESTION_COUNT,
      configuredQuestions: questions.map((row) => ({
        slotIndex: row.slot_index,
        questionKey: row.question_key,
        prompt: this.getSecurityQuestionPrompt(row.question_key),
      })),
      questionOptions: this.listSecurityQuestionOptions(),
      trustedLocationCount: this.countTrustedLoginLocations(accountId),
    };
  }

  private ensureSecuritySettings(accountId: number) {
    const now = this.nowIso();
    this.db.prepare(`
      INSERT INTO account_security_settings (account_id, email_otp_on_new_ip, created_at, updated_at)
      VALUES (?, 1, ?, ?)
      ON CONFLICT(account_id) DO NOTHING
    `).run(accountId, now, now);
  }

  private getConfiguredSecurityQuestions(accountId: number) {
    return this.db.prepare(`
      SELECT account_id, slot_index, question_key, answer_hash, answer_salt, created_at, updated_at
      FROM account_security_questions
      WHERE account_id = ?
      ORDER BY slot_index ASC
    `).all(accountId) as SecurityQuestionRow[];
  }

  private normalizeSecurityQuestionSet(questionsRaw: unknown) {
    if (!Array.isArray(questionsRaw) || questionsRaw.length !== SECURITY_QUESTION_COUNT) {
      throw new Error(`Choose exactly ${SECURITY_QUESTION_COUNT} recovery questions`);
    }

    const seen = new Set<string>();
    return questionsRaw.map((entry, index) => {
      const record = (entry && typeof entry === "object") ? entry as Record<string, unknown> : {};
      const questionKey = String(record.questionKey || "").trim();
      if (!SECURITY_QUESTION_OPTIONS.some((option) => option.key === questionKey)) {
        throw new Error("One or more recovery questions are invalid");
      }
      if (seen.has(questionKey)) {
        throw new Error("Recovery questions must be unique");
      }
      seen.add(questionKey);
      return {
        slotIndex: index + 1,
        questionKey,
        answer: this.normalizeSecurityAnswer(record.answer),
      };
    });
  }

  private normalizeSecurityAnswer(answerRaw: unknown) {
    const answer = String(answerRaw || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
    if (answer.length < 2 || answer.length > 128) {
      throw new Error("Recovery answers must be between 2 and 128 characters");
    }
    return answer;
  }

  private normalizeRecoveryAnswers(answersRaw: unknown) {
    if (!Array.isArray(answersRaw) || !answersRaw.length) {
      throw new Error("Recovery answers are required");
    }
    const answers = new Map<string, string>();
    for (const entry of answersRaw) {
      const record = (entry && typeof entry === "object") ? entry as Record<string, unknown> : {};
      const questionKey = String(record.questionKey || "").trim();
      if (!questionKey) {
        continue;
      }
      answers.set(questionKey, this.normalizeSecurityAnswer(record.answer));
    }
    return answers;
  }

  private getSecurityQuestionPrompt(questionKey: string) {
    return SECURITY_QUESTION_OPTIONS.find((option) => option.key === questionKey)?.prompt || questionKey;
  }

  private hashSecurityAnswer(answer: string, salt: string) {
    return this.hashPassword(answer, salt);
  }

  private findAccountByLogin(loginRaw: string) {
    const login = String(loginRaw || "").trim();
    if (!login) {
      return null;
    }
    return this.db.prepare(`
      SELECT id, username, email, created_at, updated_at
      FROM accounts
      WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
    `).get(login, login) as AccountRow | undefined || null;
  }

  private createAuthChallenge(args: {
    accountId: number | null;
    purpose: string;
    expiresInMinutes: number;
    state: Record<string, unknown>;
  }): AuthChallengeRow {
    const now = this.nowDate();
    const expiresAt = new Date(now.getTime() + args.expiresInMinutes * 60 * 1000).toISOString();
    const id = crypto.randomBytes(32).toString("hex");
    this.db.prepare(`
      INSERT INTO auth_challenges (id, account_id, purpose, state_json, created_at, expires_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL)
    `).run(id, args.accountId, args.purpose, JSON.stringify(args.state), now.toISOString(), expiresAt);
    return {
      id,
      account_id: args.accountId,
      purpose: args.purpose,
      state_json: JSON.stringify(args.state),
      created_at: now.toISOString(),
      expires_at: expiresAt,
      completed_at: null,
    };
  }

  private requireAuthChallenge(challengeId: string, purpose: string) {
    this.pruneExpired();
    const row = this.db.prepare(`
      SELECT id, account_id, purpose, state_json, created_at, expires_at, completed_at
      FROM auth_challenges
      WHERE id = ? AND purpose = ?
    `).get(challengeId, purpose) as AuthChallengeRow | undefined;
    if (!row || row.completed_at) {
      throw new Error("Challenge is invalid or has expired");
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      throw new Error("Challenge is invalid or has expired");
    }
    return row;
  }

  private parseChallengeState<T extends Record<string, unknown>>(stateJson: string) {
    try {
      const parsed = JSON.parse(stateJson);
      return (parsed && typeof parsed === "object" ? parsed : {}) as T;
    } catch {
      return {} as T;
    }
  }

  private completeAuthChallenge(challengeId: string) {
    this.db.prepare(`
      UPDATE auth_challenges
      SET completed_at = ?
      WHERE id = ?
    `).run(this.nowIso(), challengeId);
  }

  private getTotpCredential(accountId: number) {
    return this.db.prepare(`
      SELECT account_id, secret_base32, created_at, enabled_at, updated_at
      FROM account_totp_credentials
      WHERE account_id = ?
    `).get(accountId) as TotpCredentialRow | undefined;
  }

  private generateTotpSecret() {
    return this.base32Encode(crypto.randomBytes(20));
  }

  private buildTotpUri(username: string, secretBase32: string) {
    const issuer = "Skyrim Unbound";
    const label = `${issuer}:${username}`;
    const url = new URL(`otpauth://totp/${encodeURIComponent(label)}`);
    url.searchParams.set("secret", secretBase32);
    url.searchParams.set("issuer", issuer);
    url.searchParams.set("algorithm", "SHA1");
    url.searchParams.set("digits", "6");
    url.searchParams.set("period", "30");
    return url.toString();
  }

  private verifyTotp(secretBase32: string, code: string, window = 1) {
    const nowCounter = Math.floor(Date.now() / 30000);
    for (let offset = -window; offset <= window; offset += 1) {
      if (this.generateTotpCode(secretBase32, nowCounter + offset) === code) {
        return true;
      }
    }
    return false;
  }

  private generateTotpCode(secretBase32: string, counter: number) {
    const secret = this.base32Decode(secretBase32);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const hmac = crypto.createHmac("sha1", secret).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24)
      | ((hmac[offset + 1] & 0xff) << 16)
      | ((hmac[offset + 2] & 0xff) << 8)
      | (hmac[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, "0");
  }

  private base32Encode(buffer: Buffer) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    let output = "";
    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }
    return output;
  }

  private base32Decode(base32: string) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const char of String(base32 || "").toUpperCase().replace(/=+$/g, "")) {
      const index = alphabet.indexOf(char);
      if (index === -1) {
        continue;
      }
      value = (value << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }

  private generateNumericCode(length: number) {
    const max = 10 ** length;
    return String(crypto.randomInt(0, max)).padStart(length, "0");
  }

  private normalizeNumericCode(codeRaw: unknown, length: number, label: string) {
    const code = String(codeRaw || "").trim();
    if (!new RegExp(`^\\d{${length}}$`).test(code)) {
      throw new Error(`${label} must be ${length} digits`);
    }
    return code;
  }

  private rememberTrustedLocation(accountId: number, sessionMeta?: SessionMeta) {
    const remoteIp = String(sessionMeta?.remoteIp || "").trim();
    if (!remoteIp) {
      return;
    }
    const now = this.nowIso();
    const userAgentHash = this.hashUserAgent(sessionMeta?.userAgent);
    this.db.prepare(`
      INSERT INTO trusted_login_locations (account_id, remote_ip, user_agent_hash, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(account_id, remote_ip) DO UPDATE SET
        user_agent_hash = excluded.user_agent_hash,
        last_seen_at = excluded.last_seen_at
    `).run(accountId, remoteIp, userAgentHash, now, now);
  }

  private isTrustedLoginLocation(accountId: number, remoteIpRaw: string) {
    const remoteIp = String(remoteIpRaw || "").trim();
    if (!remoteIp) {
      return false;
    }
    const row = this.db.prepare(`
      SELECT id
      FROM trusted_login_locations
      WHERE account_id = ? AND remote_ip = ?
    `).get(accountId, remoteIp) as { id: number } | undefined;
    return !!row;
  }

  private countTrustedLoginLocations(accountId: number) {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM trusted_login_locations
      WHERE account_id = ?
    `).get(accountId) as { count?: number } | undefined;
    return Number(row?.count || 0);
  }

  private hashUserAgent(userAgentRaw?: string | null) {
    const userAgent = String(userAgentRaw || "").trim();
    return userAgent ? crypto.createHash("sha256").update(userAgent).digest("hex") : null;
  }

  private maskEmail(emailRaw?: string | null) {
    const email = String(emailRaw || "").trim();
    if (!email.includes("@")) {
      return "your email";
    }
    const [local, domain] = email.split("@");
    const localMasked = local.length <= 2 ? `${local[0] || "*"}*` : `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}`;
    const domainParts = domain.split(".");
    const domainName = domainParts.shift() || "";
    const maskedDomain = domainName.length <= 1 ? "*" : `${domainName[0]}${"*".repeat(Math.max(1, domainName.length - 1))}`;
    return `${localMasked}@${maskedDomain}${domainParts.length ? `.${domainParts.join(".")}` : ""}`;
  }

  createPlaySession(sessionToken: string, serverMasterKey: string, preferredCharacterId?: number) {
    const ctx = this.requireSession(sessionToken);
    const character = preferredCharacterId
      ? this.selectCharacter(sessionToken, preferredCharacterId)
      : (ctx.selectedCharacter ?? null);

    if (!character) {
      throw new Error("No character selected");
    }

    if (this.isCharacterUnfinalized(character.name)) {
      this.purgeWorldStateForProfile(character.profile_id);
      this.db.prepare(`
        DELETE FROM play_sessions
        WHERE character_id = ? OR profile_id = ?
      `).run(character.id, character.profile_id);
    }

    this.db.prepare(`
      DELETE FROM play_sessions
      WHERE character_id = ? OR profile_id = ?
    `).run(character.id, character.profile_id);
    this.touchCharacterLastUsed(character.id);

    const now = this.nowDate();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
    const playSession: PlaySessionRow = {
      id: crypto.randomBytes(32).toString("hex"),
      account_id: ctx.account.id,
      character_id: character.id,
      profile_id: character.profile_id,
      server_master_key: serverMasterKey,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    this.db.prepare(`
      INSERT INTO play_sessions (id, account_id, character_id, profile_id, server_master_key, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      playSession.id,
      playSession.account_id,
      playSession.character_id,
      playSession.profile_id,
      playSession.server_master_key,
      playSession.created_at,
      playSession.expires_at
    );

    return playSession;
  }

  getPlaySession(sessionToken: string, serverMasterKey: string) {
    this.pruneExpired();
    return this.db.prepare(`
      SELECT id, account_id, character_id, profile_id, server_master_key, created_at, expires_at
      FROM play_sessions
      WHERE id = ? AND server_master_key = ?
    `).get(sessionToken, serverMasterKey) as PlaySessionRow | undefined;
  }

  private requireSession(sessionToken: string) {
    const ctx = this.getSessionContext(sessionToken);
    if (!ctx) {
      throw new Error("Not authenticated");
    }
    return ctx;
  }

  private countActiveSessions(accountId: number) {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM account_sessions
      WHERE account_id = ? AND expires_at > ?
    `).get(accountId, this.nowIso()) as { count?: number } | undefined;
    return Number(row?.count || 0);
  }

  private getStaffProfile(accountId: number) {
    if (!this.tableExists("staff_roles") || !this.tableExists("account_staff_roles")) {
      return {
        roles: [],
        permissions: [] as string[],
        hasAdminPanelAccess: false,
        primaryRoleLabel: "Player",
        badges: ["Player"],
      };
    }

    const roles = this.db.prepare(`
      SELECT DISTINCT sr.id, sr.code, sr.name, sr.rank_value, sr.panel_access
      FROM account_staff_roles asr
      JOIN staff_roles sr ON sr.id = asr.role_id
      WHERE
        asr.account_id = ?
        AND asr.revoked_at IS NULL
        AND (asr.valid_until IS NULL OR asr.valid_until = '' OR asr.valid_until > ?)
      ORDER BY sr.rank_value DESC
    `).all(accountId, this.nowIso()) as Array<{
      id: number;
      code: string;
      name: string;
      rank_value: number;
      panel_access: number;
    }>;

    const permissionSet = new Set<string>();
    if (this.tableExists("staff_role_permissions") && this.tableExists("staff_permissions")) {
      for (const role of roles) {
        const permissions = this.db.prepare(`
          SELECT p.code
          FROM staff_role_permissions rp
          JOIN staff_permissions p ON p.id = rp.permission_id
          WHERE rp.role_id = ?
        `).all(role.id) as Array<{ code: string }>;
        for (const permission of permissions) {
          permissionSet.add(permission.code);
        }
      }
    }

    if (this.tableExists("account_permission_overrides") && this.tableExists("staff_permissions")) {
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
    }

    const hasAdminPanelAccess = permissionSet.has("panel.access") || roles.some((role) => Number(role.panel_access) === 1);
    return {
      roles: roles.map((role) => ({
        code: role.code,
        name: role.name,
        rankValue: Number(role.rank_value),
      })),
      permissions: Array.from(permissionSet).sort(),
      hasAdminPanelAccess,
      primaryRoleLabel: roles.length ? roles[0].name : "Player",
      badges: roles.length ? roles.map((role) => role.name) : ["Player"],
    };
  }

  private getTicketSummary(accountId: number) {
    if (!this.tableExists("support_tickets")) {
      return {
        total: 0,
        open: 0,
        waitingStaff: 0,
        waitingPlayer: 0,
        closed: 0,
        recent: [] as Array<Record<string, unknown>>,
      };
    }

    const counts = this.db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM support_tickets
      WHERE creator_account_id = ?
      GROUP BY status
    `).all(accountId) as Array<{ status: string; count: number }>;

    const recent = this.db.prepare(`
      SELECT id, subject, category, status, updated_at, created_at
      FROM support_tickets
      WHERE creator_account_id = ?
      ORDER BY updated_at DESC, id DESC
      LIMIT 6
    `).all(accountId) as Array<Record<string, unknown>>;

    const countByStatus = new Map<string, number>();
    counts.forEach((entry) => countByStatus.set(String(entry.status || ""), Number(entry.count || 0)));

    return {
      total: counts.reduce((sum, entry) => sum + Number(entry.count || 0), 0),
      open: Number(countByStatus.get("OPEN") || 0),
      waitingStaff: Number(countByStatus.get("WAITING_STAFF") || 0),
      waitingPlayer: Number(countByStatus.get("WAITING_PLAYER") || 0),
      closed: Number(countByStatus.get("CLOSED") || 0) + Number(countByStatus.get("RESOLVED") || 0),
      recent,
    };
  }

  createCommunityTicket(
    sessionToken: string,
    payload: {
      subject?: string;
      category?: string;
      message?: string;
      requestedDateKey?: string;
      requestedDateLabel?: string;
    },
    _meta: SessionMeta
  ) {
    const ctx = this.requireSession(sessionToken);
    if (!this.tableExists("support_tickets") || !this.tableExists("support_ticket_messages")) {
      throw new Error("Ticket system is unavailable right now");
    }

    const normalizedCategory = String(payload.category || "").trim().toUpperCase() === "EVENT_SUPPORT"
      ? "EVENT_SUPPORT"
      : "EVENT_REQUEST";
    const subject = String(payload.subject || "").trim();
    const message = String(payload.message || "").trim();
    const requestedDateKey = String(payload.requestedDateKey || "").trim();
    const requestedDateLabel = String(payload.requestedDateLabel || "").trim();

    if (!subject) {
      throw new Error("Ticket subject is required");
    }
    if (!message) {
      throw new Error("Ticket message is required");
    }

    const composedMessageParts = [];
    if (requestedDateLabel) {
      composedMessageParts.push(`Calendar date: ${requestedDateLabel}`);
    } else if (requestedDateKey) {
      composedMessageParts.push(`Calendar date key: ${requestedDateKey}`);
    }
    if (composedMessageParts.length) {
      composedMessageParts.push("");
    }
    composedMessageParts.push(message);

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
      ctx.account.id,
      ctx.selectedCharacter?.id ?? null,
      subject,
      normalizedCategory,
      now,
      now,
      now
    );

    const ticketId = Number(insert.lastInsertRowid);
    const authorRoleSnapshot = this.getStaffProfile(ctx.account.id).primaryRoleLabel || "Player";

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
      ctx.account.id,
      ctx.selectedCharacter?.id ?? null,
      authorRoleSnapshot,
      composedMessageParts.join("\n"),
      now
    );

    return this.db.prepare(`
      SELECT id, subject, category, status, created_at, updated_at
      FROM support_tickets
      WHERE id = ?
    `).get(ticketId) as Record<string, unknown>;
  }

  private getApplicationSummary(accountId: number, selectedCharacterId: number | null) {
    if (!this.tableExists("application_submissions")) {
      return {
        total: 0,
        submitted: 0,
        underReview: 0,
        approved: 0,
        denied: 0,
        recent: [] as Array<Record<string, unknown>>,
      };
    }

    const counts = this.db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM application_submissions
      WHERE account_id = ?
      GROUP BY status
    `).all(accountId) as Array<{ status: string; count: number }>;

    const recent = this.db.prepare(`
      SELECT s.id, s.status, s.updated_at, s.created_at, f.name AS form_name
      FROM application_submissions s
      LEFT JOIN application_forms f ON f.id = s.form_id
      WHERE s.account_id = ? OR (? IS NOT NULL AND s.character_id = ?)
      ORDER BY s.updated_at DESC, s.id DESC
      LIMIT 6
    `).all(accountId, selectedCharacterId, selectedCharacterId) as Array<Record<string, unknown>>;

    const countByStatus = new Map<string, number>();
    counts.forEach((entry) => countByStatus.set(String(entry.status || ""), Number(entry.count || 0)));

    return {
      total: counts.reduce((sum, entry) => sum + Number(entry.count || 0), 0),
      submitted: Number(countByStatus.get("SUBMITTED") || 0),
      underReview: Number(countByStatus.get("UNDER_REVIEW") || 0),
      approved: Number(countByStatus.get("APPROVED") || 0),
      denied: Number(countByStatus.get("DENIED") || 0),
      recent,
    };
  }

  assertWhitelistUnlocked(accountId: number) {
    if (this.hasWhitelistBypass(accountId)) {
      return;
    }
    if (!this.tableExists("application_submissions") || !this.tableExists("application_forms")) {
      return;
    }

    const approved = this.db.prepare(`
      SELECT s.id
      FROM application_submissions s
      JOIN application_forms f ON f.id = s.form_id
      WHERE s.account_id = ? AND f.code = ? AND s.status = 'APPROVED'
      LIMIT 1
    `).get(accountId, WHITELIST_FORM_CODE) as { id: number } | undefined;

    if (!approved) {
      throw new Error("Your account must be whitelisted before character access unlocks");
    }
  }

  private hasWhitelistBypass(accountId: number) {
    const staff = this.getStaffProfile(accountId);
    return Array.isArray(staff.roles) && staff.roles.length > 0;
  }

  private getServerRecord(accountId: number, selectedCharacterId: number | null) {
    if (!this.tableExists("punishments")) {
      return {
        standing: "Good Standing",
        warnings: 0,
        kicks: 0,
        jails: 0,
        bans: 0,
        mutes: 0,
        freezes: 0,
        total: 0,
        active: 0,
        lastActionAt: null as string | null,
        recent: [] as Array<Record<string, unknown>>,
      };
    }

    const rows = this.db.prepare(`
      SELECT punishment_type, status, issued_at, starts_at, expires_at, revoked_at, reason_public
      FROM punishments
      WHERE account_id = ? OR (? IS NOT NULL AND character_id = ?)
      ORDER BY issued_at DESC, id DESC
      LIMIT 24
    `).all(accountId, selectedCharacterId, selectedCharacterId) as Array<{
      punishment_type: string;
      status: string;
      issued_at: string;
      starts_at: string;
      expires_at: string | null;
      revoked_at: string | null;
      reason_public: string | null;
    }>;

    const now = Date.now();
    const summary = {
      warnings: 0,
      kicks: 0,
      jails: 0,
      bans: 0,
      mutes: 0,
      freezes: 0,
      total: rows.length,
      active: 0,
    };

    rows.forEach((row) => {
      const kind = String(row.punishment_type || "").toUpperCase();
      if (kind === "WARNING") {
        summary.warnings += 1;
      } else if (kind === "KICK") {
        summary.kicks += 1;
      } else if (kind === "JAIL") {
        summary.jails += 1;
      } else if (kind === "MUTE") {
        summary.mutes += 1;
      } else if (kind === "FREEZE") {
        summary.freezes += 1;
      } else if (kind === "TEMP_BAN" || kind === "PERM_BAN") {
        summary.bans += 1;
      }

      const hasExpired = row.expires_at ? new Date(row.expires_at).getTime() <= now : false;
      const isActive = String(row.status || "").toUpperCase() === "ACTIVE" && !row.revoked_at && !hasExpired;
      if (isActive) {
        summary.active += 1;
      }
    });

    let standing = "Good Standing";
    if (summary.bans > 0 && summary.active > 0) {
      standing = "Restricted";
    } else if (summary.active > 0) {
      standing = "Limited";
    } else if (summary.total > 0) {
      standing = "Observed";
    }

    return {
      standing,
      ...summary,
      lastActionAt: rows[0]?.issued_at ?? null,
      recent: rows.slice(0, 6).map((row) => ({
        type: row.punishment_type,
        status: row.status,
        issuedAt: row.issued_at,
        reasonPublic: row.reason_public || "",
      })),
    };
  }

  getCharacterChatLogs(sessionToken: string, requestedCharacterId?: number | null, offsetRaw?: number, limitRaw?: number): {
    windowDays: number;
    offset: number;
    limit: number;
    total: number;
    hasMore: boolean;
    character: CharacterRow | null;
    items: Array<{
      id: number;
      speakerProfileId: number | null;
      speakerName: string;
      message: string;
      chatKind: string;
      radius: number;
      color: string | null;
      world: string | null;
      witnessedAt: string;
    }>;
  } {
    const ctx = this.requireSession(sessionToken);
    this.assertWhitelistUnlocked(ctx.account.id);

    const characters = this.listCharacters(ctx.account.id);
    const fallbackCharacter = ctx.selectedCharacter ?? characters[0] ?? null;
    const requested = requestedCharacterId
      ? characters.find((character) => Number(character.id) === Number(requestedCharacterId)) ?? null
      : fallbackCharacter;

    if (!requested) {
      return {
        windowDays: 7,
        offset: 0,
        limit: 0,
        total: 0,
        hasMore: false,
        character: null,
        items: [],
      };
    }

    const offset = Math.max(0, Number.isFinite(Number(offsetRaw)) ? Number(offsetRaw) : 0);
    const limit = Math.max(20, Math.min(200, Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : 100));
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const totalRow = this.db.prepare(`
      SELECT COUNT(*) AS count
      FROM character_chatlog_entries
      WHERE witness_profile_id = ? AND created_at >= ?
    `).get(requested.profile_id, since) as { count?: number } | undefined;

    const rows = this.db.prepare(`
      SELECT id, witness_profile_id, speaker_profile_id, speaker_name, message_text, chat_kind, radius, color, world_desc, created_at
      FROM character_chatlog_entries
      WHERE witness_profile_id = ? AND created_at >= ?
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `).all(requested.profile_id, since, limit, offset) as Array<{
      id: number;
      witness_profile_id: number;
      speaker_profile_id: number | null;
      speaker_name: string;
      message_text: string;
      chat_kind: string;
      radius: number;
      color: string | null;
      world_desc: string | null;
      created_at: string;
    }>;

    const total = Number(totalRow?.count ?? 0);
    return {
      windowDays: 7,
      offset,
      limit,
      total,
      hasMore: offset + rows.length < total,
        character: requested,
      items: rows.map((row) => ({
        id: row.id,
        speakerProfileId: row.speaker_profile_id,
        speakerName: row.speaker_name,
        message: row.message_text,
        chatKind: row.chat_kind,
        radius: row.radius,
        color: row.color,
        world: row.world_desc,
        witnessedAt: row.created_at,
      })),
    };
  }

  private buildTimeline(args: {
    accountCreatedAt: string;
    characters: CharacterRow[];
    tickets: { recent: Array<Record<string, unknown>> };
    applications: { recent: Array<Record<string, unknown>> };
    serverRecord: { recent: Array<Record<string, unknown>> };
  }) {
    const events: Array<{ kind: string; title: string; detail: string; at: string }> = [];

    if (args.accountCreatedAt) {
      events.push({
        kind: "account",
        title: "Account created",
        detail: "Your UCP account was registered.",
        at: args.accountCreatedAt,
      });
    }

    for (const character of args.characters) {
      events.push({
        kind: "character",
        title: `Reserved slot ${character.slot_index}`,
        detail: character.name && character.name.trim()
          ? `Character ${character.name} is ready for world play.`
          : "This slot is waiting for in-game finalization.",
        at: character.created_at,
      });

      if (character.last_used_at) {
        events.push({
          kind: "play",
          title: `Entered world as ${this.isCharacterUnfinalized(character.name) ? `slot ${character.slot_index}` : character.name}`,
          detail: "Most recent world entry recorded.",
          at: character.last_used_at,
        });
      }
    }

    for (const ticket of args.tickets.recent) {
      events.push({
        kind: "ticket",
        title: `Ticket #${ticket.id}`,
        detail: `${ticket.subject || "Support ticket"} (${ticket.status || "OPEN"})`,
        at: String(ticket.updated_at || ticket.created_at || ""),
      });
    }

    for (const submission of args.applications.recent) {
      events.push({
        kind: "application",
        title: `${submission.form_name || "Application"} submission`,
        detail: `Status: ${submission.status || "SUBMITTED"}`,
        at: String(submission.updated_at || submission.created_at || ""),
      });
    }

    for (const action of args.serverRecord.recent) {
      events.push({
        kind: "record",
        title: `${action.type || "Record"} entry`,
        detail: String(action.reasonPublic || action.status || "Server record updated"),
        at: String(action.issuedAt || ""),
      });
    }

    return events
      .filter((event) => event.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 16);
  }

  private createAccountSession(accountId: number, sessionMeta?: SessionMeta) {
    const now = this.nowDate();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const token = crypto.randomBytes(32).toString("hex");
    const selectedCharacterId = this.getDefaultCharacterIdForAccount(accountId);
    this.db.prepare(`
      INSERT INTO account_sessions (id, account_id, selected_character_id, created_at, expires_at, last_seen_at, user_agent, remote_ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      token,
      accountId,
      selectedCharacterId,
      now.toISOString(),
      expiresAt.toISOString(),
      now.toISOString(),
      sessionMeta?.userAgent ?? null,
      sessionMeta?.remoteIp ?? null
    );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private getDefaultCharacterIdForAccount(accountId: number) {
    const row = this.db.prepare(`
      SELECT id
      FROM characters
      WHERE account_id = ?
      ORDER BY
        CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END ASC,
        last_used_at DESC,
        slot_index ASC
      LIMIT 1
    `).get(accountId) as { id: number } | undefined;

    return row?.id ?? null;
  }

  private touchCharacterLastUsed(characterId: number) {
    const now = this.nowIso();
    this.db.prepare(`
      UPDATE characters
      SET last_used_at = ?, updated_at = ?
      WHERE id = ?
    `).run(now, now, characterId);
  }

  private invalidateAccountSessions(accountId: number, keepSessionToken?: string | null) {
    if (keepSessionToken) {
      this.db.prepare(`
        DELETE FROM account_sessions
        WHERE account_id = ? AND id != ?
      `).run(accountId, keepSessionToken);
    } else {
      this.db.prepare(`DELETE FROM account_sessions WHERE account_id = ?`).run(accountId);
    }
    this.db.prepare(`DELETE FROM play_sessions WHERE account_id = ?`).run(accountId);
    this.db.prepare(`DELETE FROM password_reset_tokens WHERE account_id = ?`).run(accountId);
  }

  private allocateProfileId() {
    const row = this.db.prepare(`
      SELECT MAX(profile_id) AS max_profile_id FROM characters
    `).get() as { max_profile_id?: number | null };
    const nextProfileId = Number(row.max_profile_id ?? 99999) + 1;
    return Math.max(100000, nextProfileId);
  }

  private getAccountById(accountId: number) {
    const row = this.db.prepare(`
      SELECT id, username, email, created_at, updated_at
      FROM accounts
      WHERE id = ?
    `).get(accountId) as AccountRow | undefined;
    return row ? this.toPublicAccount(row) : null;
  }

  private getAccountAuthById(accountId: number) {
    return this.db.prepare(`
      SELECT id, username, email, password_hash, password_salt, created_at, updated_at
      FROM accounts
      WHERE id = ?
    `).get(accountId) as AccountAuthRow | undefined;
  }

  private getCharacterById(characterId: number) {
    return this.db.prepare(`
      SELECT id, account_id, slot_index, name, profile_id, created_at, updated_at, last_used_at
      FROM characters
      WHERE id = ?
    `).get(characterId) as CharacterRow | undefined;
  }

  private toPublicAccount(account: AccountRow) {
    return {
      id: account.id,
      username: account.username,
      email: account.email,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
    };
  }

  private tableExists(tableName: string) {
    const row = this.db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = ?
    `).get(tableName) as { name: string } | undefined;
    return !!row;
  }

  private getCommunityEventById(eventId: number, accountId: number | null) {
    const row = this.db.prepare(`
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.description,
        e.status,
        e.created_by_account_id,
        a.username AS created_by_username,
        e.updated_by_account_id,
        e.created_at,
        e.updated_at,
        COALESCE(ic.interest_count, 0) AS interest_count,
        CASE
          WHEN ? IS NOT NULL AND EXISTS (
            SELECT 1
            FROM community_event_interests cei
            WHERE cei.event_id = e.id
              AND cei.account_id = ?
          ) THEN 1
          ELSE 0
        END AS is_interested
      FROM community_events e
      LEFT JOIN accounts a ON a.id = e.created_by_account_id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS interest_count
        FROM community_event_interests
        GROUP BY event_id
      ) ic ON ic.event_id = e.id
      WHERE e.id = ?
        AND e.status <> 'ARCHIVED'
    `).get(accountId, accountId, eventId) as CommunityEventRow | undefined;

    return row ? this.mapCommunityEvent(row) : null;
  }

  private mapCommunityEvent(row: CommunityEventRow) {
    return {
      id: Number(row.id),
      title: String(row.title || ""),
      startsAt: String(row.starts_at || ""),
      description: String(row.description || ""),
      status: String(row.status || "SCHEDULED"),
      createdBy: String(row.created_by_username || ""),
      interestCount: Number(row.interest_count || 0),
      isInterested: Number(row.is_interested || 0) === 1,
      createdAt: String(row.created_at || ""),
      updatedAt: String(row.updated_at || ""),
    };
  }

  private normalizeUsername(usernameRaw: string) {
    const username = String(usernameRaw || "").trim();
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) {
      throw new Error("Username must be 3-32 characters using letters, numbers, or underscores");
    }
    return username;
  }

  private normalizePassword(passwordRaw: string) {
    const password = String(passwordRaw || "");
    if (password.length < 8 || password.length > 128) {
      throw new Error("Password must be between 8 and 128 characters");
    }
    return password;
  }

  private normalizeEmail(emailRaw?: string | null) {
    const email = String(emailRaw || "").trim();
    if (!email) {
      return null;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Email address is invalid");
    }
    return email.toLowerCase();
  }

  private normalizeCharacterName(nameRaw: string) {
    return this.normalizeCharacterNameForRepair(nameRaw);
  }

  private normalizeCharacterNameForRepair(nameRaw: string) {
    const name = this.cleanCharacterName(nameRaw);
    const words = name ? name.split(" ") : [];
    if (!words.every((word) => /^[\p{L}]+(?:'[\p{L}]+)*$/u.test(word))) {
      throw new Error("Character name may only contain letters, spaces, and apostrophes");
    }
    const normalizedName = words
      .map((word) => {
        const lowerWord = word.toLocaleLowerCase();
        return `${lowerWord.slice(0, 1).toLocaleUpperCase()}${lowerWord.slice(1)}`;
      })
      .join(" ");
    if (normalizedName.length < 2 || normalizedName.length > 24) {
      throw new Error("Character name must be between 2 and 24 characters");
    }
    if (this.isReservedCharacterName(normalizedName)) {
      throw new Error("Choose a real character name instead of the default Prisoner name");
    }
    if (this.isBlockedCharacterName(normalizedName)) {
      throw new Error("Character names cannot contain profanity, insults, or hate terms");
    }
    return normalizedName;
  }

  private isReservedCharacterName(nameRaw: string) {
    return String(nameRaw || "").trim().toLocaleLowerCase() === "prisoner";
  }

  private isBlockedCharacterName(nameRaw: string) {
    const normalized = String(nameRaw || "")
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\s']/gu, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!normalized) {
      return false;
    }

    const tokens = normalized
      .split(" ")
      .map((token) => token.replace(/'/g, ""))
      .filter(Boolean);

    if (tokens.some((token) => BLOCKED_CHARACTER_NAME_WORDS.has(token))) {
      return true;
    }

    const compact = tokens.join("");
    if (BLOCKED_CHARACTER_NAME_COMPACT_TERMS.has(compact)) {
      return true;
    }

    return BLOCKED_CHARACTER_NAME_PHRASES.some((phrase) => {
      if (phrase.length > tokens.length) {
        return false;
      }

      for (let start = 0; start <= tokens.length - phrase.length; start += 1) {
        let matches = true;
        for (let offset = 0; offset < phrase.length; offset += 1) {
          if (tokens[start + offset] !== phrase[offset]) {
            matches = false;
            break;
          }
        }
        if (matches) {
          return true;
        }
      }

      return false;
    });
  }

  private isCharacterUnfinalized(nameRaw: string) {
    const name = this.cleanCharacterName(nameRaw);
    if (!name) {
      return true;
    }

    if (this.isReservedCharacterName(name) || this.isBlockedCharacterName(name)) {
      return true;
    }

    return false;
  }

  private repairLegacyCharacterNames() {
    const rows = this.db.prepare(`
      SELECT id, name, profile_id
      FROM characters
      WHERE length(trim(name)) > 0
      ORDER BY id ASC
    `).all() as Array<{ id: number; name: string; profile_id: number }>;

    const claimedNames = new Set<string>();
    const now = this.nowIso();

    for (const row of rows) {
      let normalized = "";
      try {
        normalized = this.normalizeCharacterNameForRepair(row.name);
      } catch {
        normalized = "";
      }

      const key = normalized.toLocaleLowerCase();
      if (!normalized || claimedNames.has(key)) {
        this.db.prepare(`
          UPDATE characters
          SET name = '', updated_at = ?
          WHERE id = ?
        `).run(now, row.id);
        this.purgeWorldStateForProfile(row.profile_id);
        continue;
      }

      if (normalized !== row.name) {
        this.db.prepare(`
          UPDATE characters
          SET name = ?, updated_at = ?
          WHERE id = ?
        `).run(normalized, now, row.id);
      }

      this.syncWorldCharacterName(row.profile_id, normalized);
      claimedNames.add(key);
    }
  }

  private cleanCharacterName(nameRaw: string) {
    return String(nameRaw || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[.!?]+$/g, "");
  }

  private purgeWorldStateForProfile(profileId: number) {
    const changeFormsDir = path.resolve(process.cwd(), "world", "changeForms");
    if (!fs.existsSync(changeFormsDir)) {
      return;
    }

    const backupDir = path.resolve(process.cwd(), "reset-backups", `ucp-uninitialized-${profileId}-${Date.now()}`);
    let backupCreated = false;

    for (const entry of fs.readdirSync(changeFormsDir)) {
      if (!entry.toLowerCase().endsWith(".json")) {
        continue;
      }

      const fullPath = path.join(changeFormsDir, entry);
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(raw);
        if (Number(parsed?.profileId) !== profileId) {
          continue;
        }

        if (!backupCreated) {
          fs.mkdirSync(backupDir, { recursive: true });
          backupCreated = true;
        }

        fs.copyFileSync(fullPath, path.join(backupDir, entry));
        fs.unlinkSync(fullPath);
      } catch {
        // Ignore malformed/non-profile files and leave them untouched.
      }
    }
  }

  private syncWorldCharacterName(profileId: number, name: string) {
    const changeFormsDir = path.resolve(process.cwd(), "world", "changeForms");
    if (!fs.existsSync(changeFormsDir)) {
      return;
    }

    const backupDir = path.resolve(process.cwd(), "reset-backups", `ucp-name-sync-${profileId}-${Date.now()}`);
    let backupCreated = false;

    for (const entry of fs.readdirSync(changeFormsDir)) {
      if (!entry.toLowerCase().endsWith(".json")) {
        continue;
      }

      const fullPath = path.join(changeFormsDir, entry);
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const parsed = JSON.parse(raw);
        if (Number(parsed?.profileId) !== profileId) {
          continue;
        }

        if (!backupCreated) {
          fs.mkdirSync(backupDir, { recursive: true });
          backupCreated = true;
        }

        fs.copyFileSync(fullPath, path.join(backupDir, entry));
        if (parsed && typeof parsed === "object") {
          if (parsed.appearanceDump && typeof parsed.appearanceDump === "object") {
            parsed.appearanceDump.name = name;
          }
          if (!parsed.dynamicFields || typeof parsed.dynamicFields !== "object") {
            parsed.dynamicFields = {};
          }
          parsed.dynamicFields.rp_nameplateOwner = name;
        }
        fs.writeFileSync(fullPath, JSON.stringify(parsed, null, 2));
      } catch {
        // Ignore malformed/non-profile files and leave them untouched.
      }
    }
  }

  private hashPassword(password: string, salt: string) {
    return crypto.scryptSync(password, salt, 64).toString("hex");
  }

  private hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private verifyPassword(password: string, salt: string, expectedHash: string) {
    const actual = Buffer.from(this.hashPassword(password, salt), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  }

  private pruneExpired() {
    const now = this.nowIso();
    this.db.prepare(`DELETE FROM account_sessions WHERE expires_at <= ?`).run(now);
    this.db.prepare(`DELETE FROM play_sessions WHERE expires_at <= ?`).run(now);
    this.db.prepare(`DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL`).run(now);
    this.db.prepare(`DELETE FROM auth_challenges WHERE expires_at <= ? OR completed_at IS NOT NULL`).run(now);
  }

  private nowIso() {
    return this.nowDate().toISOString();
  }

  private nowDate() {
    return new Date();
  }

  private db: DatabaseSync;
}

const getDbPath = (settings: Settings) => {
  const explicitPath = settings.allSettings?.ucpDbPath as (string | undefined);
  if (explicitPath && explicitPath.trim()) {
    return path.isAbsolute(explicitPath) ? explicitPath : path.resolve(process.cwd(), explicitPath);
  }
  return path.resolve(process.cwd(), "ucp", "skyrim-unbound-ucp.sqlite");
};

let dbSingleton: UcpDatabase | null = null;

const getDb = (settings: Settings) => {
  if (!dbSingleton) {
    dbSingleton = new UcpDatabase(getDbPath(settings));
  }
  return dbSingleton;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBooleanFlag(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1"
    || normalized === "true"
    || normalized === "yes"
    || normalized === "on";
}

type RateLimitRule = {
  scope: string;
  limit: number;
  windowMs: number;
  keyParts: unknown[];
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();
let nextRateLimitSweepAt = 0;

const getRateLimitKeyPart = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || "unknown";
};

const getRequestIp = (ctx: KoaContext) => {
  return getRateLimitKeyPart(
    ctx.request?.ip
    || ctx.ip
    || ctx.req?.socket?.remoteAddress
    || ctx.request?.socket?.remoteAddress
  );
};

const pruneRateLimitBuckets = (nowMs = Date.now()) => {
  if (nowMs < nextRateLimitSweepAt) {
    return;
  }

  nextRateLimitSweepAt = nowMs + 5 * 60 * 1000;
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= nowMs) {
      rateLimitBuckets.delete(key);
    }
  }
};

const consumeRateLimit = (rule: RateLimitRule) => {
  const nowMs = Date.now();
  pruneRateLimitBuckets(nowMs);
  const key = [rule.scope, ...rule.keyParts.map(getRateLimitKeyPart)].join(":");
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= nowMs) {
    const nextBucket = {
      count: 1,
      resetAt: nowMs + rule.windowMs,
    };
    rateLimitBuckets.set(key, nextBucket);
    return {
      allowed: true,
      retryAfterMs: 0,
    };
  }

  if (bucket.count >= rule.limit) {
    return {
      allowed: false,
      retryAfterMs: Math.max(0, bucket.resetAt - nowMs),
    };
  }

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);
  return {
    allowed: true,
    retryAfterMs: 0,
  };
};

const enforceRateLimit = (ctx: KoaContext, rules: RateLimitRule[], message: string) => {
  const blockedAttempt = rules
    .map((rule) => consumeRateLimit(rule))
    .find((result) => !result.allowed);

  if (!blockedAttempt) {
    return true;
  }

  ctx.set("Retry-After", String(Math.max(1, Math.ceil(blockedAttempt.retryAfterMs / 1000))));
  writeError(ctx, 429, message);
  return false;
};

function getRecoveryMailSettings(settings: Settings): RecoveryMailSettings | null {
  const settingsRecord = asRecord(settings.allSettings);
  if (!settingsRecord) {
    return null;
  }

  const mailSource = asRecord(settingsRecord.ucpMail)
    ?? asRecord(settingsRecord.mail)
    ?? asRecord(settingsRecord.smtp);
  const publicUrl = asNonEmptyString(settingsRecord.ucpPublicUrl)
    ?? asNonEmptyString(settingsRecord.ucpUrl)
    ?? asNonEmptyString(settingsRecord.publicUrl);

  if (!mailSource || !publicUrl) {
    return null;
  }

  const host = asNonEmptyString(mailSource.host) ?? asNonEmptyString(mailSource.smtpHost);
  const from = asNonEmptyString(mailSource.from)
    ?? asNonEmptyString(mailSource.fromAddress)
    ?? asNonEmptyString(mailSource.fromEmail);

  if (!host || !from) {
    return null;
  }

  const port = typeof mailSource.port === "number"
    ? mailSource.port
    : typeof mailSource.smtpPort === "number"
      ? mailSource.smtpPort
      : 587;
  const secure = mailSource.secure === true || mailSource.smtpSecure === true || port === 465;
  const user = asNonEmptyString(mailSource.user) ?? asNonEmptyString(mailSource.smtpUser);
  const pass = asNonEmptyString(mailSource.pass) ?? asNonEmptyString(mailSource.smtpPass);
  const replyTo = asNonEmptyString(mailSource.replyTo);
  const resetTokenMinutes = typeof mailSource.resetTokenMinutes === "number"
    ? mailSource.resetTokenMinutes
    : typeof mailSource.tokenTtlMinutes === "number"
      ? mailSource.tokenTtlMinutes
      : 60;

  return {
    publicUrl,
    host,
    port,
    secure,
    user,
    pass,
    from,
    replyTo,
    resetTokenMinutes,
  };
}

function isSecurityQuestionRecoveryEnabled(settings: Settings): boolean {
  const settingsRecord = asRecord(settings.allSettings) ?? {};
  const ucpSecurity = asRecord(settingsRecord.ucpSecurity)
    ?? asRecord(settingsRecord.security)
    ?? {};

  return parseBooleanFlag(ucpSecurity.allowSecurityQuestionPasswordReset)
    || parseBooleanFlag(settingsRecord.allowSecurityQuestionPasswordReset);
}

function getSocialLinks(settings: Settings) {
  const settingsRecord = asRecord(settings.allSettings) ?? {};
  const socialSource = asRecord(settingsRecord.socialLinks) ?? asRecord(settingsRecord.socials) ?? {};
  const publicUrl = asNonEmptyString(settingsRecord.ucpPublicUrl)
    ?? asNonEmptyString(settingsRecord.ucpUrl)
    ?? asNonEmptyString(settingsRecord.publicUrl)
    ?? "/ucp/";

  return [
    {
      key: "website",
      label: "Website",
      href: asNonEmptyString(socialSource.website) ?? publicUrl,
    },
    {
      key: "discord",
      label: "Discord",
      href: asNonEmptyString(socialSource.discord) ?? "https://discord.gg/k39uQ9Yudt",
    },
    {
      key: "forums",
      label: "Forums",
      href: asNonEmptyString(socialSource.forums) ?? "/ucp/",
    },
    {
      key: "youtube",
      label: "YouTube",
      href: asNonEmptyString(socialSource.youtube) ?? "https://youtu.be/8ccDfIxCLlc",
    },
  ];
}

function normalizeHostValue(hostRaw: unknown) {
  const raw = String(hostRaw || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }

  if (raw.startsWith("[")) {
    const closingBracketIndex = raw.indexOf("]");
    return closingBracketIndex >= 0 ? raw.slice(1, closingBracketIndex) : raw;
  }

  const colonIndex = raw.lastIndexOf(":");
  if (colonIndex > 0 && raw.indexOf(":") === colonIndex) {
    return raw.slice(0, colonIndex);
  }

  return raw;
}

function isLoopbackHost(hostRaw: unknown) {
  const host = normalizeHostValue(hostRaw);
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function isLocalCreatorContactRequest(ctx: KoaContext) {
  return isLocalRequest(ctx);
}

function getCreatorContactTurnstileConfig(settings: Settings, ctx: KoaContext): CreatorContactTurnstileConfig | null {
  const settingsRecord = asRecord(settings.allSettings) ?? {};
  const contactSource = asRecord(settingsRecord.contactForm)
    ?? asRecord(settingsRecord.creatorContact)
    ?? asRecord(settingsRecord.contact)
    ?? {};
  const turnstileSource = asRecord(contactSource.turnstile) ?? contactSource;

  const configuredSiteKey = asNonEmptyString(turnstileSource.siteKey)
    ?? asNonEmptyString(turnstileSource.turnstileSiteKey);
  const configuredSecretKey = asNonEmptyString(turnstileSource.secretKey)
    ?? asNonEmptyString(turnstileSource.turnstileSecretKey);

  if (configuredSiteKey || configuredSecretKey) {
    if (!configuredSiteKey || !configuredSecretKey) {
      return null;
    }

    return {
      siteKey: configuredSiteKey,
      secretKey: configuredSecretKey,
      usesTestKey: false,
    };
  }

  if (!isLocalCreatorContactRequest(ctx)) {
    return null;
  }

  return {
    siteKey: TURNSTILE_TEST_SITE_KEY,
    secretKey: TURNSTILE_TEST_SECRET_KEY,
    usesTestKey: true,
  };
}

async function validateTurnstileToken(
  config: CreatorContactTurnstileConfig,
  token: string,
  remoteIp?: string
) {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      secret: config.secretKey,
      response: token,
      remoteip: asNonEmptyString(remoteIp),
    }),
  });

  if (!response.ok) {
    throw new Error("Verification service is unavailable right now");
  }

  return await response.json() as TurnstileValidationResponse;
}

function buildRecoveryResetUrl(publicUrl: string, token: string) {
  const normalizedBase = publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
  const url = new URL("ucp/", normalizedBase);
  url.searchParams.set("resetToken", token);
  return url.toString();
}

function buildActionConfirmationUrl(publicUrl: string, action: string, token: string) {
  const normalizedBase = publicUrl.endsWith("/") ? publicUrl : `${publicUrl}/`;
  const url = new URL("ucp/", normalizedBase);
  url.searchParams.set("confirmAction", action);
  url.searchParams.set("confirmToken", token);
  return url.toString();
}

async function sendRecoveryEmail(
  mailSettings: RecoveryMailSettings,
  account: { username: string; email: string | null },
  resetToken: string
) {
  const transport = createMailTransport(mailSettings);
  const resetUrl = buildRecoveryResetUrl(mailSettings.publicUrl, resetToken);
  const expirationNotice = `${Math.max(1, Math.round(mailSettings.resetTokenMinutes))} minutes`;

  await transport.sendMail({
    from: mailSettings.from,
    to: account.email || undefined,
    replyTo: mailSettings.replyTo || mailSettings.from,
    subject: "Skyrim Unbound password reset",
    text: [
      `Hello ${account.username},`,
      "",
      "We received a password reset request for your Skyrim Unbound account.",
      `Reset link: ${resetUrl}`,
      "",
      `This link expires in ${expirationNotice}.`,
      "If you did not request this reset, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; background: #120f13; color: #f0e7d8; padding: 24px; line-height: 1.6;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid rgba(216, 182, 136, 0.18); border-radius: 18px; padding: 28px; background: rgba(24, 20, 24, 0.95);">
          <p style="margin: 0 0 10px; color: #d1a46a; letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px;">Skyrim Unbound</p>
          <h1 style="margin: 0 0 16px; font-size: 30px; line-height: 1;">Password reset</h1>
          <p style="margin: 0 0 14px;">Hello ${account.username},</p>
          <p style="margin: 0 0 18px;">We received a request to reset the password for your account.</p>
          <p style="margin: 0 0 22px;">
            <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(180deg, #c48a58 0%, #8a5a32 100%); color: #fff5e4; text-decoration: none; padding: 12px 18px; border-radius: 14px; font-weight: 700;">Reset password</a>
          </p>
          <p style="margin: 0 0 8px; color: #baa990;">This link expires in ${expirationNotice}.</p>
          <p style="margin: 0; color: #baa990;">If you did not request this reset, you can ignore this email.</p>
        </div>
      </div>
    `,
  });
}

async function sendEmailChangeConfirmationEmail(
  mailSettings: RecoveryMailSettings,
  args: {
    username: string;
    targetEmail: string;
    token: string;
  }
) {
  const transport = createMailTransport(mailSettings);
  const confirmUrl = buildActionConfirmationUrl(mailSettings.publicUrl, "email-change", args.token);
  const expirationNotice = `${Math.max(1, Math.round(mailSettings.resetTokenMinutes))} minutes`;

  await transport.sendMail({
    from: mailSettings.from,
    to: args.targetEmail,
    replyTo: mailSettings.replyTo || mailSettings.from,
    subject: "Skyrim Unbound recovery email confirmation",
    text: [
      `Hello ${args.username},`,
      "",
      "A request was made to use this address as the recovery email for your Skyrim Unbound account.",
      `Confirm link: ${confirmUrl}`,
      "",
      `This link expires in ${expirationNotice}.`,
      "If you did not request this change, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; background: #120f13; color: #f0e7d8; padding: 24px; line-height: 1.6;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid rgba(216, 182, 136, 0.18); border-radius: 18px; padding: 28px; background: rgba(24, 20, 24, 0.95);">
          <p style="margin: 0 0 10px; color: #d1a46a; letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px;">Skyrim Unbound</p>
          <h1 style="margin: 0 0 16px; font-size: 30px; line-height: 1;">Confirm recovery email</h1>
          <p style="margin: 0 0 14px;">Hello ${args.username},</p>
          <p style="margin: 0 0 18px;">A request was made to use this address as the recovery email for your account.</p>
          <p style="margin: 0 0 22px;">
            <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(180deg, #c48a58 0%, #8a5a32 100%); color: #fff5e4; text-decoration: none; padding: 12px 18px; border-radius: 14px; font-weight: 700;">Confirm email</a>
          </p>
          <p style="margin: 0 0 8px; color: #baa990;">This link expires in ${expirationNotice}.</p>
          <p style="margin: 0; color: #baa990;">If you did not request this change, you can ignore this email.</p>
        </div>
      </div>
    `,
  });
}

async function sendPasswordChangeConfirmationEmail(
  mailSettings: RecoveryMailSettings,
  args: {
    username: string;
    email: string;
    token: string;
  }
) {
  const transport = createMailTransport(mailSettings);
  const confirmUrl = buildActionConfirmationUrl(mailSettings.publicUrl, "password-change", args.token);
  const expirationNotice = `${Math.max(1, Math.round(mailSettings.resetTokenMinutes))} minutes`;

  await transport.sendMail({
    from: mailSettings.from,
    to: args.email,
    replyTo: mailSettings.replyTo || mailSettings.from,
    subject: "Skyrim Unbound password change confirmation",
    text: [
      `Hello ${args.username},`,
      "",
      "We received a request to change the password for your Skyrim Unbound account.",
      `Confirm link: ${confirmUrl}`,
      "",
      `This link expires in ${expirationNotice}.`,
      "If you did not request this change, secure your account immediately and ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; background: #120f13; color: #f0e7d8; padding: 24px; line-height: 1.6;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid rgba(216, 182, 136, 0.18); border-radius: 18px; padding: 28px; background: rgba(24, 20, 24, 0.95);">
          <p style="margin: 0 0 10px; color: #d1a46a; letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px;">Skyrim Unbound</p>
          <h1 style="margin: 0 0 16px; font-size: 30px; line-height: 1;">Confirm password change</h1>
          <p style="margin: 0 0 14px;">Hello ${args.username},</p>
          <p style="margin: 0 0 18px;">We received a request to change the password for your account.</p>
          <p style="margin: 0 0 22px;">
            <a href="${confirmUrl}" style="display: inline-block; background: linear-gradient(180deg, #c48a58 0%, #8a5a32 100%); color: #fff5e4; text-decoration: none; padding: 12px 18px; border-radius: 14px; font-weight: 700;">Confirm password change</a>
          </p>
          <p style="margin: 0 0 8px; color: #baa990;">This link expires in ${expirationNotice}.</p>
          <p style="margin: 0; color: #baa990;">If you did not request this change, ignore this email and review your account security.</p>
        </div>
      </div>
    `,
  });
}

function createMailTransport(mailSettings: RecoveryMailSettings) {
  const transportOptions: {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  } = {
    host: mailSettings.host,
    port: mailSettings.port,
    secure: mailSettings.secure,
  };

  if (mailSettings.user && mailSettings.pass) {
    transportOptions.auth = {
      user: mailSettings.user,
      pass: mailSettings.pass,
    };
  }

  return nodemailer.createTransport(transportOptions);
}

async function sendLoginOtpEmail(
  mailSettings: RecoveryMailSettings,
  account: { username: string; email: string | null },
  code: string
) {
  const transport = createMailTransport(mailSettings);
  const expirationNotice = `${LOGIN_OTP_TTL_MINUTES} minutes`;
  await transport.sendMail({
    from: mailSettings.from,
    to: account.email || undefined,
    replyTo: mailSettings.replyTo || mailSettings.from,
    subject: "Skyrim Unbound login verification code",
    text: [
      `Hello ${account.username},`,
      "",
      "We detected a login attempt from a new IP address or device.",
      `Your one-time verification code is: ${code}`,
      "",
      `This code expires in ${expirationNotice}.`,
      "If this wasn't you, change your password and review your account security settings.",
    ].join("\n"),
    html: `
      <div style="font-family: Georgia, 'Times New Roman', serif; background: #120f13; color: #f0e7d8; padding: 24px; line-height: 1.6;">
        <div style="max-width: 640px; margin: 0 auto; border: 1px solid rgba(216, 182, 136, 0.18); border-radius: 18px; padding: 28px; background: rgba(24, 20, 24, 0.95);">
          <p style="margin: 0 0 10px; color: #d1a46a; letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px;">Skyrim Unbound</p>
          <h1 style="margin: 0 0 16px; font-size: 30px; line-height: 1;">Login verification</h1>
          <p style="margin: 0 0 14px;">Hello ${account.username},</p>
          <p style="margin: 0 0 18px;">We detected a login attempt from a new IP address or device.</p>
          <p style="margin: 0 0 8px; color: #baa990;">Use this code to finish signing in:</p>
          <p style="margin: 0 0 22px; font-size: 34px; letter-spacing: 0.18em; font-weight: 700; color: #fff5e4;">${code}</p>
          <p style="margin: 0; color: #baa990;">This code expires in ${expirationNotice}.</p>
        </div>
      </div>
    `,
  });
}

export type ResolvedUcpPlaySession = {
  session: string;
  accountId: number;
  characterId: number;
  profileId: number;
  serverMasterKey: string;
  expiresAt: string;
};

export const resolveUcpPlaySession = (
  settings: Settings,
  playSessionToken: string,
  serverMasterKey: string
): ResolvedUcpPlaySession | null => {
  const playSession = getDb(settings).getPlaySession(playSessionToken, serverMasterKey);
  if (!playSession) {
    return null;
  }

  return {
    session: playSession.id,
    accountId: playSession.account_id,
    characterId: playSession.character_id,
    profileId: playSession.profile_id,
    serverMasterKey: playSession.server_master_key,
    expiresAt: playSession.expires_at,
  };
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
  userAgent: String(ctx.get("user-agent") || "").trim() || null,
  remoteIp: String(ctx.request.ip || "").trim() || null,
});

const setAccountSessionCookie = (ctx: KoaContext, settings: Settings, sessionToken: string, expiresAt: string) => {
  ctx.cookies?.set?.(ACCOUNT_SESSION_COOKIE_NAME, sessionToken, {
    expires: new Date(expiresAt),
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(settings, ctx),
    path: "/",
  });
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

const writeError = (ctx: KoaContext, status: number, message: string) => {
  ctx.status = status;
  ctx.set("Cache-Control", "no-store");
  ctx.body = { error: message };
};

const withAuthenticatedSession = (settings: Settings, ctx: KoaContext, handler: (db: UcpDatabase, sessionToken: string) => void) => {
  const sessionToken = getSessionTokenFromRequest(ctx);
  if (!sessionToken) {
    writeError(ctx, 401, "Missing session token");
    return;
  }

  try {
    handler(getDb(settings), sessionToken);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    const status = message === "Not authenticated" ? 401 : 400;
    if (status === 401) {
      clearAccountSessionCookie(ctx, settings);
      clearAdminPanelAccessCookie(ctx, settings);
    }
    writeError(ctx, status, message);
  }
};

export const attachUcpRoutes = (router: KoaRouter, settings: Settings) => {
  getDb(settings);

  router.get("/ucp/api/health", (ctx: KoaContext) => {
    ctx.body = {
      ok: true,
      serverName: settings.allSettings?.name || "Skyrim Unbound",
      recoveryEnabled: getRecoveryMailSettings(settings) !== null,
      socialLinks: getSocialLinks(settings),
    };
  });

  router.get("/ucp/api/contact/creator/config", (ctx: KoaContext) => {
    const captchaConfig = getCreatorContactTurnstileConfig(settings, ctx);
    ctx.body = {
      ok: true,
      captcha: captchaConfig
        ? {
            enabled: true,
            provider: "turnstile",
            siteKey: captchaConfig.siteKey,
            usesTestKey: captchaConfig.usesTestKey,
          }
        : {
            enabled: false,
            provider: null,
            siteKey: null,
            usesTestKey: false,
          },
    };
  });

  router.post("/ucp/api/contact/creator/verify", async (ctx: KoaContext) => {
    if (!enforceRateLimit(ctx, [
      { scope: "contact.creator.verify.ip", limit: 10, windowMs: 10 * 60 * 1000, keyParts: [getRequestIp(ctx)] },
    ], "Too many verification attempts. Try again later.")) {
      return;
    }

    try {
      const captchaConfig = getCreatorContactTurnstileConfig(settings, ctx);
      if (!captchaConfig) {
        writeError(ctx, 503, "Contact verification is not configured right now.");
        return;
      }

      const body = ctx.request.body || {};
      const token = String(body.turnstileToken || body.token || "").trim();
      if (!token) {
        throw new Error("Complete the verification challenge before continuing.");
      }

      const result = await validateTurnstileToken(captchaConfig, token, String(ctx.request.ip || "").trim() || undefined);
      const errorCodes = Array.isArray(result["error-codes"]) ? result["error-codes"] : [];

      if (!result.success) {
        if (errorCodes.includes("timeout-or-duplicate")) {
          throw new Error("Verification expired. Complete the captcha again.");
        }

        throw new Error("Verification failed. Complete the captcha and try again.");
      }

      ctx.body = {
        ok: true,
        provider: "turnstile",
        usesTestKey: captchaConfig.usesTestKey,
      };
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/register", (ctx: KoaContext) => {
    if (!enforceRateLimit(ctx, [
      { scope: "auth.register.ip", limit: 6, windowMs: 60 * 60 * 1000, keyParts: [getRequestIp(ctx)] },
    ], "Too many registration attempts. Try again later.")) {
      return;
    }

    try {
      const body = ctx.request.body || {};
      const result = getDb(settings).registerAccount(body.username, body.password, body.email, getSessionMeta(ctx));
      setAccountSessionCookie(ctx, settings, result.session.token, result.session.expiresAt);
      ctx.body = {
        account: result.account,
        session: {
          token: result.session.token,
          expiresAt: result.session.expiresAt,
        },
        characters: [],
      };
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/login", async (ctx: KoaContext) => {
    const body = ctx.request.body || {};
    const login = body.login ?? body.username ?? body.email;
    if (!enforceRateLimit(ctx, [
      { scope: "auth.login.ip", limit: 25, windowMs: 15 * 60 * 1000, keyParts: [getRequestIp(ctx)] },
      { scope: "auth.login.ip-login", limit: 8, windowMs: 15 * 60 * 1000, keyParts: [getRequestIp(ctx), login] },
    ], "Too many login attempts. Try again later.")) {
      return;
    }

    try {
      const recoveryMailSettings = getRecoveryMailSettings(settings);
      console.log(`[ucp] auth/login attempt from ${ctx.request.ip} for ${String(login || "").trim()}`);
      const db = getDb(settings);
      const result = db.getLoginChallengeForCredentials(login, body.password, getSessionMeta(ctx), recoveryMailSettings);
      if (result.challenge) {
        if (result.challenge.requiresEmailOtp) {
          if (!recoveryMailSettings || !result.challenge.emailOtpCode) {
            throw new Error("Email OTP verification is unavailable right now");
          }
          await sendLoginOtpEmail(recoveryMailSettings, result.account, result.challenge.emailOtpCode);
        }

        console.log(`[ucp] auth/login step-up required for account ${result.account.username}`);
        ctx.body = {
          challenge: {
            token: result.challenge.token,
            requiresEmailOtp: result.challenge.requiresEmailOtp,
            requiresTotp: result.challenge.requiresTotp,
            emailMasked: result.challenge.emailMasked,
            expiresAt: result.challenge.expiresAt,
          },
        };
        return;
      }

      console.log(`[ucp] auth/login success for account ${result.account.username}`);
      setAccountSessionCookie(ctx, settings, result.session!.token, result.session!.expiresAt);
      ctx.body = {
        account: result.account,
        session: {
          token: result.session!.token,
          expiresAt: result.session!.expiresAt,
        },
        characters: db.listCharacters(result.account.id),
      };
    } catch (e) {
      console.log(`[ucp] auth/login failed: ${e instanceof Error ? e.message : "Unexpected error"}`);
      writeError(ctx, 401, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/login/challenge", (ctx: KoaContext) => {
    const body = ctx.request.body || {};
    if (!enforceRateLimit(ctx, [
      { scope: "auth.login.challenge.ip", limit: 25, windowMs: 15 * 60 * 1000, keyParts: [getRequestIp(ctx)] },
      { scope: "auth.login.challenge.token", limit: 10, windowMs: 15 * 60 * 1000, keyParts: [body.challengeToken] },
    ], "Too many verification attempts. Try again later.")) {
      return;
    }

    try {
      const db = getDb(settings);
      const result = db.completeLoginChallenge(body.challengeToken, getSessionMeta(ctx), {
        emailOtp: body.emailOtp,
        totpCode: body.totpCode,
      });
      setAccountSessionCookie(ctx, settings, result.session.token, result.session.expiresAt);
      ctx.body = {
        account: result.account,
        session: {
          token: result.session.token,
          expiresAt: result.session.expiresAt,
        },
        characters: db.listCharacters(result.account.id),
      };
    } catch (e) {
      writeError(ctx, 401, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/forgot-password", async (ctx: KoaContext) => {
    const body = ctx.request.body || {};
    const login = body.login ?? body.email;
    if (!enforceRateLimit(ctx, [
      { scope: "auth.forgot-password.ip", limit: 8, windowMs: 60 * 60 * 1000, keyParts: [getRequestIp(ctx)] },
      { scope: "auth.forgot-password.ip-login", limit: 4, windowMs: 60 * 60 * 1000, keyParts: [getRequestIp(ctx), login] },
    ], "Too many password reset attempts. Try again later.")) {
      return;
    }

    try {
      const recoveryMailSettings = getRecoveryMailSettings(settings);
      if (!recoveryMailSettings) {
        throw new Error("Password recovery email is not configured on this server.");
      }

      const db = getDb(settings);
      const request = db.createPasswordResetRequest(String(login || "").trim(), getSessionMeta(ctx));

      if (!request) {
        ctx.body = { ok: true };
        return;
      }

      await sendRecoveryEmail(recoveryMailSettings, request.account, request.token);
      ctx.body = { ok: true };
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/reset-password", (ctx: KoaContext) => {
    try {
      const body = ctx.request.body || {};
      const token = String(body.token || "").trim();
      const password = String(body.password || "");
      if (!token) {
        throw new Error("Reset token is required");
      }

      const account = getDb(settings).resetPasswordWithToken(token, password);
      ctx.body = {
        ok: true,
        account,
      };
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/security-recovery/start", (ctx: KoaContext) => {
    if (!isSecurityQuestionRecoveryEnabled(settings)) {
      writeError(ctx, 403, "Security-question password recovery is disabled on this server.");
      return;
    }

    const body = ctx.request.body || {};
    const login = body.login ?? body.username ?? body.email;
    if (!enforceRateLimit(ctx, [
      { scope: "auth.security-recovery.start.ip", limit: 6, windowMs: 60 * 60 * 1000, keyParts: [getRequestIp(ctx)] },
      { scope: "auth.security-recovery.start.ip-login", limit: 3, windowMs: 60 * 60 * 1000, keyParts: [getRequestIp(ctx), login] },
    ], "Too many recovery attempts. Try again later.")) {
      return;
    }

    try {
      const result = getDb(settings).startSecurityRecovery(login, getSessionMeta(ctx));
      ctx.body = result;
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/security-recovery/complete", (ctx: KoaContext) => {
    if (!isSecurityQuestionRecoveryEnabled(settings)) {
      writeError(ctx, 403, "Security-question password recovery is disabled on this server.");
      return;
    }

    const body = ctx.request.body || {};
    if (!enforceRateLimit(ctx, [
      { scope: "auth.security-recovery.complete.ip", limit: 8, windowMs: 60 * 60 * 1000, keyParts: [getRequestIp(ctx)] },
      { scope: "auth.security-recovery.complete.token", limit: 5, windowMs: 60 * 60 * 1000, keyParts: [body.challengeToken] },
    ], "Too many recovery attempts. Try again later.")) {
      return;
    }

    try {
      const account = getDb(settings).completeSecurityRecovery(body.challengeToken, body.answers, body.newPassword);
      ctx.body = {
        ok: true,
        account,
      };
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/confirm-link", (ctx: KoaContext) => {
    try {
      const body = ctx.request.body || {};
      const action = String(body.action || "").trim();
      const token = String(body.token || "").trim();
      const db = getDb(settings);

      if (action === "email-change") {
        ctx.body = {
          ok: true,
          action,
          account: db.confirmAccountEmailChange(token),
        };
        return;
      }

      if (action === "password-change") {
        ctx.body = {
          ok: true,
          action,
          account: db.confirmAccountPasswordChange(token),
        };
        return;
      }

      throw new Error("Confirmation action is invalid");
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/auth/update-email", async (ctx: KoaContext) => {
    try {
      const recoveryMailSettings = getRecoveryMailSettings(settings);
      if (!recoveryMailSettings) {
        throw new Error("Confirmation email is not configured on this server.");
      }

      const sessionToken = getSessionTokenFromRequest(ctx);
      if (!sessionToken) {
        clearAccountSessionCookie(ctx, settings);
        clearAdminPanelAccessCookie(ctx, settings);
        throw new Error("Not authenticated");
      }

      const db = getDb(settings);
      const body = ctx.request.body || {};
      const request = db.updateAccountEmail(
        sessionToken,
        body.email,
        body.currentPassword,
        recoveryMailSettings.resetTokenMinutes
      );

      await sendEmailChangeConfirmationEmail(recoveryMailSettings, {
        username: request.account.username,
        targetEmail: request.pendingEmail,
        token: request.token,
      });

      ctx.body = {
        ok: true,
        account: request.account,
        deliveryTarget: request.emailMasked,
        expiresAt: request.expiresAt,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      const status = message === "Not authenticated" ? 401 : 400;
      if (status === 401) {
        clearAccountSessionCookie(ctx, settings);
        clearAdminPanelAccessCookie(ctx, settings);
      }
      writeError(ctx, status, message);
    }
  });

  router.post("/ucp/api/auth/security-questions", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      ctx.body = {
        ok: true,
        security: db.updateSecurityQuestions(sessionToken, body.currentPassword, body.questions),
      };
    });
  });

  router.post("/ucp/api/auth/security-settings", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      ctx.body = {
        ok: true,
        security: db.setEmailOtpOnNewIp(sessionToken, body.emailOtpOnNewIp),
      };
    });
  });

  router.post("/ucp/api/auth/2fa/setup", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      ctx.body = db.beginTotpSetup(sessionToken, body.currentPassword);
    });
  });

  router.post("/ucp/api/auth/2fa/enable", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      ctx.body = {
        ok: true,
        security: db.enableTotp(sessionToken, body.setupToken, body.code),
      };
    });
  });

  router.post("/ucp/api/auth/2fa/disable", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      ctx.body = {
        ok: true,
        security: db.disableTotp(sessionToken, body.currentPassword, body.code),
      };
    });
  });

  router.post("/ucp/api/auth/update-password", async (ctx: KoaContext) => {
    try {
      const recoveryMailSettings = getRecoveryMailSettings(settings);
      if (!recoveryMailSettings) {
        throw new Error("Confirmation email is not configured on this server.");
      }

      const sessionToken = getSessionTokenFromRequest(ctx);
      if (!sessionToken) {
        clearAccountSessionCookie(ctx, settings);
        clearAdminPanelAccessCookie(ctx, settings);
        throw new Error("Not authenticated");
      }

      const db = getDb(settings);
      const body = ctx.request.body || {};
      const request = db.updateAccountPassword(
        sessionToken,
        body.currentPassword,
        body.newPassword,
        recoveryMailSettings.resetTokenMinutes
      );

      if (!request.account.email) {
        throw new Error("Add a recovery email before requesting a password change link");
      }

      await sendPasswordChangeConfirmationEmail(recoveryMailSettings, {
        username: request.account.username,
        email: request.account.email,
        token: request.token,
      });

      ctx.body = {
        ok: true,
        account: request.account,
        deliveryTarget: request.emailMasked,
        expiresAt: request.expiresAt,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unexpected error";
      const status = message === "Not authenticated" ? 401 : 400;
      if (status === 401) {
        clearAccountSessionCookie(ctx, settings);
        clearAdminPanelAccessCookie(ctx, settings);
      }
      writeError(ctx, status, message);
    }
  });

  router.post("/ucp/api/auth/logout", (ctx: KoaContext) => {
    const sessionToken = getSessionTokenFromRequest(ctx);
    if (sessionToken) {
      try {
        getDb(settings).logoutAccountSession(sessionToken);
      } catch (_error) {
        // clearing cookies client-side still matters even if the session is already gone server-side
      }
    }

    clearAccountSessionCookie(ctx, settings);
    clearAdminPanelAccessCookie(ctx, settings);
    ctx.body = { ok: true };
  });

  router.get("/ucp/api/auth/me", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const sessionContext = db.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new Error("Not authenticated");
      }
      const profileHub = db.getProfileHub(sessionToken);

      console.log(`[ucp] auth/me for ${sessionContext.account.username}, selectedCharacterId=${sessionContext.session.selected_character_id ?? "none"}`);
      setAccountSessionCookie(ctx, settings, sessionContext.session.id, sessionContext.session.expires_at);

      ctx.body = {
        account: sessionContext.account,
        session: {
          expiresAt: sessionContext.session.expires_at,
          selectedCharacterId: sessionContext.session.selected_character_id,
        },
        selectedCharacter: sessionContext.selectedCharacter,
        characters: db.listCharacters(sessionContext.account.id),
        profileHub: {
          ...profileHub,
          security: {
            ...profileHub.security,
            passwordRecoveryEnabled: !!getRecoveryMailSettings(settings),
            emailOtpAvailable: !!(profileHub.security.hasRecoveryEmail && getRecoveryMailSettings(settings)),
          },
        },
      };
    });
  });

  router.get("/ucp/api/characters", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const sessionContext = db.getSessionContext(sessionToken);
      if (!sessionContext) {
        throw new Error("Not authenticated");
      }
      db.assertWhitelistUnlocked(sessionContext.account.id);

      ctx.body = {
        characters: db.listCharacters(sessionContext.account.id),
        selectedCharacter: sessionContext.selectedCharacter,
        maxCharacters: 3,
      };
    });
  });

  router.get("/ucp/api/chatlogs", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const requestedCharacterId = ctx.query?.characterId === undefined ? undefined : Number(ctx.query.characterId);
      if (requestedCharacterId !== undefined && !Number.isInteger(requestedCharacterId)) {
        throw new Error("characterId must be an integer");
      }

      const offset = ctx.query?.offset === undefined ? undefined : Number(ctx.query.offset);
      if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
        throw new Error("offset must be a non-negative integer");
      }

      const limit = ctx.query?.limit === undefined ? undefined : Number(ctx.query.limit);
      if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
        throw new Error("limit must be a positive integer");
      }

      ctx.body = db.getCharacterChatLogs(sessionToken, requestedCharacterId, offset, limit);
    });
  });

  router.get("/ucp/api/community/events", (ctx: KoaContext) => {
    try {
      ctx.body = getDb(settings).listCommunityEvents({
        month: String(ctx.query.month || "").trim() || undefined,
        tzOffsetMinutes: ctx.query.tzOffsetMinutes,
        sessionToken: getSessionTokenFromRequest(ctx) || null,
      });
    } catch (e) {
      writeError(ctx, 400, e instanceof Error ? e.message : "Unexpected error");
    }
  });

  router.post("/ucp/api/community/events/:eventId/interest", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const eventId = Number(ctx.params.eventId);
      if (!Number.isInteger(eventId)) {
        throw new Error("eventId must be an integer");
      }

      const interested = (ctx.request.body || {}).interested;
      if (typeof interested !== "boolean") {
        throw new Error("interested must be true or false");
      }

      ctx.body = {
        ok: true,
        event: db.setCommunityEventInterest(sessionToken, eventId, interested),
      };
    });
  });

  router.post("/ucp/api/community/tickets", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      ctx.status = 201;
      ctx.body = {
        ok: true,
        ticket: db.createCommunityTicket(sessionToken, ctx.request.body || {}, getSessionMeta(ctx)),
      };
    });
  });

  router.post("/ucp/api/community/forum-groups", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      ctx.body = {
        ok: true,
        community: db.updateForumGroupSelection(sessionToken, body.action, body.groupCode),
        profileHub: db.getProfileHub(sessionToken),
      };
    });
  });

  router.post("/ucp/api/characters", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const character = db.createCharacter(sessionToken);
      const sessionContext = db.getSessionContext(sessionToken);
      ctx.status = 201;
      ctx.body = {
        character,
        characters: db.listCharacters(sessionContext!.account.id),
      };
    });
  });

  router.post("/ucp/api/characters/finalize-name", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      const characterId = Number(body.characterId);
      if (!Number.isInteger(characterId)) {
        throw new Error("Character ID is required");
      }

      const requestedName = String(body.name || "").trim();
      console.log(`[ucp] finalize-name attempt characterId=${characterId} name="${requestedName}" from ${ctx.request.ip}`);
      try {
        const character = db.finalizeCharacterName(sessionToken, characterId, body.name);
        console.log(`[ucp] finalize-name success characterId=${character.id} profileId=${character.profile_id} name="${character.name}"`);
        const sessionContext = db.getSessionContext(sessionToken);
        ctx.body = {
          character,
          characters: db.listCharacters(sessionContext!.account.id),
        };
      } catch (error) {
        const errorText = error instanceof Error ? error.message : `${error}`;
        console.log(`[ucp] finalize-name failed characterId=${characterId} name="${requestedName}" from ${ctx.request.ip}: ${errorText}`);
        throw error;
      }
    });
  });

  router.post("/ucp/api/characters/select", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      const characterId = Number(body.characterId);
      if (!Number.isInteger(characterId)) {
        throw new Error("characterId must be an integer");
      }

      const character = db.selectCharacter(sessionToken, characterId);
      const sessionContext = db.getSessionContext(sessionToken);
      ctx.body = {
        selectedCharacter: character,
        characters: db.listCharacters(sessionContext!.account.id),
      };
    });
  });

  router.post("/ucp/api/game/play-session", (ctx: KoaContext) => {
    withAuthenticatedSession(settings, ctx, (db, sessionToken) => {
      const body = ctx.request.body || {};
      const requestedCharacterId = body.characterId === undefined ? undefined : Number(body.characterId);
      if (requestedCharacterId !== undefined && !Number.isInteger(requestedCharacterId)) {
        throw new Error("characterId must be an integer");
      }

      const serverMasterKey = String(
        body.serverMasterKey
        || settings.allSettings?.masterKey
        || `${settings.allSettings?.listenHost || "127.0.0.1"}:${settings.allSettings?.port || 7777}`
      );

      const playSession = db.createPlaySession(sessionToken, serverMasterKey, requestedCharacterId);
      ctx.body = {
        session: playSession.id,
        expiresAt: playSession.expires_at,
        profileId: playSession.profile_id,
        characterId: playSession.character_id,
        serverMasterKey,
      };
    });
  });
};
