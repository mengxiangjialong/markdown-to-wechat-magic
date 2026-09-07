/**
 * 粘贴内容规范化：
 * 1. HTML 表格 -> Markdown 表格
 * 2. 「1、」「一、」-> 二级标题；「1.1」-> 三级标题；「1.1.1」-> 四级标题
 * 3. 修复复制导致的异常换行（把被拆开的一句话合并回去）
 * 4. 代码片段自动包裹 ``` 围栏
 */

const CN_NUM = "零一二三四五六七八九十百";

/** 把 HTML 里的表格转成 Markdown 表格，其它内容取纯文本 */
export function htmlToMarkdown(html: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("style,script").forEach((n) => n.remove());

  doc.querySelectorAll("table").forEach((table) => {
    const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((c) =>
        (c.textContent ?? "").replace(/\s+/g, " ").replace(/\|/g, "\\|").trim(),
      ),
    );
    if (!rows.length) return;
    const cols = Math.max(...rows.map((r) => r.length));
    const pad = (r: string[]) => {
      const copy = [...r];
      while (copy.length < cols) copy.push("");
      return copy;
    };
    const [head, ...body] = rows;
    const lines = [
      `| ${pad(head!).join(" | ")} |`,
      `| ${Array(cols).fill("---").join(" | ")} |`,
      ...body.map((r) => `| ${pad(r).join(" | ")} |`),
    ];
    const holder = doc.createElement("p");
    holder.textContent = `\n\n${lines.join("\n")}\n\n`;
    table.replaceWith(holder);
  });

  doc.querySelectorAll("br").forEach((br) => br.replaceWith(doc.createTextNode("\n")));
  doc
    .querySelectorAll("p,div,li,h1,h2,h3,h4,h5,h6,tr,pre,section")
    .forEach((el) => el.append(doc.createTextNode("\n")));

  return (doc.body.textContent ?? "").replace(/\u00a0/g, " ");
}

/** 合并被复制工具拆开的换行：下一行以标点或补语开头时，接回上一行 */
function mergeBrokenLines(lines: string[]): string[] {
  const out: string[] = [];
  const startsWithPunct = (l: string) => /^[：:，,。、；;）】」』%》?？!！]/.test(l);
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const prev = out.length ? out[out.length - 1]! : "";
    if (line.trim() === "") {
      if (prev !== "") out.push("");
      continue;
    }
    // 代码行（含括号收尾、缩进、注释）不参与合并，避免破坏代码块
    if (!startsWithPunct(line.trim()) && (isCodeish(line) || isCodeish(prev))) {
      out.push(line);
      continue;
    }
    if (startsWithPunct(line.trim())) {
      // 回溯到最近一行非空文本并接上去
      while (out.length && out[out.length - 1] === "") out.pop();
      if (out.length && !/^```/.test(out[out.length - 1]!)) {
        out[out.length - 1] = out[out.length - 1]! + line.trim();
        continue;
      }
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

/** 序号 -> 标题层级 */
function toHeading(line: string): string | null {
  const t = line.trim();
  if (/^#{1,6}\s/.test(t)) return t;
  // 1.1.1 / 1.1 形式
  const dotted = t.match(/^(\d+(?:\.\d+)+)[、.．]?[\s　]+(.+)$/);
  if (dotted) {
    const depth = dotted[1]!.split(".").length; // 2 -> h3, 3 -> h4
    return `${"#".repeat(Math.min(depth + 1, 6))} ${dotted[1]} ${dotted[2]!.trim()}`;
  }
  // 1、 1. 1） 形式
  const arabic = t.match(/^(\d+)[、.．)）][\s　]*(.+)$/);
  if (arabic && arabic[2]!.length <= 40) return `## ${arabic[1]}、${arabic[2]!.trim()}`;
  // 一、 二、 形式
  const cn = t.match(new RegExp(`^([${CN_NUM}]{1,3})[、.．)）][\\s　]*(.+)$`));
  if (cn && cn[2]!.length <= 40) return `## ${cn[1]}、${cn[2]!.trim()}`;
  return null;
}

const CODE_HINT =
  /^(\s{2,}|\t|[$>] |npm |yarn |pnpm |bun |pip |curl |git |from |import |export |const |let |var |function |class |def |public |private |return |if [({]|for [({]|<\/?[a-z]|[\w.]+\(.*\)[;,]?$|[\w.[\]"']+\s*=\s*.+$)/;
const ENV_LINE = /^[A-Z][A-Z0-9_]{2,}\s*=/;
/** 代码块内部的延续行：括号收尾、注释、字符串项、以逗号/开括号结尾 */
const CODE_CONT = /^([)\]}][;,)\]}]*$|#\s|\/\/|["'`].*[,:]?$|.*[,({[]$|@\w)/;

/** 该行看起来像代码（用于起始判断） */
function isCodeish(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  if (/^#/.test(t)) return false;
  return ENV_LINE.test(t) || CODE_HINT.test(line);
}

/** 该行可以留在代码块内部 */
function isCodeCont(line: string): boolean {
  const t = line.trim();
  if (t === "") return false;
  return isCodeish(line) || CODE_CONT.test(t);
}

/** 连续的代码行自动加围栏（空行不会打断代码块） */
function fenceCodeBlocks(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  let inFence = false;
  while (i < lines.length) {
    const line = lines[i]!;
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      out.push(line);
      i++;
      continue;
    }
    if (inFence) {
      out.push(line);
      i++;
      continue;
    }
    if (isCodeish(line)) {
      const block: string[] = [];
      while (i < lines.length) {
        const cur = lines[i]!;
        if (cur.trim() === "") {
          // 向前看：后面若仍是代码，保留空行继续同一个代码块
          let j = i + 1;
          while (j < lines.length && lines[j]!.trim() === "") j++;
          if (j < lines.length && isCodeCont(lines[j]!) && !/^```/.test(lines[j]!.trim())) {
            i = j;
            continue;
          }
          break;
        }
        if (/^```/.test(cur.trim())) break;
        if (!isCodeCont(cur)) break;
        block.push(cur.replace(/\s+$/, ""));
        i++;
      }
      while (block.length && block[block.length - 1] === "") block.pop();
      if (block.length) {
        out.push("", `\`\`\`env`, ...block, "```", "");
        continue;
      }
    }
    out.push(line);
    i++;
  }
  // 围栏未闭合时自动补上结尾
  if (inFence) out.push("```");
  return out;
}

/** 全文围栏配平：奇数个 ``` 时补一个结尾 */
export function closeUnclosedFences(text: string): string {
  const count = text.split("\n").filter((l) => /^\s*```/.test(l)).length;
  if (count % 2 === 0) return text;
  return `${text.replace(/\s*$/, "")}\n\`\`\`\n`;
}

/** 主入口：把粘贴文本规范化为 Markdown */
export function normalizePastedText(text: string): string {
  const raw = text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\u00a0/g, " ");
  let lines = mergeBrokenLines(raw.split("\n"));
  lines = lines.map((l) => {
    if (/^\s/.test(l) || /^```/.test(l.trim())) return l;
    return toHeading(l) ?? l;
  });
  lines = fenceCodeBlocks(lines);
  // 标题前后留空行
  const spaced: string[] = [];
  for (const l of lines) {
    if (/^#{1,6}\s/.test(l) && spaced.length && spaced[spaced.length - 1] !== "") spaced.push("");
    spaced.push(l);
  }
  const joined = spaced.join("\n").replace(/\n{3,}/g, "\n\n");
  return closeUnclosedFences(mergePunctOutsideFences(joined)).replace(/\n{3,}/g, "\n\n");
}

/** 兜底：围栏之外，行首标点接回上一行；冒号结尾的行也接住下一行 */
function mergePunctOutsideFences(text: string): string {
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((seg, idx) =>
      idx % 2 === 1
        ? seg
        : seg
            .replace(/([^\n])\n+[ \t　]*(?=[：:，,。、；;）】」』%》?？!！])/g, "$1")
            .replace(/([：:])[ \t　]*\n+[ \t　]*(?=[^\s#>|*`+\-])/g, "$1"),
    )
    .join("");
}


/** 从剪贴板事件里取出规范化后的 Markdown */
export function normalizeClipboard(e: ClipboardEvent | React.ClipboardEvent): string {
  const dt = (e as React.ClipboardEvent).clipboardData as DataTransfer;
  const html = dt.getData("text/html");
  const plain = dt.getData("text/plain");
  const source = html && /<table[\s>]/i.test(html) ? htmlToMarkdown(html) : plain;
  return normalizePastedText(source || plain);
}
