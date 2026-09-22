// 覆盖审计：统计视图文件、路由引用、未被任何路由/组件引用的视图（未被承载的需求风险）
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const viewsDir = path.join(root, 'src/views');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.vue')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const views = walk(viewsDir).map((p) => p.replace(root.replace(/\\/g, '/') + '/', ''));

// 收集 src 下全部源码中的 '@/' 引用
function collectRefs(dir, out = new Set()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) collectRefs(p, out);
    else if (/\.(ts|vue|mts)$/.test(e.name)) {
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/['"](@\/[^'"]+)['"]/g)) out.add(m[1].replace('@/', 'src/'));
    }
  }
  return out;
}

const allRefs = collectRefs(path.join(root, 'src'));

const routerRefs = new Set();
const modDir = path.join(root, 'src/router/modules');
for (const f of fs.readdirSync(modDir)) {
  const src = fs.readFileSync(path.join(modDir, f), 'utf8');
  for (const m of src.matchAll(/['"](@\/[^'"]+)['"]/g)) routerRefs.add(m[1].replace('@/', 'src/'));
}

const orphan = views.filter((v) => !allRefs.has(v));
const nonRouted = views.filter((v) => !routerRefs.has(v));

console.log(`视图文件总数: ${views.length}`);
console.log(`被路由模块引用: ${views.length - nonRouted.length}`);
console.log(`未被任何源码引用（孤儿文件）: ${orphan.length}`);
console.log(`被其他组件引用但不在路由（合法：抽屉/子面板组件）: ${nonRouted.length - orphan.length}`);

if (nonRouted.length) {
  console.log('\n-- 仅被非路由引用 --');
  for (const v of nonRouted) console.log(`  ${v}`);
}
if (orphan.length) {
  console.log('\n-- 孤儿文件（需处理） --');
  for (const v of orphan) console.log(`  ${v}`);
}
