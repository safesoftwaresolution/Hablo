const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const LANGS = [['auto', 'Automático (mezcla idiomas)'], ['es', 'Español'], ['en', 'English'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['ja', '日本語'], ['zh', '中文'], ['ko', '한국어'], ['ru', 'Русский'], ['ar', 'العربية'], ['hi', 'हिन्दी']];
const TONES = [['auto', 'Auto', 'se adapta'], ['formal', 'Formal', 'profesional'], ['casual', 'Casual', 'cercano'], ['concise', 'Conciso', 'al grano'], ['literal', 'Literal', 'sin reescribir']];
const PRESETS = {
  openai: { baseUrl: 'https://api.openai.com/v1', sttModel: 'gpt-4o-mini-transcribe', chatModel: 'gpt-4o-mini' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', sttModel: 'whisper-large-v3-turbo', chatModel: 'llama-3.1-8b-instant' }
};
const KIND = { dictation: 'Dictado', edit: 'Edición', ask: 'Pregunta', translation: 'Traducción' };

let S, toastT;

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400);
}
async function save(patch) {
  const { settings, errors } = await hablo.setSettings(patch);
  S = settings; showErrors(errors); paintKeys();
}
function showErrors(errs) {
  const b = $('banner'); b.hidden = !errs.length; b.textContent = errs.join(' · ');
}

// ---------- navegación ----------
function go(page) {
  document.querySelectorAll('main > section').forEach((s) => (s.hidden = s.id !== 'p-' + page));
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.p === page));
  $('main').scrollTop = 0;
  if (page === 'home') renderHome();
  if (page === 'history') renderHistory();
  if (page === 'templates') renderTemplates();
  if (page === 'settings') loadMics();
}
$('nav').onclick = (e) => { const b = e.target.closest('button'); if (b) go(b.dataset.p); };
document.addEventListener('click', (e) => { if (e.target.dataset.go) { e.preventDefault(); go(e.target.dataset.go); } });

// ---------- utilidades ----------
const initials = (s) => (s || '?').replace(/\.exe$/i, '').slice(0, 2).replace(/^./, (c) => c.toUpperCase());
const hue = (s) => { let h = 0; for (const c of s || '?') h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avatar = (app) => `<div class="avatar" style="background:linear-gradient(135deg,hsl(${hue(app)} 70% 58%),hsl(${(hue(app) + 50) % 360} 75% 62%))">${esc(initials(app))}</div>`;
const words = (t) => (t.match(/\S+/g) || []).length;
const keycaps = (combo) => combo.split('+').map((k) => `<kbd>${esc(k)}</kbd>`).join('');
const timeOf = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function dayLabel(t) {
  const d = new Date(t), now = new Date(), y = new Date(now - 864e5);
  if (d.toDateString() === now.toDateString()) return 'Hoy';
  if (d.toDateString() === y.toDateString()) return 'Ayer';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}
function itemHtml(h) {
  return `<div class="item" data-id="${h.id}">${avatar(h.app || KIND[h.kind])}
    <div class="body"><div class="meta"><span class="tag">${KIND[h.kind] || h.kind}</span><span>${esc(h.app || '')}</span><span>${timeOf(h.at)}</span><span class="sp"></span>
      <span class="acts"><button class="icon-btn" data-act="copy">Copiar</button>${words(h.text) >= 40 ? '<button class="icon-btn" data-act="sum">Resumir</button>' : ''}<button class="icon-btn" data-act="review">Revisar</button><button class="icon-btn" data-act="del">Borrar</button></span></div>
      <div class="txt">${esc(h.text)}</div>
      ${h.raw && h.raw !== h.text ? `<div class="raw">Lo que dijiste: ${esc(h.raw)}</div>` : ''}${summaries.has(h.id) ? summaryHtml(summaries.get(h.id)) : ''}</div></div>`;
}

// ---------- inicio ----------
function greeting() { const h = new Date().getHours(); return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'; }

async function renderHome() {
  if (!S) return;
  $('greet').textContent = greeting();
  $('kDictate').innerHTML = keycaps(S.hotkeys.dictate);
  $('kAsk').innerHTML = keycaps(S.hotkeys.ask);
  $('kTranslate').innerHTML = keycaps(S.hotkeys.translate);
  $('trLang').textContent = S.translate.target;
  $('setupHint').hidden = S.hasKey;
  const [hist, st] = await Promise.all([hablo.getHistory(), hablo.getStats()]);
  const spoken = hist.filter((h) => h.kind !== 'ask');
  const today = new Date().toDateString();
  const todayWords = spoken.filter((h) => new Date(h.at).toDateString() === today).reduce((n, h) => n + words(h.text), 0);
  const timed = spoken.filter((h) => h.ms > 0);
  const tw = timed.reduce((n, h) => n + words(h.text), 0), tm = timed.reduce((n, h) => n + h.ms, 0) / 60000;
  $('sWords').textContent = st.totalWords.toLocaleString();
  $('sToday').textContent = todayWords.toLocaleString();
  $('sWpm').textContent = tm > 0 ? Math.round(tw / tm) : '—';
  const saved = Math.max(0, st.totalWords / 45 - hist.reduce((n, h) => n + (h.ms || 0), 0) / 60000);
  $('sSaved').textContent = saved >= 60 ? `${(saved / 60).toFixed(1)} h` : `${Math.round(saved)} min`;
  $('sideStats').innerHTML = `<b>${st.totalWords.toLocaleString()}</b><span>palabras dictadas</span>`;

  const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { d, n: 0 }; });
  for (const h of spoken) { const s = new Date(h.at).toDateString(); const slot = days.find((x) => x.d.toDateString() === s); if (slot) slot.n += words(h.text); }
  const max = Math.max(1, ...days.map((x) => x.n));
  $('bars').innerHTML = days.map((x, i) => `<div class="${i === 6 ? 'today' : ''}" title="${x.n} palabras"><i style="height:${Math.max(4, (x.n / max) * 100)}%"></i><span>${x.d.toLocaleDateString([], { weekday: 'short' }).slice(0, 3)}</span></div>`).join('');
  $('recent').innerHTML = hist.slice(0, 3).map(itemHtml).join('') || '<div class="empty">Aún no hay dictados. Usa tu atajo y empieza a hablar.</div>';
}

// ---------- historial ----------
async function renderHistory() {
  const f = $('histFilter').value.toLowerCase(), kind = $('histKind').value;
  const hist = (await hablo.getHistory()).filter((h) => (!kind || h.kind === kind) && (!f || h.text.toLowerCase().includes(f) || (h.app || '').toLowerCase().includes(f)));
  let last = '', out = '';
  for (const h of hist) { const l = dayLabel(h.at); if (l !== last) { out += `<div class="day">${esc(l)}</div>`; last = l; } out += itemHtml(h); }
  $('histList').innerHTML = out || '<div class="empty">No hay nada que mostrar.</div>';
}
$('histFilter').oninput = renderHistory;
$('histKind').onchange = renderHistory;
$('exportHist').onclick = async () => { const r = await hablo.exportHistory(); if (r.ok) toast('Historial exportado'); };
function summaryHtml(x) {
  const task = (t) => `<li>${esc(t.tarea)}${t.responsable || t.fecha ? ` <span class="muted small">· ${esc([t.responsable, t.fecha].filter(Boolean).join(' · '))}</span>` : ''}</li>`;
  return `<div class="sum"><b>Resumen</b><p>${esc(x.resumen)}</p>
    ${x.puntos.length ? `<ul>${x.puntos.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
    ${x.tareas.length ? `<b>Tareas</b><ul>${x.tareas.map(task).join('')}</ul>` : ''}
    <button class="icon-btn" data-act="sumcopy">Copiar resumen</button></div>`;
}
const sumText = (x) => [x.resumen, ...x.puntos.map((p) => `- ${p}`), ...(x.tareas.length ? ['', 'Tareas:', ...x.tareas.map((t) => `- ${t.tarea}${t.responsable || t.fecha ? ` (${[t.responsable, t.fecha].filter(Boolean).join(', ')})` : ''}`)] : [])].join('\n');
const summaries = new Map(); // id → resumen, mientras la app está abierta
document.addEventListener('click', async (e) => {
  const act = e.target.dataset.act; if (!act) return;
  const id = e.target.closest('.item').dataset.id;
  if (act === 'copy') { const h = (await hablo.getHistory()).find((x) => x.id === id); hablo.copy(h.text); toast('Copiado'); }
  if (act === 'sumcopy') { hablo.copy(sumText(summaries.get(id))); toast('Copiado'); return; }
  if (act === 'sum') {
    const body = e.target.closest('.item').querySelector('.body');
    body.querySelector('.sum')?.remove();
    e.target.textContent = 'Resumiendo…'; e.target.disabled = true;
    const h = (await hablo.getHistory()).find((x) => x.id === id);
    const r = await hablo.summarize(h.text);
    e.target.textContent = 'Resumir'; e.target.disabled = false;
    if (!r.ok) { toast(r.error); return; }
    summaries.set(id, r.result);
    body.insertAdjacentHTML('beforeend', summaryHtml(r.result));
    return;
  }
  if (act === 'review') { const h = (await hablo.getHistory()).find((x) => x.id === id); $('revText').value = h.text; $('revText').oninput(); $('revOut').innerHTML = ''; go('review'); }
  if (act === 'del') { await hablo.deleteHistory(id); renderHistory(); renderHome(); }
});
$('clearHist').onclick = async () => { if (confirm('¿Borrar todo el historial?')) { await hablo.clearHistory(); renderHistory(); renderHome(); } };

// ---------- diccionario ----------
function renderDict() {
  $('dictList').innerHTML = S.dictionary.map((t) => `<span class="chip">${esc(t)}<button data-del="${esc(t)}" title="Quitar">✕</button></span>`).join('')
    || '<div class="empty" style="width:100%">Aún no hay términos.</div>';
}
async function addTerms() {
  const terms = $('dictInput').value.split(/[,\n]/).map((t) => t.trim()).filter(Boolean);
  if (!terms.length) return;
  await save({ dictionary: [...new Set([...S.dictionary, ...terms])] });
  $('dictInput').value = ''; renderDict();
}
$('dictAdd').onclick = addTerms;
$('dictInput').onkeydown = (e) => e.key === 'Enter' && addTerms();
$('dictList').onclick = async (e) => {
  const t = e.target.dataset.del; if (t === undefined) return;
  await save({ dictionary: S.dictionary.filter((x) => x !== t) }); renderDict();
};

// ---------- revisor ----------
const LEVEL = { baja: ['Probabilidad baja', 'ok'], media: ['Probabilidad media', 'mid'], alta: ['Probabilidad alta', 'hi'] };
$('revText').oninput = () => { const n = words($('revText').value); $('revCount').textContent = `${n} palabra${n === 1 ? '' : 's'}`; };
$('revRun').onclick = async () => {
  const text = $('revText').value.trim(); if (!text) return;
  $('revRun').disabled = true; $('revRun').textContent = 'Analizando…'; $('revOut').innerHTML = '';
  const r = await hablo.reviewText(text);
  $('revRun').disabled = false; $('revRun').textContent = 'Analizar';
  if (!r.ok) { $('revOut').innerHTML = `<div class="banner" style="margin-top:14px">${esc(r.error)}</div>`; return; }
  const x = r.result, [label, cls] = LEVEL[x.nivel];
  $('revOut').innerHTML = `
    <div class="card rev"><div class="row between wrap"><span class="lvl ${cls}">${label}${x.rango ? ` · ${esc(x.rango)}` : ''}</span></div>
      <p>${esc(x.resumen)}</p>
      ${x.senales.length ? `<h3>Señales detectadas</h3><ul>${x.senales.map((s) => `<li><b>${esc(s.patron)}</b>${s.ejemplo ? `<br><span class="muted small">«${esc(s.ejemplo)}»</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${x.mejoras.length ? `<h3>Cómo mejorarlo</h3><ul>${x.mejoras.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : ''}
    </div>
    ${x.reescritura ? `<div class="card rev"><div class="row between"><h3>Versión más personal</h3><button class="btn sm" id="revCopy">Copiar</button></div><div class="txt" id="revRewrite">${esc(x.reescritura)}</div></div>` : ''}`;
  if (x.reescritura) $('revCopy').onclick = () => { hablo.copy(x.reescritura); toast('Copiado'); };
};

// ---------- plantillas ----------
function renderTemplates() {
  $('tplList').innerHTML = S.templates.map((t) => `
    <div class="card tpl" data-id="${esc(t.id)}">
      <div class="row"><input data-f="name" value="${esc(t.name)}" placeholder="Nombre que dirás al dictar, ej.: acta de reunión"><button class="icon-btn" data-rmtpl="${esc(t.id)}" title="Borrar">Borrar</button></div>
      <textarea data-f="structure" rows="5" placeholder="Estructura: apartados o instrucciones, una por línea">${esc(t.structure)}</textarea>
    </div>`).join('') || '<div class="empty">No hay plantillas. Crea la primera.</div>';
}
$('tplList').onchange = async (e) => {
  const f = e.target.dataset.f; if (!f) return;
  const id = e.target.closest('.tpl').dataset.id;
  await save({ templates: S.templates.map((t) => (t.id === id ? { ...t, [f]: e.target.value } : t)) });
};
$('tplList').onclick = async (e) => {
  const id = e.target.dataset.rmtpl; if (!id) return;
  await save({ templates: S.templates.filter((t) => t.id !== id) }); renderTemplates();
};
$('addTpl').onclick = async () => {
  await save({ templates: [{ id: Date.now().toString(36), name: '', structure: '' }, ...S.templates] }); renderTemplates();
  $('tplList').querySelector('input')?.focus();
};

// ---------- estilo ----------
const opts = (list, sel) => list.map(([v, l]) => `<option value="${v}" ${v === sel ? 'selected' : ''}>${l}</option>`).join('');
function renderTone() {
  $('toneSeg').innerHTML = TONES.map(([v, l, d]) => `<button data-tone="${v}" class="${S.tone === v ? 'on' : ''}"><b>${l}</b><span>${d}</span></button>`).join('');
}
$('toneSeg').onclick = async (e) => { const b = e.target.closest('button'); if (!b) return; await save({ tone: b.dataset.tone }); renderTone(); };
function renderRules() {
  $('rules').innerHTML = S.appRules.map((r, i) => `
    <div class="rule">${avatar(r.match || '?')}<input data-i="${i}" data-f="match" value="${esc(r.match)}" placeholder="slack, outlook, code…">
    <select data-i="${i}" data-f="tone">${opts(TONES.map(([v, l]) => [v, l]), r.tone)}</select><button class="icon-btn" data-rm="${i}" title="Quitar">✕</button></div>`).join('');
}
$('rules').onchange = async (e) => {
  const { i, f } = e.target.dataset; if (i === undefined) return;
  await save({ appRules: S.appRules.map((r, n) => (n === +i ? { ...r, [f]: e.target.value } : r)) }); renderRules();
};
$('rules').onclick = async (e) => {
  if (e.target.dataset.rm === undefined) return;
  await save({ appRules: S.appRules.filter((_, n) => n !== +e.target.dataset.rm) }); renderRules();
};
$('addRule').onclick = async () => { await save({ appRules: [...S.appRules, { match: '', tone: 'auto' }] }); renderRules(); };
$('language').onchange = (e) => save({ language: e.target.value });
$('cleanup').onchange = (e) => save({ cleanup: e.target.checked });
$('aboutMe').onchange = (e) => save({ aboutMe: e.target.value });
$('trTarget').onchange = (e) => save({ translate: { target: e.target.value.trim() || 'English' } });

// ---------- ajustes ----------
function fillProvider() {
  $('baseUrl').value = S.provider.baseUrl; $('sttModel').value = S.provider.sttModel; $('chatModel').value = S.provider.chatModel;
  $('keyState').textContent = S.hasKey ? '· guardada ✓' : '· sin configurar';
  $('keyState').style.color = S.hasKey ? 'var(--ok)' : 'var(--danger)';
  document.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', PRESETS[b.dataset.preset].baseUrl === S.provider.baseUrl));
  $('hkMode').textContent = S.hookMode ? 'Mantener pulsado funciona en todo el sistema.' : 'El hook de teclado no cargó: los atajos funcionan solo con un toque (alternar).';
}
document.querySelectorAll('[data-preset]').forEach((b) => (b.onclick = async () => { await save({ provider: PRESETS[b.dataset.preset] }); fillProvider(); }));
['baseUrl', 'sttModel', 'chatModel'].forEach((id) => ($(id).onchange = async () => { await save({ provider: { [id]: $(id).value.trim() } }); fillProvider(); }));
async function saveKey(k) { S = await hablo.setApiKey(k); fillProvider(); renderHome(); }
$('saveKey').onclick = async () => { const k = $('apiKey').value.trim(); if (!k) return; await saveKey(k); $('apiKey').value = ''; toast('API key guardada, cifrada en este equipo'); };
$('testAI').onclick = async () => {
  $('testRes').textContent = 'Probando…'; $('testRes').style.color = '';
  const r = await hablo.testAI();
  $('testRes').textContent = r.ok ? 'Conexión correcta ✓' : r.error;
  $('testRes').style.color = r.ok ? 'var(--ok)' : 'var(--danger)';
};
$('whisper').onchange = (e) => save({ whisperMode: e.target.checked });
$('sound').onchange = (e) => save({ sound: e.target.checked });
$('autostart').onchange = (e) => save({ autostart: e.target.checked });
$('mic').onchange = (e) => save({ micId: e.target.value });

async function loadMics() {
  try {
    (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach((t) => t.stop());
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    $('mic').innerHTML = `<option value="">Predeterminado del sistema</option>` +
      devs.map((d) => `<option value="${d.deviceId}" ${d.deviceId === S.micId ? 'selected' : ''}>${esc(d.label || 'Micrófono')}</option>`).join('');
  } catch { $('mic').innerHTML = '<option>Sin acceso al micrófono</option>'; }
}
let meter = null;
async function runMeter(fill, hint, ms = 5000) {
  if (meter) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: S.micId ? { exact: S.micId } : undefined } });
    const ctx = new AudioContext(), an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const d = new Uint8Array(an.fftSize); let peak = 0;
    meter = setInterval(() => {
      an.getByteTimeDomainData(d); let p = 0; for (const v of d) p = Math.max(p, Math.abs(v - 128));
      peak = Math.max(peak, p); fill.style.width = Math.min(100, (p / 128) * 220) + '%';
    }, 50);
    setTimeout(() => {
      clearInterval(meter); meter = null; stream.getTracks().forEach((t) => t.stop()); ctx.close(); fill.style.width = '0';
      hint.textContent = peak > 12 ? 'Se escucha bien ✓' : 'No se detecta voz. Revisa el micrófono.';
    }, ms);
    hint.textContent = 'Escuchando… di algo.';
  } catch { hint.textContent = 'No se pudo abrir el micrófono.'; }
}
$('micTest').onclick = () => runMeter($('meterFill'), $('micHint'));

// ---------- captura de atajos ----------
const MOD = { ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', ShiftLeft: 'Shift', ShiftRight: 'Shift', MetaLeft: 'Win', MetaRight: 'Win' };
function keyName(e) {
  if (MOD[e.code]) return MOD[e.code];
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
  return e.code.replace('Arrow', '').replace('Numpad', 'Num');
}
function paintKeys() { document.querySelectorAll('.keybtn').forEach((b) => { if (!b.classList.contains('rec')) b.innerHTML = keycaps(S.hotkeys[b.dataset.hk]); }); }
document.querySelectorAll('.keybtn').forEach((btn) => {
  btn.onclick = () => {
    if (btn.classList.contains('rec')) return;
    btn.classList.add('rec'); btn.textContent = 'Pulsa la combinación…';
    hablo.suspendHotkeys(true);
    const held = new Set(); let best = [];
    const finish = async (combo) => {
      document.removeEventListener('keydown', down, true); document.removeEventListener('keyup', up, true);
      btn.classList.remove('rec'); await hablo.suspendHotkeys(false);
      if (combo) await save({ hotkeys: { [btn.dataset.hk]: combo } });
      paintKeys(); renderHome();
    };
    const down = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (e.code === 'Escape') return finish(null);
      held.add(keyName(e));
      const order = ['Ctrl', 'Alt', 'Shift', 'Win'];
      const arr = [...held].sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9));
      if (arr.length >= best.length) best = arr;
      btn.innerHTML = keycaps(arr.join('+'));
    };
    // Termina al soltar cualquier tecla cuando ya hay una tecla no modificadora (Alt a veces no envía su keyup);
    // las combinaciones solo de modificadores terminan al soltarlo todo.
    const up = (e) => {
      e.preventDefault(); held.delete(keyName(e));
      const hasMain = best.some((k) => !['Ctrl', 'Alt', 'Shift', 'Win'].includes(k));
      if (hasMain) return finish(best.length >= 2 || /^F\d/.test(best[0]) ? best.join('+') : null);
      if (!held.size && best.length >= 2) finish(best.join('+'));
    };
    document.addEventListener('keydown', down, true); document.addEventListener('keyup', up, true);
  };
});

// ---------- onboarding ----------
let obStep = 0;
const OB = [
  () => `<div class="big-orb"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/></svg></div>
    <h1>Bienvenido a Hablo</h1><p class="lead">Tu teclado de voz. Habla en cualquier app y el texto aparece ya pulido: sin muletillas, con puntuación y en el tono correcto.</p>
    <div class="muted small">Tarda un minuto: conectar la IA, probar el micrófono y aprender el atajo.</div>`,
  () => `<h1>Conecta tu IA</h1><p class="lead">Hablo usa tu propia clave. El audio va directo al proveedor, sin servidores intermedios.</p>
    <div class="provider-pick"><button data-obp="openai" class="${PRESETS.openai.baseUrl === S.provider.baseUrl ? 'on' : ''}"><b>OpenAI</b><span>Muy preciso</span></button><button data-obp="groq" class="${PRESETS.groq.baseUrl === S.provider.baseUrl ? 'on' : ''}"><b>Groq</b><span>Muy rápido</span></button></div>
    <label class="field"><span>API key ${S.hasKey ? '<b style="color:var(--ok)">· guardada ✓</b>' : ''}</span><input id="obKey" type="password" placeholder="Pega tu clave aquí" autocomplete="off"></label>`,
  () => `<h1>Prueba tu micrófono</h1><p class="lead">Di algo en voz normal. La barra debe moverse.</p>
    <div class="meter"><i id="obMeter"></i></div><div class="row between" style="margin-top:14px"><span class="muted small" id="obMicHint">Pulsa probar y habla.</span><button class="btn sm" id="obMicTest">Probar</button></div>`,
  () => `<h1>Así se usa</h1><p class="lead">Un atajo, tres formas de usarlo.</p>
    <div class="hk-row"><div><b>Mantén pulsado y habla</b><div class="muted small">Suelta para insertar el texto</div></div><div class="keys">${keycaps(S.hotkeys.dictate)}</div></div>
    <div class="hk-row"><div><b>Toca una vez</b><div class="muted small">Manos libres; toca de nuevo para terminar</div></div><div class="keys">${keycaps(S.hotkeys.dictate)}</div></div>
    <div class="hk-row"><div><b>Esc</b><div class="muted small">Cancela sin escribir nada</div></div><div class="keys"><kbd>Esc</kbd></div></div>
    <div class="muted small" style="margin-top:12px">Pruébalo en el recuadro de la pantalla de inicio.</div>`
];
function renderOb() {
  $('obDots').innerHTML = OB.map((_, i) => `<i class="${i <= obStep ? 'on' : ''}"></i>`).join('');
  $('obBody').innerHTML = OB[obStep]();
  $('obBack').style.visibility = obStep ? 'visible' : 'hidden';
  $('obNext').textContent = obStep === OB.length - 1 ? 'Empezar' : 'Continuar';
  if (obStep === 2) $('obMicTest').onclick = () => runMeter($('obMeter'), $('obMicHint'));
}
$('obBody').onclick = async (e) => {
  const b = e.target.closest('[data-obp]'); if (!b) return;
  await save({ provider: PRESETS[b.dataset.obp] }); renderOb();
};
$('obBack').onclick = () => { obStep--; renderOb(); };
$('obNext').onclick = async () => {
  if (obStep === 1 && $('obKey')?.value.trim()) await saveKey($('obKey').value.trim());
  if (obStep < OB.length - 1) { obStep++; renderOb(); return; }
  $('ob').hidden = true; await save({ onboarded: true }); go('home');
};
function openOb() { obStep = 0; $('ob').hidden = false; renderOb(); }
$('redoOb').onclick = openOb;

// ---------- init ----------
async function init() {
  S = await hablo.getSettings();
  document.querySelector('.wave').innerHTML = [...Array(18)].map((_, i) => `<i style="animation-delay:${(i * 0.09).toFixed(2)}s"></i>`).join('');
  $('language').innerHTML = opts(LANGS, S.language);
  $('cleanup').checked = S.cleanup; $('aboutMe').value = S.aboutMe; $('trTarget').value = S.translate.target;
  $('whisper').checked = S.whisperMode; $('sound').checked = S.sound; $('autostart').checked = S.autostart;
  fillProvider(); paintKeys(); renderTone(); renderRules(); renderDict(); renderHome();
  if (!S.onboarded) openOb();
}
hablo.onDataChanged(() => { renderHome(); if (!$('p-history').hidden) renderHistory(); });
hablo.onHotkeyErrors(showErrors);
init();
