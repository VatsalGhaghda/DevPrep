const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const User = require('../models/User');

function ensureEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`${name} is not set`);
  }
  return v;
}

function initPassport() {
  const clientID = ensureEnv('GOOGLE_CLIENT_ID');
  const clientSecret = ensureEnv('GOOGLE_CLIENT_SECRET');
  const backendUrl = ensureEnv('BACKEND_URL').replace(/\/$/, '');

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: `${backendUrl}/api/auth/google/callback`
      },
      async function (accessToken, refreshToken, profile, done) {
        try {
          const googleId = profile && profile.id ? profile.id : '';
          const email =
            profile && profile.emails && profile.emails[0] && profile.emails[0].value
              ? profile.emails[0].value.toLowerCase()
              : '';
          const name = profile && profile.displayName ? profile.displayName : 'User';

          if (!googleId) {
            return done(new Error('Google profile id missing'));
          }

          let user = await User.findOne({ googleId });

          if (!user && email) {
            user = await User.findOne({ email });
          }

          if (!user) {
            user = await User.create({
              name,
              email: email || `${googleId}@google-oauth.local`,
              password: `oauth_${googleId}_${Date.now()}`,
              googleId,
              isEmailVerified: true
            });
          } else {
            let changed = false;
            if (!user.googleId) {
              user.googleId = googleId;
              changed = true;
            }
            if (!user.isEmailVerified) {
              user.isEmailVerified = true;
              changed = true;
            }
            if (changed) {
              await user.save();
            }
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  return passport;
}

module.exports = { initPassport };
