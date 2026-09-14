# zcode-beautify

ZCode 桌面客户端的开源美化插件：支持背景图片导入替换，并使用莫奈取色（Material Design 3 动态配色）对 ZCode UI 颜色进行全局适配。

- 创建日期：2026-09-14
- 技术栈：TypeScript、Node.js ≥ 20、Chrome DevTools Protocol（CDP）、@material/material-color-utilities
- 许可证：MIT

## 原理

ZCode 桌面端（Electron）默认开启 CDP 调试端口 9229，且 UI 主题完全由 Tailwind v4 的 `--color-*` CSS 自定义属性驱动。本插件通过 CDP 向 renderer 注入 CSS/JS：

1. 注入固定定位的壁纸层（图片以 data URI 嵌入）；
2. 将背景类 `--color-*` 变量改为透明/半透明，前景面板加半透明模糊遮罩；
3. 用 Google 官方 MD3 算法从壁纸提取 source color，生成 light/dark 双套调色板并映射覆盖 ZCode 的语义 token；
4. MutationObserver 监听 `.dark` class 切换，自动在两套 scheme 间切换。

不修改任何安装文件，ZCode 升级不受影响。

## 运行方式

依赖：Node.js ≥ 20（需系统安装 node 并在 PATH 中）。

```bash
npm install
npm run build

# 1) 以 CDP 调试端口启动 ZCode（ZCode 需完全退出后执行；会话会保留）
node dist/cli.js launch

# 2) 设置壁纸并自动适配配色
node dist/cli.js apply D:\pictures\wallpaper.jpg --blur 6 --dim 30

# 3) （可选）守护模式：ZCode 重启后自动重新注入
node dist/cli.js watch

# 还原默认外观
node dist/cli.js reset
```

作为 ZCode 插件使用时，把本目录复制或链接到
`~/.zcode/cli/plugins/cache/local/zcode-beautify/<version>/`，
即可获得 `/beautify` 命令与 `set_background` 等 MCP 工具，在对话中直接说
"把这张图设为背景"即可。

## 风险声明

- 本插件通过 CDP（Chrome DevTools 协议）向运行中的 ZCode 注入 CSS/JS，属
  非官方手段，效果可能随 ZCode 版本变化而失效；`reset` 可随时还原。
- `launch` 需要重启 ZCode 一次；之后的每次 ZCode 重启都会丢失注入（CDP 会话
  作用域），建议配合 `watch` 守护模式或在对话中使用 `refresh_theme`。
