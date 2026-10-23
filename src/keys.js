// Atajos globales con hook de teclado (mantener pulsado = hablar, tap = manos libres).
const { globalShortcut } = require('electron');

let hook = null;
let UK = null; // enum de teclas de uiohook
const code2name = new Map();
let bindings = {}; // modo -> Set de nombres canónicos
let handlers = {};
let pressed = new Set();
let active = null;
let timer = null;
let fallback = false;
let suspended = false;

const ALIAS = { CTRLRIGHT: 'CTRL', ALTRIGHT: 'ALT', SHIFTRIGHT: 'SHIFT', METARIGHT: 'META', CONTROL: 'CTRL', WIN: 'META', SUPER: 'META', ESC: 'ESCAPE', ' ': 'SPACE' };
const canon = (n) => { const u = String(n).toUpperCase(); return ALIAS[u] || u; };

function parse(combo) {
  return new Set(String(combo || '').split('+').map((s) => s.trim()).filter(Boolean).map(canon));
}
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

function recompute() {
  let hit = null;
  for (const [mode, set] of Object.entries(bindings)) if (set.size && sameSet(set, pressed)) hit = mode;
  if (hit === active) return;
  clearTimeout(timer);
  const prev = active;
  active = hit;
  if (prev && !suspended) handlers.up?.(prev);
  if (hit) timer = setTimeout(() => { if (active === hit && !suspended) handlers.down?.(hit); }, 70); // evita disparos al armar la combinación
}

let lastEvent = 0;
// Si se perdió un keyup (p. ej. Win+L), el estado viejo se descarta tras un rato sin actividad.
function freshen() { const now = Date.now(); if (now - lastEvent > 20000) pressed.clear(); lastEvent = now; }

function start(h) {
  handlers = h;
  try {
    ({ uIOhook: hook, UiohookKey: UK } = require('uiohook-napi'));
    for (const [name, code] of Object.entries(UK)) if (typeof code === 'number') code2name.set(code, canon(name));
    hook.on('keydown', (e) => {
      const n = code2name.get(e.keycode);
      if (n === 'ESCAPE' && !suspended) handlers.escape?.();
      if (!n) return;
      freshen(); pressed.add(n); recompute();
    });
    hook.on('keyup', (e) => {
      const n = code2name.get(e.keycode);
      lastEvent = Date.now(); if (n) pressed.delete(n);
      recompute();
    });
    hook.start();
  } catch (err) {
    fallback = true;
    hook = null;
  }
}

function setBindings(map) {
  bindings = {};
  const errors = [];
  for (const [mode, combo] of Object.entries(map)) bindings[mode] = parse(combo);
  if (fallback) {
    globalShortcut.unregisterAll();
    for (const [mode, combo] of Object.entries(map)) {
      const acc = combo.replace(/\bCtrl\b/gi, 'Control').replace(/\bWin\b|\bMeta\b/gi, 'Super');
      try { if (!globalShortcut.register(acc, () => handlers.tap?.(mode))) errors.push(`${combo} ya está en uso`); }
      catch { errors.push(`Atajo inválido: ${combo}`); }
    }
  }
  return errors;
}

function suspend(on) {
  suspended = on;
  if (fallback) { if (on) globalShortcut.unregisterAll(); return; }
  clearTimeout(timer); active = null; pressed.clear();
}

function stop() { try { hook?.stop(); } catch {} globalShortcut.unregisterAll(); }

module.exports = { start, setBindings, suspend, stop, isFallback: () => fallback };
