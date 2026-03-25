/**
 * Docker Sandbox Code Runner
 *
 * Reads CODE, LANG, INPUT from environment variables.
 * Compiles (if needed), runs, and outputs JSON result to stdout.
 *
 * Supported languages: python, cpp, c, java, javascript
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 5000; // 5 second execution timeout

const code = process.env.CODE || '';
const lang = (process.env.LANG || 'python').toLowerCase().trim();
const input = process.env.INPUT || '';

const WORK_DIR = '/sandbox/work';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf-8');
}

function run(command) {
  try {
    const result = execSync(command, {
      timeout: TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      cwd: WORK_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: process.env.PATH }
    });
    return { stdout: result.toString('utf-8'), stderr: '' };
  } catch (err) {
    // Check if it was a timeout
    if (err.killed || (err.signal && err.signal === 'SIGTERM')) {
      return { stdout: '', stderr: 'Time Limit Exceeded', timedOut: true };
    }
    return {
      stdout: (err.stdout || '').toString('utf-8'),
      stderr: (err.stderr || '').toString('utf-8') || err.message
    };
  }
}

function execute() {
  ensureDir(WORK_DIR);

  const inputFile = path.join(WORK_DIR, 'input.txt');
  writeFile(inputFile, input);

  let result;

  switch (lang) {
    case 'python':
    case 'python3': {
      const codeFile = path.join(WORK_DIR, 'solution.py');
      writeFile(codeFile, code);
      result = run(`python3 "${codeFile}" < "${inputFile}"`);
      break;
    }

    case 'cpp':
    case 'c++': {
      const codeFile = path.join(WORK_DIR, 'solution.cpp');
      const binFile = path.join(WORK_DIR, 'solution');
      writeFile(codeFile, code);

      // Compile
      const compileResult = run(`g++ -o "${binFile}" "${codeFile}" -std=c++17 -O2`);
      if (compileResult.stderr) {
        result = { stdout: '', stderr: compileResult.stderr, compileError: true };
        break;
      }

      // Run
      result = run(`"${binFile}" < "${inputFile}"`);
      break;
    }

    case 'c': {
      const codeFile = path.join(WORK_DIR, 'solution.c');
      const binFile = path.join(WORK_DIR, 'solution');
      writeFile(codeFile, code);

      const compileResult = run(`g++ -x c -o "${binFile}" "${codeFile}" -O2`);
      if (compileResult.stderr) {
        result = { stdout: '', stderr: compileResult.stderr, compileError: true };
        break;
      }

      result = run(`"${binFile}" < "${inputFile}"`);
      break;
    }

    case 'java': {
      const codeFile = path.join(WORK_DIR, 'Main.java');
      writeFile(codeFile, code);

      // Compile
      const compileResult = run(`javac "${codeFile}"`);
      if (compileResult.stderr) {
        result = { stdout: '', stderr: compileResult.stderr, compileError: true };
        break;
      }

      // Run
      result = run(`java -cp "${WORK_DIR}" Main < "${inputFile}"`);
      break;
    }

    case 'javascript':
    case 'js':
    case 'node': {
      const codeFile = path.join(WORK_DIR, 'solution.js');
      writeFile(codeFile, code);
      result = run(`node "${codeFile}" < "${inputFile}"`);
      break;
    }

    default:
      result = { stdout: '', stderr: `Unsupported language: ${lang}` };
  }

  // Output JSON to stdout for the host to parse
  const output = {
    output: (result.stdout || '').trimEnd(),
    error: result.stderr || '',
    timedOut: result.timedOut || false,
    compileError: result.compileError || false
  };

  process.stdout.write(JSON.stringify(output));
}

try {
  execute();
} catch (err) {
  process.stdout.write(JSON.stringify({
    output: '',
    error: err.message || 'Unexpected error in sandbox',
    timedOut: false,
    compileError: false
  }));
}
