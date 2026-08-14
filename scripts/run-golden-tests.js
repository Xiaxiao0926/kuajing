#!/usr/bin/env node
/**
 * 黄金业务案例护栏测试（T2-3 实现）
 * 当前为占位脚本：tests/golden/ 尚未建立。
 * 实现后：读取 tests/golden/*.json，逐案例对 React/Python 引擎验证
 * {provenance, input, expected} 结构，任一数字不一致即退出码 1。
 */
const fs = require('fs');
const path = require('path');

const GOLDEN_DIR = path.join(__dirname, '..', 'tests', 'golden');

if (!fs.existsSync(GOLDEN_DIR)) {
    console.log('[test:golden] SKIP — tests/golden/ 尚未建立（T2-3 任务）。无案例可验证。');
    process.exit(0);
}

console.log('[test:golden] TODO — 案例目录存在但校验逻辑将在 T2-3 实现。');
process.exit(0);
