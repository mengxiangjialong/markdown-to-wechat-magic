import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderWeixinHtml } from "@/lib/md2wx";
import {
  BUILTIN_THEMES,
  loadCustomThemes,
  makeTheme,
  saveCustomThemes,
  type Theme,
  type ThemeConfig,
} from "@/lib/theme";
import { extractThemeFromZip } from "@/lib/extract-theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "md2wxarticle · Markdown 转公众号排版工具" },
      {
        name: "description",
        content:
          "左写 Markdown，右看公众号效果：内置主题、从文章 zip 提取排版样式、一键复制内联样式 HTML 粘贴到公众号后台。",
      },
      { property: "og:title", content: "md2wxarticle · Markdown 转公众号排版工具" },
      {
        property: "og:description",
        content: "左写右看、主题系统、一键复制内联样式 HTML 的公众号排版神器。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Editor,
});

const SAMPLE = `# 用 Markdown 写公众号，10 秒排完版

> 告别调格式的下午：左写 Markdown，右看公众号效果，一键复制粘贴。

## 为什么需要它

每次写完文章，最烦的就是调格式。字号、行距、颜色、编号、引用卡片、代码块缩进——每篇都要重来一遍。

- **左写右看**：375px 手机宽度实时预览
- **主题系统**：内置主题 + 从公众号文章 zip 提取样式
- **一键复制**：内联样式 HTML，粘贴即用

## 扩展语法

:::card 卡片组件
用 \`:::card 标题\` 开始，\`:::\` 结束。
:::

:::tip 小提示
图片需要在公众号后台重新上传。
:::

:::warn 注意
提取主题时请上传包含 .html 的完整 zip 包。
:::

:::divider · · ·

## 代码也能好看

\`\`\`js
const html = md2wx(markdown, theme);
copy(html); // 粘贴到公众号编辑器
\`\`\`

| 快捷键 | 功能 |
| --- | --- |
| Ctrl/Cmd + B | 加粗 |
| Ctrl/Cmd + K | 链接 |
`;

const DRAFT_KEY = "mp_tool_draft_v1";

function Editor() {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [themeId, setThemeId] = useState(BUILTIN_THEMES[0].id);
  const [status, setStatus] = useState<string>("");
  const [showThemeForm, setShowThemeForm] = useState(false);
  const [form, setForm] = useState<ThemeConfig>({
    name: "我的主题",
    primary: "#7c5cff",
    accent: "#c084fc",
    headingStyle: "gradient",
  });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomThemes(loadCustomThemes());
    const draft = window.localStorage.getItem(DRAFT_KEY);
    if (draft) setMarkdown(draft);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => window.localStorage.setItem(DRAFT_KEY, markdown), 400);
    return () => clearTimeout(t);
  }, [markdown]);

  const themes = useMemo(() => [...BUILTIN_THEMES, ...customThemes], [customThemes]);
  const theme = themes.find((t) => t.id === themeId) ?? BUILTIN_THEMES[0];
  const html = useMemo(() => {
    try {
      return renderWeixinHtml(markdown, theme);
    } catch (e) {
      return `<p>渲染出错：${(e as Error).message}</p>`;
    }
  }, [markdown, theme]);

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(""), 2200);
  };

  const surround = useCallback((before: string, after = before, placeholder = "文字") => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    setMarkdown(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }, []);

  const prefixLines = useCallback((prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const end = value.indexOf("\n", e) === -1 ? value.length : value.indexOf("\n", e);
    const block = value
      .slice(start, end)
      .split("\n")
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
      .join("\n");
    setMarkdown(value.slice(0, start) + block + value.slice(end));
    requestAnimationFrame(() => ta.focus());
  }, []);

  const onKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod && ev.key.toLowerCase() === "b") {
      ev.preventDefault();
      surround("**");
    } else if (mod && ev.key.toLowerCase() === "i") {
      ev.preventDefault();
      surround("*");
    } else if (mod && ev.key.toLowerCase() === "k") {
      ev.preventDefault();
      surround("[", "](https://)", "链接文字");
    } else if (mod && ev.shiftKey && ev.key.toLowerCase() === "k") {
      ev.preventDefault();
      const ta = ev.currentTarget;
      const v = ta.value;
      const start = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      const endIdx = v.indexOf("\n", ta.selectionStart);
      const end = endIdx === -1 ? v.length : endIdx + 1;
      setMarkdown(v.slice(0, start) + v.slice(end));
    } else if (ev.key === "Tab") {
      ev.preventDefault();
      prefixLines("  ");
    } else if (mod && ev.key === "Enter") {
      ev.preventDefault();
      const ta = ev.currentTarget;
      const v = ta.value;
      const endIdx = v.indexOf("\n", ta.selectionStart);
      const pos = endIdx === -1 ? v.length : endIdx;
      setMarkdown(v.slice(0, pos) + "\n\n" + v.slice(pos));
    }
  };

  const copyHtml = async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([html], { type: "text/plain" }),
        }),
      ]);
      flash("已复制，去公众号编辑器粘贴吧");
    } catch {
      await navigator.clipboard.writeText(html);
      flash("已复制 HTML 源码");
    }
  };

  const onZip = async (file?: File) => {
    if (!file) return;
    flash("正在解析文章样式…");
    try {
      const extracted = await extractThemeFromZip(file);
      const name = window.prompt("主题名称", extracted.name) || extracted.name;
      const t = { ...extracted, name };
      const next = [...customThemes, t];
      setCustomThemes(next);
      saveCustomThemes(next);
      setThemeId(t.id);
      flash(`已提取主题「${name}」`);
    } catch (e) {
      flash("提取失败：" + (e as Error).message);
    }
  };

  const saveForm = () => {
    const t = makeTheme(`custom-${Date.now()}`, form);
    const next = [...customThemes, t];
    setCustomThemes(next);
    saveCustomThemes(next);
    setThemeId(t.id);
    setShowThemeForm(false);
    flash("主题已保存");
  };

  const removeTheme = (id: string) => {
    const next = customThemes.filter((t) => t.id !== id);
    setCustomThemes(next);
    saveCustomThemes(next);
    if (themeId === id) setThemeId(BUILTIN_THEMES[0].id);
  };

  const toolbar: [string, () => void][] = [
    ["H2", () => prefixLines("## ")],
    ["B", () => surround("**")],
    ["I", () => surround("*")],
    ["链接", () => surround("[", "](https://)", "链接文字")],
    ["引用", () => prefixLines("> ")],
    ["列表", () => prefixLines("- ")],
    ["代码", () => surround("\n```js\n", "\n```\n", "code")],
    ["图片", () => surround("![", "](https://)", "图片说明")],
    ["卡片", () => surround("\n:::card 标题\n", "\n:::\n", "内容")],
    ["提示", () => surround("\n:::tip 小提示\n", "\n:::\n", "内容")],
    ["分隔", () => surround("\n:::divider · · ·\n", "", "")],
  ];

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <h1 className="text-base font-bold tracking-tight">
          md2wx<span className="text-primary">article</span>
        </h1>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          左写 Markdown · 右看公众号 · 一键复制
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            value={themeId}
            onChange={(e) => setThemeId(e.target.value)}
            className="rounded-md border border-border bg-card px-2 py-1.5 text-sm"
          >
            {themes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.builtin ? "" : " ·自定义"}
              </option>
            ))}
          </select>
          {!theme.builtin && (
            <button
              onClick={() => removeTheme(theme.id)}
              className="rounded-md border border-border px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent"
            >
              删除
            </button>
          )}
          <button
            onClick={() => setShowThemeForm((v) => !v)}
            className="rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            自定义主题
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
          >
            从文章 zip 提取
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => onZip(e.target.files?.[0])}
          />
          <button
            onClick={copyHtml}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            复制公众号 HTML
          </button>
        </div>
      </header>

      {showThemeForm && (
        <div className="flex flex-wrap items-end gap-3 border-b border-border bg-card px-5 py-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">名称</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-md border border-border bg-background px-2 py-1"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">主色</span>
            <input
              type="color"
              value={form.primary}
              onChange={(e) => setForm({ ...form, primary: e.target.value })}
              className="h-8 w-14 rounded-md border border-border bg-background"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">辅助色</span>
            <input
              type="color"
              value={form.accent}
              onChange={(e) => setForm({ ...form, accent: e.target.value })}
              className="h-8 w-14 rounded-md border border-border bg-background"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">标题风格</span>
            <select
              value={form.headingStyle}
              onChange={(e) =>
                setForm({ ...form, headingStyle: e.target.value as ThemeConfig["headingStyle"] })
              }
              className="rounded-md border border-border bg-background px-2 py-1"
            >
              <option value="gradient">渐变徽章</option>
              <option value="solid">纯色圆角块</option>
              <option value="bar">左侧竖条</option>
              <option value="text">渐变文字</option>
            </select>
          </label>
          <button
            onClick={saveForm}
            className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90"
          >
            保存主题
          </button>
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
        <section className="flex min-h-0 flex-col border-r border-border">
          <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
            {toolbar.map(([label, fn]) => (
              <button
                key={label}
                onClick={fn}
                className="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            ref={taRef}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-background p-5 font-mono text-sm leading-relaxed outline-none"
          />
        </section>

        <section className="min-h-0 overflow-auto bg-muted p-6">
          <div className="mx-auto w-[375px] rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </section>
      </main>

      <footer className="flex items-center gap-3 border-t border-border px-5 py-2 text-xs text-muted-foreground">
        <span>快捷键：Ctrl/Cmd + B 加粗 · I 斜体 · K 链接 · Shift+K 删除行 · Tab 缩进</span>
        <span className="ml-auto text-primary">{status}</span>
      </footer>
    </div>
  );
}
