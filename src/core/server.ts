/**
 * `serve` mode: a localhost-only control API plus persistent injection
 * sessions.
 *
 * The injected settings panel (src/panel) talks to this API to read and change
 * the live configuration. Injection connections are held open so that
 * Page.addScriptToEvaluateOnNewDocument keeps re-running across renderer
 * reloads for as long as this process lives — no polling reinjection needed
 * while a session is healthy.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  CdpConnection,
  buildBootstrapScript,
  buildResetScript,
  listTargets,
  pickRendererTargets,
} from "./cdp.js";
import { buildPayload, DEFAULT_CONFIG, type BeautifyConfig } from "./inject.js";
import { loadWallpaper, type WallpaperAssets } from "./monet.js";
import { buildPanelScript } from "../panel/panelScript.js";
import { dataDir, loadConfig, saveConfig } from "./launch.js";

const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024;
const MAX_BODY_BYTES = MAX_WALLPAPER_BYTES + 1024 * 1024;
const POLL_MS = 1500;

export interface ServeOptions {
  cdpPort: number;
  apiPort: number;
}

interface HeldSession {
  conn: CdpConnection;
  themeScriptId?: string;
}

// One decoded image + extracted theme, reused across slider updates so the
// panel feels instant. Invalidated whenever the wallpaper file changes.
let cachedAssets: { file: string; mtimeMs: number; assets: WallpaperAssets } | undefined;

async function getAssets(wallpaperPath?: string): Promise<WallpaperAssets | undefined> {
  if (!wallpaperPath || !fs.existsSync(wallpaperPath)) return undefined;
  const mtimeMs = fs.statSync(wallpaperPath).mtimeMs;
  if (cachedAssets?.file === wallpaperPath && cachedAssets.mtimeMs === mtimeMs) {
    return cachedAssets.assets;
  }
  const assets = await loadWallpaper(wallpaperPath);
  cachedAssets = { file: wallpaperPath, mtimeMs, assets };
  return assets;
}

function currentConfig(): BeautifyConfig {
  return { ...DEFAULT_CONFIG, ...loadConfig() };
}

function backupFile(): string {
  return path.join(dataDir(), "config.backup.json");
}

function hasBackup(): boolean {
  return fs.existsSync(backupFile());
}

function publicConfig(config: BeautifyConfig) {
  return {
    blur: config.blur,
    dim: config.dim,
    monet: config.monet,
    wallpaperVisible: config.wallpaperVisible,
    fit: config.fit,
    wallpaperSet: Boolean(config.wallpaperPath && fs.existsSync(config.wallpaperPath)),
    hasBackup: hasBackup(),
    cdpPort: config.port,
  };
}

function sanitize(body: any): Partial<BeautifyConfig> {
  const out: Partial<BeautifyConfig> = {};
  if (typeof body?.blur === "number" && body.blur >= 0 && body.blur <= 100) out.blur = body.blur;
  if (typeof body?.dim === "number" && body.dim >= 0 && body.dim <= 100) out.dim = body.dim;
  if (typeof body?.monet === "boolean") out.monet = body.monet;
  if (typeof body?.wallpaperVisible === "boolean") out.wallpaperVisible = body.wallpaperVisible;
  if (body?.fit === "cover" || body?.fit === "contain" || body?.fit === "smart") out.fit = body.fit;
  return out;
}

// --- injection session management -------------------------------------------

const held = new Map<string, HeldSession>();

async function registerScript(
  session: HeldSession,
  source: string
): Promise<string> {
  const { identifier } = await session.conn.send("Page.addScriptToEvaluateOnNewDocument", { source });
  return identifier;
}

async function holdSession(
  target: { id: string; webSocketDebuggerUrl?: string },
  config: BeautifyConfig,
  apiPort: number
): Promise<void> {
  if (!target.webSocketDebuggerUrl) return;
  const conn = await CdpConnection.connect(target.webSocketDebuggerUrl);
  await conn.send("Page.enable");
  const session: HeldSession = { conn };

  const assets = await getAssets(config.wallpaperPath);
  const payload = buildPayload(config, assets);
  const bootstrap = buildBootstrapScript({
    css: payload.css,
    wallpaperDataUri: payload.wallpaperDataUri,
    fit: payload.fit,
  });
  const { identifier } = await conn.send("Page.addScriptToEvaluateOnNewDocument", {
    source: bootstrap,
  });
  session.themeScriptId = identifier;
  await conn.send("Runtime.evaluate", { expression: bootstrap, returnByValue: true });

  const panelScript = buildPanelScript(apiPort);
  await conn.send("Page.addScriptToEvaluateOnNewDocument", { source: panelScript });
  await conn.send("Runtime.evaluate", { expression: panelScript, returnByValue: true });

  held.set(target.id, session);
}

/** Re-evaluates the theme bootstrap in every live session after a config change. */
async function pushConfigToSessions(config: BeautifyConfig): Promise<number> {
  const assets = await getAssets(config.wallpaperPath);
  const payload = buildPayload(config, assets);
  const bootstrap = buildBootstrapScript({
    css: payload.css,
    wallpaperDataUri: payload.wallpaperDataUri,
    fit: payload.fit,
  });
  let ok = 0;
  for (const [id, session] of held) {
    try {
      if (session.themeScriptId) {
        await session.conn
          .send("Page.removeScriptToEvaluateOnNewDocument", { identifier: session.themeScriptId })
          .catch(() => {});
      }
      session.themeScriptId = await registerScript(session, bootstrap);
      await session.conn.send("Runtime.evaluate", { expression: bootstrap, returnByValue: true });
      ok++;
    } catch {
      session.conn.close();
      held.delete(id);
    }
  }
  return ok;
}

async function poll(config: BeautifyConfig, apiPort: number): Promise<void> {
  try {
    const targets = pickRendererTargets(await listTargets(config.port));
    const current = new Set(targets.map((t) => t.id));
    for (const t of targets) {
      if (!held.has(t.id)) {
        try {
          await holdSession(t, config, apiPort);
          console.log(`serve: panel + theme injected into "${t.title}" (${t.id})`);
        } catch {
          /* retry next tick */
        }
      }
    }
    for (const id of [...held.keys()]) {
      if (!current.has(id)) {
        held.get(id)!.conn.close();
        held.delete(id);
      }
    }
  } catch {
    /* CDP not reachable; keep polling */
  }
}

// --- HTTP API ----------------------------------------------------------------

function sendJson(res: http.ServerResponse, code: number, body: unknown): void {
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(body));
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
};

export async function startServe(opts: ServeOptions): Promise<void> {
  const { cdpPort, apiPort } = opts;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    try {
      if (req.method === "OPTIONS") {
        sendJson(res, 204, {});
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/config") {
        sendJson(res, 200, publicConfig(currentConfig()));
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/config") {
        const patch = sanitize(JSON.parse(await readBody(req)));
        const config = { ...currentConfig(), ...patch };
        saveConfig(config);
        const windows = await pushConfigToSessions(config).catch(() => 0);
        sendJson(res, 200, { ok: true, windows, ...publicConfig(config) });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/wallpaper") {
        const body = JSON.parse(await readBody(req));
        const dataUri = typeof body?.dataUri === "string" ? body.dataUri : "";
        const m = /^data:(image\/(?:jpeg|png|webp|gif|bmp));base64,(.+)$/.exec(dataUri);
        if (!m) throw new Error("dataUri must be a base64 image data URI");
        const bytes = Buffer.from(m[2], "base64");
        if (bytes.length > MAX_WALLPAPER_BYTES) {
          throw new Error(`image too large (max ${MAX_WALLPAPER_BYTES / 1024 / 1024} MB)`);
        }
        const config = currentConfig();
        fs.mkdirSync(dataDir(), { recursive: true });
        const dest = path.join(dataDir(), "wallpaper" + IMAGE_EXT[m[1]]);
        fs.writeFileSync(dest, bytes);
        cachedAssets = { file: dest, mtimeMs: fs.statSync(dest).mtimeMs, assets: await loadWallpaper(dest) };
        saveConfig({ ...config, wallpaperPath: dest });
        const windows = await pushConfigToSessions({ ...config, wallpaperPath: dest }).catch(() => 0);
        sendJson(res, 200, { ok: true, windows, ...publicConfig({ ...config, wallpaperPath: dest }) });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/reset") {
        const stored = loadConfig();
        // Back up the wallpaper config so /api/restore can bring it back
        // without re-importing the image.
        if (stored.wallpaperPath && fs.existsSync(stored.wallpaperPath)) {
          fs.mkdirSync(dataDir(), { recursive: true });
          fs.writeFileSync(backupFile(), JSON.stringify(stored));
        }
        for (const [id, session] of held) {
          try {
            if (session.themeScriptId) {
              await session.conn
                .send("Page.removeScriptToEvaluateOnNewDocument", { identifier: session.themeScriptId })
                .catch(() => {});
              session.themeScriptId = undefined;
            }
            await session.conn.send("Runtime.evaluate", { expression: buildResetScript() });
          } catch {
            session.conn.close();
            held.delete(id);
          }
        }
        saveConfig({ ...stored, wallpaperPath: undefined });
        cachedAssets = undefined;
        sendJson(res, 200, { ok: true, hasBackup: true });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/restore") {
        let saved: Partial<BeautifyConfig>;
        try {
          saved = JSON.parse(fs.readFileSync(backupFile(), "utf8"));
        } catch {
          throw new Error("no wallpaper backup available");
        }
        const config: BeautifyConfig = { ...DEFAULT_CONFIG, ...saved };
        saveConfig(config);
        const windows = await pushConfigToSessions(config).catch(() => 0);
        sendJson(res, 200, { ok: true, windows, ...publicConfig(config) });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/health") {
        sendJson(res, 200, { ok: true });
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      sendJson(res, 400, { error: (err as Error).message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(apiPort, "127.0.0.1", resolve);
  });

  console.log(`serve: control API on http://127.0.0.1:${apiPort} — Ctrl+C to stop`);
  console.log(`serve: injecting into ZCode renderers on CDP port ${cdpPort}`);

  // Initial pass, then keep polling so restarts of the app get re-injected.
  await poll(currentConfig(), apiPort);
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    await poll(currentConfig(), apiPort);
  }
}
