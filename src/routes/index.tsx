import { Copy, Check, FilePenLine, Smartphone, Palette, Trash2, Plus, CircleCheck, PencilLine, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditorToolbar, ToolButton } from "@/components/editor-toolbar";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { renderWeixinHtml } from "@/lib/md2wx";
import { normalizeHeadings } from "@/lib/headings";
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
  const [mobilePane, setMobilePane] = useState<"editor" | "preview">("editor");
  const [customThemes, setCustomThemes] = useState<Theme[]>([]);
  const [themeId, setThemeId] = useState(BUILTIN_THEMES[0]?.id ?? "raccoon-purple");
  const [status, setStatus] = useState<string>("");
  const [showThemeForm, setShowThemeForm] = useState(false);
  const [form, setForm] = useState<ThemeConfig>({
    name: "我的主题",
    primary: "#7c5cff",
    accent: "#c084fc",
    headingStyle: "gradient",
  });
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const taRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
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

  const syncPreviewScroll = useCallback(() => {
    const editor = taRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const editorRange = editor.scrollHeight - editor.clientHeight;
    const previewRange = preview.scrollHeight - preview.clientHeight;
    preview.scrollTop = editorRange > 0 ? (editor.scrollTop / editorRange) * previewRange : 0;
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

  const charCount = useMemo(() => markdown.replace(/\s/g, "").length, [markdown]);
  const themes = useMemo(() => [...BUILTIN_THEMES, ...customThemes], [customThemes]);
  const theme = themes.find((t) => t.id === themeId) ?? BUILTIN_THEMES[0];
  const html = useMemo(() => {
    try {
      if (!theme) return "";
      let out = renderWeixinHtml(normalizeHeadings(closeUnclosedFences(markdown)), theme);
      for (const [id, url] of Object.entries(localImages)) {
        out = out.split(`"local-file:${id}"`).join(`"${url}" download target="_blank" rel="noopener"`);
        out = out.split(`local-image:${id}`).join(url);
      }
      return out;
    } catch (e) {
      return `<p>渲染出错：${(e as Error).message}</p>`;
    }
  }, [markdown, theme, localImages]);

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadImages = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) {
        const id = String(Date.now() + Math.floor(Math.random() * 1000));
        setLocalImages((m) => ({ ...m, [id]: URL.createObjectURL(f) }));
        const name = f.name.replace(/[\[\]()]/g, "");
        const kb = f.size >= 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`;
        const md = `\n[📎 ${name}（${kb}）](local-file:${id})\n`;
        const pos = taRef.current ? taRef.current.selectionEnd : markdown.length;
        setMarkdown((v) => v.slice(0, pos) + md + v.slice(pos));
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        const id = String(Date.now() + Math.floor(Math.random() * 1000));
        setLocalImages((m) => ({ ...m, [id]: String(r.result) }));
        const ta = taRef.current;
        const name = f.name.replace(/\.[^.]+$/, "").replace(/[\[\]()]/g, "");
        const md = `\n![${name}](local-image:${id})\n`;
        const pos = ta ? ta.selectionEnd : markdown.length;
        setMarkdown((v) => v.slice(0, pos) + md + v.slice(pos));
      };
      r.readAsDataURL(f);
    });
    if (fileRef.current) fileRef.current.value = "";
  };

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
    pushHistory(value);
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
    pushHistory(value);
    setMarkdown(value.slice(0, start) + block + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(Math.max(start, s + firstLineDelta), Math.max(start, e + delta));
      ta.scrollTop = scroll;
    });
  }, [pushHistory]);

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
    pushHistory(value);
    const raw = value.slice(0, start) + block + value.slice(end);
    const fixed = normalizeHeadings(raw);
    if (fixed !== raw) flash("已自动调整：全文仅允许一个一级标题，且标题不可跨级");
    setMarkdown(fixed);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, Math.max(start, e + delta));
      ta.scrollTop = scroll;
    });
  }, [pushHistory]);

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
    pushHistory(value);
    setMarkdown(value.slice(0, start) + block + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, Math.max(start, e + delta));
      ta.scrollTop = scroll;
    });
  }, [pushHistory]);

  const onPaste = useCallback((ev: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const ta = ev.currentTarget;
    const text = normalizeClipboard(ev);
    if (!text) return;
    ev.preventDefault();
    const { selectionStart: s, selectionEnd: e, value } = ta;
    pushHistory(value);
    setMarkdown(normalizeHeadings(value.slice(0, s) + text + value.slice(e)));
    const pos = s + text.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(pos, pos);
    });
  }, [pushHistory]);

  const continueList = useCallback(
    (ta: HTMLTextAreaElement) => {
      const { selectionStart, selectionEnd, value } = ta;
      if (selectionStart !== selectionEnd) return false;

      const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
      const lineEnd = value.indexOf("\n", selectionStart);
      const end = lineEnd === -1 ? value.length : lineEnd;
      const line = value.slice(lineStart, end);
      const ordered = line.match(/^(\s*)(\d+)([.)])\s+(.*)$/);
      const unordered = line.match(/^(\s*)([-+*])\s+(.*)$/);

      if (!ordered && !unordered) return false;

      pushHistory(value);
      if (ordered) {
        const [, indent, number, marker, content] = ordered;
        if (!content?.trim()) {
          const extraBreak = lineEnd === -1 ? "\n" : "";
          setMarkdown(value.slice(0, lineStart) + extraBreak + value.slice(end));
          const caret = lineStart + extraBreak.length;
          requestAnimationFrame(() => ta.setSelectionRange(caret, caret));
          return true;
        }
        const nextMarker = `\n${indent}${Number(number) + 1}${marker} `;
        setMarkdown(value.slice(0, selectionStart) + nextMarker + value.slice(selectionStart));
        requestAnimationFrame(() =>
          ta.setSelectionRange(selectionStart + nextMarker.length, selectionStart + nextMarker.length),
        );
        return true;
      }

      if (!unordered) return false;
      const [, indent, marker, content] = unordered;
      if (!content?.trim()) {
        const extraBreak = lineEnd === -1 ? "\n" : "";
        setMarkdown(value.slice(0, lineStart) + extraBreak + value.slice(end));
        const caret = lineStart + extraBreak.length;
        requestAnimationFrame(() => ta.setSelectionRange(caret, caret));
        return true;
      }
      const nextMarker = `\n${indent}${marker} `;
      setMarkdown(value.slice(0, selectionStart) + nextMarker + value.slice(selectionStart));
      requestAnimationFrame(() =>
        ta.setSelectionRange(selectionStart + nextMarker.length, selectionStart + nextMarker.length),
      );
      return true;
    },
    [pushHistory],
  );


  const onKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = ev.metaKey || ev.ctrlKey;
    const key = ev.key.toLowerCase();
    if (!mod && key === "enter" && continueList(ev.currentTarget)) {
      ev.preventDefault();
    } else if (mod && key === "z") {
      ev.preventDefault();
      if (ev.shiftKey) redo();
      else undo();
    } else if (mod && key === "y") {
      ev.preventDefault();
      redo();
    } else if (mod && key === "b") {
      ev.preventDefault();
      surround("**");
    } else if (mod && key === "i") {
      ev.preventDefault();
      surround("*");
    } else if (mod && ev.shiftKey && key === "k") {
      ev.preventDefault();
      const ta = ev.currentTarget;
      const v = ta.value;
      const start = v.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      const endIdx = v.indexOf("\n", ta.selectionStart);
      const end = endIdx === -1 ? v.length : endIdx + 1;
      pushHistory(v);
      setMarkdown(v.slice(0, start) + v.slice(end));
    } else if (mod && key === "k") {
      ev.preventDefault();
      surround("[", "](https://)", "链接文字");
    } else if (ev.key === "Tab") {
      ev.preventDefault();
      prefixLines("  ");
    } else if (mod && ev.key === "Enter") {
      ev.preventDefault();
      const ta = ev.currentTarget;
      const v = ta.value;
      const endIdx = v.indexOf("\n", ta.selectionStart);
      const pos = endIdx === -1 ? v.length : endIdx;
      pushHistory(v);
      setMarkdown(v.slice(0, pos) + "\n\n" + v.slice(pos));
    }
  };

  const copyHtml = async () => {
    const plainText = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
    const copyWithEvent = () => {
      const onCopy = (event: ClipboardEvent) => {
        if (!event.clipboardData) return;
        event.preventDefault();
        event.clipboardData.setData("text/html", html);
        event.clipboardData.setData("text/plain", plainText);
      };
      document.addEventListener("copy", onCopy);
      try {
        return document.execCommand("copy");
      } finally {
        document.removeEventListener("copy", onCopy);
      }
    };
    try {
      // 富文本目标读取内联样式 HTML，纯文本目标只读取文章文字，而非源码。
      if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([plainText], { type: "text/plain" }),
            }),
          ]);
        } catch {
          if (!copyWithEvent()) throw new Error("Clipboard copy failed");
        }
      } else if (!copyWithEvent()) {
        throw new Error("Clipboard copy unavailable");
      }
      flash("已复制，去公众号编辑器粘贴吧");
    } catch {
      flash("复制失败，请手动全选复制");
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
    if (themeId === id) setThemeId(BUILTIN_THEMES[0]?.id ?? "raccoon-purple");
  };

  const toolbar: [string, () => void][] = [
    ["B", () => surround("**")],
    ["I", () => surround("*")],
    ["链接", () => surround("[", "](https://)", "链接文字")],
    ["引用", () => prefixLines("> ")],
    ["代码", () => surround("\n```js\n", "\n```\n", "code")],
    ["图片", () => surround("![", "](https://)", "图片说明")],
    ["上传附件", () => fileRef.current?.click()],
    ["卡片", () => surround("\n:::card 标题\n", "\n:::\n", "内容")],
    ["提示", () => surround("\n:::tip 小提示\n", "\n:::\n", "内容")],
    ["分隔", () => surround("\n:::divider · · ·\n", "", "")],
  ];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="writing-workspace">
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => uploadImages(e.target.files)} />
        <header className="workspace-header">
          <div className="flex min-w-0 items-center gap-3">
            <span className="brand-symbol"><FilePenLine className="size-5" /></span>
            <h1 className="text-lg font-semibold">WeChat-article</h1>
            <span className="workspace-category">公众号排版</span>
          </div>
          <Button onClick={copyHtml} className="copy-button">
            {status.startsWith("已复制") ? <Check /> : <Copy />}<span>复制 HTML</span>
          </Button>
        </header>

        <div className="mobile-view-switch" role="group" aria-label="工作区视图">
          <Button variant={mobilePane === "editor" ? "secondary" : "ghost"} aria-pressed={mobilePane === "editor"} onClick={() => setMobilePane("editor")}><PencilLine />编辑</Button>
          <Button variant={mobilePane === "preview" ? "secondary" : "ghost"} aria-pressed={mobilePane === "preview"} onClick={() => setMobilePane("preview")}><Eye />预览</Button>
        </div>

        <main className="workspace-main" data-mobile-pane={mobilePane}>
          <section className="editor-pane" aria-label="Markdown 编辑区">
            <div className="pane-heading">
              <div className="flex items-center gap-2"><PencilLine className="size-4 text-muted-foreground" /><h2 className="text-sm font-semibold">Markdown 编辑</h2></div>
              <span className="pane-meta">.md</span>
            </div>
            <EditorToolbar tools={toolbar} undo={undo} redo={redo} setHeading={setHeading} setUnorderedList={() => prefixLines("- ")} setOrderedList={setOrderedList} />
            <textarea
              aria-label="Markdown 文章"
              ref={taRef}
              value={markdown}
              wrap="soft"
              onScroll={syncPreviewScroll}
              onChange={(e) => onChangeText(e.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              spellCheck={false}
              className="markdown-input"
            />
          </section>

          <section className="preview-pane" aria-label="公众号预览区">
            <div className="pane-heading">
              <div className="flex items-center gap-2"><Eye className="size-4 text-muted-foreground" /><h2 className="text-sm font-semibold">公众号预览</h2></div>
              <span className="pane-meta flex items-center gap-1.5"><Smartphone className="size-3.5" />375 px</span>
            </div>
            <div className="preview-controls">
              <Palette className="size-4 shrink-0 text-muted-foreground" />
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger aria-label="文章主题" className="theme-select h-8 w-[126px] min-w-0 shrink-0 bg-card text-xs shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {themes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.builtin ? "" : " ·自定义"}</SelectItem>)}
                </SelectContent>
              </Select>
              {theme && !theme.builtin && <ToolButton label="删除主题" icon={Trash2} onClick={() => removeTheme(theme.id)} />}
              <Button variant="ghost" size="sm" className="theme-form-toggle shrink-0 px-2 text-xs text-muted-foreground" aria-expanded={showThemeForm} onClick={() => setShowThemeForm((v) => !v)}><Plus />自定义</Button>
            </div>
            {showThemeForm && (
              <form className="theme-form" onSubmit={(event) => { event.preventDefault(); saveForm(); }}>
                <label className="theme-name"><span>主题名称</span><input aria-label="主题名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
                <div className="flex items-end gap-3">
                  <label><span>主色</span><input aria-label="主色" type="color" value={form.primary} onChange={(e) => setForm({ ...form, primary: e.target.value })} /></label>
                  <label><span>辅助色</span><input aria-label="辅助色" type="color" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })} /></label>
                  <label className="min-w-0 flex-1"><span>标题风格</span>
                    <Select value={form.headingStyle} onValueChange={(value) => setForm({ ...form, headingStyle: value as ThemeConfig["headingStyle"] })}>
                      <SelectTrigger aria-label="标题风格" className="h-8 bg-card text-xs shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="gradient">渐变徽章</SelectItem><SelectItem value="solid">纯色圆角块</SelectItem><SelectItem value="bar">左侧竖条</SelectItem><SelectItem value="text">渐变文字</SelectItem></SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="flex justify-end gap-2"><Button type="button" variant="ghost" size="sm" onClick={() => setShowThemeForm(false)}>取消</Button><Button type="submit" size="sm">保存主题</Button></div>
              </form>
            )}
            <div ref={previewRef} className="preview-scroll">
              <div className="article-paper"><div dangerouslySetInnerHTML={{ __html: html }} /></div>
            </div>
          </section>
        </main>

        <footer className="workspace-footer">
          <span className="flex items-center gap-1.5"><CircleCheck className="size-3.5 text-primary" />本地草稿</span>
          <span role="status" className="workspace-status">{status}</span>
          <span className="word-count">共 <strong>{charCount.toLocaleString()}</strong> 字</span>
        </footer>
      </div>
    </TooltipProvider>
  );
}
