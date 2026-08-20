"use strict";
/**
 * engine/coverage.js — 引擎通用层：静态覆盖率检测
 * 解包应用源码，扫描词表字面量命中情况，输出报告。适用于任意 Electron 应用。
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { runSync, stripInjected, readJson } = require("./asar-tools");
const { loadDicts } = require("./dicts");

function coverage(appDir, dictDir, opts) {
  const { asarName = "app.asar", appName = "应用", outFile } = opts || {};
  const resourcesDir = path.join(appDir, "resources");
  const asarPath = path.join(resourcesDir, asarName);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "antigravity-zh-cov-"));
  try {
    runSync("npx", ["-y", "@electron/asar", "extract", asarPath, tmpDir]);

    let code = "";
    const walk = (d) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (/\.(js|html|json|ts|mjs|cjs)$/i.test(f)) {
          let content = fs.readFileSync(p, "utf8");
          content = stripInjected(content);
          code += content + "\n";
        }
      }
    };
    walk(tmpDir);

    const version = (readJson(path.join(tmpDir, "package.json")).version || "unknown").replace(/^v/i, "");
    const { patterns } = loadDicts(dictDir);

    const dictFiles = fs.readdirSync(dictDir).filter((x) => x.endsWith(".json"));
    const testedSet = new Set();
    const report = { version, dicts: {}, patterns: patterns.length, tested_against: [] };
    for (const f of dictFiles) {
      const data = readJson(path.join(dictDir, f));
      if (Array.isArray(data)) continue;
      if (data._meta && Array.isArray(data._meta.tested_against)) {
        for (const v of data._meta.tested_against) testedSet.add(v);
      }
      if (f === "patterns.json") continue;
      const keys = Object.keys(data).filter((k) => k !== "_meta");
      const matched = keys.filter((k) => code.includes(k));
      report.dicts[f] = {
        matched: matched.length,
        total: keys.length,
        rate: keys.length ? Math.round((matched.length / keys.length) * 100) : 0,
        dynamic: f === "skills.json" || f === "phrases.json",
        unmatched: keys.filter((k) => !matched.includes(k)),
      };
    }
    report.tested_against = [...testedSet];

    console.log(`本次检测版本: ${appName} v${version}`);
    console.log("说明: 静态检测扫描应用源码中的词条字面量命中，仅供参考。");
    console.log("      应用大量界面文本由运行时动态加载，命中率不代表实际汉化覆盖率。");
    console.log("      检测主要用于版本升级后的词条失效预警与废弃词条清理。");
    for (const [f, r] of Object.entries(report.dicts)) {
      console.log(`${f.padEnd(16)} 字面量命中 ${String(r.matched).padStart(3)}/${r.total} (${String(r.rate).padStart(3)}%)`);
    }
    console.log(`${"patterns.json".padEnd(16)} ${report.patterns} 条正则规则（运行时匹配）`);
    if (!testedSet.has(version)) {
      console.log(`\n警告: 当前版本 v${version} 不在已测试列表 [${[...testedSet].join(", ")}] 中，汉化可能不完整。`);
    }
    if (outFile) {
      fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
      console.log(`\n覆盖率报告已写入 ${path.basename(outFile)}`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { coverage };