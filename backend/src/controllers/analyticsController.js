const mongoose = require('mongoose');

const InterviewSession = require('../models/InterviewSession');
const Submission = require('../models/Submission');
const CodingProblem = require('../models/CodingProblem');

/* ─────────────────────────────────────────
   Interview analytics (existing endpoints)
───────────────────────────────────────── */

async function getOverview(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const total = await InterviewSession.countDocuments({ userId });
    const completed = await InterviewSession.countDocuments({ userId, status: 'completed' });

    const avgAgg = await InterviewSession.aggregate([
      { $match: { userId, status: 'completed', overallScore: { $ne: null } } },
      { $group: { _id: null, averageScore: { $avg: '$overallScore' } } }
    ]);

    const averageScore = avgAgg.length ? avgAgg[0].averageScore : null;

    const byType = await InterviewSession.aggregate([
      { $match: { userId } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $project: { _id: 0, type: '$_id', count: 1 } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      overview: { totalInterviews: total, completedInterviews: completed, averageScore, byType }
    });
  } catch (err) {
    next(err);
  }
}

async function getPerformance(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const points = await InterviewSession.aggregate([
      { $match: { userId, status: 'completed', overallScore: { $ne: null } } },
      { $sort: { createdAt: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          overallScore: 1,
          type: 1
        }
      },
      {
        $group: {
          _id: '$date',
          averageScore: { $avg: '$overallScore' },
          sessions: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: '$_id', averageScore: 1, sessions: 1 } },
      { $sort: { date: 1 } },
      { $limit: 365 }
    ]);

    res.status(200).json({ performance: { points } });
  } catch (err) {
    next(err);
  }
}

async function getTopics(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const topics = await InterviewSession.aggregate([
      {
        $match: {
          userId,
          status: 'completed',
          overallScore: { $ne: null },
          topics: { $exists: true, $ne: [] }
        }
      },
      { $unwind: '$topics' },
      {
        $group: {
          _id: '$topics',
          averageScore: { $avg: '$overallScore' },
          sessions: { $sum: 1 }
        }
      },
      { $project: { _id: 0, topic: '$_id', averageScore: 1, sessions: 1 } },
      { $sort: { averageScore: 1 } },
      { $limit: 50 }
    ]);

    res.status(200).json({ topics });
  } catch (err) {
    next(err);
  }
}

/* ─────────────────────────────────────────
   Coding analytics (new LeetCode-style)
───────────────────────────────────────── */

/**
 * GET /api/analytics/coding-stats
 * Returns: totalSolved, easySolved, mediumSolved, hardSolved,
 *          totalProblems (of each difficulty), acceptanceRate
 */
async function getCodingStats(req, res, next) {
  try {
    const clerkUserId = req.user.clerkUserId;
    const userId = req.user._id;

    // Match field: prefer clerkUserId if set, otherwise userId
    const matchUser = clerkUserId
      ? { clerkUserId }
      : { userId: new mongoose.Types.ObjectId(userId) };

    // Accepted submissions per problem (deduplicated by problem)
    const solvedAgg = await Submission.aggregate([
      { $match: { ...matchUser, status: 'accepted', isDraft: false } },
      { $group: { _id: '$problemId' } }, // unique problems solved
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
    ]);

    // Total submissions vs accepted (for acceptance rate)
    const totalSubAgg = await Submission.aggregate([
      { $match: { ...matchUser, isDraft: false } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          accepted: {
            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
          }
        }
      }
    ]);

    // Total problems in DB per difficulty
    const totalProblemsAgg = await CodingProblem.aggregate([
      { $group: { _id: '$difficulty', count: { $sum: 1 } } }
    ]);

    // Build difficulty map
    const solvedMap = { Easy: 0, Medium: 0, Hard: 0 };
    solvedAgg.forEach(({ _id, count }) => {
      if (_id in solvedMap) solvedMap[_id] = count;
    });

    const totalMap = { Easy: 0, Medium: 0, Hard: 0 };
    totalProblemsAgg.forEach(({ _id, count }) => {
      if (_id in totalMap) totalMap[_id] = count;
    });

    const totalSolved = solvedMap.Easy + solvedMap.Medium + solvedMap.Hard;
    const totalProblems = totalMap.Easy + totalMap.Medium + totalMap.Hard;

    const subStats = totalSubAgg[0] || { total: 0, accepted: 0 };
    const acceptanceRate =
      subStats.total > 0
        ? Math.round((subStats.accepted / subStats.total) * 100)
        : 0;

    res.status(200).json({
      codingStats: {
        totalSolved,
        totalProblems,
        easySolved: solvedMap.Easy,
        mediumSolved: solvedMap.Medium,
        hardSolved: solvedMap.Hard,
        totalEasy: totalMap.Easy,
        totalMedium: totalMap.Medium,
        totalHard: totalMap.Hard,
        totalSubmissions: subStats.total,
        acceptedSubmissions: subStats.accepted,
        acceptanceRate
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/submission-activity
 * Returns: array of { date: 'YYYY-MM-DD', count: N } for last 365 days
 */
async function getSubmissionActivity(req, res, next) {
  try {
    const clerkUserId = req.user.clerkUserId;
    const userId = req.user._id;

    const matchUser = clerkUserId
      ? { clerkUserId }
      : { userId: new mongoose.Types.ObjectId(userId) };

    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);

    const activity = await Submission.aggregate([
      {
        $match: {
          ...matchUser,
          isDraft: false,
          createdAt: { $gte: since }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: '$_id', count: 1 } },
      { $sort: { date: 1 } }
    ]);

    res.status(200).json({ activity });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/analytics/streak
 * Returns: { currentStreak, longestStreak, lastActiveDate }
 */
async function getStreakData(req, res, next) {
  try {
    const clerkUserId = req.user.clerkUserId;
    const userId = req.user._id;

    const matchUser = clerkUserId
      ? { clerkUserId }
      : { userId: new mongoose.Types.ObjectId(userId) };

    // Get all unique active days (any submission)
    const days = await Submission.aggregate([
      { $match: { ...matchUser, isDraft: false } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const dateStrings = days.map((d) => d._id);

    if (!dateStrings.length) {
      return res.status(200).json({ streak: { currentStreak: 0, longestStreak: 0, lastActiveDate: null } });
    }

    // Calculate streaks
    let longestStreak = 1;
    let currentRun = 1;

    for (let i = 1; i < dateStrings.length; i++) {
      const prev = new Date(dateStrings[i - 1]);
      const curr = new Date(dateStrings[i]);
      const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentRun++;
        longestStreak = Math.max(longestStreak, currentRun);
      } else {
        currentRun = 1;
      }
    }

    // Current streak: check if last active day is today or yesterday
    const lastDate = new Date(dateStrings[dateStrings.length - 1]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffFromToday = Math.round((today - lastDate) / (1000 * 60 * 60 * 24));

    let currentStreak = 0;
    if (diffFromToday <= 1) {
      // Walk backwards to count current streak
      currentStreak = 1;
      for (let i = dateStrings.length - 2; i >= 0; i--) {
        const prev = new Date(dateStrings[i]);
        const curr = new Date(dateStrings[i + 1]);
        const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    res.status(200).json({
      streak: {
        currentStreak,
        longestStreak,
        lastActiveDate: dateStrings[dateStrings.length - 1]
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
  getPerformance,
  getTopics,
  getCodingStats,
  getSubmissionActivity,
  getStreakData
};
