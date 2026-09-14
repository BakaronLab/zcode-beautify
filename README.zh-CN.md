# zcode-beautify

[English](README.md) | [中文](README.zh-CN.md)

美化 **ZCode 桌面客户端**：任意图片一键设为背景壁纸，并用 Material Design 3（莫奈取色）动态配色适配整个 UI——还附带实时悬浮设置面板。

> 📷 欢迎贡献截图——向 `docs/screenshot.png` 提 PR 即可。

## 功能

- **壁纸**——任意本地图片作为固定背景层,铺在 UI 之下;三种取景模式:`cover`(填满裁剪)、`contain`(完整显示,背后是同图模糊放大底)、`smart`(AI 适应:本地分析画面主体,自动选择最佳取景与焦点位置)。
- **莫奈配色**——用 Google 官方 MD3 算法从壁纸提取 source color,生成 light/dark 双套调色板,映射覆盖 ZCode 的 35+ 个语义 CSS 变量。
- **实时设置面板**——ZCode 窗口内可拖拽的悬浮面板:blur/dim 滑块、Monet 开关、壁纸透显开关、一键换图、还原;所有调整即时预览并自动保存。
- **对话控制**——内置 `/beautify` 斜杠命令与 MCP 工具,让 ZCode 智能体代你设壁纸、调主题。
- **自愈**——`serve` 运行期间主题在渲染器刷新后自动恢复;上次外观还会缓存到 `localStorage` 作为兜底。

## 原理

ZCode 是 Electron 应用,UI 主题由 Tailwind v4 的 `--color-*` CSS 自定义属性驱动,且 production 版**默认不带调试端口**。本插件:

1. 以 `--remote-debugging-port=9222` 启动 ZCode(仅需一次 `launch`);
2. 通过 Chrome DevTools Protocol 向 renderer 注入 CSS/JS:
   - 固定定位的壁纸层(图片以 data URI 嵌入),
   - 背景类变量改为半透明,让壁纸透出,
   - MD3 light/dark 调色板覆盖 ZCode 的语义 token;
3. `serve` 模式保持注入会话不关闭,主题与设置面板在渲染器刷新后自动存活。

不修改任何安装文件,ZCode 升级不受影响。

## 环境要求

- Node.js ≥ 20(在 PATH 中)。
- ZCode 桌面客户端(Windows / macOS / Linux)。

## 安装

### 方式 A —— ZCode 插件市场(推荐)

1. 打开 ZCode → **设置 → 插件管理 → 发现**。
2. 点 **+**,添加本仓库(GitHub URL 或本地 clone 路径)。
3. 在 *zcode-beautify* 卡片上点 **获取**。`/beautify` 命令与 MCP 工具立即可用。

仓库内已附带 `dist/` 预构建单文件产物,无需本地构建。

### 方式 B —— clone 直接运行

```bash
git clone https://github.com/Logocceai/zcode-beautify.git
cd zcode-beautify
node dist/cli.js --help        # 预构建产物,零安装
```

## 快速开始

```bash
# 1) 完全退出 ZCode 后执行一次,以 CDP 调试端口重启 ZCode
node dist/cli.js launch

# 2) 设置壁纸并自动适配配色
node dist/cli.js apply "D:\pictures\wallpaper.jpg" --blur 6 --dim 30

# 3) (推荐)守护模式 + 实时设置面板
node dist/cli.js serve
```

`serve` 运行时,ZCode 右下角出现 🎨 按钮。点开即可实时调 blur/dim、循环切换取景模式(cover → contain → smart)、开关 Monet 配色与壁纸透显、更换壁纸图片或一键还原——所有调整即时预览、自动保存。

也可以直接在 ZCode 里输入 `/beautify <图片路径>` 让智能体操作,之后说"模糊调高一点"即可(由 `apply_options` MCP 工具处理)。

## CLI 命令

| 命令 | 用途 |
|---|---|
| `launch [--port N]` | 以调试端口启动 ZCode(需先完全退出) |
| `apply <image> [--blur] [--dim] [--fit] [--no-monet]` | 设壁纸并适配配色(`--fit cover\|contain\|smart`) |
| `colors` | 不换图,重新应用已存主题 |
| `serve [--api-port M]` | 守护模式 + 设置面板 + 本地控制 API(默认 API 端口 9223) |
| `watch` | 无面板守护模式:ZCode 重启后自动重注入 |
| `reset` | 移除壁纸与配色覆盖 |
| `status` | 查看 CDP 可达性与渲染器目标 |

## MCP 工具

| 工具 | 用途 |
|---|---|
| `set_background` | 设壁纸 + 莫奈配色 |
| `apply_options` | 不重传图片,单独调 blur/dim/monet/壁纸透显/取景模式 |
| `refresh_theme` | 重启后重注入已存主题 |
| `reset_appearance` | 移除壁纸与覆盖,还原默认 |
| `beautify_status` | 查看已存配置 |

## 项目结构

```
├─ src/
│  ├─ cli.ts                 # CLI 入口:launch / apply / colors / reset / status / watch / serve
│  ├─ core/
│  │  ├─ cdp.ts              # 精简 Chrome DevTools Protocol 客户端 + 注入脚本
│  │  ├─ inject.ts           # 装配注入载荷(壁纸层 CSS + token 覆盖)
│  │  ├─ launch.ts           # 配置持久化 + ZCode 启动器(感知单实例锁)
│  │  ├─ monet.ts            # 图片解码、MD3 取色、智能适配(smart fit)分析
│  │  ├─ server.ts           # serve 模式:本地控制 API + 持久注入会话
│  │  ├─ session.ts          # CLI 与 MCP 共用的应用/还原操作
│  │  └─ tokens.ts           # MD3 调色板 → ZCode 的 Tailwind v4 --color-* 变量映射
│  ├─ panel/panelScript.ts   # 注入式设置面板(DOM + CSS + 逻辑)
│  └─ mcp/server.ts          # 向 ZCode 智能体暴露工具的 MCP 服务
├─ commands/beautify.md      # /beautify 斜杠命令
├─ skills/beautify/SKILL.md  # 面向智能体的工作流文档
├─ .zcode-plugin/plugin.json # ZCode 插件清单(命令、技能、MCP 服务)
├─ marketplace.json          # 市场索引,让仓库可在 ZCode 插件市场被发现
├─ scripts/bundle.mjs        # esbuild 打包(dist/ 为自包含产物,已入库)
└─ dist/                     # 预构建 cli.js + mcp/server.js —— 用户零构建
```

用户数据位于 `~/.zcode/cli/plugins/data/zcode-beautify/`:`config.json`(当前配置)、`config.backup.json`(还原时记住的壁纸备份)、`wallpaper.*`(壁纸副本,原图移动或删除后主题依然有效)。

## 开发

```bash
npm install
npm run build    # 类型检查 + 编译到 dist/
npm run bundle   # 预构建单文件产物(仓库随附)
```

`dist/` 已提交入库,用户无需构建。修改 `src/` 后请运行 `npm run bundle` 并提交更新后的产物。

## 风险与限制

- 注入通过 CDP(Chrome DevTools 协议)实现,属**非官方**手段,ZCode 更新可能使其失效;`reset` 可随时还原默认外观。
- `launch` 需要重启一次 ZCode。若 `serve`/`watch` 未运行,每次 ZCode 重启主题都会丢失(CDP 会话随连接关闭)。
- 功能色(success/warning/destructive)刻意保持不动。
- 控制 API 仅绑定 `127.0.0.1`,但按设计接受本机任意进程访问(注入面板需要 CORS)。

## 许可证

MIT
