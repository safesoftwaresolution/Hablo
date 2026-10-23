const { app, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  provider: { baseUrl: 'https://api.openai.com/v1', sttModel: 'gpt-4o-mini-transcribe', chatModel: 'gpt-4o-mini' },
  hotkeys: { dictate: 'Ctrl+Alt+D', ask: 'Ctrl+Alt+A', translate: 'Ctrl+Alt+T' },
  language: 'auto', // 'auto' detecta idioma y permite mezclar
  cleanup: true,
  whisperMode: false,
  micId: '',
  tone: 'auto', // tono por defecto
  appRules: [
    { match: 'outlook', tone: 'formal' },
    { match: 'gmail', tone: 'formal' },
    { match: 'slack', tone: 'casual' },
    { match: 'discord', tone: 'casual' },
    { match: 'whatsapp', tone: 'casual' },
    { match: 'telegram', tone: 'casual' },
    { match: 'code', tone: 'literal' },
    { match: 'cursor', tone: 'literal' },
    { match: 'windowsterminal', tone: 'literal' },
    { match: 'powershell', tone: 'literal' }
  ],
  aboutMe: '',
  translate: { target: 'English' },
  onboarded: false,
  dictionary: [],
  autostart: false,
  sound: true
};

let dir;
let settings;
let history;
let stats;

const file = (n) => path.join(dir, n);
const readJson = (n, fallback) => {
  try { return JSON.parse(fs.readFileSync(file(n), 'utf8')); } catch { return fallback; }
};
const writeJson = (n, v) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file(n) + '.tmp', JSON.stringify(v, null, 2));
  fs.renameSync(file(n) + '.tmp', file(n));
};
const merge = (base, over) => {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over || {})) out[k] = k in base ? merge(base[k], over[k]) : over[k];
  return out;
};

function init() {
  dir = app.getPath('userData');
  settings = merge(DEFAULTS, readJson('settings.json', {}));
  history = readJson('history.json', []);
  stats = readJson('stats.json', { totalWords: 0, totalSessions: 0 });
}

const getSettings = () => settings;
function setSettings(patch) {
  settings = merge(settings, patch);
  writeJson('settings.json', settings);
  return settings;
}

function setApiKey(key) {
  const enc = key
    ? (safeStorage.isEncryptionAvailable() ? 'enc:' + safeStorage.encryptString(key).toString('base64') : 'raw:' + Buffer.from(key).toString('base64'))
    : '';
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file('key.bin'), enc);
}
function getApiKey() {
  try {
    const v = fs.readFileSync(file('key.bin'), 'utf8');
    if (v.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(v.slice(4), 'base64'));
    if (v.startsWith('raw:')) return Buffer.from(v.slice(4), 'base64').toString();
  } catch {}
  return '';
}

const countWords = (t) => (t.trim().match(/\S+/g) || []).length;

function addHistory(entry) {
  const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now(), ...entry };
  history.unshift(item);
  history = history.slice(0, 500);
  stats.totalWords += countWords(entry.text);
  stats.totalSessions += 1;
  writeJson('history.json', history);
  writeJson('stats.json', stats);
  return item;
}
const getHistory = () => history;
function deleteHistory(id) { history = history.filter((h) => h.id !== id); writeJson('history.json', history); }
function clearHistory() { history = []; writeJson('history.json', history); }
const getStats = () => stats;

module.exports = { init, getSettings, setSettings, setApiKey, getApiKey, addHistory, getHistory, deleteHistory, clearHistory, getStats };
