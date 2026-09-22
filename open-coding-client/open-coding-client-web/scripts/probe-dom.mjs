// 临时 DOM 探针：进入指定路由，dump 选择器命中数量、文本与按钮清单。
// 用法：node scripts/probe-dom.mjs --hash /session [--sel ".oc-wb__stream"] [--buttons]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'http://127.0.0.1:5178');
// Git Bash 会把前导 `/` 的参数改写成 Windows 路径，这里统一归一化
const rawHash = argOf('--hash', 'session');
const HASH = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
const SEL = argOf('--sel', '');
const PORT = Number(argOf('--port', '9361'));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-probe-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu', 'about:blank',
], { stdio: 'ignore' });

(async () => {
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
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
  await send('Page.navigate', { url: `${BASE}/#${HASH}` });
  await sleep(2400);

  const info = await evalJs(`JSON.stringify((() => {
    const out = { url: location.hash, bodyLen: document.body.innerText.length };
    out.streamLen = (document.querySelector('.oc-wb__stream')?.innerText ?? '').length;
    out.itemCount = document.querySelectorAll('.oc-item').length;
    out.buttons = [...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim().slice(0, 20)).filter(Boolean);
    out.items = [...document.querySelectorAll('.oc-item')].slice(0, 4).map((el) => {
      const chain = []; let p = el.parentElement;
      while (p && chain.length < 6) { chain.push(p.className && typeof p.className === 'string' ? p.className.split(' ')[0] : p.tagName); p = p.parentElement; }
      const cs = getComputedStyle(el);
      return { cls: el.className, textLen: el.innerText.length, text: el.innerText.slice(0, 60), parentChain: chain.join(' < '), h: el.offsetHeight, w: el.offsetWidth, vis: cs.visibility, disp: cs.display, op: cs.opacity, html: el.innerHTML.slice(0, 120) };
    });
    const geo = (sel) => { const el = document.querySelector(sel); if (!el) return null; const cs = getComputedStyle(el); return { h: el.offsetHeight, w: el.offsetWidth, disp: cs.display, vis: cs.visibility, over: cs.overflow, html: el.children.length }; };
    out.geo = { wb: geo('.oc-wb'), stream: geo('.oc-wb__stream'), state: geo('.oc-state'), chat: geo('.t-chat'), list: geo('.t-chat__list'), item0: geo('t-chat-item') };
    ${SEL ? `out.sel = { count: document.querySelectorAll(${JSON.stringify(SEL)}).length, text: (document.querySelector(${JSON.stringify(SEL)})?.innerText ?? '').slice(0, 400), html: (document.querySelector(${JSON.stringify(SEL)})?.outerHTML ?? '').slice(0, 1200) };` : ''}
    return out;
  })())`);
  console.log(info);
  await send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error('探针失败：', e.message); chrome.kill(); process.exit(2); });
