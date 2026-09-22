// 临时探针：ProviderEditor 的「凭证引用」Select 结构与选项可用性。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PORT = 9366;
const BASE = 'http://127.0.0.1:5178';
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-sel-'));
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
  await send('Page.navigate', { url: `${BASE}/#/model/providers/new` });
  await sleep(2400);

  const out = await evalJs(`(async () => {
    const s = (ms) => new Promise(r => setTimeout(r, ms));
    const res = {};
    const selects = [...document.querySelectorAll('.t-select-input')];
    res.selectCount = selects.length;
    res.selectInputs = [...document.querySelectorAll('.t-select-input input')].map((i) => ({ ph: i.placeholder, disabled: i.disabled }));
    res.readyState = document.body.innerText.includes('凭证引用');
    // 依次点击每个 Select，记录下拉是否出现与选项数量
    res.probes = [];
    for (let idx = 0; idx < selects.length; idx++) {
      selects[idx].querySelector('input')?.click();
      selects[idx].click();
      await s(400);
      const dd = document.querySelector('.t-select__dropdown, .t-popup__content .t-select__dropdown');
      const opts = document.querySelectorAll('.t-select-option');
      res.probes.push({ idx, dropdown: !!dd, optionCount: opts.length, first: opts[0] ? opts[0].innerText.slice(0, 30) : null });
      document.body.click();
      await s(200);
    }
    return res;
  })()`, true);
  console.log(JSON.stringify(out, null, 1));
  await send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error('探针失败：', e.message); chrome.kill(); process.exit(2); });
