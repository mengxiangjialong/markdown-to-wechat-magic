import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderWeixinHtml } from "@/lib/md2wx";
import { closeUnclosedFences, normalizeClipboard } from "@/lib/paste-normalize";
import {
  BUILTIN_THEMES,
  loadCustomThemes,
  makeTheme,
  saveCustomThemes,
  type Theme,
  type ThemeConfig,
} from "@/lib/theme";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WeChat-article · Markdown 转公众号排版工具" },
      {
        name: "description",
        content:
          "左写 Markdown，右看公众号效果：内置多套主题、自定义主题、一键复制内联样式 HTML 粘贴到公众号后台。",
      },
      { property: "og:title", content: "WeChat-article · Markdown 转公众号排版工具" },
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
- **主题系统**：内置小浣熊紫 / 极客绿 / 墨水蓝 / 落日橙 / 樱花粉
- **一键复制**：内联样式 HTML，粘贴即用

## 扩展语法

:::card 卡片组件
用 \`:::card 标题\` 开始，\`:::\` 结束。
:::

:::tip 小提示
图片需要在公众号后台重新上传。
:::

:::warn 注意
切换右上角主题下拉框即可实时预览不同风格。
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
  const [themeId, setThemeId] = useState(BUILTIN_THEMES[0]!.id);
  const [status, setStatus] = useState<string>("");
  const [showThemeForm, setShowThemeForm] = useState(false);
  const [form, setForm] = useState<ThemeConfig>({
    name: "我的主题",
    primary: "#7c5cff",
    accent: "#c084fc",
    headingStyle: "gradient",
  });
  const taRef = useRef<HTMLTextAreaElement>(null);
  const undoRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const lastPushRef = useRef(0);

  const pushHistory = useCallback((prev: string) => {
    const stack = undoRef.current;
    if (stack[stack.length - 1] === prev) return;
    stack.push(prev);
    if (stack.length > 200) stack.shift();
    redoRef.current = [];
    lastPushRef.current = Date.now();
  }, []);

  const onChangeText = useCallback(
    (next: string) => {
      const now = Date.now();
      if (now - lastPushRef.current > 500) pushHistory(markdown);
      else lastPushRef.current = now;
      setMarkdown(next);
    },
    [markdown, pushHistory],
  );

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (prev === undefined) return;
    setMarkdown((cur) => {
      redoRef.current.push(cur);
      return prev;
    });
    lastPushRef.current = 0;
  }, []);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (next === undefined) return;
    setMarkdown((cur) => {
      undoRef.current.push(cur);
      return next;
    });
    lastPushRef.current = 0;
  }, []);

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
  const theme = themes.find((t) => t.id === themeId) ?? BUILTIN_THEMES[0]!;
  const html = useMemo(() => {
    try {
      return renderWeixinHtml(closeUnclosedFences(markdown), theme);
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
    const scroll = ta.scrollTop;
    const sel = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    setMarkdown(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
      ta.scrollTop = scroll;
    });
  }, []);

  const prefixLines = useCallback((prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const scroll = ta.scrollTop;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const end = value.indexOf("\n", e) === -1 ? value.length : value.indexOf("\n", e);
    const original = value.slice(start, end);
    const block = original
      .split("\n")
      .map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : prefix + l))
      .join("\n");
    const delta = block.length - original.length;
    const firstLineDelta = original.startsWith(prefix) ? -prefix.length : prefix.length;
    setMarkdown(value.slice(0, start) + block + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(Math.max(start, s + firstLineDelta), Math.max(start, e + delta));
      ta.scrollTop = scroll;
    });
  }, []);

  const setHeading = useCallback((depth: number) => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const scroll = ta.scrollTop;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const nextBreak = value.indexOf("\n", e);
    const end = nextBreak === -1 ? value.length : nextBreak;
    const original = value.slice(start, end);
    const prefix = `${"#".repeat(depth)} `;
    const block = original
      .split("\n")
      .map((line) => prefix + line.replace(/^#{1,6}\s+/, ""))
      .join("\n");
    const delta = block.length - original.length;
    setMarkdown(value.slice(0, start) + block + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, Math.max(start, e + delta));
      ta.scrollTop = scroll;
    });
  }, []);

  const setOrderedList = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    const scroll = ta.scrollTop;
    const start = value.lastIndexOf("\n", s - 1) + 1;
    const nextBreak = value.indexOf("\n", e);
    const end = nextBreak === -1 ? value.length : nextBreak;
    const original = value.slice(start, end);
    const lines = original.split("\n");
    const allOrdered = lines.every((line) => /^\s*\d+[.)]\s+/.test(line));
    const block = lines
      .map((line, index) => {
        const content = line.replace(/^\s*(?:\d+[.)]|[-+*])\s+/, "");
        return allOrdered ? content : `${index + 1}. ${content}`;
      })
      .join("\n");
    const delta = block.length - original.length;
    setMarkdown(value.slice(0, start) + block + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, Math.max(start, e + delta));
      ta.scrollTop = scroll;
    });
  }, []);

  const onPaste = useCallback((ev: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const ta = ev.currentTarget;
    const text = normalizeClipboard(ev);
    if (!text) return;
    ev.preventDefault();
    const { selectionStart: s, selectionEnd: e, value } = ta;
    setMarkdown(value.slice(0, s) + text + value.slice(e));
    const pos = s + text.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
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
    if (themeId === id) setThemeId(BUILTIN_THEMES[0]!.id);
  };

  const toolbar: [string, () => void][] = [
    ["H1", () => setHeading(1)],
    ["H2", () => setHeading(2)],
    ["H3", () => setHeading(3)],
    ["H4", () => setHeading(4)],
    ["H5", () => setHeading(5)],
    ["H6", () => setHeading(6)],
    ["B", () => surround("**")],
    ["I", () => surround("*")],
    ["链接", () => surround("[", "](https://)", "链接文字")],
    ["引用", () => prefixLines("> ")],
    ["无序列表", () => prefixLines("- ")],
    ["有序列表", setOrderedList],
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
          WeChat<span className="text-primary">-article</span>
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
            onPaste={onPaste}
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
