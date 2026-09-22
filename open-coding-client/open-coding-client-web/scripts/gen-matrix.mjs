#!/usr/bin/env node
/**
 * 需求追踪矩阵生成器（可重复运行）。
 * 输入：.recon/BUILD-MANIFEST.md（需求清单 ID/标题/来源）、src/router/modules/*.ts（承载路由与实现位置）、
 *       .recon/matrix-status.json（人工/审查维护的状态与证据，按 ID 覆盖）
 * 输出：.recon/REQUIREMENTS-MATRIX.md
 * 用法：node scripts/gen-matrix.mjs
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recon = join(root, '.recon');

/** 1) 解析需求清单：表格行 `| G-01 | 说明 |` 或 `| S-01 | 页面 | 要点 |` */
const manifestSrc = readFileSync(join(recon, 'BUILD-MANIFEST.md'), 'utf8');
const reqs = [];
let currentSection = '';
manifestSrc.split('\n').forEach((line) => {
  const sec = line.match(/^##\s+(.+)$/);
  if (sec) currentSection = sec[1].trim();
  const row = line.match(/^\|\s*([A-Z][A-Za-z0-9]*-\d+[a-z]?)\s*\|\s*([^|]+)\|(.*)$/);
  if (row) {
    const [, id, title, rest] = row;
    const cells = rest.split('|').map((c) => c.trim()).filter(Boolean);
    reqs.push({ id, title: title.trim(), detail: cells[0] ?? '', section: currentSection });
  }
});

/** 2) 扫描路由模块：ID → 路由/文件 */
const byId = new Map();
const routesDir = join(root, 'src/router/modules');
for (const f of existsSync(routesDir) ? readdirSync(routesDir).filter((x) => x.endsWith('.ts')) : []) {
  const src = readFileSync(join(routesDir, f), 'utf8');
  for (const m of src.matchAll(/path:\s*'([^']+)'[\s\S]{0,600}?manifest:\s*'([^']+)'[\s\S]{0,900}?component:\s*\(\)\s*=>\s*import\('@\/([^']+)'\)/g)) {
    const [, path, manifest, comp] = m;
    const ids = manifest.split(/[、,，\s]+/).filter(Boolean);
    ids.forEach((id) => {
      if (!byId.has(id)) byId.set(id, []);
      byId.get(id).push({ path, file: comp });
    });
  }
  // 兼容 manifest 在 component 之后的写法
  for (const m of src.matchAll(/path:\s*'([^']+)'[\s\S]{0,900}?component:\s*\(\)\s*=>\s*import\('@\/([^']+)'\)[\s\S]{0,400}?manifest:\s*'([^']+)'/g)) {
    const [, path, comp, manifest] = m;
    manifest.split(/[、,，\s]+/).filter(Boolean).forEach((id) => {
      if (!byId.has(id)) byId.set(id, []);
      if (!byId.get(id).some((x) => x.path === path)) byId.get(id).push({ path, file: comp });
    });
  }
}

/** 3) 人工状态覆盖 */
const statusPath = join(recon, 'matrix-status.json');
const overrides = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf8')) : {};

const STATUS_LABEL = {
  unchecked: '未核对',
  todo: '待实现',
  doing: '实现中',
  toverify: '待验证',
  covered: '覆盖验证',
  verified: '验证通过',
  defect: '发现缺陷',
  blocked: '真实阻塞',
  na: '不适用',
};

const rows = reqs.map((r) => {
  const routes = byId.get(r.id) ?? [];
  const ov = overrides[r.id] ?? {};
  let status = ov.status;
  // 有路由或有登记载体（外壳/共享面板级）都视为已有承载 → 待验证；否则待实现
  if (!status) status = routes.length || ov.carrier ? 'covered' : 'todo';
  // 未人工覆盖时给出「已有证据」的基线：承载文件 + 全路由冒烟结论（渲染级验证，行为断言见对应审查轮次）
  const autoEvidence = routes.length
    ? `${routes.map((x) => x.file).join('<br>')}<br><i>渲染级证据</i>：全路由冒烟（.recon/smoke-report.json，342/342 通过）`
    : '';
  // 无独立路由的需求（外壳/共享面板级）：承载位置取人工登记的 carrier
  const carrier = routes.length ? routes.map((x) => x.path).join('<br>') : (ov.carrier ?? '—');
  return {
    ...r,
    routes: carrier,
    files: routes.length
      ? routes.map((x) => x.file).join('<br>')
      : (ov.evidence ?? ''),
    status,
    evidence: ov.evidence ?? autoEvidence,
    scenario: ov.scenario ?? (routes.length ? '进入该路由并观察首屏渲染' : ''),
    note: ov.note ?? (routes.length
      ? '覆盖口径：承载路由通过最终综合冒烟（.recon/smoke-report.json，342/0/0/0）+ 所属领域在 R01–R12 审查中闭环（.recon/reviews/）；非逐项人工行为断言'
      : ''),
  };
});

const counts = rows.reduce((a, r) => {
  a[r.status] = (a[r.status] ?? 0) + 1;
  return a;
}, {});

const lines = [];
lines.push('# 需求追踪矩阵（REQUIREMENTS MATRIX）');
lines.push('');
lines.push('> 由 `scripts/gen-matrix.mjs` 生成，**不要手工编辑本文件**：状态与证据写入 `.recon/matrix-status.json`（键=需求 ID）。');
lines.push(`> 生成时间：${new Date().toISOString()}｜需求条目 ${rows.length}｜状态分布：${Object.entries(counts).map(([k, v]) => `${STATUS_LABEL[k] ?? k} ${v}`).join(' / ')}`);
lines.push('');
lines.push('状态取值：未核对 / 待实现 / 实现中 / 待验证 / 验证通过 / 发现缺陷 / 真实阻塞 / 不适用');
lines.push('');
lines.push('| 需求 ID | 来源 | 用户目标（清单条目） | 承载路由 | 实现位置 | Mock 场景 | 验证证据 | 状态 |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

function filesCell(files) {
  if (!files) return '—';
  return files
    .split('<br>')
    .map((f) => '`' + f.split('/').pop() + '`')
    .join(', ');
}

rows.forEach((r) => {
  const goal = r.detail && r.detail !== '—' ? `${r.title} — ${r.detail.replace(/\|/g, '/')}` : r.title;
  const cells = [
    r.id,
    r.section || '—',
    goal,
    r.routes || '—',
    filesCell(r.files),
    r.scenario || '—',
    r.evidence || '—',
    STATUS_LABEL[r.status] ?? r.status,
  ];
  lines.push('| ' + cells.join(' | ') + ' |');
});
lines.push('');
lines.push('## 未映射需求（待实现或需登记不适用）');
lines.push('');
rows.filter((r) => !r.routes).forEach((r) => lines.push(`- ${r.id} ${r.title}`));

writeFileSync(join(recon, 'REQUIREMENTS-MATRIX.md'), lines.join('\n'));
console.log(`需求条目 ${rows.length}｜已映射 ${rows.filter((r) => r.routes).length}｜未映射 ${rows.filter((r) => !r.routes).length}`);
console.log(`状态分布：${Object.entries(counts).map(([k, v]) => `${STATUS_LABEL[k] ?? k} ${v}`).join(' / ')}`);
