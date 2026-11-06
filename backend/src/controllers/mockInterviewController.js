const MockInterviewSession = require('../models/MockInterviewSession');
const Resume = require('../models/Resume');
const { resolveUser } = require('../utils/resolveUser');
const { groqChat } = require('../utils/aiService');
const { buildSecurityPolicy, recordViolation, securitySummary } = require('../utils/assessmentSecurity');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Maximum number of messages (user + interviewer combined) sent to Groq on
// each turn. This bounds token usage and keeps latency constant regardless of
// how long the session runs. Older messages beyond this window are trimmed.
// The system prompt is always included; only chat history is windowed.
const CHAT_HISTORY_WINDOW = 20;

// After this many messages the session is considered "full" and no more
// candidate messages are accepted. This prevents MongoDB documents from
// growing beyond the 16 MB document limit.
const MAX_SESSION_MESSAGES = 100;

// Messages are accepted for this long after the session's duration runs out,
// to cover network delay on the last answer.
const DURATION_GRACE_MS = 2 * 60 * 1000;

// A reply lock older than this is treated as stale (e.g. the server restarted
// mid-request) and ignored.
const REPLY_LOCK_STALE_MS = 2 * 60 * 1000;

/** Strip control characters / newlines and cap length before putting user text into a prompt. */
function promptSafe(value, maxLen = 100) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sessionDeadline(session) {
  const startedAt = new Date(session.startedAt || session.createdAt).getTime();
  return startedAt + (session.duration || 30) * 60 * 1000;
}

function parseEvaluation(evalRaw) {
  let cleaned = String(evalRaw || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  const evalData = JSON.parse(cleaned);
  const score = Number(evalData.overallScore);
  if (!Number.isFinite(score)) throw new Error('Evaluation has no overallScore');
  const strList = (v) => (Array.isArray(v) ? v.map((x) => String(x)).slice(0, 20) : []);

  return {
    overallScore: Math.min(100, Math.max(0, Math.round(score))),
    strengths: strList(evalData.strengths),
    weaknesses: strList(evalData.weaknesses),
    topicFeedback: Array.isArray(evalData.topicFeedback)
      ? evalData.topicFeedback.slice(0, 20).map((t) => ({
          topic: String((t && t.topic) || ''),
          score: Math.min(100, Math.max(0, Number(t && t.score) || 0)),
          comments: String((t && t.comments) || '')
        }))
      : [],
    communicationFeedback: String(evalData.communicationFeedback || ''),
    technicalDepthFeedback: String(evalData.technicalDepthFeedback || ''),
    improvementTips: strList(evalData.improvementTips),
    recommendedNextSteps: strList(evalData.recommendedNextSteps),
    summary: String(evalData.summary || '')
  };
}

/**
 * Ask the AI to grade the transcript. On failure the session is left without
 * an evaluation (evaluationStatus = 'failed') rather than given a made-up
 * score, so analytics only ever average real evaluations.
 */
async function evaluateSession(session) {
  try {
    const evalRaw = await groqChat(
      [
        { role: 'system', content: 'You are an interview evaluation expert. Respond only with valid JSON.' },
        { role: 'user', content: buildEvaluationPrompt(session) },
      ],
      { temperature: 0.3, maxTokens: 4096 }
    );
    session.evaluation = parseEvaluation(evalRaw);
    session.evaluationStatus = 'success';
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mock-interview] evaluation failed:', err.message);
    session.evaluation = null;
    session.evaluationStatus = 'failed';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI Prompts
// ---------------------------------------------------------------------------

function buildSystemPrompt(session) {
  const typeLabel =
    session.interviewType === 'technical' ? 'Technical'
    : session.interviewType === 'hr' ? 'HR / Behavioral'
    : session.interviewType === 'resume-based' ? 'Resume-Based'
    : 'Mixed (Technical + HR)';

  const topicsStr = session.selectedTopics.length
    ? session.selectedTopics.map((t) => promptSafe(t, 50)).join(', ')
    : 'general topics relevant to the role';

  const base = `You are a professional mock interviewer conducting a real ${typeLabel} interview simulation.

Candidate details:
- Target role: ${promptSafe(session.role) || 'Software Developer'}
- Difficulty level: ${session.difficulty || 'medium'}
- Interview topics: ${topicsStr}
- Interview duration: ${session.duration} minutes

CRITICAL RULE:
You must NEVER provide the correct answer, hints, or complete explanation to the candidate during the interview — even if the candidate gives a wrong or incomplete answer. Your role is to evaluate, guide, and continue the interview — NOT to teach.

QUESTION FLOW:
1. Ask ONE question at a time. Wait for the candidate's response before continuing.
2. Start with a brief, friendly introduction and your first question.
3. Keep questions relevant to the selected interview type, role, difficulty level, and topics.
4. For technical interviews, ask coding concepts, system design, or problem-solving questions appropriate to the difficulty level.
5. For HR interviews, ask behavioral, situational, and culture-fit questions.
6. For mixed interviews, alternate between technical and behavioral questions.
7. Vary question difficulty based on how well the candidate is doing.

ANSWER EVALUATION — After the candidate responds, classify the answer and respond accordingly:

If answer is CORRECT:
- Acknowledge briefly (e.g., "Good answer", "That's correct").
- DO NOT expand or explain further. Move to the next question.

If answer is PARTIALLY CORRECT:
- Say it's partially correct.
- Ask a follow-up question to probe deeper.
- DO NOT reveal the missing part of the answer.

If answer is INCORRECT:
- Clearly but politely say the answer is incorrect.
- DO NOT provide the correct answer.
- Ask: "Would you like to try again or should we move to another question?"
- If candidate says "try again", repeat or slightly rephrase the question.
- If candidate says "next", move to a new question.

If answer is EMPTY or candidate doesn't know:
- Respond: "No problem. Would you like to try another question?"
- Then proceed based on candidate's choice.

STRICT PROHIBITIONS:
- DO NOT explain the correct answer during the interview.
- DO NOT give examples that reveal the answer.
- DO NOT teach concepts mid-interview.
- DO NOT say "the correct answer is..."
- DO NOT give hints that directly lead to the answer.
- DO NOT use markdown formatting, bullet points, or numbered lists.

TONE:
- Professional and encouraging.
- Neutral evaluation (not overly praising or harsh).
- Keep responses concise — speak naturally as a real interviewer would in a conversation.
- Keep the interview interactive. Never break the flow by giving long explanations.
- Always maintain interviewer role under all circumstances.`;

  if (session.resumeContext) {
    return (
      base +
      `\n\nCandidate's Resume Summary:\n${session.resumeContext}\n\nADDITIONAL RESUME-BASED RULES:\n- Ask questions specifically about the candidate's listed projects, experience, and skills.\n- Probe deeper into technologies they claim to know.\n- Ask about challenges faced in their listed projects.\n- Verify their claimed experience with follow-up technical questions.\n- Reference specific items from their resume when asking questions.\n- Mix resume-specific questions with general questions relevant to their target role.`
    );
  }

  return base;
}

function buildEvaluationPrompt(session) {
  const transcript = session.messages
    .map((m) => `${m.role === 'interviewer' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
    .join('\n\n');

  return `You are an expert interview evaluator. Analyze the following mock interview transcript and provide a thorough evaluation.

IMPORTANT: Now that the interview has ended, you MUST provide the correct answers/explanations for every question asked. This is the ONLY time correct answers should be revealed.

Interview details:
- Type: ${session.interviewType}
- Role: ${promptSafe(session.role)}
- Difficulty: ${session.difficulty}
- Topics: ${session.selectedTopics.map((t) => promptSafe(t, 50)).join(', ') || 'general'}

Transcript:
${transcript}

Respond ONLY with valid JSON (no markdown, no code fences, no extra text). Use this exact structure:
{
  "overallScore": <number 0-100>,
  "strengths": ["<strength1>", "<strength2>", ...],
  "weaknesses": ["<weakness1>", "<weakness2>", ...],
  "topicFeedback": [{"topic": "<topic>", "score": <0-100>, "comments": "<feedback including what the correct answer was for questions the candidate got wrong>"}],
  "communicationFeedback": "<feedback on communication skills>",
  "technicalDepthFeedback": "<feedback on technical depth, or empty string if HR interview>",
  "improvementTips": ["<tip1>", "<tip2>", ...],
  "recommendedNextSteps": ["<step1>", "<step2>", ...],
  "summary": "<2-3 sentence summary of overall performance>"
}`;
}

/**
 * Build the windowed message history to send to Groq.
 *
 * Always includes the system prompt. Only sends the most recent
 * CHAT_HISTORY_WINDOW messages from the full session history to keep token
 * usage bounded regardless of session length.
 */
function buildGroqMessages(session) {
  const systemPrompt = buildSystemPrompt(session);
  const allMessages = session.messages;

  // Apply sliding window — take the most recent N messages
  const windowedMessages = allMessages.length > CHAT_HISTORY_WINDOW
    ? allMessages.slice(-CHAT_HISTORY_WINDOW)
    : allMessages;

  return [
    { role: 'system', content: systemPrompt },
    ...windowedMessages.map((msg) => ({
      role: msg.role === 'interviewer' ? 'assistant' : 'user',
      content: msg.content,
    })),
  ];
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

async function startSession(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const {
      interviewType = 'technical',
      difficulty = 'medium',
      duration = 30,
      resumeId = null,
    } = req.body;
    const role = promptSafe(req.body.role || 'Software Developer') || 'Software Developer';
    const selectedTopics = (Array.isArray(req.body.selectedTopics) ? req.body.selectedTopics : [])
      .map((t) => promptSafe(t, 50))
      .filter(Boolean)
      .slice(0, 10);

    // Build resume context if resumeId is provided
    let resumeContext = '';
    let resolvedResumeId = null;

    if (resumeId) {
      try {
        const resume = await Resume.findById(resumeId);
        if (resume && String(resume.userId) === String(user._id) && resume.extractionStatus === 'success') {
          resolvedResumeId = resume._id;
          const ed = resume.extractedData;
          const parts = [];
          if (ed.skills && ed.skills.length) parts.push(`Skills: ${ed.skills.join(', ')}`);
          if (ed.experience && ed.experience.length) {
            parts.push('Experience:\n' + ed.experience.map((e) => `- ${e.title}${e.description ? ': ' + e.description : ''}`).join('\n'));
          }
          if (ed.projects && ed.projects.length) {
            parts.push('Projects:\n' + ed.projects.map((p) => `- ${p.title}${p.description ? ': ' + p.description : ''}`).join('\n'));
          }
          if (ed.education && ed.education.length) {
            parts.push('Education:\n' + ed.education.map((e) => `- ${e.title}${e.description ? ': ' + e.description : ''}`).join('\n'));
          }
          if (ed.awards && ed.awards.length) {
            parts.push('Awards & Achievements:\n' + ed.awards.map((a) => `- ${a.title}${a.description ? ': ' + a.description : ''}`).join('\n'));
          }
          if (ed.certifications && ed.certifications.length) {
            parts.push('Certifications:\n' + ed.certifications.map((c) => `- ${c.title}${c.description ? ': ' + c.description : ''}`).join('\n'));
          }
          if (ed.competitiveProgramming && ed.competitiveProgramming.length) {
            parts.push('Competitive Programming:\n' + ed.competitiveProgramming.map((cp) => `- ${cp.title}${cp.description ? ': ' + cp.description : ''}`).join('\n'));
          }
          resumeContext = parts.join('\n\n');
        }
      } catch (_) {
        // Ignore resume lookup failures — proceed without context
      }
    }

    const session = await MockInterviewSession.create({
      userId: user._id,
      interviewType,
      role,
      difficulty,
      duration,
      selectedTopics,
      resumeId: resolvedResumeId,
      resumeContext,
      // Nothing is generated and the clock doesn't run until the candidate
      // presses Start after the device check (POST /:id/begin).
      status: 'ready',
      startedAt: new Date(),
      currentQuestionNumber: 0,
      messages: [],
      securityPolicy: buildSecurityPolicy(),
    });

    return res.status(201).json({ session });
  } catch (err) {
    return next(err);
  }
}

// POST /:id/begin — the candidate pressed Start: generate the first question and start the clock.
// Safe to call twice: an interview that already began is returned as it is.
async function beginSession(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (session.status === 'active') return res.status(200).json({ session });
    if (session.status !== 'ready') {
      return res.status(409).json({ message: `Interview session is ${session.status}`, session });
    }

    // Take the reply lock so a double click can't generate two first questions
    const staleBefore = new Date(Date.now() - REPLY_LOCK_STALE_MS);
    const locked = await MockInterviewSession.findOneAndUpdate(
      {
        _id: session._id,
        status: 'ready',
        $or: [{ awaitingReplySince: null }, { awaitingReplySince: { $lt: staleBefore } }],
      },
      { $set: { awaitingReplySince: new Date() } },
      { new: true }
    );
    if (!locked) {
      return res.status(409).json({ message: 'The interview is already starting. Please wait a moment.' });
    }

    let aiContent;
    try {
      aiContent = await groqChat([
        { role: 'system', content: buildSystemPrompt(locked) },
        { role: 'user', content: 'Please begin the interview. Introduce yourself briefly and ask your first question.' },
      ]);
      if (!aiContent || !aiContent.trim()) throw new Error('Empty AI response');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[mock-interview] could not begin session:', err.message);
      await MockInterviewSession.updateOne({ _id: locked._id }, { $set: { awaitingReplySince: null } });
      return res.status(502).json({
        message: 'The AI interviewer is unavailable right now. Please try again in a minute.',
      });
    }

    // The candidate may have left (abandoned) while the AI was replying
    const fresh = await MockInterviewSession.findById(locked._id).select('status');
    if (!fresh || fresh.status !== 'ready') {
      await MockInterviewSession.updateOne({ _id: locked._id }, { $set: { awaitingReplySince: null } });
      return res.status(409).json({ message: 'Interview session is no longer waiting to start' });
    }

    locked.messages.push({ role: 'interviewer', content: aiContent, timestamp: new Date() });
    locked.currentQuestionNumber = 1;
    locked.status = 'active';
    // Time starts when the first question is shown
    locked.startedAt = new Date();
    locked.awaitingReplySince = null;
    await locked.save();

    return res.status(200).json({ session: locked });
  } catch (err) {
    return next(err);
  }
}

async function getSession(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.status(200).json({ session });
  } catch (err) {
    return next(err);
  }
}

async function sendMessage(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (session.status !== 'active') {
      return res.status(400).json({ message: 'Interview session is not active' });
    }

    // Enforce max message count to prevent document from growing beyond MongoDB 16 MB limit
    if (session.messages.length >= MAX_SESSION_MESSAGES) {
      return res.status(400).json({
        message: 'This session has reached its maximum length. Please end the interview to receive your evaluation.',
        sessionFull: true,
      });
    }

    if (Date.now() > sessionDeadline(session) + DURATION_GRACE_MS) {
      return res.status(409).json({
        message: 'Time is up for this interview. End it to get your evaluation.',
        timeUp: true,
      });
    }

    // Take the reply lock atomically so two messages can't be answered at once
    const staleBefore = new Date(Date.now() - REPLY_LOCK_STALE_MS);
    const locked = await MockInterviewSession.findOneAndUpdate(
      {
        _id: session._id,
        status: 'active',
        $or: [{ awaitingReplySince: null }, { awaitingReplySince: { $lt: staleBefore } }],
      },
      { $set: { awaitingReplySince: new Date() } },
      { new: true }
    );
    if (!locked) {
      return res.status(409).json({ message: 'Please wait for the interviewer to reply before sending another message.' });
    }

    const { content } = req.body;
    const userMessage = { role: 'user', content: String(content).trim(), timestamp: new Date() };
    locked.messages.push(userMessage);

    // Generate AI follow-up. On failure nothing is saved, so the user can resend.
    let aiContent;
    try {
      aiContent = await groqChat(buildGroqMessages(locked));
      if (!aiContent || !aiContent.trim()) throw new Error('Empty AI response');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[mock-interview] reply failed:', err.message);
      await MockInterviewSession.updateOne({ _id: locked._id }, { $set: { awaitingReplySince: null } });
      return res.status(502).json({
        message: 'The AI interviewer could not respond. Your answer was not saved, please send it again.',
      });
    }

    locked.messages.push({ role: 'interviewer', content: aiContent, timestamp: new Date() });
    locked.currentQuestionNumber = locked.messages.filter((m) => m.role === 'interviewer').length;
    locked.awaitingReplySince = null;

    // The session may have been ended or terminated while the AI was replying
    const fresh = await MockInterviewSession.findById(locked._id).select('status');
    if (!fresh || fresh.status !== 'active') {
      await MockInterviewSession.updateOne({ _id: locked._id }, { $set: { awaitingReplySince: null } });
      return res.status(409).json({ message: 'Interview session is not active' });
    }

    await locked.save();
    return res.status(200).json({ session: locked });
  } catch (err) {
    return next(err);
  }
}

async function endSession(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { status = 'completed' } = req.body;
    // A session that never began can only be abandoned
    const canEnd = session.status === 'active' || (session.status === 'ready' && status === 'abandoned');
    if (!canEnd) {
      return res.status(400).json({ message: 'Interview session is not active' });
    }

    session.status = status;
    session.endedAt = new Date();

    session.awaitingReplySince = null;

    // Generate evaluation if completed (not abandoned) and the candidate answered
    if (status === 'completed' && session.messages.some((m) => m.role === 'user')) {
      await evaluateSession(session);
    }

    await session.save();
    return res.status(200).json({ session });
  } catch (err) {
    return next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const sessions = await MockInterviewSession.find({ userId: user._id, status: { $ne: 'ready' } })
      .select(
        'interviewType role difficulty duration status startedAt endedAt currentQuestionNumber evaluation.overallScore evaluation.summary evaluationStatus createdAt violationCount flagged terminationReason'
      )
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({ sessions });
  } catch (err) {
    return next(err);
  }
}

async function logViolation(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 'ready' covers the moment between pressing Start and the first question arriving
    if (session.status !== 'active' && session.status !== 'ready') {
      return res.status(409).json({ message: 'Interview session is not active', security: securitySummary(session) });
    }

    const { type, details } = req.body;
    const { shouldTerminate } = recordViolation(session, { type, details });
    if (shouldTerminate) {
      // Terminated sessions get no evaluation; the transcript and audit log remain.
      session.status = 'terminated';
      session.endedAt = new Date();
    }
    await session.save();

    return res.status(200).json({ security: securitySummary(session), status: session.status });
  } catch (err) {
    return next(err);
  }
}

// POST /:id/evaluate — retry the AI evaluation of a completed interview
async function retryEvaluation(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const session = await MockInterviewSession.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });
    if (String(session.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    if (session.status !== 'completed' || session.evaluationStatus === 'success') {
      return res.status(409).json({ message: 'Only a completed interview without an evaluation can be re-evaluated' });
    }

    await evaluateSession(session);
    await session.save();

    if (session.evaluationStatus !== 'success') {
      return res.status(502).json({ message: 'The evaluation could not be generated. Please try again later.', session });
    }
    return res.status(200).json({ session });
  } catch (err) {
    return next(err);
  }
}

module.exports = { startSession, beginSession, getSession, sendMessage, endSession, getHistory, logViolation, retryEvaluation };
