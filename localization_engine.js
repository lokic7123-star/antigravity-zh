"use strict";
/**
 * localization_engine.js — Antigravity 中文汉化引擎（ASAR 重打包注入）
 *
 * 架构思路参考 qqxpee/antigravity2-cn（无许可证，仅借鉴思路），代码为自写实现；
 * 词表来源 kdczyz/antigravity-chinese（MIT 协议），保留 MIT 声明，详见 LICENSE。
 *
 * 用法：
 *   node localization_engine.js install   [安装目录]   汉化（默认 %LOCALAPPDATA%\Programs\antigravity）
 *   node localization_engine.js uninstall [安装目录]   还原官方英文（恢复 app.asar.bak）
 *   node localization_engine.js check     [安装目录]   查看当前状态
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");

const EXE_NAME = "Antigravity.exe";
const DEFAULT_APP_DIR = path.join(process.env.LOCALAPPDATA || "", "Programs", "antigravity");
const ASAR = "app.asar";
const BAK = "app.asar.bak";
const MARK = "/* ===[ ANTIGRAVITY-ZH ]=== */";
const DICT_DIR = path.join(__dirname, "dicts");

// ---------------------------------------------------------------------------
// 小工具
// ---------------------------------------------------------------------------
function log(msg) {
  console.log("[antigravity-zh] " + msg);
}

function runSync(cmd, args) {
  let c, a;
  if (process.platform === "win32") {
    c = "cmd";
    a = ["/c", cmd, ...args];
  } else {
    c = cmd;
    a = args;
  }
  const r = spawnSync(c, a, { stdio: "inherit", windowsHide: true });
  if (r.error) throw new Error(`命令失败: ${cmd} ${args.join(" ")} (${r.error.message})`);
  if (r.status !== 0) throw new Error(`命令失败: ${cmd} ${args.join(" ")} (code=${r.status})`);
  return r;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// ---------------------------------------------------------------------------
// 探测
// ---------------------------------------------------------------------------
function findAppDir(argvDir) {
  const candidates = [argvDir, DEFAULT_APP_DIR].filter(Boolean);
  for (const dir of candidates) {
    const exe = path.join(dir, EXE_NAME);
    const asar = path.join(dir, "resources", ASAR);
    if (fs.existsSync(exe) && fs.existsSync(asar)) return dir;
  }
  throw new Error(
    `未找到 Antigravity 安装目录（需要 Antigravity.exe + resources/app.asar）。` +
      `请手动指定：node localization_engine.js install "D:\\安装路径"`
  );
}

// ---------------------------------------------------------------------------
// 进程 / 备份
// ---------------------------------------------------------------------------
function killApp() {
  try {
    spawnSync("taskkill", ["/f", "/im", EXE_NAME, "/t"], { stdio: "ignore", windowsHide: true });
  } catch {
    /* 进程不存在则忽略 */
  }
}

function backupAsar(asarPath) {
  const bakPath = path.join(path.dirname(asarPath), BAK);
  if (!fs.existsSync(bakPath)) {
    fs.copyFileSync(asarPath, bakPath);
    log(`已备份原始文件: ${BAK}`);
  }
}

// ---------------------------------------------------------------------------
// 翻译代码生成（注入 preload.js，运行于渲染进程）
// ---------------------------------------------------------------------------
function buildLocalizationJS() {
  const dict = {};
  for (const f of fs.readdirSync(DICT_DIR).filter((x) => x.endsWith(".json"))) {
    const data = readJson(path.join(DICT_DIR, f));
    if (Array.isArray(data)) continue;
    Object.assign(dict, data);
  }
  const patterns = readJson(path.join(DICT_DIR, "patterns.json"));

  const PATTERNS_JS = patterns.map((p) => {
    const re = p.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    if (p.target === null) {
      // 函数型 pattern：按 source 匹配内置逻辑
      if (p.source.includes("Requesting permission to")) return `[RegExp("${re}","g"),{fn:"permission"}]`;
      if (p.source.includes("(High|Medium|Low)")) return `[RegExp("${re}","g"),{fn:"gemini"}]`;
      return `[RegExp("${re}","g"),null]`;
    }
    const t = p.target.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `[RegExp("${re}","g"),"${t}"]`;
  });

  return `(function () {
  'use strict';
  if (window.__ANTIGRAVITY_ZH_ACTIVE__) return;
  window.__ANTIGRAVITY_ZH_ACTIVE__ = true;
  var DICT = ${JSON.stringify(dict)};
  var LOWER = new Map();
  for (var k in DICT) LOWER.set(k.toLowerCase(), DICT[k]);
  var KEYS = Object.keys(DICT).sort(function (a, b) { return b.length - a.length; });
  var PATTERNS = [${PATTERNS_JS.join(",\n    ")}];
  var PERM = {
    'read access to this path': '读取此路径',
    'write access to this path': '写入此路径',
    'reading this URL': '读取此 URL',
    'executing actions on this URL': '在此 URL 上执行操作',
    'running this command': '运行此命令',
    'running this command outside the sandbox': '在沙盒外运行此命令',
    'using this MCP tool': '使用此 MCP 工具'
  };
  function escapeRegExp(s) { return s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'); }
  function translate(value) {
    if (!value || typeof value !== 'string' || !/[A-Za-z]/.test(value)) return value;
    var next = value;
    for (var i = 0; i < KEYS.length; i++) {
      var key = KEYS[i];
      var escaped = escapeRegExp(key);
      var sw = /^[A-Za-z0-9]/.test(key);
      var ew = /[A-Za-z0-9]$/.test(key);
      var re = new RegExp((sw ? '(?<![A-Za-z0-9])' : '') + escaped + (ew ? '(?![A-Za-z0-9])' : ''), 'g');
      next = next.replace(re, LOWER.get(key.toLowerCase()));
    }
    for (var j = 0; j < PATTERNS.length; j++) {
      var p = PATTERNS[j];
      var re2 = p[0], t = p[1];
      if (typeof t === 'string') {
        next = next.replace(re2, t);
      } else if (t && t.fn === 'permission') {
        next = next.replace(re2, function (_m, action, target) {
          var a = PERM[action] || action;
          return '正在请求权限：' + a + ' ' + target;
        });
      } else if (t && t.fn === 'gemini') {
        next = next.replace(re2, function (_m, model, effort) {
          return 'Gemini ' + model.trim() + '（' + (DICT[effort] || effort) + '）';
        });
      }
    }
    return next;
  }
  function shouldSkip(node) {
    var el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return !!(el && el.closest && el.closest('script,style,textarea,code,pre,.xterm,.monaco-editor'));
  }
  function translateElement(el) {
    if (!el || !el.getAttribute) return;
    var attrs = ['aria-label', 'title', 'placeholder', 'alt'];
    for (var i = 0; i < attrs.length; i++) {
      var v = el.getAttribute(attrs[i]);
      if (!v) continue;
      var t = translate(v);
      if (t !== v) el.setAttribute(attrs[i], t);
    }
  }
  function translateSubtree(root) {
    if (!root || !root.nodeType) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateElement(root);
    if (shouldSkip(root)) return;
    if (root.nodeType === Node.TEXT_NODE) {
      var tv = translate(root.nodeValue || '');
      if (tv !== root.nodeValue) root.nodeValue = tv;
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    var n = root.firstChild;
    while (n) {
      var next = n.nextSibling;
      translateSubtree(n);
      n = next;
    }
    if (root.nodeType === Node.ELEMENT_NODE && root.shadowRoot) translateSubtree(root.shadowRoot);
  }
  function run() {
    if (!document || !document.documentElement) return;
    document.documentElement.lang = 'zh-CN';
    translateSubtree(document);
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') translateSubtree(m.target);
        else if (m.type === 'attributes') translateElement(m.target);
        else for (var j = 0; j < m.addedNodes.length; j++) translateSubtree(m.addedNodes[j]);
      }
    }).observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-label', 'title', 'placeholder', 'alt']
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
`;
}

// ---------------------------------------------------------------------------
// 注入各文件
// ---------------------------------------------------------------------------
function stripInjected(src) {
  return src.replace(new RegExp(`\\n?${MARK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "");
}

function injectPreload(preloadPath) {
  let src = fs.readFileSync(preloadPath, "utf8");
  src = stripInjected(src);
  const injected = src.replace(/\s*$/, "\n") + "\n" + MARK + "\n" + buildLocalizationJS() + MARK + "\n";
  fs.writeFileSync(preloadPath, injected, "utf8");
  log("已注入 dist/preload.js（界面翻译引擎）");
}

function injectMenu(menuPath) {
  let src = fs.readFileSync(menuPath, "utf8");
  src = stripInjected(src);
  const dict = readJson(path.join(DICT_DIR, "menu.json"));
  const code =
    `\n  ${MARK}\n` +
    `  (function __zhMenu(m) {\n` +
    `    var dict = ${JSON.stringify(dict)};\n` +
    `    var tr = function (s) { return dict[s] || s; };\n` +
    `    var walk = function (mi) { if (!mi || !mi.items) return; for (var i = 0; i < mi.items.length; i++) { var it = mi.items[i]; if (it && it.label && /[A-Za-z]/.test(it.label)) it.label = tr(it.label); if (it.submenu) walk(it.submenu); } };\n` +
    `    walk(m);\n` +
    `  })(menu);\n` +
    `  ${MARK}\n`;
  const anchor = "electron_1.Menu.setApplicationMenu(menu);";
  if (!src.includes(anchor)) throw new Error("menu.js 注入点未找到: setApplicationMenu");
  src = src.replace(anchor, code + anchor);
  fs.writeFileSync(menuPath, src, "utf8");
  log("已注入 dist/menu.js（系统菜单）");
}

function injectTray(trayPath) {
  let src = fs.readFileSync(trayPath, "utf8");
  src = stripInjected(src);
  const dict = Object.assign(
    readJson(path.join(DICT_DIR, "menu.json")),
    {
      "Open Antigravity": "打开 Antigravity",
      "Show Antigravity": "显示 Antigravity",
      "Quit Antigravity": "退出 Antigravity",
      "Hide Antigravity": "隐藏 Antigravity",
    }
  );
  const code =
    `\n  ${MARK}\n` +
    `  (function __zhTray(items) {\n` +
    `    var dict = ${JSON.stringify(dict)};\n` +
    `    var tr = function (s) { return dict[s] || s; };\n` +
    `    var walk = function (arr) { for (var i = 0; i < arr.length; i++) { var it = arr[i]; if (it && it.label && /[A-Za-z]/.test(it.label)) it.label = tr(it.label); if (it && it.submenu) walk(it.submenu); } };\n` +
    `    walk(items);\n` +
    `    return items;\n` +
    `  })(actions);\n` +
    `  ${MARK}\n`;
  const anchor = "contextMenu = electron_1.Menu.buildFromTemplate(actions);";
  if (!src.includes(anchor)) throw new Error("tray.js 注入点未找到: buildFromTemplate");
  src = src.replace(anchor, code + anchor);

  // 翻译 agent 数量文案（仅当仍是英文原文时）
  const oldCount =
    "countItem.label =\n" +
    "                (count > 0 ? `${count}` : 'No') +\n" +
    "                    ' agent' +\n" +
    "                    (count === 1 ? '' : 's') +\n" +
    "                    ' running';";
  const newCount = "countItem.label = count > 0 ? `${count} 个智能体运行中` : '无智能体运行中';";
  if (src.includes(oldCount)) {
    src = src.replace(oldCount, newCount);
  } else if (!src.includes("个智能体运行中")) {
    log("警告: 未匹配到 updateTrayAgentCount 文案，已跳过该处");
  }
  fs.writeFileSync(trayPath, src, "utf8");
  log("已注入 dist/tray.js（托盘菜单）");
}

function injectLoadingOverlay(loadingPath) {
  let src = fs.readFileSync(loadingPath, "utf8");
  const old = "Loading Antigravity";
  if (src.includes(old)) {
    src = src.replace(old, "正在加载 Antigravity");
    fs.writeFileSync(loadingPath, src, "utf8");
    log("已注入 dist/loadingOverlay.js（加载页）");
  } else if (!src.includes("正在加载 Antigravity")) {
    log("警告: 加载页文案未匹配到，已跳过");
  }
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function install(appDir) {
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, ASAR);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "antigravity-zh-"));

  log("1/5 关闭正在运行的 Antigravity…");
  killApp();

  log("2/5 备份原始 app.asar…");
  backupAsar(asarPath);

  log("3/5 解包 app.asar…");
  runSync("npx", ["-y", "@electron/asar", "extract", asarPath, tmpDir]);

  log("4/5 注入汉化代码…");
  injectPreload(path.join(tmpDir, "dist", "preload.js"));
  injectMenu(path.join(tmpDir, "dist", "menu.js"));
  injectTray(path.join(tmpDir, "dist", "tray.js"));
  injectLoadingOverlay(path.join(tmpDir, "dist", "loadingOverlay.js"));

  log("5/5 重新打包 app.asar…");
  runSync("npx", ["-y", "@electron/asar", "pack", tmpDir, asarPath]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  log("完成！现在可以启动 Antigravity，界面即为中文。");
  log("如需还原官方英文：node localization_engine.js uninstall");
}

function uninstall(appDir) {
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, ASAR);
  const bakPath = path.join(resourcesDir, BAK);

  log("关闭正在运行的 Antigravity…");
  killApp();

  if (fs.existsSync(bakPath)) {
    fs.copyFileSync(bakPath, asarPath);
    fs.rmSync(bakPath, { force: true });
    log("已还原官方英文 app.asar（备份已删除）。");
  } else {
    log("未找到 app.asar.bak，跳过还原。");
  }
}

function check(appDir) {
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, ASAR);
  const bakPath = path.join(resourcesDir, BAK);
  const localized = fs.readFileSync(asarPath, "utf8").includes("ANTIGRAVITY-ZH");
  console.log(`安装目录: ${appDir}`);
  console.log(`汉化状态: ${localized ? "已汉化" : "官方英文"}`);
  console.log(`备份文件: ${fs.existsSync(bakPath) ? "存在 (app.asar.bak)" : "无"}`);
}

// ---------------------------------------------------------------------------
// 导出（供测试/复用）
// ---------------------------------------------------------------------------
module.exports = {
  buildLocalizationJS,
  injectPreload,
  injectMenu,
  injectTray,
  injectLoadingOverlay,
  findAppDir,
  install,
  uninstall,
  check,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const [cmd, argvDir] = process.argv.slice(2);
  try {
  if (cmd === "install" || cmd === "uninstall" || cmd === "check") {
    const appDir = findAppDir(argvDir);
    if (cmd === "install") install(appDir);
    else if (cmd === "uninstall") uninstall(appDir);
    else check(appDir);
  } else {
    console.log("用法:");
    console.log("  node localization_engine.js install   [安装目录]");
    console.log("  node localization_engine.js uninstall [安装目录]");
    console.log("  node localization_engine.js check     [安装目录]");
    process.exit(1);
  }
} catch (e) {
  console.error("[antigravity-zh] 错误: " + e.message);
  process.exit(1);
}
}