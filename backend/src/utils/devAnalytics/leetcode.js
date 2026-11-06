/**
 * LeetCode client.
 *
 * LeetCode has no official public API. This uses the same GraphQL endpoint
 * the leetcode.com website calls (https://leetcode.com/graphql). It is
 * unofficial: fields can change without notice and requests from servers
 * are sometimes blocked by LeetCode's bot protection, so every section is
 * fetched separately and failures are reported as partial data.
 *
 * Only public profile data is available: the latest ~20 submissions, the
 * submission calendar for the past year (all submissions, not only
 * accepted ones), solved counts, and contest rating history.
 */
const { UpstreamError, fetchJson, dayKey, sleep } = require('./http');

const URL = 'https://leetcode.com/graphql';

async function lcQuery(query, variables = {}) {
  let res;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    res = await fetchJson(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://leetcode.com/',
        Origin: 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0 (compatible; DevPrep-Analytics/1.0)'
      },
      body: JSON.stringify({ query, variables }),
      timeoutMs: 15000
    });
    if (res.status !== 429 && res.status < 500) break;
    await sleep(1500);
  }
  if (res.status === 429) throw new UpstreamError('LeetCode is rate limiting requests; try again in a few minutes', { code: 'rate_limited', status: 429 });
  if (res.status === 403) throw new UpstreamError('LeetCode blocked the request from the server (bot protection); try again later', { code: 'blocked', status: 403 });
  if (!res.ok || !res.json) throw new UpstreamError(`LeetCode returned ${res.status}`, { status: res.status });
  if (res.json.errors?.length && !res.json.data) {
    throw new UpstreamError(res.json.errors[0].message || 'LeetCode GraphQL error');
  }
  return res.json.data;
}

async function verifyLeetcode(username) {
  const data = await lcQuery('query($u: String!) { matchedUser(username: $u) { username } }', { u: username });
  if (!data?.matchedUser) throw new UpstreamError('LeetCode user not found', { code: 'not_found', status: 404 });
  return { username: data.matchedUser.username };
}

const PROFILE_QUERY = `
query($u: String!) {
  allQuestionsCount { difficulty count }
  matchedUser(username: $u) {
    username
    profile { ranking userAvatar realName }
    submitStats {
      acSubmissionNum { difficulty count submissions }
      totalSubmissionNum { difficulty count submissions }
    }
    userCalendar { streak totalActiveDays submissionCalendar activeYears }
  }
}`;

const RECENT_QUERY = `
query($u: String!) {
  recentSubmissionList(username: $u, limit: 20) { title titleSlug timestamp statusDisplay lang }
}`;

const CONTEST_QUERY = `
query($u: String!) {
  userContestRanking(username: $u) {
    attendedContestsCount rating globalRanking totalParticipants topPercentage
    badge { name }
  }
  userContestRankingHistory(username: $u) {
    attended rating ranking problemsSolved totalProblems
    contest { title startTime }
  }
}`;

function byDifficulty(list) {
  const out = { all: 0, easy: 0, medium: 0, hard: 0 };
  const subs = { all: 0, easy: 0, medium: 0, hard: 0 };
  (list || []).forEach((row) => {
    const key = String(row.difficulty || '').toLowerCase();
    if (key in out) {
      out[key] = row.count;
      subs[key] = row.submissions;
    }
  });
  return { counts: out, submissions: subs };
}

async function fetchLeetcode(username) {
  const partial = [];
  const data = await lcQuery(PROFILE_QUERY, { u: username });
  const user = data?.matchedUser;
  if (!user) throw new UpstreamError('LeetCode user not found', { code: 'not_found', status: 404 });

  const ac = byDifficulty(user.submitStats?.acSubmissionNum);
  const total = byDifficulty(user.submitStats?.totalSubmissionNum);
  const questions = byDifficulty(data.allQuestionsCount).counts;

  const calendar = {};
  let calendarInfo = null;
  let calendarLoaded = false;
  if (user.userCalendar) {
    try {
      const raw = JSON.parse(user.userCalendar.submissionCalendar || '{}');
      for (const [ts, count] of Object.entries(raw)) {
        if (count > 0) calendar[dayKey(ts, { seconds: true })] = count;
      }
      calendarLoaded = true;
    } catch (_) {
      partial.push('The submission calendar could not be read.');
    }
    calendarInfo = { streak: user.userCalendar.streak, totalActiveDays: user.userCalendar.totalActiveDays };
  } else {
    partial.push('LeetCode did not return a submission calendar.');
  }

  let recent = [];
  try {
    const r = await lcQuery(RECENT_QUERY, { u: username });
    recent = (r?.recentSubmissionList || []).map((s) => ({
      title: s.title,
      url: `https://leetcode.com/problems/${s.titleSlug}/`,
      timestamp: Number(s.timestamp) * 1000,
      status: s.statusDisplay,
      lang: s.lang
    }));
  } catch (err) {
    partial.push(`Recent submissions unavailable: ${err.message}`);
  }

  let contest = null;
  try {
    const c = await lcQuery(CONTEST_QUERY, { u: username });
    const history = (c?.userContestRankingHistory || [])
      .filter((h) => h.attended)
      .map((h) => ({
        title: h.contest?.title,
        startTime: Number(h.contest?.startTime) * 1000,
        rating: Math.round(h.rating),
        ranking: h.ranking,
        solved: h.problemsSolved,
        total: h.totalProblems
      }));
    const ranking = c?.userContestRanking;
    contest = ranking || history.length ? {
      rating: ranking ? Math.round(ranking.rating) : null,
      // Highest rating after any contest (LeetCode has no "max rating" field)
      maxRating: history.length || ranking
        ? Math.max(...history.map((h) => h.rating), ranking ? Math.round(ranking.rating) : 0)
        : null,
      globalRanking: ranking?.globalRanking ?? null,
      totalParticipants: ranking?.totalParticipants ?? null,
      topPercentage: ranking?.topPercentage ?? null,
      attended: ranking?.attendedContestsCount ?? history.length,
      badge: ranking?.badge?.name || null,
      history
    } : null;
  } catch (err) {
    partial.push(`Contest data unavailable: ${err.message}`);
  }

  // LeetCode's own acceptance rate: accepted submissions / all submissions
  const acceptanceRate = total.submissions.all > 0
    ? Math.round((ac.submissions.all / total.submissions.all) * 1000) / 10
    : null;

  // The public calendar covers the past 12 months
  const windowStart = calendarLoaded ? dayKey(Date.now() - 365 * 86400000) : null;

  return {
    fetchedAt: new Date().toISOString(),
    profile: {
      username: user.username,
      realName: user.profile?.realName || null,
      avatarUrl: user.profile?.userAvatar || null,
      ranking: user.profile?.ranking ?? null,
      url: `https://leetcode.com/u/${user.username}/`
    },
    solved: ac.counts,
    questionTotals: questions,
    submissions: { total: total.submissions.all, accepted: ac.submissions.all },
    acceptanceRate,
    calendarInfo,
    contest,
    recent,
    calendar,
    windowStart,
    partial
  };
}

module.exports = { verifyLeetcode, fetchLeetcode, lcQuery };
