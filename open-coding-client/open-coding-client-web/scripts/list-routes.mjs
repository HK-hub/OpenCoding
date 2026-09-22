// 输出全部路由路径（用于浏览器全路由冒烟）
import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'src/router/modules');
const rows = [];
for (const f of fs.readdirSync(dir)) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  // 匹配 path: '...' 与 name: '...'
  const re = /path:\s*'([^']+)'[\s\S]{0,260}?name:\s*'([^']+)'/g;
  for (const m of src.matchAll(re)) rows.push({ path: m[1], name: m[2] });
}
const seen = new Set();
const out = rows.filter((r) => (seen.has(r.path) ? false : (seen.add(r.path), true)));
console.log(JSON.stringify(out.map((r) => r.path)));
console.error(`total ${out.length}`);
