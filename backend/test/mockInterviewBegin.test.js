/**
 * The interview must not start (no AI question, no clock) until the candidate
 * presses Start after the device check. Runs the real controller against an
 * in-memory stand-in for the Mongo model and a stubbed AI.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const src = (p) => path.join(__dirname, '..', 'src', p);

/* ── in-memory model ── */
const store = new Map();
let nextId = 1;
const matches = (doc, q) => Object.entries(q).every(([k, v]) => {
  if (k === '$or') return v.some((alt) => matches(doc, alt));
  if (v && typeof v === 'object' && !(v instanceof Date) && '$lt' in v) return doc[k] != null && doc[k] < v.$lt;
  if (k === '_id') return String(doc._id) === String(v);
  return doc[k] === v || (v === null && doc[k] == null);
});
class FakeSession {
  constructor(data) { Object.assign(this, { awaitingReplySince: null, messages: [] }, data); }
  async save() { store.set(String(this._id), this); return this; }
  async deleteOne() { store.delete(String(this._id)); }
  static async create(data) { const d = new FakeSession({ _id: String(nextId++), ...data }); await d.save(); return d; }
  static findById(id) {
    const doc = store.get(String(id)) || null;
    const p = Promise.resolve(doc);
    p.select = () => Promise.resolve(doc);
    return p;
  }
  static async findOneAndUpdate(q, update) {
    const doc = [...store.values()].find((d) => matches(d, q));
    if (!doc) return null;
    Object.assign(doc, update.$set || {});
    return doc;
  }
  static async updateOne(q, update) {
    const doc = [...store.values()].find((d) => matches(d, q));
    if (doc) Object.assign(doc, update.$set || {});
  }
}

let aiCalls = 0;
let aiFails = false;
let aiDelay = 0;
const stub = (file, exports) => {
  const id = require.resolve(src(file));
  require.cache[id] = { id, filename: id, loaded: true, exports };
};
stub('models/MockInterviewSession.js', FakeSession);
stub('models/Resume.js', { findById: async () => null });
stub('utils/resolveUser.js', { resolveUser: async () => ({ _id: 'user-1' }) });
stub('utils/aiService.js', {
  groqChat: async () => {
    aiCalls += 1;
    if (aiDelay) await new Promise((r) => setTimeout(r, aiDelay));
    if (aiFails) throw new Error('AI down');
    return 'Hi, I am your interviewer. First question: tell me about yourself.';
  }
});

const ctrl = require(src('controllers/mockInterviewController.js'));

function call(fn, { params = {}, body = {} } = {}) {
  return new Promise((resolve, reject) => {
    const res = {
      statusCode: 200,
      status(c) { this.statusCode = c; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; }
    };
    fn({ params, body }, res, reject);
  });
}

test('start creates a ready session without asking the AI or starting the clock', async () => {
  aiCalls = 0;
  const r = await call(ctrl.startSession, { body: { interviewType: 'technical' } });
  assert.strictEqual(r.status, 201);
  assert.strictEqual(r.body.session.status, 'ready');
  assert.strictEqual(r.body.session.messages.length, 0);
  assert.strictEqual(aiCalls, 0);
});

test('nothing can be answered or transcribed before the interview begins', async () => {
  const { body } = await call(ctrl.startSession, { body: { interviewType: 'hr' } });
  const id = body.session._id;
  const msg = await call(ctrl.sendMessage, { params: { id }, body: { content: 'hello' } });
  assert.strictEqual(msg.status, 400);
  const end = await call(ctrl.endSession, { params: { id }, body: { status: 'completed' } });
  assert.strictEqual(end.status, 400, 'a session that never began cannot be completed');
});

test('begin generates the first question once and starts the clock', async () => {
  aiCalls = 0;
  const { body } = await call(ctrl.startSession, { body: { interviewType: 'technical' } });
  const id = body.session._id;
  const created = body.session.startedAt;
  await new Promise((r) => setTimeout(r, 5));

  const r = await call(ctrl.beginSession, { params: { id } });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.session.status, 'active');
  assert.strictEqual(r.body.session.messages.length, 1);
  assert.strictEqual(r.body.session.messages[0].role, 'interviewer');
  assert.strictEqual(r.body.session.currentQuestionNumber, 1);
  assert.ok(r.body.session.startedAt > created, 'clock starts at begin, not at creation');
  assert.strictEqual(aiCalls, 1);

  const again = await call(ctrl.beginSession, { params: { id } });
  assert.strictEqual(again.status, 200);
  assert.strictEqual(again.body.session.messages.length, 1, 'a second begin does not add a question');
  assert.strictEqual(aiCalls, 1);
});

test('two Start clicks at once produce one question', async () => {
  aiCalls = 0;
  aiDelay = 30;
  const { body } = await call(ctrl.startSession, { body: { interviewType: 'technical' } });
  const id = body.session._id;
  const [a, b] = await Promise.all([call(ctrl.beginSession, { params: { id } }), call(ctrl.beginSession, { params: { id } })]);
  aiDelay = 0;
  assert.deepStrictEqual([a.status, b.status].sort(), [200, 409]);
  assert.strictEqual(aiCalls, 1);
  assert.strictEqual(store.get(id).messages.length, 1);
});

test('if the AI fails, the session stays ready and Start can be retried', async () => {
  aiFails = true;
  const { body } = await call(ctrl.startSession, { body: { interviewType: 'technical' } });
  const id = body.session._id;
  const r = await call(ctrl.beginSession, { params: { id } });
  assert.strictEqual(r.status, 502);
  assert.strictEqual(store.get(id).status, 'ready');
  assert.strictEqual(store.get(id).awaitingReplySince, null);
  aiFails = false;
  const retry = await call(ctrl.beginSession, { params: { id } });
  assert.strictEqual(retry.status, 200);
  assert.strictEqual(retry.body.session.status, 'active');
});

test('a ready session can be abandoned, and then cannot begin', async () => {
  const { body } = await call(ctrl.startSession, { body: { interviewType: 'technical' } });
  const id = body.session._id;
  const end = await call(ctrl.endSession, { params: { id }, body: { status: 'abandoned' } });
  assert.strictEqual(end.status, 200);
  assert.strictEqual(end.body.session.status, 'abandoned');
  const r = await call(ctrl.beginSession, { params: { id } });
  assert.strictEqual(r.status, 409);
});
