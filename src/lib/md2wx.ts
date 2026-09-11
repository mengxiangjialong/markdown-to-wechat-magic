import { Marked, type RendererObject, type Tokens } from "marked";
import type { Theme } from "./theme";

/** 把 Markdown 渲染成带内联样式的公众号 HTML */
export function renderWeixinHtml(markdown: string, theme: Theme): string {
  const md = createMarked(theme);
  const body = expandContainers(mergeLeadingColons(markdown), theme, md);
  return `<section style="${theme.styles.container}">${body}</section>`;
}

/** 围栏代码之外，把被换行拆开的中英文冒号接回同一行（冒号前后都不换行）。 */
function mergeLeadingColons(markdown: string): string {
  return markdown
    .split(/(```[\s\S]*?(?:```|$))/g)
    .map((segment, index) =>
      index % 2 === 1
        ? segment
        : segment
            // 「- 文字 \n - ：说明」-> 「- 文字：说明」（冒号被拆成独立列表项）
            .replace(/([^\n])[\t 　]*\n+[\t 　]*(?:[*+-]|\d+[.)])[\t 　]+(?=[：:])/g, "$1")
            // 「文字 \n ：说明」-> 「文字：说明」
            .replace(/([^\n])[\t 　]*\n+[\t 　]*(?=[：:])/g, "$1")
            // 「文字： \n 说明」-> 「文字：说明」
            .replace(/([：:])[\t 　]*\n+[\t 　]*(?=[^\s#>|*`+\-])/g, "$1"),
    )
    .join("");
}


/**
 * 基于 token 树渲染（this.parser.parseInline / this.parser.parse），
 * 不再把子 token 的 raw 拼回字符串重新解析——那样遇到自动链接、裸 URL
 * 会解析出同样的 link token 而无限递归，导致 "Maximum call stack size exceeded"。
 */
function createMarked(theme: Theme): Marked {
  const s = theme.styles;

  const renderer: RendererObject = {
    heading({ tokens, depth }: Tokens.Heading) {
      const text = this.parser.parseInline(tokens);
      if (depth === 1) return `<h1 style="${s.h1}">${text}</h1>`;
      if (depth === 2)
        return `<section style="margin:34px 0 18px 0"><h2 style="${s.h2}">${text}</h2></section>`;
      return `<h3 style="${s.h3}">${text}</h3>`;
    },
    paragraph({ tokens }: Tokens.Paragraph) {
      return `<p style="${s.p}">${this.parser.parseInline(tokens)}</p>`;
    },
    strong({ tokens }: Tokens.Strong) {
      return `<strong style="${s.strong}">${this.parser.parseInline(tokens)}</strong>`;
    },
    em({ tokens }: Tokens.Em) {
      return `<em style="${s.em}">${this.parser.parseInline(tokens)}</em>`;
    },
    link({ href, tokens }: Tokens.Link) {
      return `<a href="${escapeHtml(href)}" style="${s.a}">${this.parser.parseInline(tokens)}</a>`;
    },
    /**
     * 公众号编辑器会把「行内元素后面紧跟的裸文字」提升成独立块，导致
     * 「**线程池**：实现简单」被拆成两行。给每段裸文字包一个带 style 的
     * span（无属性的 span 会被编辑器剥掉），强制留在同一行。
     */
    text(token: Tokens.Text | Tokens.Escape) {
      const inner =
        "tokens" in token && token.tokens?.length
          ? this.parser.parseInline(token.tokens)
          : (token as Tokens.Text).text;
      if (!inner) return "";
      return `<span style="display:inline;white-space:normal">${inner}</span>`;
    },
    codespan({ text }: Tokens.Codespan) {
      return `<code style="${s.code}">${escapeHtml(text)}</code>`;
    },
    code({ text }: Tokens.Code) {
      return `<pre style="${s.pre}"><code style="font-family:Menlo,Consolas,monospace;color:inherit;background:transparent">${escapeHtml(text)}</code></pre>`;
    },
    blockquote({ tokens }: Tokens.Blockquote) {
      return `<blockquote style="${s.blockquote}">${this.parser.parse(tokens)}</blockquote>`;
    },
    /**
     * 公众号编辑器粘贴 <ul>/<li> 时会把列表项里的 <strong>、冒号、说明文字拆成多行。
     * 这里不再输出原生列表，而是每个条目渲染成一个 section：
     * 项目符号用负外边距挂在左侧，条目正文整体包在一个 span 里，保证同一行不被拆开。
     */
    list(token: Tokens.List) {
      const style = token.ordered ? s.ol : s.ul;
      const start = typeof token.start === "number" ? token.start : 1;
      const items = token.items
        .map((item, index) => {
          const marker = token.ordered ? `${start + index}.` : "•";
          // 首个 block 的内联内容作为条目正文，其余（嵌套列表、多段落等）跟在后面
          const [first, ...rest] = item.tokens;
          const firstHtml =
            first && (first.type === "paragraph" || first.type === "text")
              ? this.parser.parseInline((first as Tokens.Paragraph).tokens ?? [])
              : first
                ? this.parser.parse([first])
                : "";
          const restHtml = rest.length ? this.parser.parse(rest) : "";
          return (
            `<section style="${s.li}">` +
            `<span style="${s.liMarker}">${marker}</span>` +
            `<span style="display:inline;white-space:normal">${firstHtml}</span>` +
            restHtml +
            `</section>`
          );
        })
        .join("");
      return `<section style="${style}">${items}</section>`;
    },
    image({ href, text }: Tokens.Image) {
      return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text ?? "")}" style="${s.img}"/>`;
    },
    hr() {
      return `<hr style="${s.hr}"/>`;
    },
    table(token: Tokens.Table) {
      const head = token.header
        .map((cell) => `<th style="${s.th}">${this.parser.parseInline(cell.tokens)}</th>`)
        .join("");
      const body = token.rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell) => `<td style="${s.td}">${this.parser.parseInline(cell.tokens)}</td>`)
              .join("")}</tr>`,
        )
        .join("");
      return `<table style="${s.table}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    },
  };

  return new Marked({ renderer, gfm: true, breaks: false });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 处理 :::card / :::tip / :::warn / :::divider 扩展语法 */
function expandContainers(markdown: string, theme: Theme, md: Marked): string {
  const s = theme.styles;
  const lines = markdown.split("\n");
  const out: string[] = [];
  let buffer: string[] = [];
  let block: { type: string; title: string; content: string[] } | null = null;

  const parse = (src: string) => md.parse(src, { async: false }) as string;

  const flushBuffer = () => {
    if (buffer.length) {
      out.push(parse(buffer.join("\n")));
      buffer = [];
    }
  };

  for (const line of lines) {
    const open = line.match(/^:::\s*(card|tip|warn|divider)\s*(.*)$/);
    if (!block && open) {
      flushBuffer();
      block = { type: open[1]!, title: open[2]!.trim(), content: [] };
      if (open[1] === "divider") {
        out.push(`<section style="${s.divider}">${escapeHtml(open[2]!.trim() || "· · ·")}</section>`);
        block = null;
      }
      continue;
    }
    if (block && /^:::\s*$/.test(line)) {
      const inner = parse(block.content.join("\n"));
      const style = block.type === "card" ? s.card : block.type === "tip" ? s.tip : s.warn;
      const title = block.title
        ? `<section style="${s.cardTitle}">${escapeHtml(block.title)}</section>`
        : "";
      out.push(`<section style="${style}">${title}${inner}</section>`);
      block = null;
      continue;
    }
    if (block) block.content.push(line);
    else buffer.push(line);
  }
  if (block) buffer.push(...block.content);
  flushBuffer();
  return out.join("");
}
