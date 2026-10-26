const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage, nativeTheme, session, clipboard, shell } = require('electron');
const path = require('path');

if (process.env.HABLO_USER_DATA) app.setPath('userData', process.env.HABLO_USER_DATA);

const store = require('./src/store');
const ai = require('./src/ai');
const win = require('./src/winhelper');
const keys = require('./src/keys');

if (!app.requestSingleInstanceLock()) app.quit();

let mainWin, overlay, answerWin, tray;
let quitting = false;
let job = null; // { mode, ctx, startedAt, holding, latched, stopping, selectionP }
let hideTimer;
let lastOverlay = null;

const MIN_MS = 400;   // audio más corto se descarta
const HOLD_MS = 380;  // más que esto mantenido = pulsar-para-hablar; menos = manos libres

// ---------- ventanas ----------
function createMain() {
  mainWin = new BrowserWindow({
    width: 1080, height: 720, minWidth: 820, minHeight: 560, show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0c10' : '#f4f3f0', autoHideMenuBar: true, title: 'Hablo',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: nativeTheme.shouldUseDarkColors ? '#c9ccd6' : '#3a3d46', height: 40 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  mainWin.loadFile('renderer/app.html');
  mainWin.once('ready-to-show', () => { if (!process.argv.includes('--hidden')) mainWin.show(); });
  mainWin.on('close', (e) => { if (!quitting) { e.preventDefault(); mainWin.hide(); } });
  mainWin.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  nativeTheme.on('updated', () => {
    mainWin.setTitleBarOverlay({ color: '#00000000', symbolColor: nativeTheme.shouldUseDarkColors ? '#c9ccd6' : '#3a3d46', height: 40 });
  });
}

function createOverlay() {
  overlay = new BrowserWindow({
    width: 380, height: 84, show: false, frame: false, transparent: true, resizable: false,
    alwaysOnTop: true, skipTaskbar: true, focusable: false, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false }
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true);
  overlay.loadFile('renderer/overlay.html');
}

function placeOverlay() {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const [w, h] = overlay.getSize();
  overlay.setPosition(Math.round(wa.x + (wa.width - w) / 2), Math.round(wa.y + wa.height - h - 18));
}

function showOverlay(state, text = '', extra = {}) {
  clearTimeout(hideTimer);
  lastOverlay = { state, text, ...extra };
  placeOverlay();
  overlay.webContents.send('ui:state', lastOverlay);
  if (!overlay.isVisible()) overlay.showInactive();
}
function hideOverlay(ms = 0) {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => { overlay?.hide(); lastOverlay = null; }, ms);
}

function openAnswer(question, text) {
  if (!answerWin || answerWin.isDestroyed()) {
    answerWin = new BrowserWindow({
      width: 480, height: 400, minWidth: 360, minHeight: 240, alwaysOnTop: true, autoHideMenuBar: true,
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0c10' : '#f4f3f0', title: 'Respuesta',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
    });
    answerWin.loadFile('renderer/answer.html');
    answerWin.webContents.once('did-finish-load', () => answerWin.webContents.send('answer:set', { question, text }));
  } else {
    answerWin.webContents.send('answer:set', { question, text });
    answerWin.show();
  }
}

function makeTrayIcon() {
  const n = 32, buf = Buffer.alloc(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = x - 15.5, dy = y - 15.5, d = Math.sqrt(dx * dx + dy * dy);
    const i = (y * n + x) * 4;
    if (d <= 14.5) { const t = (x + y) / 62; buf[i] = 110 + 120 * t; buf[i + 1] = 90 - 20 * t; buf[i + 2] = 255 - 60 * t; buf[i + 3] = 255; } // BGRA, degradado violeta→coral
    const bar = (Math.abs(dx) < 1.8 && Math.abs(dy) < 8) || (Math.abs(dx - 6) < 1.8 && Math.abs(dy) < 4) || (Math.abs(dx + 6) < 1.8 && Math.abs(dy) < 5) || (Math.abs(dx - 12) < 1.6 && Math.abs(dy) < 2) || (Math.abs(dx + 12) < 1.6 && Math.abs(dy) < 2);
    if (d <= 14.5 && bar) buf[i] = buf[i + 1] = buf[i + 2] = 255;
  }
  return nativeImage.createFromBitmap(buf, { width: n, height: n });
}

function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('Hablo');
  const menu = () => Menu.buildFromTemplate([
    { label: 'Abrir Hablo', click: () => { mainWin.show(); mainWin.focus(); } },
    { label: job ? 'Detener dictado' : 'Dictar ahora', click: () => (job ? stop() : begin('dictate', true)) },
    { type: 'separator' },
    { label: 'Salir', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.on('click', () => { mainWin.show(); mainWin.focus(); });
  tray.on('right-click', () => tray.popUpContextMenu(menu()));
}

// ---------- atajos ----------
function applyHotkeys() {
  const hk = store.getSettings().hotkeys;
  const errors = [];
  const seen = new Map();
  for (const [m, c] of Object.entries(hk)) {
    const k = c.toUpperCase();
    if (seen.has(k)) errors.push(`"${c}" está repetido en dos acciones`);
    seen.set(k, m);
  }
  return [...errors, ...keys.setBindings(hk)];
}

function onDown(mode) {
  if (job) {
    if (job.mode === mode && job.latched && !job.stopping) stop();
    return;
  }
  begin(mode, false);
}
function onUp(mode) {
  if (!job || job.mode !== mode || !job.holding || job.stopping) return;
  job.holding = false;
  if (Date.now() - job.startedAt >= HOLD_MS) stop();
  else { job.latched = true; showOverlay('listening', 'Manos libres · toca para terminar', { mode }); }
}

// ---------- flujo de dictado ----------
const MODE_LABEL = (mode) => ({
  dictate: '',
  ask: 'Pregunta o instrucción…',
  translate: `Traducir a ${store.getSettings().translate.target}`
}[mode]);

async function begin(mode, latched) {
  if (job) return;
  const mine = (job = { mode, ctx: {}, startedAt: Date.now(), holding: !latched, latched, stopping: false, selectionP: null, ctxP: null });
  showOverlay('listening', MODE_LABEL(mode), { mode });
  const s = store.getSettings();
  overlay.webContents.send('rec:start', { whisper: s.whisperMode, micId: s.micId, sound: s.sound });
  mine.ctxP = win.context(); // ventana de destino (antes de que cambie el foco)
  mine.ctx = await mine.ctxP;
}

function stop() {
  if (!job || job.stopping) return;
  job.stopping = true;
  if (job.mode === 'ask') job.selectionP = win.selection(); // el texto seleccionado sigue activo: la barra no roba el foco
  overlay.webContents.send('rec:stop');
}

function cancel() {
  if (!job) return;
  overlay.webContents.send('rec:cancel');
  job = null;
  showOverlay('cancelled', 'Cancelado');
  hideOverlay(700);
}

async function handleAudio({ buffer, mime, ms }) {
  const mine = job;
  if (!mine) return;
  if (ms < MIN_MS) { if (mine.selectionP) await mine.selectionP; job = null; hideOverlay(0); return; }
  const s = store.getSettings();
  try {
    showOverlay('processing', 'Transcribiendo…');
    mine.ctx = await mine.ctxP;
    const [raw, selection] = await Promise.all([ai.transcribe(Buffer.from(buffer), mime), mine.selectionP || Promise.resolve('')]);
    if (job !== mine) return;
    if (!raw) { showOverlay('error', 'No se escuchó nada'); hideOverlay(1400); return; }

    if (mine.mode === 'ask') {
      showOverlay('processing', selection ? 'Editando selección…' : 'Pensando…');
      if (selection) {
        const out = await ai.edit(raw, selection);
        await win.insert(out);
        store.addHistory({ kind: 'edit', raw, text: out, app: mine.ctx.app || '', ms });
        showOverlay('done', 'Texto editado');
      } else {
        const out = await ai.answer(raw, mine.ctx);
        store.addHistory({ kind: 'ask', raw, text: out, app: mine.ctx.app || '', ms });
        openAnswer(raw, out);
        showOverlay('done', 'Respuesta lista');
      }
    } else {
      const translate = mine.mode === 'translate';
      let text = raw;
      const template = ai.matchTemplate(raw);
      if (s.cleanup || translate || template) {
        showOverlay('processing', translate ? 'Traduciendo…' : template ? `Plantilla: ${template.name}…` : 'Puliendo…');
        text = await ai.clean(raw, mine.ctx, { translate, template });
      }
      await win.insert(text);
      store.addHistory({ kind: translate ? 'translation' : 'dictation', raw, text, app: mine.ctx.app || '', ms });
      showOverlay('done', 'Listo');
    }
    mainWin?.webContents.send('data:changed');
    hideOverlay(900);
  } catch (e) {
    if (process.env.HABLO_TEST) console.error('HABLO_ERR', e.stack);
    showOverlay('error', e.message.slice(0, 400));
    hideOverlay(4000);
  } finally {
    if (job === mine) job = null;
  }
}

// ---------- IPC ----------
const publicSettings = () => ({ ...store.getSettings(), hasKey: !!store.getApiKey(), hookMode: !keys.isFallback() });
ipcMain.handle('settings:get', () => publicSettings());
ipcMain.handle('settings:set', (_e, patch) => {
  store.setSettings(patch);
  app.setLoginItemSettings({ openAtLogin: !!store.getSettings().autostart, args: ['--hidden'] });
  return { settings: publicSettings(), errors: applyHotkeys() };
});
ipcMain.handle('apikey:set', (_e, key) => { store.setApiKey(key.trim()); return publicSettings(); });
ipcMain.handle('ai:test', async () => { try { await ai.test(); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('review:run', async (_e, text) => { try { return { ok: true, result: await ai.review(String(text || '')) }; } catch (e) { return { ok: false, error: e.message }; } });
ipcMain.handle('history:get', () => store.getHistory());
ipcMain.handle('history:delete', (_e, id) => store.deleteHistory(id));
ipcMain.handle('history:clear', () => store.clearHistory());
ipcMain.handle('stats:get', () => store.getStats());
ipcMain.handle('clipboard:write', (_e, t) => clipboard.writeText(t));
ipcMain.handle('answer:insert', async (_e, t) => { answerWin?.hide(); await new Promise((r) => setTimeout(r, 250)); await win.insert(t); });
ipcMain.handle('hotkeys:suspend', (_e, on) => { keys.suspend(on); if (!on) applyHotkeys(); });
ipcMain.on('rec:data', (_e, payload) => handleAudio(payload));
ipcMain.on('rec:error', (_e, msg) => { job = null; showOverlay('error', msg); hideOverlay(3500); });
if (process.env.HABLO_TEST) ipcMain.handle('test:status', () => ({ job: job && { mode: job.mode, latched: job.latched, holding: job.holding, ctx: job.ctx }, overlay: lastOverlay }));

// ---------- arranque ----------
app.on('second-instance', () => { mainWin?.show(); mainWin?.focus(); });
app.on('will-quit', () => { keys.stop(); win.stop(); });
app.on('window-all-closed', () => {});

app.whenReady().then(() => {
  store.init();
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');
  createMain();
  createOverlay();
  createTray();
  win.start();
  win.context(); // calienta el helper de PowerShell
  keys.start({ down: onDown, up: onUp, escape: cancel, tap: (m) => (job ? stop() : begin(m, true)) });
  const errors = applyHotkeys();
  if (errors.length) mainWin.webContents.once('did-finish-load', () => mainWin.webContents.send('hotkey:errors', errors));
  app.setLoginItemSettings({ openAtLogin: !!store.getSettings().autostart, args: ['--hidden'] });
});
