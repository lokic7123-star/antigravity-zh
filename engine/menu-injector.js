"use strict";
/**
 * engine/menu-injector.js — 引擎通用层：Electron 原生应用菜单翻译
 * 拦截 Menu.setApplicationMenu 前的菜单模板，按词表替换 label，与具体应用无关。
 */
const fs = require("fs");
const { MARK, stripInjected, log } = require("./asar-tools");

function injectMenu(menuPath, dict) {
  let src = fs.readFileSync(menuPath, "utf8");
  src = stripInjected(src);
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

module.exports = { injectMenu };