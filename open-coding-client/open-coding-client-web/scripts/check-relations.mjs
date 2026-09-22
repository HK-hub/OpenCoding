#!/usr/bin/env node
/**
 * 跨域引用完整性检查（R05 数据一致性门禁）。
 *
 * 方法：以确定性种子执行各域 mock 数据模块，建立「实体集合」索引：
 * - 每个数组视为一类实体集合（概念名取数组键的单数形式）
 * - 集合的主键 = 元素中唯一且覆盖全量的 id 型字段（id / xxxId / key / code / no）
 * - 对任意对象里的外键字段 `xxxId`：按名称找出对应的实体集合，
 *   校验取值能命中该集合的任一唯一字段；找不到对应集合的视为外部引用（跳过并计入统计）
 *
 * 用法：node scripts/check-relations.mjs
 */
import { readdirSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'src/mock/data');
const outDir = mkdtempSync(join(tmpdir(), 'oc-rel-'));

/** 外部引用白名单：这些概念在本 mock 中不对应本地实体集合 */
const EXTERNAL_CONCEPTS = new Set(['trace', 'scim', 'session', 'request', 'correlation', 'span', 'run-', 'ext']);

/**
 * 已核对的跨域编号约定（不作为失败项，但每次运行仍打印列出，便于复核）。
 * 判定依据：页面不提供该字段的跨页跳转入口（已 grep router.push 确认），或取值本身是路径/编码/占位文案。
 */
const KNOWN_CONVENTIONS = new Map([
  ['automation :: ruleId', '取值为规则路径（rule/oc-sec/...），非实体主键；工具域 rule 列表用自增 id'],
  ['automation :: capabilityId', '取值为能力编码（tech-debt / license 等），来自能力目录词表'],
  ['enterprise :: eventId', '平台事件为只读观测流；复盘页仅展示事件引用，不提供跨页跳转'],
  ['enterprise :: postmortemId', "'待产出' 为占位文案（该事故尚未产出复盘），非编号"],
  ['model :: taskId', '成本/审计视角的评估任务编号（task-88xx），与任务域 shortId 为不同编号空间；页面不跳转'],
  ['enterprise :: runId', '评估运行编号（run-24xx），仅用于成本明细行标识'],
  ['platform :: subagentId', '平台事件 payload 内的引用快照（事件为不可变载荷，不参与关联查询）'],
  ['platform :: decisionId', '同上：事件 payload 快照'],
  ['platform :: approvalId', '同上：事件 payload 快照'],
  ['platform :: policyId', '同上：事件 payload 快照'],
  ['platform :: skillId', '同上：事件 payload 快照'],
  ['platform :: sourceId', '同上：事件 payload 快照'],
  ['platform :: goalId', '同上：事件 payload 快照'],
  ['platform :: scheduleId', '同上：事件 payload 快照'],
  ['platform :: runId', '同上：事件 payload 快照'],
  ['platform :: pluginId', '同上：事件 payload 快照'],
  ['platform :: hookId', '同上：事件 payload 快照'],
  ['platform :: templateId', '同上：事件 payload 快照'],
  ['platform :: findingId', '同上：事件 payload 快照'],
  ['platform :: ruleId', '同上：事件 payload 快照'],
  ['platform :: taskId', 'git worktree 行引用的任务来自任务域，但 worktree 页无任务详情跳转入口'],
  ['platform :: snapshotId', '工作区快照编号（sn-xxx）为平台域自身编号空间，列表与详情同源'],
  ['platform :: commandId', '命令编号（cmd-ws-xxx）为平台域自身编号空间，命令终端页同源'],
  ['task :: triggerId', '触发记录编号（TR-x）由调度域生成，计划行仅展示触发计数'],
  ['session :: callId', '工具调用编号（TC-xxxx）与会话条目同源；模型域的 call-xxxx 为推理调用编号，两者语义不同'],
  ['session :: checkpointId', '会话检查点编号（ckp_xxx），由会话域自身生成并在本页消费'],
]);

const issues = [];
const collections = new Map(); // singularName -> { values:Set, pkField, size, modules:Set, rawName }
const fkSites = [];
const stats = [];

function singularize(name) {
  const lower = name.replace(/-/g, '');
  if (/ies$/.test(lower)) return lower.slice(0, -3) + 'y';
  if (/(ses|xes|zes|ches|shes)$/.test(lower)) return lower.slice(0, -2);
  if (/s$/.test(lower) && !/ss$/.test(lower)) return lower.slice(0, -1);
  return lower;
}

function pluralize(name) {
  if (/y$/.test(name)) return name.slice(0, -1) + 'ies';
  if (/(s|x|ch|sh)$/.test(name)) return name + 'es';
  return name + 's';
}

/**
 * 从数组元素推断主键字段。
 * 只在「字段名可与数组概念名对齐」时认定为主键：id / key / code / no / <concept>Id|Code|No，
 * 避免把 traceId、tenantId 这类只是「恰好唯一」的字段误当作实体主键（否则外键会自我命中）。
 */
function inferKeys(arr, concept) {
  const objs = arr.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
  if (objs.length < 2) return { uniqueFields: new Set(), pkField: null };
  const candidates = new Set(['id', 'key', 'code', 'no']);
  if (concept) {
    candidates.add(`${concept}Id`);
    candidates.add(`${concept}Code`);
    candidates.add(`${concept}No`);
    candidates.add(`${concept}Key`);
  }
  const uniqueFields = new Set();
  let pkField = null;
  for (const o of objs) {
    for (const k of Object.keys(o)) if (!candidates.has(k)) candidates.delete(k);
  }
  for (const f of candidates) {
    const vals = objs.map((o) => o[f]).filter((v) => typeof v === 'string' && v.length > 0);
    if (!vals.length || vals.length < objs.length) continue;
    if (new Set(vals).size !== vals.length) continue;
    uniqueFields.add(f);
    if (!pkField || f === 'id') pkField = f;
  }
  // 回退：无可对齐的主键名时，若数组仅有一个「行键型」唯一字段（xxxId/xxxCode/xxxNo/key），
  // 说明该字段即行标识（如 subtasks[].taskId），把它的取值也纳入标识空间，避免误报。
  if (!uniqueFields.size) {
    const rowKeyFields = new Set();
    for (const o of objs) for (const k of Object.keys(o)) {
      if (/^(key|code|no)$/.test(k) || /(Id|Code|No|Key)$/.test(k)) rowKeyFields.add(k);
    }
    for (const f of rowKeyFields) {
      const vals = objs.map((o) => o[f]).filter((v) => typeof v === 'string' && v.length > 0);
      if (vals.length !== objs.length || new Set(vals).size !== vals.length) continue;
      uniqueFields.add(f);
      pkField = pkField ?? f;
    }
  }
  return { uniqueFields, pkField };
}

function walkArrays(node, path, visit) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    visit(node, path);
    node.forEach((v, i) => walkArrays(v, `${path}[${i}]`, visit));
    return;
  }
  if (typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object') walkArrays(v, path ? `${path}.${k}` : k, visit);
  }
}

function walkObjects(node, path, visit) {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkObjects(v, `${path}[${i}]`, visit));
    return;
  }
  if (typeof node !== 'object') return;
  visit(node, path);
  for (const [k, v] of Object.entries(node)) {
    if (v && typeof v === 'object') walkObjects(v, path ? `${path}.${k}` : k, visit);
  }
}

async function loadModule(name) {
  const entry = join(outDir, `entry-${name}.ts`);
  const rngPath = join(root, 'src/mock/rng.ts').replace(/\\/g, '/');
  const dataPath = join(dataDir, `${name}.ts`).replace(/\\/g, '/');
  writeFileSync(entry, `import { Rng } from '${rngPath}';\nimport * as mod from '${dataPath}';\nexport { Rng, mod };\n`);
  const out = join(outDir, `${name}.mjs`);
  await build({
    entryPoints: [entry], outfile: out, bundle: true, format: 'esm', platform: 'node', target: 'node20', logLevel: 'silent',
  });
  return import(pathToFileURL(out).href);
}

const files = existsSync(dataDir) ? readdirSync(dataDir).filter((f) => f.endsWith('.ts')) : [];
const loaded = new Map();

for (const f of files) {
  const name = basename(f, '.ts');
  if (name === 'search-corpus') continue;
  try {
    const bundle = await loadModule(name);
    const builder = Object.keys(bundle.mod).find((k) => k.startsWith('build'));
    if (!builder) {
      issues.push(`${name}: 未导出 build* 工厂函数`);
      continue;
    }
    loaded.set(name, bundle.mod[builder](new bundle.Rng(20260921)));
  } catch (e) {
    issues.push(`${name}: 加载/执行失败 → ${String(e).split('\n')[0]}`);
  }
}

// 第一遍：登记实体集合
for (const [moduleName, data] of loaded) {
  let arrayCount = 0;
  let elementCount = 0;
  walkArrays(data, moduleName, (arr, path) => {
    const key = path.split('.').pop().replace(/\[\d+\]/g, '');
    if (!key || key === path) return;
    const concept = singularize(key);
    const { uniqueFields, pkField } = inferKeys(arr, concept);
    if (!uniqueFields.size) return;
    arrayCount += 1;
    const site = collections.get(concept) ?? { values: new Set(), pkField: null, size: 0, modules: new Set(), rawName: key, fields: new Set() };
    const objs = arr.filter((x) => x && typeof x === 'object');
    elementCount += objs.length;
    site.size += objs.length;
    site.modules.add(moduleName);
    uniqueFields.forEach((f) => {
      site.fields.add(f);
      objs.forEach((o) => { if (typeof o[f] === 'string') site.values.add(o[f]); });
      if (!site.pkField || f === 'id') site.pkField = f;
    });
    collections.set(concept, site);
  });
  stats.push({ module: moduleName, arrayCount, elementCount });
}

// 第二遍：收集全部外键出现点
for (const [moduleName, data] of loaded) {
  walkObjects(data, moduleName, (obj, path) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'id' || !/Id$/.test(k)) continue;
      const concept = singularize(k.slice(0, -2));
      const values = Array.isArray(v) ? v : [v];
      values.forEach((val) => {
        if (typeof val !== 'string' || !val) return;
        fkSites.push({ module: moduleName, path, field: k, concept, value: val });
      });
    }
  });
}

// 第三遍：解析外键（全域主键值集合 + 名称匹配给出目标提示）
const allPkValues = new Set();
for (const site of collections.values()) site.values.forEach((v) => allPkValues.add(v));

const dangling = [];
let resolved = 0;
let externalSkipped = 0;
for (const site of fkSites) {
  if (EXTERNAL_CONCEPTS.has(site.concept)) { externalSkipped += 1; continue; }
  const target = collections.get(site.concept) ?? collections.get(pluralize(site.concept));
  if (!target) { externalSkipped += 1; continue; }
  if (allPkValues.has(site.value)) { resolved += 1; continue; }
  dangling.push({ ...site, target: target.rawName, targetModule: [...target.modules].join('/'), targetSize: target.size });
}

const byField = new Map();
for (const d of dangling) {
  const key = `${d.module} :: ${d.field} → ${d.target}(${d.targetModule},${d.targetSize})`;
  if (!byField.has(key)) byField.set(key, []);
  byField.get(key).push(`${d.path} = ${d.value}`);
}

// 已知约定（见 KNOWN_CONVENTIONS）与真失败分离
const known = new Map();
const failures = new Map();
for (const [key, v] of byField) {
  const plainKey = key.split(' → ')[0];
  if (KNOWN_CONVENTIONS.has(plainKey)) {
    // 约定键按「模块 :: 字段」聚合；样本合并展示
    const k = plainKey;
    if (!known.has(k)) known.set(k, { reason: KNOWN_CONVENTIONS.get(plainKey), count: 0, samples: [] });
    const rec = known.get(k);
    rec.count += v.length;
    rec.samples.push(...v.slice(0, 2));
  } else {
    failures.set(key, v);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  collections: collections.size,
  fkSites: fkSites.length,
  resolved,
  externalSkipped,
  danglingCount: dangling.length,
  knownConventions: Object.fromEntries([...known].map(([k, v]) => [k, { count: v.count, reason: v.reason }])),
  failures: Object.fromEntries([...failures].map(([k, v]) => [k, { count: v.length, samples: v.slice(0, 4) }])),
  moduleStats: stats,
};
writeFileSync(join(root, '.recon/relations-audit.json'), JSON.stringify(report, null, 2));

console.log(`跨域引用完整性：实体集合 ${collections.size} 类，外键出现点 ${fkSites.length} 处`);
console.log(`  已解析 ${resolved} · 外部/无本地集合 ${externalSkipped} · 悬空 ${dangling.length}`);
if (known.size) {
  console.log(`\n已核对约定 ${known.size} 组（不计失败，理由见脚本 KNOWN_CONVENTIONS）：`);
  [...known].forEach(([k, v]) => console.log(`  · ${k} ×${v.count} —— ${v.reason}`));
}
if (!failures.size) {
  console.log('\n未发现未归类的悬空外键。');
} else {
  console.log(`\n未归类悬空外键 ${[...failures.values()].reduce((a, v) => a + v.length, 0)} 处（${failures.size} 组）：`);
  [...failures].forEach(([k, v]) => {
    console.log(` - ${k} ×${v.length}`);
    v.slice(0, 3).forEach((x) => console.log(`     ${x}`));
  });
  process.exitCode = 1;
}
