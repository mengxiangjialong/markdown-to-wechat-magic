import { describe, expect, test } from "bun:test";
import { normalizePastedText, closeUnclosedFences, normalizeClipboard } from "@/lib/paste-normalize";
import { Window } from "happy-dom";

describe("粘贴保留标题与加粗", () => {
  function paste(html: string, plain: string) {
    const browser = new Window();
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalParser = Object.getOwnPropertyDescriptor(globalThis, "DOMParser");
    Object.defineProperty(globalThis, "window", { value: browser, configurable: true });
    Object.defineProperty(globalThis, "DOMParser", { value: browser.DOMParser, configurable: true });
    try {
      return normalizeClipboard({ clipboardData: { getData: (type: string) => type === "text/html" ? html : plain } } as unknown as ClipboardEvent);
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (originalParser) Object.defineProperty(globalThis, "DOMParser", originalParser);
      else Reflect.deleteProperty(globalThis, "DOMParser");
      browser.happyDOM.abort();
    }
  }

  test("网页的六级标题保留对应层级", () => {
    const html = Array.from({ length: 6 }, (_, i) => `<h${i + 1}>标题${i + 1}</h${i + 1}>`).join("");
    const out = paste(html, "标题1\n标题2\n标题3\n标题4\n标题5\n标题6");
    for (let depth = 1; depth <= 6; depth++) expect(out.split("\n")).toContain(`${"#".repeat(depth)} 标题${depth}`);
  });

  test("语义加粗和字体粗细样式都保留为加粗", () => {
    expect(paste('<p><strong>重点</strong>、<b>强调</b>、<span style="font-weight:700">粗体</span></p>', "重点、强调、粗体")).toBe("**重点**、**强调**、**粗体**");
  });

  test("列表中的标题与加粗不会因 HTML 转换而丢失", () => {
    const out = paste('<h2>功能</h2><ul><li><strong>线程池</strong>：实现简单</li></ul>', "功能\n线程池：实现简单");
    expect(out).toContain("## 功能");
    expect(out).toContain("- **线程池**：实现简单");
  });

  test("纯 Markdown 标题与加粗原样保留", () => {
    expect(paste("", "# 标题\n\n**重点**")).toBe("# 标题\n\n**重点**");
  });

  test("代码内部的样式标签不会生成加粗标记", () => {
    const out = paste('<h2>代码</h2><pre><code>const name = <b>"test"</b>;</code></pre><p><strong>说明</strong></p>', '代码\nconst name = "test";\n说明');
    expect(out).toContain('```env\nconst name = "test";\n```');
    expect(out).toContain("**说明**");
  });
});

describe("引用块不会被包进代码块", () => {
  test("英文引用不生成 ```env 围栏", () => {
    const out = normalizePastedText("正文\n\n> This is a note about the design\n> another line\n\n后续");
    expect(out).not.toContain("```");
    expect(out).toContain("> This is a note about the design");
  });

  test("引用里的命令也不生成围栏", () => {
    const out = normalizePastedText("正文\n\n> npm install marked\n> curl -s https://x.com\n\n后续");
    expect(out).not.toContain("```");
    expect(out).toContain("> npm install marked");
  });

  test("代码块后面的引用留在块外", () => {
    const out = normalizePastedText("const a = 1\n\n> 说明：这里是引用\n\n正文");
    expect(out).toContain("```env\nconst a = 1\n```");
    expect(out).toContain("> 说明：这里是引用");
    expect(out.indexOf("> 说明：这里是引用")).toBeGreaterThan(out.indexOf("```env"));
  });
});

describe("代码仍然正常成块", () => {
  test("跨空行的完整代码只生成一个 env 围栏", () => {
    const py = [
      "from langchain_tavily import TavilySearch",
      "",
      "from dotenv import load_dotenv",
      "",
      "load_dotenv(override=True)",
      "",
      "web_search = TavilySearch(",
      "",
      'tavily_api_key=os.getenv("TAVILY_API_KEY"),',
      "",
      "max_results=2",
      "",
      ")",
      "",
      "#这是一个高度封装的网络搜索工具，可以直接调用：",
      "",
      'web_search.invoke("请问2026年足球世界杯有哪些参赛队？")',
    ].join("\n");
    const out = normalizePastedText(py);
    expect(out.match(/```/g)?.length).toBe(2);
    expect(out).toContain("```env");
    expect(out).toContain("web_search.invoke(");
  });

  test("中文冒号后面的内容不自动加代码围栏", () => {
    expect(normalizePastedText("配置如下：\nserver.port=8080\n\n正文。")).not.toContain("```");
  });

  test("$ 开头的命令提示符仍会被识别为代码", () => {
    const out = normalizePastedText("安装依赖\n\n$ npm install marked\n\n正文结束。");
    expect(out).toContain("```env");
    expect(out).toContain("$ npm install marked");
  });

  test("未闭合围栏在正文前自动补结尾", () => {
    const out = closeUnclosedFences("```bash\nnpm install marked\n\n正文说明在这里");
    expect(out.match(/```/g)?.length).toBe(2);
    expect(out.indexOf("正文说明在这里")).toBeGreaterThan(out.lastIndexOf("```"));
  });
});

describe("JSON 数据整体放进一个代码块", () => {
  test("不带引号的键值行不会被冒号拆出代码块", () => {
    const out = normalizePastedText('数据如下：\n{\nname: "手机",\nprice: 1\n}\n正文。');
    expect(out).toContain('```env\n{\nname: "手机",\nprice: 1\n}\n```');
  });
  test("单行 JSON 也进代码块", () => {
    const out = normalizePastedText('数据如下：{"name": "手机", "price": 1}\n正文。');
    expect(out).toContain('```env\n{"name": "手机", "price": 1}\n```');
  });
  test("中文列表冒号仍是正文", () => {
    expect(normalizePastedText("* **线程池**：实现简单")).not.toContain("```");
  });
});

describe("无序列表不会被取消", () => {
  test("Bot 的两个无符号并列条目恢复为无序列表且不与引导句合并", () => {
    const input = "每个 Bot 都可以拥有：\n\n独立的名称、头像和角色设定。\n\n独立的 AI 模型。";
    expect(normalizePastedText(input)).toBe("每个 Bot 都可以拥有：\n\n- 独立的名称、头像和角色设定。\n\n- 独立的 AI 模型。");
  });

  test("普通冒号正文不能误转成列表", () => {
    expect(normalizePastedText("说明：\n\n这是第一段正文。\n\n这是第二段正文。")).not.toContain("- ");
  });

  test("显式代码块内的并列文字不能添加列表符号", () => {
    const out = normalizePastedText('```env\n# 每个 Bot 都可以拥有：\n# 独立的名称、头像和角色设定。\n# 独立的 AI 模型。\n```');
    expect(out).not.toContain("- 独立的");
  });

  test("星号列表原样保留", () => {
    const out = normalizePastedText("要点如下：\n* **线程池**：实现简单\n* **队列**：速度快\n\n后续。");
    expect(out).toContain("* **线程池**：实现简单");
    expect(out).toContain("* **队列**：速度快");
    expect(out).not.toContain("```");
  });

  test("减号列表原样保留", () => {
    const out = normalizePastedText("要点如下：\n- 第一项：说明一\n- 第二项：说明二");
    expect(out).toContain("- 第一项：说明一");
    expect(out).toContain("- 第二项：说明二");
  });

  test("网页复制的 • 符号转成 Markdown 无序列表", () => {
    const out = normalizePastedText("优势：\n• 简单\n• 快速");
    expect(out).toContain("- 简单");
    expect(out).toContain("- 快速");
  });

  test("冒号后面的数字序号不并入上一行", () => {
    const out = normalizePastedText("步骤如下：\n1. 第一步\n2. 第二步\n3. 第三步");
    expect(out).toContain("步骤如下：\n1. 第一步");
    expect(out).toContain("2. 第二步");
  });

  test("冒号后面的中文数字序号不并入上一行", () => {
    const out = normalizePastedText("配置项：\n1、名称\n2、头像");
    expect(out).toContain("配置项：\n1、名称");
  });

  test("列表冒号后的内容不加代码围栏，列表保留", () => {
    const out = normalizePastedText("* 配置如下：\nconst a = 1\n\n正文。");
    expect(out).toContain("* 配置如下：");
    expect(out).not.toContain("```");
  });
});
