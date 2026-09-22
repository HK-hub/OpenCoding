#!/usr/bin/env node
/**
 * 路由与视图完整性检查（自审 R1/R2 使用）：
 * 1) 重复 path / name  2) component 指向的视图文件是否存在
 * 3) meta 必填项缺失   4) 导航分组是否越界
 * 用法：node scripts/check-routes.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = join(root, 'src/router/modules');

const ALLOWED_GROUPS = new Set([
  '工作台', '任务与协作', '扩展与生态', '权限与审批', '执行与安全', '上下文与成本',
  '模型与提示词', '平台与工程', '企业治理', '自动化与智能', '质量与运维', '分发与生态', '设置',
]);

const files = existsSync(modulesDir) ? readdirSync(modulesDir).filter((f) => f.endsWith('.ts')) : [];
const importRefs = [];
const paths = new Map();
const names = new Map();
const issues = [];
let routeCount = 0;

for (const f of [...files, '../index.ts']) {
  const src = readFileSync(join(modulesDir, f), 'utf8');
  for (const m of src.matchAll(/import\('@\/([^']+)'\)/g)) {
    const rel = m[1];
    const abs = join(root, 'src', rel);
    if (!existsSync(abs)) importRefs.push(`${rel}（${f}）`);
  }
  // 按顶层对象切块：每个块以 "  {" 开头且包含 path:
  const blocks = src.split(/\n\s{2}\{\n/).slice(1);
  for (const raw of blocks) {
    const block = raw.split(/\n\s{2}\},?/)[0];
    const path = block.match(/path:\s*'([^']+)'/)?.[1];
    if (!path) continue;
    routeCount += 1;
    const name = block.match(/name:\s*'([^']+)'/)?.[1] ?? '';
    const comp = block.match(/import\('@\/([^']+)'\)/)?.[1] ?? '';
    const metaBlock = block.match(/meta:\s*\{([\s\S]*)\}/)?.[1] ?? '';
    const hidden = /hidden:\s*true/.test(metaBlock);

    if (paths.has(path)) issues.push(`重复 path：${path}（${paths.get(path)} 与 ${f}）`);
    else paths.set(path, f);
    if (name) {
      if (names.has(name)) issues.push(`重复 name：${name}（${names.get(name)} 与 ${f}）`);
      else names.set(name, f);
    }

    if (comp) {
      const target = join(root, 'src', comp);
      const ok = existsSync(target) || ['.vue', '.ts', '/index.vue'].some((e) => existsSync(target + e));
      if (!ok) issues.push(`视图缺失：${comp}（${f} → ${path}）`);
    }

    for (const field of ['title', 'surface']) {
      if (!new RegExp(`\\b${field}:`).test(metaBlock)) issues.push(`meta 缺 ${field}：${path}（${f}）`);
    }
    if (!hidden) {
      for (const field of ['group', 'icon']) {
        if (!new RegExp(`\\b${field}:`).test(metaBlock)) issues.push(`meta 缺 ${field}：${path}（${f}）`);
      }
      const g = metaBlock.match(/group:\s*'([^']+)'/)?.[1];
      if (g && !ALLOWED_GROUPS.has(g)) issues.push(`未登记导航分组「${g}」：${path}（${f}）`);
      if (!/groupOrder:/.test(metaBlock)) issues.push(`meta 缺 groupOrder：${path}（${f}）`);
      if (!/order:/.test(metaBlock)) issues.push(`meta 缺 order：${path}（${f}）`);
    }
  }
}

function countVues(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir).reduce(
    (acc, e) => acc + (statSync(join(dir, e)).isDirectory() ? countVues(join(dir, e)) : e.endsWith('.vue') ? 1 : 0),
    0,
  );
}

const byGroup = new Map();
for (const f of [...files, '../index.ts']) {
  const src = readFileSync(join(modulesDir, f), 'utf8');
  for (const m of src.matchAll(/import\('@\/([^']+)'\)/g)) {
    const rel = m[1];
    const abs = join(root, 'src', rel);
    if (!existsSync(abs)) importRefs.push(`${rel}（${f}）`);
  }
  for (const m of src.matchAll(/group:\s*'([^']+)'/g)) byGroup.set(m[1], (byGroup.get(m[1]) ?? 0) + 1);
}

if (importRefs.length) {
  console.log(`
动态 import 缺失文件 ${importRefs.length} 个：`);
  [...new Set(importRefs)].forEach((x) => console.log(' - ' + x));
  process.exitCode = 1;
}

console.log(`路由模块：${files.length} 个`);
console.log(`路由条目：${routeCount} 条`);
console.log(`视图文件：${countVues(join(root, 'src/views'))} 个`);
console.log(`导航分组：${byGroup.size} 个 → ${[...byGroup.entries()].map(([k, v]) => `${k}(${v})`).join(' / ')}`);

if (issues.length) {
  console.log(`\n发现问题 ${issues.length} 项（前 140 条）：`);
  issues.slice(0, 140).forEach((i) => console.log(` - ${i}`));
  process.exitCode = 1;
} else {
  console.log('\n未发现重复路由 / 缺失视图 / meta 缺项。');
}
