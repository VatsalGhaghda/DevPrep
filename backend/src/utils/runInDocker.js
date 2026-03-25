/**
 * Docker-based code execution utility.
 *
 * Spawns a sandboxed Docker container to compile and run user code.
 * Container runs with: --rm, --network none, --memory 100m, --cpus 1
 *
 * The Docker image "code-runner" must be pre-built:
 *   docker build -t code-runner ./executor
 */

const { exec } = require('child_process');

const DOCKER_IMAGE = process.env.DOCKER_IMAGE || 'code-runner';
const DOCKER_TIMEOUT_MS = 15000; // 15s host timeout (container has 5s internal timeout)
const DOCKER_MEMORY = '100m';
const DOCKER_CPUS = '1';

/**
 * Run code inside a Docker container.
 *
 * @param {Object} opts
 * @param {string} opts.code     - source code to execute
 * @param {string} opts.language - "python", "cpp", "java", "javascript", etc.
 * @param {string} opts.input    - stdin input for the program
 * @returns {Promise<{output: string, error: string, timedOut: boolean, compileError: boolean}>}
 */
function runCode({ code, language, input = '' }) {
  return new Promise((resolve) => {
    // Sanitize: base64-encode env vars to avoid shell injection
    const codeB64 = Buffer.from(code).toString('base64');
    const inputB64 = Buffer.from(input).toString('base64');
    const lang = String(language).toLowerCase().trim();

    // Build docker run command
    // We pass code and input as base64 via env vars and decode inside a wrapper
    const cmd = [
      'docker run',
      '--rm',
      '--network none',
      `--memory=${DOCKER_MEMORY}`,
      `--cpus=${DOCKER_CPUS}`,
      '--pids-limit=64',
      `--env CODE_B64="${codeB64}"`,
      `--env INPUT_B64="${inputB64}"`,
      `--env LANG="${lang}"`,
      DOCKER_IMAGE,
      '/bin/sh', '-c',
      // Decode base64 into env vars then run the runner
      `"echo $CODE_B64 | base64 -d > /tmp/__code_raw && echo $INPUT_B64 | base64 -d > /tmp/__input_raw && CODE=$(cat /tmp/__code_raw) INPUT=$(cat /tmp/__input_raw) node /sandbox/runCode.js"`
    ].join(' ');

    exec(cmd, { timeout: DOCKER_TIMEOUT_MS, maxBuffer: 5 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        // Docker or timeout error
        if (err.killed || err.signal === 'SIGTERM') {
          return resolve({
            output: '',
            error: 'Execution timed out (container killed)',
            timedOut: true,
            compileError: false
          });
        }

        // Try to parse stdout anyway — container may have printed JSON before failing
        const parsed = tryParseJSON(stdout);
        if (parsed) return resolve(parsed);

        return resolve({
          output: '',
          error: stderr || err.message || 'Docker execution failed',
          timedOut: false,
          compileError: false
        });
      }

      // Parse JSON output from container
      const parsed = tryParseJSON(stdout);
      if (parsed) return resolve(parsed);

      // Fallback — container output wasn't JSON
      resolve({
        output: stdout.trim(),
        error: stderr || '',
        timedOut: false,
        compileError: false
      });
    });
  });
}

function tryParseJSON(str) {
  if (!str) return null;
  try {
    const obj = JSON.parse(str.trim());
    return {
      output: obj.output || '',
      error: obj.error || '',
      timedOut: obj.timedOut || false,
      compileError: obj.compileError || false
    };
  } catch {
    return null;
  }
}

module.exports = { runCode };
