/**
 * Upcoming / ongoing / recently finished contests.
 *
 * Sources:
 *   - Codeforces: official contest.list API (Div. 1/2/3/4, Educational, Global, ...)
 *   - LeetCode:   the website's GraphQL "upcomingContests" query (unofficial)
 *   - Other judges (AtCoder, CodeChef, ...): only through clist.by, which
 *     needs a free API key (CLIST_USERNAME + CLIST_API_KEY). Without it,
 *     only Codeforces and LeetCode contests are shown.
 *
 * Results are cached in memory for 30 minutes; a failed source keeps its
 * last good list and reports an error instead of breaking the others.
 */
const { fetchJson } = require('./http');
const { cfCall } = require('./codeforces');
const { lcQuery } = require('./leetcode');

const CACHE_MS = 30 * 60 * 1000;
const RECENT_MS = 7 * 24 * 3600 * 1000;

const cache = { at: 0, data: null, pending: null };
const lastGood = { codeforces: [], leetcode: [], other: [] };

function cfCategory(name) {
  if (/educational/i.test(name)) return 'Educational';
  if (/div\.?\s*1\s*\+\s*2/i.test(name)) return 'Div. 1 + 2';
  if (/div\.?\s*1/i.test(name)) return 'Div. 1';
  if (/div\.?\s*2/i.test(name)) return 'Div. 2';
  if (/div\.?\s*3/i.test(name)) return 'Div. 3';
  if (/div\.?\s*4/i.test(name)) return 'Div. 4';
  if (/global/i.test(name)) return 'Global';
  return 'Other';
}

async function codeforcesContests() {
  const list = await cfCall('contest.list', { gym: 'false' });
  const now = Date.now();
  return list
    .filter((c) => c.startTimeSeconds && (c.phase === 'BEFORE' || c.phase === 'CODING' ||
      (c.phase !== 'BEFORE' && now - c.startTimeSeconds * 1000 < RECENT_MS)))
    .map((c) => ({
      id: `cf-${c.id}`,
      name: c.name,
      platform: 'codeforces',
      category: cfCategory(c.name),
      start: c.startTimeSeconds * 1000,
      durationSeconds: c.durationSeconds,
      url: c.phase === 'BEFORE'
        ? `https://codeforces.com/contestRegistration/${c.id}`
        : `https://codeforces.com/contest/${c.id}`
    }));
}

async function leetcodeContests() {
  let rows;
  try {
    const data = await lcQuery('{ upcomingContests { title titleSlug startTime duration } }');
    rows = data?.upcomingContests;
  } catch (_) {
    rows = null;
  }
  if (!rows) {
    const data = await lcQuery('{ topTwoContests { title titleSlug startTime duration } }');
    rows = data?.topTwoContests || [];
  }
  return rows.map((c) => ({
    id: `lc-${c.titleSlug}`,
    name: c.title,
    platform: 'leetcode',
    category: /biweekly/i.test(c.title) ? 'Biweekly' : /weekly/i.test(c.title) ? 'Weekly' : 'Other',
    start: Number(c.startTime) * 1000,
    durationSeconds: Number(c.duration),
    url: `https://leetcode.com/contest/${c.titleSlug}/`
  }));
}

function clistConfigured() {
  return Boolean(process.env.CLIST_USERNAME && process.env.CLIST_API_KEY);
}

async function otherContests() {
  if (!clistConfigured()) return [];
  const now = new Date(Date.now() - RECENT_MS).toISOString().slice(0, 19);
  const url = `https://clist.by/api/v4/contest/?format=json&order_by=start&limit=100&end__gt=${encodeURIComponent(now)}`;
  const res = await fetchJson(url, {
    headers: { Authorization: `ApiKey ${process.env.CLIST_USERNAME}:${process.env.CLIST_API_KEY}` }
  });
  if (!res.ok) throw new Error(`clist.by returned ${res.status}`);
  return (res.json?.objects || [])
    .filter((c) => !/codeforces\.com|leetcode\.com/i.test(c.host || c.resource || ''))
    .map((c) => ({
      id: `clist-${c.id}`,
      name: c.event,
      platform: 'other',
      host: c.host || c.resource,
      category: c.host || 'Other',
      start: Date.parse(`${c.start}Z`),
      durationSeconds: c.duration,
      url: c.href
    }))
    .filter((c) => Number.isFinite(c.start));
}

async function load() {
  const errors = {};
  const sources = { codeforces: codeforcesContests, leetcode: leetcodeContests, other: otherContests };
  const results = await Promise.allSettled(Object.values(sources).map((fn) => fn()));
  Object.keys(sources).forEach((key, i) => {
    const r = results[i];
    if (r.status === 'fulfilled') lastGood[key] = r.value;
    else errors[key] = r.reason?.message || 'Unavailable';
  });
  const contests = [...lastGood.codeforces, ...lastGood.leetcode, ...lastGood.other]
    .sort((a, b) => a.start - b.start);
  return { contests, errors, fetchedAt: new Date().toISOString(), otherSourceConfigured: clistConfigured() };
}

async function getContests({ force = false } = {}) {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (cache.pending) return cache.pending;
  cache.pending = load()
    .then((data) => {
      // Don't cache a fully failed load for long; retry after a minute
      cache.at = Object.keys(data.errors).length && data.contests.length === 0 ? Date.now() - CACHE_MS + 60000 : Date.now();
      cache.data = data;
      return data;
    })
    .finally(() => { cache.pending = null; });
  return cache.pending;
}

module.exports = { getContests };
