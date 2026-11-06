/**
 * Developer analytics: connect GitHub / LeetCode / Codeforces profiles and
 * sync their public data. Every route works on the signed-in user's own
 * document only (looked up by their user id, never by a request parameter).
 */
const DevAnalytics = require('../models/DevAnalytics');
const { resolveUser } = require('../utils/resolveUser');
const { PLATFORMS, LABELS, parseProfileInput } = require('../utils/devAnalytics/usernames');
const { verifyGithub, fetchGithub, githubTokenConfigured } = require('../utils/devAnalytics/github');
const { verifyLeetcode, fetchLeetcode } = require('../utils/devAnalytics/leetcode');
const { verifyCodeforces, fetchCodeforces } = require('../utils/devAnalytics/codeforces');
const { getContests: loadContests } = require('../utils/devAnalytics/contests');

const CLIENTS = {
  github: { verify: verifyGithub, fetch: fetchGithub },
  leetcode: { verify: verifyLeetcode, fetch: fetchLeetcode },
  codeforces: { verify: verifyCodeforces, fetch: fetchCodeforces }
};

// Data older than this is refreshed automatically when the dashboard opens
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
// Manual refreshes per platform are spaced out to protect the upstream limits
const SYNC_COOLDOWN_MS = 60 * 1000;

async function getDoc(userId) {
  return DevAnalytics.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

function view(doc) {
  return {
    connections: doc.connections || {},
    data: doc.data || {},
    activity: doc.activity || {},
    settings: {
      githubTokenConfigured: githubTokenConfigured(),
      staleAfterMs: STALE_AFTER_MS,
      syncCooldownMs: SYNC_COOLDOWN_MS
    }
  };
}

function mergeActivity(existing, incoming, windowStart) {
  const merged = {};
  Object.entries(existing || {}).forEach(([day, count]) => {
    if (day < windowStart) merged[day] = count;
  });
  Object.entries(incoming || {}).forEach(([day, count]) => {
    if (count > 0) merged[day] = count;
  });
  return merged;
}

function friendlyError(platform, err) {
  if (err && err.name === 'UpstreamError') return err.message;
  // eslint-disable-next-line no-console
  console.error(`[dev-analytics] ${platform} sync failed:`, err);
  return `Could not sync ${LABELS[platform]} right now.`;
}

/** Sync one platform for one user and write the result. Never throws. */
async function syncPlatform(userId, platform) {
  const doc = await DevAnalytics.findOne({ userId }).lean();
  const conn = doc?.connections?.[platform];
  if (!conn) return { platform, ok: false, error: 'Not connected' };

  const now = new Date();
  await DevAnalytics.updateOne({ userId }, { $set: { [`connections.${platform}.lastAttemptAt`]: now } });

  try {
    const result = await CLIENTS[platform].fetch(conn.username);
    const { calendar, acceptedCalendar, windowStart, ...data } = result;
    if (acceptedCalendar) data.acceptedCalendar = acceptedCalendar;
    const set = {
      [`data.${platform}`]: data,
      [`connections.${platform}.lastSyncedAt`]: now,
      [`connections.${platform}.status`]: 'connected',
      [`connections.${platform}.lastError`]: null
    };
    if (windowStart) {
      set[`activity.${platform}`] = mergeActivity(doc.activity?.[platform], calendar, windowStart);
    }
    // Only write if the same username is still connected (it may have changed meanwhile)
    await DevAnalytics.updateOne({ userId, [`connections.${platform}.username`]: conn.username }, { $set: set });
    return { platform, ok: true, partial: data.partial || [] };
  } catch (err) {
    const message = friendlyError(platform, err);
    const set = { [`connections.${platform}.lastError`]: message };
    if (err.code === 'not_found') set[`connections.${platform}.status`] = 'not_found';
    else if (conn.status === 'connected' && !doc.data?.[platform]) set[`connections.${platform}.status`] = 'error';
    await DevAnalytics.updateOne({ userId, [`connections.${platform}.username`]: conn.username }, { $set: set });
    return { platform, ok: false, error: message };
  }
}

async function requireUser(req, res) {
  const user = await resolveUser(req);
  if (!user) {
    res.status(401).json({ message: 'Not authorized' });
    return null;
  }
  return user;
}

// GET /api/dev-analytics
async function getAnalytics(req, res, next) {
  try {
    const user = await requireUser(req, res);
    if (!user) return undefined;
    const doc = await getDoc(user._id);
    return res.json(view(doc));
  } catch (err) {
    return next(err);
  }
}

// PUT /api/dev-analytics/connections/:platform   { value: "<url or username>" }
async function connectPlatform(req, res, next) {
  try {
    const user = await requireUser(req, res);
    if (!user) return undefined;
    const { platform } = req.params;

    let parsed;
    try {
      parsed = parseProfileInput(platform, req.body.value);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    let status = 'connected';
    let lastError = null;
    let username = parsed.username;
    try {
      const verified = await CLIENTS[platform].verify(parsed.username);
      username = verified.username; // canonical casing
    } catch (err) {
      if (err.code === 'not_found') {
        return res.status(404).json({ message: `No ${LABELS[platform]} profile named "${parsed.username}" was found.` });
      }
      if (err.code === 'config') {
        return res.status(503).json({ message: err.message });
      }
      // Platform unreachable or rate limited: save it and verify on the next sync
      status = 'unverified';
      lastError = `Could not verify yet: ${err.message}`;
    }

    const doc = await getDoc(user._id);
    const previous = doc.connections?.[platform];
    const changed = !previous || previous.username.toLowerCase() !== username.toLowerCase();
    const parsedAgain = parseProfileInput(platform, username);

    const set = {
      [`connections.${platform}`]: {
        username,
        profileUrl: parsedAgain.profileUrl,
        status,
        connectedAt: changed ? new Date() : previous.connectedAt,
        lastSyncedAt: changed ? null : previous.lastSyncedAt,
        lastAttemptAt: null,
        lastError
      }
    };
    if (changed) {
      set[`data.${platform}`] = null;
      set[`activity.${platform}`] = {};
    }
    await DevAnalytics.updateOne({ userId: user._id }, { $set: set });

    const sync = status === 'connected' ? await syncPlatform(user._id, platform) : null;
    const updated = await getDoc(user._id);
    return res.json({ ...view(updated), sync });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/dev-analytics/connections/:platform
async function disconnectPlatform(req, res, next) {
  try {
    const user = await requireUser(req, res);
    if (!user) return undefined;
    const { platform } = req.params;
    await getDoc(user._id);
    await DevAnalytics.updateOne(
      { userId: user._id },
      { $set: { [`connections.${platform}`]: null, [`data.${platform}`]: null, [`activity.${platform}`]: {} } }
    );
    const updated = await getDoc(user._id);
    return res.json(view(updated));
  } catch (err) {
    return next(err);
  }
}

// POST /api/dev-analytics/sync   { platform?: "github" | "leetcode" | "codeforces", onlyStale?: boolean }
async function syncAnalytics(req, res, next) {
  try {
    const user = await requireUser(req, res);
    if (!user) return undefined;
    const doc = await getDoc(user._id);
    const requested = req.body?.platform ? [req.body.platform] : PLATFORMS;
    const now = Date.now();

    const results = [];
    const toSync = [];
    for (const p of requested) {
      const conn = doc.connections?.[p];
      if (!conn) continue;
      if (req.body?.onlyStale && conn.lastSyncedAt && now - new Date(conn.lastSyncedAt).getTime() < STALE_AFTER_MS) continue;
      const last = conn.lastAttemptAt ? new Date(conn.lastAttemptAt).getTime() : 0;
      if (now - last < SYNC_COOLDOWN_MS) {
        const wait = Math.ceil((SYNC_COOLDOWN_MS - (now - last)) / 1000);
        results.push({ platform: p, ok: false, skipped: true, error: `${LABELS[p]} was synced moments ago; try again in ${wait}s.` });
        continue;
      }
      toSync.push(p);
    }

    results.push(...(await Promise.all(toSync.map((p) => syncPlatform(user._id, p)))));
    const updated = await getDoc(user._id);
    return res.json({ ...view(updated), results });
  } catch (err) {
    return next(err);
  }
}

// GET /api/dev-analytics/contests
async function getContests(req, res, next) {
  try {
    const data = await loadContests({ force: req.query.refresh === 'true' });
    return res.json(data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAnalytics, connectPlatform, disconnectPlatform, syncAnalytics, getContests, mergeActivity };
