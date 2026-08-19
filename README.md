# Antigravity 中文汉化

将 Google Antigravity（Electron 独立应用）的界面翻译成中文的汉化包，采用 **ASAR 重打包注入** 方案，一次安装永久生效，无需常驻进程。

## 功能

- 界面全面中文化（菜单、按钮、提示、设置项等），通过运行时文本翻译 + 系统菜单/托盘菜单注入实现
- 词表来自 MIT 协议的 [antigravity-chinese](https://github.com/kdczyz/antigravity-chinese)（约 380 词条 + 60 条正则），并针对当前版本实测补词
- 一键安装 / 一键还原官方英文，全程自动备份（`app.asar.bak`）
- 官方应用更新后，重新运行一次安装脚本即可恢复汉化

## 使用方法

> 前置要求：安装 [Node.js](https://nodejs.org)（≥18，首次运行会自动下载 `@electron/asar` 工具，需要联网）。

| 操作 | 方式 |
|------|------|
| 安装汉化 | 双击 `双击安装中文汉化.bat` |
| 还原官方英文 | 双击 `双击卸载还原官方英文.bat` |
| 手动安装 | `node localization_engine.js install` |
| 手动还原 | `node localization_engine.js uninstall` |
| 查看状态 | `node localization_engine.js check` |

自定义安装目录：

```powershell
node localization_engine.js install "D:\你的\Antigravity安装目录"
```

## 工作原理

1. 关闭正在运行的 Antigravity
2. 备份 `resources/app.asar` → `resources/app.asar.bak`（仅首次）
3. 用 `@electron/asar` 解包 `app.asar`
4. 注入汉化代码：
   - `dist/preload.js`：运行时翻译引擎（MutationObserver 监听 DOM，翻译文本与 `aria-label`/`title`/`placeholder`/`alt`）
   - `dist/menu.js`：翻译 Electron 原生应用菜单
   - `dist/tray.js`：翻译托盘菜单与智能体数量文案
   - `dist/loadingOverlay.js`：翻译启动加载页
5. 重新打包 `app.asar`

所有注入均以 `/* ===[ ANTIGRAVITY-ZH ]=== */` 标记包裹，重复安装不会重复注入；卸载直接恢复官方备份。

## 词表

- `dicts/common.json` — 界面词条（来自 antigravity-chinese，MIT）
- `dicts/menu.json` — 菜单/托盘词条（本项目补充）
- `dicts/patterns.json` — 正则翻译规则（来自 antigravity-chinese，MIT）

遇到未翻译的英文，欢迎补充到 `dicts/*.json` 后重新运行安装脚本，或提交 Issue/PR。

## 许可证

MIT License。详见 [LICENSE](LICENSE)。词表部分保留 antigravity-chinese（MIT）版权声明。

## 免责声明

本项目为社区汉化工具，与 Google 官方无关。修改的是本地应用打包文件，官方更新会被覆盖，重新运行安装脚本即可。请在理解风险后使用。