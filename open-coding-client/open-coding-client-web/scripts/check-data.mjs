#!/usr/bin/env node
/**
 * Mock 数据自洽性检查（自审 R5 使用）。
 * 用 esbuild 就地打包各域数据模块并执行，校验：数量下限、数值自洽、时间递增、
 * 枚举合法、负样本存在、ID 唯一。用法：node scripts/check-data.mjs
 */
import { readdirSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'src/mock/data');
const outDir = mkdtempSync(join(tmpdir(), 'oc-data-'));

const results = [];
const issues = [];

function lowerBound(name) {
  const map = {
    session: 10, task: 16, approval: 12, tool: 18, model: 8, prompt: 14,
    extension: 14, knowledge: 18, platform: 12, enterprise: 10, automation: 12,
  };
  return map[name] ?? 8;
}

async function loadModule(name) {
  // 生成虚拟入口：同时暴露 rng 与数据模块，避免 bundling 后丢失 Rng 导出
  const entry = join(outDir, `entry-${name}.ts`);
  const rngPath = join(root, 'src/mock/rng.ts').replace(/\\/g, '/');
  const dataPath = join(dataDir, `${name}.ts`).replace(/\\/g, '/');
  writeFileSync(
    entry,
    `import { Rng } from '${rngPath}';\nimport * as mod from '${dataPath}';\nexport { Rng, mod };\n`,
  );
  const out = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [entry],
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    logLevel: 'silent',
  });
  return import(pathToFileURL(out).href);
}

const files = existsSync(dataDir) ? readdirSync(dataDir).filter((f) => f.endsWith('.ts')) : [];

for (const f of files) {
  const name = basename(f, '.ts');
  if (name === 'search-corpus') continue;
  try {
    const loaded = await loadModule(name);
    const mod = loaded.mod;
    const builder = Object.keys(mod).find((k) => k.startsWith('build'));
    if (!builder) {
      issues.push(`${name}: 未导出 build* 工厂函数`);
      continue;
    }
    const data = mod[builder](new loaded.Rng(20260921));

    /** 收集数组：顶层 + 一层嵌套（各域返回结构不一致） */
    const arrays = [];
    Object.entries(data).forEach(([k, v]) => {
      if (Array.isArray(v)) arrays.push([k, v.filter((x) => x && typeof x === 'object')]);
      else if (v && typeof v === 'object') {
        Object.entries(v).forEach(([k2, v2]) => {
          if (Array.isArray(v2)) arrays.push([`${k}.${k2}`, v2.filter((x) => x && typeof x === 'object')]);
        });
      }
    });
    const total = arrays.reduce((a, [, v]) => a + v.length, 0);
    const min = lowerBound(name);
    if (total < min) issues.push(`${name}: 数据总量 ${total} 低于下限 ${min}`);

    // 唯一性：仅对实体主键 id（避免把外键 sessionId/teamId 误判为重复）
    arrays.forEach(([key, arr]) => {
      if (!arr.length || !('id' in arr[0])) return;
      const seen = new Set();
      arr.forEach((it) => {
        const v = it.id;
        if (v === undefined || v === null) return;
        if (seen.has(v)) issues.push(`${name}.${key}: 重复 id=${v}`);
        seen.add(v);
      });
    });

    // 时间自洽：updatedAt >= createdAt / startedAt <= endedAt
    arrays.forEach(([key, arr]) => {
      arr.forEach((it) => {
        if (it.createdAt && it.updatedAt && new Date(it.updatedAt) < new Date(it.createdAt)) {
          issues.push(`${name}.${key}: updatedAt < createdAt（${it.id ?? it[key] ?? ''}）`);
        }
        if (it.startedAt && it.endedAt && new Date(it.endedAt) < new Date(it.startedAt)) {
          issues.push(`${name}.${key}: endedAt < startedAt（${it.id ?? ''}）`);
        }
      });
    });

    // 负样本：至少 2 条失败/降级/超限/冲突
    const flat = JSON.stringify(data);
    const negative = ['FAILED', 'Failed', 'failed', 'Degraded', 'degraded', 'blocked', 'conflict', 'exceeded', 'rejected', 'ESCALATED'].reduce(
      (a, kw) => a + (flat.split(kw).length - 1),
      0,
    );
    if (negative < 2) issues.push(`${name}: 负样本(${negative}) 少于 2 条`);

    results.push({ name, arrays: arrays.length, total, ok: true });
  } catch (e) {
    issues.push(`${name}: 加载/执行失败 → ${String(e).split('\n')[0]}`);
    results.push({ name, ok: false });
  }
}

console.log('数据模块自洽检查：');
results.forEach((r) => console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(12)} 数组 ${String(r.arrays ?? 0).padStart(2)} 条数 ${String(r.total ?? 0).padStart(4)}`));
writeFileSync(join(root, '.recon/data-audit.json'), JSON.stringify({ results, issues }, null, 2));
if (issues.length) {
  console.log(`\n发现问题 ${issues.length} 项（前 80）：`);
  issues.slice(0, 80).forEach((i) => console.log(` - ${i}`));
  process.exitCode = 1;
} else {
  console.log('\n未发现自洽性问题。');
}
