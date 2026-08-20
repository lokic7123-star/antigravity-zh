"use strict";
/**
 * engine/dicts.js — 引擎通用层：词表目录加载
 * 遍历词表目录合并全部 JSON（跳过数组与 _meta），并读取 patterns.json（兼容新/旧结构）。
 */
const fs = require("fs");
const path = require("path");
const { readJson } = require("./asar-tools");

function loadDicts(dictDir) {
  const dict = {};
  for (const f of fs.readdirSync(dictDir).filter((x) => x.endsWith(".json"))) {
    const data = readJson(path.join(dictDir, f));
    if (Array.isArray(data)) continue;
    for (const k in data) {
      if (k !== "_meta") dict[k] = data[k];
    }
  }
  const pat = readJson(path.join(dictDir, "patterns.json"));
  const patterns = Array.isArray(pat) ? pat : pat.patterns;
  return { dict, patterns };
}

module.exports = { loadDicts };