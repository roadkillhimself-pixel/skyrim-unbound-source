const Koa = require("koa");
const serve = require("koa-static");
const Router = require("koa-router");
const auth = require("koa-basic-auth");
import * as koaBody from "koa-body";
import * as http from "http";
import { Settings } from "./settings";
import Axios from "axios";
import { Duplex } from "stream";
import { register, getAggregatedMetrics, rpcCallsCounter, rpcDurationHistogram } from "./systems/metricsSystem";
import { attachUcpRoutes } from "./ucp";
import { attachAdminRoutes, createAdminStaticAccessMiddleware } from "./admin";
import { shouldRejectCrossOriginBrowserRequest, shouldUseSecureCookies } from "./httpSecurity";

let gScampServer: any = null;

let metricsAuth: { user: string; password: string } | null = null;
const isLegacyLauncherPath = (pathRaw: unknown) => {
  const path = String(pathRaw || "");
  return path === "/launcher" || path.startsWith("/launcher/");
};

const isMarketingSitePath = (pathRaw: unknown) => {
  const path = String(pathRaw || "");
  return path === ""
    || path === "/"
    || path === "/index.html"
    || path.startsWith("/landing")
    || path.startsWith("/terms")
    || path.startsWith("/privacy")
    || path.startsWith("/payments");
};

const APP_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self'",
  "img-src 'self' data: blob: https://challenges.cloudflare.com",
  "font-src 'self' data:",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
].join("; ");

const MARKETING_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "object-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://challenges.cloudflare.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com https://www.youtube-nocookie.com",
].join("; ");

const DEV_SERVER_HTTP_HEADER_EXCLUSIONS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

const shouldProxyToDevServer = (pathRaw: unknown) => {
  const path = String(pathRaw || "");
  return path.startsWith("/ui/")
    || path === "/ws"
    || path.startsWith("/ws/")
    || path.startsWith("/sockjs-node");
};

const mapDevProxyPath = (pathRaw: unknown) => {
  const path = String(pathRaw || "");
  return path.startsWith("/ui/") ? path.slice(3) : path;
};

const sanitizeProxyHeaders = (headersRaw: http.IncomingHttpHeaders, targetPort: number) => {
  const headers: Record<string, string | string[]> = {};
  Object.entries(headersRaw || {}).forEach(([key, value]) => {
    if (value === undefined || DEV_SERVER_HTTP_HEADER_EXCLUSIONS.has(key.toLowerCase())) {
      return;
    }
    headers[key] = value;
  });
  headers.host = `localhost:${targetPort}`;
  return headers;
};

const writeProxyFailure = (res: http.ServerResponse) => {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.statusCode = 502;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("UI dev proxy is unavailable");
};

const proxyHttpRequestToDevServer = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  devServerPort: number
) => {
  const proxyReq = http.request({
    hostname: "localhost",
    port: devServerPort,
    method: req.method,
    path: mapDevProxyPath(req.url),
    headers: sanitizeProxyHeaders(req.headers, devServerPort),
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.statusMessage, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on("error", () => writeProxyFailure(res));
  req.pipe(proxyReq);
};

const writeUpgradeResponse = (
  socket: Duplex,
  statusCode: number,
  statusMessage: string,
  headersRaw: http.IncomingHttpHeaders
) => {
  const statusLine = `HTTP/1.1 ${statusCode} ${statusMessage}\r\n`;
  socket.write(statusLine);
  Object.entries(headersRaw || {}).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => socket.write(`${key}: ${entry}\r\n`));
      return;
    }
    socket.write(`${key}: ${value}\r\n`);
  });
  socket.write("\r\n");
};

const proxyWebSocketUpgradeToDevServer = (
  req: http.IncomingMessage,
  socket: Duplex,
  head: Buffer,
  devServerPort: number
) => {
  const proxyReq = http.request({
    hostname: "localhost",
    port: devServerPort,
    method: req.method,
    path: mapDevProxyPath(req.url),
    headers: {
      ...sanitizeProxyHeaders(req.headers, devServerPort),
      connection: "Upgrade",
      upgrade: String(req.headers.upgrade || "websocket"),
    },
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    const upstreamSocket = proxySocket as Duplex;
    writeUpgradeResponse(
      socket,
      proxyRes.statusCode || 101,
      proxyRes.statusMessage || "Switching Protocols",
      proxyRes.headers
    );
    if (proxyHead.length) {
      socket.write(proxyHead);
    }
    if (head.length) {
      upstreamSocket.write(head);
    }
    upstreamSocket.pipe(socket);
    socket.pipe(upstreamSocket);
  });

  proxyReq.on("response", (proxyRes) => {
    writeUpgradeResponse(
      socket,
      proxyRes.statusCode || 502,
      proxyRes.statusMessage || "Bad Gateway",
      proxyRes.headers
    );
    proxyRes.resume();
    socket.end();
  });

  proxyReq.on("error", () => socket.destroy());
  proxyReq.end();
};

const metricsAuthParse = (settings: Settings): void => {
  const authConfig = settings.allSettings?.metricsAuth as { user?: string; password?: string } | undefined;
  if (!authConfig) {
    console.log('Metrics auth is not configured, so it will be inaccessible. Set metricsAuth setting to activate');
    return;
  }
  if (!authConfig.user || !authConfig.password) {
    console.error('metricsAuth setting must contain user and password fields');
    return;
  }
  metricsAuth = { user: authConfig.user, password: authConfig.password };
}

const createApp = (settings: Settings) => {
  const app = new Koa();
  app.use(koaBody.default({
    multipart: false,
    jsonLimit: "1mb",
    formLimit: "64kb",
    textLimit: "64kb",
  }));

  app.use(async (ctx: any, next: any) => {
    try {
      await next();
    } catch (err: any) {
      if (401 === err.status) {
        ctx.status = 401;
        ctx.set("WWW-Authenticate", "Basic realm=\"metrics\"");
      } else {
        throw err;
      }
    }
  });

  app.use(async (ctx: any, next: any) => {
    if (shouldUseSecureCookies(settings, ctx)) {
      ctx.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    if (!isLegacyLauncherPath(ctx.path)) {
      ctx.set(
        "Content-Security-Policy",
        isMarketingSitePath(ctx.path) ? MARKETING_CONTENT_SECURITY_POLICY : APP_CONTENT_SECURITY_POLICY
      );
      ctx.set("Cross-Origin-Opener-Policy", "same-origin");
      ctx.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
      ctx.set("Referrer-Policy", "no-referrer");
      ctx.set("X-Content-Type-Options", "nosniff");
      ctx.set("X-Frame-Options", "DENY");
    }

    await next();
  });

  app.use(async (ctx: any, next: any) => {
    const requestPath = String(ctx.path || "");
    const isApiRequest = requestPath.startsWith("/ucp/api/")
      || requestPath.startsWith("/admin/api/");

    if (isApiRequest) {
      ctx.set("Cache-Control", "no-store");
      ctx.set("Pragma", "no-cache");
      ctx.set("Expires", "0");
      ctx.vary("Authorization");
      ctx.vary("Cookie");
      ctx.vary("Origin");
      ctx.vary("Referer");
      ctx.vary("Sec-Fetch-Site");
      ctx.vary("X-Ucp-Session");

      if (shouldRejectCrossOriginBrowserRequest(settings, ctx)) {
        ctx.status = 403;
        ctx.body = { error: "Cross-site browser request denied" };
        return;
      }
    }

    await next();
  });

  const router = new Router();
  router.get(new RegExp("/scripts/.*"), (ctx: any) => ctx.throw(403));
  router.get(new RegExp("\.es[mpl]"), (ctx: any) => ctx.throw(403));
  router.get(new RegExp("\.bsa"), (ctx: any) => ctx.throw(403));

  router.post("/rpc/:rpcClassName", (ctx: any) => {
    const { rpcClassName } = ctx.params;
    const { payload } = ctx.request.body;

    rpcCallsCounter.inc({ rpcClassName });
    const endTimer = rpcDurationHistogram.startTimer({ rpcClassName });

    try {
      if (gScampServer.onHttpRpcRunAttempt) {
        ctx.body = gScampServer.onHttpRpcRunAttempt(rpcClassName, payload);
      }
    } finally {
      endTimer();
    }
  });

  router.use('/metrics', (ctx: any, next: any) => {
    console.log(`Metrics requested by ${ctx.request.ip}`);
    return next();
  });

  if (metricsAuth) {
    if (metricsAuth.password !== "I know what I'm doing, disable metrics auth") {
      router.use("/metrics", auth({ name: metricsAuth.user, pass: metricsAuth.password }));
    }
    router.get("/metrics", async (ctx: any) => {
      ctx.set("Content-Type", register.contentType);
      ctx.body = await getAggregatedMetrics(gScampServer);
    });
  } else {
    router.get("/metrics", async (ctx: any) => {
      ctx.throw(401);
      console.error("Metrics endpoint is protected by authentication, but no credentials are configured");
    });
  }

  attachUcpRoutes(router, settings);
  attachAdminRoutes(router, settings);

  app.use(createAdminStaticAccessMiddleware(settings));
  app.use(router.routes()).use(router.allowedMethods());
  app.use(serve("data"));
  return app;
};

export const setServer = (scampServer: any) => {
  gScampServer = scampServer;
};

export const main = (settings: Settings): void => {
  metricsAuthParse(settings);
  const devServerPort = 1234;

  const uiListenHost = settings.allSettings.uiListenHost as (string | undefined);
  const uiPort = settings.port === 7777 ? 3000 : settings.port + 1;

  Axios({
    method: "get",
    url: `http://localhost:${devServerPort}`,
  })
    .then(() => {
      console.log(`UI dev server has been detected on port ${devServerPort}`);
      const appStatic = createApp(settings);
      const appStaticCallback = appStatic.callback();
      const server = http.createServer((req, res) => {
        if (shouldProxyToDevServer(req.url)) {
          proxyHttpRequestToDevServer(req, res, devServerPort);
          return;
        }
        appStaticCallback(req, res);
      });
      server.on("upgrade", (req, socket, head) => {
        if (!shouldProxyToDevServer(req.url)) {
          socket.destroy();
          return;
        }
        proxyWebSocketUpgradeToDevServer(req, socket, head, devServerPort);
      });
      console.log(`Server resources folder is listening on ${uiPort}`);
      server.listen(uiPort, uiListenHost);
    })
    .catch(() => {
      const app = createApp(settings);
      console.log(`Server resources folder is listening on ${uiPort}`);
      const server = http.createServer(app.callback());
      server.listen(uiPort, uiListenHost);
    });
};
