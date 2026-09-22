#!/usr/bin/env node
/**
 * 模板编译门禁（自审 R01/R02 使用）：
 * 用 @vue/compiler-sfc 解析并编译全部 .vue 文件，捕获 typecheck 覆盖不到的模板语法/指令错误
 * （如 v-model 非左值、属性未加引号、指令表达式非法、未闭合标签）。
 * 用法：node scripts/check-templates.mjs
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, compileTemplate, compileScript } from 'vue/compiler-sfc';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.vue') ? [p] : [];
  });
}

const files = walk(srcDir).concat(existsSync(join(root, 'index.html')) ? [] : []);
const issues = [];

for (const file of files) {
  const rel = relative(root, file).replace(/\\/g, '/');
  const source = readFileSync(file, 'utf8');
  const { descriptor, errors } = parse(source, { filename: file });
  errors.forEach((e) => issues.push(`${rel}: 解析错误 → ${e.message}`));
  if (!descriptor.template) continue;

  const result = compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: rel,
    compilerOptions: { expressionPlugins: ['typescript'] },
  });
  result.errors.forEach((e) => issues.push(`${rel}: 模板编译错误 → ${typeof e === 'string' ? e : e.message}`));

  try {
    compileScript(descriptor, { id: rel });
  } catch (e) {
    issues.push(`${rel}: 脚本编译错误 → ${String(e.message ?? e)}`);
  }
}

console.log(`检查 .vue 文件 ${files.length} 个`);
if (issues.length) {
  console.log(`\n发现 ${issues.length} 项模板/脚本错误：`);
  issues.slice(0, 80).forEach((i) => console.log(' - ' + i));
  process.exitCode = 1;
} else {
  console.log('全部模板编译通过。');
}
