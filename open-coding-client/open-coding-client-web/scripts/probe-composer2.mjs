// 临时探针：找出能真正启用 ChatSender 发送键并触发发送的事件序列。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 9364;
const BASE = 'http://127.0.0.1:5178';
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-composer2-'));
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

  const out = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const res = [];
    const setVal = (ta, v) => {
      ta.focus();
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(ta, v);
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const state = () => {
      const sender = document.querySelector('.t-chat-sender');
      const btn = sender.querySelector('.t-chat-sender__button__default');
      return {
        tag: btn?.tagName, disabled: btn?.disabled === true,
        disabledCls: /--disabled/.test(btn?.className ?? ''),
        text: (btn?.innerText ?? '').slice(0, 10),
      };
    };
    const probe = async (name, extra) => {
      const ta = document.querySelector('.t-chat-sender textarea');
      const len0 = document.querySelector('.oc-wb__stream')?.innerText.length ?? 0;
      setVal(ta, '策略-' + name);
      await extra(ta);
      await s(500);
      const st = state();
      let sent = null;
      if (!st.disabled && !st.disabledCls) {
        document.querySelector('.t-chat-sender .t-chat-sender__button__default').click();
        await s(1200);
        sent = (document.querySelector('.oc-wb__stream')?.innerText.length ?? 0) > len0;
      }
      res.push({ name, ...st, sent });
    };
    await probe('only-input', async () => {});
    await probe('input-change', async (ta) => { ta.dispatchEvent(new Event('change', { bubbles: true })); });
    await probe('input-blur', async (ta) => { ta.blur(); });
    await probe('input-change-blur', async (ta) => { ta.dispatchEvent(new Event('change', { bubbles: true })); ta.blur(); });
    await probe('keydown-enter', async (ta) => {
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, keyCode: 13 }));
    });
    return res;
  })()`, true);
  console.log(JSON.stringify(out, null, 1));
  await send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error('探针失败：', e.message); chrome.kill(); process.exit(2); });
