import { Settings } from "./settings";

type KoaContext = any;

export const ACCOUNT_SESSION_COOKIE_NAME = "skyrim_unbound_session";
export const LEGACY_ACCOUNT_SESSION_COOKIE_NAMES = ["skyrim" + "_world_session"];

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  return value as Record<string, unknown>;
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

function normalizeIpAddress(ipRaw: unknown) {
  const normalized = String(ipRaw || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("::ffff:")) {
    return normalized.slice(7);
  }

  if (normalized === "::1/128") {
    return "::1";
  }

  return normalized;
}

export function normalizeHostValue(hostRaw: unknown) {
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

function parseHttpUrl(value: unknown) {
  const raw = asNonEmptyString(value);
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

export function isLoopbackHost(hostRaw: unknown) {
  const host = normalizeHostValue(hostRaw);
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

export function isLoopbackIpAddress(ipRaw: unknown) {
  const ip = normalizeIpAddress(ipRaw);
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

export function isLocalRequest(ctx: KoaContext) {
  return isLoopbackIpAddress(ctx.request?.ip)
    || isLoopbackIpAddress(ctx.ip)
    || isLoopbackIpAddress(ctx.req?.socket?.remoteAddress)
    || isLoopbackIpAddress(ctx.request?.socket?.remoteAddress);
}

function isHttpsUrl(value: unknown) {
  return parseHttpUrl(value)?.protocol === "https:";
}

export function getRequestHost(ctx: KoaContext) {
  return normalizeHostValue(
    ctx.get?.("host")
    || ctx.host
    || ctx.hostname
    || ctx.request?.host
    || ctx.request?.hostname
    || ctx.request?.header?.host
  );
}

function getConfiguredTrustedHosts(settings: Settings) {
  const settingsRecord = asRecord(settings.allSettings) ?? {};
  const adminSettings = asRecord(settingsRecord.adminPanel)
    ?? asRecord(settingsRecord.admin)
    ?? {};
  const configuredHosts = new Set<string>();

  [
    settingsRecord.ucpPublicUrl,
    settingsRecord.ucpUrl,
    settingsRecord.publicUrl,
    adminSettings.publicUrl,
    adminSettings.url,
  ]
    .map((value) => parseHttpUrl(value))
    .forEach((parsed) => {
      const host = normalizeHostValue(parsed?.host);
      if (host) {
        configuredHosts.add(host);
      }
    });

  return configuredHosts;
}

function isAllowedBrowserOrigin(settings: Settings, ctx: KoaContext, originRaw: unknown) {
  const origin = parseHttpUrl(originRaw);
  if (!origin) {
    return false;
  }

  const allowedHosts = getConfiguredTrustedHosts(settings);
  const requestHost = getRequestHost(ctx);
  if (requestHost) {
    allowedHosts.add(requestHost);
  }

  if (isLocalRequest(ctx)) {
    allowedHosts.add("localhost");
    allowedHosts.add("127.0.0.1");
    allowedHosts.add("::1");
  }

  return allowedHosts.has(normalizeHostValue(origin.host));
}

export function isUnsafeHttpMethod(methodRaw: unknown) {
  const method = String(methodRaw || "").trim().toUpperCase();
  return method === "POST"
    || method === "PUT"
    || method === "PATCH"
    || method === "DELETE";
}

export function shouldRejectCrossOriginBrowserRequest(settings: Settings, ctx: KoaContext) {
  if (!isUnsafeHttpMethod(ctx.method)) {
    return false;
  }

  const origin = asNonEmptyString(ctx.get?.("origin") || ctx.request?.header?.origin);
  const referer = asNonEmptyString(ctx.get?.("referer") || ctx.request?.header?.referer);
  const secFetchSite = asNonEmptyString(
    ctx.get?.("sec-fetch-site")
    || ctx.request?.header?.["sec-fetch-site"]
  )?.toLowerCase();

  if (!origin && !referer && !secFetchSite) {
    return false;
  }

  if (origin) {
    return !isAllowedBrowserOrigin(settings, ctx, origin);
  }

  if (referer) {
    return !isAllowedBrowserOrigin(settings, ctx, referer);
  }

  return secFetchSite === "cross-site";
}

export function shouldUseSecureCookies(settings: Settings, ctx: KoaContext) {
  const forwardedProto = asNonEmptyString(
    ctx.get?.("x-forwarded-proto")
    || ctx.request?.header?.["x-forwarded-proto"]
  );
  if (String(ctx.secure || "").toLowerCase() === "true") {
    return true;
  }
  if (String(ctx.protocol || ctx.request?.protocol || "").trim().toLowerCase() === "https") {
    return true;
  }
  if (forwardedProto) {
    const firstForwardedProto = forwardedProto.split(",")[0]?.trim().toLowerCase();
    if (firstForwardedProto === "https") {
      return true;
    }
  }

  const settingsRecord = asRecord(settings.allSettings) ?? {};
  return isHttpsUrl(settingsRecord.ucpPublicUrl)
    || isHttpsUrl(settingsRecord.ucpUrl)
    || isHttpsUrl(settingsRecord.publicUrl);
}

export function isFounderBootstrapAllowed(settings: Settings, ctx: KoaContext) {
  const settingsRecord = asRecord(settings.allSettings) ?? {};
  const adminSettings = asRecord(settingsRecord.adminPanel)
    ?? asRecord(settingsRecord.admin)
    ?? {};

  const founderBootstrapEnabled = parseBooleanFlag(adminSettings.allowFounderBootstrap)
    || parseBooleanFlag(adminSettings.founderBootstrap)
    || parseBooleanFlag(settingsRecord.adminFounderBootstrap)
    || parseBooleanFlag(settingsRecord.allowFounderBootstrap);

  return founderBootstrapEnabled
    && isLocalRequest(ctx)
    && isLoopbackHost(getRequestHost(ctx));
}
