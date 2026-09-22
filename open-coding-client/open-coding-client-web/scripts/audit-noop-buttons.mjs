// 空点击按钮审计（R04 批量与操作面）：
// 扫描全部 .vue 模板中的 <Button>/<t-button>，找出既无 @click 也未被
// Popconfirm/Dropdown/Upload 等触发器包裹的按钮——这类按钮点击后不产生任何
// 业务结果，属于需求明令禁止的「空点击处理器」。
// 用法：node scripts/audit-noop-buttons.mjs [--json .recon/noop-buttons.json]
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = argOf('--json', '.recon/noop-buttons.json');
const ROOT = 'src';

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.vue')) out.push(p);
  }
  return out;
}

// 只有这些组件会「接管子元素的点击」：Popup/Dropdown 展开浮层、Popconfirm 弹确认、Upload 打开文件选择。
// 注意 Tooltip/Dialog/Drawer 不接管点击，其中裸 Button 仍算空点击。
const TRIGGER_WRAPPERS = ['Popconfirm', 'Dropdown', 'Popup', 'Upload', 'FileUpload'];

/** 从 pos 开始读取一个标签的完整文本（引号感知，遇到引号外的 '>' 结束） */
function readTag(src, pos) {
  let i = pos;
  let quote = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '>') {
      return { tag: src.slice(pos, i + 1), end: i + 1 };
    }
    i++;
  }
  return { tag: src.slice(pos), end: src.length };
}

const files = walk(ROOT);
const offenders = [];
const disabledOnes = [];
let scanned = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const tplStart = src.indexOf('<template>');
  if (tplStart < 0) continue;
  scanned++;
  const tpl = src.slice(tplStart);
  const tplBaseLine = src.slice(0, tplStart).split('\n').length; // template 起始所在行（1 基）

  // 包裹栈：顺序扫描模板，遇到 <Wrapper ...>（非自闭合）压栈，遇 </Wrapper> 出栈
  const stack = [];
  const lineAt = (idx) => tplBaseLine + tpl.slice(0, idx).split('\n').length - 1;
  /** 提取按钮可见文本：自闭合为空；否则截取到 </Button> 并去掉内层标签 */
  const labelOf = (endIdx, name) => {
    const closeRe = new RegExp(`</(?:t-)?${name}>`, 'i');
    const rest = tpl.slice(endIdx, endIdx + 400);
    const m = rest.match(closeRe);
    if (!m) return '';
    return m.input.slice(0, m.index).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  };
  let cursor = 0;
  while (cursor < tpl.length) {
    const nextLt = tpl.indexOf('<', cursor);
    if (nextLt < 0) break;
    const { tag, end } = readTag(tpl, nextLt);
    const isClose = /^<\//.test(tag);
    const nameMatch = tag.match(/^<\/?([A-Za-z][\w-]*)/);
    const name = nameMatch ? nameMatch[1] : '';
    if (isClose) {
      const idx = stack.lastIndexOf(name);
      if (idx >= 0) stack.splice(idx, 1);
    } else {
      const selfClosing = /\/>$/.test(tag) || /^(input|img|br|hr|meta|link)\b/i.test(name);
      if (TRIGGER_WRAPPERS.includes(name)) {
        if (!selfClosing) stack.push(name);
      }
      if (/^(Button|button|t-button)$/i.test(name)) {
        const hasClick = /@click|v-on:click|:on-click/.test(tag);
        const isDisabled = /\sdisabled(\s|>|$|=)/.test(tag) || /:disabled="(true|!?)"/.test(tag);
        const wrapped = stack.length > 0;
        if (!hasClick && !wrapped) {
          const entry = {
            file: file.replace(/\\/g, '/'),
            line: lineAt(nextLt),
            label: selfClosing ? '' : labelOf(end, name),
            tag: tag.replace(/\s+/g, ' ').slice(0, 180),
          };
          (isDisabled ? disabledOnes : offenders).push(entry);
        }
      }
    }
    cursor = end;
  }
}

fs.writeFileSync(OUT, JSON.stringify({
  when: new Date().toISOString(), scanned,
  offenderCount: offenders.length, disabledCount: disabledOnes.length,
  offenders, disabledOnes,
}, null, 2));
console.log(`扫描 .vue 文件 ${scanned} 个：空点击按钮 ${offenders.length} 个；恒禁用无处理按钮 ${disabledOnes.length} 个（报告 ${OUT}）`);
console.log('== 空点击按钮 ==');
for (const f of offenders.slice(0, 80)) console.log(`- ${f.file}:${f.line} ${f.tag}`);
if (disabledOnes.length) {
  console.log('== 恒禁用（待核查业务依据） ==');
  for (const f of disabledOnes.slice(0, 20)) console.log(`- ${f.file}:${f.line} ${f.tag}`);
}
process.exit(offenders.length ? 1 : 0);
