/**
 * The injected settings panel: a floating, draggable panel in the ZCode
 * renderer for live-tuning blur/dim, toggling Monet colors and wallpaper
 * visibility, and swapping the wallpaper image — all via the local API
 * started by `zcode-beautify serve`.
 *
 * The script is idempotent: if the panel root already exists it does nothing,
 * so it is safe to (re-)evaluate on every injection or reload.
 */

export const PANEL_ROOT_ID = "zcode-beautify-panel-root";

export function buildPanelScript(apiPort: number): string {
  const api = `http://127.0.0.1:${apiPort}`;
  return `(function(){
  var API = ${JSON.stringify(api)};
  var ROOT_ID = ${JSON.stringify(PANEL_ROOT_ID)};
  if (document.getElementById(ROOT_ID)) return;

  var css = [
    '#zcode-beautify-panel-root, #zcode-beautify-panel-root * { box-sizing: border-box; font-family: system-ui, sans-serif; }',
    '#zcode-beautify-panel-root { position: fixed; inset: auto; z-index: 2147483647; font-size: 12px; color: #e8e8ea; }',
    '#zb-fab { position: fixed; right: 18px; bottom: 18px; width: 34px; height: 34px; border-radius: 50%;',
      ' background: rgba(32,32,38,.78); border: 1px solid rgba(255,255,255,.12); cursor: pointer;',
      ' display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);',
      ' box-shadow: 0 2px 12px rgba(0,0,0,.35); user-select: none; font-size: 15px; line-height: 1; }',
    '#zb-fab:hover { background: rgba(52,52,60,.85); }',
    '#zb-panel { position: fixed; right: 18px; bottom: 60px; width: 264px; padding: 0 0 10px;',
      ' background: rgba(24,24,30,.88); border: 1px solid rgba(255,255,255,.12); border-radius: 12px;',
      ' backdrop-filter: blur(16px); box-shadow: 0 8px 32px rgba(0,0,0,.45); user-select: none; }',
    '#zb-panel[hidden] { display: none; }',
    '#zb-head { padding: 9px 12px; font-weight: 600; cursor: move; border-bottom: 1px solid rgba(255,255,255,.1);',
      ' display: flex; justify-content: space-between; align-items: center; }',
    '#zb-close { cursor: pointer; opacity: .7; padding: 0 4px; } #zb-close:hover { opacity: 1; }',
    '#zb-body { padding: 10px 12px 0; }',
    '.zb-row { margin-bottom: 10px; }',
    '.zb-row label { display: flex; justify-content: space-between; margin-bottom: 4px; opacity: .85; }',
    '#zb-panel input[type=range] { width: 100%; accent-color: #7aa2f7; height: 18px; margin: 0; cursor: pointer; }',
    '.zb-toggles { display: flex; gap: 14px; }',
    '.zb-toggles label { display: flex; align-items: center; gap: 5px; margin: 0; cursor: pointer; }',
    '.zb-actions { display: flex; gap: 8px; }',
    '.zb-btn { flex: 1; text-align: center; padding: 6px 0; border-radius: 7px; cursor: pointer;',
      ' background: rgba(255,255,255,.09); border: 1px solid rgba(255,255,255,.14); color: inherit; font-size: 12px; }',
    '.zb-btn:hover { background: rgba(255,255,255,.16); }',
    '#zb-status { min-height: 14px; padding: 2px 12px 0; opacity: .6; font-size: 11px; }'
  ].join('');

  var style = document.createElement('style');
  style.id = 'zcode-beautify-panel-style';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  var root = document.createElement('div');
  root.id = ROOT_ID;
  root.innerHTML =
    '<div id="zb-fab" title="ZCode Beautify">🎨</div>' +
    '<div id="zb-panel" hidden>' +
    '  <div id="zb-head"><span>ZCode Beautify</span><span id="zb-close">✕</span></div>' +
    '  <div id="zb-body">' +
    '    <div class="zb-row"><label><span>Blur</span><span><span id="zb-blur-val">0</span>px</span></label>' +
    '      <input type="range" id="zb-blur" min="0" max="30" step="1"></div>' +
    '    <div class="zb-row"><label><span>Dim</span><span><span id="zb-dim-val">0</span>%</span></label>' +
    '      <input type="range" id="zb-dim" min="0" max="80" step="1"></div>' +
    '    <div class="zb-row zb-toggles">' +
    '      <label><input type="checkbox" id="zb-monet"> Monet</label>' +
    '      <label><input type="checkbox" id="zb-vis"> Wallpaper</label>' +
    '    </div>' +
    '    <div class="zb-row zb-actions">' +
    '      <label class="zb-btn" for="zb-file">Change image…</label>' +
    '      <input type="file" id="zb-file" accept="image/*" hidden>' +
    '      <button class="zb-btn" id="zb-reset">Reset</button>' +
    '    </div>' +
    '  </div>' +
    '</div>' +
    '<div id="zb-status"></div>';
  document.body.appendChild(root);

  function $(id) { return document.getElementById(id); }
  function wallpaperEl() { return document.getElementById('zcode-beautify-wallpaper'); }
  function status(msg) {
    var el = $('zb-status'); if (!el) return;
    el.textContent = msg;
    setTimeout(function () { if (el.textContent === msg) el.textContent = ''; }, 2200);
  }
  function post(path, body, cb) {
    fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (cb) cb(d); })
      .catch(function () { status('beautify service unreachable'); });
  }

  // Local live preview; the server re-injects the authoritative CSS right after.
  function preview() {
    var w = wallpaperEl(); if (!w) return;
    var b = Number($('zb-blur').value), d = Number($('zb-dim').value);
    w.style.filter = b > 0 ? 'blur(' + b + 'px)' : 'none';
    w.style.transform = b > 0 ? 'scale(1.04)' : 'none';
    document.documentElement.style.setProperty('--zcode-beautify-dim', String(d / 100));
  }

  var pushTimer = null;
  function pushConfig() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      post('/api/config', {
        blur: Number($('zb-blur').value),
        dim: Number($('zb-dim').value),
        monet: $('zb-monet').checked,
        wallpaperVisible: $('zb-vis').checked
      }, function (d) { status(d && d.windows > 0 ? 'applied' : 'saved (ZCode not reachable)'); });
    }, 300);
  }

  function refresh() {
    fetch(API + '/api/config')
      .then(function (r) { return r.json(); })
      .then(function (c) {
        $('zb-blur').value = c.blur; $('zb-blur-val').textContent = c.blur;
        $('zb-dim').value = c.dim; $('zb-dim-val').textContent = c.dim;
        $('zb-monet').checked = !!c.monet;
        $('zb-vis').checked = !!c.wallpaperVisible;
      })
      .catch(function () { status('beautify service unreachable'); });
  }

  $('zb-blur').addEventListener('input', function () {
    $('zb-blur-val').textContent = this.value; preview(); pushConfig();
  });
  $('zb-dim').addEventListener('input', function () {
    $('zb-dim-val').textContent = this.value; preview(); pushConfig();
  });
  $('zb-monet').addEventListener('change', pushConfig);
  $('zb-vis').addEventListener('change', pushConfig);

  $('zb-file').addEventListener('change', function () {
    var f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { status('image too large (max 20 MB)'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      post('/api/wallpaper', { dataUri: fr.result, name: f.name }, function () { status('wallpaper updated'); });
    };
    fr.readAsDataURL(f);
  });

  $('zb-reset').addEventListener('click', function () {
    post('/api/reset', {}, function () {
      try { localStorage.removeItem('zcode-beautify:css'); localStorage.removeItem('zcode-beautify:wallpaper'); } catch (e) {}
      status('appearance reset');
    });
  });

  $('zb-fab').addEventListener('click', function () {
    var p = $('zb-panel');
    p.hidden = !p.hidden;
    if (!p.hidden) refresh();
  });
  $('zb-close').addEventListener('click', function () { $('zb-panel').hidden = true; });

  (function () {
    var head = $('zb-head'), panel = $('zb-panel');
    var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    head.addEventListener('pointerdown', function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY;
      var r = panel.getBoundingClientRect(); ox = r.left; oy = r.top;
      panel.style.right = 'auto'; panel.style.bottom = 'auto';
      head.setPointerCapture(e.pointerId);
    });
    head.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var x = Math.max(4, Math.min(window.innerWidth - 80, ox + e.clientX - sx));
      var y = Math.max(4, Math.min(window.innerHeight - 60, oy + e.clientY - sy));
      panel.style.left = x + 'px'; panel.style.top = y + 'px';
    });
    head.addEventListener('pointerup', function () { dragging = false; });
  })();

  // Self-heal: if the theme style is missing but a previous injection saved it,
  // restore it from localStorage.
  if (!document.getElementById('zcode-beautify-style')) {
    var savedCss = null, savedWp = null;
    try {
      savedCss = localStorage.getItem('zcode-beautify:css');
      savedWp = localStorage.getItem('zcode-beautify:wallpaper');
    } catch (e) {}
    if (savedCss) {
      var s = document.createElement('style');
      s.id = 'zcode-beautify-style';
      s.textContent = savedCss;
      (document.head || document.documentElement).appendChild(s);
      if (savedWp && !wallpaperEl()) {
        var w = document.createElement('div');
        w.id = 'zcode-beautify-wallpaper';
        document.documentElement.appendChild(w);
        w.style.backgroundImage = 'url(' + savedWp + ')';
      }
    }
  }
})();`;
}
