// D-018 修复后的按域抽测（数据驱动）：读 .recon/d018-spot-cases.json，逐条真实点击并断言。
// 支持断言类型：
//   messageIncludes: 出现包含该文案的 .t-message / 通知
//   confirm: 先点弹层内「确定/确认/提交/继续」再继续断言
//   downloadExt: 期望下载目录出现该后缀的新文件（真实文件系统断言）
//   textChange: { in: '选择器或 null(body)', includes: '...' } 操作后页面/区域内出现该文本
//   textGone:   操作后不再出现该文本（用于「收起」「终止」类）
//   dialogOpened: 期望出现可见 .t-dialog / .t-popup
//   consoleClean: 该条范围内无新增控制台错误（全局累计，最后统一断言）
// 用法：node scripts/smoke-d018-spot.mjs [--cases .recon/d018-spot-cases.json] [--report .recon/d018-spot-report.json]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'http://127.0.0.1:5178');
const CASES = argOf('--cases', '.recon/d018-spot-cases.json');
const REPORT = argOf('--report', '.recon/d018-spot-report.json');
const PORT = Number(argOf('--port', '9371'));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-spot-'));
const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-dl-spot-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`,
  '--window-size=1440,1000', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-gpu', 'about:blank',
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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error(`timeout ${method}`)); } }, 40000);
    });
  }
}

const results = [];
const record = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const cases = JSON.parse(fs.readFileSync(CASES, 'utf8'));
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = new Cdp(ws);
  const errors = [];
  let errMark = 0;
  cdp.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 200));
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

  const evalJs = async (expr, awaitPromise = false) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);
  await evalJs(`localStorage.setItem('oc.onboarded','1')`);

  for (const c of cases) {
    const errorsBefore = errors.length;
    await cdp.send('Page.navigate', { url: `${BASE}/#${c.route}` });
    await sleep(c.settle ?? 2400);
    const dlBefore = fs.readdirSync(downloadDir).filter((f) => !f.endsWith('.crdownload')).length;
    // Chromium 对同源多次自动下载有节流策略：每个下载用例前重申下载行为
    if (c.downloadExt) await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

    const act = await evalJs(`(async () => {
      const s=(ms)=>new Promise(r=>setTimeout(r,ms));
      const visible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const btnByText = (t) => [...document.querySelectorAll('button')].filter(visible).find((b) => b.innerText.trim() === t || b.innerText.trim().startsWith(t));
      ${c.preClick ? `for (const pre of ${JSON.stringify(c.preClick)}) { const pb = btnByText(pre); if (pb) pb.click(); await s(${c.preClickWait ?? 900}); }` : ''}
      const btn = btnByText(${JSON.stringify(c.button)});
      if (!btn) return { clicked: false, reason: 'button-not-found' };
      ${c.expandAll ? `for (const e of [...document.querySelectorAll('button')].filter((b) => visible(b) && /^(展开|查看明细|展开全部)$/.test(b.innerText.trim()))) { e.click(); await s(120); } await s(200);` : ''}
      btn.click();
      await s(${c.confirm ? 700 : 1100});
      let confirmed = null;
      if (${!!c.confirm}) {
        const popups = [...document.querySelectorAll('.t-popup, .t-dialog')].filter(visible);
        for (const p of popups) {
          const cb = [...p.querySelectorAll('button')].find((x) => /确定|确认|继续|提交|签名并发布/.test(x.innerText));
          if (cb) { cb.click(); confirmed = true; break; }
        }
        await s(800);
      }
      const msgs = [...document.querySelectorAll('.t-message, .t-notification, .oc-statusbar')].map((m) => m.innerText).join(' | ');
      const body = document.body.innerText;
      const dlg = [...document.querySelectorAll('.t-dialog, .t-popup')].filter(visible).length;
      return { clicked: true, confirmed, msgs, body: body.slice(0, 4000), dlg, dlgContent: [...document.querySelectorAll('.t-dialog')].filter(visible).map((d) => d.innerText.slice(0, 200)).join(' || ') };
    })()`, true);

    // 断言
    let ok = act.clicked === true;
    const detail = { clicked: act.clicked, reason: act.reason };
    if (c.confirm) { ok = ok && act.confirmed === true; detail.confirmed = act.confirmed; }
    if (c.messageIncludes) { const hit = (act.msgs || '').includes(c.messageIncludes); ok = ok && hit; detail.message = { want: c.messageIncludes, hit }; }
    if (c.textChange) {
      let hit = false;
      for (let i = 0; i < 10; i++) {
        const hay = c.textChange.in ? await evalJs(`(() => { const el = document.querySelector(${JSON.stringify(c.textChange.in)}); return el ? el.innerText : ''; })()`) : await evalJs(`document.body.innerText`);
        if ((hay || '').includes(c.textChange.includes)) { hit = true; break; }
        await sleep(400);
      }
      ok = ok && hit; detail.textChange = { want: c.textChange.includes, hit };
    }
    if (c.textGone) { const hit = !(act.body || '').includes(c.textGone); ok = ok && hit; detail.textGone = { want: c.textGone, gone: hit }; }
    if (c.dialogOpened) { const hit = act.dlg > 0; ok = ok && hit; detail.dialog = { opened: act.dlg, content: (act.dlgContent || '').slice(0, 120) }; }
    if (c.downloadExt) {
      let named = [], nw = [];
      for (let i = 0; i < 15; i++) {
        await sleep(400);
        const files = fs.readdirSync(downloadDir).filter((f) => !f.endsWith('.crdownload'));
        nw = files.slice(dlBefore);
        named = c.downloadName ? nw.filter((f) => new RegExp(c.downloadName).test(f)) : nw;
        if (named.some((f) => f.endsWith(c.downloadExt))) break;
      }
      const hit = named.some((f) => f.endsWith(c.downloadExt)) && named.length > 0;
      ok = ok && hit; detail.download = { newFiles: nw, matched: named, want: c.downloadExt + (c.downloadName ? ' /name~' + c.downloadName : '') };
    }
    const newErrs = errors.slice(errorsBefore);
    if (newErrs.length) { ok = false; detail.consoleErrors = newErrs.slice(0, 2); }
    record(`${c.id} ${c.route} → ${c.button}`, ok, JSON.stringify(detail).slice(0, 300));
  }

  record('全部抽测期间无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | ').slice(0, 240));

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(REPORT, JSON.stringify({ when: new Date().toISOString(), base: BASE, cases: cases.length, total: results.length, failed: failed.length, results, consoleErrors: errors }, null, 2));
  console.log(`\nD-018 抽测 ${results.length - 1} 条用例，失败 ${failed.length} 项（报告 ${REPORT}）`);
  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('D-018 抽测失败：', e.message); chrome.kill(); process.exit(2); });
