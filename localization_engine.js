"use strict";
/**
 * localization_engine.js — Antigravity 中文汉化 · 应用装配入口
 *
 * 架构思路参考 qqxpee/antigravity2-cn（无许可证，仅借鉴思路），代码为自写实现；
 * 词表来源 kdczyz/antigravity-chinese（MIT 协议），保留 MIT 声明，详见 LICENSE。
 *
 * 本文件仅负责「应用装配」：声明目标应用路径、组装 engine（通用层）+ dicts（业务层）、
 * 提供 CLI。通用注入逻辑位于 engine/，理论上可复用给任何 Electron 应用。
 *
 * 用法：
 *   node localization_engine.js install        [安装目录]  汉化（默认 %LOCALAPPDATA%\Programs\antigravity）
 *   node localization_engine.js ensure         [安装目录]  已注入则跳过，被更新覆盖后自动重装（供启动器调用）
 *   node localization_engine.js uninstall      [安装目录]  还原官方英文（恢复 app.asar.bak）
 *   node localization_engine.js check          [安装目录]  查看当前状态
 *   node localization_engine.js check --coverage            覆盖率报告
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const { MARK, readJson, findAppDir, killApp, backupAsar } = require("./engine/asar-tools");
const { buildLocalizationJS, injectPreload } = require("./engine/preload-injector");
const { injectMenu } = require("./engine/menu-injector");
const { injectTray } = require("./engine/tray-injector");
const { injectLoadingOverlay } = require("./engine/loading-injector");
const { loadDicts } = require("./engine/dicts");
const { coverage: coverageRun } = require("./engine/coverage");

const EXE_NAME = "Antigravity.exe";
const DEFAULT_APP_DIR = path.join(process.env.LOCALAPPDATA || "", "Programs", "antigravity");
const ASAR = "app.asar";
const BAK = "app.asar.bak";
const DICT_DIR = path.join(__dirname, "dicts");

function log(msg) {
  console.log("[antigravity-zh] " + msg);
}

function findDir(argvDir) {
  return findAppDir(argvDir, { exeName: EXE_NAME, defaultDir: DEFAULT_APP_DIR, asarName: ASAR });
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
function install(appDir) {
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, ASAR);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "antigravity-zh-"));

  log("1/5 关闭正在运行的 Antigravity…");
  killApp(EXE_NAME);

  log("2/5 备份原始 app.asar…");
  backupAsar(asarPath, BAK, log);

  log("3/5 解包 app.asar…");
  require("./engine/asar-tools").runSync("npx", ["-y", "@electron/asar", "extract", asarPath, tmpDir]);

  log("4/5 注入汉化代码…");
  const { dict, patterns } = loadDicts(DICT_DIR);
  injectPreload(path.join(tmpDir, "dist", "preload.js"), buildLocalizationJS(dict, patterns));
  injectMenu(path.join(tmpDir, "dist", "menu.js"), readJson(path.join(DICT_DIR, "menu.json")));
  injectTray(path.join(tmpDir, "dist", "tray.js"), {
    dict: Object.assign(readJson(path.join(DICT_DIR, "menu.json")), {
      "Open Antigravity": "打开 Antigravity",
      "Show Antigravity": "显示 Antigravity",
      "Quit Antigravity": "退出 Antigravity",
      "Hide Antigravity": "隐藏 Antigravity",
    }),
    agentCount: true,
  });
  injectLoadingOverlay(path.join(tmpDir, "dist", "loadingOverlay.js"), {
    from: "Loading Antigravity",
    to: "正在加载 Antigravity",
  });

  log("5/5 重新打包 app.asar…");
  require("./engine/asar-tools").runSync("npx", ["-y", "@electron/asar", "pack", tmpDir, asarPath]);

  fs.rmSync(tmpDir, { recursive: true, force: true });
  log("完成！现在可以启动 Antigravity，界面即为中文。");
  log("如需还原官方英文：node localization_engine.js uninstall");
}

function uninstall(appDir) {
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, ASAR);
  const bakPath = path.join(resourcesDir, BAK);

  log("关闭正在运行的 Antigravity…");
  killApp(EXE_NAME);

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

function ensure(appDir) {
  const asarPath = path.join(appDir, "resources", ASAR);
  const localized = fs.readFileSync(asarPath, "utf8").includes("ANTIGRAVITY-ZH");
  if (localized) {
    log("汉化已注入，无需处理。");
    return;
  }
  log("检测到汉化丢失（可能被应用更新覆盖），自动重新注入…");
  install(appDir);
}

function coverage(appDir) {
  coverageRun(appDir, DICT_DIR, {
    appName: "Antigravity",
    outFile: path.join(__dirname, "coverage-report.json"),
  });
}

// ---------------------------------------------------------------------------
// 导出（供测试/复用）
// ---------------------------------------------------------------------------
module.exports = {
  buildLocalizationJS: (dictDir) => {
    const { dict, patterns } = loadDicts(dictDir || DICT_DIR);
    return buildLocalizationJS(dict, patterns);
  },
  loadDicts,
  injectPreload,
  injectMenu,
  injectTray,
  injectLoadingOverlay,
  findAppDir: findDir,
  install,
  uninstall,
  check,
  coverage,
};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const cmd = args[0];
  let argvDir = args[1];
  let covMode = false;
  if (argvDir === "--coverage") {
    covMode = true;
    argvDir = undefined;
  }
  try {
  if (cmd === "install" || cmd === "ensure" || cmd === "uninstall" || cmd === "check") {
    const appDir = findDir(argvDir);
    if (cmd === "install") install(appDir);
    else if (cmd === "ensure") ensure(appDir);
    else if (cmd === "uninstall") uninstall(appDir);
    else if (covMode) coverage(appDir);
    else check(appDir);
  } else {
    console.log("用法:");
    console.log("  node localization_engine.js install        [安装目录]  汉化");
    console.log("  node localization_engine.js ensure         [安装目录]  已注入则跳过，丢失则自动重装");
    console.log("  node localization_engine.js uninstall      [安装目录]  还原官方英文");
    console.log("  node localization_engine.js check          [安装目录]  查看状态");
    console.log("  node localization_engine.js check --coverage            覆盖率报告");
    process.exit(1);
  }
} catch (e) {
  console.error("[antigravity-zh] 错误: " + e.message);
  process.exit(1);
}
}