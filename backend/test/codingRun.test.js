/**
 * Run and Submit in Coding Practice, through the real controller and the real
 * code runner. On a development machine without Docker the runner must fall
 * back to running code locally, so Run and Submit keep working.
 */
process.env.NODE_ENV = 'development';
delete process.env.EXECUTION_MODE;
process.env.DOCKER_BIN = 'devprep-docker-not-installed';
process.env.RUN_TIMEOUT_MS = '3000';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const src = (p) => path.join(__dirname, '..', 'src', p);
const stub = (file, exports) => {
  const id = require.resolve(src(file));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};

const PROBLEM_ID = '64b000000000000000000001';
const problem = {
  _id: PROBLEM_ID,
  title: 'Double it',
  testCases: [
    { input: '2', expectedOutput: '4', isHidden: false },
    { input: '5', expectedOutput: '10', isHidden: false },
    { input: '50', expectedOutput: '100', isHidden: true }
  ]
};
const lean = (v) => ({ lean: async () => v, select() { return this; } });
stub('models/CodingProblem.js', { findById: (id) => lean(String(id) === PROBLEM_ID ? problem : null), updateOne: async () => ({}) });

const attempts = new Map();
class FakeAttempt {
  constructor(d) { Object.assign(this, { status: 'active', submissionCount: 0, accepted: false, securityPolicy: {}, violationCount: 0 }, d); }
  async save() { attempts.set(String(this._id), this); return this; }
  static async findById(id) { return attempts.get(String(id)) || null; }
}
stub('models/CodingAttempt.js', FakeAttempt);
const submissions = [];
stub('models/Submission.js', { create: async (d) => { const s = { _id: `sub${submissions.length + 1}`, ...d }; submissions.push(s); return s; } });
stub('utils/resolveUser.js', { resolveUser: async () => ({ _id: 'user-1', clerkUserId: 'clerk-1' }) });

const ctrl = require(src('controllers/codingController.js'));

function call(fn, { params = {}, body = {} } = {}) {
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; }
    };
    fn({ params, body }, res, (err) => resolve({ status: err.statusCode || res.statusCode || 500, error: err.message }));
  });
}

const JS_OK = 'const n = Number(require("fs").readFileSync(0, "utf8")); console.log(n * 2);';
const JS_WRONG = 'const n = Number(require("fs").readFileSync(0, "utf8")); console.log(n + 2);';

async function newAttempt() {
  const a = new FakeAttempt({ _id: `att${attempts.size + 1}`, userId: 'user-1', problemId: PROBLEM_ID });
  await a.save();
  return a._id;
}

test('Run judges the sample tests only', async () => {
  const attemptId = await newAttempt();
  const r = await call(ctrl.runCode, { params: { id: PROBLEM_ID }, body: { language: 'javascript', code: JS_OK, attemptId } });
  assert.strictEqual(r.status, 200, r.error);
  assert.strictEqual(r.body.run.totalCount, 2);
  assert.strictEqual(r.body.run.passedCount, 2);
});

test('Run with custom input returns the program output', async () => {
  const attemptId = await newAttempt();
  const r = await call(ctrl.runCode, { params: { id: PROBLEM_ID }, body: { language: 'python', code: 'print(int(input()) * 3)', attemptId, customInput: '7' } });
  assert.strictEqual(r.status, 200, r.error);
  assert.strictEqual(r.body.run.results[0].actualOutput, '21');
  assert.strictEqual(r.body.run.passedCount, null);
});

test('Submit judges every test, records the submission and hides hidden tests', async () => {
  const attemptId = await newAttempt();
  const ok = await call(ctrl.submitSolution, { params: { id: PROBLEM_ID }, body: { language: 'javascript', code: JS_OK, attemptId } });
  assert.strictEqual(ok.status, 200, ok.error);
  assert.strictEqual(ok.body.result.status, 'accepted');
  assert.strictEqual(ok.body.result.passedTests, 3);
  assert.strictEqual(ok.body.result.results[2].input, undefined, 'hidden input is not sent');
  assert.strictEqual(submissions.at(-1).status, 'accepted');
  assert.strictEqual(attempts.get(attemptId).accepted, true);

  const bad = await call(ctrl.submitSolution, { params: { id: PROBLEM_ID }, body: { language: 'javascript', code: JS_WRONG, attemptId } });
  assert.strictEqual(bad.status, 200, bad.error);
  assert.strictEqual(bad.body.result.status, 'wrong_answer');
  assert.strictEqual(attempts.get(attemptId).submissionCount, 2);
});

test('a compile error is reported, not a server error', async () => {
  const attemptId = await newAttempt();
  const r = await call(ctrl.submitSolution, { params: { id: PROBLEM_ID }, body: { language: 'javascript', code: 'console.log(', attemptId } });
  assert.strictEqual(r.status, 200, r.error);
  assert.notStrictEqual(r.body.result.status, 'accepted');
});

test('a terminated attempt cannot run code', async () => {
  const attemptId = await newAttempt();
  attempts.get(attemptId).status = 'terminated';
  const r = await call(ctrl.runCode, { params: { id: PROBLEM_ID }, body: { language: 'javascript', code: JS_OK, attemptId } });
  assert.strictEqual(r.status, 409);
});
