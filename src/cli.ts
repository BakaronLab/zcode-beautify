#!/usr/bin/env node
/**
 * zcode-beautify CLI
 *
 *   launch   Start ZCode with the CDP debug port enabled (required once).
 *   apply    Set a wallpaper + Monet-derived colors, injecting into the running app.
 *   colors   Re-apply Monet colors only (no wallpaper change).
 *   reset    Restore ZCode's default appearance.
 *   watch    Keep re-injecting: survives ZCode restarts while this process lives.
 */

import { applyToZCode, buildPayload, resetZCode } from "./core/inject.js";
import { loadWallpaper } from "./core/monet.js";
import { launchZcode } from "./core/launch.js";
import { applyWallpaper, resetAppearance } from "./core/session.js";

const USAGE = `zcode-beautify <command> [options]

Commands:
  launch [--port N]              Start ZCode with --remote-debugging-port=N
  apply <image> [options]        Set wallpaper and adapt colors
    --blur <px>                  Blur the wallpaper (default 0)
    --dim <0-100>                Darken the wallpaper (default 25)
    --no-monet                   Keep ZCode's original colors
    --port <N>                   CDP port (default 9222)
  colors [--port N]              Re-apply stored theme without wallpaper change
  reset [--port N]               Remove wallpaper and color overrides
  status [--port N]              Show CDP reachability and renderer targets
  watch [--port N]               Watch mode: re-inject whenever ZCode (re)starts
  serve [--port N] [--api-port M]  Watch mode + settings panel + local API (default API port 9223)
`;

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = rest.indexOf(name);
    return i >= 0 && i + 1 < rest.length ? rest[i + 1] : undefined;
  };
  const has = (name: string): boolean => rest.includes(name);
  const port = Number(flag("--port") ?? 9222);

  try {
    switch (cmd) {
      case "launch": {
        const r = await launchZcode(port);
        if (r.started) {
          console.log(`ZCode started with CDP on port ${port}.`);
        } else if (r.reason === "running-without-cdp") {
          console.error(
            `A ZCode instance is already running without the debug port, so the single-instance lock ` +
              `would immediately close the new process's CDP port.\n` +
              `Quit ZCode completely (including any tray icon), then run \`zcode-beautify launch\` again.`
          );
          process.exitCode = 1;
        } else {
          console.log(`ZCode already reachable on port ${port}.`);
        }
        break;
      }
      case "apply": {
        const image = rest.find((a) => !a.startsWith("--"));
        if (!image) {
          console.error(USAGE);
          process.exitCode = 1;
          return;
        }
        const { windows } = await applyWallpaper(image, {
          port,
          blur: Number(flag("--blur") ?? 0),
          dim: Number(flag("--dim") ?? 25),
          monet: !has("--no-monet"),
        });
        console.log(`Applied wallpaper + theme to ${windows} window(s).`);
        break;
      }
      case "colors": {
        const { applyColorsOnly } = await import("./core/session.js");
        const windows = await applyColorsOnly({ port });
        console.log(`Re-applied theme to ${windows} window(s).`);
        break;
      }
      case "reset": {
        await resetAppearance(port);
        console.log("Appearance reset.");
        break;
      }
      case "status": {
        try {
          const { listTargets, pickRendererTargets } = await import("./core/cdp.js");
          const targets = pickRendererTargets(await listTargets(port));
          console.log(`CDP reachable on port ${port}; ${targets.length} renderer target(s):`);
          for (const t of targets) console.log(`  - [${t.id}] ${t.title} ${t.url}`);
        } catch (err) {
          console.log(`CDP not reachable on port ${port}: ${(err as Error).message}`);
          process.exitCode = 1;
        }
        break;
      }
      case "watch": {
        await watch(port);
        break;
      }
      case "serve": {
        const { startServe } = await import("./core/server.js");
        const apiPort = Number(flag("--api-port") ?? 9223);
        await startServe({ cdpPort: port, apiPort });
        break;
      }
      default:
        console.log(USAGE);
    }
  } catch (err) {
    console.error(`error: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}

async function watch(port: number): Promise<void> {
  const { buildPayloadFromConfig } = await import("./core/session.js");
  const { loadConfig } = await import("./core/launch.js");
  const config = { ...{ port: 9222, blur: 0, dim: 25, monet: true, wallpaperVisible: true }, ...loadConfig(), port };
  const payload = await buildPayloadFromConfig(config);

  let injected = new Set<string>();
  console.log(`watching CDP port ${port} — Ctrl+C to stop`);
  for (;;) {
    try {
      const { listTargets, pickRendererTargets } = await import("./core/cdp.js");
      const targets = pickRendererTargets(await listTargets(port));
      for (const t of targets) {
        if (!injected.has(t.id)) {
          try {
            await applyToZCode(config, payload);
            injected.add(t.id);
            console.log(`injected into "${t.title}" (${t.id})`);
          } catch {
            /* retry next tick */
          }
        }
      }
      const current = new Set(targets.map((t) => t.id));
      injected = new Set([...injected].filter((id) => current.has(id)));
    } catch {
      /* ZCode not up yet; keep polling */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
}

main();
