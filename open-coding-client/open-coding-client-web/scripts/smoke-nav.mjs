// 导航架构验证（R02）：深链接 / 刷新 / 前进后退 / 详情页合法入口。
// 用法：node scripts/smoke-nav.mjs [--base http://127.0.0.1:5178] [--report .recon/nav-report.json]
// 退出码：0=全部通过；1=存在失败项。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const BASE = argOf('--base', 'http://127.0.0.1:5178');
const REPORT = argOf('--report', '.recon/nav-report.json');
const PORT = Number(argOf('--port', '9344'));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-nav-'));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
  '--window-size=1440,900', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu',
  'about:blank',
], { stdio: 'ignore' });

class Cdp {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      } else if (m.method) for (const h of this.handlers) h(m);
    });
  }
  on(fn) { this.handlers.push(fn); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { resolve: res, reject: rej });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(`timeout ${method}`)); } }, 30000);
    });
  }
}

const SETTLE = `async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = () => (document.querySelector('.t-layout__content') || document.body).innerText || '';
  let prev = -1, stable = 0; const t0 = Date.now();
  while (Date.now() - t0 < 4000) {
    await sleep(110);
    const cur = text().length;
    if (cur > 60 && cur === prev) { stable++; if (stable >= 3) break; } else stable = 0;
    prev = cur;
  }
  return { hash: location.hash, len: text().length, title: document.title };
}`;

(async () => {
  let url;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {}
    await sleep(250);
  }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = new Cdp(ws);
  const consoleErrors = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 200));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
    }
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);
  await cdp.send('Runtime.evaluate', { expression: `localStorage.setItem('oc.onboarded','1')` });

  const results = [];
  const evalFn = async (fn) => JSON.parse((await cdp.send('Runtime.evaluate', { expression: `(async () => { const f = ${fn}; return JSON.stringify(await f()); })()`, awaitPromise: true, returnByValue: true })).result.value);

  // 1) 深链接：直接打开详情 URL（合法参数），断言内容渲染
  const deepLinks = [
    '/task/detail?workItem=T-01',
    '/model/providers/pr-1',
    '/session',
    '/automation/templates',
    '/settings/diagnostics',
  ];
  for (const dl of deepLinks) {
    const before = consoleErrors.length;
    await cdp.send('Page.navigate', { url: `${BASE}/#${dl}` });
    await sleep(2000);
    const st = await evalFn(SETTLE);
    results.push({ kind: 'deeplink', target: dl, landed: st.hash, len: st.len, title: st.title, ok: st.hash === `#${dl}` && st.len > 60, newErrors: consoleErrors.slice(before) });
  }

  // 2) 前进/后退：A → B，back 应回到 A，forward 应回到 B
  await cdp.send('Page.navigate', { url: `${BASE}/#/task/board` });
  await sleep(1600);
  await cdp.send('Page.navigate', { url: `${BASE}/#/team/overview` });
  await sleep(1600);
  const beforeBack = consoleErrors.length;
  await cdp.send('Runtime.evaluate', { expression: `history.back()` });
  await sleep(1500);
  const afterBack = await evalFn(SETTLE);
  await cdp.send('Runtime.evaluate', { expression: `history.forward()` });
  await sleep(1500);
  const afterForward = await evalFn(SETTLE);
  results.push({ kind: 'back', target: '#/task/board', landed: afterBack.hash, len: afterBack.len, ok: afterBack.hash === '#/task/board' && afterBack.len > 60, newErrors: consoleErrors.slice(beforeBack) });
  results.push({ kind: 'forward', target: '#/team/overview', landed: afterForward.hash, len: afterForward.len, ok: afterForward.hash === '#/team/overview' && afterForward.len > 60, newErrors: consoleErrors.slice(beforeBack) });

  // 3) 刷新：同一 URL reload 后仍在同一路由且内容渲染
  const beforeReload = consoleErrors.length;
  await cdp.send('Page.reload');
  await sleep(2200);
  const afterReload = await evalFn(SETTLE);
  results.push({ kind: 'reload', target: '#/team/overview', landed: afterReload.hash, len: afterReload.len, ok: afterReload.hash === '#/team/overview' && afterReload.len > 60, newErrors: consoleErrors.slice(beforeReload) });

  // 3.5) 非法参数：详情页应给出空态/兜底而非崩溃，且无控制台错误
  const illegal = ['/task/detail?workItem=NOPE-9999', '/model/providers/does-not-exist', '/model/catalog/nope-9z', '/prompt/assets/nope-9z'];
  for (const bad of illegal) {
    const beforeBad = consoleErrors.length;
    await cdp.send('Page.navigate', { url: `${BASE}/#${bad}` });
    await sleep(1800);
    const st = await evalFn(SETTLE);
    const body = await cdp.send('Runtime.evaluate', { expression: `document.body.innerText.length`, returnByValue: true });
    results.push({ kind: 'illegal-param', target: bad, landed: st.hash, len: body.result.value, ok: st.hash === `#${bad}` && body.result.value > 60 && consoleErrors.length === beforeBad, newErrors: consoleErrors.slice(beforeBad) });
  }

  // 4) 未知路由：应落到 404 而不是空白
  const before404 = consoleErrors.length;
  await cdp.send('Page.navigate', { url: `${BASE}/#/definitely-not-a-route` });
  await sleep(1800);
  const st404 = await evalFn(SETTLE);
  results.push({ kind: 'notfound', target: '/definitely-not-a-route', landed: st404.hash, len: st404.len, ok: st404.len > 60, newErrors: consoleErrors.slice(before404) });

  const failed = results.filter((r) => !r.ok || r.newErrors.length);
  const report = { when: new Date().toISOString(), base: BASE, total: results.length, failed: failed.length, results };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`导航用例 ${results.length} 项，失败 ${failed.length} 项`);
  for (const r of failed) console.log(`  ✗ ${r.kind} ${r.target} → landed=${r.landed} len=${r.len} errs=${r.newErrors.length}${r.newErrors[0] ? ' | ' + r.newErrors[0].slice(0, 120) : ''}`);
  for (const r of results.filter((x) => x.ok && !x.newErrors.length)) console.log(`  ✓ ${r.kind} ${r.target} → ${r.landed}`);

  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('导航验证失败：', e.message); chrome.kill(); process.exit(2); });
