# INSTALL-FOR-AI — install the ZCode beautify plugin (AI instructions)

> **You are an AI agent.** A user handed you this file (or the repository link
> <https://github.com/Logocceai/zcode-beautify>) and wants the finished plugin
> installed into **their ZCode desktop client**. Follow this document top to
> bottom. If you can run shell commands, use **Route B**; otherwise use
> **Route A** to guide the user, or **Route C** to output instructions.

## First: is this even the right package?

This repository ships **two different things**. Do not confuse them:

| | **Plugin package** (you are here) | **Skill pack** (`skill-pack/`) |
|---|---|---|
| Target | The user's **ZCode desktop client** | **Any** Electron app (other AI platforms, custom apps) |
| Your role | **Installer** — set up the ready-made plugin | **Developer** — build a similar beautify tool from scratch |
| User says | "Install this beautify plugin in my ZCode" | "Build wallpaper/color beautification for my XX app" |
| You read | `INSTALL-FOR-AI.md` (this file) | `skill-pack/SKILL.md` |
| Result | A working `/beautify` command + MCP tools in ZCode | A new local tool the user runs themselves |

If the user's goal is "just make my ZCode pretty" → continue below.
If they want to beautify a non-ZCode app or develop their own → read
`skill-pack/SKILL.md` instead and stop following this file.

## What you are installing

`zcode-beautify` v0.2.0 — a ZCode plugin that adds a wallpaper layer +
Material Design 3 (Monet) dynamic color to the ZCode desktop client over CDP,
with a `/beautify` slash command, MCP tools (`set_background`, `apply_options`,
`refresh_theme`, `reset_appearance`, `beautify_status`), and a live settings
panel. Everything is prebuilt in `dist/` — nothing to compile.

## Route A — guide the user through the UI (no shell needed, official path)

Tell the user, step by step:

1. Open ZCode → **Settings → Plugin Management → Discover**.
2. Click **+** and add the marketplace:
   - online: paste `https://github.com/Logocceai/zcode-beautify`
   - offline: first unzip the package you were given, then add the unzipped
     folder (it contains `marketplace.json` at its root).
3. Click **Get** on the *zcode-beautify* card.
4. Continue with **"After installation"** below.

## Route B — install it yourself (you have shell access)

ZCode's plugin system stores everything under `~/.zcode/cli/plugins/`
(Windows: `C:\Users\<user>\.zcode\cli\plugins\`). You will reproduce what the
UI does: stage a marketplace copy, register it, cache the plugin, record the
installation.

Work with **JSON-aware tooling** (Node, Python, jq) — never regex-edit or
rewrite these files blindly; always read → merge → write back preserving
everything else.

1. **Get the files.**
   ```bash
   git clone https://github.com/Logocceai/zcode-beautify.git
   ```
   No git? Download `https://github.com/Logocceai/zcode-beautify/archive/refs/heads/main.zip`
   and unzip. Keep the resulting folder in a stable location (e.g. the user's
   home directory) — ZCode re-reads it on marketplace refresh.

2. **Stage the marketplace copy** (what the UI does on "+"):
   ```text
   from: <clone>/                      (marketplace.json at its root)
   to:   ~/.zcode/cli/plugins/marketplaces/zcode-beautify/
   ```

3. **Register the marketplace** in `~/.zcode/cli/plugins/known_marketplaces.json`
   (create the file if missing — shape: `{ "version": 1, "marketplaces": [] }`).
   Append one entry, mirroring the real structure:
   ```json
   {
     "id": "zcode-beautify",
     "source": { "source": "directory", "path": "<the stable clone folder from step 1>" },
     "name": "zcode-beautify",
     "description": "Wallpaper + Material Design 3 (Monet) dynamic color for the ZCode desktop client.",
     "addedAt": "<now, ISO-8601>",
     "pluginCount": 1,
     "lastUpdated": "<now, ISO-8601>"
   }
   ```
   `pluginCount` must match the number of entries in `marketplace.json`.

4. **Cache the plugin** (what the UI does on "Get"):
   ```text
   from: <clone>/                      (or the staged marketplace copy)
   to:   ~/.zcode/cli/plugins/cache/zcode-beautify/zcode-beautify/0.2.0/
   ```
   Read the exact version from `.zcode-plugin/plugin.json` — the folder name
   must equal it.

5. **Record the installation** in `~/.zcode/cli/plugins/installed_plugins.json`.
   This file only exists after a first marketplace install. If it already
   exists, read it and append your record to the array that holds the existing
   plugin entries (field name as found — typically `plugins`). If it does not
   exist, create:
   ```json
   { "version": 1, "plugins": [ { ...record below... } ] }
   ```
   The record itself:
   ```json
   {
     "id": "zcode-beautify@zcode-beautify",
     "name": "zcode-beautify",
     "marketplace": "zcode-beautify",
     "version": "0.2.0",
     "installPath": "<the cache folder from step 4>",
     "installedAt": "<now, ISO-8601>",
     "updatedAt": "<now, ISO-8601>",
     "scope": "user"
   }
   ```

6. **Tell the user to fully restart ZCode** so the plugin loads, then continue
   with **"After installation"**.

**Known caveats for Route B** (undocumented internal format — verify as you go):

- If the clone folder from step 1 is later deleted, marketplace *refresh* may
  log a `lastRefreshFailure` (an `EPERM`/rename error). Already-installed
  plugins keep working; re-clone to the same path to clear it.
- If ZCode's plugin files look different from this document (newer versions may
  change the schema), stop and fall back to **Route A** — never guess.

## After installation (both routes)

1. The plugin contributes the `/beautify` command and MCP tools
   (`set_background`, `apply_options`, `refresh_theme`, `reset_appearance`,
   `beautify_status`).
2. The wallpaper needs CDP: the ZCode desktop client must be started with
   `--remote-debugging-port=9222`. Instruct the user to fully quit ZCode, then
   run `node <plugin-dir>/dist/cli.js launch` (the plugin dir is the cache
   folder above; requires Node.js ≥ 20). Alternatively suggest editing the
   ZCode shortcut to append the flag.
3. Then: `/beautify <path-to-an-image>` or `node <plugin-dir>/dist/cli.js apply
   "image.jpg" --blur 6 --dim 30 --fit smart`, and
   `node <plugin-dir>/dist/cli.js serve` for the live settings panel.
4. Verify: CDP reachable (`node <plugin-dir>/dist/cli.js status`), wallpaper
   visible, `/beautify` available in a new conversation.

## Uninstall (if the user asks)

- Remove the `zcode-beautify` entry from `installed_plugins.json`, delete
  `cache/zcode-beautify/`, and (only if the user wants the marketplace gone)
  the `known_marketplaces.json` entry plus `marketplaces/zcode-beautify/`.
- Theme remnants in a running ZCode disappear on restart; the plugin never
  modified ZCode's own files.
