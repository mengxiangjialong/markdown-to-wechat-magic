import { describe, expect, test } from "bun:test";
import { normalizePastedText, closeUnclosedFences } from "@/lib/paste-normalize";

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

  test("$ 开头的命令提示符仍会被识别为代码", () => {
    const out = normalizePastedText("安装依赖：\n\n$ npm install marked\n\n正文结束。");
    expect(out).toContain("```env");
    expect(out).toContain("$ npm install marked");
  });

  test("未闭合围栏在正文前自动补结尾", () => {
    const out = closeUnclosedFences("```bash\nnpm install marked\n\n正文说明在这里");
    expect(out.match(/```/g)?.length).toBe(2);
    expect(out.indexOf("正文说明在这里")).toBeGreaterThan(out.lastIndexOf("```"));
  });
});
