// R04 批量操作与「取消不留痕」验证：
// A) 技能分发：勾选变化 → 批量分发弹窗 → 未填说明时确认禁用 → 取消不留痕 → 填说明后发布成功
// B) Provider 删除：Popconfirm 取消 → 无任何删除痕迹（数据与提示都不变）
// 用法：node scripts/smoke-batch.mjs [--base http://127.0.0.1:5178]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'http://127.0.0.1:5178');
const REPORT = argOf('--report', '.recon/batch-report.json');
const PORT = Number(argOf('--port', '9369'));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-batch-'));
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
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); if (r.ok) break; } catch {} await sleep(250); }
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
  const cdp = new Cdp(ws);
  const errors = [];
  cdp.on((m) => {
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 200));
    if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const evalJs = async (expr, awaitPromise = false) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };
  const goto = async (hash) => { await cdp.send('Page.navigate', { url: `${BASE}/#${hash}` }); await sleep(2300); };

  const HELPER = `
    window.__oc = {
      visible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; },
      btn(text) { return [...document.querySelectorAll('button')].filter((b) => this.visible(b)).find((b) => b.innerText.trim() === text || b.innerText.trim().startsWith(text)); },
      click(text) { const b = this.btn(text); if (!b) return false; b.click(); return true; },
      dialog() { return [...document.querySelectorAll('.t-dialog, .t-dialog__ctx')].find((d) => this.visible(d)); },
      confirmBtn() { const d = this.dialog(); if (!d) return null; return [...d.querySelectorAll('button')].find((b) => /签名并发布|确定|确认/.test(b.innerText)); },
      cancelBtn() { const d = this.dialog(); if (!d) return null; return [...d.querySelectorAll('button')].find((b) => /取消|cancel/i.test(b.innerText)); },
    };
  `;

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);
  await evalJs(`localStorage.setItem('oc.onboarded','1')`);

  // A) 技能分发批量操作
  await goto('/extension/skills/distribution');
  await evalJs(HELPER);
  const s1 = await evalJs(`(() => { const m = document.body.innerText.match(/已勾选 (\\d+) 项/); return m ? Number(m[1]) : -1; })()`);
  record('批量：初始勾选数读取（默认 2）', s1 === 2, `selected=${s1}`);

  const selAll = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const head = document.querySelector('thead .t-checkbox, thead input[type=checkbox]');
    if (!head) return { err: 'no-head-checkbox' };
    head.click(); await s(400);
    const m = document.body.innerText.match(/已勾选 (\\d+) 项/);
    const card = [...document.querySelectorAll('.oc-card')].find((c) => c.innerText.includes('待发布'));
    const rows = card ? card.querySelectorAll('tbody tr').length : -1;
    return { selected: m ? Number(m[1]) : -1, rows };
  })()`, true);
  record('批量：表头全选 → 勾选数与行数一致', selAll.selected === selAll.rows && selAll.rows > 2, JSON.stringify(selAll));

  const openDlg = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const ok = window.__oc.click('发布技能'); await s(500);
    const d = window.__oc.dialog();
    const btn = window.__oc.confirmBtn();
    return { ok, dialog: !!d, confirmDisabled: btn ? (btn.disabled || btn.classList.contains('t-is-disabled')) : null,
      countText: d ? (d.innerText.match(/发布数量\\s*([^\\n]+)/) || [])[1] || '' : '' };
  })()`, true);
  record('批量：打开发布弹窗 → 未填说明时确认禁用（前置校验）', openDlg.ok && openDlg.dialog && openDlg.confirmDisabled === true, JSON.stringify(openDlg));

  const cancelCase = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const ok = (() => { const b = window.__oc.cancelBtn(); if (!b) return false; b.click(); return true; })();
    await s(600);
    const dlgGone = !window.__oc.dialog();
    const noSuccess = !document.body.innerText.includes('已提交');
    return { ok, dlgGone, noSuccess };
  })()`, true);
  record('批量：取消弹窗 → 无发布痕迹（取消不留痕）', cancelCase.ok && cancelCase.dlgGone && cancelCase.noSuccess, JSON.stringify(cancelCase));

  const publish = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    window.__oc.click('发布技能'); await s(500);
    const d = window.__oc.dialog();
    const ta = d ? [...d.querySelectorAll('textarea')].find((t) => window.__oc.visible(t)) : null;
    if (ta) {
      const set = (v) => {
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(ta, v);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
      };
      set('短'); await s(300);
      const b1 = window.__oc.confirmBtn();
      const disabledOnShort = b1 ? (b1.disabled || b1.classList.contains('t-is-disabled')) : null;
      set('v2.4.1 收紧指令分段；评测通过率 92%（门槛 88%）'); await s(400);
      const b2 = window.__oc.confirmBtn();
      const disabledOnLong = b2 ? (b2.disabled || b2.classList.contains('t-is-disabled')) : null;
      if (b2) b2.click();
      await s(800);
      const body = document.body.innerText;
      const m = body.match(/已提交 (\\d+) 个技能/);
      return { disabledOnShort, disabledOnLong, submitted: m ? Number(m[1]) : -1, dialogGone: !window.__oc.dialog(), hasAudit: body.includes('等待审核') };
    }
    return { err: 'no-note-textarea' };
  })()`, true);
  record('批量：说明≥5 字后可提交 → 成功回执含数量与审核状态',
    publish.disabledOnShort === true && publish.disabledOnLong === false && publish.submitted === selAll.selected && publish.dialogGone && publish.hasAudit,
    JSON.stringify(publish));

  // B) Provider 删除 Popconfirm：取消不留痕
  await goto('/model/providers');
  await evalJs(HELPER);
  const del = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const before = document.body.innerText;
    const rows0 = document.querySelectorAll('tbody tr').length;
    const ok = window.__oc.click('删除'); await s(500);
    const popups = [...document.querySelectorAll('.t-popup')].filter((p) => window.__oc.visible(p));
    let cancelClicked = false;
    for (const p of popups) {
      const b = [...p.querySelectorAll('button')].find((x) => /取消/.test(x.innerText));
      if (b) { b.click(); cancelClicked = true; break; }
    }
    await s(600);
    const after = document.body.innerText;
    const rows1 = document.querySelectorAll('tbody tr').length;
    return { opened: ok, cancelClicked, rows0, rows1, noDeletedMsg: !after.includes('已删除'), sameText: before === after };
  })()`, true);
  record('删除 Popconfirm 取消 → 行数与提示均不变（取消不留痕）',
    del.opened && del.cancelClicked && del.rows0 === del.rows1 && del.noDeletedMsg, JSON.stringify(del));

  record('批量/取消期间无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | ').slice(0, 240));

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(REPORT, JSON.stringify({ when: new Date().toISOString(), base: BASE, total: results.length, failed: failed.length, results, consoleErrors: errors }, null, 2));
  console.log(`\n批量/取消用例 ${results.length} 项，失败 ${failed.length} 项`);
  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('批量/取消验证失败：', e.message); chrome.kill(); process.exit(2); });
