import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { pid } from "process";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function safeCopyFile(source: string, targetDir: string) {
  try {
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      return;
    }
    ensureDir(targetDir);
    fs.copyFileSync(source, path.join(targetDir, path.basename(source)));
  } catch {
    // Best-effort crash collection only.
  }
}

const SENSITIVE_KEY_PATTERN = /(token|secret|password|pass|key|auth|cookie|credential|smtp|discord|masterkey)/i;

function redactSensitiveValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveValue(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redactSensitiveValue(entry);
  });
  return redacted;
}

function safeCopyRedactedJsonFile(source: string, targetDir: string) {
  try {
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      return;
    }
    ensureDir(targetDir);
    const parsed = JSON.parse(fs.readFileSync(source, "utf8"));
    const redacted = redactSensitiveValue(parsed);
    fs.writeFileSync(
      path.join(targetDir, path.basename(source)),
      JSON.stringify(redacted, null, 2),
      "utf8",
    );
  } catch {
    // Best-effort crash collection only.
  }
}

function safeStringify(value: unknown) {
  if (value instanceof Error) {
    return redactSensitiveValue({
      name: value.name,
      message: value.message,
      stack: value.stack,
    });
  }

  try {
    return redactSensitiveValue(JSON.parse(JSON.stringify(value)));
  } catch {
    return `${value}`;
  }
}

export function createServerCrashBundle(kind: string, args: unknown[]) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-");
  const cwd = path.resolve("");
  const bundleDir = path.join(cwd, "crash-reports", `server-crash-${timestamp}`);
  const configDir = path.join(bundleDir, "config");
  const logsDir = path.join(bundleDir, "logs");

  ensureDir(configDir);
  ensureDir(logsDir);

  const summary = {
    generatedAt: now.toISOString(),
    kind,
    pid,
    cwd,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    uptimeSeconds: process.uptime(),
    argv: process.argv,
    memoryUsage: process.memoryUsage(),
    args: args.map((arg) => safeStringify(arg)),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PATH: process.env.PATH,
      USERPROFILE: process.env.USERPROFILE,
      COMPUTERNAME: process.env.COMPUTERNAME,
    },
    hostname: os.hostname(),
  };

  fs.writeFileSync(
    path.join(bundleDir, "summary.json"),
    JSON.stringify(summary, null, 2),
    "utf8",
  );

  const summaryLines = [
    "# SkyMP Server Crash Bundle",
    "",
    `Generated: ${summary.generatedAt}`,
    `Kind: ${kind}`,
    `PID: ${pid}`,
    `CWD: ${cwd}`,
    `Node: ${process.version}`,
    `Uptime: ${summary.uptimeSeconds}`,
    "",
    "## Args",
    ...summary.args.map((arg, index) => `- arg${index}: ${JSON.stringify(arg)}`),
  ];

  fs.writeFileSync(path.join(bundleDir, "summary.md"), summaryLines.join("\n"), "utf8");

  [
    path.join(cwd, "server-settings.json"),
    path.join(cwd, "server-settings-dump.json"),
    path.join(cwd, "server-settings-merged.json"),
    path.join(cwd, "skrp-chat-user-settings.json"),
  ].forEach((source) => safeCopyRedactedJsonFile(source, configDir));

  [
    path.join(cwd, "server-crash.log"),
  ].forEach((source) => safeCopyFile(source, logsDir));

  return bundleDir;
}
