export type CommunityEventStatus = "SCHEDULED" | "CANCELLED" | "ARCHIVED";

export type CommunityEventMonthWindow = {
  month: string;
  tzOffsetMinutes: number;
  startIso: string;
  endIso: string;
};

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const MAX_TZ_OFFSET_MINUTES = 14 * 60;

export const COMMUNITY_EVENT_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS community_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'SCHEDULED',
    created_by_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    updated_by_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS community_event_interests (
    event_id INTEGER NOT NULL REFERENCES community_events(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    PRIMARY KEY(event_id, account_id)
  );

  CREATE INDEX IF NOT EXISTS idx_community_events_starts_at
  ON community_events(starts_at, status);

  CREATE INDEX IF NOT EXISTS idx_community_event_interests_account_id
  ON community_event_interests(account_id, created_at DESC);
`;

export const normalizeCommunityEventStatus = (
  valueRaw: string | null | undefined,
  options?: { allowArchived?: boolean; defaultStatus?: CommunityEventStatus }
) => {
  const normalized = String(valueRaw || options?.defaultStatus || "SCHEDULED").trim().toUpperCase() as CommunityEventStatus;
  const allowed = options?.allowArchived
    ? new Set<CommunityEventStatus>(["SCHEDULED", "CANCELLED", "ARCHIVED"])
    : new Set<CommunityEventStatus>(["SCHEDULED", "CANCELLED"]);

  if (!allowed.has(normalized)) {
    throw new Error(`Event status must be one of ${Array.from(allowed).join(", ")}`);
  }

  return normalized;
};

export const normalizeCommunityEventStartsAt = (valueRaw: string | Date | null | undefined) => {
  if (valueRaw instanceof Date) {
    if (Number.isNaN(valueRaw.getTime())) {
      throw new Error("Event date and time is invalid");
    }
    return valueRaw.toISOString();
  }

  const raw = String(valueRaw || "").trim();
  if (!raw) {
    throw new Error("Event date and time is required");
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Event date and time is invalid");
  }

  return parsed.toISOString();
};

const normalizeTzOffsetMinutes = (valueRaw: unknown) => {
  if (valueRaw === undefined || valueRaw === null || valueRaw === "") {
    return 0;
  }

  const parsed = Number(valueRaw);
  if (!Number.isInteger(parsed) || parsed < -MAX_TZ_OFFSET_MINUTES || parsed > MAX_TZ_OFFSET_MINUTES) {
    throw new Error(`tzOffsetMinutes must be an integer between ${-MAX_TZ_OFFSET_MINUTES} and ${MAX_TZ_OFFSET_MINUTES}`);
  }

  return parsed;
};

export const getCommunityEventMonthWindow = (
  monthRaw?: string | null,
  tzOffsetMinutesRaw?: unknown,
  fallbackDate = new Date()
): CommunityEventMonthWindow => {
  let year = fallbackDate.getFullYear();
  let monthIndex = fallbackDate.getMonth();

  if (monthRaw) {
    const match = MONTH_PATTERN.exec(String(monthRaw).trim());
    if (!match) {
      throw new Error("month must use YYYY-MM");
    }

    year = Number(match[1]);
    monthIndex = Number(match[2]) - 1;
    if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
      throw new Error("month must use YYYY-MM");
    }
  }

  const tzOffsetMinutes = normalizeTzOffsetMinutes(tzOffsetMinutesRaw);
  const startUtcMillis = Date.UTC(year, monthIndex, 1, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000;
  const endUtcMillis = Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0) + tzOffsetMinutes * 60 * 1000;

  return {
    month: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    tzOffsetMinutes,
    startIso: new Date(startUtcMillis).toISOString(),
    endIso: new Date(endUtcMillis).toISOString(),
  };
};
