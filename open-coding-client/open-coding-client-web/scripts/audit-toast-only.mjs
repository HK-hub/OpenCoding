// 只弹提示审计（R04 延伸）：找出 @click 处理器「仅调用 MessagePlugin 且无任何状态/数据副作用」的按钮。
// 判定：@click 表达式去空白后形如 MessagePlugin.xxx(...)  或  () => MessagePlugin.xxx(...) ，
// 且不含 = / push / splice / +1 / -- / store. / router. / download / clipboard 等副作用痕迹。
// 用法：node scripts/audit-toast-only.mjs [--json .recon/toast-only.json]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = argOf('--json', '.recon/toast-only.json');
const ROOT = 'src';

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.vue')) out.push(p);
  }
  return out;
}

// 副作用痕迹：出现任一即认为「不只弹提示」
const SIDE_EFFECT = /(=|push|splice|unshift|shift\(|pop\(|--|\+\+|store\.|router\.|\.value|db\.|bus\.|copy|clipboard|download|write|fetch|emit|setTimeout|\.map\(|\.filter\(|open\b|toggle|goTo|navigate|refresh|scan|submit|save|load|close|open)/;

const findings = [];
let scanned = 0;

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, 'utf8');
  const tplStart = src.indexOf('<template>');
  if (tplStart < 0) continue;
  scanned++;
  const tpl = src.slice(tplStart);
  const lines = [];
  // 提取所有 @click="..." 属性值（双引号、可跨行）
  const re = /@click\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(tpl)) !== null) {
    const expr = m[1].trim();
    const line = tpl.slice(0, m.index).split('\n').length;
    // 仅当：整体只有 MessagePlugin 调用（可带箭头函数包装、可串联 .then 无）
    const sole = /^(\(\s*\)\s*=>\s*)?MessagePlugin\.\w+\([^)]*\);?$/.test(expr.replace(/\s+/g, ' '));
    if (!sole) continue;
    if (SIDE_EFFECT.test(expr.replace(/MessagePlugin\.\w+\([^)]*\)/, ''))) continue;
    // 取整行文本与所在标签（粗粒度）
    const ln = tpl.split('\n')[line - 1] || '';
    findings.push({ file: file.replace(/\\/g, '/'), line, expr: expr.slice(0, 120), snippet: ln.trim().slice(0, 140) });
  }
}

fs.writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), scanned, count: findings.length, findings }, null, 2));
console.log(`扫描 .vue 文件 ${scanned} 个：仅弹提示的点击处理器 ${findings.length} 处（报告 ${OUT}）`);
const by = {};
for (const f of findings) (by[f.file] = by[f.file] || []).push(f.expr.slice(0, 80));
for (const [f, v] of Object.entries(by)) console.log('-', f.replace('src/views/', ''), '→', v.join(' ; ').slice(0, 160));
process.exit(0);
