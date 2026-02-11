const { clerkClient } = require('@clerk/clerk-sdk-node');

const User = require('../models/User');
const {
  upsertUserFromClerkApi,
  getClerkUserIdFromAuth
} = require('./clerkSyncController');

async function getProfile(req, res, next) {
  try {
    const clerkUserId = getClerkUserIdFromAuth(req);
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    let user = await User.findOne({ clerkUserId });
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      user = await upsertUserFromClerkApi(clerkUser);
    }

    return res.status(200).json({
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
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const clerkUserId = getClerkUserIdFromAuth(req);
    if (!clerkUserId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    let user = await User.findOne({ clerkUserId });
    if (!user) {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      user = await upsertUserFromClerkApi(clerkUser);
    }

    const allowed = ['name', 'skills', 'targetRole', 'experienceLevel', 'bio', 'avatar'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        user[key] = req.body[key];
      }
    }

    await user.save();

    return res.status(200).json({
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
    return next(err);
  }
}

module.exports = { getProfile, updateProfile };
