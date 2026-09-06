export type StyleKey =
  | "container"
  | "h1"
  | "h2"
  | "h3"
  | "p"
  | "strong"
  | "em"
  | "a"
  | "ul"
  | "ol"
  | "li"
  | "blockquote"
  | "code"
  | "pre"
  | "img"
  | "hr"
  | "table"
  | "th"
  | "td"
  | "card"
  | "cardTitle"
  | "tip"
  | "warn"
  | "divider";

export type Styles = Record<StyleKey, string>;

export interface Theme {
  id: string;
  name: string;
  builtin?: boolean;
  primary: string;
  accent: string;
  headingStyle: "gradient" | "solid" | "bar" | "text";
  styles: Styles;
}

export interface ThemeConfig {
  name: string;
  primary: string;
  accent: string;
  headingStyle: Theme["headingStyle"];
  fontSize?: number;
  lineHeight?: number;
  textColor?: string;
}

const css = (o: Record<string, string | number | undefined>) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase())}:${v}`)
    .join(";");

export function buildStyles(c: ThemeConfig): Styles {
  const fs = c.fontSize ?? 15;
  const lh = c.lineHeight ?? 1.6;
  const text = c.textColor ?? "#3f3f46";
  const grad = `linear-gradient(135deg, ${c.primary} 0%, ${c.accent} 100%)`;

  const headingBase = {
    margin: "14px 0 8px 0",
    fontSize: `${fs + 3}px`,
    fontWeight: "bold",
    lineHeight: "1.45",
    letterSpacing: "0.5px",
  };

  const h2 =
    c.headingStyle === "gradient"
      ? css({
          ...headingBase,
          display: "inline-block",
          padding: "8px 20px",
          color: "#ffffff",
          background: grad,
          borderRadius: "8px 20px 8px 20px",
          boxShadow: `0 4px 12px ${c.primary}40`,
        })
      : c.headingStyle === "solid"
        ? css({
            ...headingBase,
            display: "inline-block",
            padding: "7px 18px",
            color: "#ffffff",
            background: c.primary,
            borderRadius: "6px",
          })
        : c.headingStyle === "bar"
          ? css({
              ...headingBase,
              padding: "0 0 0 12px",
              color: c.primary,
              borderLeft: `4px solid ${c.primary}`,
            })
          : css({
              ...headingBase,
              color: c.primary,
              background: grad,
              webkitBackgroundClip: "text",
              backgroundClip: "text",
            });

  return {
    container: css({
      fontSize: `${fs}px`,
      lineHeight: `${lh}`,
      color: text,
      letterSpacing: "0.5px",
      wordBreak: "break-word",
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', sans-serif",
    }),
    h1: css({
      margin: "4px 0 10px 0",
      fontSize: `${fs + 7}px`,
      fontWeight: "bold",
      textAlign: "center",
      color: c.primary,
      lineHeight: "1.35",
    }),
    h2,
    h3: css({
      margin: "11px 0 6px 0",
      fontSize: `${fs + 1}px`,
      fontWeight: "bold",
      color: c.primary,
      lineHeight: "1.45",
    }),
    p: css({
      margin: "0 0 14px 0",
      fontSize: `${fs}px`,
      lineHeight: `${lh}`,
      color: text,
      letterSpacing: "0.5px",
    }),
    strong: css({ color: c.primary, fontWeight: "bold" }),
    em: css({ fontStyle: "italic", color: "#71717a" }),
    a: css({ color: c.accent, textDecoration: "none", borderBottom: `1px solid ${c.accent}66` }),
    ul: css({ margin: "0 0 14px 0", paddingLeft: "22px", listStyle: "disc" }),
    ol: css({ margin: "0 0 14px 0", paddingLeft: "22px", listStyle: "decimal" }),
    li: css({
      margin: "0 0 6px 0",
      fontSize: `${fs}px`,
      lineHeight: `${lh}`,
      color: text,
    }),
    blockquote: css({
      margin: "0 0 16px 0",
      padding: "12px 14px",
      background: `${c.primary}0f`,
      borderLeft: `4px solid ${c.primary}`,
      borderRadius: "0 8px 8px 0",
      color: "#52525b",
      fontSize: `${fs - 1}px`,
      lineHeight: `${lh}`,
    }),
    code: css({
      padding: "2px 6px",
      margin: "0 2px",
      background: `${c.primary}14`,
      color: c.primary,
      borderRadius: "4px",
      fontSize: `${fs - 2}px`,
      fontFamily: "Menlo, Consolas, monospace",
    }),
    pre: css({
      margin: "0 0 16px 0",
      padding: "14px",
      background: "#1e1e2e",
      color: "#e4e4e7",
      borderRadius: "10px",
      fontSize: `${fs - 2}px`,
      lineHeight: "1.55",
      overflowX: "auto",
      fontFamily: "Menlo, Consolas, monospace",
      whiteSpace: "pre",
    }),
    img: css({ maxWidth: "100%", borderRadius: "8px", display: "block", margin: "0 auto 14px" }),
    hr: css({
      border: "none",
      height: "1px",
      background: `linear-gradient(90deg, transparent, ${c.primary}80, transparent)`,
      margin: "22px 0",
    }),
    table: css({
      width: "100%",
      borderCollapse: "collapse",
      margin: "0 0 16px 0",
      fontSize: `${fs - 2}px`,
    }),
    th: css({
      padding: "10px",
      background: `${c.primary}14`,
      color: c.primary,
      border: "1px solid #e4e4e7",
      fontWeight: "bold",
    }),
    td: css({ padding: "10px", border: "1px solid #e4e4e7" }),
    card: css({
      margin: "0 0 16px 0",
      padding: "16px",
      border: `1px solid ${c.primary}33`,
      borderRadius: "12px",
      background: "#ffffff",
      boxShadow: `0 4px 16px ${c.primary}1a`,
    }),
    cardTitle: css({
      margin: "0 0 10px 0",
      fontSize: `${fs}px`,
      fontWeight: "bold",
      color: c.primary,
    }),
    tip: css({
      margin: "0 0 16px 0",
      padding: "12px 14px",
      background: `${c.accent}12`,
      border: `1px solid ${c.accent}40`,
      borderRadius: "10px",
      fontSize: `${fs - 1}px`,
      color: "#52525b",
    }),
    warn: css({
      margin: "0 0 16px 0",
      padding: "12px 14px",
      background: "#fff7ed",
      border: "1px solid #fdba74",
      borderRadius: "10px",
      fontSize: `${fs - 1}px`,
      color: "#9a3412",
    }),
    divider: css({
      margin: "20px 0",
      textAlign: "center",
      color: `${c.primary}99`,
      fontSize: `${fs - 2}px`,
      letterSpacing: "4px",
    }),
  };
}

export function makeTheme(id: string, c: ThemeConfig, builtin = false): Theme {
  return {
    id,
    name: c.name,
    builtin,
    primary: c.primary,
    accent: c.accent,
    headingStyle: c.headingStyle,
    styles: buildStyles(c),
  };
}

export const BUILTIN_THEMES: Theme[] = [
  makeTheme(
    "raccoon-purple",
    { name: "小浣熊紫", primary: "#7c5cff", accent: "#c084fc", headingStyle: "gradient" },
    true,
  ),
  makeTheme(
    "geek-green",
    { name: "极客绿", primary: "#16a34a", accent: "#4ade80", headingStyle: "solid" },
    true,
  ),
  makeTheme(
    "ink-blue",
    { name: "墨水蓝", primary: "#2563eb", accent: "#38bdf8", headingStyle: "bar" },
    true,
  ),
  makeTheme(
    "sunset-orange",
    { name: "落日橙", primary: "#ea580c", accent: "#fb923c", headingStyle: "text" },
    true,
  ),
  makeTheme(
    "sakura-pink",
    {
      name: "樱花粉",
      primary: "#e75480",
      accent: "#ffb7c5",
      headingStyle: "gradient",
      textColor: "#4b3b41",
    },
    true,
  ),
];

export const STORAGE_KEY = "mp_tool_custom_themes_v1";

export function loadCustomThemes(): Theme[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Theme[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: Theme[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
}
