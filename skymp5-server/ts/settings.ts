import * as fs from 'fs';
import * as crypto from "crypto";
import { Octokit } from '@octokit/rest';
import { RequestError as OctokitRequestError } from '@octokit/request-error';
import { ArgumentParser } from 'argparse';
import lodash from 'lodash';

export interface DiscordAuthSettings {
  botToken: string;
  guildId: string;
  banRoleId: string;
  eventLogChannelId?: string;
  hideIpRoleId?: string;
}

export interface DiscordUpdatesSettings {
  botToken?: string;
  channelId: string;
  approvalRequired?: boolean;
  approvalChannelId?: string;
  approvalAllowedUserIds?: string[];
  approvalAllowedRoleIds?: string[];
  repoPath?: string;
  pollIntervalMs?: number;
  maxCommitsPerPoll?: number;
  maxFilesPerCommit?: number;
  mentionRoleId?: string;
  stateFilePath?: string;
  announceInitialCommit?: boolean;
}

export class Settings {
  masterKey: string | null = null;
  port = 7777;
  maxPlayers = 100;
  master: string = "https://gateway.skymp.net";
  name = 'Yet Another Server';
  gamemodePath = '...';
  loadOrder = new Array<string>();
  dataDir = './data';
  offlineMode = false;
  startPoints = [
    {
      pos: [133857, -61130, 14662],
      worldOrCell: '0x3c',
      angleZ: 72,
    },
  ];
  discordAuth: DiscordAuthSettings | null = null;
  discordUpdates: DiscordUpdatesSettings | null = null;

  allSettings: Record<string, unknown> | null = null;

  constructor() { }

  static async get(): Promise<Settings> {
    if (!Settings.cachedPromise) {
      Settings.cachedPromise = (async () => {
        const res = new Settings();
        await res.loadSettings();  // Load settings asynchronously
        return res;
      })();
    }

    return Settings.cachedPromise;
  }

  private async loadSettings() {
    if (fs.existsSync('./skymp5-gamemode')) {
      this.gamemodePath = './skymp5-gamemode/gamemode.js';
    } else {
      this.gamemodePath = './gamemode.js';
    }

    const settings = await fetchServerSettings();
    [
      'masterKey',
      'port',
      'maxPlayers',
      'master',
      'name',
      'gamemodePath',
      'loadOrder',
      'dataDir',
      'startPoints',
      'offlineMode',
      'discordAuth',
      'discordUpdates',
    ].forEach((prop) => {
      if (settings[prop]) {
        (this as Record<string, unknown>)[prop] = settings[prop];
      }
    });

    this.allSettings = settings;
    printPublicTestReadiness(settings);
  }

  private static parseArgs() {
    const parser = new ArgumentParser({
      add_help: false,
      description: '',
    });
    return parser.parse_args();
  }

  private static cachedPromise: Promise<Settings> | null = null;
}

type PublicTestReadiness = {
  infos: string[];
  warnings: string[];
  errors: string[];
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function isLoopbackHost(host: unknown): boolean {
  const normalized = asNonEmptyString(host)?.toLowerCase();
  return normalized === '127.0.0.1' || normalized === 'localhost' || normalized === '::1';
}

function getUiPort(port: number): number {
  return port === 7777 ? 3000 : port + 1;
}

function getPublicTestReadiness(settings: Record<string, unknown>): PublicTestReadiness {
  const infos: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const offlineMode = settings.offlineMode === true;
  const master = asNonEmptyString(settings.master);
  const masterKey = asNonEmptyString(settings.masterKey);
  const serverName = asNonEmptyString(settings.name);
  const listenHost = asNonEmptyString(settings.listenHost);
  const uiListenHost = asNonEmptyString(settings.uiListenHost);
  const password = asNonEmptyString(settings.password);
  const maxPlayers = typeof settings.maxPlayers === 'number' ? settings.maxPlayers : undefined;
  const port = typeof settings.port === 'number' ? settings.port : 7777;
  const uiPort = getUiPort(port);
  const ucpPublicUrl = asNonEmptyString(settings.ucpPublicUrl) ?? asNonEmptyString(settings.ucpUrl) ?? asNonEmptyString(settings.publicUrl);
  const recoveryMailConfig = asRecord(settings.ucpMail) ?? asRecord(settings.mail) ?? asRecord(settings.smtp);

  if (offlineMode) {
    infos.push(
      'Server is currently in offline mode. This is fine for local/LAN testing, but internet testers will not authenticate through the master server.'
    );
    warnings.push(
      'Public test mode is not active yet. To go live, switch "offlineMode" to false and configure both "master" and "masterKey".'
    );
  } else {
    infos.push(`Online mode is enabled. Expected external ports are UDP ${port} and TCP ${uiPort}.`);

    if (!master) {
      errors.push('Online mode requires a non-empty "master" URL.');
    }
    if (!masterKey) {
      errors.push('Online mode requires a non-empty "masterKey".');
    }
    if (isLoopbackHost(listenHost)) {
      errors.push(
        `"listenHost" is set to ${listenHost}, so the main game socket only accepts localhost traffic. Use "0.0.0.0" or remove the field for public testing.`
      );
    }
    if (isLoopbackHost(uiListenHost)) {
      errors.push(
        `"uiListenHost" is set to ${uiListenHost}, so remote clients cannot fetch server UI assets. Use "0.0.0.0" or remove the field for public testing.`
      );
    }
  }

  if (!serverName || /^(my server|yet another server)$/i.test(serverName)) {
    warnings.push('Server name still looks default-ish. Give the public test a distinct server name before inviting players.');
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    errors.push(`Configured port "${settings.port}" is invalid.`);
  }

  if (typeof maxPlayers === 'number' && maxPlayers < 2) {
    errors.push(`Configured maxPlayers "${maxPlayers}" is too low for external testing.`);
  } else if (typeof maxPlayers === 'number' && maxPlayers < 8) {
    warnings.push(`maxPlayers is only ${maxPlayers}. That's okay for a small closed test, but low for a wider opening.`);
  }

  if (!password) {
    warnings.push('No server password is configured. That may be fine for a true public launch, but a temporary password is safer while testing.');
  }

  if (!ucpPublicUrl) {
    warnings.push('Password recovery links need a public UCP URL. Set "ucpPublicUrl" once the site is live.');
  }

  if (!recoveryMailConfig || (!asNonEmptyString(recoveryMailConfig.host) && !asNonEmptyString(recoveryMailConfig.smtpHost))) {
    warnings.push('Password recovery email is not configured yet. Forgot-password will stay disabled until SMTP settings are provided.');
  }

  return { infos, warnings, errors };
}

function printPublicTestReadiness(settings: Record<string, unknown>): void {
  const readiness = getPublicTestReadiness(settings);
  const lines = [
    ...readiness.infos.map((message) => `[info] ${message}`),
    ...readiness.warnings.map((message) => `[warning] ${message}`),
    ...readiness.errors.map((message) => `[error] ${message}`),
  ];

  if (lines.length === 0) {
    return;
  }

  console.log('[public-test-readiness] Startup check:');
  for (const line of lines) {
    console.log(`[public-test-readiness] ${line}`);
  }
}

/**
 * Resolves a Git ref to a commit hash if it's not already a commit hash.
 */
async function resolveRefToCommitHash(octokit: Octokit, owner: string, repo: string, ref: string): Promise<string> {
  // Check if `ref` is already a 40-character hexadecimal string (commit hash).
  if (/^[a-f0-9]{40}$/i.test(ref)) {
    return ref; // It's already a commit hash.
  }

  // First, try to resolve it as a branch.
  try {
    return await getCommitHashFromRef(octokit, owner, repo, `heads/${ref}`);
  } catch (error) {
    if (!(error instanceof OctokitRequestError)) {
      throw new Error(`Could not resolve ref to commit hash`, { cause: error });
    }
    if (error.status !== 404) {
      throw new Error(`Could not resolve ref to commit hash`, { cause: error });
    }
    // ignore, try another way
  }

  // If the branch resolution fails, try to resolve it as a tag.
  try {
    return await getCommitHashFromRef(octokit, owner, repo, `tags/${ref}`);
  } catch (error) {
    throw new Error(`Could not resolve ref to commit hash`, { cause: error });
  }
}

async function getCommitHashFromRef(octokit: Octokit, owner: string, repo: string, ref: string): Promise<string> {
  const { data } = await octokit.git.getRef({
    owner,
    repo,
    ref,
  });
  return data.object.sha;
}

async function fetchServerSettings(): Promise<any> {
  // Load server-settings.json
  const settingsPath = 'server-settings.json';
  const rawSettings = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
  let serverSettingsFile = JSON.parse(rawSettings);

  let serverSettings: Record<string, unknown> = {};

  const additionalServerSettings = serverSettingsFile.additionalServerSettings || [];

  let dumpFileNameSuffix = '';

  for (let i = 0; i < additionalServerSettings.length; ++i) {
    console.log(`Verifying additional server settings source ${i + 1} / ${additionalServerSettings.length}`);

    const { type, repo, ref, token, pathRegex } = serverSettingsFile.additionalServerSettings[i];

    if (typeof type !== "string") {
      throw new Error(`Expected additionalServerSettings[${i}].type to be string`);
    }

    if (type !== "github") {
      throw new Error(`Expected additionalServerSettings[${i}].type to be one of ["github"], but got ${type}`);
    }

    if (typeof repo !== "string") {
      throw new Error(`Expected additionalServerSettings[${i}].repo to be string`);
    }
    if (typeof ref !== "string") {
      throw new Error(`Expected additionalServerSettings[${i}].ref to be string`);
    }
    if (typeof token !== "string") {
      throw new Error(`Expected additionalServerSettings[${i}].token to be string`);
    }
    if (typeof pathRegex !== "string") {
      throw new Error(`Expected additionalServerSettings[${i}].pathRegex to be string`);
    }

    const octokit = new Octokit({ auth: token });

    const [owner, repoName] = repo.split('/');

    const commitHash = await resolveRefToCommitHash(octokit, owner, repoName, ref);
    dumpFileNameSuffix += `-${commitHash}`;
  }

  const dumpFileName = `server-settings-dump.json`;

  const readDump: Record<string, unknown> | undefined = fs.existsSync(dumpFileName) ? JSON.parse(fs.readFileSync(dumpFileName, 'utf-8')) : undefined;

  let readDumpNoSha512 = structuredClone(readDump);
  if (readDumpNoSha512) {
    delete readDumpNoSha512['_sha512_'];
  }

  const expectedSha512 = readDumpNoSha512 ? crypto.createHash('sha512').update(JSON.stringify(readDumpNoSha512)).digest('hex') : '';

  if (readDump && readDump["_meta_"] === dumpFileNameSuffix && readDump["_sha512_"] === expectedSha512) {
    console.log(`Loading settings dump from ${dumpFileName}`);
    serverSettings = JSON.parse(fs.readFileSync(dumpFileName, 'utf-8'));
  } else {
    for (let i = 0; i < additionalServerSettings.length; ++i) {

      const { repo, ref, token, pathRegex } = serverSettingsFile.additionalServerSettings[i];

      console.log(`Fetching settings from "${repo}" at ref "${ref}" with path regex ${pathRegex}`);

      const regex = new RegExp(pathRegex);

      const octokit = new Octokit({ auth: token });

      const [owner, repoName] = repo.split('/');

      // List repository contents at specified ref
      const rootContent = await octokit.repos.getContent({
        owner,
        repo: repoName,
        ref,
        path: '',
      });

      const { data } = rootContent;

      const rateLimitRemainingInitial = parseInt(rootContent.headers["x-ratelimit-remaining"]) + 1;
      let rateLimitRemaining = 0;

      const onFile = async (file: { path: string, name: string }) => {
        if (file.name.endsWith('.json')) {
          if (regex.test(file.path)) {
            // Fetch individual file content if it matches the regex
            const fileData = await octokit.repos.getContent({
              owner,
              repo: repoName,
              ref,
              path: file.path,
            });
            rateLimitRemaining = parseInt(fileData.headers["x-ratelimit-remaining"]);

            if ('content' in fileData.data && typeof fileData.data.content === 'string') {
              // Decode Base64 content and parse JSON
              const content = Buffer.from(fileData.data.content, 'base64').toString('utf-8');
              const jsonContent = JSON.parse(content);
              // Merge or handle the JSON content as needed
              console.log(`Merging "${file.path}"`);

              serverSettings = lodash.merge(serverSettings, jsonContent);
            } else {
              throw new Error(`Expected content to be an array (${file.path})`);
            }
          } else {
            console.log(`Ignoring "${file.path}"`);
          }
        }
      }

      const onDir = async (file: { path: string, name: string }) => {
        const fileData = await octokit.repos.getContent({
          owner,
          repo: repoName,
          ref,
          path: file.path,
        });
        rateLimitRemaining = parseInt(fileData.headers["x-ratelimit-remaining"]);

        if (Array.isArray(fileData.data)) {
          for (const item of fileData.data) {
            if (item.type === "file") {
              await onFile(item);
            } else if (item.type === "dir") {
              await onDir(item);
            } else {
              console.warn(`Skipping unsupported item type ${item.type} (${item.path})`);
            }
          }
        } else {
          throw new Error(`Expected data to be an array (${file.path})`);
        }
      }

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.type === "file") {
            await onFile(item);
          } else if (item.type === "dir") {
            await onDir(item);
          } else {
            console.warn(`Skipping unsupported item type ${item.type} (${item.path})`);
          }
        }
      } else {
        throw new Error(`Expected data to be an array (root)`);
      }

      console.log(`Rate limit spent: ${rateLimitRemainingInitial - rateLimitRemaining}, remaining: ${rateLimitRemaining}`);

      const xRateLimitReset = rootContent.headers["x-ratelimit-reset"];
      const resetDate = new Date(parseInt(xRateLimitReset, 10) * 1000);
      const currentDate = new Date();
      if (resetDate > currentDate) {
        console.log("The rate limit will reset in the future");
        const secondsUntilReset = (resetDate.getTime() - currentDate.getTime()) / 1000;
        console.log(`Seconds until reset: ${secondsUntilReset}`);
      } else {
        console.log("The rate limit has already been reset");
      }
    }

    if (JSON.stringify(serverSettings) !== JSON.stringify(JSON.parse(rawSettings))) {
      console.log(`Dumping ${dumpFileName} for cache and debugging`);
      serverSettings["_meta_"] = dumpFileNameSuffix;
      serverSettings["_sha512_"] = crypto.createHash('sha512').update(JSON.stringify(serverSettings)).digest('hex');
      fs.writeFileSync(dumpFileName, JSON.stringify(serverSettings, null, 2));
    }
  }

  console.log(`Merging "server-settings.json" (original settings file)`);
  serverSettings = lodash.merge(serverSettings, serverSettingsFile);

  fs.writeFileSync('server-settings-merged.json', JSON.stringify(serverSettings, null, 2));

  return serverSettings;
}
