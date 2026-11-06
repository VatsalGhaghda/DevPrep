/**
 * Codeforces client (official API, https://codeforces.com/apiHelp).
 *
 * The API allows at most one call every two seconds, so every call from
 * this server goes through one queue that spaces them out.
 */
const { UpstreamError, fetchJson, dayKey, sleep } = require('./http');

const API = 'https://codeforces.com/api';
const MIN_GAP_MS = 2100;

let queue = Promise.resolve();
let lastCall = 0;

function cfCall(method, params = {}) {
  const run = async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();
    const qs = new URLSearchParams(params).toString();
    const res = await fetchJson(`${API}/${method}${qs ? `?${qs}` : ''}`, { timeoutMs: 25000 });
    const comment = res.json?.comment || '';
    if (res.json?.status === 'OK') return res.json.result;
    if (/not found/i.test(comment)) throw new UpstreamError('Codeforces user not found', { code: 'not_found', status: 400 });
    if (/limit exceeded/i.test(comment) || res.status === 429) {
      throw new UpstreamError('Codeforces rate limit reached; try again in a minute', { code: 'rate_limited', status: 429 });
    }
    if (res.status >= 500 || !res.json) {
      throw new UpstreamError('Codeforces is temporarily unavailable (it is often down during contests)', { status: res.status });
    }
    throw new UpstreamError(comment || `Codeforces returned ${res.status}`, { status: res.status });
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

async function verifyCodeforces(handle) {
  const [user] = await cfCall('user.info', { handles: handle });
  return { username: user.handle };
}

function problemKey(p) {
  return `${p.contestId || p.problemsetName || 'x'}-${p.index}`;
}

function problemUrl(p) {
  if (!p.contestId) return null;
  return p.contestId >= 100000
    ? `https://codeforces.com/gym/${p.contestId}/problem/${p.index}`
    : `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`;
}

async function fetchCodeforces(handle) {
  const partial = [];
  const [user] = await cfCall('user.info', { handles: handle });

  let ratingHistory = [];
  try {
    const changes = await cfCall('user.rating', { handle: user.handle });
    ratingHistory = changes.map((c) => ({
      contestId: c.contestId,
      contestName: c.contestName,
      rank: c.rank,
      oldRating: c.oldRating,
      newRating: c.newRating,
      time: c.ratingUpdateTimeSeconds * 1000
    }));
  } catch (err) {
    partial.push(`Rating history unavailable: ${err.message}`);
  }

  let submissions = [];
  let submissionsLoaded = false;
  try {
    submissions = await cfCall('user.status', { handle: user.handle, from: 1, count: 10000 });
    submissionsLoaded = true;
    if (submissions.length >= 10000) partial.push('Only your latest 10,000 submissions are counted.');
  } catch (err) {
    partial.push(`Submissions unavailable: ${err.message}`);
  }

  const solved = new Map();
  const attempted = new Set();
  const calendar = {};
  const acceptedCalendar = {};
  const verdicts = {};
  // oldest first so "first solved" dates are right
  for (const s of [...submissions].reverse()) {
    const key = problemKey(s.problem);
    attempted.add(key);
    const day = dayKey(s.creationTimeSeconds, { seconds: true });
    calendar[day] = (calendar[day] || 0) + 1;
    const verdict = s.verdict || 'TESTING';
    verdicts[verdict] = (verdicts[verdict] || 0) + 1;
    if (verdict === 'OK') {
      acceptedCalendar[day] = (acceptedCalendar[day] || 0) + 1;
      if (!solved.has(key)) solved.set(key, { problem: s.problem, day });
    }
  }

  const difficulty = {};
  const tags = {};
  for (const { problem } of solved.values()) {
    const bucket = problem.rating ? String(problem.rating) : 'Unrated';
    difficulty[bucket] = (difficulty[bucket] || 0) + 1;
    (problem.tags || []).forEach((t) => { tags[t] = (tags[t] || 0) + 1; });
  }

  const recent = submissions.slice(0, 20).map((s) => ({
    id: s.id,
    name: s.problem.name,
    index: s.problem.index,
    contestId: s.problem.contestId,
    rating: s.problem.rating || null,
    url: problemUrl(s.problem),
    verdict: s.verdict || 'TESTING',
    lang: s.programmingLanguage,
    time: s.creationTimeSeconds * 1000
  }));

  return {
    fetchedAt: new Date().toISOString(),
    profile: {
      handle: user.handle,
      avatarUrl: user.titlePhoto || user.avatar || null,
      rating: user.rating ?? null,
      maxRating: user.maxRating ?? null,
      rank: user.rank || 'unrated',
      maxRank: user.maxRank || 'unrated',
      contribution: user.contribution,
      friendOfCount: user.friendOfCount,
      registeredAt: user.registrationTimeSeconds ? user.registrationTimeSeconds * 1000 : null,
      url: `https://codeforces.com/profile/${user.handle}`
    },
    solvedCount: solved.size,
    attemptedUnsolved: attempted.size - solved.size,
    submissionsTotal: submissions.length,
    acceptedSubmissions: verdicts.OK || 0,
    verdicts,
    difficulty: Object.entries(difficulty)
      .map(([rating, count]) => ({ rating, count }))
      .sort((a, b) => (a.rating === 'Unrated' ? 1 : b.rating === 'Unrated' ? -1 : Number(a.rating) - Number(b.rating))),
    tags: Object.entries(tags).sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count })),
    ratingHistory,
    contestsAttended: ratingHistory.length,
    recent,
    calendar,
    acceptedCalendar,
    // user.status returns the whole history, so this window is all time.
    // null = nothing new, keep the stored activity as it is.
    windowStart: submissionsLoaded ? '1970-01-01' : null,
    partial
  };
}

module.exports = { verifyCodeforces, fetchCodeforces, cfCall };
