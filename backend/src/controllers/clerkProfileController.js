const User = require('../models/User');
const { resolveUser } = require('../utils/resolveUser');
const { publicUserView, USERNAME_RE } = require('./clerkSyncController');

async function getProfile(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });
    return res.status(200).json({ user: publicUserView(user) });
  } catch (err) {
    return next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const allowed = ['name', 'skills', 'targetRole', 'experienceLevel', 'bio', 'avatar', 'isProfilePublic'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        user[key] = req.body[key];
      }
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'username')) {
      const username = String(req.body.username || '').trim().toLowerCase();
      if (!USERNAME_RE.test(username)) {
        return res.status(400).json({
          message: 'Username must be 3-30 characters: lowercase letters, numbers, "-" or "_", starting with a letter or number'
        });
      }
      if (username !== user.username) {
        const taken = await User.exists({ username, _id: { $ne: user._id } });
        if (taken) return res.status(409).json({ message: 'That username is already taken' });
        user.username = username;
      }
    }

    await user.save();

    return res.status(200).json({ user: publicUserView(user) });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getProfile, updateProfile };
