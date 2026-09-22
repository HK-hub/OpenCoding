#!/usr/bin/env node
/**
 * 视图合规扫描（自审 R2–R10 的证据来源）。
 * 逐文件检查：页头四件套 / 六态外壳 / 等价 CLI / 危险操作确认 / 空态可行动 /
 * 元信息（溯源卷号+清单号）/ 反例（console.log、TODO、any 泛滥、硬编码密钥）。
 * 用法：node scripts/audit-views.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viewsDir = join(root, 'src/views');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.vue') ? [p] : [];
  });
}

const files = walk(viewsDir);
const rows = [];

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const rel = relative(root, f).replace(/\\/g, '/');
  const has = (re) => re.test(src);
  const issues = [];

  const isOverlay = /views\/(common|share|onboarding)\//.test(rel) || f.endsWith('WorkbenchLayout.vue');

  // B2 页头四件套
  const pageHeader = has(/PageHeader/);
  // 兼容属性语法 volume="卷 xx" 与对象语法 volume:
  const volume = has(/volume\s*[=:]/);
  const manifest = has(/manifest\s*[=:]/);
  if (!isOverlay && !pageHeader) issues.push('缺 PageHeader（页头四件套）');
  if (!isOverlay && pageHeader && !volume && !manifest) issues.push('缺溯源信息（volume/manifest）');

  // B3 六态
  const stateShell = has(/StateShell/);
  if (!isOverlay && !stateShell) issues.push('缺 StateShell（六态外壳）');
  if (stateShell) {
    if (!/EMPTY|empty-title|emptyTitle/.test(src)) issues.push('未实现 EMPTY 态文案');
    if (!/LOADING|loading/.test(src)) issues.push('未实现 LOADING 态');
    if (!/ERROR|error/.test(src)) issues.push('未实现 ERROR 态');
    if (!/EDGE_DATA|load-more|collapsedSummary/.test(src)) issues.push('未实现 EDGE_DATA（列表页应有）');
  }

  // A4 双端等价
  const cli = has(/CliHint|cli="/) || has(/cli=/);
  if (!isOverlay && !cli) issues.push('缺等价 CLI 命令（铁律 6）');

  // C2 危险操作确认
  const destructive = /(删除|回滚|撤销|强制|放行|彻底|清空|禁用全部|接管|放弃归档)/.test(src);
  if (destructive && !/Popconfirm|Dialog|showConfirm|confirm\(/.test(src)) issues.push('危险操作缺二次确认');

  // B4 空态可行动
  if (stateShell && !/empty-action|emptyAction|example-task|exampleTask/.test(src)) issues.push('空态缺主行动/示例任务');

  // A2/A6 徽标与权限
  if (/frontier/.test(rel) && !/experimental/.test(src)) issues.push('前沿探索页缺「实验」徽标');

  // 错误三段式 + traceId
  if (stateShell && !/traceId|CopyableId/.test(src)) issues.push('错误态缺可复制 traceId');

  // 反例扫描
  if (/console\.log\(/.test(src)) issues.push('残留 console.log');
  if (/\/\/\s*TODO|FIXME/.test(src)) issues.push('残留 TODO/FIXME');
  const anyCount = (src.match(/:\s*any\b/g) ?? []).length;
  if (anyCount > 3) issues.push(`any 使用过多（${anyCount}）`);
  if (/(sk-[A-Za-z0-9]{10,}|api[_-]?key\s*[:=]\s*'[^']{8,}')/i.test(src)) issues.push('疑似硬编码密钥');

  const lines = src.split('\n').length;
  if (lines > 600) issues.push(`文件过长（${lines} 行），建议拆分`);

  rows.push({ file: rel, lines, issues });
}

const totalIssues = rows.reduce((a, r) => a + r.issues.length, 0);
const byKind = new Map();
rows.forEach((r) => r.issues.forEach((i) => byKind.set(i.replace(/（.*?）/, ''), (byKind.get(i.replace(/（.*?）/, '')) ?? 0) + 1)));

if (process.argv.includes('--json')) {
  writeFileSync(join(root, '.recon/view-audit.json'), JSON.stringify({ rows, totalIssues }, null, 2));
  console.log(`已写入 .recon/view-audit.json（${rows.length} 文件 / ${totalIssues} 问题）`);
} else {
  console.log(`扫描视图 ${rows.length} 个，问题 ${totalIssues} 项\n`);
  console.log('按类型汇总：');
  [...byKind.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
  console.log('\n问题文件明细（前 60）：');
  rows
    .filter((r) => r.issues.length)
    .sort((a, b) => b.issues.length - a.issues.length)
    .slice(0, 60)
    .forEach((r) => console.log(`  ${r.file} (${r.lines} 行): ${r.issues.join('；')}`));
}
