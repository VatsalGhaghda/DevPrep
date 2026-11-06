const mongoose = require('mongoose');
const { getTimezone, computeStreaks } = require('../utils/timezone');
const { escapeRegex } = require('../utils/escapeRegex');
const User = require('../models/User');
const MockInterviewSession = require('../models/MockInterviewSession');
const Submission = require('../models/Submission');
const CodingProblem = require('../models/CodingProblem');


/**
 * Find a public profile by username. Accounts created before usernames
 * existed fall back to an exact (case-insensitive) name match, but only when
 * exactly one public user has that name.
 */
async function findPublicUser(username, select) {
  const key = String(username || '').trim();
  const byUsername = await User.findOne({ username: key.toLowerCase(), isProfilePublic: { $ne: false } })
    .select(select)
    .lean();
  if (byUsername) return byUsername;

  const byName = await User.find({
    name: { $regex: `^${escapeRegex(key)}$`, $options: 'i' },
    isProfilePublic: { $ne: false }
  })
    .select(select)
    .limit(2)
    .lean();
  return byName.length === 1 ? byName[0] : null;
}

// Inline avatars (data: URLs) can be over 1 MB; search results only carry links
function listAvatar(avatar) {
  return typeof avatar === 'string' && /^https?:\/\//.test(avatar) ? avatar : '';
}

/* ─────────────── New: User search (public, no auth) ─────────────── */

/**
 * GET /api/users/search?q=<query>
 * Searches users by name or username prefix (case-insensitive)
 * Returns up to 8 public user snippets
 */
async function searchUsers(req, res, next) {
  try {
    const q = (req.query.q || '').trim();

    if (q.length < 2) {
      return res.status(200).json({ users: [] });
    }

    // Prefix match on escaped input: safe from regex injection and can use indexes
    const regex = new RegExp(`^${escapeRegex(q)}`, 'i');

    const users = await User.aggregate([
      { $match: { isProfilePublic: { $ne: false }, $or: [{ name: regex }, { username: regex }] } },
      { $limit: 8 },
      {
        $project: {
          name: 1,
          username: 1,
          experienceLevel: 1,
          // Don't ship inline (data:) avatars in search results
          avatar: { $cond: [{ $regexMatch: { input: { $ifNull: ['$avatar', ''] }, regex: '^https?://' } }, '$avatar', ''] }
        }
      }
    ]);

    res.status(200).json({
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        username: u.username || '',
        avatar: listAvatar(u.avatar),
        experienceLevel: u.experienceLevel || 'Beginner'
      }))
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/users/public/:username
 * Returns a public profile + basic coding/interview stats
 */
async function getPublicProfile(req, res, next) {
  try {
    const { username } = req.params;

    // Try to find by username field first, then by name as fallback
    const user = await findPublicUser(username, 'name username avatar bio skills targetRole experienceLevel createdAt clerkUserId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Grab basic coding stats for public display
    const matchUser = user.clerkUserId
      ? { $or: [{ clerkUserId: user.clerkUserId }, { userId: user._id }] }
      : { userId: user._id };

    const [solvedCount, totalInterviews] = await Promise.all([
      Submission.distinct('problemId', { ...matchUser, status: 'accepted', isDraft: false }).then(
        (ids) => ids.length
      ),
      MockInterviewSession.countDocuments({ ...matchUser, status: 'completed' })
    ]);

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        username: user.username || user.name,
        avatar: user.avatar || '',
        bio: user.bio || '',
        skills: user.skills || [],
        targetRole: user.targetRole || '',
        experienceLevel: user.experienceLevel || 'Beginner',
        memberSince: user.createdAt
      },
      stats: {
        problemsSolved: solvedCount,
        interviewsCompleted: totalInterviews
      }
    });
  } catch (err) {
    next(err);
  }
}
/**
 * GET /api/users/public/:username/analytics
 * Returns public coding analytics for a user (no auth required)
 */
async function getPublicAnalytics(req, res, next) {
  try {
    const tz = getTimezone(req);
    const { username } = req.params;

    const user = await findPublicUser(username, '_id clerkUserId');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const matchUser = user.clerkUserId
      ? { $or: [{ clerkUserId: user.clerkUserId }, { userId: new mongoose.Types.ObjectId(user._id) }] }
      : { userId: new mongoose.Types.ObjectId(user._id) };

    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    // Run all DB queries in parallel — single round-trip per query, no redundant fetches.
    const [solvedAgg, totalSubAgg, totalProblemsAgg, activity, days, languageUsage, solvedCategories, recentSolved] = await Promise.all([
      // Unique problems solved, grouped by difficulty
      Submission.aggregate([
        { $match: { ...matchUser, status: 'accepted', isDraft: false } },
        { $group: { _id: '$problemId' } },
        {
          $lookup: {
            from: 'codingproblems',
            localField: '_id',
            foreignField: '_id',
            as: 'problem'
          }
        },
        { $unwind: '$problem' },
        { $group: { _id: '$problem.difficulty', count: { $sum: 1 } } }
      ]),

      // Total vs accepted submissions (for acceptance rate)
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } }
          }
        }
      ]),

      // Total problems in DB per difficulty
      CodingProblem.aggregate([
        { $group: { _id: '$difficulty', count: { $sum: 1 } } }
      ]),

      // Submission activity heatmap (last 365 days)
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false, createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } }, count: { $sum: 1 } } },
        { $project: { _id: 0, date: '$_id', count: 1 } },
        { $sort: { date: 1 } }
      ]),

      // Unique active days (for streak calculation)
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: tz } } } },
        { $sort: { _id: 1 } }
      ]),

      // Submissions by language
      Submission.aggregate([
        { $match: { ...matchUser, isDraft: false } },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $project: { _id: 0, language: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Accepted problems by category
      Submission.aggregate([
        { $match: { ...matchUser, status: 'accepted', isDraft: false } },
        { $group: { _id: '$problemId' } },
        { $lookup: { from: 'codingproblems', localField: '_id', foreignField: '_id', as: 'problem' } },
        { $unwind: '$problem' },
        { $group: { _id: '$problem.category', count: { $sum: 1 } } },
        { $project: { _id: 0, category: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Recently solved problems: first accepted submission per problem, newest first.
      // Only the problem title, difficulty and date are shared, never code.
      Submission.aggregate([
        { $match: { ...matchUser, status: 'accepted', isDraft: false } },
        { $sort: { createdAt: 1 } },
        { $group: { _id: '$problemId', solvedAt: { $first: '$createdAt' }, language: { $first: '$language' } } },
        { $sort: { solvedAt: -1 } },
        { $limit: 15 },
        { $lookup: { from: 'codingproblems', localField: '_id', foreignField: '_id', as: 'problem' } },
        { $unwind: '$problem' },
        { $project: { _id: 0, title: '$problem.title', difficulty: '$problem.difficulty', category: '$problem.category', language: 1, solvedAt: 1 } }
      ])
    ]);

    // Build difficulty maps
    const solvedMap = { easy: 0, medium: 0, hard: 0 };
    solvedAgg.forEach(({ _id, count }) => {
      const k = typeof _id === 'string' ? _id.toLowerCase() : _id;
      if (k in solvedMap) solvedMap[k] = count;
    });

    const totalMap = { easy: 0, medium: 0, hard: 0 };
    totalProblemsAgg.forEach(({ _id, count }) => {
      const k = typeof _id === 'string' ? _id.toLowerCase() : _id;
      if (k in totalMap) totalMap[k] = count;
    });

    const subStats = totalSubAgg[0] || { total: 0, accepted: 0 };
    const acceptanceRate = subStats.total > 0 ? Math.round((subStats.accepted / subStats.total) * 100) : 0;

    // Calculate streak from unique active days
    const dateStrings = days.map((d) => d._id);
    const { currentStreak, longestStreak } = computeStreaks(dateStrings, tz);
    const lastActiveDate = dateStrings.length ? dateStrings[dateStrings.length - 1] : null;

    res.status(200).json({
      codingStats: {
        totalSolved: solvedMap.easy + solvedMap.medium + solvedMap.hard,
        totalProblems: totalMap.easy + totalMap.medium + totalMap.hard,
        easySolved: solvedMap.easy,
        mediumSolved: solvedMap.medium,
        hardSolved: solvedMap.hard,
        totalEasy: totalMap.easy,
        totalMedium: totalMap.medium,
        totalHard: totalMap.hard,
        totalSubmissions: subStats.total,
        acceptedSubmissions: subStats.accepted,
        acceptanceRate
      },
      activity,
      streak: { currentStreak, longestStreak, lastActiveDate },
      languageUsage,
      solvedCategories,
      recentSolved
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchUsers, getPublicProfile, getPublicAnalytics };
