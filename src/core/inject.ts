/**
 * Assembles the full injected payload: wallpaper layer CSS + variable
 * overrides, plus helpers to apply a theme to a running ZCode instance.
 */

import { CdpConnection, injectIntoTarget, listTargets, pickRendererTargets, buildResetScript } from "./cdp.js";
import { loadWallpaper, type WallpaperAssets } from "./monet.js";
import { buildVariableOverrides } from "./tokens.js";

export interface BeautifyConfig {
  port: number;
  wallpaperPath?: string;
  blur: number;
  dim: number;
  monet: boolean;
  wallpaperVisible: boolean;
}

export const DEFAULT_CONFIG: BeautifyConfig = {
  port: 9222,
  blur: 0,
  dim: 25,
  monet: true,
  wallpaperVisible: true,
};

export interface BuiltPayload {
  css: string;
  wallpaperDataUri?: string;
  assets?: WallpaperAssets;
}

export function buildPayload(config: BeautifyConfig, assets?: WallpaperAssets): BuiltPayload {
  const parts: string[] = [];

  parts.push(`
html, body { background: transparent !important; }
#zcode-beautify-wallpaper {
  position: fixed;
  inset: 0;
  z-index: -2147483646;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  pointer-events: none;
  filter: blur(${config.blur}px);
  transform: scale(${config.blur > 0 ? 1.04 : 1});
}`);
  if (config.dim > 0) {
    parts.push(`#zcode-beautify-wallpaper::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / var(--zcode-beautify-dim, ${config.dim / 100}));
}`);
  }

  if (assets && config.monet) {
    parts.push(buildVariableOverrides(assets.theme, {
      dim: config.dim,
      wallpaperVisible: config.wallpaperVisible,
    }));
  }

  return {
    css: parts.join("\n"),
    wallpaperDataUri: assets?.dataUri,
    assets,
  };
}

/** Apply config to a running ZCode instance. Returns how many windows got it. */
export async function applyToZCode(config: BeautifyConfig, payload: BuiltPayload): Promise<number> {
  const targets = pickRendererTargets(await listTargets(config.port));
  if (targets.length === 0) {
    throw new Error("No ZCode renderer target found on the CDP endpoint.");
  }
  let count = 0;
  for (const target of targets) {
    try {
      await injectIntoTarget(target, payload);
      count++;
    } catch (err) {
      console.warn(`Injection into "${target.title}" failed: ${(err as Error).message}`);
    }
  }
  return count;
}

export async function resetZCode(port: number): Promise<number> {
  const targets = pickRendererTargets(await listTargets(port));
  let count = 0;
  for (const target of targets) {
    try {
      const conn = await CdpConnection.connect(target.webSocketDebuggerUrl!);
      await conn.send("Runtime.evaluate", { expression: buildResetScript() });
      conn.close();
      count++;
    } catch (err) {
      console.warn(`Reset of "${target.title}" failed: ${(err as Error).message}`);
    }
  }
  return count;
}

/** Re-export so CLI/MCP can load wallpapers without touching monet internals. */
export { loadWallpaper };
