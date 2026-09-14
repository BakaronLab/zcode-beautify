---
name: beautify
description: Beautify the ZCode desktop client — import a background wallpaper image and adapt all UI colors with Material Design 3 (Monet) dynamic color. Use when the user asks to set a background, wallpaper, theme, or re-color the ZCode UI.
---

# ZCode Beautify

This plugin themes the ZCode **desktop client** (Electron app) by injecting a
wallpaper layer and Monet-derived CSS variable overrides over CDP. It never
modifies ZCode's installation files.

## When to use

- "把这张图设为 ZCode 背景" / "set this image as the ZCode background"
- "换个主题颜色" / "make the UI match my wallpaper"
- "恢复默认外观" / "reset the appearance"

## Workflow

1. **Get an image path from the user.** Only absolute local paths are accepted.
2. **Call the `set_background` tool** with `image_path` (plus optional `blur`,
   `dim`). The tool copies the image into the plugin data dir, extracts the MD3
   source color, generates light/dark schemes, and injects everything into the
   running ZCode renderer.
3. **On CDP/port errors**: the ZCode instance is running without the debug
   port. Instruct the user to quit ZCode completely and start it via
   `node <plugin-root>/dist/cli.js launch`, or via watch mode:
   `node <plugin-root>/dist/cli.js watch` (keeps re-injecting across restarts).
4. **After ZCode restarts**, the injected theme is gone until re-injected — use
   the `refresh_theme` tool or run watch mode.
5. **To undo everything**, use `reset_appearance`.

## Tools

| Tool | Purpose |
|---|---|
| `set_background` | Set wallpaper + Monet colors |
| `refresh_theme` | Re-inject stored theme after a restart |
| `reset_appearance` | Remove wallpaper and overrides |
| `beautify_status` | Show stored config |

## Constraints

- ZCode must be running (or startable) with `--remote-debugging-port=9222`.
- Themes live in CDP sessions: they are wiped when ZCode restarts. Watch mode
  makes re-injection automatic.
- Functional colors (success/warning/destructive) are intentionally preserved.
