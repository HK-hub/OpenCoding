// 扫描 Table 列定义与插槽命名冲突：
// TDesign renderTitle 在 `title` 字符串命中同名插槽时会调用 slots[title]({col, colIndex})——不含 row，
// 若该插槽是行插槽（读取 row.xxx）即抛错。本脚本找出全部此类命名冲突。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const viewsDir = path.join(root, 'src');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.vue')) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(viewsDir)) {
  const src = fs.readFileSync(file, 'utf8');
  const slots = new Set();
  for (const m of src.matchAll(/#([A-Za-z_][\w-]*)\s*=/g)) slots.add(m[1]);
  for (const m of src.matchAll(/v-slot:([A-Za-z_][\w-]*)/g)) slots.add(m[1]);
  const titles = new Set();
  for (const m of src.matchAll(/title:\s*'([A-Za-z_][\w-]*)'/g)) titles.add(m[1]);
  // 动态列：colKey 与 title 取同一标识符（如 `title: r`），且该标识符值等于插槽名时同样冲突
  // 动态列：colKey 与 title 取同一标识符时，只有「未显式指定 cell」才危险（标题会回退到行插槽）
  const dynObjects = [...src.matchAll(/\{([^{}]*?)\}/g)].map((m) => m[1]);
  const dynamicSameName = dynObjects.some((o) => /colKey:\s*([A-Za-z_$][\w$]*)\s*,\s*title:\s*\1\b/.test(o) && !/cell:/.test(o));
  const collision = [...titles].filter((t) => slots.has(t));
  if (dynamicSameName) collision.push('colKey===title（动态列，标题回退到行插槽）');
  if (collision.length) {
    hits.push({ file: path.relative(root, file).replace(/\\/g, '/'), collision });
  }
}

console.log(`扫描 .vue 文件：${walk(viewsDir).length} 个`);
console.log(`存在 title/slot 命名冲突：${hits.length} 个文件`);
for (const h of hits) console.log(`  ${h.file} → ${h.collision.join(', ')}`);
process.exit(hits.length ? 1 : 0);
