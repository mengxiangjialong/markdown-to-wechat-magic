/**
 * 标题层级规范：
 * 1. 全文只保留一个一级标题，其余一级标题降为二级；
 * 2. 标题不能跨级（如 H2 后直接出现 H4），超出时降为「上一级 + 1」。
 * 代码围栏内的内容不处理。
 */
export function normalizeHeadings(text: string): string {
  let inFence = false;
  let seenH1 = false;
  let prev = 0;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      const m = line.match(/^(#{1,6})(\s+.*)$/);
      if (!m) return line;
      let depth = m[1]!.length;
      if (depth === 1) {
        if (seenH1) depth = 2;
        else seenH1 = true;
      }
      if (prev > 0 && depth > prev + 1) depth = prev + 1;
      if (prev === 0 && depth > 1 && !seenH1) {
        // 首个标题可以不是 H1，保持原样
      }
      prev = depth;
      return "#".repeat(depth) + m[2];
    })
    .join("\n");
}
