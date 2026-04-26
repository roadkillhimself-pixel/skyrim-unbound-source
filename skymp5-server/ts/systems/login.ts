import { System, Log, Content, SystemContext } from "./system";
import { Settings } from "../settings";
import * as fetchRetry from "fetch-retry";
import { loginsCounter, loginErrorsCounter } from "./metricsSystem";
import {
  beginUcpCharacterPlaytime,
  finishUcpCharacterPlaytime,
  resolveUcpPlaySession,
} from "../ucp";
import type { ResolvedUcpPlaySession } from "../ucp";

const INVALID_USER_ID = 65535;
const loginFailedNotInTheDiscordServer = JSON.stringify({ customPacketType: "loginFailedNotInTheDiscordServer" });
const loginFailedBanned = JSON.stringify({ customPacketType: "loginFailedBanned" });
const loginFailedIpMismatch = JSON.stringify({ customPacketType: "loginFailedIpMismatch" });
const loginFailedSessionNotFound = JSON.stringify({ customPacketType: "loginFailedSessionNotFound" });
const gracefulDisconnectCustomPacketType = "gracefulDisconnect";
const runtimeModIndex = 255;
const chatAnnouncementColor = "#f8f2df";

type Mp = any; // TODO

interface UserProfile {
  id: number;
  discordId: string | null;
}

namespace DiscordErrors {
  export const unknownMember = 10007;
}

// See also NetworkingCombined.h
// In NetworkingCombined.h, we implement a hack to prevent the soul-transmission bug
// TODO: reimplement Login system. Preferably, in C++ with clear data flow.
export class Login implements System {
  systemName = "Login";

  constructor(
    private log: Log,
    private maxPlayers: number,
    private masterUrl: string | null,
    private serverPort: number,
    private masterKey: string,
    private offlineMode: boolean
  ) { }

  private getFetchOptions(callerFunctionName: string) {
    return {
      // retry on any network error, or 5xx status codes
      retryOn: (attempt: number, error: Error | null, response: Response) => {
        const retry = error !== null || response.status >= 500;
        if (retry) {
          console.log(`${callerFunctionName}: retrying request ${JSON.stringify({ attempt, error, status: response.status })}`);
        }
        return retry;
      },
      retries: 10
    };
  }

  private async getUserProfile(session: string, userId: number, ctx: SystemContext): Promise<UserProfile> {
    const response = await this.fetchRetry(
      `${this.masterUrl}/api/servers/${this.masterKey}/sessions/${session}`,
      this.getFetchOptions('getUserProfile')
    );

    if (!response.ok) {
      if (response.status === 404) {
        ctx.svr.sendCustomPacket(userId, loginFailedSessionNotFound);
      }
      throw new Error(`getUserProfile: HTTP error ${response.status}`);
    }

    const data = await response.json();

    if (!data || !data.user || !data.user.id) {
      throw new Error(`getUserProfile: bad master-api response ${JSON.stringify(data)}`);
    }

    return data.user as UserProfile;
  }

  async initAsync(ctx: SystemContext): Promise<void> {
    this.settingsObject = await Settings.get();

    this.log(
      `Login system assumed that ${this.masterKey} is our master api key`
    );
  }

  connect(userId: number): void {
    this.gracefulDisconnectUserIds.delete(userId);
    this.clearAccountSessionForUser(userId);
  }

  disconnect(userId: number, ctx: SystemContext): void {
    this.clearAccountSessionForUser(userId);

    const mp = ctx.svr as unknown as Mp;
    const actorId = mp.getUserActor(userId);
    if (!actorId) {
      this.gracefulDisconnectUserIds.delete(userId);
      return;
    }

    const actorName = this.getActorName(mp, actorId);
    if (!actorName) {
      this.gracefulDisconnectUserIds.delete(userId);
      return;
    }

    const gracefulDisconnect = this.gracefulDisconnectUserIds.has(userId);
    this.gracefulDisconnectUserIds.delete(userId);

    const announcement = gracefulDisconnect
      ? `(( ${actorName} has disconnected. ))`
      : `(( ${actorName} has timed out. ))`;

    this.sendDisconnectAnnouncement(mp, userId, announcement);
  }

  customPacket(
    userId: number,
    type: string,
    content: Content,
    ctx: SystemContext,
  ): void {
    if (type === gracefulDisconnectCustomPacketType) {
      this.gracefulDisconnectUserIds.add(userId);
      this.log(`${userId} requested graceful disconnect`);
      return;
    }

    if (type !== "loginWithSkympIo") {
      return;
    }

    const ip = ctx.svr.getUserIp(userId);
    console.log(`Connecting a user ${userId} with ip ${ip}`);

    let discordAuth = this.settingsObject.discordAuth;

    const gameData = content["gameData"];
    if (this.offlineMode === true && gameData && gameData.session) {
      this.log("The server is in offline mode, the client is NOT");
    } else if (this.offlineMode === false && gameData && gameData.session) {
      const localPlaySession = resolveUcpPlaySession(this.settingsObject, String(gameData.session), this.masterKey);
      if (localPlaySession) {
        if (!this.registerAccountSession(userId, `ucp-account:${localPlaySession.accountId}`, ctx)) {
          return;
        }
        this.beginUcpPlaytimeForUser(userId, localPlaySession);
        this.emit(ctx, "spawnAllowed", userId, localPlaySession.profileId, [], undefined);
        loginsCounter.inc();
        this.log(`${userId} logged as ${localPlaySession.profileId} via UCP character ${localPlaySession.characterId}`);
        return;
      }

      (async () => {
        this.emit(ctx, "userAssignSession", userId, gameData.session);

        const guidBeforeAsyncOp = ctx.svr.getUserGuid(userId);
        const profile = await this.getUserProfile(gameData.session, userId, ctx);
        const guidAfterAsyncOp = ctx.svr.isConnected(userId) ? ctx.svr.getUserGuid(userId) : "<disconnected>";

        console.log({ guidBeforeAsyncOp, guidAfterAsyncOp, op: "getUserProfile" });

        if (guidBeforeAsyncOp !== guidAfterAsyncOp) {
          console.error(`User ${userId} changed guid from ${guidBeforeAsyncOp} to ${guidAfterAsyncOp} during async getUserProfile`);
          throw new Error("Guid mismatch after getUserProfile");
        }

        console.log("getUserProfileId:", profile);

        if (discordAuth && !discordAuth.botToken) {
          discordAuth = undefined;
          console.error("discordAuth.botToken is missing, skipping Discord server integration");
        }
        if (discordAuth && !discordAuth.guildId) {
          discordAuth = undefined;
          console.error("discordAuth.guildId is missing, skipping Discord server integration");
        }

        let roles = new Array<string>();

        if (discordAuth && profile.discordId) {
          const guidBeforeAsyncOp = ctx.svr.getUserGuid(userId);
          const response = await this.fetchRetry(
            `https://discord.com/api/guilds/${discordAuth.guildId}/members/${profile.discordId}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `${discordAuth.botToken}`,
              },
              ... this.getFetchOptions('discordAuth1'),
            },
          );
          const responseData = response.ok ? await response.json() : null;
          const guidAfterAsyncOp = ctx.svr.isConnected(userId) ? ctx.svr.getUserGuid(userId) : "<disconnected>";

          console.log({ guidBeforeAsyncOp, guidAfterAsyncOp, op: "Discord request" });

          if (guidBeforeAsyncOp !== guidAfterAsyncOp) {
            console.error(`User ${userId} changed guid from ${guidBeforeAsyncOp} to ${guidAfterAsyncOp} during async Discord request`);
            throw new Error("Guid mismatch after Discord request");
          }

          const mp = ctx.svr as unknown as Mp;

          // TODO: what if more characters
          const actorId = ctx.svr.getActorsByProfileId(profile.id)[0];

          const receivedRoles: string[] | null = (responseData && Array.isArray(responseData.roles)) ? responseData.roles : null;
          const currentRoles: string[] | null = actorId ? mp.get(actorId, "private.discordRoles") : null;
          roles = receivedRoles || currentRoles || [];

          console.log('Discord request:', JSON.stringify({ status: response.status, data: responseData }));

          if (response.status === 404 && responseData?.code === DiscordErrors.unknownMember) {
            ctx.svr.sendCustomPacket(userId, loginFailedNotInTheDiscordServer);
            throw new Error("Not in the Discord server");
          }

          // TODO: enable logging instead of throw
          // Disabled this check to be able bypassing ratelimit
          // if (response.status !== 200) {
          //   throw new Error("Unexpected response status: " +
          //     JSON.stringify({ status: response.status, data: response.data }));
          // }

          // TODO: remove this legacy discord-based ban system
          if (roles.indexOf(discordAuth.banRoleId) !== -1) {
            ctx.svr.sendCustomPacket(userId, loginFailedBanned);
            throw new Error("Banned");
          }
        }

        if ((ctx.svr as any).onLoginAttempt) {
          const isContinue = (ctx.svr as any).onLoginAttempt(profile.id);
          if (!isContinue) {
            ctx.svr.sendCustomPacket(userId, loginFailedBanned);
            throw new Error("Banned by gamemode");
          }
        }

        if (discordAuth && profile.discordId) {
          if (ip !== ctx.svr.getUserIp(userId)) {
            // It's a quick and dirty way to check if it's the same user
            // During async http call the user could free userId and someone else could connect with the same userId
            ctx.svr.sendCustomPacket(userId, loginFailedIpMismatch);
            throw new Error("IP mismatch");
          }
        }

        if (discordAuth && discordAuth.eventLogChannelId) {
          let ipToPrint = ip;

          if (discordAuth && discordAuth.hideIpRoleId) {
            if (roles.indexOf(discordAuth.hideIpRoleId) !== -1) {
              ipToPrint = "hidden";
            }
          }

          const actorIds = ctx.svr.getActorsByProfileId(profile.id).map(actorId => actorId.toString(16));

          this.postServerLoginToDiscord(discordAuth.eventLogChannelId, discordAuth.botToken, {
            userId,
            ipToPrint,
            actorIds,
            profile,
          });
        }

        if (!this.registerAccountSession(userId, `master-profile:${profile.id}`, ctx)) {
          return;
        }

        this.emit(ctx, "spawnAllowed", userId, profile.id, roles, profile.discordId);
        loginsCounter.inc();
        this.log("Logged as " + profile.id);
      })()
        .catch((err) => {
          loginErrorsCounter.inc({ reason: err?.message || "unknown" });
          console.error("Error logging in client:", JSON.stringify(gameData), err)
        });
    } else if (this.offlineMode === true && gameData && typeof gameData.profileId === "number") {
      const profileId = gameData.profileId;
      if (!this.registerAccountSession(userId, `offline-profile:${profileId}`, ctx)) {
        return;
      }
      this.emit(ctx, "spawnAllowed", userId, profileId, [], undefined);
      loginsCounter.inc();
      this.log(userId + " logged as " + profileId);
    } else {
      this.log("No credentials found in gameData:", gameData);
    }
  }

  private postServerLoginToDiscord(eventLogChannelId: string, botToken: string, options: { userId: number, ipToPrint: string, actorIds: string[], profile: UserProfile }) {
    const { userId, ipToPrint, actorIds, profile } = options;

    const loginMessage = `Server Login: Server Slot ${userId}, IP ${ipToPrint}, Actor ID ${actorIds}, Master API ${profile.id}, Discord ID ${profile.discordId} <@${profile.discordId}>`;
    console.log(loginMessage);

    this.fetchRetry(`https://discord.com/api/channels/${eventLogChannelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: loginMessage,
        allowed_mentions: { parse: [] },
      }),
      ... this.getFetchOptions('discordAuth2'),
    }).then((response) => {
      if (!response.ok) {
        throw new Error(`Error sending message to Discord: ${response.statusText}`);
      }
      return response.json();
    }).then((_data): null => {
      return null;
    }).catch((err) => {
      console.error("Error sending message to Discord:", err);
    });
  }

  private getActorName(mp: Mp, actorId: number): string {
    try {
      const name = mp.getActorName(actorId);
      if (typeof name === "string") {
        const trimmed = name.trim();
        if (trimmed) {
          return trimmed;
        }
      }
    } catch (err) {
      console.error("Failed to get actor name for disconnect announcement:", err);
    }

    return "";
  }

  private sendDisconnectAnnouncement(mp: Mp, disconnectedUserId: number, text: string): void {
    const payload = JSON.stringify({
      seq: ++this.disconnectAnnouncementSeq,
      text,
      color: chatAnnouncementColor,
      createdAt: new Date().toISOString(),
    });

    const seenUserIds = new Set<number>();
    const forms = this.getRuntimeForms(mp);

    for (const formId of forms) {
      let connectedUserId: number;
      try {
        connectedUserId = mp.getUserByActor(formId);
      } catch (err) {
        console.error("Failed to resolve disconnect announcement recipient:", err);
        continue;
      }

      if (!Number.isInteger(connectedUserId) || connectedUserId === INVALID_USER_ID) {
        continue;
      }

      if (connectedUserId === disconnectedUserId || seenUserIds.has(connectedUserId)) {
        continue;
      }

      seenUserIds.add(connectedUserId);

      try {
        mp.set(formId, "ff_chatMsg", payload);
      } catch (err) {
        console.error("Failed to send disconnect announcement:", err);
        continue;
      }

      setTimeout(() => {
        try {
          if (mp.get(formId, "ff_chatMsg") !== payload) {
            return;
          }
          mp.set(formId, "ff_chatMsg", "");
        } catch {
          // Best-effort cleanup only.
        }
      }, 2000);
    }
  }

  private getRuntimeForms(mp: Mp): number[] {
    try {
      const forms = mp.getAllForms(runtimeModIndex);
      return Array.isArray(forms) ? forms : [];
    } catch (err) {
      console.error("Failed to enumerate runtime forms for disconnect announcement:", err);
      return [];
    }
  }

  private emit(ctx: SystemContext, eventName: string, ...args: unknown[]) {
    (ctx.gm as any).emit(eventName, ...args);
  }

  private registerAccountSession(userId: number, accountKey: string, ctx: SystemContext): boolean {
    this.clearAccountSessionForUser(userId);

    const activeUserIds = this.accountSessionsByKey.get(accountKey) || new Set<number>();
    const conflictingUserIds = Array.from(activeUserIds).filter(
      (existingUserId) => existingUserId !== userId && ctx.svr.isConnected(existingUserId)
    );

    if (!conflictingUserIds.length) {
      activeUserIds.add(userId);
      this.accountSessionsByKey.set(accountKey, activeUserIds);
      this.accountKeyByUserId.set(userId, accountKey);
      return true;
    }

    const kickedUserIds = Array.from(new Set<number>([userId, ...conflictingUserIds]));
    this.log(
      `Duplicate account session detected for ${accountKey}, kicking userIds ${kickedUserIds.join(", ")}`
    );

    for (const kickedUserId of kickedUserIds) {
      this.clearAccountSessionForUser(kickedUserId);
    }

    for (const kickedUserId of kickedUserIds) {
      if (!ctx.svr.isConnected(kickedUserId)) {
        continue;
      }

      try {
        ctx.svr.kick(kickedUserId);
      } catch (err) {
        console.error(`Failed to kick duplicate account session ${kickedUserId}:`, err);
      }
    }

    return false;
  }

  private clearAccountSessionForUser(userId: number): void {
    this.finishUcpPlaytimeForUser(userId);

    const accountKey = this.accountKeyByUserId.get(userId);
    if (!accountKey) {
      return;
    }

    this.accountKeyByUserId.delete(userId);

    const activeUserIds = this.accountSessionsByKey.get(accountKey);
    if (!activeUserIds) {
      return;
    }

    activeUserIds.delete(userId);
    if (!activeUserIds.size) {
      this.accountSessionsByKey.delete(accountKey);
    }
  }

  private beginUcpPlaytimeForUser(userId: number, playSession: ResolvedUcpPlaySession): void {
    try {
      beginUcpCharacterPlaytime(this.settingsObject, playSession.accountId, playSession.characterId);
      this.ucpPlaytimeByUserId.set(userId, {
        accountId: playSession.accountId,
        characterId: playSession.characterId,
      });
    } catch (err) {
      console.error(`Failed to begin UCP playtime tracking for userId ${userId}:`, err);
    }
  }

  private finishUcpPlaytimeForUser(userId: number): void {
    const playtime = this.ucpPlaytimeByUserId.get(userId);
    if (!playtime) {
      return;
    }

    this.ucpPlaytimeByUserId.delete(userId);

    try {
      finishUcpCharacterPlaytime(this.settingsObject, playtime.accountId, playtime.characterId);
    } catch (err) {
      console.error(`Failed to finish UCP playtime tracking for userId ${userId}:`, err);
    }
  }

  private gracefulDisconnectUserIds = new Set<number>();
  private disconnectAnnouncementSeq = 0;
  private accountKeyByUserId = new Map<number, string>();
  private accountSessionsByKey = new Map<string, Set<number>>();
  private ucpPlaytimeByUserId = new Map<number, { accountId: number; characterId: number }>();
  private settingsObject: Settings;
  private fetchRetry = fetchRetry.default(global.fetch);
}
