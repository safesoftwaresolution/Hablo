const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (ch, fn) => ipcRenderer.on(ch, (_e, a) => fn(a));

// Un File no cruza el puente de contexto, así que las rutas de los archivos soltados se resuelven aquí.
let dropCb;
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const paths = [...(e.dataTransfer?.files || [])].map((f) => webUtils.getPathForFile(f)).filter(Boolean);
  if (paths.length && dropCb) dropCb(paths);
});

contextBridge.exposeInMainWorld('hablo', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (p) => ipcRenderer.invoke('settings:set', p),
  setApiKey: (k) => ipcRenderer.invoke('apikey:set', k),
  testAI: () => ipcRenderer.invoke('ai:test'),
  reviewText: (t) => ipcRenderer.invoke('review:run', t),
  summarize: (t) => ipcRenderer.invoke('summary:run', t),
  exportHistory: () => ipcRenderer.invoke('history:export'),
  pickAudio: () => ipcRenderer.invoke('audio:pick'),
  transcribeFile: (filePath, polish) => ipcRenderer.invoke('audio:transcribe', { filePath, polish }),
  onFilesDropped: (f) => { dropCb = f; },
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  getStats: () => ipcRenderer.invoke('stats:get'),
  copy: (t) => ipcRenderer.invoke('clipboard:write', t),
  insert: (t) => ipcRenderer.invoke('answer:insert', t),
  suspendHotkeys: (on) => ipcRenderer.invoke('hotkeys:suspend', on),
  testStatus: () => ipcRenderer.invoke('test:status'),
  // overlay
  sendAudio: (p) => ipcRenderer.send('rec:data', p),
  sendRecError: (m) => ipcRenderer.send('rec:error', m),
  onRecStart: (f) => on('rec:start', f),
  onRecStop: (f) => on('rec:stop', f),
  onRecCancel: (f) => on('rec:cancel', f),
  onState: (f) => on('ui:state', f),
  // app
  onDataChanged: (f) => on('data:changed', f),
  onHotkeyErrors: (f) => on('hotkey:errors', f),
  onAnswer: (f) => on('answer:set', f)
});
