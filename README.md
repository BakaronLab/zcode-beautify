# zcode-beautify

[English](README.md) | [中文](README.zh-CN.md)

Beautify the **ZCode desktop client**: use any image as a background wallpaper and adapt the whole UI with Material Design 3 (Monet) dynamic color — plus a live settings panel for real-time tuning.

![screenshot placeholder — replace docs/screenshot.png](docs/screenshot.png)

## Features

- **Wallpaper** — any local image becomes a fixed background layer behind the UI, with three framing modes: `cover` (fill and crop), `contain` (letterboxed over a blurred backdrop of the same picture), and `smart` — a local AI-style analysis that finds the salient subject and picks the best framing and focus point automatically.
- **Monet theming** — a source color is extracted from the wallpaper with Google's official MD3 algorithm; light/dark palettes are mapped onto ZCode's semantic CSS variables (35+ tokens).
- **Live settings panel** — a draggable panel inside ZCode with blur/dim sliders, Monet and wallpaper-visibility toggles, one-click wallpaper swap, and reset. Changes preview instantly and persist.
- **Conversation control** — bundled slash command `/beautify` and MCP tools let the ZCode agent set the wallpaper or tune the theme on your behalf.
- **Self-healing** — while `serve` runs, the theme survives renderer reloads automatically; the last look is also cached in `localStorage` as a fallback.

## How it works

ZCode is an Electron app whose UI theming is driven by Tailwind v4 `--color-*` CSS custom properties, and production builds start **without** a debug port. This plugin:

1. starts ZCode with `--remote-debugging-port=9222` (one-time `launch`);
2. connects over the Chrome DevTools Protocol and injects CSS/JS into the renderer:
   - a fixed-position wallpaper layer (image embedded as data URI),
   - translucent background variables so the wallpaper shows through,
   - MD3 light/dark palettes overriding ZCode's semantic tokens;
3. keeps the injection sessions open (`serve`) so the theme and the settings panel survive renderer reloads.

It never modifies ZCode's installation files, so ZCode upgrades are unaffected.

## Requirements

- Node.js ≥ 20 available on your PATH.
- ZCode desktop client (Windows / macOS / Linux).

## Install

### Option A — ZCode plugin marketplace (recommended)

1. Open ZCode → **Settings → Plugin Management → Discover**.
2. Click **+** and add this repository (GitHub URL or a local clone path).
3. Click **Get** on the *zcode-beautify* card. The `/beautify` command and MCP tools are available immediately.

The published repo ships prebuilt single-file bundles in `dist/`, so no build step is needed on your machine.

### Option B — clone and run

```bash
git clone https://github.com/Logocceai/zcode-beautify.git
cd zcode-beautify
node dist/cli.js --help        # prebuilt bundle, zero install
```

## Quick start

```bash
# 1) Quit ZCode completely, then start it with the CDP debug port (one-time).
node dist/cli.js launch

# 2) Set a wallpaper with Monet adaptation
node dist/cli.js apply "D:\pictures\wallpaper.jpg" --blur 6 --dim 30

# 3) (Recommended) Keep the theme alive + get the live settings panel
node dist/cli.js serve
```

With `serve` running, a 🎨 button appears in the bottom-right corner of ZCode. Open it to tune blur/dim live, cycle the framing mode (cover → contain → smart), toggle Monet colors or wallpaper translucency, swap the wallpaper image, or reset — everything previews instantly and is saved automatically.

You can also just type `/beautify <image path>` in ZCode and let the agent do it, then say things like "make it blurrier" (handled by the `apply_options` MCP tool).

## CLI reference

| Command | Purpose |
|---|---|
| `launch [--port N]` | Start ZCode with `--remote-debugging-port` (quit ZCode first) |
| `apply <image> [--blur] [--dim] [--fit] [--no-monet]` | Set wallpaper + adapt colors (`--fit cover\|contain\|smart`) |
| `colors` | Re-apply the stored theme without changing the image |
| `serve [--api-port M]` | Watch mode + settings panel + local control API (default API port 9223) |
| `watch` | Headless watch mode: re-inject whenever ZCode restarts |
| `reset` | Remove wallpaper and color overrides |
| `status` | Show CDP reachability and renderer targets |

## MCP tools

| Tool | Purpose |
|---|---|
| `set_background` | Set wallpaper + Monet colors |
| `apply_options` | Tune blur/dim/monet/wallpaper visibility/framing without re-sending the image |
| `refresh_theme` | Re-inject the stored theme after a restart |
| `reset_appearance` | Remove wallpaper and overrides |
| `beautify_status` | Show the stored config |

## Development

```bash
npm install
npm run build    # type-check + compile to dist/
npm run bundle   # prebuilt single-file bundles (what the repo ships)
```

`dist/` is committed so users never need to build. If you change `src/`, run `npm run bundle` and commit the updated bundles.

## Risks & limitations

- Injection happens over CDP — an **unofficial** mechanism. Updates to ZCode may break it; `reset` always restores the default look.
- `launch` restarts ZCode once. Without `serve`/`watch` running, the theme is lost on every ZCode restart (CDP sessions are scoped to the connection).
- Functional colors (success/warning/destructive) are intentionally left untouched.
- The control API binds to `127.0.0.1` only and accepts requests from any local process by design (the injected panel needs CORS).

## License

MIT
