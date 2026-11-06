/**
 * Day boundaries for analytics (heatmap, streaks, charts) follow the viewer's
 * time zone, sent by the frontend as ?tz=Area/City. Defaults to UTC.
 */
function getTimezone(req) {
  const tz = req && req.query && typeof req.query.tz === 'string' ? req.query.tz.trim() : '';
  if (!tz || tz.length > 64) return 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch (_) {
    return 'UTC';
  }
}

/** Today's date as YYYY-MM-DD in the given time zone. */
function todayIn(tz) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
function dayDiff(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * Current and longest streak from sorted unique YYYY-MM-DD strings.
 * The current streak counts if the last active day is today or yesterday.
 */
function computeStreaks(dateStrings, tz) {
  if (!dateStrings.length) return { currentStreak: 0, longestStreak: 0 };

  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < dateStrings.length; i++) {
    run = dayDiff(dateStrings[i - 1], dateStrings[i]) === 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }

  let currentStreak = 0;
  if (dayDiff(dateStrings[dateStrings.length - 1], todayIn(tz)) <= 1) {
    currentStreak = 1;
    for (let i = dateStrings.length - 2; i >= 0; i--) {
      if (dayDiff(dateStrings[i], dateStrings[i + 1]) === 1) currentStreak++;
      else break;
    }
  }
  return { currentStreak, longestStreak };
}

module.exports = { getTimezone, todayIn, dayDiff, computeStreaks };
