// Runs the sandbox runner in local mode (no Docker needed) to check judging.
// Skips languages whose toolchain isn't installed.
process.env.EXECUTION_MODE = 'local';
process.env.RUN_TIMEOUT_MS = '2000';

const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');

const { executeCode, runAgainstTestCases } = require('../src/utils/judgeService');

const has = (cmd, arg = '--version') => !spawnSync(cmd, [arg]).error;
const python = process.platform === 'win32' ? 'python' : 'python3';

test('javascript: passes and fails test cases', async () => {
  const code = 'const n = Number(require("fs").readFileSync(0, "utf8")); console.log(n * 2);';
  const r = await runAgainstTestCases('javascript', code, [
    { input: '2', expectedOutput: '4' },
    { input: '3', expectedOutput: '7' }
  ]);
  assert.strictEqual(r.passedCount, 1);
  assert.strictEqual(r.overallStatus, 'wrong_answer');
});

test('javascript: infinite loop is a time limit, not a hang', async () => {
  const start = Date.now();
  const r = await executeCode('javascript', 'while (true) {}', '');
  assert.strictEqual(r.status, 'time_limit');
  assert.ok(Date.now() - start < 10000);
});

test('runtime error after printing is reported as runtime_error', { skip: !has(python) }, async () => {
  const r = await executeCode('python', 'print(1)\nraise Exception("boom")', '');
  assert.strictEqual(r.status, 'runtime_error');
  assert.match(r.stderr, /boom/);
});

test('c++ compile error', { skip: !has('g++') }, async () => {
  const r = await executeCode('cpp', 'int main( { }', '');
  assert.strictEqual(r.status, 'compile_error');
});

test('unsupported language', async () => {
  const r = await executeCode('cobol', 'x', '');
  assert.strictEqual(r.status, 'compile_error');
});
