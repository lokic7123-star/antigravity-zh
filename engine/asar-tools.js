"use strict";
/**
 * engine/asar-tools.js — 引擎通用层：ASAR 解包/打包/备份/还原、进程管理、通用工具
 * 与具体应用无关，可跨 Electron 应用复用。
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MARK = "/* ===[ ANTIGRAVITY-ZH ]=== */";

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

function findAppDir(argvDir, opts) {
  const { exeName = "app.exe", defaultDir, asarName = "app.asar" } = opts || {};
  const candidates = [argvDir, defaultDir].filter(Boolean);
  for (const dir of candidates) {
    const exe = path.join(dir, exeName);
    const asar = path.join(dir, "resources", asarName);
    if (fs.existsSync(exe) && fs.existsSync(asar)) return dir;
  }
  throw new Error(
    `未找到应用安装目录（需要 ${exeName} + resources/${asarName}）。请手动指定安装目录。`
  );
}

function killApp(exeName) {
  try {
    spawnSync("taskkill", ["/f", "/im", exeName, "/t"], { stdio: "ignore", windowsHide: true });
  } catch {
    /* 进程不存在则忽略 */
  }
}

function backupAsar(asarPath, bakName, logFn) {
  const bakPath = path.join(path.dirname(asarPath), bakName);
  if (!fs.existsSync(bakPath)) {
    fs.copyFileSync(asarPath, bakPath);
    (logFn || log)(`已备份原始文件: ${bakName}`);
  }
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripInjected(src, mark) {
  const m = mark || MARK;
  return src.replace(new RegExp(`\\n?${escapeReg(m)}[\\s\\S]*?${escapeReg(m)}`), "");
}

module.exports = { MARK, log, runSync, readJson, findAppDir, killApp, backupAsar, stripInjected };