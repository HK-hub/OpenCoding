// 会话闭环验证（R03）：发送 → 流式 → 中断/恢复 → 审批响应 → 分叉 → 会话切换隔离。
// 全程通过真实 UI 交互驱动（不直接写 store），断言 DOM 与业务结果。
// 用法：node scripts/smoke-session.mjs [--base http://127.0.0.1:5178] [--report .recon/session-report.json]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'http://127.0.0.1:5178');
const REPORT = argOf('--report', '.recon/session-report.json');
const PORT = Number(argOf('--port', '9355'));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-session-'));
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
  // 会话流文本读取：工作台为全出血布局，正文在 .oc-wb__stream
  const TXT = `(document.querySelector('.oc-wb__stream')?.innerText ?? '')`;

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);
  await evalJs(`localStorage.setItem('oc.onboarded','1')`);
  await cdp.send('Page.navigate', { url: `${BASE}/#/session` });
  await sleep(2200);

  const MSG = 'R03 验证：请描述当前模块地图';
  const beforeLen = await evalJs(`${TXT}.length`);

  // 1) 发送：真实键入（CDP Input.insertText）+ 真实鼠标点击发送键，断言消息回流 + 内容增长
  const composer = await evalJs(`(() => {
    const sender = document.querySelector('.t-chat-sender');
    if (!sender) return { err: 'no-sender' };
    const ta = sender.querySelector('textarea');
    if (!ta) return { err: 'no-textarea' };
    ta.focus();
    // 发送键：Composer 在 suffix 插槽内提供了自带发送按钮（文本「发送」）
    const btn = [...sender.querySelectorAll('button')].find((b) => /发送/.test(b.innerText))
      || sender.querySelector('.t-chat-sender__button__default');
    if (!btn) return { err: 'no-send-button' };
    const r = btn.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), disabled: btn.disabled === true };
  })()`);
  let sendOk = composer.err ?? 'ready';
  if (!composer.err) {
    await cdp.send('Input.insertText', { text: MSG });
    await sleep(200);
    // 真实按下-抬起：先触发失焦（ChatSender 在 change 时同步值），再点击发送
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: composer.x, y: composer.y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: composer.x, y: composer.y, button: 'left', clickCount: 1 });
    sendOk = 'sent';
  }

  // 2) 流式：发送后立即采样内容长度，统计不同长度（增量渲染证据）
  const stream = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const len = () => ${TXT}.length;
    const seen = new Set(); let last = -1;
    for (let i = 0; i < 40; i++) { await s(60); const cur = len(); if (cur !== last) seen.add(cur); last = cur; if (seen.size > 10) break; }
    return seen.size;
  })()`, true);
  await sleep(1200);
  const afterLen = await evalJs(`${TXT}.length`);
  const echoed = await evalJs(`${TXT}.includes(${JSON.stringify(MSG)})`);
  record('发送消息（Composer UI 驱动）→ 消息回流且内容增长', sendOk === 'sent' && echoed && afterLen > beforeLen, `echoed=${echoed} len ${beforeLen}→${afterLen} (${sendOk})`);
  record('流式输出为增量渲染（多次内容长度变化）', stream >= 3, `观察到 ${stream} 个不同内容长度`);

  // 3) 中断（安全点）→ 出现可回滚/继续横幅；点「继续执行」→ 横幅消失（恢复）
  const stopState = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const main = document.querySelector('.oc-wb__main');
    const btns = [...main.querySelectorAll('button')];
    const stop = btns.find(b => /中断/.test(b.innerText));
    if (!stop) return { found: false };
    stop.click(); await s(500);
    const banner = document.querySelector('.oc-banner--info');
    const text = banner?.innerText ?? '';
    const resume = banner ? [...banner.querySelectorAll('button')].find(b => /继续执行/.test(b.innerText)) : null;
    if (resume) { resume.click(); await s(400); }
    return {
      found: true,
      hasResume: /继续执行/.test(text),
      hasRollback: /回滚|安全点/.test(text),
      resumed: !document.querySelector('.oc-banner--info'),
    };
  })()`, true);
  record('中断 → 出现安全点横幅（含可回滚/继续语义）', stopState.found && stopState.hasResume && stopState.hasRollback, JSON.stringify(stopState));
  record('点「继续执行」→ 中断横幅关闭（恢复）', stopState.resumed === true, `resumed=${stopState.resumed}`);

  // 4) 审批卡：真实点「批准（A）」，断言决策标签出现且操作按钮消失（状态变化）
  const approval = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const cards = [...document.querySelectorAll('.oc-approval')];
    const card = cards.find(c => [...c.querySelectorAll('button')].some(b => /批准（A）/.test(b.innerText)));
    if (!card) return { found: false, cards: cards.length };
    const btn = [...card.querySelectorAll('button')].find(b => /批准（A）/.test(b.innerText));
    btn.click(); await s(600);
    const text = card.innerText;
    return {
      found: true,
      decided: /已批准/.test(text),
      buttonsGone: ![...card.querySelectorAll('button')].some(b => /批准（A）/.test(b.innerText)),
      toast: document.querySelectorAll('.t-message').length,
    };
  })()`, true);
  record('审批卡可响应：批准后出现决策标签且按钮收起', approval.found && approval.decided && approval.buttonsGone, JSON.stringify(approval));

  // 5) 分叉：点助手消息「从此分叉」，断言会话列表出现（分支）新会话
  const fork = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const listEl = document.querySelector('.oc-wb__list');
    const before = listEl.querySelectorAll('.oc-sess').length;
    const btn = [...document.querySelectorAll('.oc-wb__stream button')].find(b => /从此分叉/.test(b.innerText));
    if (!btn) return { found: false };
    btn.click(); await s(600);
    const after = listEl.querySelectorAll('.oc-sess').length;
    return { found: true, before, after, hasForkTag: /分支/.test(listEl.innerText) };
  })()`, true);
  record('分叉入口点击 → 会话列表新增分支会话', fork.found && fork.after === fork.before + 1 && fork.hasForkTag, JSON.stringify(fork));

  // 6) 会话切换隔离：切到另一会话，流内容随会话变化
  const isolate = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const before = ${TXT};
    const items = [...document.querySelectorAll('.oc-wb__list .oc-sess')];
    const other = items.find(b => !b.className.includes('oc-sess--active'));
    if (!other) return { found: false };
    other.click(); await s(800);
    const after = ${TXT};
    return { found: true, changed: after !== before, beforeLen: before.length, afterLen: after.length, title: document.querySelector('.oc-wb__head b')?.innerText };
  })()`, true);
  record('切换会话 → 会话流内容随会话切换（隔离）', isolate.found && isolate.changed, JSON.stringify(isolate));

  // 7) 无控制台错误
  record('会话操作期间无控制台错误/未处理异常', errors.length === 0, errors.slice(0, 2).join(' | ').slice(0, 240));

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(REPORT, JSON.stringify({ when: new Date().toISOString(), base: BASE, total: results.length, failed: failed.length, results, consoleErrors: errors }, null, 2));
  console.log(`\n会话闭环用例 ${results.length} 项，失败 ${failed.length} 项`);
  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('会话验证失败：', e.message); chrome.kill(); process.exit(2); });
