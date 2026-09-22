// R04 会话条目操作验证：好评/点踩、分页回读、查看 diff、编辑计划、恢复检查点、展开轨迹。
// 全程真实点击 + DOM/文本断言。用法：node scripts/smoke-session-actions.mjs [--base http://127.0.0.1:5178]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'http://127.0.0.1:5178');
const REPORT = argOf('--report', '.recon/session-actions-report.json');
const PORT = Number(argOf('--port', '9368'));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-sa-'));
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

  // 页面内通用工具：按文本找可见按钮并点击
  const CLICK_HELPER = `
    window.__oc = {
      visible(el) { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; },
      btn(text) { return [...document.querySelectorAll('button')].filter((b) => this.visible(b)).find((b) => b.innerText.trim() === text || b.innerText.trim().startsWith(text)); },
      click(text) { const b = this.btn(text); if (!b) return false; b.click(); return true; },
    };
  `;

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);
  await evalJs(`localStorage.setItem('oc.onboarded','1')`);
  await cdp.send('Page.navigate', { url: `${BASE}/#/session` });
  await sleep(2600);
  await evalJs(CLICK_HELPER);

  // 等条目流渲染
  const items = await evalJs(`(async () => { const s=(ms)=>new Promise(r=>setTimeout(r,ms)); for(let i=0;i<40;i++){ if(document.querySelectorAll('.oc-item').length>=6) break; await s(200);} return document.querySelectorAll('.oc-item').length; })()`, true);
  record('会话流渲染条目 ≥6', items >= 6, `items=${items}`);

  // 1) 好评：点击 → 出现「已好评」标签且按钮置灰
  const vote = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const ok = window.__oc.click('好评'); await s(400);
    const tag = [...document.querySelectorAll('.oc-item .t-tag')].find((t) => t.innerText.includes('已好评'));
    const item = tag ? tag.closest('.oc-item') : null;
    const btn = item ? [...item.querySelectorAll('button')].find((b) => b.innerText.trim() === '好评') : null;
    return { clicked: ok, hasTag: !!tag, disabled: btn ? btn.disabled || btn.classList.contains('t-is-disabled') : null };
  })()`, true);
  record('好评 → 出现「已好评」且按钮置灰', vote.clicked && vote.hasTag && vote.disabled === true, JSON.stringify(vote));

  // 2) 分页回读：先展开工具卡详情（按钮在详情区内）→ 打开 → 第 1/4 页 → 下一页 → 第 2/4 页 → 上一页
  const artifact = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    // 「分页回读」位于工具卡的展开详情中：先把所有工具卡的「展开」点开
    const expands = [...document.querySelectorAll('button')].filter((b) => window.__oc.visible(b) && b.innerText.trim() === '展开');
    for (const e of expands) { e.click(); await s(150); }
    await s(300);
    const opened = window.__oc.click('分页回读'); await s(500);
    const p1 = document.body.innerText.includes('第 1 / 4 页');
    window.__oc.click('下一页'); await s(400);
    const p2 = document.body.innerText.includes('第 2 / 4 页');
    window.__oc.click('上一页'); await s(400);
    const back = document.body.innerText.includes('第 1 / 4 页');
    return { expands: expands.length, opened, p1, p2, back };
  })()`, true);
  record('分页回读 → 翻页真实可用（1→2→1）', artifact.opened && artifact.p1 && artifact.p2 && artifact.back, JSON.stringify(artifact));

  // 3) 查看 diff（D）：打开 DiffView → 收起
  const diff = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const opened = window.__oc.click('查看 diff'); await s(500);
    const hasView = !!document.querySelector('.oc-diffview');
    const rows = document.querySelectorAll('.oc-diff__row, .oc-diffview .oc-card').length;
    window.__oc.click('收起 diff'); await s(400);
    const closed = !document.querySelector('.oc-diffview');
    return { opened, hasView, rows, closed };
  })()`, true);
  record('审批卡查看 diff → DiffView 渲染并可收起', diff.opened && diff.hasView && diff.rows > 0 && diff.closed, JSON.stringify(diff));

  // 4) 编辑计划：进入编辑 → 改文案（定位到计划卡内的 textarea，避免误取输入区）→ 保存 → 步骤更新
  const plan = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const opened = window.__oc.click('编辑计划'); await s(400);
    const card = [...document.querySelectorAll('.oc-card')].find((c) => c.innerText.includes('本轮计划'));
    const ta = card ? [...card.querySelectorAll('textarea')].find((t) => window.__oc.visible(t)) : null;
    let edited = false;
    if (ta) {
      const proto = window.HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(ta, '定位幂等键生成与校验位置\\n持久层唯一约束 + 冲突返回首次结果\\n新增：回滚演练（用户手工补充）');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      edited = true;
    }
    await s(300);
    window.__oc.click('保存计划'); await s(600);
    const card2 = [...document.querySelectorAll('.oc-card')].find((c) => c.innerText.includes('本轮计划'));
    const body = card2 ? card2.innerText : document.body.innerText;
    return { opened, hasCard: !!card, edited, hasNewStep: body.includes('回滚演练（用户手工补充）'), hasTag: body.includes('已重规划'), hasReason: body.includes('用户手工编辑计划') };
  })()`, true);
  record('编辑计划 → 保存后步骤更新并标记已重规划', plan.opened && plan.edited && plan.hasNewStep && plan.hasTag && plan.hasReason, JSON.stringify(plan));

  // 5) 恢复到此检查点：Popconfirm → 确认 → 已恢复 + 追加系统通知
  const cp = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const opened = window.__oc.click('恢复到此检查点'); await s(500);
    const popups = [...document.querySelectorAll('.t-popup')].filter((p) => window.__oc.visible(p));
    let confirmed = false;
    for (const p of popups) {
      const btn = [...p.querySelectorAll('button')].find((b) => /确定|确认/.test(b.innerText));
      if (btn) { btn.click(); confirmed = true; break; }
    }
    await s(700);
    const body = document.body.innerText;
    return { opened, confirmed, restored: body.includes('已恢复'), notice: body.includes('已恢复到检查点 ckp_7f31') };
  })()`, true);
  record('恢复检查点 → 确认后留痕（已恢复 + 系统通知）', cp.opened && cp.confirmed && cp.notice, JSON.stringify(cp));

  // 6) 展开完整轨迹：展开显示 5 段链路 → 收起
  const traj = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const opened = window.__oc.click('展开完整轨迹'); await s(400);
    const body = document.body.innerText;
    const hasFlow = body.includes('派发：向子 Agent') && body.includes('预算信封：') && body.includes('结果回传：');
    window.__oc.click('收起轨迹'); await s(300);
    const closed = !document.body.innerText.includes('派发：向子 Agent');
    return { opened, hasFlow, closed };
  })()`, true);
  record('展开完整轨迹 → 链路可见且可收起', traj.opened && traj.hasFlow && traj.closed, JSON.stringify(traj));

  // 7) 重复点击好评（二次点击应提示已提交，不产生第二条反馈）
  const again = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const tags0 = [...document.querySelectorAll('.t-tag')].filter((t) => t.innerText.includes('已好评')).length;
    const b = window.__oc.btn('好评');
    if (b) b.click();
    await s(400);
    const tags1 = [...document.querySelectorAll('.t-tag')].filter((t) => t.innerText.includes('已好评')).length;
    return { tags0, tags1 };
  })()`, true);
  record('重复好评 → 不产生重复标记（幂等）', again.tags0 === again.tags1 && again.tags0 >= 1, JSON.stringify(again));

  record('操作期间无控制台错误', errors.length === 0, errors.slice(0, 3).join(' | ').slice(0, 240));

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(REPORT, JSON.stringify({ when: new Date().toISOString(), base: BASE, total: results.length, failed: failed.length, results, consoleErrors: errors }, null, 2));
  console.log(`\n会话条目操作用例 ${results.length} 项，失败 ${failed.length} 项`);
  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('会话条目操作验证失败：', e.message); chrome.kill(); process.exit(2); });
