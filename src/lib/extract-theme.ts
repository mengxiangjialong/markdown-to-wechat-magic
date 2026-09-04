import JSZip from "jszip";
import { buildStyles, makeTheme, type Styles, type Theme } from "./theme";

/**
 * 从公众号文章 zip 包中提取排版「样式指纹」并生成主题。
 * 不只是取颜色套模板：直接复用原文标题 / 正文 / 引用 / 代码块的完整 style。
 */
export async function extractThemeFromZip(file: File, name?: string): Promise<Theme> {
  const zip = await JSZip.loadAsync(file);
  const htmlEntry = Object.values(zip.files).find(
    (f) => !f.dir && /\.html?$/i.test(f.name) && !f.name.startsWith("__MACOSX"),
  );
  if (!htmlEntry) throw new Error("压缩包里没有找到 .html 文章文件");

  const html = await htmlEntry.async("string");
  const doc = new DOMParser().parseFromString(html, "text/html");
  const content =
    doc.querySelector("#js_content") ??
    doc.querySelector(".rich_media_content") ??
    doc.body;
  if (!content) throw new Error("没能定位到文章正文");

  const themeName =
    name?.trim() ||
    (doc.querySelector("#activity-name")?.textContent || "").trim().slice(0, 12) ||
    htmlEntry.name.replace(/\.html?$/i, "").slice(0, 12) ||
    "提取的主题";

  const styleOf = (el: Element | null | undefined) =>
    (el?.getAttribute("style") || "").replace(/\s+/g, " ").trim().replace(/;$/, "");

  // 标题：h2 或被当作标题使用的 section/p（有背景、有加粗、字号更大）
  const headingEl =
    content.querySelector("h2[style]") ??
    content.querySelector("h1[style]") ??
    Array.from(content.querySelectorAll("section[style],p[style]")).find((el) => {
      const st = styleOf(el);
      return (
        /background(-image|-color)?\s*:/.test(st) &&
        /(font-weight\s*:\s*(bold|[6-9]00))|border-left/.test(st) &&
        (el.textContent || "").trim().length < 40
      );
    }) ??
    null;

  const paraEl =
    Array.from(content.querySelectorAll("p[style]")).find(
      (el) => (el.textContent || "").trim().length > 20,
    ) ?? null;
  const quoteEl = content.querySelector("blockquote[style]");
  const preEl = content.querySelector("pre[style],code[style]");
  const strongEl = content.querySelector("strong[style],span[style] strong");
  const linkEl = content.querySelector("a[style]");

  const headingStyleStr = styleOf(headingEl);
  const paraStyleStr = styleOf(paraEl);

  const primary =
    pickColor(headingStyleStr, ["background", "border-left", "color"]) ||
    pickColor(styleOf(strongEl), ["color"]) ||
    "#7c5cff";
  const accent =
    secondGradientColor(headingStyleStr) || pickColor(styleOf(linkEl), ["color"]) || primary;

  const fontSize = numFrom(paraStyleStr, /font-size\s*:\s*([\d.]+)px/) ?? 15;
  const lineHeight = numFrom(paraStyleStr, /line-height\s*:\s*([\d.]+)/) ?? 1.85;
  const textColor = pickColor(paraStyleStr, ["color"]) || "#3f3f46";
  const headingStyle: Theme["headingStyle"] = /linear-gradient/.test(headingStyleStr)
    ? /background-clip\s*:\s*text/.test(headingStyleStr)
      ? "text"
      : "gradient"
    : /border-left/.test(headingStyleStr)
      ? "bar"
      : /background/.test(headingStyleStr)
        ? "solid"
        : "bar";

  // 先按提取到的参数生成基线主题，再用原文的完整 style 覆盖对应元素（样式指纹复用）
  const base = buildStyles({
    name: themeName,
    primary,
    accent,
    headingStyle,
    fontSize,
    lineHeight,
    textColor,
  });
  const styles: Styles = { ...base };
  if (headingStyleStr) {
    styles.h2 = headingStyleStr;
    styles.h3 = mergeStyle(base.h3, `color:${primary}`);
  }
  if (paraStyleStr) styles.p = paraStyleStr;
  if (styleOf(quoteEl)) styles.blockquote = styleOf(quoteEl);
  if (styleOf(preEl)) styles.pre = styleOf(preEl);
  if (styleOf(strongEl)) styles.strong = styleOf(strongEl);
  if (styleOf(linkEl)) styles.a = styleOf(linkEl);
  if (paraStyleStr) styles.li = mergeStyle(base.li, paraStyleStr);

  const theme = makeTheme(`zip-${Date.now()}`, {
    name: themeName,
    primary,
    accent,
    headingStyle,
    fontSize,
    lineHeight,
    textColor,
  });
  return { ...theme, styles };
}

function mergeStyle(a: string, b: string) {
  return [a, b].filter(Boolean).join(";");
}

function numFrom(style: string, re: RegExp): number | undefined {
  const m = style.match(re);
  return m ? Number(m[1]) : undefined;
}

function pickColor(style: string, props: string[]): string | undefined {
  for (const p of props) {
    const re = new RegExp(`${p}[^;:]*:\\s*([^;]+)`, "i");
    const m = style.match(re);
    const c = m && firstColor(m[1]!);
    if (c) return c;
  }
  return undefined;
}

function firstColor(chunk: string): string | undefined {
  const hex = chunk.match(/#[0-9a-fA-F]{3,8}/);
  if (hex) return normalizeHex(hex[0]);
  const rgb = chunk.match(/rgba?\(([^)]+)\)/);
  if (rgb) {
    const [r, g, b] = rgb[1]!.split(",").map((v) => Number(v.trim()));
    if ([r, g, b].every((v) => Number.isFinite(v)))
      return "#" + [r, g, b].map((v) => v!.toString(16).padStart(2, "0")).join("");
  }
  return undefined;
}

function normalizeHex(hex: string) {
  if (hex.length === 4)
    return "#" + hex.slice(1).split("").map((ch) => ch + ch).join("");
  return hex.slice(0, 7);
}

function secondGradientColor(style: string): string | undefined {
  const g = style.match(/linear-gradient\(([^)]+)\)/);
  if (!g) return undefined;
  const colors = g[1]!.match(/#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
  if (colors && colors.length > 1) return firstColor(colors[colors.length - 1]!);
  return undefined;
}
