const BAR_COUNT = 11;
const bars = document.getElementById('bars');
for (let i = 0; i < BAR_COUNT; i++) bars.appendChild(document.createElement('i'));
const label = document.getElementById('label');
const orb = document.getElementById('orb');

const GLYPH = {
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  ask: '<svg viewBox="0 0 24 24"><path d="M9 9a3 3 0 1 1 4 2.8c-.7.4-1 1-1 1.7M12 17.5h.01"/></svg>',
  translate: '<svg viewBox="0 0 24 24"><path d="M4 6h9M8.5 4v2M6 6c.5 3 3 6 6.500 7.500M12 6c-.5 3-3 6-7 8M13 20l4-9 4 9M14.500 17h5"/></svg>',
  done: '<svg viewBox="0 0 24 24"><path d="m5 12.500 4.500 4.500L19 7.500"/></svg>',
  error: '<svg viewBox="0 0 24 24"><path d="M12 6v7M12 17.500h.01"/></svg>',
  cancelled: '<svg viewBox="0 0 24 24"><path d="m7 7 10 10M17 7 7 17"/></svg>',
  processing: '<svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.600 5.600l2.100 2.100M16.300 16.300l2.100 2.100M5.600 18.400l2.100-2.100M16.300 7.700l2.100-2.100"/></svg>'
};

let rec = null; // { stream, ctx, recorder, chunks, startedAt, raf, mime }

hablo.onState(({ state, text, mode }) => {
  document.body.dataset.s = state;
  const long = (text || '').length > 34;
  label.classList.toggle('wrap', long && state === 'error');
  label.textContent = text || (state === 'listening' ? 'Escuchando…' : '');
  orb.innerHTML = state === 'listening' ? GLYPH[mode === 'ask' ? 'ask' : mode === 'translate' ? 'translate' : 'mic'] : GLYPH[state] || '';
});

function beep(ctx, f) {
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    o.frequency.value = f; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.13);
  } catch {}
}

hablo.onRecStart(async ({ whisper, micId, sound }) => {
  if (rec) cleanup();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: micId ? { exact: micId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
    const dest = ctx.createMediaStreamDestination();
    // Modo susurro: amplifica y comprime para captar voz muy baja.
    const gain = ctx.createGain(); gain.gain.value = whisper ? 6 : 1;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -40; comp.ratio.value = 6;
    src.connect(gain); gain.connect(comp); comp.connect(analyser); comp.connect(dest);

    const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    const recorder = new MediaRecorder(dest.stream, { mimeType: mime, audioBitsPerSecond: 64000 });
    rec = { stream, ctx, recorder, chunks: [], startedAt: performance.now(), mime };
    recorder.ondataavailable = (e) => e.data.size && rec && rec.chunks.push(e.data);
    recorder.start(250);
    if (sound) beep(ctx, 880);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const els = [...bars.children];
    const tick = () => {
      if (!rec) return;
      analyser.getByteTimeDomainData(data);
      let peak = 0; for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
      const lvl = Math.min(1, (peak / 128) * (whisper ? 1.2 : 2.4));
      els.forEach((el, i) => {
        const shape = 0.3 + 0.7 * Math.sin((i / (BAR_COUNT - 1)) * Math.PI);
        el.style.height = 4 + lvl * 24 * shape * (0.65 + Math.random() * 0.35) + 'px';
      });
      rec.raf = requestAnimationFrame(tick);
    };
    tick();
  } catch (e) {
    hablo.sendRecError('No se pudo abrir el micrófono');
  }
});

function cleanup() {
  if (!rec) return;
  cancelAnimationFrame(rec.raf);
  const r = rec;
  rec = null;
  r.stream.getTracks().forEach((t) => t.stop());
  r.ctx.close().catch(() => {});
}

hablo.onRecStop(() => {
  if (!rec) return;
  const r = rec;
  r.recorder.onstop = async () => {
    const ms = performance.now() - r.startedAt;
    const blob = new Blob(r.chunks, { type: r.mime });
    hablo.sendAudio({ buffer: await blob.arrayBuffer(), mime: r.mime, ms });
  };
  beep(r.ctx, 660);
  r.recorder.stop();
  setTimeout(() => { if (rec === r) cleanup(); }, 200);
});

hablo.onRecCancel(() => {
  if (!rec) return;
  rec.recorder.onstop = null;
  try { rec.recorder.stop(); } catch {}
  cleanup();
});
