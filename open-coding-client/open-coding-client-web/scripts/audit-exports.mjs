// 扫描「导出按钮只弹提示、未真实生成下载」的页面（D-006 门禁）。
// 判定：文件提到「导出」且存在导出按钮，但既未使用 @/utils/download 也未用 Blob/URL.createObjectURL。
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.vue')) out.push(p);
  }
  return out;
}

const hits = [];
for (const file of walk(path.join(root, 'src'))) {
  const src = fs.readFileSync(file, 'utf8');
  if (!/导出/.test(src)) continue;
  const hasRealDownload = /@\/utils\/download/.test(src) || /new Blob|URL\.createObjectURL/.test(src);
  if (hasRealDownload) continue;
  // 「复制…导出包」是剪贴板动作而非下载，属合法语义，排除
  const toastClicks = [...src.matchAll(/@click="([^"]*(?:[Ee]xport|导出)[^"]*)"/g)]
    .map((m) => m[1])
    .filter((b) => /MessagePlugin\.(info|success)/.test(b))
    .filter((b) => !/已复制/.test(b));
  if (toastClicks.length) {
    hits.push({ file: path.relative(root, file).replace(/\\/g, '/'), count: toastClicks.length, example: toastClicks[0].slice(0, 80) });
  }
}

console.log(`导出仅提示的文件：${hits.length} 个（涉及按钮 ${hits.reduce((a, b) => a + b.count, 0)} 个）`);
for (const h of hits) console.log(`  ${h.file} [${h.count}]  ${h.example}`);
process.exit(hits.length ? 1 : 0);
