import * as crypto from "crypto";
import { AuthGameData, RemoteAuthGameData, authGameDataStorageKey } from "../../features/authModel";
import { FunctionInfo } from "../../lib/functionInfo";
import { ClientListener, CombinedController, Sp } from "./clientListener";
import { BrowserMessageEvent, Menu, browser } from "skyrimPlatform";
import { AuthNeededEvent } from "../events/authNeededEvent";
import { BrowserWindowLoadedEvent } from "../events/browserWindowLoadedEvent";
import { TimersService } from "./timersService";
import { MasterApiAuthStatus } from "../messages_http/masterApiAuthStatus";
import { logTrace, logError } from "../../logging";
import { ConnectionMessage } from "../events/connectionMessage";
import { CreateActorMessage } from "../messages/createActorMessage";
import { CustomPacketMessage } from "../messages/customPacketMessage";
import { NetworkingService } from "./networkingService";
import { MsgType } from "../../messages";
import { ConnectionDenied } from "../events/connectionDenied";
import { ConnectionFailed } from "../events/connectionFailed";
import { SettingsService } from "./settingsService";

// for browsersideWidgetSetter
declare const window: any;
declare const document: any;

// Constants used on both client and browser side (see browsersideWidgetSetter)
const events = {
  openDiscordOauth: 'openDiscordOauth',
  authAttempt: 'authAttemptEvent',
  openGithub: 'openGithub',
  openPatreon: 'openPatreon',
  clearAuthData: 'clearAuthData',
  updateRequired: 'updateRequired',
  backToLogin: 'backToLogin',
  joinDiscord: 'joinDiscord',
  ucpLogin: 'ucpLogin',
  ucpCreateCharacter: 'ucpCreateCharacter',
  ucpSelectCharacter: 'ucpSelectCharacter',
  ucpPlay: 'ucpPlay',
  ucpLogout: 'ucpLogout',
  ucpOpenWebsite: 'ucpOpenWebsite',
  ucpExitGame: 'ucpExitGame'
};

// Vaiables used on both client and browser side (see browsersideWidgetSetter)
let browserState = {
  comment: '',
  failCount: 9000,
  loginFailedReason: '',
};
let authData: RemoteAuthGameData | null = null;
let authUiState: Record<string, unknown> | null = null;

const clearAuthOverlayEventString = `
  (function() {
    var root = document.getElementById('skw-auth-root');
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
  })();
`;

const clearGameplaySurfaceEventString = `
  (function() {
    try {
      var html = document.documentElement;
      var head = document.head || html || document.body;
      var style = document.getElementById('skw-gameplay-surface-clear-style');
      if (!style && head) {
        style = document.createElement('style');
        style.id = 'skw-gameplay-surface-clear-style';
        style.textContent = [
          'html, body, #root {',
          '  background: transparent !important;',
          '  background-color: transparent !important;',
          '  background-image: none !important;',
          '}',
          'html::before, html::after, body::before, body::after, #root::before, #root::after {',
          '  display: none !important;',
          '  content: none !important;',
          '}',
          '.login, .login-form, [class^="login-form--"], [class*=" login-form--"],',
          '#skw-auth-root, #skw-auth-bootstrap-cover {',
          '  display: none !important;',
          '  visibility: hidden !important;',
          '  opacity: 0 !important;',
          '  pointer-events: none !important;',
          '}'
        ].join('');
        head.appendChild(style);
      }

      if (html) {
        html.style.background = 'transparent';
        html.style.backgroundColor = 'transparent';
        html.style.backgroundImage = 'none';
      }

      if (document.body) {
        document.body.style.background = 'transparent';
        document.body.style.backgroundColor = 'transparent';
        document.body.style.backgroundImage = 'none';
      }

      var root = document.getElementById('root');
      if (root) {
        root.style.background = 'transparent';
        root.style.backgroundColor = 'transparent';
        root.style.backgroundImage = 'none';
        root.innerHTML = '';
      }
    } catch (e) {}
  })();
`;

const showAuthBootstrapCoverEventString = `
  (function() {
    try {
      var style = document.getElementById('skw-auth-bootstrap-cover-style');
      if (style && style.parentNode) {
        style.parentNode.removeChild(style);
      }

      var cover = document.getElementById('skw-auth-bootstrap-cover');
      if (cover && cover.parentNode) {
        cover.parentNode.removeChild(cover);
      }

      var html = document.documentElement;
      if (html) {
        html.style.background = 'transparent';
        html.style.backgroundColor = 'transparent';
        html.style.backgroundImage = 'none';
      }

      if (document.body) {
        document.body.style.background = 'transparent';
        document.body.style.backgroundColor = 'transparent';
        document.body.style.backgroundImage = 'none';
      }

      var root = document.getElementById('root');
      if (root) {
        root.style.background = 'transparent';
        root.style.backgroundColor = 'transparent';
        root.style.backgroundImage = 'none';
      }
    } catch (e) {}
  })();
`;

export class AuthService extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();
    this.recordAuthUiDebug("constructor");

    this.controller.emitter.on("authNeeded", (e) => this.onAuthNeeded(e));
    this.controller.emitter.on("browserWindowLoaded", (e) => this.onBrowserWindowLoaded(e));
    this.controller.emitter.on("createActorMessage", (e) => this.onCreateActorMessage(e));
    this.controller.emitter.on("connectionAccepted", () => this.handleConnectionAccepted());
    this.controller.emitter.on("connectionDenied", (e) => this.handleConnectionDenied(e));
    this.controller.emitter.on("connectionFailed", (e) => this.handleConnectionFailed(e));
    this.controller.emitter.on("customPacketMessage", (e) => this.onCustomPacketMessage(e));
    this.controller.on("browserMessage", (e) => this.onBrowserMessage(e));
    this.controller.on("tick", () => this.onTick());
    this.controller.once("update", () => this.onceUpdate());
  }

  private onAuthNeeded(e: AuthNeededEvent) {
    logTrace(this, `Received authNeeded event`);
    this.recordAuthUiDebug("authNeeded");

    const settingsGameData = this.sp.settings["skymp5-client"]["gameData"] as any;
    const isOfflineMode = Number.isInteger(settingsGameData?.profileId);
    if (isOfflineMode) {
      logTrace(this, `Offline mode detected in settings, emitting auth event with authGameData.local`);
      this.controller.emitter.emit("authAttempt", { authGameData: { local: { profileId: settingsGameData.profileId } } });
    } else {
      logTrace(this, `No offline mode detectted in settings, regular auth needed`);
      this.setListenBrowserMessage(true, 'authNeeded event received');

      this.trigger.authNeededFired = true;
      this.startOnlineAuthBootstrap("authNeeded");
    }
  }

  private onBrowserWindowLoaded(e: BrowserWindowLoadedEvent) {
    logTrace(this, `Received browserWindowLoaded event`);
    this.recordAuthUiDebug("browserWindowLoaded");

    const hadBrowserWindowLoaded = this.trigger.browserWindowLoadedFired;
    this.trigger.browserWindowLoadedFired = true;
    if (!this.controller.lookupListener(NetworkingService).isConnected()) {
      this.setListenBrowserMessage(true, 'browserWindowLoaded while disconnected');
      if (hadBrowserWindowLoaded) {
        if (this.onlineAuthUiMounted || this.authDialogOpen || !this.onlineAuthBootstrapPending) {
          this.recordAuthUiDebug("browserWindowLoadedDuplicateIgnored", {
            onlineAuthBootstrapPending: this.onlineAuthBootstrapPending,
            onlineAuthUiMounted: this.onlineAuthUiMounted,
            authDialogOpen: this.authDialogOpen,
          });
          return;
        }

        this.recordAuthUiDebug("browserWindowLoadedDuplicateDuringBootstrap", {
          onlineAuthBootstrapPending: this.onlineAuthBootstrapPending,
        });
        this.scheduleOnlineAuthBootstrapFallback("browserWindowLoadedDuplicate");
        return;
      }

      this.trigger.frontLoadedFired = false;
      this.onlineAuthBootstrapPending = true;
      this.onlineAuthUiMounted = false;
      this.authDialogOpen = false;
      this.scheduleOnlineAuthBootstrapFallback("browserWindowLoaded");
    }
  }

  private onCreateActorMessage(e: ConnectionMessage<CreateActorMessage>) {
    if (e.message.isMe) {
      logTrace(this, `Received createActorMessage for self, clearing auth browser state`);
      this.cancelPendingAuthUiRefreshes("createActorMessage");
      this.sp.browser.executeJavaScript('window.skyrimPlatform.widgets.set([]);');
      this.sp.browser.executeJavaScript(clearAuthOverlayEventString);
      this.sp.browser.executeJavaScript(clearGameplaySurfaceEventString);
      this.sp.browser.setFocused(false);
      this.sp.browser.setVisible(false);
      this.authDialogOpen = false;
      this.onlineAuthUiMounted = false;
      this.onlineAuthBootstrapPending = false;
      this.trigger.frontLoadedFired = false;
      this.closeGameplayTransitionMenus("createActorMessage");
      this.restoreGameplayBrowserPage("createActorMessage");
    }

    this.loggingStartMoment = 0;
    this.authAttemptProgressIndicator = false;
  }

  private onCustomPacketMessage(event: ConnectionMessage<CustomPacketMessage>): void {
    const msg = event.message;

    let msgContent: Record<string, unknown> = {};

    try {
      msgContent = JSON.parse(msg.contentJsonDump);
    } catch (e) {
      if (e instanceof SyntaxError) {
        logError(this, "onCustomPacketMessage failed to parse JSON", e.message, "json:", msg.contentJsonDump);
        return;
      } else {
        throw e;
      }
    }

    switch (msgContent["customPacketType"]) {
      // case 'loginRequired':
      //   logTrace(this, 'loginRequired received');
      //   this.loginWithSkympIoCredentials();
      //   break;
      case 'loginFailedNotLoggedViaDiscord':
        this.authAttemptProgressIndicator = false;
        this.controller.lookupListener(NetworkingService).close();
        logTrace(this, 'loginFailedNotLoggedViaDiscord received');
        browserState.loginFailedReason = 'войдите через discord';
        browserState.comment = '';
        this.setListenBrowserMessage(true, 'loginFailedNotLoggedViaDiscord received');
        this.loggingStartMoment = 0;
        this.sp.browser.executeJavaScript(new FunctionInfo(this.loginFailedWidgetSetterEn).getText({ events, browserState, authData: authData }));
        break;
      case 'loginFailedNotInTheDiscordServer':
        this.authAttemptProgressIndicator = false;
        this.controller.lookupListener(NetworkingService).close();
        logTrace(this, 'loginFailedNotInTheDiscordServer received');
        browserState.loginFailedReason = 'вступите в discord сервер';
        browserState.comment = '';
        this.setListenBrowserMessage(true, 'loginFailedNotInTheDiscordServer received');
        this.loggingStartMoment = 0;
        this.sp.browser.executeJavaScript(new FunctionInfo(this.loginFailedWidgetSetterEn).getText({ events, browserState, authData: authData }));
        break;
      case 'loginFailedBanned':
        this.authAttemptProgressIndicator = false;
        this.controller.lookupListener(NetworkingService).close();
        logTrace(this, 'loginFailedBanned received');
        browserState.loginFailedReason = 'вы забанены';
        browserState.comment = '';
        this.setListenBrowserMessage(true, 'loginFailedBanned received');
        this.loggingStartMoment = 0;
        this.sp.browser.executeJavaScript(new FunctionInfo(this.loginFailedWidgetSetterEn).getText({ events, browserState, authData: authData }));
        break;
      case 'loginFailedIpMismatch':
        this.authAttemptProgressIndicator = false;
        this.controller.lookupListener(NetworkingService).close();
        logTrace(this, 'loginFailedIpMismatch received');
        browserState.loginFailedReason = 'что это было?';
        browserState.comment = '';
        this.setListenBrowserMessage(true, 'loginFailedIpMismatch received');
        this.loggingStartMoment = 0;
        this.sp.browser.executeJavaScript(new FunctionInfo(this.loginFailedWidgetSetterEn).getText({ events, browserState, authData: authData }));
        break;
    }
  }

  private onBrowserWindowLoadedAndOnlineAuthNeeded(source = "unknown") {
    if (!this.isListenBrowserMessage()) {
      logError(this, `isListenBrowserMessage was false for some reason, aborting auth`);
      this.recordAuthUiDebug("onlineAuthAborted", {
        reason: "listenBrowserMessageFalse",
        source,
      });
      return;
    }

    this.authUiBootedAt = Date.now();
    this.writeAuthDataToDisk(null);
    authData = null;
    const rememberedLogin = this.readRememberedLoginFromDisk();
    this.ucpUiState.error = "";
    this.ucpUiState.info = "";
    this.ucpUiState.loading = false;
    this.ucpUiState.rememberedLogin = rememberedLogin;
    this.ucpUiState.rememberLogin = !!rememberedLogin;
    this.ucpUiState.characters = [];
    this.ucpUiState.selectedCharacterId = null;
    this.refreshWidgets();
    this.scheduleAuthUiRefreshes(source);
    this.recordAuthUiDebug("onlineAuthReady", {
      source,
      hasSession: false,
      rememberedLogin,
    });
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);
    void this.refreshUcpSessionState();
  }

  private startOnlineAuthBootstrap(source: string) {
    if (this.onlineAuthBootstrapPending) {
      this.recordAuthUiDebug("onlineAuthBootstrapAlreadyPending", { source });
      return;
    }

    this.onlineAuthBootstrapPending = true;
    this.onlineAuthUiMounted = false;
    this.onlineAuthBootstrapGeneration += 1;
    this.trigger.browserWindowLoadedFired = false;
    this.trigger.frontLoadedFired = false;
    this.recordAuthUiDebug("onlineAuthBootstrapStart", { source });

    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(false);

    try {
      this.sp.browser.executeJavaScript(showAuthBootstrapCoverEventString);
      this.recordAuthUiDebug("authBootstrapCoverShown", { source });
    } catch (error) {
      this.recordAuthUiDebug("authBootstrapCoverError", {
        source,
        error: `${error}`,
      });
    }

    this.ensureAuthBrowserPageLoaded(source);
  }

  private scheduleOnlineAuthBootstrapFallback(source: string) {
    const generation = this.onlineAuthBootstrapGeneration;
    setTimeout(() => {
      if (generation !== this.onlineAuthBootstrapGeneration) {
        return;
      }
      if (!this.onlineAuthBootstrapPending || this.onlineAuthUiMounted) {
        return;
      }
      if (this.controller.lookupListener(NetworkingService).isConnected()) {
        return;
      }
      if (!this.trigger.browserWindowLoadedFired || this.trigger.frontLoadedFired) {
        return;
      }

      this.recordAuthUiDebug("onlineAuthFallbackMount", { source });
      this.maybeShowOnlineAuthUi(`${source}+fallback`);
    }, 250);
  }

  private maybeShowOnlineAuthUi(source: string) {
    if (!this.onlineAuthBootstrapPending && !this.onlineAuthUiMounted) {
      return;
    }
    if (this.onlineAuthUiMounted) {
      return;
    }
    if (!this.trigger.authNeededFired) {
      return;
    }
    if (!this.trigger.browserWindowLoadedFired) {
      return;
    }
    const isFallback = source.endsWith("+fallback");
    if (!isFallback && !this.trigger.frontLoadedFired) {
      return;
    }

    this.onlineAuthBootstrapPending = false;
    this.onlineAuthUiMounted = true;
    this.onBrowserWindowLoadedAndOnlineAuthNeeded(source);
  }

  private onBrowserMessage(e: BrowserMessageEvent) {
    if (!this.isListenBrowserMessage()) {
      logTrace(this, `onBrowserMessage: isListenBrowserMessage was false, ignoring message`, JSON.stringify(e.arguments));
      return;
    }

    const settingsService = this.controller.lookupListener(SettingsService);

    logTrace(this, `onBrowserMessage:`, JSON.stringify(e.arguments));
    this.recordAuthUiDebug("browserMessage", {
      eventKey: `${e.arguments[0] || ""}`,
    });

    const eventKey = e.arguments[0];
    if (eventKey === this.frontLoadedEventKey) {
      this.trigger.frontLoadedFired = true;
      if (!this.controller.lookupListener(NetworkingService).isConnected()) {
        this.maybeShowOnlineAuthUi("front-loaded");
      }
      return;
    }
    if (eventKey === events.ucpLogin) {
      void this.handleUcpLogin(`${e.arguments[1] || ""}`);
      return;
    }
    if (eventKey === events.ucpCreateCharacter) {
      void this.handleUcpCreateCharacter(`${e.arguments[1] || ""}`);
      return;
    }
    if (eventKey === events.ucpSelectCharacter) {
      void this.handleUcpSelectCharacter(`${e.arguments[1] || ""}`);
      return;
    }
    if (eventKey === events.ucpPlay) {
      void this.handleUcpPlay(`${e.arguments[1] || ""}`);
      return;
    }
    if (eventKey === events.ucpLogout) {
      void this.handleUcpLogout();
      return;
    }
    if (eventKey === events.ucpOpenWebsite) {
      const ucpUrl = `${settingsService.getServerUiUrl()}/ucp/`;
      browserState.comment = "Opening UCP...";
      this.refreshWidgets();
      try {
        logTrace(this, `Trying to open UCP URL`, ucpUrl);
        this.sp.win32.loadUrl(ucpUrl);
      } catch (error) {
        const errorText = `${error}`;
        logError(this, `Failed to open UCP URL`, ucpUrl, errorText);
        browserState.comment = `Failed to open browser: ${errorText}`;
        this.refreshWidgets();
      }
      return;
    }
    if (eventKey === events.ucpExitGame) {
      browserState.comment = "Closing Skyrim...";
      this.refreshWidgets();
      this.requestImmediateGameExit("browserMessage");
      return;
    }

    switch (eventKey) {
      case events.openDiscordOauth:
        browserState.comment = 'открываем браузер...';
        this.refreshWidgets();
        this.sp.win32.loadUrl(`${settingsService.getMasterUrl()}/api/users/login-discord?state=${this.discordAuthState}`);

        // Launch checkLoginState loop
        this.checkLoginState();
        break;
      case events.authAttempt:
        if (authData === null) {
          browserState.comment = 'сначала войдите';
          this.refreshWidgets();
          break;
        }

        this.writeAuthDataToDisk(authData);
        this.controller.emitter.emit("authAttempt", { authGameData: { remote: authData } });

        this.authAttemptProgressIndicator = true;

        break;
      case events.clearAuthData:
        // Doesn't seem to be used
        this.writeAuthDataToDisk(null);
        break;
      case events.openGithub:
        this.sp.win32.loadUrl(this.githubUrl);
        break;
      case events.openPatreon:
        this.sp.win32.loadUrl(this.patreonUrl);
        break;
      case events.updateRequired:
        this.sp.win32.loadUrl("https://skymp.net/UpdInstall");
        break;
      case events.backToLogin:
        this.sp.browser.executeJavaScript(new FunctionInfo(this.browsersideWidgetSetter).getText({ events, browserState, authData: authData }));
        break;
      case events.joinDiscord:
        this.sp.win32.loadUrl("https://discord.gg/9KhSZ6zjGT");
        break;
      default:
        break;
    }
  }

  private createPlaySession(token: string, callback: (res: string, err: string) => void) {
    const settingsService = this.controller.lookupListener(SettingsService);
    const client = new this.sp.HttpClient(settingsService.getMasterUrl());

    const route = `/api/users/me/play/${settingsService.getServerMasterKey()}`;
    logTrace(this, `Creating play session ${route}`);

    client.post(route, {
      body: '{}',
      contentType: 'application/json',
      headers: {
        'authorization': token,
      },
      // @ts-ignore
    }, (res) => {
      if (res.status != 200) {
        callback('', 'status code ' + res.status);
      } else {
        // TODO: handle JSON.parse failure?
        callback(JSON.parse(res.body).session, '');
      }
    });
  }

  private checkLoginState() {
    if (!this.isListenBrowserMessage()) {
      logTrace(this, `checkLoginState: isListenBrowserMessage was false, aborting check`);
      return;
    }

    const settingsService = this.controller.lookupListener(SettingsService);
    const timersService = this.controller.lookupListener(TimersService);

    // Social engineering protection, don't show the full state
    const halfDiscordAuthState = this.discordAuthState.slice(0, 16);

    logTrace(this, `Checking login state`, halfDiscordAuthState, '...');

    new this.sp.HttpClient(settingsService.getMasterUrl())
      .get("/api/users/login-discord/status?state=" + this.discordAuthState, undefined,
        // @ts-ignore
        (response) => {
          switch (response.status) {
            case 200:
              const {
                token,
                masterApiId,
                discordUsername,
                discordDiscriminator,
                discordAvatar,
              } = JSON.parse(response.body) as MasterApiAuthStatus;
              browserState.failCount = 0;
              this.createPlaySession(token, (playSession, error) => {
                if (error) {
                  browserState.failCount = 0;
                  browserState.comment = (error);
                  timersService.setTimeout(() => this.checkLoginState(), Math.floor((1.5 + Math.random() * 2) * 1000));
                  this.refreshWidgets();
                  return;
                }
                authData = {
                  session: playSession,
                  masterApiId,
                  discordUsername,
                  discordDiscriminator,
                  discordAvatar,
                };
                browserState.comment = 'привязан успешно';
                this.refreshWidgets();
              });
              break;
            case 401: // Unauthorized
              browserState.failCount = 0;
              browserState.comment = '';//(`Still waiting...`);
              timersService.setTimeout(() => this.checkLoginState(), Math.floor((1.5 + Math.random() * 2) * 1000));
              break;
            case 403: // Forbidden
            case 404: // Not found
              browserState.failCount = 9000;
              browserState.comment = (`Fail: ${response.body}`);
              break;
            default:
              ++browserState.failCount;
              browserState.comment = `Server returned ${response.status.toString() || "???"} "${response.body || response.error}"`;
              timersService.setTimeout(() => this.checkLoginState(), Math.floor((1.5 + Math.random() * 2) * 1000));
          }
        });
  };

  private refreshWidgets() {
    if (!this.isListenBrowserMessage()) {
      this.recordAuthUiDebug("refreshWidgetsSkipped", {
        reason: "listenBrowserMessageFalse",
      });
      this.authDialogOpen = false;
      return;
    }

    authUiState = this.getUcpBrowserState();
    this.recordAuthUiDebug("refreshWidgets", {
      loggedIn: !!(authUiState as any)?.loggedIn,
      loading: !!(authUiState as any)?.loading,
      characters: Array.isArray((authUiState as any)?.characters) ? (authUiState as any).characters.length : 0,
      selectedCharacterId: (authUiState as any)?.selectedCharacterId ?? null,
    });
    this.sp.browser.executeJavaScript(
      new FunctionInfo(this.ucpBrowserUiSetter).getText({
        events,
        authUiState,
      })
    );
    this.sp.browser.executeJavaScript(`
      setTimeout(function() {
        ${new FunctionInfo(this.ucpWidgetFallbackSetter).getText({
          events,
          authUiState,
        })}
      }, 120);
    `);
    this.authDialogOpen = true;
  };

  private ensureAuthBrowserPageLoaded(reason: string) {
    try {
      this.sp.browser.loadUrl(this.authBrowserUrl);
      this.recordAuthUiDebug("browserLoadUrl", {
        reason,
        url: this.authBrowserUrl,
      });
    } catch (error) {
      logError(this, "Failed to load auth browser url", error);
      this.recordAuthUiDebug("browserLoadUrlError", {
        reason,
        error: `${error}`,
      });
    }
  }

  private restoreGameplayBrowserPage(reason: string) {
    try {
      this.sp.browser.loadUrl(this.gameplayBrowserUrl);
      this.recordAuthUiDebug("gameplayBrowserLoadUrl", {
        reason,
        url: this.gameplayBrowserUrl,
      });
    } catch (error) {
      logError(this, "Failed to load gameplay browser url", error);
      this.recordAuthUiDebug("gameplayBrowserLoadUrlError", {
        reason,
        error: `${error}`,
      });
    }
  }

  private closeGameplayTransitionMenus(reason: string) {
    const closeMenus = (phase: string) => {
      for (const menuName of [Menu.Main, Menu.Loading]) {
        try {
          (this.sp.TESModPlatform as any).CloseMenu(menuName);
        } catch (error) {
          this.recordAuthUiDebug("closeGameplayTransitionMenuError", {
            reason,
            phase,
            menu: menuName,
            error: `${error}`,
          });
        }
      }
    };

    closeMenus("immediate");

    const timers = this.controller.lookupListener(TimersService);
    for (const delayMs of [120, 450, 1200]) {
      timers.setTimeout(() => closeMenus(`delay-${delayMs}`), delayMs);
    }
  }

  private cancelPendingAuthUiRefreshes(reason: string) {
    this.authUiRefreshGeneration += 1;
    this.recordAuthUiDebug("cancelPendingAuthUiRefreshes", { reason });
  }

  private scheduleAuthUiRefreshes(source: string) {
    const generation = ++this.authUiRefreshGeneration;
    const refresh = () => {
      if (generation !== this.authUiRefreshGeneration) {
        return;
      }
      if (!this.isListenBrowserMessage()) {
        return;
      }
      this.refreshWidgets();
      this.sp.browser.setVisible(true);
      this.sp.browser.setFocused(true);
    };

    this.controller.once("update", refresh);
    this.controller.once("tick", refresh);
    setTimeout(refresh, 150);
    setTimeout(refresh, 500);
  }

  private getUcpBrowserState() {
    const selectedCharacter = this.ucpUiState.characters.find(
      (entry) => Number(entry.id) === Number(this.ucpUiState.selectedCharacterId)
    ) || null;

    return {
      loading: this.ucpUiState.loading,
      error: this.ucpUiState.error,
      info: this.ucpUiState.info,
      loggedIn: !!authData?.session,
      accountUsername: authData?.accountUsername || authData?.discordUsername || null,
      characters: this.ucpUiState.characters,
      selectedCharacterId: this.ucpUiState.selectedCharacterId,
      selectedCharacterName: this.formatCharacterName(selectedCharacter?.name),
      canCreateCharacter: this.ucpUiState.characters.length < 3,
      rememberedLogin: this.ucpUiState.rememberedLogin,
      rememberLogin: this.ucpUiState.rememberLogin,
    };
  }

  private getSelectedCharacterName(characterId?: number | null) {
    const resolvedCharacterId = characterId ?? this.ucpUiState.selectedCharacterId;
    if (!Number.isInteger(Number(resolvedCharacterId))) {
      return null;
    }

    const selectedCharacter = this.ucpUiState.characters.find(
      (entry) => Number(entry.id) === Number(resolvedCharacterId)
    );

    return this.formatCharacterName(selectedCharacter?.name);
  }

  private getCachedCharacterFallback() {
    const cachedCharacterId = Number(authData?.selectedCharacterId);
    const hasCachedCharacter = Number.isInteger(cachedCharacterId);
    const cachedCharacterName = this.formatCharacterName(authData?.selectedCharacterName);

    return {
      cachedCharacterId: hasCachedCharacter ? cachedCharacterId : null,
      cachedCharacterName,
      fallbackCharacters: hasCachedCharacter
        ? [{ id: cachedCharacterId, name: cachedCharacterName || `Character ${cachedCharacterId}` }]
        : [],
    };
  }

  private formatCharacterName(name?: unknown) {
    const raw = String(name || "").trim().replace(/\s+/g, " ");
    if (!raw) {
      return null;
    }

    return raw
      .split(" ")
      .map((word) => {
        const lowerWord = word.toLocaleLowerCase();
        if (lowerWord === "of") {
          return "of";
        }
        return `${lowerWord.slice(0, 1).toLocaleUpperCase()}${lowerWord.slice(1)}`;
      })
      .join(" ");
  }

  private parseBrowserPayload(raw: string) {
    try {
      return JSON.parse(raw || "{}") as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private getUcpHeaders() {
    const headers: Record<string, string> = {};
    if (authData?.session) {
      headers["authorization"] = `Bearer ${authData.session}`;
    }
    return headers;
  }

  private parseUcpError(response: { status?: number; body?: string; error?: string }) {
    const body = response.body || response.error || "";
    try {
      const parsed = JSON.parse(body);
      return parsed.error || `status ${response.status}`;
    } catch {
      return body || `status ${response.status}`;
    }
  }

  private ucpGet(path: string, onSuccess: (payload: any) => void, onError: (error: string) => void) {
    const client = new this.sp.HttpClient(this.controller.lookupListener(SettingsService).getServerUiUrl());
    logTrace(this, `UCP GET`, path);

    try {
      client.get(
        path,
        { headers: this.getUcpHeaders() },
        // @ts-ignore main-menu-safe callback overload
        (response) => {
          logTrace(this, `UCP GET response`, path, response.status);
          if (response.status !== 200) {
            onError(this.parseUcpError(response));
            return;
          }

          try {
            onSuccess(JSON.parse(response.body));
          } catch (error) {
            onError(`${error}`);
          }
        },
      );
    } catch (error) {
      onError(`${error}`);
    }
  }

  private ucpPost(path: string, body: unknown, onSuccess: (payload: any) => void, onError: (error: string) => void) {
    const client = new this.sp.HttpClient(this.controller.lookupListener(SettingsService).getServerUiUrl());
    logTrace(this, `UCP POST`, path, JSON.stringify(body || {}));

    try {
      client.post(path, {
        body: JSON.stringify(body || {}),
        contentType: "application/json",
        headers: this.getUcpHeaders(),
        // @ts-ignore main-menu-safe callback overload
      }, (response) => {
        logTrace(this, `UCP POST response`, path, response.status);
        if (response.status !== 200 && response.status !== 201) {
          onError(this.parseUcpError(response));
          return;
        }

        try {
          onSuccess(JSON.parse(response.body));
        } catch (error) {
          onError(`${error}`);
        }
      });
    } catch (error) {
      onError(`${error}`);
    }
  }

  private refreshUcpSessionState() {
    if (!authData?.session) {
      this.inFlightUcpSessionRefresh = null;
      this.ucpUiState.loading = false;
      this.ucpUiState.characters = [];
      this.ucpUiState.selectedCharacterId = null;
      this.refreshWidgets();
      return;
    }

    const persistedSession = authData.session;
    if (this.inFlightUcpSessionRefresh === persistedSession) {
      return;
    }

    this.ucpUiState.loading = true;
    this.refreshWidgets();

    this.inFlightUcpSessionRefresh = persistedSession;
    this.ucpGet("/ucp/api/auth/me", (payload) => {
      if (this.inFlightUcpSessionRefresh === persistedSession) {
        this.inFlightUcpSessionRefresh = null;
      }
      if (authData?.session !== persistedSession) {
        return;
      }

      const selectedCharacter = payload.selectedCharacter || null;
      authData = {
        ...(authData || {}),
        session: persistedSession,
        accountId: payload.account?.id ?? authData?.accountId ?? null,
        accountUsername: payload.account?.username ? String(payload.account.username) : (authData?.accountUsername ?? null),
        selectedCharacterId: selectedCharacter?.id ?? null,
        selectedCharacterName: this.formatCharacterName(selectedCharacter?.name),
      };
      this.writeAuthDataToDisk(authData);
      this.ucpUiState.characters = payload.characters || [];
      this.ucpUiState.selectedCharacterId = selectedCharacter?.id ?? null;
      this.ucpUiState.loading = false;
      this.ucpUiState.error = "";
      this.ucpUiState.info = this.ucpUiState.characters.length
        ? "Choose a character and press Play."
        : "No characters yet. Create your first slot below.";
      this.refreshWidgets();
    }, (error) => {
      if (this.inFlightUcpSessionRefresh === persistedSession) {
        this.inFlightUcpSessionRefresh = null;
      }
      if (authData?.session !== persistedSession) {
        return;
      }

      const fallback = this.getCachedCharacterFallback();
      this.recordAuthUiDebug("ucpSessionRefreshFailed", {
        error,
        cachedCharacterId: fallback.cachedCharacterId,
        usingCachedCharacter: fallback.fallbackCharacters.length > 0,
      });
      this.ucpUiState.loading = false;
      this.ucpUiState.characters = fallback.fallbackCharacters;
      this.ucpUiState.selectedCharacterId = fallback.cachedCharacterId;
      this.ucpUiState.error = fallback.fallbackCharacters.length
        ? "Could not refresh characters. Using cached data."
        : error;
      this.ucpUiState.info = fallback.fallbackCharacters.length
        ? "Cached character available. Press Play to continue."
        : "";
      this.refreshWidgets();
    });
  }

  private handleUcpLogin(rawPayload: string) {
    const payload = this.parseBrowserPayload(rawPayload);
    const login = `${payload.login || ""}`.trim();
    const password = `${payload.password || ""}`;
    const rememberLogin = payload.rememberMe === true || `${payload.rememberMe || ""}` === "true";

    if (!login || !password) {
      this.ucpUiState.error = "Enter your username/email and password.";
      this.refreshWidgets();
      return;
    }

    this.ucpUiState.loading = true;
    this.ucpUiState.error = "";
    this.ucpUiState.info = "Signing in...";
    this.ucpUiState.rememberedLogin = login;
    this.ucpUiState.rememberLogin = rememberLogin;
    this.refreshWidgets();

    this.ucpPost("/ucp/api/auth/login", {
      login,
      password,
    }, (response) => {
      authData = {
        session: response.session.token,
        accountId: response.account?.id ?? null,
        accountUsername: response.account?.username ? String(response.account.username) : login,
        selectedCharacterId: null,
        selectedCharacterName: null,
      };
      this.writeAuthDataToDisk(authData);
      const responseCharacters = Array.isArray(response.characters) ? response.characters : [];
      this.ucpUiState.characters = responseCharacters;
      this.ucpUiState.selectedCharacterId = responseCharacters.length === 1
        ? Number(responseCharacters[0]?.id)
        : null;
      this.ucpUiState.rememberLogin = rememberLogin;
      this.ucpUiState.rememberedLogin = rememberLogin ? login : "";
      this.writeRememberedLoginToDisk(rememberLogin ? login : "");
      this.ucpUiState.info = `Signed in as ${authData.accountUsername}.`;
      this.refreshUcpSessionState();
    }, (error) => {
      this.ucpUiState.loading = false;
      this.ucpUiState.error = error;
      this.ucpUiState.info = "";
      this.refreshWidgets();
    });
  }

  private handleUcpCreateCharacter(rawPayload: string) {
    this.ucpUiState.loading = true;
    this.ucpUiState.error = "";
    this.ucpUiState.info = "Creating character slot...";
    this.refreshWidgets();

    this.ucpPost("/ucp/api/characters", {}, (response) => {
      const createdCharacter = response.character || null;
      const createdCharacterId = createdCharacter?.id ?? null;
      const createdCharacterName = this.formatCharacterName(createdCharacter?.name);

      if (authData) {
        authData = {
          ...authData,
          selectedCharacterId: createdCharacterId,
          selectedCharacterName: createdCharacterName,
        };
        this.writeAuthDataToDisk(authData);
      }

      this.ucpUiState.characters = response.characters || this.ucpUiState.characters;
      this.ucpUiState.selectedCharacterId = createdCharacterId;
      this.ucpUiState.loading = false;
      this.ucpUiState.info = createdCharacter
        ? `Slot ${createdCharacter.slot_index} created. Finish name, race, and appearance in game on first join.`
        : "Slot created. Finish name, race, and appearance in game on first join.";
      this.refreshWidgets();

      // Follow up with a session refresh so the browser overlay and persisted
      // auth state stay in sync even if other server-side session data changed.
      this.refreshUcpSessionState();
    }, (error) => {
      this.ucpUiState.loading = false;
      this.ucpUiState.error = error;
      this.refreshWidgets();
    });
  }

  private handleUcpSelectCharacter(rawPayload: string) {
    const payload = this.parseBrowserPayload(rawPayload);
    const characterId = Number(payload.characterId);

    if (!Number.isInteger(characterId)) {
      this.ucpUiState.error = "Pick a valid character slot.";
      this.refreshWidgets();
      return;
    }

    this.ucpUiState.loading = true;
    this.ucpUiState.error = "";
    this.ucpUiState.info = "Selecting character...";
    this.refreshWidgets();

    this.ucpPost("/ucp/api/characters/select", { characterId }, (response) => {
      const selectedCharacter = response.selectedCharacter || null;
      authData = authData ? {
        ...authData,
        selectedCharacterId: selectedCharacter?.id ?? null,
        selectedCharacterName: this.formatCharacterName(selectedCharacter?.name),
      } : authData;
      this.writeAuthDataToDisk(authData);
      this.ucpUiState.characters = response.characters || this.ucpUiState.characters;
      this.ucpUiState.selectedCharacterId = selectedCharacter?.id ?? null;
      this.ucpUiState.loading = false;
      this.ucpUiState.info = selectedCharacter
        ? (selectedCharacter.name ? `${selectedCharacter.name} is selected.` : `Slot ${selectedCharacter.slot_index} is selected.`)
        : "";
      this.refreshWidgets();
    }, (error) => {
      this.ucpUiState.loading = false;
      this.ucpUiState.error = error;
      this.refreshWidgets();
    });
  }

  private handleUcpPlay(rawPayload: string) {
    const payload = this.parseBrowserPayload(rawPayload);
    const characterId = Number(payload.characterId ?? this.ucpUiState.selectedCharacterId);

    if (!Number.isInteger(characterId)) {
      this.ucpUiState.error = "Select a character before pressing Play.";
      this.refreshWidgets();
      return;
    }

    this.ucpUiState.loading = true;
    this.ucpUiState.error = "";
    this.ucpUiState.info = "Connecting to Skyrim Unbound...";
    this.refreshWidgets();

    this.ucpPost("/ucp/api/game/play-session", { characterId }, (response) => {
      const selectedCharacterName = this.getSelectedCharacterName(response.characterId);
      if (authData) {
        authData = {
          ...authData,
          selectedCharacterId: response.characterId ?? characterId,
          selectedCharacterName,
        };
        this.writeAuthDataToDisk(authData);
      }

      this.recordAuthUiDebug("ucpPlayAwaitingConnection", {
        characterId,
        resolvedCharacterId: response.characterId ?? characterId,
        keepBrowserVisible: true,
      });
      this.sp.browser.setVisible(true);
      this.sp.browser.setFocused(true);
      this.controller.emitter.emit("authAttempt", {
        authGameData: {
          remote: {
            ...(authData || { session: "" }),
            playSession: response.session,
            selectedCharacterId: response.characterId ?? characterId,
            selectedCharacterName,
          },
        },
      });
    }, (error) => {
      if (authData?.session) {
        const selectedCharacterName = this.getSelectedCharacterName(characterId)
          ?? this.formatCharacterName(authData?.selectedCharacterName);

        authData = {
          ...authData,
          selectedCharacterId: characterId,
          selectedCharacterName,
        };
        this.writeAuthDataToDisk(authData);

        this.recordAuthUiDebug("ucpPlayFallbackCachedSession", {
          characterId,
          error,
          keepBrowserVisible: true,
        });
        this.sp.browser.setVisible(true);
        this.sp.browser.setFocused(true);
        this.controller.emitter.emit("authAttempt", {
          authGameData: {
            remote: {
              ...(authData || { session: "" }),
              selectedCharacterId: characterId,
              selectedCharacterName,
            },
          },
        });
        return;
      }

      this.ucpUiState.loading = false;
      this.ucpUiState.error = error;
      this.refreshWidgets();
    });
  }

  private finishUcpLogout() {
    authData = null;
    this.writeAuthDataToDisk(null);
    this.ucpUiState.loading = false;
    this.ucpUiState.error = "";
    this.ucpUiState.info = "Logged out.";
    this.ucpUiState.characters = [];
    this.ucpUiState.selectedCharacterId = null;
    this.refreshWidgets();
  }

  private handleUcpLogout() {
    const msSinceAuthUiBoot = Date.now() - this.authUiBootedAt;
    if (this.onlineAuthUiMounted && this.ucpUiState.loading && msSinceAuthUiBoot >= 0 && msSinceAuthUiBoot < 5000) {
      this.recordAuthUiDebug("ucpLogoutIgnoredDuringInitialAuthLoad", {
        msSinceAuthUiBoot,
      });
      return;
    }

    if (authData?.session) {
      this.ucpPost("/ucp/api/auth/logout", {}, () => this.finishUcpLogout(), () => this.finishUcpLogout());
      return;
    }

    this.finishUcpLogout();
  }

  private prepareBrowserForGameplayTransition(reason: string) {
    this.cancelPendingAuthUiRefreshes(reason);
    this.authDialogOpen = false;
    this.onlineAuthUiMounted = false;
    this.onlineAuthBootstrapPending = false;
    this.trigger.frontLoadedFired = false;
    this.setListenBrowserMessage(false, `${reason} gameplay transition`);

    try {
      this.sp.browser.executeJavaScript('window.skyrimPlatform.widgets.set([]);');
      this.sp.browser.executeJavaScript(clearAuthOverlayEventString);
      this.sp.browser.executeJavaScript(clearGameplaySurfaceEventString);
    } catch (error) {
      this.recordAuthUiDebug("prepareBrowserForGameplayTransitionJsError", {
        reason,
        error: `${error}`,
      });
    }

    this.sp.browser.setFocused(false);
    this.sp.browser.setVisible(false);
    this.restoreGameplayBrowserPage(reason);
    this.recordAuthUiDebug("prepareBrowserForGameplayTransition", { reason });
  }

  private ucpBrowserUiSetter = () => {
    const state = authUiState || {};
    const eventsMap = events || {};

    function escapeHtml(value: unknown): string {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatUsage(character: any) {
      if (!character || !character.last_used_at) {
        return "Creation pending in game";
      }
      try {
        return "Last used: " + new Date(character.last_used_at).toLocaleString();
      } catch {
        return "Last used recently";
      }
    }

    function formatCharacterName(character: any) {
      const raw = String(character?.name || "").trim();
      if (raw) {
        const words = raw.replace(/\s+/g, " ").split(" ");
        return words.map((word: string) => {
          const lowerWord = word.toLocaleLowerCase();
          return `${lowerWord.slice(0, 1).toLocaleUpperCase()}${lowerWord.slice(1)}`;
        }).join(" ");
      }
      const slotIndex = Number(character?.slot_index || 0) || "?";
      return `Unnamed slot ${slotIndex}`;
    }

    function send(eventName: string, payload?: Record<string, unknown>) {
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.skyrimPlatform.sendMessage(eventName, JSON.stringify(payload || {}));
      }
    }

    function ensureRoot() {
      let root = document.getElementById("skw-auth-root");
      if (!root) {
        root = document.createElement("div");
        root.id = "skw-auth-root";
        root.style.position = "fixed";
        root.style.inset = "0";
        root.style.zIndex = "2147483647";
        root.style.display = "flex";
        root.style.alignItems = "center";
        root.style.justifyContent = "center";
        root.style.backgroundColor = "#050406";
        root.style.backgroundImage = "linear-gradient(180deg, rgba(3,3,5,0.36), rgba(4,4,7,0.72) 38%, rgba(5,5,8,0.9) 100%), radial-gradient(circle at center, rgba(255,255,255,0.04), rgba(0,0,0,0.14) 42%, rgba(0,0,0,0.5) 100%)";
        root.style.backgroundPosition = "center center";
        root.style.backgroundRepeat = "no-repeat";
        root.style.backgroundSize = "cover";
        root.style.backgroundAttachment = "fixed";
        root.style.fontFamily = "Georgia, serif";
        root.style.color = "#f1e6d3";
        root.style.pointerEvents = "auto";
        document.body.appendChild(root);
      }
      return root;
    }

    function render() {
      const root = ensureRoot();
      const characters = Array.isArray(state.characters) ? state.characters : [];
      const selectedCharacterId = state.selectedCharacterId == null ? null : Number(state.selectedCharacterId);
      const selectedCharacter = characters.find((entry: any) => Number(entry.id) === selectedCharacterId) || null;
      const rememberedLogin = typeof state.rememberedLogin === "string" ? state.rememberedLogin : "";
      const rememberLogin = state.rememberLogin === true;

      const characterCards = characters.map((character: any) => {
        const selected = Number(character.id) === selectedCharacterId;
        const characterName = formatCharacterName(character);
        return `
          <button
            type="button"
            data-character-id="${escapeHtml(character.id)}"
            class="skw-auth-card${selected ? " is-selected" : ""}"
            style="
              text-align:left;
              width:100%;
              padding:14px 16px;
              border-radius:16px;
              border:1px solid ${selected ? "rgba(198, 154, 98, 0.72)" : "rgba(198, 154, 98, 0.18)"};
              background:${selected ? "rgba(114, 78, 43, 0.36)" : "rgba(16, 15, 20, 0.88)"};
              color:#f1e6d3;
              cursor:pointer;
            ">
            <div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#b48753;">Slot ${escapeHtml(character.slot_index)}</div>
            <div style="margin-top:6px; font-size:24px;">${escapeHtml(characterName)}</div>
            <div style="margin-top:8px; font-size:13px; line-height:1.45; color:#b5a692;">Profile ID ${escapeHtml(character.profile_id)}<br>${escapeHtml(formatUsage(character))}</div>
          </button>
        `;
      }).join("");

      const loginView = `
        <form id="skw-auth-login-form" style="display:grid; gap:12px;">
          <label style="display:grid; gap:6px;">
            <span style="font-size:14px; color:#cfc1ab;">Username or email</span>
            <input id="skw-auth-login" type="text" autocomplete="username" value="${escapeHtml(rememberedLogin)}" style="height:48px; border-radius:14px; border:1px solid rgba(198,154,98,0.22); background:rgba(9,9,12,0.86); color:#f6eddc; padding:0 14px; font:inherit;" />
          </label>
          <label style="display:grid; gap:6px;">
            <span style="font-size:14px; color:#cfc1ab;">Password</span>
            <input id="skw-auth-password" type="password" autocomplete="current-password" style="height:48px; border-radius:14px; border:1px solid rgba(198,154,98,0.22); background:rgba(9,9,12,0.86); color:#f6eddc; padding:0 14px; font:inherit;" />
          </label>
          <button id="skw-auth-remember" type="button" data-remember="${rememberLogin ? "1" : "0"}" style="min-height:48px; display:flex; align-items:center; gap:13px; padding:0 14px; border-radius:14px; border:1px solid ${rememberLogin ? "rgba(198,154,98,0.54)" : "rgba(198,154,98,0.18)"}; background:${rememberLogin ? "rgba(114,78,43,0.26)" : "rgba(255,255,255,0.035)"}; color:#f1e6d3; font:inherit; font-size:16px; cursor:pointer; text-align:left;">
            <span data-checkmark="1" style="width:26px; height:26px; flex:0 0 26px; display:inline-flex; align-items:center; justify-content:center; border-radius:7px; border:1px solid ${rememberLogin ? "rgba(232,190,126,0.88)" : "rgba(198,154,98,0.34)"}; background:${rememberLogin ? "linear-gradient(180deg,#c9985b,#76502d)" : "rgba(5,4,6,0.9)"}; color:#fff2df; font-size:20px; line-height:1; box-shadow:${rememberLogin ? "0 0 0 3px rgba(180,135,83,0.14)" : "none"};">${rememberLogin ? "✓" : ""}</span>
            <span style="display:grid; gap:2px;">
              <span style="font-size:16px; font-weight:700;">Remember me</span>
              <span style="font-size:12px; color:#b5a692;">Only saves your username</span>
            </span>
          </button>
          <div style="display:flex; gap:10px; margin-top:4px;">
            <button type="submit" ${state.loading ? "disabled" : ""} style="flex:1 1 auto; min-height:50px; padding:0 18px; border:0; border-radius:14px; background:linear-gradient(180deg,#b48753,#6d4828); color:#fff2df; font:inherit; font-size:16px; font-weight:700; cursor:pointer;">${state.loading ? "Signing in..." : "Log in"}</button>
            <button id="skw-open-ucp" type="button" style="min-height:50px; padding:0 18px; border-radius:14px; border:1px solid rgba(198,154,98,0.22); background:rgba(255,255,255,0.04); color:#f1e6d3; font:inherit; font-size:15px; cursor:pointer;">Open UCP</button>
          </div>
        </form>
      `;

      const characterView = `
        <div style="display:grid; gap:16px;">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div>
              <div style="font-size:14px; color:#cfc1ab;">Signed in as</div>
              <div style="font-size:28px;">${escapeHtml(state.accountUsername || "Unknown account")}</div>
            </div>
            <button id="skw-auth-logout" type="button" style="min-height:46px; padding:0 18px; border-radius:14px; border:1px solid rgba(198,154,98,0.22); background:rgba(255,255,255,0.04); color:#f1e6d3; font:inherit; font-size:15px; cursor:pointer;">Log out</button>
          </div>

          <div style="font-size:14px; line-height:1.55; color:#cfc1ab;">Choose which persistent character should enter the world. If a slot is new, name, race, and appearance will be finished in game on first join.</div>

          <div style="display:grid; gap:12px;">${characterCards || `<div style="padding:16px; border-radius:16px; border:1px solid rgba(198,154,98,0.16); background:rgba(16,15,20,0.88); color:#cfc1ab;">No characters yet. Create your first slot below.</div>`}</div>

          ${state.canCreateCharacter ? `
            <form id="skw-auth-create-character-form" style="display:grid; gap:8px;">
              <div style="display:flex; gap:10px; align-items:center; justify-content:space-between; padding:12px 14px; border-radius:14px; border:1px solid rgba(198,154,98,0.14); background:rgba(11,10,15,0.78);">
                <div style="font-size:14px; color:#cfc1ab;">Reserve an empty persistent slot now. The real name gets chosen in race menu.</div>
                <button type="submit" ${state.loading ? "disabled" : ""} style="min-height:48px; padding:0 18px; border:0; border-radius:14px; background:linear-gradient(180deg,#b48753,#6d4828); color:#fff2df; font:inherit; font-size:15px; font-weight:700; cursor:pointer;">Create slot</button>
              </div>
            </form>
          ` : ""}

          <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
            <div style="font-size:14px; color:#cfc1ab;">${selectedCharacter ? `Ready to join as ${escapeHtml(formatCharacterName(selectedCharacter))}.` : "Select a character to continue."}</div>
            <button id="skw-auth-play" type="button" ${state.loading || !selectedCharacter ? "disabled" : ""} style="min-height:52px; padding:0 26px; border:0; border-radius:14px; background:linear-gradient(180deg,#b48753,#6d4828); color:#fff2df; font:inherit; font-size:17px; font-weight:700; cursor:pointer;">${state.loading ? "Working..." : "Play"}</button>
          </div>
        </div>
      `;

      root.innerHTML = `
        <section style="width:min(760px, calc(100% - 48px)); max-height:calc(100vh - 64px); overflow:auto; border:1px solid rgba(198,154,98,0.18); border-radius:28px; background:rgba(18,16,22,0.96); box-shadow:0 24px 60px rgba(0,0,0,0.45); padding:28px 28px 24px;">
          <div style="display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:18px;">
            <div>
              <div style="font-size:12px; letter-spacing:0.22em; text-transform:uppercase; color:#b48753;">Skyrim Unbound</div>
              <h1 style="margin:8px 0 0; font-size:40px; line-height:0.95; font-weight:700;">Account Access</h1>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
              ${state.loggedIn ? `
                <button id="skw-auth-open-site-header" type="button" style="min-height:46px; padding:0 18px; border-radius:14px; border:1px solid rgba(198,154,98,0.22); background:rgba(255,255,255,0.04); color:#f1e6d3; font:inherit; font-size:15px; cursor:pointer;">Open UCP</button>
              ` : ``}
              <button id="skw-auth-exit-game" type="button" style="min-height:46px; padding:0 18px; border-radius:14px; border:1px solid rgba(188,112,96,0.28); background:rgba(58,18,16,0.28); color:#f1d6cd; font:inherit; font-size:15px; cursor:pointer;">Exit game</button>
            </div>
          </div>

          <div style="margin-bottom:18px; padding:14px 16px; border-radius:16px; border:1px solid rgba(198,154,98,0.14); background:rgba(11,10,15,0.78); color:#cfc1ab; line-height:1.5;">
            ${state.loggedIn
              ? "Your account login lives here. Character slots stay persistent, and brand-new slots finish their name and appearance inside Skyrim."
              : "Log in with your Skyrim Unbound account, then choose which persistent character slot should enter the world."}
          </div>

          ${state.error ? `<div style="margin-bottom:14px; padding:12px 14px; border-radius:14px; border:1px solid rgba(210,118,99,0.24); background:rgba(78,24,18,0.28); color:#e6a799;">${escapeHtml(state.error)}</div>` : ""}
          ${state.info ? `<div style="margin-bottom:14px; padding:12px 14px; border-radius:14px; border:1px solid rgba(120,187,141,0.18); background:rgba(23,54,33,0.26); color:#a6d6b2;">${escapeHtml(state.info)}</div>` : ""}

          ${state.loggedIn ? characterView : loginView}
        </section>
      `;

      const loginForm = document.getElementById("skw-auth-login-form");
      if (loginForm) {
        loginForm.addEventListener("submit", function(event: any) {
          event.preventDefault();
          const loginInput = document.getElementById("skw-auth-login") as any;
          const passwordInput = document.getElementById("skw-auth-password") as any;
          const rememberButton = document.getElementById("skw-auth-remember") as any;
          send(eventsMap.ucpLogin, {
            login: loginInput ? loginInput.value : "",
            password: passwordInput ? passwordInput.value : "",
            rememberMe: !!(rememberButton && rememberButton.dataset.remember === "1")
          });
        });
      }

      const rememberButton = document.getElementById("skw-auth-remember") as any;
      if (rememberButton) {
        rememberButton.addEventListener("click", function() {
          const enabled = rememberButton.dataset.remember !== "1";
          rememberButton.dataset.remember = enabled ? "1" : "0";
          rememberButton.style.borderColor = enabled ? "rgba(198,154,98,0.54)" : "rgba(198,154,98,0.18)";
          rememberButton.style.background = enabled ? "rgba(114,78,43,0.26)" : "rgba(255,255,255,0.035)";
          const checkmark = rememberButton.querySelector("[data-checkmark='1']") as any;
          if (checkmark) {
            checkmark.textContent = enabled ? "✓" : "";
            checkmark.style.borderColor = enabled ? "rgba(232,190,126,0.88)" : "rgba(198,154,98,0.34)";
            checkmark.style.background = enabled ? "linear-gradient(180deg,#c9985b,#76502d)" : "rgba(5,4,6,0.9)";
            checkmark.style.boxShadow = enabled ? "0 0 0 3px rgba(180,135,83,0.14)" : "none";
          }
        });
      }

      const createForm = document.getElementById("skw-auth-create-character-form");
      if (createForm) {
        createForm.addEventListener("submit", function(event: any) {
          event.preventDefault();
          send(eventsMap.ucpCreateCharacter, {});
        });
      }

      Array.from((root as any).querySelectorAll("[data-character-id]")).forEach(function(element: any) {
        element.addEventListener("click", function() {
          const characterId = Number(element.getAttribute("data-character-id"));
          send(eventsMap.ucpSelectCharacter, { characterId: characterId });
        });
      });

      const playButton = document.getElementById("skw-auth-play");
      if (playButton) {
        playButton.addEventListener("click", function() {
          send(eventsMap.ucpPlay, { characterId: selectedCharacterId });
        });
      }

      const logoutButton = document.getElementById("skw-auth-logout");
      if (logoutButton) {
        logoutButton.addEventListener("click", function() {
          send(eventsMap.ucpLogout, {});
        });
      }

      const openButtons = [document.getElementById("skw-open-ucp"), document.getElementById("skw-auth-open-site-header")];
      openButtons.forEach(function(button) {
        if (button) {
          button.addEventListener("click", function() {
            send(eventsMap.ucpOpenWebsite, {});
          });
        }
      });

      const exitGameButton = document.getElementById("skw-auth-exit-game");
      if (exitGameButton) {
        const requestExit = function() {
          if ((exitGameButton as any).dataset.exitPending === "1") {
            return;
          }
          (exitGameButton as any).dataset.exitPending = "1";
          exitGameButton.textContent = "Exiting...";
          send(eventsMap.ucpExitGame, { source: "auth-exit-button" });
        };

        exitGameButton.addEventListener("pointerdown", requestExit);
        exitGameButton.addEventListener("mousedown", requestExit);
        exitGameButton.addEventListener("click", requestExit);
      }
    }

    render();
  }

  public readAuthDataFromDisk(): RemoteAuthGameData | null {
    logTrace(this, `Reading`, this.pluginAuthDataName, `from disk`);

    try {
      // @ts-expect-error (TODO: Remove in 2.10.0)
      const data = this.sp.getPluginSourceCode(this.pluginAuthDataName, "PluginsNoLoad");

      if (!data) {
        logTrace(this, `Read empty`, this.pluginAuthDataName, `returning null`);
        return null;
      }

      return JSON.parse(data.slice(2)) || null;
    } catch (e) {
      logError(this, `Error reading`, this.pluginAuthDataName, `from disk:`, e, `, falling back to null`);
      return null;
    }
  }

  private writeAuthDataToDisk(data: RemoteAuthGameData | null) {
    if (data) {
      logTrace(this, `Not persisting`, this.pluginAuthDataName, `because in-game sessions are manual-login only`);
      return;
    }

    const content = "//" + (data ? JSON.stringify(data) : "null");

    logTrace(this, `Writing`, this.pluginAuthDataName, `to disk:`, content);

    try {
      this.sp.writePlugin(
        this.pluginAuthDataName,
        content,
        // @ts-expect-error (TODO: Remove in 2.10.0)
        "PluginsNoLoad"
      );
    } catch (e) {
      logError(this, `Error writing`, this.pluginAuthDataName, `to disk:`, e, `, will not remember user`);
    }
  };

  private readRememberedLoginFromDisk() {
    logTrace(this, `Reading`, this.pluginRememberedLoginName, `from disk`);

    try {
      // @ts-expect-error (TODO: Remove in 2.10.0)
      const data = this.sp.getPluginSourceCode(this.pluginRememberedLoginName, "PluginsNoLoad");
      if (!data) {
        return "";
      }

      const parsed = JSON.parse(data.slice(2)) || {};
      return String(parsed.login || "").trim();
    } catch (e) {
      logError(this, `Error reading`, this.pluginRememberedLoginName, `from disk:`, e);
      return "";
    }
  }

  private writeRememberedLoginToDisk(login: string) {
    const normalizedLogin = String(login || "").trim();
    const content = "//" + JSON.stringify(normalizedLogin ? { login: normalizedLogin } : null);

    logTrace(this, `Writing`, this.pluginRememberedLoginName, `to disk:`, content);

    try {
      this.sp.writePlugin(
        this.pluginRememberedLoginName,
        content,
        // @ts-expect-error (TODO: Remove in 2.10.0)
        "PluginsNoLoad"
      );
    } catch (e) {
      logError(this, `Error writing`, this.pluginRememberedLoginName, `to disk:`, e);
    }
  };

  private deniedWidgetSetter = () => {
    const widget = {
      type: "form",
      id: 2,
      caption: "новинка",
      elements: [
        {
          type: "text",
          text: "ура! вышло обновление",
          tags: []
        },
        {
          type: "text",
          text: "спешите скачать на",
          tags: []
        },
        {
          type: "text",
          text: "skymp.net",
          tags: []
        },
        {
          type: "button",
          text: "открыть skymp.net",
          tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
          click: () => window.skyrimPlatform.sendMessage(events.updateRequired),
          hint: "Перейти на страницу скачивания обновления",
        }
      ]
    }
    window.skyrimPlatform.widgets.set([widget]);

    // Make sure gamemode will not be able to update widgets anymore
    window.skyrimPlatform.widgets = null;
  }

  private loginFailedWidgetSetter = () => {
    const splitParts = browserState.loginFailedReason.split('\n');

    const textElements = splitParts.map((part) => ({
      type: "text",
      text: part,
      tags: [],
    }));

    const widget = {
      type: "form",
      id: 2,
      caption: "упс",
      elements: new Array<any>()
    }

    textElements.forEach((element) => widget.elements.push(element));

    if (browserState.loginFailedReason === 'вступите в discord сервер') {
      widget.elements.push({
        type: "button",
        text: "вступить",
        tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
        click: () => window.skyrimPlatform.sendMessage(events.joinDiscord),
        hint: null
      });
    }

    widget.elements.push({
      type: "button",
      text: "назад",
      tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
      click: () => window.skyrimPlatform.sendMessage(events.backToLogin),
      hint: undefined
    });

    window.skyrimPlatform.widgets.set([widget]);
  }

  private normalizeAuthText(value: string): string {
    const normalized = value
      .replace(/Ð²Ð¾Ð¹Ð´Ð¸Ñ‚Ðµ Ñ‡ÐµÑ€ÐµÐ· discord/g, 'log in via Discord')
      .replace(/Ð²ÑÑ‚ÑƒÐ¿Ð¸Ñ‚Ðµ Ð² discord ÑÐµÑ€Ð²ÐµÑ€/g, 'join the Discord server')
      .replace(/Ð²Ñ‹ Ð·Ð°Ð±Ð°Ð½ÐµÐ½Ñ‹/g, 'you are banned')
      .replace(/Ñ‡Ñ‚Ð¾ ÑÑ‚Ð¾ Ð±Ñ‹Ð»Ð¾\?/g, 'unexpected login state')
      .replace(/Ð¾Ñ‚ÐºÑ€Ñ‹Ð²Ð°ÐµÐ¼ Ð±Ñ€Ð°ÑƒÐ·ÐµÑ€\.\.\./g, 'opening browser...')
      .replace(/ÑÐ½Ð°Ñ‡Ð°Ð»Ð° Ð²Ð¾Ð¹Ð´Ð¸Ñ‚Ðµ/g, 'please sign in first')
      .replace(/Ð¿Ñ€Ð¸Ð²ÑÐ·Ð°Ð½ ÑƒÑÐ¿ÐµÑˆÐ½Ð¾/g, 'linked successfully')
      .replace(/Ñ‚ÐµÑ…Ð½Ð¸Ñ‡ÐµÑÐºÐ¸Ðµ ÑˆÐ¾ÐºÐ¾Ð»Ð°Ð´ÐºÐ¸/g, 'technical hiccup')
      .replace(/Ð¿Ð¾Ð¿Ñ€Ð¾Ð±ÑƒÐ¹Ñ‚Ðµ ÐµÑ‰Ðµ Ñ€Ð°Ð·/g, 'please try again')
      .replace(/Ð¿Ð¾Ð¶Ð°Ð»ÑƒÐ¹ÑÑ‚Ð°/g, 'please')
      .replace(/Ð¸Ð»Ð¸ Ð½Ð°Ð¿Ð¸ÑˆÐ¸Ñ‚Ðµ Ð½Ð°Ð¼ Ð² discord/g, 'or contact us on Discord')
      .replace(/Ð¿Ð¾Ð´ÐºÐ»ÑŽÑ‡ÐµÐ½Ð¸Ðµ/g, 'connecting')
      .replace(/ÑƒÐ¿Ñ/g, 'Login failed')
      .replace(/Ð½Ð¾Ð²Ð¸Ð½ÐºÐ°/g, 'Update required')
      .replace(/Ð²ÑÑ‚ÑƒÐ¿Ð¸Ñ‚ÑŒ/g, 'Join')
      .replace(/Ð½Ð°Ð·Ð°Ð´/g, 'Back')
      .replace(/ÑƒÑ€Ð°! Ð²Ñ‹ÑˆÐ»Ð¾ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ/g, 'A new update is available.')
      .replace(/ÑÐ¿ÐµÑˆÐ¸Ñ‚Ðµ ÑÐºÐ°Ñ‡Ð°Ñ‚ÑŒ Ð½Ð°/g, 'Please download it from')
      .replace(/Ð¾Ñ‚ÐºÑ€Ñ‹Ñ‚ÑŒ skymp\.net/g, 'Open skymp.net')
      .replace(/ÐŸÐµÑ€ÐµÐ¹Ñ‚Ð¸ Ð½Ð° ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñƒ ÑÐºÐ°Ñ‡Ð¸Ð²Ð°Ð½Ð¸Ñ Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ñ/g, 'Open the update download page');

    return normalized;
  }

  private normalizeBrowserState() {
    browserState.comment = this.normalizeAuthText(browserState.comment);
    browserState.loginFailedReason = this.normalizeAuthText(browserState.loginFailedReason);
  }

  private deniedWidgetSetterEn = () => {
    const widget = {
      type: "form",
      id: 2,
      caption: "Update required",
      elements: [
        {
          type: "text",
          text: "A new update is available.",
          tags: []
        },
        {
          type: "text",
          text: "Please download it from",
          tags: []
        },
        {
          type: "text",
          text: "skymp.net",
          tags: []
        },
        {
          type: "button",
          text: "Open skymp.net",
          tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
          click: () => window.skyrimPlatform.sendMessage(events.updateRequired),
          hint: "Open the update download page",
        }
      ]
    }
    window.skyrimPlatform.widgets.set([widget]);
    window.skyrimPlatform.widgets = null;
  }

  private loginFailedWidgetSetterEn = () => {
    const normalizedReason = this.normalizeAuthText(browserState.loginFailedReason);
    const splitParts = normalizedReason.split('\n');

    const textElements = splitParts.map((part) => ({
      type: "text",
      text: part,
      tags: [],
    }));

    const widget = {
      type: "form",
      id: 2,
      caption: "Login failed",
      elements: new Array<any>()
    }

    textElements.forEach((element) => widget.elements.push(element));

    if (normalizedReason === 'join the Discord server') {
      widget.elements.push({
        type: "button",
        text: "Join",
        tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
        click: () => window.skyrimPlatform.sendMessage(events.joinDiscord),
        hint: null
      });
    }

    widget.elements.push({
      type: "button",
      text: "Back",
      tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
      click: () => window.skyrimPlatform.sendMessage(events.backToLogin),
      hint: undefined
    });

    window.skyrimPlatform.widgets.set([widget]);
  }

  private browsersideWidgetSetter = () => {
    const loginWidget = {
      type: "form",
      id: 1,
      caption: "Authorization",
      elements: [
        // {
        //   type: "button",
        //   tags: ["BUTTON_STYLE_GITHUB"],
        //   hint: "get a colored nickname and mention in news",
        //   click: () => window.skyrimPlatform.sendMessage(events.openGithub),
        // },
        // {
        //   type: "button",
        //   tags: ["BUTTON_STYLE_PATREON", "ELEMENT_SAME_LINE", "HINT_STYLE_RIGHT"],
        //   hint: "get a colored nickname and other bonuses for patrons",
        //   click: () => window.skyrimPlatform.sendMessage(events.openPatreon),
        // },
        // {
        //   type: "icon",
        //   text: "username",
        //   tags: ["ICON_STYLE_SKYMP"],
        // },
        // {
        //   type: "icon",
        //   text: "",
        //   tags: ["ICON_STYLE_DISCORD"],
        // },
        {
          type: "text",
          text: (
            authData ? (
              authData.discordUsername
                ? `${authData.discordUsername}`
                : `id: ${authData.masterApiId}`
            ) : "Not authorized"
          ),
          tags: [/*"ELEMENT_SAME_LINE", "ELEMENT_STYLE_MARGIN_EXTENDED"*/],
        },
        // {
        //   type: "icon",
        //   text: "discord",
        //   tags: ["ICON_STYLE_DISCORD"],
        // },
        {
          type: "button",
          text: authData ? "Change account" : "Log in via SkyMP",
          tags: [/*"ELEMENT_SAME_LINE"*/],
          click: () => window.skyrimPlatform.sendMessage(events.openDiscordOauth),
          hint: "You can sign in or switch accounts",
        },
        {
          type: "button",
          text: "Play",
          tags: ["BUTTON_STYLE_FRAME", "ELEMENT_STYLE_MARGIN_EXTENDED"],
          click: () => window.skyrimPlatform.sendMessage(events.authAttempt),
          hint: "Connect to the game server",
        },
        {
          type: "text",
          text: browserState.comment,
          tags: [],
        },
      ]
    };
    window.skyrimPlatform.widgets.set([loginWidget]);
  };

  private ucpWidgetFallbackSetter = () => {
    const state = authUiState || {};
    const eventsMap = events || {};

    if (document.getElementById("skw-auth-root")) {
      return;
    }

    const fallbackKey = "__skwUcpFallbackState";
    const existingState = (window as any)[fallbackKey] || {};
    (window as any)[fallbackKey] = {
      login: typeof existingState.login === "string" ? existingState.login : String(state.rememberedLogin || ""),
      password: typeof existingState.password === "string" ? existingState.password : "",
      rememberMe: typeof existingState.rememberMe === "boolean" ? existingState.rememberMe : state.rememberLogin === true,
    };

    function send(eventName: string, payload?: Record<string, unknown>) {
      if (window.skyrimPlatform && window.skyrimPlatform.sendMessage) {
        window.skyrimPlatform.sendMessage(eventName, JSON.stringify(payload || {}));
      }
    }

    function getInputState() {
      return (window as any)[fallbackKey] || { login: "", password: "" };
    }

    function formatCharacterName(character: any) {
      const raw = String(character?.name || "").trim();
      if (raw) {
        return raw.replace(/\s+/g, " ").split(" ").map((word: string) => {
          const lowerWord = word.toLocaleLowerCase();
          return `${lowerWord.slice(0, 1).toLocaleUpperCase()}${lowerWord.slice(1)}`;
        }).join(" ");
      }
      const slotIndex = Number(character?.slot_index || 0) || "?";
      return `Unnamed slot ${slotIndex}`;
    }

    const widget = {
      type: "form",
      id: 91,
      caption: "Skyrim Unbound",
      elements: new Array<any>(),
    };

    if (state.loggedIn) {
      widget.elements.push({
        type: "text",
        text: `Signed in as ${String(state.accountUsername || "Unknown account")}`,
        tags: [],
      });

      const characters = Array.isArray(state.characters) ? state.characters : [];
      if (!characters.length) {
        widget.elements.push({
          type: "text",
          text: "No character slots found. Open the UCP or create your first slot there.",
          tags: [],
        });
      } else {
        widget.elements.push({
          type: "text",
          text: `Selected character: ${String(state.selectedCharacterName || "None")}`,
          tags: [],
        });

        characters.forEach((character: any, index: number) => {
          const characterId = Number(character?.id || 0);
          const selected = Number(state.selectedCharacterId) === characterId;
          widget.elements.push({
            type: "button",
            text: `${selected ? "[Selected] " : ""}${formatCharacterName(character)}`,
            tags: index === 0 ? ["ELEMENT_STYLE_MARGIN_EXTENDED"] : [],
            click: () => send(eventsMap.ucpSelectCharacter, { characterId }),
            hint: "Select this character",
          });
        });

        widget.elements.push({
          type: "button",
          text: state.loading ? "Loading..." : "Play",
          tags: ["BUTTON_STYLE_FRAME", "ELEMENT_STYLE_MARGIN_EXTENDED"],
          isDisabled: !!state.loading || !Number.isInteger(Number(state.selectedCharacterId)),
          click: () => send(eventsMap.ucpPlay, { characterId: Number(state.selectedCharacterId) }),
          hint: "Join the game with the selected character",
        });
      }

      widget.elements.push({
        type: "button",
        text: "Open UCP",
        tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
        click: () => send(eventsMap.ucpOpenWebsite),
        hint: "Open the web panel",
      });
      widget.elements.push({
        type: "button",
        text: "Log out",
        tags: [],
        click: () => send(eventsMap.ucpLogout),
        hint: "Sign out of this account",
      });
    } else {
      const inputState = getInputState();
      widget.elements.push({
        type: "inputText",
        text: "Username or email",
        initialValue: inputState.login || "",
        placeholder: "Account name",
        onInput: (event: any) => {
          const nextState = getInputState();
          nextState.login = String(event?.target?.value || "");
          (window as any)[fallbackKey] = nextState;
        },
      });
      widget.elements.push({
        type: "inputPass",
        text: "Password",
        initialValue: inputState.password || "",
        placeholder: "Password",
        onInput: (event: any) => {
          const nextState = getInputState();
          nextState.password = String(event?.target?.value || "");
          (window as any)[fallbackKey] = nextState;
        },
      });
      widget.elements.push({
        type: "button",
        text: inputState.rememberMe ? "Remember me: On" : "Remember me: Off",
        tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
        click: () => {
          const nextState = getInputState();
          nextState.rememberMe = !nextState.rememberMe;
          (window as any)[fallbackKey] = nextState;
        },
        hint: "Only remember the username after a successful login",
      });
      widget.elements.push({
        type: "button",
        text: state.loading ? "Signing in..." : "Log in",
        tags: ["BUTTON_STYLE_FRAME", "ELEMENT_STYLE_MARGIN_EXTENDED"],
        isDisabled: !!state.loading,
        click: () => {
          const nextState = getInputState();
          send(eventsMap.ucpLogin, {
            login: String(nextState.login || ""),
            password: String(nextState.password || ""),
            rememberMe: nextState.rememberMe === true,
          });
        },
        hint: "Sign in to Skyrim Unbound",
      });
      widget.elements.push({
        type: "button",
        text: "Open UCP",
        tags: [],
        click: () => send(eventsMap.ucpOpenWebsite),
        hint: "Open the web panel",
      });
    }

    if (state.info) {
      widget.elements.push({
        type: "text",
        text: String(state.info),
        tags: [],
      });
    }

    if (state.error) {
      widget.elements.push({
        type: "text",
        text: String(state.error),
        tags: [],
      });
    }

    widget.elements.push({
      type: "button",
      text: "Exit game",
      tags: ["ELEMENT_STYLE_MARGIN_EXTENDED"],
      click: () => send(eventsMap.ucpExitGame, { source: "fallback-widget" }),
      hint: "Close Skyrim",
    });

    window.skyrimPlatform.widgets.set([widget]);
  };

  private handleConnectionDenied(e: ConnectionDenied) {
    this.authAttemptProgressIndicator = false;

    if (e.error.toLowerCase().includes("invalid password")) {
      this.controller.once("tick", () => {
        this.controller.lookupListener(NetworkingService).close();
      });
      this.ucpUiState.loading = false;
      this.ucpUiState.error = "Join session expired or was rejected. Please choose your character and press Play again.";
      this.ensureAuthBrowserPageLoaded("connectionDenied");
      this.refreshWidgets();
      this.sp.browser.setVisible(true);
      this.sp.browser.setFocused(true);
      this.controller.once("update", () => {
        this.sp.Game.disablePlayerControls(true, true, true, true, true, true, true, true, 0);
      });
      this.setListenBrowserMessage(true, 'connectionDenied event received');
    }
  }

  private handleConnectionFailed(_e: ConnectionFailed) {
    this.authAttemptProgressIndicator = false;

    this.controller.once("tick", () => {
      this.controller.lookupListener(NetworkingService).close();
    });
    this.ucpUiState.loading = false;
    this.ucpUiState.error = "Could not reach the gameplay server. Check the server address and press Play again.";
    this.ensureAuthBrowserPageLoaded("connectionFailed");
    this.refreshWidgets();
    this.sp.browser.setVisible(true);
    this.sp.browser.setFocused(true);
    this.controller.once("update", () => {
      this.sp.Game.disablePlayerControls(true, true, true, true, true, true, true, true, 0);
    });
    this.setListenBrowserMessage(true, 'connectionFailed event received');
  }

  private handleConnectionAccepted() {
    this.setListenBrowserMessage(false, 'connectionAccepted event received');
    this.cancelPendingAuthUiRefreshes("connectionAccepted");
    this.authDialogOpen = false;
    this.onlineAuthUiMounted = false;
    this.onlineAuthBootstrapPending = false;
    this.trigger.frontLoadedFired = false;
    this.sp.browser.setFocused(false);
    this.sp.browser.setVisible(false);
    this.closeGameplayTransitionMenus("connectionAccepted");
    this.restoreGameplayBrowserPage("connectionAccepted");
    this.loggingStartMoment = Date.now();

    const authData = this.sp.storage[authGameDataStorageKey] as AuthGameData | undefined;
    if (authData?.local) {
      logTrace(this,
        `Logging in offline mode, profileId =`, authData.local.profileId
      );
      const message: CustomPacketMessage = {
        t: MsgType.CustomPacket,
        contentJsonDump: JSON.stringify({
          customPacketType: 'loginWithSkympIo',
          gameData: {
            profileId: authData.local.profileId,
          },
        }),
      };
      this.controller.emitter.emit("sendMessage", {
        message: message,
        reliability: "reliable"
      });
      return;
    }

    if (authData?.remote) {
      logTrace(this, 'Logging in as a Skyrim Unbound remote user');
      const message: CustomPacketMessage = {
        t: MsgType.CustomPacket,
        contentJsonDump: JSON.stringify({
          customPacketType: 'loginWithSkympIo',
          gameData: {
            session: authData.remote.playSession || authData.remote.session,
          },
        }),
      };
      this.controller.emitter.emit("sendMessage", {
        message: message,
        reliability: "reliable"
      });
      return;
    }

    logError(this, 'Not found authentication method');
  };

  private onTick() {
    // TODO: Should be no hardcoded/magic-number limit
    // TODO: Busy waiting is bad. Should be replaced with some kind of event
    const maxLoggingDelay = 15000;
    if (this.loggingStartMoment && Date.now() - this.loggingStartMoment > maxLoggingDelay) {
      logTrace(this, 'Max logging delay reached received');

      if (this.playerEverSawActualGameplay) {
        logTrace(this, 'Player saw actual gameplay, reconnecting');
        this.loggingStartMoment = 0;
        this.controller.lookupListener(NetworkingService).reconnect();
        // TODO: should we prompt user to relogin?
      } else {
        logTrace(this, 'Player never saw actual gameplay, showing login dialog');
        this.loggingStartMoment = 0;
        this.authAttemptProgressIndicator = false;
        this.controller.lookupListener(NetworkingService).close();
        browserState.comment = "";
        browserState.loginFailedReason = 'технические шоколадки\nпопробуйте еще раз\nпожалуйста\nили напишите нам в discord';
        this.normalizeBrowserState();
        this.sp.browser.executeJavaScript(new FunctionInfo(this.loginFailedWidgetSetterEn).getText({ events, browserState, authData: authData }));

        authData = null;
        this.writeAuthDataToDisk(null);
      }
    }

    if (this.authAttemptProgressIndicator) {
      this.authAttemptProgressIndicatorCounter++;

      if (this.authAttemptProgressIndicatorCounter === 1000000) {
        this.authAttemptProgressIndicatorCounter = 0;
      }

      const slowCounter = Math.floor(this.authAttemptProgressIndicatorCounter / 15);

      const dot = slowCounter % 3 === 0 ? '.' : slowCounter % 3 === 1 ? '..' : '...';

      browserState.comment = "подключение" + dot;
      this.refreshWidgets();
    }
  }

  private onceUpdate() {
    this.runQueuedGameExit("onceUpdate");
    this.playerEverSawActualGameplay = true;
  }

  private requestImmediateGameExit(source: string) {
    if (this.gameExitStarted) {
      return;
    }

    this.gameExitQueued = true;
    this.recordExitDebug(`request:${source}`);

    try {
      this.controller.lookupListener(NetworkingService).close();
    } catch (error) {
      this.recordExitDebug(`network-close-error:${error}`);
      logError(this, "Failed to close networking before exit", error);
    }

    this.runQueuedGameExit(`immediate:${source}`);
    this.controller.once("update", () => this.runQueuedGameExit("queued-update"));
    this.controller.once("tick", () => this.runQueuedGameExit("queued-tick"));
  }

  private runQueuedGameExit(source: string) {
    if (!this.gameExitQueued) {
      return;
    }

    this.recordExitDebug(`run:${source}`);
    if (this.gameExitStarted) {
      return;
    }

    this.gameExitStarted = true;
    logTrace(this, `Running queued game exit from ${source}`);

    try {
      const quitGame = (this.sp.Game as any).quitGame;
      if (typeof quitGame === "function") {
        quitGame.call(this.sp.Game);
      }
    } catch (error) {
      this.recordExitDebug(`quitGame-error:${error}`);
      logError(this, "Graceful quitGame call failed", error);
    }

    this.attemptHardExit("run-immediate");
    setTimeout(() => this.attemptHardExit("timeout-250ms"), 250);
    setTimeout(() => this.attemptHardExit("timeout-1000ms"), 1000);
  }

  private attemptHardExit(source: string) {
    this.recordExitDebug(`exitProcess:${source}`);
    try {
      this.sp.win32.exitProcess();
    } catch (error) {
      this.recordExitDebug(`exitProcess-error:${error}`);
      logError(this, "Hard exitProcess fallback failed", error);
    }
  }

  private recordExitDebug(stage: string) {
    try {
      this.sp.writePlugin(
        this.exitDebugPluginName,
        "//" + JSON.stringify({
          updatedAt: new Date().toISOString(),
          stage,
          gameExitQueued: this.gameExitQueued,
          gameExitStarted: this.gameExitStarted,
        }),
        // @ts-expect-error Skyrim Platform runtime API
        "PluginsNoLoad"
      );
    } catch {
      // Best-effort debug only.
    }
  }

  private recordAuthUiDebug(stage: string, extra?: Record<string, unknown>) {
    void stage;
    void extra;
  }

  private isListenBrowserMessage() {
    return this._isListenBrowserMessage;
  }

  private setListenBrowserMessage(value: boolean, reason: string) {
    logTrace(this, `setListenBrowserMessage:`, value, `reason:`, reason);
    this._isListenBrowserMessage = value;
  }

  private _isListenBrowserMessage = false;

  private trigger = {
    authNeededFired: false,
    browserWindowLoadedFired: false,
    frontLoadedFired: false,

    get conditionMet() {
      return this.authNeededFired && this.browserWindowLoadedFired
    }
  };
  private discordAuthState = crypto.randomBytes(32).toString('hex');
  private authDialogOpen = false;

  private loggingStartMoment = 0;

  private authAttemptProgressIndicator = false;
  private authAttemptProgressIndicatorCounter = 0;
  private ucpUiState = {
    loading: false,
    error: "",
    info: "",
    characters: [] as Array<Record<string, unknown>>,
    selectedCharacterId: null as number | null,
    rememberedLogin: "",
    rememberLogin: false,
  };

  private playerEverSawActualGameplay = false;
  private gameExitQueued = false;
  private gameExitStarted = false;
  private onlineAuthBootstrapPending = false;
  private onlineAuthBootstrapGeneration = 0;
  private onlineAuthUiMounted = false;
  private authUiBootedAt = 0;
  private authUiRefreshGeneration = 0;
  private inFlightUcpSessionRefresh: string | null = null;

  private readonly githubUrl = "https://github.com/skyrim-multiplayer/skymp";
  private readonly patreonUrl = "https://www.patreon.com/skymp";
  private readonly pluginAuthDataName = `auth-data-no-load`;
  private readonly pluginRememberedLoginName = `auth-remembered-login`;
  private readonly exitDebugPluginName = `auth-exit-debug`;
  private readonly authUiDebugPluginName = `auth-ui-debug`;
  private readonly authUiDebugEntryLimit = 80;
  private authUiDebugEntries: Array<Record<string, unknown>> = [];
  private readonly frontLoadedEventKey = "front-loaded-auth";
  private readonly gameplayBrowserUrl = "file:///Data/Platform/UI/ui.html?v=skyrim-unbound-ui-20260422-10";
  private readonly authBrowserUrl = "file:///Data/Platform/UI/auth.html?v=skyrim-unbound-auth-20260422-9";
}
