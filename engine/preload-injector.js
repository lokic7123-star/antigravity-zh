"use strict";
/**
 * engine/preload-injector.js — 引擎通用层：运行时本地化注入
 * 生成并注入渲染进程翻译脚本（MutationObserver + DOM 翻译），与具体应用无关。
 */
const fs = require("fs");
const { MARK, stripInjected, log } = require("./asar-tools");

function buildLocalizationJS(dict, patterns) {
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
  var RE_CACHE = KEYS.map(function (key) {
    var sw = /^[A-Za-z0-9]/.test(key);
    var ew = /[A-Za-z0-9]$/.test(key);
    var re = new RegExp((sw ? '(?<![A-Za-z0-9])' : '') + escapeRegExp(key) + (ew ? '(?![A-Za-z0-9])' : ''), 'g');
    return [re, LOWER.get(key.toLowerCase())];
  });
  function translate(value) {
    if (!value || typeof value !== 'string' || !/[A-Za-z]/.test(value)) return value;
    var next = value;
    for (var i = 0; i < RE_CACHE.length; i++) {
      next = next.replace(RE_CACHE[i][0], RE_CACHE[i][1]);
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

function injectPreload(preloadPath, js) {
  let src = fs.readFileSync(preloadPath, "utf8");
  src = stripInjected(src);
  const injected = src.replace(/\s*$/, "\n") + "\n" + MARK + "\n" + js + MARK + "\n";
  fs.writeFileSync(preloadPath, injected, "utf8");
  log("已注入 dist/preload.js（界面翻译引擎）");
}

module.exports = { buildLocalizationJS, injectPreload };