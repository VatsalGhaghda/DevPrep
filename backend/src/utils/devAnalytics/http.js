/**
 * Small HTTP helpers shared by the platform clients (GitHub, LeetCode,
 * Codeforces, contests). Every upstream failure becomes an UpstreamError with
 * a code the controller can turn into a clear message:
 *   not_found | rate_limited | blocked | unavailable | config
 */

class UpstreamError extends Error {
  constructor(message, { code = 'unavailable', status, retryAfter } = {}) {
    super(message);
    this.name = 'UpstreamError';
    this.code = code;
    this.upstreamStatus = status;
    this.retryAfter = retryAfter;
  }
}

async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { method, headers, body, signal: controller.signal });
  } catch (err) {
    const host = new URL(url).host;
    throw new UpstreamError(
      err.name === 'AbortError' ? `${host} did not respond in time` : `Could not reach ${host}`,
      { code: 'unavailable' }
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
  return { status: res.status, ok: res.ok, headers: res.headers, json, text };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 'YYYY-MM-DD' in UTC for a Date, ms timestamp, or seconds timestamp */
function dayKey(value, { seconds = false } = {}) {
  const d = value instanceof Date ? value : new Date(seconds ? Number(value) * 1000 : Number(value));
  return d.toISOString().slice(0, 10);
}

module.exports = { UpstreamError, fetchJson, sleep, dayKey };
