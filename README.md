# Antigravity 中文汉化

将 Google Antigravity（Electron 独立应用）的界面翻译成中文的汉化包，采用 **ASAR 重打包注入** 方案，一次安装永久生效，无需常驻进程。

## 功能

- 界面全面中文化（菜单、按钮、提示、设置项、技能/插件描述等），通过运行时文本翻译 + 系统菜单/托盘菜单注入实现
- 词表来自 MIT 协议的 [antigravity-chinese](https://github.com/kdczyz/antigravity-chinese)（约 380 词条 + 57 条正则），并针对当前版本实测补词
- 一键安装 / 一键还原官方英文，全程自动备份（`app.asar.bak`）
- 内置静态覆盖率检测（`check --coverage`）与词表版本元数据，版本升级后可直接判断词条是否失效
- 官方应用更新后，重新运行一次安装脚本即可恢复汉化

## 使用方法

> 前置要求：安装 [Node.js](https://nodejs.org)（≥18，首次运行会自动下载 `@electron/asar` 工具，需要联网）。

| 操作 | 方式 |
|------|------|
| 安装汉化 | 双击 `双击安装中文汉化.bat` |
| 还原官方英文 | 双击 `双击卸载还原官方英文.bat` |
| 手动安装 | `node localization_engine.js install` |
| 检查并自动修复 | `node localization_engine.js ensure` |
| 手动还原 | `node localization_engine.js uninstall` |
| 查看状态 | `node localization_engine.js check` |
| 覆盖率检测 | `node localization_engine.js check --coverage` |

### 应对自动更新（推荐）

Antigravity 自动更新会覆盖 `app.asar`，导致界面变回英文。推荐用启动器代替直接打开应用：

- 双击项目根目录的 **`Antigravity中文版.cmd`** 启动——它会先运行 `ensure`：已注入则秒过，检测到汉化被更新覆盖则**自动重新注入**后再启动应用。
- 可将桌面/开始菜单快捷方式的目标改为该启动器（图标可保留 Antigravity 原样），此后更新覆盖问题自动自愈。

注意：更新发生在使用中时，当次会话仍是英文；关闭后从启动器重新打开即恢复。

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

## 架构与设计

本项目分为两层：**引擎通用层**（与具体应用无关，理论上可复用给任何 Electron 应用）与**业务配置层**（Antigravity 专属词表）。

```
antigravity-zh/
├── engine/                    # 引擎通用层（与 Antigravity 无关，可跨 Electron 应用复用）
│   ├── asar-tools.js         # ASAR 解包/打包/备份/还原/进程管理
│   ├── preload-injector.js   # 运行时本地化注入（MutationObserver + DOM 翻译）
│   ├── menu-injector.js      # Electron 原生应用菜单翻译
│   ├── tray-injector.js      # 托盘菜单翻译
│   ├── loading-injector.js   # 启动加载页翻译
│   └── coverage.js           # 静态覆盖率检测
├── dicts/                     # 业务配置层（Antigravity 专属词表）
└── localization_engine.js     # 应用装配入口（应用路径 + 词表加载 + CLI）
```

引擎通用层与业务配置层通过「词表文件 + 注入点配置」解耦：给任意 Electron 应用换一份词表与注入点，即可复用同一套注入引擎。

### 词表体系

| 词表 | 内容 | 来源 |
|------|------|------|
| `common.json` | 通用界面词条 | antigravity-chinese（MIT）+ 本项目补词 |
| `menu.json` | 原生菜单/托盘词条 | 本项目补充 |
| `settings.json` | 设置页/安全预设/模型用量等 | 本项目补充 |
| `skills.json` | 技能/插件描述整句翻译 | 官方动态描述（运行时加载） |
| `phrases.json` | 短语级词库（动态描述常见句式） | 本项目补充 |
| `patterns.json` | 正则翻译规则（动态变量插值） | antigravity-chinese（MIT）+ 本项目 |

每份词表顶部含 `_meta` 元数据（来源、`tested_against` 版本区间、最后校验日期），配合 `check --coverage` 在版本升级后自动预警词条失效。

## 覆盖率检测

`node localization_engine.js check --coverage` 会解包当前安装包，扫描源码中词条字面量命中情况，输出各词表命中率、未命中清单与版本兼容警告，并写入 `coverage-report.json`。

**注意口径**：Antigravity 大量界面文本（含技能描述）由运行时动态加载，静态源码中找不到对应字面量，因此静态命中率**不代表实际汉化覆盖率**。该检测的实用价值在于：

- **版本升级预警**：官方升级后命中率骤降，说明词条已失效，需要更新词表
- **废弃词条清理**：长期未命中的词条可安全移除
- **兼容性检查**：当前版本不在 `_meta.tested_against` 时给出警告

真实运行时覆盖率检测（调试模式）已在路线图内。

## 与其他汉化方案的区别

本项目相对同类静态字符串替换方案的差异：

- **运行时 MutationObserver 翻译**：对小版本 UI 改动容忍度更高，动态渲染内容（技能/插件描述等）也能即时翻译
- **额外覆盖原生应用菜单、托盘菜单、启动加载页**：多数方案未处理主进程原生 UI
- **幂等注入标记**：重复安装不会叠加注入，卸载一键还原官方备份
- **词表来自 antigravity-chinese（MIT）**，遵循相同的开源协议

## 签名与还原

- 修改并重新打包 `app.asar` 会导致应用官方数字签名失效——这是所有本地注入类工具的客观规律，非本项目特有
- **一键还原**：运行 `node localization_engine.js uninstall`（或双击卸载脚本）后，应用即恢复官方原始打包文件，**100% 恢复官方数字签名状态**，不留任何汉化残留
- 系统拦截说明：macOS 可能触发 Gatekeeper 拦截，可执行 `xattr -dr com.apple.quarantine /Applications/Antigravity.app`；Windows 的 SmartScreen 属正常提示，选择「仍要运行」即可

## 许可证

MIT License。详见 [LICENSE](LICENSE)。词表部分保留 antigravity-chinese（MIT）版权声明。

## 免责声明

本项目为社区汉化工具，与 Google 官方无关。修改的是本地应用打包文件，官方更新会被覆盖，重新运行安装脚本即可。请在理解风险后使用。