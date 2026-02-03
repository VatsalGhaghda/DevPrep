const InterviewSession = require('../models/InterviewSession');

async function getProfile(req, res, next) {
  try {
    const user = req.user;

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        targetRole: user.targetRole,
        experienceLevel: user.experienceLevel,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const user = req.user;

    const allowed = [
      'name',
      'skills',
      'targetRole',
      'experienceLevel',
      'bio',
      'avatar'
    ];

    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        user[key] = req.body[key];
      }
    }

    await user.save();

    res.status(200).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills,
        targetRole: user.targetRole,
        experienceLevel: user.experienceLevel,
        bio: user.bio,
        avatar: user.avatar,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getStats(req, res, next) {
  try {
    const userId = req.user._id;

    const totalInterviews = await InterviewSession.countDocuments({
      userId
    });

    const completedInterviews = await InterviewSession.countDocuments({
      userId,
      status: 'completed'
    });

    const agg = await InterviewSession.aggregate([
      { $match: { userId, status: 'completed', overallScore: { $ne: null } } },
      { $group: { _id: null, avgScore: { $avg: '$overallScore' } } }
    ]);

    const averageScore = agg.length ? agg[0].avgScore : null;

    res.status(200).json({
      stats: {
        totalInterviews,
        completedInterviews,
        averageScore
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, getStats };
