function normalizeTopics(topics) {
  if (!Array.isArray(topics)) return [];
  return topics
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean)
    .slice(0, 10);
}

function generateQuestions(req, res, next) {
  try {
    const { role = 'Software Engineer', difficulty = 'medium', topics = [], count = 5 } = req.body;

    const safeCount = Math.max(1, Math.min(Number(count) || 5, 20));
    const safeTopics = normalizeTopics(topics);

    const questions = Array.from({ length: safeCount }).map((_, idx) => {
      const topic = safeTopics.length ? safeTopics[idx % safeTopics.length] : '';

      const prefix = topic ? `${topic}: ` : '';

      return {
        text: `${prefix}(${difficulty}) ${role} interview question #${idx + 1}`,
        topic
      };
    });

    res.status(200).json({ questions });
  } catch (err) {
    next(err);
  }
}

module.exports = { generateQuestions };
