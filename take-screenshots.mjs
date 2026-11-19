// Screenshot driver for Sunset State Cover Studio.
//
// Serves app/ with the starter's serve.ts, drives the cached headless
// Chromium over CDP (WebSocket), waits for each shot scene's
// window.__shotReady flag, and captures the four entry screenshots at
// their display sizes. Run: node take-screenshots.mjs

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome';
const HTTP_PORT = 8901;
const CDP_PORT = 9333;
const BASE = `http://127.0.0.1:${HTTP_PORT}`;

const SHOTS = [
  { file: '1-cover-landscape.jpg', url: '/?shot=cover&scene=face', w: 1280, h: 720 },
  { file: '2-editor.jpg', url: '/?shot=editor', w: 1280, h: 800 },
  { file: '3-cover-portrait.jpg', url: '/?shot=cover&scene=portrait', w: 1024, h: 1280 },
  { file: '4-cover-square.jpg', url: '/?shot=cover&scene=square', w: 1280, h: 1280 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    try {
      if (await fn()) return;
    } catch (e) { /* not yet */ }
    if (Date.now() - start > timeoutMs) throw new Error(`timeout waiting for ${label}`);
    await sleep(250);
  }
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return { ready, send, close: () => ws.close() };
}

async function main() {
  const server = spawn('node', ['serve.ts', '--port', String(HTTP_PORT)], { cwd: here, stdio: 'ignore' });
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1280,800',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    await waitFor(async () => (await fetch(`${BASE}/`)).ok, 15000, 'static server');
    let pageWs = null;
    await waitFor(async () => {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) pageWs = page.webSocketDebuggerUrl;
      return !!pageWs;
    }, 15000, 'chrome page target');

    const cdp = cdpClient(pageWs);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    mkdirSync(join(here, 'screenshots'), { recursive: true });
    for (const shot of SHOTS) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: shot.w, height: shot.h, deviceScaleFactor: 1, mobile: false,
      });
      await cdp.send('Page.navigate', { url: BASE + shot.url });
      await waitFor(async () => {
        const res = await cdp.send('Runtime.evaluate', {
          expression: 'window.__shotReady === true', returnByValue: true,
        });
        return res.result && res.result.value === true;
      }, 45000, `shotReady ${shot.file}`);
      await sleep(350);
      const shotRes = await cdp.send('Page.captureScreenshot', {
        format: 'jpeg', quality: 88, captureBeyondViewport: false,
      });
      const out = join(here, 'screenshots', shot.file);
      writeFileSync(out, Buffer.from(shotRes.data, 'base64'));
      console.log(shot.file, shot.w + 'x' + shot.h, Buffer.from(shotRes.data, 'base64').length, 'bytes');
    }
    cdp.close();
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
