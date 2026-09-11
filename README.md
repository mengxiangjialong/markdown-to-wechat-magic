# WeChat-article

一款专为公众号创作者打造的本地排版神器：告别排版噩梦，左写 Markdown，右看公众号效果，一键复制粘贴。

**在线体验**：https://markdown-to-wechat-magic.lovable.app

## 项目背景

每次写完文章，最烦的就是调格式。Markdown 转成公众号代码不难，但转出来"能用"和"好看"之间，隔着一整个下午的微调——字号、行距、颜色、编号、引用卡片、代码块缩进……每篇文章都要重新来一遍，费时费力，效果还全凭运气。

WeChat-article 把这套微调工作固化成主题：写好 Markdown，选一套主题，右侧手机预览所见即所得，复制后直接粘贴进公众号后台，样式完整保留。

## 技术栈

- React 19 + TypeScript
- TanStack Start（TanStack Router，文件式路由）
- Vite 7
- Tailwind CSS v4
- marked（Markdown 解析）

## 已实现功能

- **左写右看**：左侧 Markdown 编辑器，带工具栏与快捷键；右侧 375px 手机宽度实时预览。
- **完整标题与列表**：支持 H1–H6 标题、有序列表和无序列表，工具栏一键设置。
- **智能代码粘贴**：自动识别带空行、注释和嵌套参数的完整代码，统一放入一个 ` ```env ` 代码块；围栏缺少结尾时自动补齐。
- **主题系统**：内置小浣熊紫、极客绿、墨水蓝、落日橙、樱花粉五套主题，支持自定义主题（主色、辅助色、标题风格）并本地保存。
- **扩展语法**：`:::card` 卡片、`:::tip` 提示、`:::warn` 注意、`:::divider` 分隔线。
- **一键复制**：输出带内联样式的公众号 HTML，粘贴到公众号后台样式不丢。
- **本地草稿**：编辑内容自动保存在浏览器本地，刷新不丢失。
- **纯前端**：无后端、无账号、无网络请求。

## 快速开始

需要 Node.js 与 npm（[通过 nvm 安装](https://github.com/nvm-sh/nvm#installing-and-updating)）。

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

浏览器打开终端输出的地址即可使用。构建生产版本：

```sh
npm run build
```

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| Ctrl/Cmd + B | 加粗 |
| Ctrl/Cmd + I | 斜体 |
| Ctrl/Cmd + K | 链接 |
| Ctrl/Cmd + Shift + K | 删除当前行 |
| Tab | 缩进 |

## Build with Lovable

## 运行结果

<img width="1901" height="819" alt="image" src="https://github.com/user-attachments/assets/25882727-8527-43ad-9603-647e10226484" />



Continue developing this project in the [Lovable editor](https://lovable.dev/projects/069a67a5-31e8-408e-8c74-801734f4f816).
