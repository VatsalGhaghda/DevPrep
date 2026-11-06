const MockInterviewSession = require('../models/MockInterviewSession');
const { resolveUser } = require('../utils/resolveUser');
const { transcribeAudio } = require('../utils/speechService');

/**
 * POST /api/mock-interviews/:id/transcribe   (multipart, field "audio")
 *
 * Turns a recorded spoken answer into text. The text is returned to the
 * browser so the candidate can review and edit it; it is not added to the
 * interview until they send it through the normal /message endpoint.
 */
async function transcribeAnswer(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id).select('userId status');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Interview session is not active' });
    }

    if (!req.file || !req.file.buffer || req.file.size === 0) {
      return res.status(400).json({ message: 'No audio was received' });
    }

    const language = typeof req.body.language === 'string' && /^[a-z]{2}$/i.test(req.body.language)
      ? req.body.language.toLowerCase()
      : undefined;

    const text = await transcribeAudio(req.file.buffer, req.file.mimetype, { language });
    return res.json({ text });
  } catch (err) {
    return next(err);
  }
}

module.exports = { transcribeAnswer };
