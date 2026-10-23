// Proceso PowerShell persistente: contexto de la ventana activa, copiar y pegar.
const { spawn } = require('child_process');
const { clipboard } = require('electron');

const SCRIPT = `
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Text;
public class W {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static void ReleaseMods() { foreach (byte k in new byte[]{0x10,0x11,0x12,0x5B,0x5C}) keybd_event(k, 0, 2, UIntPtr.Zero); }
}
"@
Write-Output 'READY'
while (($line = [Console]::In.ReadLine()) -ne $null) {
  try {
    switch ($line) {
      'ctx' {
        $h = [W]::GetForegroundWindow(); $p2 = 0
        [void][W]::GetWindowThreadProcessId($h, [ref]$p2)
        $sb = New-Object Text.StringBuilder 512
        [void][W]::GetWindowText($h, $sb, 512)
        $pr = Get-Process -Id $p2 -ErrorAction SilentlyContinue
        @{ app = [string]$pr.ProcessName; title = $sb.ToString() } | ConvertTo-Json -Compress
      }
      'paste' { [W]::ReleaseMods(); Start-Sleep -Milliseconds 40; [System.Windows.Forms.SendKeys]::SendWait('^v'); 'ok' }
      'copy'  { [W]::ReleaseMods(); Start-Sleep -Milliseconds 40; [System.Windows.Forms.SendKeys]::SendWait('^c'); 'ok' }
      default { 'unknown' }
    }
  } catch { 'err' }
  Write-Output '<<END>>'
}
`;

let proc = null;
let buf = '';
let ready;
let queue = [];

function start() {
  const enc = Buffer.from(SCRIPT, 'utf16le').toString('base64');
  proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', enc], { windowsHide: true });
  proc.stdout.setEncoding('utf8');
  ready = new Promise((res) => { proc._ready = res; });
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).replace(/\r$/, '');
      buf = buf.slice(i + 1);
      if (line === 'READY') proc._ready();
      else if (line === '<<END>>') { const q = queue.shift(); if (q) q.resolve(q.lines.join('\n')); }
      else if (queue[0]) queue[0].lines.push(line);
    }
  });
  proc.on('exit', () => { proc = null; queue.forEach((q) => q.resolve('')); queue = []; });
}

async function cmd(name) {
  if (!proc) start();
  await ready;
  return new Promise((resolve) => {
    queue.push({ resolve, lines: [] });
    proc.stdin.write(name + '\n');
  });
}

// Restaura el portapapeles de texto; vacío se limpia (writeText('') falla en Electron).
async function restore(prev) { try { if (typeof prev === 'string' && prev) await clipboard.writeText(prev); else await clipboard.clear(); } catch {} }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function context() {
  try { return JSON.parse(await cmd('ctx')) || {}; } catch { return {}; }
}

// Pega texto en la app activa y restaura el portapapeles.
async function insert(text) {
  const prev = await clipboard.readText();
  await clipboard.writeText(text);
  await cmd('paste');
  await sleep(250);
  await restore(prev);
}

// Devuelve el texto seleccionado ('' si no hay).
async function selection() {
  const prev = await clipboard.readText();
  const sentinel = `__hablo_${Date.now()}__`;
  await clipboard.writeText(sentinel);
  await cmd('copy');
  await sleep(140);
  const got = await clipboard.readText();
  await restore(prev);
  return !got || got.includes(sentinel) ? '' : got;
}

function stop() { try { proc?.kill(); } catch {} }

module.exports = { start, context, insert, selection, stop };
