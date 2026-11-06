/**
 * Code execution launcher.
 *
 * Two modes, picked with EXECUTION_MODE:
 *
 *   docker (default) — every job runs in a fresh `devprep-executor` container
 *     with no network, capped memory/CPU/pids, a read-only root filesystem,
 *     all Linux capabilities dropped and an unprivileged user. This is the
 *     only mode that is safe for untrusted code.
 *
 *   local — runs executor/runCode.js as a child process on this machine.
 *     Convenient for development when Docker is not installed, but user code
 *     can touch the host. Refused when NODE_ENV=production unless
 *     ALLOW_UNSAFE_LOCAL_EXECUTION=true.
 *
 * When EXECUTION_MODE is not set and NODE_ENV=development, Docker is tried
 * first and, if it is missing, not running or the image is not built, the job
 * runs locally instead (with a warning in the server log), so Run and Submit
 * keep working on a development machine without Docker. Production never
 * falls back.
 *
 * The job (language, code, every test input) is sent to the runner as JSON on
 * stdin, so code size is not limited by environment-variable size, and a
 * program is compiled once per job instead of once per test case.
 *
 * Secrets are never passed to the runner, and an output sanitiser scrubs
 * known secret values as defence in depth.
 */

const { spawn, execFile } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

const EXECUTOR_PATH = path.resolve(__dirname, '../../executor/runCode.js');

const MODE_SET = Boolean(String(process.env.EXECUTION_MODE || '').trim());
const MODE = String(process.env.EXECUTION_MODE || 'docker').toLowerCase().trim();
// Development without an explicit mode: fall back to local when Docker is unavailable
const DEV_FALLBACK = !MODE_SET && process.env.NODE_ENV === 'development';
const DOCKER_RECHECK_MS = 60 * 1000;
let dockerDownUntil = 0;
const DOCKER_IMAGE = process.env.EXECUTOR_IMAGE || 'devprep-executor';
const DOCKER_BIN = process.env.DOCKER_BIN || 'docker';
const RUN_TIMEOUT_MS = parseInt(process.env.RUN_TIMEOUT_MS || '5000', 10);
const COMPILE_TIMEOUT_MS = parseInt(process.env.COMPILE_TIMEOUT_MS || '20000', 10);
const CONTAINER_MEMORY = process.env.EXECUTOR_MEMORY || '512m';
const CONTAINER_CPUS = process.env.EXECUTOR_CPUS || '1';
// Allowance for container start-up and runner overhead on top of the work itself
const STARTUP_SLACK_MS = 10000;
const MAX_STDOUT_BYTES = 10 * 1024 * 1024;

if (MODE === 'local') {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_UNSAFE_LOCAL_EXECUTION !== 'true') {
    throw new Error(
      'EXECUTION_MODE=local runs untrusted code on the host and is disabled in production. ' +
        'Use EXECUTION_MODE=docker, or set ALLOW_UNSAFE_LOCAL_EXECUTION=true if you accept the risk.'
    );
  }
  // eslint-disable-next-line no-console
  console.warn('[executor] EXECUTION_MODE=local: user code runs on this machine without a sandbox. Development only.');
}

// Capture secret values ONCE at module load so we can scrub them from output.
const SECRET_VALUES = [
  process.env.MONGO_URI,
  process.env.GROQ_API_KEY,
  process.env.CLERK_SECRET_KEY,
  process.env.CLERK_WEBHOOK_SECRET,
  process.env.RESEND_API_KEY,
  process.env.JWT_SECRET,
  process.env.HUGGINGFACE_API_KEY,
  process.env.GEMINI_API_KEY,
].filter((v) => v && v.length > 4);

function sanitizeOutput(str) {
  if (!str) return '';
  let out = String(str);
  for (const secret of SECRET_VALUES) {
    out = out.split(secret).join('[REDACTED]');
  }
  return out;
}

function infraError(message) {
  return { compileError: false, error: message, results: [], infraError: true };
}

function parseJobOutput(stdout) {
  try {
    const obj = JSON.parse(String(stdout || '').trim());
    return {
      compileError: Boolean(obj.compileError),
      error: sanitizeOutput(obj.error || ''),
      results: (Array.isArray(obj.results) ? obj.results : []).map((r) => ({
        output: sanitizeOutput(r.output || ''),
        error: sanitizeOutput(r.error || ''),
        timedOut: Boolean(r.timedOut),
        exitCode: r.exitCode ?? null,
        runtimeError: Boolean(r.runtimeError),
      })),
      infraError: false,
    };
  } catch {
    return null;
  }
}

/** Minimal, secrets-free environment for the local-mode child process. */
function buildLocalEnv(workDir) {
  const env = {
    WORK_DIR: workDir,
    PATH: process.env.PATH || '',
    RUN_TIMEOUT_MS: String(RUN_TIMEOUT_MS),
    COMPILE_TIMEOUT_MS: String(COMPILE_TIMEOUT_MS),
  };
  const passThrough = [
    'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'SystemDrive',
    'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'JAVA_HOME',
  ];
  for (const key of passThrough) {
    if (process.env[key]) env[key] = process.env[key];
  }
  return env;
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {});
    } else {
      process.kill(-child.pid, 'SIGKILL'); // whole process group (spawned detached)
    }
  } catch {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}

/**
 * Spawn a runner process, feed it the job on stdin and collect its stdout.
 * Kills it (and, through onTimeout, anything it started) after timeoutMs.
 */
function spawnRunner(cmd, args, { env, job, timeoutMs, detached, onTimeout }) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    const child = spawn(cmd, args, { env, detached, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      if (onTimeout) onTimeout(child);
      killTree(child);
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      if (stdout.length < MAX_STDOUT_BYTES) stdout += d.toString('utf-8');
    });
    child.stderr.on('data', (d) => {
      if (stderr.length < 64 * 1024) stderr += d.toString('utf-8');
    });
    child.on('error', (err) => finish({ spawnError: err, stdout, stderr, timedOut }));
    child.on('close', (code) => {
      // Local mode: the runner owns a process group; kill anything user code
      // left running in the background (e.g. a forked sleep) once it exits.
      if (detached) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* group already gone */ }
      }
      finish({ code, stdout, stderr, timedOut });
    });

    child.stdin.on('error', () => {}); // runner may exit before reading everything
    child.stdin.end(JSON.stringify(job));
  });
}

async function runInContainer(job, timeoutMs) {
  const name = `devprep-run-${crypto.randomUUID()}`;
  const args = [
    'run', '--rm', '-i',
    '--name', name,
    '--network', 'none',
    '--memory', CONTAINER_MEMORY,
    '--memory-swap', CONTAINER_MEMORY,
    '--cpus', CONTAINER_CPUS,
    '--pids-limit', '128',
    '--read-only',
    '--tmpfs', '/sandbox/work:rw,exec,nosuid,size=64m,mode=1777',
    '--tmpfs', '/tmp:rw,exec,nosuid,size=64m,mode=1777',
    '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges',
    '-e', `RUN_TIMEOUT_MS=${RUN_TIMEOUT_MS}`,
    '-e', `COMPILE_TIMEOUT_MS=${COMPILE_TIMEOUT_MS}`,
    DOCKER_IMAGE,
  ];

  const r = await spawnRunner(DOCKER_BIN, args, {
    env: process.env,
    job,
    timeoutMs,
    detached: false,
    // Killing the docker CLI does not stop the container, so stop it by name
    onTimeout: () => execFile(DOCKER_BIN, ['kill', name], () => {}),
  });

  if (r.spawnError) {
    return infraError('Code execution is unavailable: Docker was not found on the server.');
  }
  if (r.timedOut) return null;
  const parsed = parseJobOutput(r.stdout);
  if (parsed) return parsed;
  if (/Unable to find image|No such image|pull access denied/i.test(r.stderr)) {
    return infraError(`Code execution is unavailable: the "${DOCKER_IMAGE}" image is not built on the server.`);
  }
  if (/Cannot connect to the Docker daemon|error during connect|docker daemon|failed to connect to the docker API|docker\.sock|dockerDesktop\w*Engine/i.test(r.stderr)) {
    return infraError('Code execution is unavailable: the Docker daemon is not running.');
  }
  // eslint-disable-next-line no-console
  console.error('[executor] container failed:', r.code, r.stderr.slice(0, 2000));
  return infraError('Code execution failed unexpectedly. Please try again.');
}

async function runLocally(job, timeoutMs) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'devprep-run-'));
  try {
    const r = await spawnRunner(process.execPath, [EXECUTOR_PATH], {
      env: buildLocalEnv(workDir),
      job,
      timeoutMs,
      detached: process.platform !== 'win32',
    });
    if (r.timedOut) return null;
    const parsed = parseJobOutput(r.stdout);
    if (parsed) return parsed;
    return infraError(sanitizeOutput(r.stderr || (r.spawnError && r.spawnError.message) || 'Execution failed'));
  } finally {
    try { fs.rmSync(workDir, { recursive: true, force: true }); } catch { /* non-fatal */ }
  }
}

/**
 * Run one program against one or more stdin inputs.
 *
 * @param {{ language: string, code: string, inputs: string[] }} job
 * @returns {Promise<{ compileError: boolean, error: string, infraError: boolean,
 *   results: Array<{ output, error, timedOut, exitCode, runtimeError }> }>}
 */
async function runJob({ language, code, inputs }) {
  const job = {
    language: String(language).toLowerCase().trim(),
    code: String(code || ''),
    inputs: Array.isArray(inputs) && inputs.length ? inputs.map((i) => String(i ?? '')) : [''],
  };
  const timeoutMs = COMPILE_TIMEOUT_MS + job.inputs.length * (RUN_TIMEOUT_MS + 500) + STARTUP_SLACK_MS;

  let result;
  if (MODE === 'local') {
    result = await runLocally(job, timeoutMs);
  } else if (DEV_FALLBACK && Date.now() < dockerDownUntil) {
    result = await runLocally(job, timeoutMs);
  } else {
    result = await runInContainer(job, timeoutMs);
    if (DEV_FALLBACK && result && result.infraError) {
      // eslint-disable-next-line no-console
      console.warn(`[executor] ${result.error} Running code locally instead (development only). ` +
        'Build the image with "npm run build:executor" and start Docker to use the sandbox, or set EXECUTION_MODE=local to silence this.');
      dockerDownUntil = Date.now() + DOCKER_RECHECK_MS;
      result = await runLocally(job, timeoutMs);
    }
  }

  if (!result) {
    // The whole job ran out of time: report every test as TLE
    return {
      compileError: false,
      error: '',
      infraError: false,
      results: job.inputs.map(() => ({ output: '', error: 'Time Limit Exceeded', timedOut: true, exitCode: null, runtimeError: false })),
    };
  }
  return result;
}

module.exports = { runJob, MODE };
