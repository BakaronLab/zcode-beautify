# electron-beautify skill pack (v0.2.0)

A self-contained skill for AI coding agents: beautify **any Electron desktop
app** with a wallpaper layer and Material Design 3 (Monet) dynamic color over
the Chrome DevTools Protocol — no plugin system, no app modifications.

**Give this folder to your AI** (Claude, DeepSeek, Codex, Doubao, …) and ask it
to follow `SKILL.md`. The agent will build a small local beautify tool for your
app: launch the app with a debug port, inject a wallpaper + token CSS, keep the
theme alive across reloads, and optionally serve a live-tuning API.

## Contents

```
├─ SKILL.md                    # the skill: workflow, code, pitfalls, acceptance checklist
└─ references/
   ├─ cdp-minimal.mjs          # zero-dep CDP client (launch+wait, targets, inject)
   ├─ monet-color.mjs          # MD3 color extraction + light/dark token CSS
   ├─ inject-bootstrap.js      # renderer-side injection template (idempotent, self-healing)
   ├─ live-api.mjs             # localhost API + persistent sessions + in-app tuning
   └─ token-mapping.md         # one-time recon: find the app's CSS variables
```

## Requirements

- Node.js ≥ 20
- `npm i jimp @material/material-color-utilities` (color extraction only)
- The Electron app you want to beautify

## Quick check (with any running Electron app)

```bash
node --input-type=module -e "
import { listTargets, pickRenderer, connect, evaluate } from './references/cdp-minimal.mjs';
const t = pickRenderer(await listTargets(9222));
const ws = await connect(t.webSocketDebuggerUrl);
console.log(await evaluate(ws, 'navigator.userAgent'));
"
```

This repo's own `dist/cli.js` is the production-grade reference implementation
of exactly what this skill teaches; read `src/` alongside `SKILL.md` when in
doubt.

## License

MIT — same as the repository.
