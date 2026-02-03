const mongoose = require('mongoose');

const InterviewSession = require('../models/InterviewSession');

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
      overview: {
        totalInterviews: total,
        completedInterviews: completed,
        averageScore,
        byType
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getPerformance(req, res, next) {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const points = await InterviewSession.aggregate([
      {
        $match: {
          userId,
          status: 'completed',
          overallScore: { $ne: null }
        }
      },
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

module.exports = { getOverview, getPerformance, getTopics };
