const test = require('node:test');
const assert = require('node:assert/strict');

const { parseProfileInput } = require('../src/utils/devAnalytics/usernames');

test('parses profile URLs and bare usernames', () => {
  assert.equal(parseProfileInput('github', 'https://github.com/octocat').username, 'octocat');
  assert.equal(parseProfileInput('github', 'github.com/octo-cat/').username, 'octo-cat');
  assert.equal(parseProfileInput('github', '@octocat').username, 'octocat');
  assert.equal(parseProfileInput('leetcode', 'https://leetcode.com/u/neal_wu/').username, 'neal_wu');
  assert.equal(parseProfileInput('leetcode', 'leetcode.com/neal_wu').username, 'neal_wu');
  assert.equal(parseProfileInput('codeforces', 'https://codeforces.com/profile/tourist').username, 'tourist');
  assert.equal(parseProfileInput('codeforces', 'Um_nik').profileUrl, 'https://codeforces.com/profile/Um_nik');
});

test('rejects wrong hosts, reserved paths and invalid names', () => {
  assert.throws(() => parseProfileInput('github', 'https://gitlab.com/octocat'), /not a GitHub profile/);
  assert.throws(() => parseProfileInput('github', 'https://github.com/octocat/repo'), /Could not find/);
  assert.throws(() => parseProfileInput('github', 'bad--name'), /not a valid/);
  assert.throws(() => parseProfileInput('leetcode', 'https://leetcode.com/problems/two-sum/'), /Could not find|not a valid/);
  assert.throws(() => parseProfileInput('codeforces', 'https://codeforces.com/contest/1'), /Could not find/);
  assert.throws(() => parseProfileInput('codeforces', ''), /Enter your/);
});

test('activity merge keeps history before the synced window', () => {
  // The controller needs mongoose models; load only the pure helper
  const { mergeActivity } = require('../src/controllers/devAnalyticsController');
  const merged = mergeActivity(
    { '2024-01-01': 3, '2025-06-01': 2, '2025-07-01': 9 },
    { '2025-07-01': 4, '2025-07-02': 1, '2025-07-03': 0 },
    '2025-06-01'
  );
  assert.deepEqual(merged, { '2024-01-01': 3, '2025-07-01': 4, '2025-07-02': 1 });
});

test('codeforces stats are computed from submissions', async () => {
  const realFetch = global.fetch;
  const responses = {
    'user.info': [{ handle: 'alice', rating: 1500, maxRating: 1600, rank: 'specialist', maxRank: 'expert' }],
    'user.rating': [{ contestId: 1, contestName: 'Round 1', rank: 10, oldRating: 1400, newRating: 1500, ratingUpdateTimeSeconds: 1700000000 }],
    'user.status': [
      { id: 3, creationTimeSeconds: 1700100000, verdict: 'OK', programmingLanguage: 'C++', problem: { contestId: 1, index: 'A', name: 'A', rating: 800, tags: ['math'] } },
      { id: 2, creationTimeSeconds: 1700000000, verdict: 'WRONG_ANSWER', programmingLanguage: 'C++', problem: { contestId: 1, index: 'A', name: 'A', rating: 800, tags: ['math'] } },
      { id: 1, creationTimeSeconds: 1699900000, verdict: 'OK', programmingLanguage: 'C++', problem: { contestId: 1, index: 'B', name: 'B', tags: ['dp', 'math'] } }
    ]
  };
  global.fetch = async (url) => {
    const method = new URL(url).pathname.split('/').pop();
    return new Response(JSON.stringify({ status: 'OK', result: responses[method] }), { status: 200 });
  };
  try {
    const { fetchCodeforces } = require('../src/utils/devAnalytics/codeforces');
    const data = await fetchCodeforces('alice');
    assert.equal(data.solvedCount, 2);
    assert.equal(data.submissionsTotal, 3);
    assert.equal(data.acceptedSubmissions, 2);
    assert.deepEqual(data.difficulty, [{ rating: '800', count: 1 }, { rating: 'Unrated', count: 1 }]);
    assert.equal(data.tags[0].tag, 'math');
    assert.equal(data.tags[0].count, 2);
    assert.equal(data.contestsAttended, 1);
    assert.equal(Object.values(data.calendar).reduce((a, b) => a + b, 0), 3);
    assert.equal(data.windowStart, '1970-01-01');
  } finally {
    global.fetch = realFetch;
  }
});
