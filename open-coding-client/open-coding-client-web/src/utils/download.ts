/**
 * 导出工具：真实生成可下载文件（不以 toast 代替导出）。
 * 全部内容为本演示环境的合成数据，不含真实密钥与个人数据。
 */

/** 触发浏览器下载 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 释放对象 URL，避免内存泄漏
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 导出 JSON（自动带生成时间与演示环境声明） */
export function downloadJson(data: unknown, filename: string): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    environment: 'OpenCoding Harness Web Client（演示环境 · 全部数据为本地 Mock）',
    data,
  };
  triggerDownload(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' }), filename);
  return filename;
}

/** 导出 Markdown / 纯文本 */
export function downloadText(text: string, filename: string): string {
  triggerDownload(new Blob([text], { type: 'text/markdown;charset=utf-8' }), filename);
  return filename;
}

/** 导出 CSV（简单转义，字段含逗号/引号/换行时按 RFC4180 处理） */
export function downloadCsv(rows: (string | number)[][], filename: string): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  // 加 BOM 便于 Excel 正确识别 UTF-8
  triggerDownload(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), filename);
  return filename;
}

/** 读取本地文件为文本（导入用：真实解析，失败显式报错） */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`读取文件失败：${file.name}`));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file, 'utf-8');
  });
}

/** 解析并校验 JSON 导入包（结构缺失时抛错，不静默吞掉） */
export async function importJsonFile<T>(file: File): Promise<T> {
  const text = await readTextFile(file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`导入包不是合法 JSON：${file.name}`);
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`导入包结构不合法（应为对象）：${file.name}`);
  }
  return parsed as T;
}
