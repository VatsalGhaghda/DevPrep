const mongoose = require('mongoose');

const User = require('../models/User');
const InterviewSession = require('../models/InterviewSession');

async function getUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(Number(limit), 100));

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: String(search), $options: 'i' } },
        { email: { $regex: String(search), $options: 'i' } }
      ];
    }

    const users = await User.find(filter)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const totalUsers = await User.countDocuments();
    const totalInterviews = await InterviewSession.countDocuments();
    const completedInterviews = await InterviewSession.countDocuments({ status: 'completed' });

    const byType = await InterviewSession.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $project: { _id: 0, type: '$_id', count: 1 } },
      { $sort: { count: -1 } }
    ]);

    const byDifficulty = await InterviewSession.aggregate([
      { $match: { difficulty: { $ne: '' } } },
      { $group: { _id: '$difficulty', count: { $sum: 1 } } },
      { $project: { _id: 0, difficulty: '$_id', count: 1 } },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      stats: {
        totalUsers,
        totalInterviews,
        completedInterviews,
        byType,
        byDifficulty
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getAnalytics(req, res, next) {
  try {
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const userGrowth = await User.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          newUsers: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: '$_id', newUsers: 1 } },
      { $sort: { date: 1 } }
    ]);

    const interviewVolume = await InterviewSession.aggregate([
      { $match: { createdAt: { $gte: last30Days } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          interviews: { $sum: 1 }
        }
      },
      { $project: { _id: 0, date: '$_id', interviews: 1 } },
      { $sort: { date: 1 } }
    ]);

    res.status(200).json({
      analytics: {
        userGrowth,
        interviewVolume
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getUsers, getStats, getAnalytics };
