/**
 * Sandbox code runner.
 *
 * Reads one JSON job from stdin:
 *   { "language": "python", "code": "...", "inputs": ["stdin for run 1", ...] }
 *
 * Compiles once (if needed), runs the program once per input, and writes one
 * JSON result to stdout:
 *   {
 *     "compileError": false,
 *     "error": "",                       // compile / setup error text
 *     "results": [
 *       { "output": "...", "error": "...", "timedOut": false, "exitCode": 0, "runtimeError": false }
 *     ]
 *   }
 *
 * Programs are started directly (no shell), so a timeout kills the user's
 * process itself and nothing is left running in the background.
 *
 * Inside Docker this runs as an unprivileged user with no network, capped
 * memory/CPU/pids and a read-only filesystem (see utils/runInDocker.js).
 *
 * Supported languages: python, cpp, c, java, javascript
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RUN_TIMEOUT_MS = parseInt(process.env.RUN_TIMEOUT_MS || '5000', 10);
const COMPILE_TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT_MS || '20000', 10);
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

// Per-execution working directory. Inside Docker it is a tmpfs; locally the
// parent passes a UUID-keyed folder so concurrent runs never collide.
const WORK_DIR = process.env.WORK_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'devprep-'));

// ─── Path sanitizer ───────────────────────────────────────────────────────────
// Strips absolute server paths from error messages so users never see
// internal filesystem details.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const PATH_PATTERNS = [
  new RegExp(escapeRegex(WORK_DIR).replace(/\\\\|\//g, '[/\\\\]') + '[/\\\\]?', 'gi'),
  /[A-Za-z]:[/\\][^\s"':]*/g, // Windows absolute paths
  /\/(?:home|tmp|sandbox|usr|var|root|Users)\/[^\s"':]*/g, // POSIX absolute paths
];

function sanitizeError(msg) {
  if (!msg) return '';
  let clean = String(msg);
  for (const pattern of PATH_PATTERNS) clean = clean.replace(pattern, '');
  return clean.trim();
}

// ─── Device Guard / Security policy detector (Windows local mode) ───────────
function isDeviceGuardError(msg) {
  if (!msg) return false;
  const m = String(msg).toLowerCase();
  return (
    m.includes('device guard') ||
    m.includes('your organization') ||
    m.includes('blocked by') ||
    m.includes('wldp') ||
    m.includes('code integrity')
  );
}

const DEVICE_GUARD_MESSAGE =
  'Execution blocked by system security policy (Device Guard). Compiled languages (C++/C/Java) cannot run in this environment. Please use JavaScript or Python.';

/**
 * Run a command without a shell.
 * @returns {{ stdout, stderr, status, timedOut, spawnError }}
 */
function run(cmd, args, { input = '', timeoutMs = RUN_TIMEOUT_MS } = {}) {
  const r = spawnSync(cmd, args, {
    cwd: WORK_DIR,
    input,
    timeout: timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer: MAX_OUTPUT_BYTES,
    windowsHide: true,
    env: process.env,
  });

  const stdout = r.stdout ? r.stdout.toString('utf-8') : '';
  const stderr = r.stderr ? r.stderr.toString('utf-8') : '';
  const timedOut = Boolean(r.error && r.error.code === 'ETIMEDOUT');
  const outputTooLarge = Boolean(r.error && r.error.code === 'ENOBUFS');

  return {
    stdout,
    stderr: outputTooLarge ? 'Output limit exceeded' : stderr,
    status: r.status,
    signal: r.signal,
    timedOut,
    spawnError: r.error && !timedOut && !outputTooLarge ? r.error.message : '',
  };
}

function runtimeResult(r) {
  if (r.timedOut) {
    return { output: '', error: 'Time Limit Exceeded', timedOut: true, exitCode: null, runtimeError: false };
  }
  const rawErr = r.spawnError || r.stderr;
  if (isDeviceGuardError(rawErr)) {
    return { output: '', error: DEVICE_GUARD_MESSAGE, timedOut: false, exitCode: r.status, runtimeError: true };
  }
  const failed = r.status !== 0 || Boolean(r.spawnError);
  let error = sanitizeError(rawErr);
  if (failed && !error && r.signal === 'SIGKILL') error = 'Process killed (memory limit exceeded?)';
  if (failed && !error && r.signal) error = `Process terminated (${r.signal})`;
  if (failed && !error && r.status != null) error = `Process exited with code ${r.status}`;
  return {
    output: (r.stdout || '').trimEnd(),
    error,
    timedOut: false,
    exitCode: r.status,
    runtimeError: failed,
  };
}

function compile(cmd, args) {
  const r = run(cmd, args, { timeoutMs: COMPILE_TIMEOUT_MS });
  if (r.timedOut) return 'Compilation timed out';
  if (r.status !== 0 || r.spawnError) {
    const raw = r.stderr || r.stdout || r.spawnError || 'Compilation failed';
    return isDeviceGuardError(raw) ? DEVICE_GUARD_MESSAGE : sanitizeError(raw) || 'Compilation failed';
  }
  return null;
}

function prepare(language, code) {
  const exe = process.platform === 'win32' ? 'solution.exe' : 'solution';
  switch (language) {
    case 'python':
    case 'python3': {
      fs.writeFileSync(path.join(WORK_DIR, 'solution.py'), code, 'utf-8');
      const py = process.platform === 'win32' ? 'python' : 'python3';
      return { cmd: py, args: ['solution.py'] };
    }
    case 'cpp':
    case 'c++': {
      fs.writeFileSync(path.join(WORK_DIR, 'solution.cpp'), code, 'utf-8');
      const err = compile('g++', ['-std=c++17', '-O2', '-o', exe, 'solution.cpp']);
      if (err) return { compileError: err };
      return { cmd: path.join(WORK_DIR, exe), args: [] };
    }
    case 'c': {
      fs.writeFileSync(path.join(WORK_DIR, 'solution.c'), code, 'utf-8');
      const err = compile('gcc', ['-O2', '-o', exe, 'solution.c', '-lm']);
      if (err) return { compileError: err };
      return { cmd: path.join(WORK_DIR, exe), args: [] };
    }
    case 'java': {
      fs.writeFileSync(path.join(WORK_DIR, 'Main.java'), code, 'utf-8');
      const err = compile('javac', ['-J-Xmx256m', 'Main.java']);
      if (err) return { compileError: err };
      return { cmd: 'java', args: ['-Xmx256m', '-Xss64m', '-cp', '.', 'Main'] };
    }
    case 'javascript':
    case 'js':
    case 'node': {
      fs.writeFileSync(path.join(WORK_DIR, 'solution.js'), code, 'utf-8');
      return { cmd: process.execPath, args: ['solution.js'] };
    }
    default:
      return { setupError: `Unsupported language: ${language}` };
  }
}

function readJob() {
  const raw = fs.readFileSync(0, 'utf-8');
  const job = JSON.parse(raw || '{}');
  return {
    language: String(job.language || 'python').toLowerCase().trim(),
    code: String(job.code || ''),
    inputs: Array.isArray(job.inputs) && job.inputs.length ? job.inputs.map((i) => String(i ?? '')) : [''],
  };
}

function main() {
  const { language, code, inputs } = readJob();
  fs.mkdirSync(WORK_DIR, { recursive: true });

  const prepared = prepare(language, code);
  if (prepared.compileError || prepared.setupError) {
    return {
      compileError: Boolean(prepared.compileError),
      error: prepared.compileError || prepared.setupError,
      results: [],
    };
  }

  const results = inputs.map((input) => runtimeResult(run(prepared.cmd, prepared.args, { input })));
  return { compileError: false, error: '', results };
}

let out;
try {
  out = main();
} catch (err) {
  out = {
    compileError: false,
    error: sanitizeError(err && err.message) || 'An unexpected error occurred in the sandbox.',
    results: [],
  };
} finally {
  if (!process.env.WORK_DIR) {
    try { fs.rmSync(WORK_DIR, { recursive: true, force: true }); } catch (_) { /* ignore */ }
  }
}
process.stdout.write(JSON.stringify(out));
