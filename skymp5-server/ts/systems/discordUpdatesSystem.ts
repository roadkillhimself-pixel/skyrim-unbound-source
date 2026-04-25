import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { Client, GatewayIntentBits, Interaction, PermissionFlagsBits } from "discord.js";
import { DiscordUpdatesSettings, Settings } from "../settings";
import { System, SystemContext } from "./system";

const execFileAsync = promisify(execFile);
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_MAX_COMMITS_PER_POLL = 5;
const DEFAULT_MAX_FILES_PER_COMMIT = 6;
const DISCORD_EMBED_COLOR = 0xb08b2f;
const DISCORD_FIELD_LIMIT = 1000;
const FEED_DISPLAY_NAME = "Skyrim Unbound Update Feed";
const APPROVAL_CUSTOM_ID_PREFIX = "skyrim-unbound-updates";

type DiscordUpdatesState = {
  repoPath?: string;
  lastAnnouncedCommit?: string;
  pendingApproval?: PendingApprovalState;
};

type PendingApprovalState = {
  commitSha: string;
  previousCommitSha: string | null;
  channelId: string;
  messageId: string;
};

type ResolvedDiscordUpdatesConfig = {
  botToken: string;
  channelId: string;
  approvalRequired: boolean;
  approvalChannelId: string;
  approvalAllowedUserIds: string[];
  approvalAllowedRoleIds: string[];
  repoPath: string;
  pollIntervalMs: number;
  maxCommitsPerPoll: number;
  maxFilesPerCommit: number;
  mentionRoleId?: string;
  stateFilePath: string;
  announceInitialCommit: boolean;
  repoDisplayName: string;
  branchName: string;
  repoWebUrl?: string;
};

type DiscordMessagePayload = {
  content?: string;
  allowed_mentions: {
    parse: string[];
    roles?: string[];
  };
  embeds: Array<Record<string, unknown>>;
  components?: Array<Record<string, unknown>>;
};

type CommitInfo = {
  sha: string;
  subject: string;
  body: string;
  author: string;
  unixTimestamp: number;
  files: string[];
};

type ChangeImportance = "high" | "medium" | "low";

type ChangeArea = {
  key: string;
  label: string;
  importance: ChangeImportance;
  files: string[];
};

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asNonEmptyString(entry))
    .filter((entry): entry is string => entry !== undefined);
}

function clampPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : fallback;
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 1) {
    return value.slice(0, maxLength);
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function hasPathSegment(filePath: string, pattern: RegExp): boolean {
  return filePath.split("/").some((segment) => pattern.test(segment));
}

function getChangeAreaForFile(filePathRaw: string): Omit<ChangeArea, "files"> {
  const filePath = normalizeRepoPath(filePathRaw);
  const lowerPath = filePath.toLowerCase();
  const extension = path.extname(lowerPath);
  const fileName = path.basename(lowerPath);

  if (
    /(^|\/)(database|db|migrations?|schema)(\/|\.|$)/i.test(filePath) ||
    /\.(sql|sqlite|db)$/i.test(filePath) ||
    fileName.includes("migration")
  ) {
    return { key: "database", label: "Database", importance: "high" };
  }

  if (
    lowerPath === "skymp5-server/ts/ucp.ts" ||
    lowerPath.startsWith("misc/public-test/ucp-site/") ||
    lowerPath.includes("/auth") ||
    lowerPath.includes("authservice") ||
    lowerPath.includes("login")
  ) {
    return { key: "ucp", label: "UCP and accounts", importance: "high" };
  }

  if (lowerPath === "skymp5-server/ts/admin.ts" || lowerPath.startsWith("misc/public-test/admin-panel/")) {
    return { key: "admin", label: "Admin panel", importance: "high" };
  }

  if (
    lowerPath.includes("security") ||
    lowerPath.includes("csrf") ||
    lowerPath.includes("cookie") ||
    lowerPath.includes("token") ||
    lowerPath.includes("discordupdates")
  ) {
    return { key: "security", label: "Security and integrations", importance: "high" };
  }

  if (lowerPath.startsWith("skymp5-server/") || lowerPath.startsWith("local-gamemode/")) {
    return { key: "server", label: "Server", importance: "high" };
  }

  if (lowerPath.startsWith("skymp5-client/") || lowerPath.startsWith("skyrim-platform/")) {
    return { key: "client", label: "Client", importance: "high" };
  }

  if (lowerPath.startsWith("misc/public-test/website/")) {
    if (/\.(jpg|jpeg|png|webp|gif|ico|svg|woff2?|ttf)$/i.test(filePath)) {
      return { key: "website", label: "Website", importance: "low" };
    }

    return { key: "website", label: "Website", importance: "medium" };
  }

  if (
    lowerPath.startsWith("misc/public-test/") ||
    fileName === "package.json" ||
    fileName.endsWith(".lock") ||
    lowerPath.endsWith("yarn.lock") ||
    hasPathSegment(lowerPath, /^(scripts?|tools?|config)$/i)
  ) {
    return { key: "infrastructure", label: "Infrastructure and build", importance: "medium" };
  }

  if (
    lowerPath.startsWith("docs/") ||
    fileName === "readme.md" ||
    fileName === ".gitignore" ||
    /\.(md|txt|log)$/i.test(filePath)
  ) {
    return { key: "quality-of-life", label: "Quality of life", importance: "low" };
  }

  if (/\.(css|scss|sass|html|json|yaml|yml)$/i.test(filePath)) {
    return { key: "quality-of-life", label: "Quality of life", importance: "low" };
  }

  return { key: "quality-of-life", label: "Quality of life", importance: "low" };
}

function getPlayerFacingAreaSummary(area: ChangeArea): string {
  const fileCount = area.files.length;
  const suffix = fileCount > 1 ? ` across ${fileCount} files` : "";

  switch (area.key) {
    case "database":
      return `Database: persistence and saved data updates${suffix}.`;
    case "ucp":
      return `Accounts: login, profile, or UCP improvements${suffix}.`;
    case "admin":
      return `Admin tools: staff workflow improvements${suffix}.`;
    case "security":
      return `Security and integrations: safer service and Discord update handling${suffix}.`;
    case "server":
      return `Server: gameplay, world, or stability changes${suffix}.`;
    case "client":
      return `Client: in-game experience and interface updates${suffix}.`;
    case "website":
      return `Website: public-facing page or asset refresh${suffix}.`;
    case "infrastructure":
      return `Infrastructure: build, deploy, or server maintenance${suffix}.`;
    case "quality-of-life":
    default:
      return `Quality of life: documentation, cleanup, or small polish${suffix}.`;
  }
}

function summarizeChangeAreas(files: string[]): { significant: string; qualityOfLife: string | null; scope: string } {
  if (files.length === 0) {
    return {
      significant: "Manual update with no tracked file changes.",
      qualityOfLife: null,
      scope: "No tracked files changed.",
    };
  }

  const areas = new Map<string, ChangeArea>();

  for (const originalFilePath of files) {
    const filePath = normalizeRepoPath(originalFilePath);
    const areaInfo = getChangeAreaForFile(filePath);
    const existing = areas.get(areaInfo.key);

    if (existing) {
      existing.files.push(filePath);
    } else {
      areas.set(areaInfo.key, {
        ...areaInfo,
        files: [filePath],
      });
    }
  }

  const importanceOrder: Record<ChangeImportance, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  const sortedAreas = Array.from(areas.values()).sort((left, right) => {
    const importanceDiff = importanceOrder[left.importance] - importanceOrder[right.importance];
    if (importanceDiff !== 0) {
      return importanceDiff;
    }

    return left.label.localeCompare(right.label);
  });

  const significantAreas = sortedAreas.filter((area) => area.importance !== "low");
  const qualityOfLifeAreas = sortedAreas.filter((area) => area.importance === "low");
  const significantLines = significantAreas.map((area) => `- ${getPlayerFacingAreaSummary(area)}`);

  const qualityOfLifeCount = qualityOfLifeAreas.reduce((total, area) => total + area.files.length, 0);

  if (significantLines.length === 0 && qualityOfLifeCount > 0) {
    significantLines.push(`- Quality of life: small polish, cleanup, or documentation updates across ${qualityOfLifeCount} files.`);
  }

  return {
    significant: truncateText(significantLines.join("\n"), DISCORD_FIELD_LIMIT),
    qualityOfLife:
      qualityOfLifeCount > 0 && significantAreas.length > 0
        ? truncateText(`${qualityOfLifeCount} smaller polish or cleanup change(s) were folded into this update.`, DISCORD_FIELD_LIMIT)
        : null,
    scope: truncateText(`Technical scope: ${files.length} tracked file(s), summarized for readability.`, DISCORD_FIELD_LIMIT),
  };
}

function normalizeDiscordAuthorization(botToken: string): string {
  return /^Bot\s+/i.test(botToken) ? botToken : `Bot ${botToken}`;
}

function normalizeDiscordLoginToken(botToken: string): string {
  return botToken.replace(/^Bot\s+/i, "").trim();
}

function buildApprovalCustomId(action: "approve" | "skip", commitSha: string): string {
  return `${APPROVAL_CUSTOM_ID_PREFIX}:${action}:${commitSha}`;
}

function parseApprovalCustomId(customId: string): { action: "approve" | "skip"; commitSha: string } | null {
  const [prefix, action, commitSha] = customId.split(":");
  if (prefix !== APPROVAL_CUSTOM_ID_PREFIX || (action !== "approve" && action !== "skip")) {
    return null;
  }

  if (!/^[a-f0-9]{40}$/i.test(commitSha)) {
    return null;
  }

  return { action, commitSha };
}

function trimGitSuffix(value: string): string {
  return value.replace(/\.git$/i, "");
}

function normalizeGitRemoteToWebUrl(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim();
  if (!trimmed) {
    return undefined;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      parsed.username = "";
      parsed.password = "";
      parsed.hash = "";
      parsed.search = "";
      parsed.pathname = trimGitSuffix(parsed.pathname);
      return parsed.toString().replace(/\/$/, "");
    } catch {
      return undefined;
    }
  }

  const sshMatch = trimmed.match(/^git@([^:]+):(.+)$/i);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${trimGitSuffix(sshMatch[2])}`;
  }

  const sshProtocolMatch = trimmed.match(/^ssh:\/\/git@([^/]+)\/(.+)$/i);
  if (sshProtocolMatch) {
    return `https://${sshProtocolMatch[1]}/${trimGitSuffix(sshProtocolMatch[2])}`;
  }

  return undefined;
}

function buildCommitUrl(repoWebUrl: string | undefined, commitSha: string): string | undefined {
  return repoWebUrl ? `${repoWebUrl}/commit/${commitSha}` : undefined;
}

function buildCompareUrl(repoWebUrl: string | undefined, previousCommitSha: string | null, commitSha: string): string | undefined {
  if (!repoWebUrl || !previousCommitSha || previousCommitSha === commitSha) {
    return undefined;
  }

  return `${repoWebUrl}/compare/${previousCommitSha}...${commitSha}`;
}

export class DiscordUpdatesSystem implements System {
  systemName = "DiscordUpdatesSystem";

  private config: ResolvedDiscordUpdatesConfig | null = null;
  private lastAnnouncedCommit: string | null = null;
  private nextPollAt = 0;
  private polling = false;
  private approvalClient: Client | null = null;

  async initAsync(_ctx: SystemContext): Promise<void> {
    const settingsObject = await Settings.get();
    const config = await this.resolveConfig(settingsObject);
    if (!config) {
      return;
    }

    if (config.approvalRequired) {
      const started = await this.startApprovalClient(config);
      if (!started) {
        return;
      }
    }

    this.config = config;
    this.lastAnnouncedCommit = await this.loadInitialCommit(config);
    this.nextPollAt = 0;
    await this.pollForUpdates();
  }

  async updateAsync(_ctx: SystemContext): Promise<void> {
    if (!this.config || this.polling) {
      return;
    }

    if (Date.now() < this.nextPollAt) {
      return;
    }

    this.nextPollAt = Date.now() + this.config.pollIntervalMs;
    await this.pollForUpdates();
  }

  private async startApprovalClient(config: ResolvedDiscordUpdatesConfig): Promise<boolean> {
    if (this.approvalClient) {
      return true;
    }

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.on("interactionCreate", (interaction) => {
      this.handleApprovalInteraction(interaction).catch((error) => {
        console.error("[discord-updates] Failed while handling approval interaction:", error);
      });
    });
    client.on("error", (error) => {
      console.error("[discord-updates] Discord approval client error:", error);
    });
    client.on("warn", (message) => {
      console.warn("[discord-updates] Discord approval client warning:", message);
    });

    try {
      await client.login(normalizeDiscordLoginToken(config.botToken));
      this.approvalClient = client;
      console.log("[discord-updates] Approval gate is enabled. Changelogs require Publish or Skip before advancing.");
      return true;
    } catch (error) {
      console.error("[discord-updates] Failed to start Discord approval client, disabling updates feed:", error);
      return false;
    }
  }

  private async handleApprovalInteraction(interaction: Interaction): Promise<void> {
    if (!interaction.isButton() || !this.config) {
      return;
    }

    const parsed = parseApprovalCustomId(interaction.customId);
    if (!parsed) {
      return;
    }

    if (!this.isApprovalInteractionAllowed(interaction)) {
      await interaction.reply({
        content: "You do not have permission to approve or skip changelog posts.",
        ephemeral: true,
      });
      return;
    }

    const state = this.readState(this.config.stateFilePath);
    const pendingApproval = state.pendingApproval;
    if (!pendingApproval || pendingApproval.commitSha !== parsed.commitSha) {
      await interaction.reply({
        content: "This changelog approval is no longer pending.",
        ephemeral: true,
      });
      return;
    }

    if (parsed.action === "skip") {
      this.lastAnnouncedCommit = pendingApproval.commitSha;
      this.persistState(this.config, pendingApproval.commitSha);
      await interaction.update({
        content: `Skipped by <@${interaction.user.id}>. This commit will not be posted.`,
        components: [],
      });
      console.log(`[discord-updates] Skipped update ${pendingApproval.commitSha.slice(0, 7)} after Discord approval action`);
      return;
    }

    await interaction.deferUpdate();
    const commitInfo = await this.getCommitInfo(this.config.repoPath, pendingApproval.commitSha);
    const sent = await this.postCommitUpdate(this.config, commitInfo, pendingApproval.previousCommitSha);
    if (!sent) {
      await interaction.followUp({
        content: "Discord rejected the changelog post. Check the server log before approving again.",
        ephemeral: true,
      });
      return;
    }

    this.lastAnnouncedCommit = pendingApproval.commitSha;
    this.persistState(this.config, pendingApproval.commitSha);
    await interaction.message.delete().catch(async (error) => {
      console.error("[discord-updates] Failed to delete published approval request:", error);
      await interaction.editReply({
        content: "",
        embeds: [],
        components: [],
      });
    });
  }

  private isApprovalInteractionAllowed(interaction: Interaction): boolean {
    if (!this.config) {
      return false;
    }

    const allowedUserIds = this.config.approvalAllowedUserIds;
    const allowedRoleIds = this.config.approvalAllowedRoleIds;
    if (allowedUserIds.length === 0 && allowedRoleIds.length === 0) {
      return (
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) === true ||
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) === true
      );
    }

    if (allowedUserIds.includes(interaction.user.id)) {
      return true;
    }

    const memberRoles = interaction.member?.roles;
    if (!memberRoles) {
      return false;
    }

    if (Array.isArray(memberRoles)) {
      return memberRoles.some((roleId) => allowedRoleIds.includes(roleId));
    }

    if ("cache" in memberRoles) {
      return allowedRoleIds.some((roleId) => memberRoles.cache.has(roleId));
    }

    return false;
  }

  private async resolveConfig(settingsObject: Settings): Promise<ResolvedDiscordUpdatesConfig | null> {
    const rawConfig = settingsObject.discordUpdates;
    if (!rawConfig) {
      return null;
    }

    const channelId = asNonEmptyString(rawConfig.channelId);
    if (!channelId) {
      console.warn("[discord-updates] discordUpdates.channelId is missing, skipping Discord updates feed");
      return null;
    }

    const botToken = asNonEmptyString(rawConfig.botToken) ?? asNonEmptyString(settingsObject.discordAuth?.botToken);
    if (!botToken) {
      console.warn("[discord-updates] No bot token found. Set discordUpdates.botToken or discordAuth.botToken.");
      return null;
    }

    const repoPath = await this.resolveRepoPath(rawConfig);
    if (!repoPath) {
      console.warn("[discord-updates] Could not resolve a git repository to watch, skipping Discord updates feed");
      return null;
    }

    const repoMetadata = await this.resolveRepoMetadata(repoPath);

    const dataDir = settingsObject.dataDir || "./data";
    const stateFilePath = path.resolve(
      asNonEmptyString(rawConfig.stateFilePath) ?? path.join(dataDir, "discord-updates-state.json")
    );

    return {
      botToken,
      channelId,
      approvalRequired: rawConfig.approvalRequired !== false,
      approvalChannelId: asNonEmptyString(rawConfig.approvalChannelId) ?? channelId,
      approvalAllowedUserIds: asStringArray(rawConfig.approvalAllowedUserIds),
      approvalAllowedRoleIds: asStringArray(rawConfig.approvalAllowedRoleIds),
      repoPath,
      pollIntervalMs: clampPositiveInteger(rawConfig.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS),
      maxCommitsPerPoll: clampPositiveInteger(rawConfig.maxCommitsPerPoll, DEFAULT_MAX_COMMITS_PER_POLL),
      maxFilesPerCommit: clampPositiveInteger(rawConfig.maxFilesPerCommit, DEFAULT_MAX_FILES_PER_COMMIT),
      mentionRoleId: asNonEmptyString(rawConfig.mentionRoleId),
      stateFilePath,
      announceInitialCommit: rawConfig.announceInitialCommit === true,
      repoDisplayName: repoMetadata.repoDisplayName,
      branchName: repoMetadata.branchName,
      repoWebUrl: repoMetadata.repoWebUrl,
    };
  }

  private async resolveRepoPath(rawConfig: DiscordUpdatesSettings): Promise<string | null> {
    const repoCandidate = path.resolve(asNonEmptyString(rawConfig.repoPath) ?? process.cwd());

    try {
      const stdout = await this.runGitCommand(repoCandidate, ["rev-parse", "--show-toplevel"]);
      const repoRoot = stdout.trim();
      return repoRoot.length > 0 ? repoRoot : null;
    } catch (error) {
      console.error("[discord-updates] Failed to resolve git repository root:", error);
      return null;
    }
  }

  private async resolveRepoMetadata(repoPath: string): Promise<{ repoDisplayName: string; branchName: string; repoWebUrl?: string }> {
    let branchName = "HEAD";
    let repoWebUrl: string | undefined;

    try {
      const branchOutput = await this.runGitCommand(repoPath, ["rev-parse", "--abbrev-ref", "HEAD"]);
      branchName = branchOutput.trim() || branchName;
    } catch (error) {
      console.warn("[discord-updates] Failed to resolve branch name, falling back to HEAD:", error);
    }

    try {
      const remoteOutput = await this.runGitCommand(repoPath, ["remote", "get-url", "origin"]);
      repoWebUrl = normalizeGitRemoteToWebUrl(remoteOutput);
    } catch {
      repoWebUrl = undefined;
    }

    return {
      repoDisplayName: path.basename(repoPath),
      branchName,
      repoWebUrl,
    };
  }

  private async loadInitialCommit(config: ResolvedDiscordUpdatesConfig): Promise<string | null> {
    const currentHead = await this.getHeadCommit(config.repoPath);
    if (!currentHead) {
      return null;
    }

    const state = this.readState(config.stateFilePath);
    if (state.repoPath === config.repoPath && state.lastAnnouncedCommit) {
      return state.lastAnnouncedCommit;
    }

    if (config.announceInitialCommit) {
      console.log(
        `[discord-updates] No prior state found. Current HEAD ${currentHead.slice(0, 7)} will be announced on the first poll.`
      );
      return null;
    }

    this.persistState(config, currentHead);
    console.log(`[discord-updates] Initialized at ${currentHead.slice(0, 7)}. Existing history will not be announced.`);
    return currentHead;
  }

  private async pollForUpdates(): Promise<void> {
    if (!this.config || this.polling) {
      return;
    }

    this.polling = true;

    try {
      const currentHead = await this.getHeadCommit(this.config.repoPath);
      if (!currentHead) {
        return;
      }

      if (!this.lastAnnouncedCommit) {
        if (this.config.announceInitialCommit) {
          const initialCommitInfo = await this.getCommitInfo(this.config.repoPath, currentHead);
          const result = await this.publishOrRequestApproval(this.config, initialCommitInfo, null);
          if (result !== "published") {
            return;
          }
        }

        this.lastAnnouncedCommit = currentHead;
        this.persistState(this.config, currentHead);
        return;
      }

      if (currentHead === this.lastAnnouncedCommit) {
        return;
      }

      const isAncestor = await this.isAncestorCommit(this.config.repoPath, this.lastAnnouncedCommit, currentHead);
      if (!isAncestor) {
        console.warn(
          `[discord-updates] Stored commit ${this.lastAnnouncedCommit.slice(0, 7)} is no longer reachable from HEAD. Resetting feed state.`
        );
        this.lastAnnouncedCommit = currentHead;
        this.persistState(this.config, currentHead);
        return;
      }

      const commitShas = await this.getNewCommitShas(
        this.config.repoPath,
        this.lastAnnouncedCommit,
        currentHead,
        this.config.maxCommitsPerPoll
      );

      for (const commitSha of commitShas) {
        const commitInfo = await this.getCommitInfo(this.config.repoPath, commitSha);
        const result = await this.publishOrRequestApproval(this.config, commitInfo, this.lastAnnouncedCommit);
        if (result !== "published") {
          return;
        }

        this.lastAnnouncedCommit = commitSha;
        this.persistState(this.config, commitSha);
      }

      if (this.lastAnnouncedCommit !== currentHead) {
        console.log("[discord-updates] Additional commits remain queued and will be posted on the next poll.");
      }
    } catch (error) {
      console.error("[discord-updates] Failed while polling for updates:", error);
    } finally {
      this.polling = false;
    }
  }

  private async publishOrRequestApproval(
    config: ResolvedDiscordUpdatesConfig,
    commitInfo: CommitInfo,
    previousCommitSha: string | null
  ): Promise<"published" | "waiting" | "failed"> {
    if (!config.approvalRequired) {
      return (await this.postCommitUpdate(config, commitInfo, previousCommitSha)) ? "published" : "failed";
    }

    return (await this.requestCommitApproval(config, commitInfo, previousCommitSha)) ? "waiting" : "failed";
  }

  private async requestCommitApproval(
    config: ResolvedDiscordUpdatesConfig,
    commitInfo: CommitInfo,
    previousCommitSha: string | null
  ): Promise<boolean> {
    const state = this.readState(config.stateFilePath);
    if (state.pendingApproval?.commitSha === commitInfo.sha) {
      console.log(`[discord-updates] Update ${commitInfo.sha.slice(0, 7)} is already waiting for approval`);
      return true;
    }

    if (state.pendingApproval) {
      console.log(
        `[discord-updates] Update ${state.pendingApproval.commitSha.slice(0, 7)} is still waiting for approval; not requesting another one yet`
      );
      return true;
    }

    const response = await fetch(`https://discord.com/api/channels/${config.approvalChannelId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": normalizeDiscordAuthorization(config.botToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.buildApprovalRequestPayload(config, commitInfo, previousCommitSha)),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(
        `[discord-updates] Discord rejected approval request ${commitInfo.sha.slice(0, 7)}: ${response.status} ${responseText}`
      );
      return false;
    }

    const message = (await response.json()) as { id?: string };
    if (!message.id) {
      console.error(`[discord-updates] Discord approval request ${commitInfo.sha.slice(0, 7)} did not return a message id`);
      return false;
    }

    this.persistState(config, this.lastAnnouncedCommit, {
      commitSha: commitInfo.sha,
      previousCommitSha,
      channelId: config.approvalChannelId,
      messageId: message.id,
    });
    console.log(`[discord-updates] Requested approval for update ${commitInfo.sha.slice(0, 7)}`);
    return true;
  }

  private readState(stateFilePath: string): DiscordUpdatesState {
    try {
      if (!fs.existsSync(stateFilePath)) {
        return {};
      }

      const raw = fs.readFileSync(stateFilePath, "utf8");
      const parsed = JSON.parse(raw) as DiscordUpdatesState;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.error("[discord-updates] Failed to read state file:", error);
      return {};
    }
  }

  private persistState(
    config: ResolvedDiscordUpdatesConfig,
    commitSha: string | null,
    pendingApproval?: PendingApprovalState | null
  ): void {
    try {
      const state: DiscordUpdatesState = {
        repoPath: config.repoPath,
      };

      if (commitSha) {
        state.lastAnnouncedCommit = commitSha;
      }

      if (pendingApproval) {
        state.pendingApproval = pendingApproval;
      }

      fs.mkdirSync(path.dirname(config.stateFilePath), { recursive: true });
      fs.writeFileSync(config.stateFilePath, JSON.stringify(state, null, 2), "utf8");
    } catch (error) {
      console.error("[discord-updates] Failed to persist state file:", error);
    }
  }

  private async getHeadCommit(repoPath: string): Promise<string | null> {
    try {
      const stdout = await this.runGitCommand(repoPath, ["rev-parse", "HEAD"]);
      const headCommit = stdout.trim();
      return headCommit.length > 0 ? headCommit : null;
    } catch (error) {
      console.error("[discord-updates] Failed to resolve HEAD commit:", error);
      return null;
    }
  }

  private async isAncestorCommit(repoPath: string, olderCommit: string, newerCommit: string): Promise<boolean> {
    try {
      await this.runGitCommand(repoPath, ["merge-base", "--is-ancestor", olderCommit, newerCommit]);
      return true;
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code === 1) {
        return false;
      }

      throw error;
    }
  }

  private async getNewCommitShas(
    repoPath: string,
    fromCommitExclusive: string,
    toCommitInclusive: string,
    maxCount: number
  ): Promise<string[]> {
    const stdout = await this.runGitCommand(repoPath, [
      "rev-list",
      "--reverse",
      `--max-count=${maxCount}`,
      `${fromCommitExclusive}..${toCommitInclusive}`,
    ]);

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private async getCommitInfo(repoPath: string, commitSha: string): Promise<CommitInfo> {
    const detailsOutput = await this.runGitCommand(repoPath, [
      "show",
      "--quiet",
      "--format=%H%x1f%s%x1f%an%x1f%at%x1f%b",
      commitSha,
    ]);

    const [sha, subject, author, unixTimestampRaw, body = ""] = detailsOutput.split("\u001f");

    const filesOutput = await this.runGitCommand(repoPath, [
      "show",
      "--pretty=",
      "--name-only",
      "--diff-filter=ACDMRT",
      commitSha,
    ]);

    const files = filesOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return {
      sha: sha.trim(),
      subject: subject.trim(),
      author: author.trim(),
      unixTimestamp: Number.parseInt(unixTimestampRaw.trim(), 10) || Math.floor(Date.now() / 1000),
      body: body.trim(),
      files,
    };
  }

  private async postCommitUpdate(
    config: ResolvedDiscordUpdatesConfig,
    commitInfo: CommitInfo,
    previousCommitSha: string | null
  ): Promise<boolean> {
    const response = await fetch(`https://discord.com/api/channels/${config.channelId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": normalizeDiscordAuthorization(config.botToken),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(this.buildCommitUpdatePayload(config, commitInfo, previousCommitSha)),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[discord-updates] Discord rejected update ${commitInfo.sha.slice(0, 7)}: ${response.status} ${responseText}`);
      return false;
    }

    console.log(`[discord-updates] Posted update ${commitInfo.sha.slice(0, 7)} to Discord`);
    return true;
  }

  private buildCommitUpdatePayload(
    config: ResolvedDiscordUpdatesConfig,
    commitInfo: CommitInfo,
    previousCommitSha: string | null
  ): DiscordMessagePayload {
    return {
      content: config.mentionRoleId ? `<@&${config.mentionRoleId}>` : undefined,
      allowed_mentions: {
        parse: [],
        roles: config.mentionRoleId ? [config.mentionRoleId] : [],
      },
      embeds: [this.buildCommitEmbed(config, commitInfo, previousCommitSha, false)],
    };
  }

  private buildApprovalRequestPayload(
    config: ResolvedDiscordUpdatesConfig,
    commitInfo: CommitInfo,
    previousCommitSha: string | null
  ): DiscordMessagePayload {
    return {
      content: "Approve this changelog before it goes public.",
      allowed_mentions: {
        parse: [],
      },
      embeds: [this.buildCommitEmbed(config, commitInfo, previousCommitSha, true)],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 3,
              custom_id: buildApprovalCustomId("approve", commitInfo.sha),
              label: "Publish",
            },
            {
              type: 2,
              style: 4,
              custom_id: buildApprovalCustomId("skip", commitInfo.sha),
              label: "Skip",
            },
          ],
        },
      ],
    };
  }

  private buildCommitEmbed(
    config: ResolvedDiscordUpdatesConfig,
    commitInfo: CommitInfo,
    previousCommitSha: string | null,
    approvalPreview: boolean
  ): Record<string, unknown> {
    const commitBody = truncateText(commitInfo.body, 700);
    const commitUrl = buildCommitUrl(config.repoWebUrl, commitInfo.sha);
    const compareUrl = buildCompareUrl(config.repoWebUrl, previousCommitSha, commitInfo.sha);
    const commitValue = commitUrl
      ? `[\`${commitInfo.sha.slice(0, 7)}\`](${commitUrl})`
      : `\`${commitInfo.sha.slice(0, 7)}\``;
    const changeSummary = summarizeChangeAreas(commitInfo.files);

    return {
      title: approvalPreview
        ? `Pending changelog approval: ${truncateText(commitInfo.subject || "Repository updated", 220)}`
        : truncateText(commitInfo.subject || "Repository updated", 256),
      url: commitUrl,
      description: commitBody || "A new commit was detected in the live server repository.",
      color: approvalPreview ? 0xd9a441 : DISCORD_EMBED_COLOR,
      author: {
        name: FEED_DISPLAY_NAME,
        url: config.repoWebUrl,
      },
      fields: [
        {
          name: "Commit",
          value: commitValue,
          inline: true,
        },
        {
          name: "Branch",
          value: truncateText(config.branchName, 64),
          inline: true,
        },
        {
          name: "When",
          value: `<t:${commitInfo.unixTimestamp}:f>`,
          inline: true,
        },
        ...(compareUrl
          ? [
              {
                name: "Diff",
                value: `[View compare](${compareUrl})`,
                inline: true,
              },
            ]
          : []),
        {
          name: "Related changes",
          value: changeSummary.significant,
        },
        ...(changeSummary.qualityOfLife
          ? [
              {
                name: "Quality of life",
                value: changeSummary.qualityOfLife,
              },
            ]
          : []),
        {
          name: "Scope",
          value: changeSummary.scope,
        },
      ],
      footer: {
        text: approvalPreview ? `${FEED_DISPLAY_NAME} - waiting for approval` : FEED_DISPLAY_NAME,
      },
    };
  }

  private async runGitCommand(repoPath: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("git", ["-C", repoPath, ...args], {
      maxBuffer: 1024 * 1024,
    });

    return stdout;
  }
}
