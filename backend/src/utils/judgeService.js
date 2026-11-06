/**
 * Judge Service — runs user code through the sandbox (utils/runInDocker.js).
 *
 * Exports: executeCode(), runAgainstTestCases(), compareOutput(), SUPPORTED_LANGUAGES
 */

const path = require('path');
const { runJob } = require('./runInDocker');
const { AppError } = require('./AppError');

const SUPPORTED_LANGUAGES = [
  'javascript', 'js', 'node',
  'python', 'python3',
  'cpp', 'c++',
  'c',
  'java'
];
const SUPPORTED_SET = new Set(SUPPORTED_LANGUAGES);

// ─── Path sanitizer (second layer of defence) ─────────────────────────────────
const BACKEND_ROOT = path.resolve(__dirname, '../..');

const SERVER_PATH_PATTERNS = [
  new RegExp(
    BACKEND_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\\|\//g, '[/\\\\]') + '[/\\\\]?[^\n"]*',
    'gi'
  ),
  /\(([A-Za-z]:[/\\][^)\n]+)\)/g,
  /[A-Za-z]:[/\\][^\n"']*/g,
];

function sanitizeServerPaths(msg) {
  if (!msg) return '';
  let clean = String(msg);
  for (const pattern of SERVER_PATH_PATTERNS) {
    clean = clean.replace(pattern, '<sandbox>');
  }
  return clean;
}

function unsupported(language) {
  return {
    stdout: '',
    stderr: `Unsupported language: ${language}`,
    status: 'compile_error',
    time: '0',
    memory: '0',
    compileOutput: `Unsupported language: ${language}`
  };
}

/** Map one sandbox run result onto the judge interface. */
function toJudgeResult(r, elapsed) {
  const error = sanitizeServerPaths(r.error || '');
  if (r.timedOut) {
    return { stdout: '', stderr: 'Time Limit Exceeded', status: 'time_limit', time: elapsed, memory: '0', compileOutput: '' };
  }
  if (r.runtimeError) {
    // Keep partial stdout so the user can see how far the program got
    return { stdout: r.output || '', stderr: error, status: 'runtime_error', time: elapsed, memory: '0', compileOutput: '' };
  }
  return { stdout: r.output || '', stderr: error, status: 'accepted', time: elapsed, memory: '0', compileOutput: '' };
}

/**
 * Run code once per input. Throws AppError(503) when the sandbox itself is
 * unavailable, so callers never record that as the user's failure.
 */
async function runBatch(language, sourceCode, inputs) {
  const lang = String(language).toLowerCase().trim();
  if (!SUPPORTED_SET.has(lang)) return inputs.map(() => unsupported(language));

  const start = Date.now();
  const job = await runJob({ language: lang, code: sourceCode, inputs });
  const elapsed = ((Date.now() - start) / 1000 / Math.max(1, inputs.length)).toFixed(3);

  if (job.infraError) {
    throw new AppError(job.error || 'Code execution is temporarily unavailable', 503);
  }

  if (job.compileError) {
    const msg = sanitizeServerPaths(job.error);
    return inputs.map(() => ({ stdout: '', stderr: msg, status: 'compile_error', time: '0', memory: '0', compileOutput: msg }));
  }

  if (job.error && !job.results.length) {
    const msg = sanitizeServerPaths(job.error);
    return inputs.map(() => ({ stdout: '', stderr: msg, status: 'runtime_error', time: '0', memory: '0', compileOutput: '' }));
  }

  return inputs.map((_, i) =>
    job.results[i]
      ? toJudgeResult(job.results[i], elapsed)
      : { stdout: '', stderr: 'Time Limit Exceeded', status: 'time_limit', time: elapsed, memory: '0', compileOutput: '' }
  );
}

/**
 * Execute code with given stdin input.
 * @returns {{ stdout, stderr, status, time, memory, compileOutput }}
 */
async function executeCode(language, sourceCode, stdin = '') {
  const [result] = await runBatch(language, sourceCode, [stdin]);
  return result;
}

/** Compare user output to expected output (trim, normalise line endings). */
function compareOutput(userOutput, expectedOutput) {
  const normalize = (s) =>
    String(s || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .trim();
  return normalize(userOutput) === normalize(expectedOutput);
}

/**
 * Run code against an array of test cases (compiled once), compare outputs.
 * @returns {{ results, passedCount, totalCount, overallStatus }}
 */
async function runAgainstTestCases(language, sourceCode, testCases) {
  const execResults = await runBatch(language, sourceCode, testCases.map((tc) => tc.input));

  const results = [];
  let passedCount = 0;

  testCases.forEach((tc, i) => {
    const execResult = execResults[i];
    const actualOutput = (execResult.stdout || '').trim();
    const expectedOutput = (tc.expectedOutput || '').trim();
    const passed = execResult.status === 'accepted' && compareOutput(actualOutput, expectedOutput);
    if (passed) passedCount++;

    results.push({
      input: tc.input,
      expectedOutput,
      actualOutput,
      passed,
      status: passed ? 'accepted' : execResult.status === 'accepted' ? 'wrong_answer' : execResult.status,
      time: execResult.time,
      memory: execResult.memory,
      stderr: execResult.stderr,
      compileOutput: execResult.compileOutput
    });
  });

  // A compile error is the same for every test, report it once
  const trimmed = results.length && results[0].status === 'compile_error' ? [results[0]] : results;

  // Most severe failure wins:
  // compile_error > time_limit > memory_limit > runtime_error > wrong_answer > accepted
  const SEVERITY = { compile_error: 5, time_limit: 4, memory_limit: 3, runtime_error: 2, wrong_answer: 1, accepted: 0 };
  let overallStatus = 'accepted';
  if (passedCount < testCases.length) {
    for (const r of trimmed) {
      if (!r.passed) {
        const s = r.status || 'wrong_answer';
        if ((SEVERITY[s] || 0) > (SEVERITY[overallStatus] || 0)) overallStatus = s;
      }
    }
    if (overallStatus === 'accepted') overallStatus = 'wrong_answer';
  }

  return {
    results: trimmed,
    passedCount,
    totalCount: testCases.length,
    overallStatus
  };
}

module.exports = {
  executeCode,
  runAgainstTestCases,
  compareOutput,
  SUPPORTED_LANGUAGES
};
