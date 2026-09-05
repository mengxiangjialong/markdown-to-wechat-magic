import { Marked, type RendererObject, type Tokens } from "marked";
import type { Theme } from "./theme";

/** 把 Markdown 渲染成带内联样式的公众号 HTML */
export function renderWeixinHtml(markdown: string, theme: Theme): string {
  const md = createMarked(theme);
  const body = expandContainers(markdown, theme, md);
  return `<section style="${theme.styles.container}">${body}</section>`;
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
    codespan({ text }: Tokens.Codespan) {
      return `<code style="${s.code}">${escapeHtml(text)}</code>`;
    },
    code({ text }: Tokens.Code) {
      return `<pre style="${s.pre}"><code style="font-family:Menlo,Consolas,monospace;color:inherit;background:transparent">${escapeHtml(text)}</code></pre>`;
    },
    blockquote({ tokens }: Tokens.Blockquote) {
      return `<blockquote style="${s.blockquote}">${this.parser.parse(tokens)}</blockquote>`;
    },
    list(token: Tokens.List) {
      const tag = token.ordered ? "ol" : "ul";
      const style = token.ordered ? s.ol : s.ul;
      const items = token.items
        .map((item) => {
          const inner = this.parser
            .parse(item.tokens)
            .replace(/^<p style="[^"]*">/, "")
            .replace(/<\/p>\s*$/, "");
          return `<li style="${s.li}">${inner}</li>`;
        })
        .join("");
      return `<${tag} style="${style}">${items}</${tag}>`;
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
