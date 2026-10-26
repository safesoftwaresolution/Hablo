const { contextBridge, ipcRenderer } = require('electron');

const on = (ch, fn) => ipcRenderer.on(ch, (_e, a) => fn(a));

contextBridge.exposeInMainWorld('hablo', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (p) => ipcRenderer.invoke('settings:set', p),
  setApiKey: (k) => ipcRenderer.invoke('apikey:set', k),
  testAI: () => ipcRenderer.invoke('ai:test'),
  reviewText: (t) => ipcRenderer.invoke('review:run', t),
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
