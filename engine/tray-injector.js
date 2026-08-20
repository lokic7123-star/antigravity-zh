"use strict";
/**
 * engine/tray-injector.js — 引擎通用层：Electron 托盘菜单翻译
 * 拦截 buildFromTemplate 前的模板按词表替换 label；业务特有文案通过 options 传入。
 */
const fs = require("fs");
const { MARK, stripInjected, log } = require("./asar-tools");

function injectTray(trayPath, opts) {
  const { dict, agentCount = false } = opts || {};
  let src = fs.readFileSync(trayPath, "utf8");
  src = stripInjected(src);
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

  if (agentCount) {
    // 翻译 agent 数量文案（业务特有，仅当仍是英文原文时）
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
  }
  fs.writeFileSync(trayPath, src, "utf8");
  log("已注入 dist/tray.js（托盘菜单）");
}

module.exports = { injectTray };