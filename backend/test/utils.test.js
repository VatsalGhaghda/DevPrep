const test = require('node:test');
const assert = require('node:assert');

const { escapeRegex } = require('../src/utils/escapeRegex');
const { computeStreaks, dayDiff, getTimezone, todayIn } = require('../src/utils/timezone');
const { compareOutput } = require('../src/utils/judgeService');
const { errorHandler } = require('../src/middleware/errorHandler');

test('escapeRegex makes user input literal', () => {
  const re = new RegExp(`^${escapeRegex('a(b*')}$`);
  assert.ok(re.test('a(b*'));
  assert.ok(!re.test('aaab'));
  assert.doesNotThrow(() => new RegExp(escapeRegex('(((')));
});

test('dayDiff counts calendar days', () => {
  assert.strictEqual(dayDiff('2026-02-28', '2026-03-01'), 1);
  assert.strictEqual(dayDiff('2026-11-05', '2026-11-05'), 0);
});

test('computeStreaks: current streak ends today or yesterday', () => {
  const tz = 'UTC';
  const today = todayIn(tz);
  const d = (offset) => new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
  assert.deepStrictEqual(computeStreaks([d(-5), d(-4), d(-3), d(-1), d(0)], tz), { currentStreak: 2, longestStreak: 3 });
  assert.deepStrictEqual(computeStreaks([d(-3), d(-2)], tz), { currentStreak: 0, longestStreak: 2 });
  assert.deepStrictEqual(computeStreaks([], tz), { currentStreak: 0, longestStreak: 0 });
});

test('getTimezone validates the tz query param', () => {
  assert.strictEqual(getTimezone({ query: { tz: 'Asia/Kolkata' } }), 'Asia/Kolkata');
  assert.strictEqual(getTimezone({ query: { tz: 'Not/AZone' } }), 'UTC');
  assert.strictEqual(getTimezone({ query: {} }), 'UTC');
});

test('compareOutput ignores trailing whitespace and CRLF', () => {
  assert.ok(compareOutput('1 2 \r\n3\n', '1 2\n3'));
  assert.ok(!compareOutput('1 2', '1  2'));
});

function fakeRes() {
  return {
    statusCode: 200,
    headersSent: false,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; }
  };
}

test('errorHandler maps common errors to 4xx', () => {
  const req = { method: 'GET', originalUrl: '/x' };
  let res = fakeRes();
  errorHandler(Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError', path: 'id' }), req, res);
  assert.strictEqual(res.statusCode, 400);

  res = fakeRes();
  errorHandler(Object.assign(new Error('nope'), { statusCode: 403 }), req, res);
  assert.strictEqual(res.statusCode, 403);

  res = fakeRes().status(404);
  errorHandler(new Error('Problem not found'), req, res);
  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body.message, 'Problem not found');
});
