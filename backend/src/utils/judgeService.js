/**
 * Judge Service — Docker-based code execution.
 *
 * Drop-in replacement for the Judge0 API version.
 * Exports the same interface: executeCode(), runAgainstTestCases()
 */

const { runCode: dockerRunCode } = require('./runInDocker');

const SUPPORTED_LANGUAGES = new Set([
  'javascript', 'js', 'node',
  'python', 'python3',
  'cpp', 'c++',
  'c',
  'java'
]);

/**
 * Execute code with given stdin input.
 *
 * @param {string} language
 * @param {string} sourceCode
 * @param {string} stdin
 * @returns {{ stdout, stderr, status, time, memory, compileOutput }}
 */
async function executeCode(language, sourceCode, stdin = '') {
  const lang = String(language).toLowerCase().trim();

  if (!SUPPORTED_LANGUAGES.has(lang)) {
    return {
      stdout: '',
      stderr: `Unsupported language: ${language}`,
      status: 'error',
      time: '0',
      memory: '0',
      compileOutput: ''
    };
  }

  const start = Date.now();
  const result = await dockerRunCode({ code: sourceCode, language: lang, input: stdin });
  const elapsed = ((Date.now() - start) / 1000).toFixed(3);

  // Map Docker result to the standard judge interface
  if (result.timedOut) {
    return {
      stdout: '',
      stderr: 'Time Limit Exceeded',
      status: 'time_limit',
      time: elapsed,
      memory: '0',
      compileOutput: ''
    };
  }

  if (result.compileError) {
    return {
      stdout: '',
      stderr: result.error,
      status: 'compile_error',
      time: elapsed,
      memory: '0',
      compileOutput: result.error
    };
  }

  if (result.error && !result.output) {
    return {
      stdout: '',
      stderr: result.error,
      status: 'runtime_error',
      time: elapsed,
      memory: '0',
      compileOutput: ''
    };
  }

  return {
    stdout: result.output,
    stderr: result.error || '',
    status: 'accepted',
    time: elapsed,
    memory: '0',
    compileOutput: ''
  };
}

/**
 * Compare user output to expected output.
 * Trims whitespace, normalises line endings.
 */
function compareOutput(userOutput, expectedOutput) {
  const normalize = (s) =>
    String(s || '')
      .replace(/\r\n/g, '\n')
      .trim();
  return normalize(userOutput) === normalize(expectedOutput);
}

/**
 * Run code against an array of test cases, compare outputs.
 *
 * @param {string} language
 * @param {string} sourceCode
 * @param {Array<{input: string, expectedOutput: string}>} testCases
 * @returns {{ results, passedCount, totalCount, overallStatus }}
 */
async function runAgainstTestCases(language, sourceCode, testCases) {
  const results = [];
  let passedCount = 0;

  for (const tc of testCases) {
    const execResult = await executeCode(language, sourceCode, tc.input);

    const actualOutput = (execResult.stdout || '').trim();
    const expectedOutput = (tc.expectedOutput || '').trim();
    const passed =
      execResult.status === 'accepted' && compareOutput(actualOutput, expectedOutput);

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

    // Stop early on compile error (all subsequent tests will fail the same way)
    if (execResult.status === 'compile_error') break;
  }

  let overallStatus = 'accepted';
  if (passedCount === 0 && testCases.length > 0) {
    overallStatus = results[0]?.status || 'wrong_answer';
  } else if (passedCount < testCases.length) {
    overallStatus = 'wrong_answer';
  }

  return {
    results,
    passedCount,
    totalCount: testCases.length,
    overallStatus
  };
}

module.exports = {
  executeCode,
  runAgainstTestCases,
  compareOutput
};
