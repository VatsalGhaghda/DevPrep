/**
 * GitHub client.
 *
 * REST (works without a token, 60 requests/hour per server IP):
 *   profile, repositories, stars, languages, recent public events,
 *   PR / issue totals through the search API (10 searches/minute).
 * GraphQL (needs GITHUB_TOKEN, 5,000 points/hour):
 *   the contribution calendar, commit / PR / issue / review contribution
 *   counts, and contributions by repository. GitHub has no way to read the
 *   contribution calendar without a token.
 */
const { UpstreamError, fetchJson, dayKey } = require('./http');

const API = 'https://api.github.com';

function token() {
  return process.env.GITHUB_TOKEN ? String(process.env.GITHUB_TOKEN).trim() : '';
}

function headers() {
  const h = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'DevPrep-Analytics',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (token()) h.Authorization = `Bearer ${token()}`;
  return h;
}

function rateLimitError(res) {
  const reset = Number(res.headers.get('x-ratelimit-reset'));
  const retryAfter = Number(res.headers.get('retry-after')) ||
    (reset ? Math.max(0, reset - Math.floor(Date.now() / 1000)) : undefined);
  const mins = retryAfter ? Math.ceil(retryAfter / 60) : null;
  return new UpstreamError(
    `GitHub rate limit reached${mins ? `; try again in about ${mins} min` : ''}.` +
      (token() ? '' : ' Setting GITHUB_TOKEN on the server raises the limit.'),
    { code: 'rate_limited', status: res.status, retryAfter }
  );
}

async function ghGet(path) {
  const res = await fetchJson(`${API}${path}`, { headers: headers() });
  if (res.status === 404) throw new UpstreamError('GitHub user not found', { code: 'not_found', status: 404 });
  if (res.status === 429 || (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')) {
    throw rateLimitError(res);
  }
  if (res.status === 401) throw new UpstreamError('GITHUB_TOKEN on the server is invalid or expired', { code: 'config', status: 401 });
  if (!res.ok) throw new UpstreamError(`GitHub returned ${res.status}`, { status: res.status });
  return res.json;
}

async function verifyGithub(username) {
  const user = await ghGet(`/users/${encodeURIComponent(username)}`);
  if (user.type && user.type !== 'User') {
    throw new UpstreamError(`${user.login} is an organization, not a personal account`, { code: 'not_found' });
  }
  return { username: user.login };
}

const CONTRIBUTIONS_QUERY = `
query($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    pullRequests { totalCount }
    issues { totalCount }
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      totalPullRequestReviewContributions
      totalRepositoryContributions
      restrictedContributionsCount
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
      commitContributionsByRepository(maxRepositories: 10) {
        repository { nameWithOwner url }
        contributions { totalCount }
      }
    }
  }
}`;

async function fetchContributionsGraphql(login) {
  const to = new Date();
  const from = new Date(to.getTime() - 365 * 24 * 3600 * 1000);
  const res = await fetchJson(`${API}/graphql`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: CONTRIBUTIONS_QUERY, variables: { login, from: from.toISOString(), to: to.toISOString() } }),
    timeoutMs: 20000
  });
  if (res.status === 401) throw new UpstreamError('GITHUB_TOKEN on the server is invalid or expired', { code: 'config', status: 401 });
  if (res.status === 429 || res.status === 403) throw rateLimitError(res);
  if (!res.ok) throw new UpstreamError(`GitHub GraphQL returned ${res.status}`, { status: res.status });
  if (res.json?.errors?.length && !res.json?.data?.user) {
    throw new UpstreamError(res.json.errors[0].message || 'GitHub GraphQL error');
  }
  const user = res.json.data.user;
  const cc = user.contributionsCollection;
  const calendar = {};
  for (const week of cc.contributionCalendar.weeks) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > 0) calendar[day.date] = day.contributionCount;
    }
  }
  return {
    source: 'graphql',
    windowStart: dayKey(from),
    total: cc.contributionCalendar.totalContributions,
    commits: cc.totalCommitContributions,
    pullRequests: cc.totalPullRequestContributions,
    issues: cc.totalIssueContributions,
    reviews: cc.totalPullRequestReviewContributions,
    reposCreated: cc.totalRepositoryContributions,
    privateContributions: cc.restrictedContributionsCount,
    byRepository: cc.commitContributionsByRepository.map((r) => ({
      name: r.repository.nameWithOwner,
      url: r.repository.url,
      commits: r.contributions.totalCount
    })),
    allTime: {
      pullRequests: user.pullRequests.totalCount,
      issues: user.issues.totalCount
    },
    calendar
  };
}

// Without a token: count public events (GitHub keeps the last 90 days, max 300 events)
async function fetchContributionsFromEvents(login) {
  const events = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await ghGet(`/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    events.push(...batch);
    if (batch.length < 100) break;
  }
  const calendar = {};
  const byRepo = {};
  let commits = 0;
  let pullRequests = 0;
  let issues = 0;
  for (const e of events) {
    const day = dayKey(new Date(e.created_at));
    let weight = 1;
    if (e.type === 'PushEvent') {
      weight = Number.isFinite(e.payload?.size) && e.payload.size > 0 ? e.payload.size : 1;
      commits += weight;
      const name = e.repo?.name;
      if (name) byRepo[name] = (byRepo[name] || 0) + weight;
    } else if (e.type === 'PullRequestEvent' && e.payload?.action === 'opened') {
      pullRequests += 1;
    } else if (e.type === 'IssuesEvent' && e.payload?.action === 'opened') {
      issues += 1;
    }
    calendar[day] = (calendar[day] || 0) + weight;
  }
  const oldest = events.length ? dayKey(new Date(events[events.length - 1].created_at)) : dayKey(Date.now() - 90 * 86400000);
  return {
    source: 'events',
    windowStart: oldest,
    total: Object.values(calendar).reduce((a, b) => a + b, 0),
    commits,
    pullRequests,
    issues,
    reviews: null,
    byRepository: Object.entries(byRepo)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, url: `https://github.com/${name}`, commits: count })),
    calendar
  };
}

async function searchCount(q) {
  try {
    const res = await ghGet(`/search/issues?q=${encodeURIComponent(q)}&per_page=1`);
    return Number.isFinite(res?.total_count) ? res.total_count : null;
  } catch (_) {
    return null;
  }
}

async function fetchGithub(username) {
  const partial = [];
  const user = await ghGet(`/users/${encodeURIComponent(username)}`);

  const repos = [];
  for (let page = 1; page <= 3; page += 1) {
    const batch = await ghGet(`/users/${encodeURIComponent(user.login)}/repos?type=owner&sort=pushed&per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  if (user.public_repos > repos.length) {
    partial.push(`Stars and languages cover your ${repos.length} most recently pushed repositories.`);
  }
  const owned = repos.filter((r) => !r.fork);
  const stars = owned.reduce((sum, r) => sum + (r.stargazers_count || 0), 0);
  const forks = owned.reduce((sum, r) => sum + (r.forks_count || 0), 0);
  const languages = {};
  owned.forEach((r) => { if (r.language) languages[r.language] = (languages[r.language] || 0) + 1; });

  let contributions = null;
  if (token()) {
    try {
      contributions = await fetchContributionsGraphql(user.login);
    } catch (err) {
      partial.push(`Contribution calendar unavailable: ${err.message}`);
    }
  } else {
    partial.push('GITHUB_TOKEN is not set on the server, so the contribution calendar is not available. Activity below is counted from public events over the last 90 days.');
  }
  if (!contributions) {
    try {
      contributions = await fetchContributionsFromEvents(user.login);
      const [prs, iss] = await Promise.all([
        searchCount(`author:${user.login} type:pr`),
        searchCount(`author:${user.login} type:issue`)
      ]);
      contributions.allTime = { pullRequests: prs, issues: iss };
    } catch (err) {
      partial.push(`Recent activity unavailable: ${err.message}`);
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    profile: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      createdAt: user.created_at
    },
    totals: { stars, forks, ownedRepos: owned.length },
    languages: Object.entries(languages).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    topRepos: [...owned]
      .sort((a, b) => (b.stargazers_count - a.stargazers_count) || (new Date(b.pushed_at) - new Date(a.pushed_at)))
      .slice(0, 8)
      .map((r) => ({
        name: r.name,
        url: r.html_url,
        description: r.description,
        stars: r.stargazers_count,
        forks: r.forks_count,
        language: r.language,
        pushedAt: r.pushed_at
      })),
    contributions: contributions ? { ...contributions, calendar: undefined } : null,
    calendar: contributions ? contributions.calendar : {},
    windowStart: contributions ? contributions.windowStart : null,
    partial
  };
}

module.exports = { verifyGithub, fetchGithub, githubTokenConfigured: () => Boolean(token()) };
