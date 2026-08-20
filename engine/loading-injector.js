"use strict";
/**
 * engine/loading-injector.js — 引擎通用层：启动加载页文案替换
 * 业务特有文案通过 labels（{ from, to }）传入，与具体应用无关。
 */
const fs = require("fs");
const { log } = require("./asar-tools");

function injectLoadingOverlay(loadingPath, labels) {
  const { from, to } = labels || {};
  if (!from || !to) throw new Error("loadingOverlay 注入需要 labels={from,to}");
  let src = fs.readFileSync(loadingPath, "utf8");
  if (src.includes(from)) {
    src = src.replace(from, to);
    fs.writeFileSync(loadingPath, src, "utf8");
    log("已注入 dist/loadingOverlay.js（加载页）");
  } else if (!src.includes(to)) {
    log("警告: 加载页文案未匹配到，已跳过");
  }
}

module.exports = { injectLoadingOverlay };