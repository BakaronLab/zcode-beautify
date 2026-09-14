---
description: Set a ZCode desktop wallpaper and adapt the UI with Monet colors
argument-hint: "[image path or description]"
---

# ZCode Beautify

The user wants to beautify the ZCode desktop client. $ARGUMENTS

## Steps

1. **Resolve the wallpaper image.** If a file path is given in the arguments,
   use it. Otherwise ask the user for an image path (absolute path works best).
2. **Check CDP availability** by running `node <plugin-root>/dist/cli.js status`
   if available, or simply try the tool below and read the error.
3. **Apply the wallpaper** with the `set_background` MCP tool, passing the
   absolute image path and any `blur` / `dim` preferences the user mentioned.
4. **If it fails with a CDP/port error**, the running ZCode instance was not
   started with the debug port. Tell the user to run:
   `node <plugin-root>/dist/cli.js launch`
   (this restarts ZCode with `--remote-debugging-port=9222` — unsaved work in
   other apps is not affected, ZCode sessions are persisted), then retry.
5. **Report the result** and mention that `dim` (0-100) and `blur` (px) can be
   tuned, and `reset_appearance` restores the default look.
