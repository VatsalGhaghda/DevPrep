/**
 * Turn whatever the user pasted (profile URL or bare username) into a
 * validated username for each platform.
 */

const RULES = {
  github: {
    hosts: ['github.com', 'www.github.com'],
    // github.com/<user>
    pathPattern: /^\/([^/]+)\/?$/,
    // 1-39 chars, letters/digits/single hyphens, no leading/trailing hyphen
    username: /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i,
    reserved: ['orgs', 'settings', 'marketplace', 'explore', 'topics', 'about', 'pricing', 'login', 'features', 'sponsors'],
    profileUrl: (u) => `https://github.com/${u}`
  },
  leetcode: {
    hosts: ['leetcode.com', 'www.leetcode.com'],
    // leetcode.com/u/<user>/ or the older leetcode.com/<user>/
    pathPattern: /^\/(?:u\/)?([^/]+)\/?$/,
    username: /^[a-z\d_-]{1,40}$/i,
    reserved: ['problems', 'contest', 'discuss', 'explore', 'problemset', 'studyplan', 'u', 'accounts', 'subscribe', 'assessment'],
    profileUrl: (u) => `https://leetcode.com/u/${u}/`
  },
  codeforces: {
    hosts: ['codeforces.com', 'www.codeforces.com', 'm1.codeforces.com', 'm2.codeforces.com', 'm3.codeforces.com', 'mirror.codeforces.com', 'codeforces.net'],
    // codeforces.com/profile/<handle>
    pathPattern: /^\/profile\/([^/]+)\/?$/,
    username: /^[a-z\d_.-]{3,24}$/i,
    reserved: [],
    profileUrl: (u) => `https://codeforces.com/profile/${u}`
  }
};

const PLATFORMS = Object.keys(RULES);

const LABELS = { github: 'GitHub', leetcode: 'LeetCode', codeforces: 'Codeforces' };

/**
 * @returns {{ username: string, profileUrl: string }}
 * @throws Error with a user-facing message when the input is not valid
 */
function parseProfileInput(platform, input) {
  const rule = RULES[platform];
  if (!rule) throw new Error('Unknown platform');
  const raw = String(input || '').trim();
  if (!raw) throw new Error(`Enter your ${LABELS[platform]} profile URL or username`);
  if (raw.length > 200) throw new Error('That value is too long');

  let candidate = raw.replace(/^@/, '');
  const looksLikeUrl = /^(https?:\/\/)?([a-z\d-]+\.)+[a-z]{2,}(\/|$)/i.test(raw);
  if (looksLikeUrl) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch (_) {
      throw new Error('That URL is not valid');
    }
    if (!rule.hosts.includes(url.hostname.toLowerCase())) {
      throw new Error(`That is not a ${LABELS[platform]} profile URL`);
    }
    const match = url.pathname.match(rule.pathPattern);
    if (!match) throw new Error(`Could not find a username in that ${LABELS[platform]} URL`);
    candidate = decodeURIComponent(match[1]);
  }

  if (!rule.username.test(candidate) || rule.reserved.includes(candidate.toLowerCase())) {
    throw new Error(`"${candidate}" is not a valid ${LABELS[platform]} username`);
  }
  return { username: candidate, profileUrl: rule.profileUrl(candidate) };
}

module.exports = { PLATFORMS, LABELS, parseProfileInput, profileUrlFor: (p, u) => RULES[p].profileUrl(u) };
