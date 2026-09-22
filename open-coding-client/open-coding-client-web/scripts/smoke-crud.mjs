// 表单与操作验证（R04）：校验拦截 / 保存生效 / 真实下载 / 导入解析。
// 全程真实 UI 交互；断言 DOM 与文件系统结果。
// 用法：node scripts/smoke-crud.mjs [--base http://127.0.0.1:5178] [--report .recon/crud-report.json]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const BASE = argOf('--base', 'http://127.0.0.1:5178');
const REPORT = argOf('--report', '.recon/crud-report.json');
const PORT = Number(argOf('--port', '9357'));

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('未找到 Chrome/Edge'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-crud-'));
const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-dl-'));
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
  await cdp.send('DOM.enable');
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });

  const evalJs = async (expr, awaitPromise = false) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };
  const goto = async (hash) => { await cdp.send('Page.navigate', { url: `${BASE}/#${hash}` }); await sleep(2000); };
  const settle = () => evalJs(`(async () => { const s=(ms)=>new Promise(r=>setTimeout(r,ms)); let p=-1,st=0; const t=Date.now(); const txt=()=>document.body.innerText.length; while(Date.now()-t<3000){await s(100); const c=txt(); if(c>60&&c===p){st++; if(st>=3)break;} else st=0; p=c;} return document.body.innerText.length; })()`, true);

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(1200);
  await evalJs(`localStorage.setItem('oc.onboarded','1')`);

  // 1) 表单校验：Provider 编辑器空表单保存 → 出现错误反馈且未跳转
  await goto('/model/providers/new');
  await settle();
  const validate = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const url0 = location.hash;
    const btn = [...document.querySelectorAll('button')].find((b) => /保存/.test(b.innerText));
    if (!btn) return { err: 'no-save-button' };
    btn.click(); await s(700);
    const msg = [...document.querySelectorAll('.t-message, .t-message__content')].map((m) => m.innerText).join(' | ');
    return { url0, url: location.hash, msg, stillHere: location.hash === url0 };
  })()`, true);
  record('空表单保存 → 被校验拦截并给出错误反馈', validate.err === undefined && validate.stillHere && /必填|失败|错误/.test(validate.msg || ''), JSON.stringify(validate).slice(0, 200));

  // 2) 填必填项 → 保存 → 成功反馈 + 生成配置版本
  // 名称/端点 baseUrl 用 Input 按标签填值；「凭证引用」是引用式 Select（filterable），按 placeholder 真实展开并点选首项
  const fill = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const set = (el, v) => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const labelInput = (txt) => {
      const lab = [...document.querySelectorAll('label')].find((l) => l.innerText.includes(txt));
      return lab ? lab.querySelector('input:not([disabled])') : null;
    };
    const nameEl = labelInput('名称');
    const urlEl = labelInput('端点 baseUrl');
    if (nameEl) set(nameEl, 'R04 冒烟 Anthropic 直连');
    if (urlEl) set(urlEl, 'https://api.r04-smoke.example/v1');
    await s(250);

    const credInput = [...document.querySelectorAll('.t-select-input input')].find((i) => i.placeholder === '选择已有凭证引用');
    let opened = false, picked = null;
    if (credInput) {
      credInput.closest('.t-select-input').click();
      await s(500);
      const opts = [...document.querySelectorAll('.t-select-option')].filter(visible);
      opened = opts.length > 0;
      if (opts.length) { opts[0].click(); picked = opts[0].innerText.trim().slice(0, 40); await s(400); }
    }
    return {
      hasName: !!nameEl, hasUrl: !!urlEl, nameVal: nameEl ? nameEl.value : null,
      opened, picked, credShown: credInput ? (credInput.value || '').slice(0, 40) : null,
    };
  })()`, true);
  const save = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '保存');
    if (!btn) return { err: 'no-save-button' };
    btn.click(); await s(900);
    const msg = [...document.querySelectorAll('.t-message, .t-message__content')].map((m) => m.innerText).join(' | ');
    return { msg, versionLine: document.body.innerText.includes('最近一次保存已生成配置版本') };
  })()`, true);
  record('填必填项保存 → 成功反馈（配置版本）',
    fill.hasName && fill.hasUrl && fill.opened && !!fill.credShown && save.err === undefined && /已保存并生成配置版本/.test(save.msg || '') && save.versionLine,
    JSON.stringify({ fill, save }).slice(0, 260));

  // 3) 导出：生成导出包 → 真实下载出文件（大小 > 0，内容是 JSON）
  await goto('/automation/export');
  await settle();
  const beforeCount = fs.readdirSync(downloadDir).length;
  const exp = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const btn = [...document.querySelectorAll('button')].find((b) => /生成导出包/.test(b.innerText));
    if (!btn) return { err: 'no-export-button' };
    btn.click(); await s(1200);
    const msg = [...document.querySelectorAll('.t-message, .t-message__content')].map((m) => m.innerText).join(' | ');
    return { msg };
  })()`, true);
  await sleep(1200);
  const files = fs.readdirSync(downloadDir).filter((f) => !f.endsWith('.crdownload'));
  const dl = files.length > beforeCount ? files[files.length - 1] : null;
  let dlOk = false, dlDetail = 'no-file';
  if (dl) {
    const raw = fs.readFileSync(path.join(downloadDir, dl), 'utf8');
    let parsed = null; try { parsed = JSON.parse(raw); } catch { /* 非 JSON 即失败 */ }
    dlOk = parsed !== null && JSON.stringify(parsed).length > 20;
    dlDetail = `${dl} ${raw.length}B json=${parsed !== null}`;
  }
  record('导出 → 真实生成可下载文件（JSON 可解析）', dlOk && /已生成导出包/.test(exp.msg || ''), `${dlDetail}; msg=${(exp.msg || '').slice(0, 60)}`);

  // 4) 导入：上传合法 JSON → 解析通过；上传非法 JSON → 结构校验失败提示
  const tmpOk = path.join(os.tmpdir(), `oc-import-ok-${Date.now()}.json`);
  const tmpBad = path.join(os.tmpdir(), `oc-import-bad-${Date.now()}.json`);
  fs.writeFileSync(tmpOk, JSON.stringify({ sources: ['imp-01', 'imp-03'] }));
  fs.writeFileSync(tmpBad, '{"sources": "not-an-array"');
  await goto('/ecosystem/import');
  await settle();
  const upload = async (file) => {
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file]' });
    if (!nodeId) return { err: 'no-file-input' };
    await cdp.send('DOM.setFileInputFiles', { files: [file], nodeId });
    await sleep(900);
    const txt = await evalJs(`document.body.innerText`);
    return { txt };
  };
  const upOk = await upload(tmpOk);
  const okParsed = upOk.err === undefined && !/导入包解析失败/.test(upOk.txt);
  const upBad = await upload(tmpBad);
  const badRejected = upBad.err === undefined && /导入包解析失败|结构校验|未被接受/.test(upBad.txt);
  record('导入合法文件 → 通过解析未被拒绝', okParsed, okParsed ? 'ok' : JSON.stringify(upOk).slice(0, 160));
  record('导入非法文件 → 结构校验失败且有明确提示', badRejected, badRejected ? 'ok' : JSON.stringify(upBad).slice(0, 160));

  // 7) 企业域抽样：新建特性开关（弹窗必填校验 → 创建成功 → 列表增长）
  await goto('/enterprise/flags');
  await settle();
  const flag = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const vis=(el)=>{ if(!el) return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const set=(el,v)=>{ const p=window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(p,'value').set.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); };
    const before = document.querySelectorAll('tbody tr').length;
    const open = [...document.querySelectorAll('button')].filter(vis).find((b)=>b.innerText.trim().startsWith('新建开关'));
    if(!open) return { err: 'no-create-button' };
    open.click(); await s(500);
    const dlg = [...document.querySelectorAll('.t-dialog')].find(vis);
    if(!dlg) return { err: 'no-dialog' };
    const confirm = [...dlg.querySelectorAll('button')].find((b)=>/创建开关/.test(b.innerText));
    confirm.click(); await s(500);
    const errMsg = [...document.querySelectorAll('.t-message')].map((m)=>m.innerText).join(' | ');
    const ins=[...dlg.querySelectorAll('input')].filter((el)=>!el.disabled&&el.offsetParent!==null&&el.type!=='number'&&!el.closest('.t-select-input'));
    if(ins[0]) set(ins[0], 'r04.smoke.federation');
    if(ins[1]) set(ins[1], 'org-01');
    await s(300);
    confirm.click(); await s(900);
    const okMsg = [...document.querySelectorAll('.t-message')].map((m)=>m.innerText).join(' | ');
    const after = document.querySelectorAll('tbody tr').length;
    return { opened:true, validated:/请填写开关名/.test(errMsg), created:/已创建开关/.test(okMsg), before, after, dialogGone: ![...document.querySelectorAll('.t-dialog')].filter(vis).length };
  })()`, true);
  record('企业域：新建开关 → 空表单拦截 → 创建成功且列表增长',
    flag.err === undefined && flag.validated && flag.created && flag.after === flag.before + 1 && flag.dialogGone,
    JSON.stringify(flag).slice(0, 260));

  // 8) 安全域抽样：批量轮换到期项（Popconfirm 确认 → 真实结果或明确「无到期项」）
  await goto('/security/credentials');
  await settle();
  const rot = await evalJs(`(async () => {
    const s=(ms)=>new Promise(r=>setTimeout(r,ms));
    const vis=(el)=>{ if(!el) return false; const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const btn = [...document.querySelectorAll('button')].filter(vis).find((b)=>b.innerText.trim().startsWith('批量轮换到期项'));
    if(!btn) return { err: 'no-rotate-button' };
    btn.click(); await s(600);
    const popup = [...document.querySelectorAll('.t-popup')].filter(vis).find((p)=>/批量轮换/.test(p.innerText));
    if(!popup) return { err: 'no-confirm-popup' };
    const confirm = [...popup.querySelectorAll('button')].find((b)=>/批量轮换/.test(b.innerText) && !/到期项/.test(b.innerText));
    if(!confirm) return { err: 'no-confirm-button' };
    confirm.click(); await s(900);
    const msg = [...document.querySelectorAll('.t-message')].map((m)=>m.innerText).join(' | ');
    return { clicked:true, msg };
  })()`, true);
  record('安全域：批量轮换 → 确认后给出真实结果（轮换明细或明确无到期项）',
    rot.err === undefined && /已批量轮换|没有轮换到期项/.test(rot.msg || ''),
    JSON.stringify(rot).slice(0, 260));

  record('表单/操作期间无控制台错误', errors.length === 0, errors.slice(0, 2).join(' | ').slice(0, 240));

  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(REPORT, JSON.stringify({ when: new Date().toISOString(), base: BASE, total: results.length, failed: failed.length, results, consoleErrors: errors }, null, 2));
  console.log(`\n表单与操作用例 ${results.length} 项，失败 ${failed.length} 项`);
  await cdp.send('Browser.close').catch(() => {});
  chrome.kill();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('表单验证失败：', e.message); chrome.kill(); process.exit(2); });
