// 浏览器冒烟（CDP 直驱，零新增依赖）：启动 headless Chrome，逐路由进入并断言渲染与控制台健康。
// 用法：node scripts/smoke-cdp.mjs [--base http://127.0.0.1:5178] [--only /task] [--width 1440] [--height 900]
//                             [--theme dark] [--report .recon/smoke-report.json] [--keep-open]
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
const ONLY = argOf('--only', '');
const WIDTH = Number(argOf('--width', '1440'));
const HEIGHT = Number(argOf('--height', '900'));
const THEME = argOf('--theme', 'light');
const REPORT = argOf('--report', '.recon/smoke-report.json');
const PORT = Number(argOf('--port', '9333'));

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chromePath) {
  console.error('未找到 Chrome/Edge 可执行文件');
  process.exit(2);
}

const routesFile = path.join(process.cwd(), '.recon/routes.json');
let allRoutes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
if (ONLY) allRoutes = allRoutes.filter((r) => r.startsWith(ONLY));
const staticRoutes = allRoutes.filter((r) => !r.includes(':'));
const dynamicRoutes = allRoutes.filter((r) => r.includes(':'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-smoke-'));

const chrome = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${userDataDir}`,
  `--window-size=${WIDTH},${HEIGHT}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-gpu',
  '--hide-scrollbars',
  'about:blank',
], { stdio: 'ignore' });

async function waitForDevtools() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch { /* 未就绪 */ }
    await sleep(250);
  }
  throw new Error('DevTools 端口未就绪');
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      } else if (msg.method) {
        for (const h of this.handlers) h(msg);
      }
    });
  }
  on(fn) { this.handlers.push(fn); }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`timeout ${method}`)); }
      }, 30000);
    });
  }
}

const PAGE_FN = `async (path, dyn) => {
  const S = (window.__smoke = window.__smoke || { errors: [], route: 'init' });
  if (!S.installed) {
    S.installed = true;
    const push = (kind, msg) => S.errors.push({ route: S.route, kind, msg: String(msg).slice(0, 300) });
    window.addEventListener('error', (e) => push('window.error', e.message + ' @' + (e.filename || '') + ':' + (e.lineno || 0)));
    window.addEventListener('unhandledrejection', (e) => push('unhandledrejection', (e.reason && (e.reason.stack || e.reason.message)) || String(e.reason)));
    const ce = console.error.bind(console);
    console.error = (...a) => { push('console.error', a.map((x) => (x && x.stack) || String(x)).join(' ')); ce(...a); };
    const cw = console.warn.bind(console);
    console.warn = (...a) => { push('console.warn', a.map((x) => (x && x.stack) || String(x)).join(' ')); cw(...a); };
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const text = () => (document.querySelector('.t-layout__content') || document.body).innerText || '';
  const idPattern = /\\b(?:[A-Z]{2,6}-\\d{2,}|[A-Z]{2,6}-[a-z0-9]{4,}|[a-z]{2,5}-[0-9a-f]{4,}|[a-z]{2,5}-\\d{2,}|S-[0-9a-z]{3,}|[A-Z]{1,4}[0-9]{2,}[A-Za-z0-9-]*)\\b/;
  const waitSettle = async (limit) => {
    let prev = -1, stable = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < limit) {
      await sleep(110);
      const cur = text().length;
      if (cur > 60 && cur === prev) { stable++; if (stable >= 3) break; } else stable = 0;
      prev = cur;
    }
  };
  let resolved = path;
  if (dyn) {
    const parent = path.replace(/\\/[^/]*:id[^/]*$/, '');
    location.hash = '#' + parent;
    await waitSettle(3500);
    const m = text().match(idPattern) || (document.body.innerHTML.match(idPattern));
    if (m) resolved = path.replace(':id', m[0]);
  }
  S.route = resolved;
  const before = S.errors.length;
  location.hash = '#' + resolved;
  await waitSettle(4500);
  await sleep(150);
  const body = text();
  const h = document.querySelector('.oc-page__title') || document.querySelector('h1');
  const shell = document.querySelector('[data-state]');
  // 路由内容区文本长度：用于捕获「页面打开了但主内容区什么都没渲染」这一类缺陷
  const contentEl = document.querySelector('.oc-shell__content');
  const cLen = (contentEl ? contentEl.innerText : '').length;
  return {
    req: path, resolved, at: location.hash, len: body.length, cLen,
    title: h ? h.textContent.trim().slice(0, 40) : '',
    shell: shell ? shell.getAttribute('data-state') : '',
    tickers: document.querySelectorAll('.t-loading').length,
    errs: S.errors.slice(before),
    totalErrors: S.errors.length,
  };
}`;

(async () => {
  await waitForDevtools();
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  let target = list.find((t) => t.type === 'page');
  if (!target) {
    const created = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
    target = await created.json();
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = new Cdp(ws);

  const netExternal = [];
  const netFailed = [];
  cdp.on((m) => {
    if (m.method === 'Network.requestWillBeSent') {
      const u = m.params.request.url;
      if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(u) && !u.startsWith('data:') && !u.startsWith('blob:')) netExternal.push(u);
    }
    if (m.method === 'Network.loadingFailed' && !m.params.canceled) netFailed.push(m.params.errorText + ' ' + (m.params.type || ''));
  });

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Network.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);

  // 环境准备：跳过首次引导（引导流程本身在 R12 由真实交互验证）
  await cdp.send('Runtime.evaluate', {
    expression: `localStorage.setItem('oc.onboarded','1'); localStorage.setItem('oc.theme','${THEME}'); document.documentElement.setAttribute('theme-mode','${THEME}');`,
  });
  const seed = await cdp.send('Runtime.evaluate', {
    expression: `(async () => { const f = ${PAGE_FN}; return JSON.stringify(await f('/session', false)); })()`,
    awaitPromise: true, returnByValue: true,
  });
  const results = [JSON.parse(seed.result.value)];

  for (const route of staticRoutes) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(async () => { const f = ${PAGE_FN}; return JSON.stringify(await f(${JSON.stringify(route)}, false)); })()`,
      awaitPromise: true, returnByValue: true,
    });
    results.push(JSON.parse(r.result.value));
    process.stdout.write(`  ${route}\n`);
  }
  for (const route of dynamicRoutes) {
    const r = await cdp.send('Runtime.evaluate', {
      expression: `(async () => { const f = ${PAGE_FN}; return JSON.stringify(await f(${JSON.stringify(route)}, true)); })()`,
      awaitPromise: true, returnByValue: true,
    });
    results.push(JSON.parse(r.result.value));
    process.stdout.write(`  ${route} -> ${results.at(-1).resolved}\n`);
  }

  const failures = results.filter((r) => r.len < 60 || r.cLen < 40 || r.errs.length > 0 || r.at !== '#' + r.resolved);
  const report = {
    when: new Date().toISOString(),
    base: BASE, width: WIDTH, height: HEIGHT, theme: THEME,
    routeCount: results.length,
    failureCount: failures.length,
    externalRequests: [...new Set(netExternal)],
    failedResources: [...new Set(netFailed)],
    failures,
    routes: results.map((r) => ({ req: r.req, resolved: r.resolved, len: r.len, title: r.title, shell: r.shell, at: r.at, errCount: r.errs.length })),
  };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2));
  console.log(`\n路由 ${results.length} 条，失败 ${failures.length} 条`);
  console.log(`站外请求 ${report.externalRequests.length} 项；资源加载失败 ${report.failedResources.length} 项`);
  if (failures.length) {
    console.log('\n失败明细：');
    for (const f of failures.slice(0, 25)) {
      console.log(`  ${f.req} -> ${f.at} len=${f.len} errs=${f.errs.length}${f.errs[0] ? ' | ' + f.errs[0].kind + ': ' + f.errs[0].msg.slice(0, 140) : ''}`);
    }
  }

  if (!args.includes('--keep-open')) {
    await cdp.send('Browser.close').catch(() => {});
    chrome.kill();
  }
  process.exit(failures.length ? 1 : 0);
})().catch((e) => {
  console.error('冒烟执行失败：', e.message);
  chrome.kill();
  process.exit(2);
});
