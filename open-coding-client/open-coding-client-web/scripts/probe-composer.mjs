// 临时探针：检查 Composer(ChatSender) 的发送链路与样式细节。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 9363;
const BASE = 'http://127.0.0.1:5178';
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-composer-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

(async () => {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res) => ws.addEventListener('open', res));
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const { resolve } = pending.get(m.id); pending.delete(m.id); resolve(m.result); }
  });
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, { resolve: res }); ws.send(JSON.stringify({ id: i, method, params })); });
  const evalJs = async (expr, awaitPromise = false) => (await send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true })).result.value;

  await send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);
  await evalJs(`localStorage.setItem('oc.onboarded','1')`);
  await send('Page.navigate', { url: `${BASE}/#/session` });
  await sleep(2400);

  const diag = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const out = {};
    const sender = document.querySelector('.t-chat-sender');
    out.senderFound = !!sender;
    if (!sender) return out;
    out.senderClasses = [...sender.querySelectorAll('*')].slice(0, 30).map(e => e.tagName.toLowerCase() + '.' + (typeof e.className === 'string' ? e.className.split(' ')[0] : ''));
    const ta = sender.querySelector('textarea');
    out.hasTa = !!ta;
    if (ta) {
      ta.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, '探针内容');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      await s(400);
      out.taValue = ta.value;
    }
    const btn = sender.querySelector('.t-chat-sender__button__sendbtn');
    out.btn = btn ? { tag: btn.tagName, cls: btn.className, aria: btn.getAttribute('aria-disabled'), parentCls: btn.parentElement?.className } : null;
    const before = document.querySelector('.oc-wb__stream')?.innerText.length ?? 0;
    if (btn) { btn.click(); await s(1200); }
    const after = document.querySelector('.oc-wb__stream')?.innerText.length ?? 0;
    out.before = before; out.after = after;
    out.echo = (document.querySelector('.oc-wb__stream')?.innerText ?? '').includes('探针内容');
    return out;
  })()`, true);
  console.log(JSON.stringify(diag, null, 1));
  await send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error('探针失败：', e.message); chrome.kill(); process.exit(2); });
