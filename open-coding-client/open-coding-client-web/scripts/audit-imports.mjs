// 扫描「模板里使用了但未在 script 中绑定」的 PascalCase 组件。
// 背景：本工程按需显式 import TDesign 组件，未导入的标签会退化成本地原生元素（如 <select>），
// 传入 TDesign 形态的 props 时抛错并污染后续渲染，属于跨页共性问题。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const VIEW_ROOTS = ['src'];
const NATIVE = new Set([
  'RouterView', 'RouterLink', 'Transition', 'TransitionGroup', 'Teleport', 'KeepAlive',
  'Component', 'Suspense', 'Slot', 'Fragment', 'B', 'I', 'A', 'P', 'Span', 'Div', 'Em', 'Strong', 'Small', 'Code', 'Pre', 'Br', 'Hr',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.vue')) out.push(p);
  }
  return out;
}

const problems = [];
let scanned = 0;
for (const rootDir of VIEW_ROOTS) {
  for (const file of walk(path.join(root, rootDir))) {
    const src = fs.readFileSync(file, 'utf8');
    const tplStart = src.indexOf('<template>');
    if (tplStart < 0) continue;
    scanned++;
    const template = src.slice(tplStart);
    const script = src.slice(0, tplStart);
    const tags = new Set();
    // 只看真正的标签起始：<Name 前不得是引号（排除属性字符串里出现的 <ISO 时间> 这类文案）
    for (const m of template.matchAll(/(^|[^"'])<([A-Z][A-Za-z0-9]*)[\s/>]/g)) tags.add(m[2]);
    const missing = [];
    for (const tag of tags) {
      if (NATIVE.has(tag)) continue;
      // script 中出现该标识符（import 绑定、const 定义、或其他引用）即视为已绑定
      const re = new RegExp(`(^|[^A-Za-z0-9_$])${tag}([^A-Za-z0-9_$]|$)`);
      if (!re.test(script)) missing.push(tag);
    }
    if (missing.length) problems.push({ file: path.relative(root, file).replace(/\\/g, '/'), missing });
  }
}

console.log(`扫描 .vue 文件：${scanned} 个`);
console.log(`存在未绑定组件：${problems.length} 个文件`);
for (const p of problems) console.log(`  ${p.file} → ${p.missing.join(', ')}`);
process.exit(problems.length ? 1 : 0);
