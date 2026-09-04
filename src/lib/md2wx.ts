import { marked, Renderer, type Tokens } from "marked";
import type { Theme } from "./theme";

/** 把 Markdown 渲染成带内联样式的公众号 HTML */
export function renderWeixinHtml(markdown: string, theme: Theme): string {
  const s = theme.styles;
  const r = new Renderer();

  r.heading = ({ tokens, depth }: Tokens.Heading) => {
    const text = marked.parseInline(
      tokens.map((t) => t.raw).join(""),
      { renderer: r },
    ) as string;
    if (depth === 1) return `<h1 style="${s.h1}">${text}</h1>`;
    if (depth === 2)
      return `<section style="margin:34px 0 18px 0"><h2 style="${s.h2}">${text}</h2></section>`;
    return `<h3 style="${s.h3}">${text}</h3>`;
  };
  r.paragraph = ({ tokens }: Tokens.Paragraph) =>
    `<p style="${s.p}">${marked.parseInline(tokens.map((t) => t.raw).join(""), { renderer: r })}</p>`;
  r.strong = ({ tokens }: Tokens.Strong) =>
    `<strong style="${s.strong}">${marked.parseInline(tokens.map((t) => t.raw).join(""), { renderer: r })}</strong>`;
  r.em = ({ tokens }: Tokens.Em) =>
    `<em style="${s.em}">${marked.parseInline(tokens.map((t) => t.raw).join(""), { renderer: r })}</em>`;
  r.link = ({ href, tokens }: Tokens.Link) =>
    `<a href="${href}" style="${s.a}">${marked.parseInline(tokens.map((t) => t.raw).join(""), { renderer: r })}</a>`;
  r.codespan = ({ text }: Tokens.Codespan) => `<code style="${s.code}">${escapeHtml(text)}</code>`;
  r.code = ({ text }: Tokens.Code) =>
    `<pre style="${s.pre}"><code style="font-family:Menlo,Consolas,monospace;color:inherit;background:transparent">${escapeHtml(text)}</code></pre>`;
  r.blockquote = ({ tokens }: Tokens.Blockquote) =>
    `<blockquote style="${s.blockquote}">${marked.parser(tokens, { renderer: r })}</blockquote>`;
  r.list = (token: Tokens.List) => {
    const tag = token.ordered ? "ol" : "ul";
    const style = token.ordered ? s.ol : s.ul;
    const items = token.items
      .map(
        (item) =>
          `<li style="${s.li}">${marked.parser(item.tokens, { renderer: r }).replace(/^<p style="[^"]*">/, "").replace(/<\/p>\s*$/, "")}</li>`,
      )
      .join("");
    return `<${tag} style="${style}">${items}</${tag}>`;
  };
  r.image = ({ href, text }: Tokens.Image) =>
    `<img src="${href}" alt="${text ?? ""}" style="${s.img}"/>`;
  r.hr = () => `<hr style="${s.hr}"/>`;
  r.table = (token: Tokens.Table) => {
    const head = token.header
      .map((cell) => `<th style="${s.th}">${marked.parseInline(cell.text, { renderer: r })}</th>`)
      .join("");
    const body = token.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td style="${s.td}">${marked.parseInline(cell.text, { renderer: r })}</td>`).join("")}</tr>`,
      )
      .join("");
    return `<table style="${s.table}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  const body = expandContainers(markdown, theme, r);
  return `<section style="${s.container}">${body}</section>`;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 处理 :::card / :::tip / :::warn / :::divider 扩展语法 */
function expandContainers(markdown: string, theme: Theme, renderer: Renderer): string {
  const s = theme.styles;
  const lines = markdown.split("\n");
  const out: string[] = [];
  let buffer: string[] = [];
  let block: { type: string; title: string; content: string[] } | null = null;

  const flushBuffer = () => {
    if (buffer.length) {
      out.push(marked.parse(buffer.join("\n"), { renderer, async: false }) as string);
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
      const inner = marked.parse(block.content.join("\n"), { renderer, async: false }) as string;
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
