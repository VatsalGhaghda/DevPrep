const fs = require('fs');
const path = require('path');

const pdfParse = require('pdf-parse');

const Resume = require('../models/Resume');
const { resolveUser } = require('../utils/resolveUser');
const { groqChat } = require('../utils/aiService');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// AI extraction prompt
// ---------------------------------------------------------------------------

function buildExtractionPrompt(rawText) {
  return `Extract structured data from the following resume text. Be thorough and extract ALL information.

Resume text:
---
${rawText.substring(0, 8000)}
---

Respond ONLY with valid JSON (no markdown, no code fences, no extra text). Use this exact structure:
{
  "skills": ["skill1", "skill2", ...],
  "projects": [
    {"title": "project name", "description": "brief description of the project and technologies used", "startDate": "start date or empty", "endDate": "end date or empty"}
  ],
  "experience": [
    {"title": "job title at company name", "description": "brief description of role and responsibilities", "startDate": "start date", "endDate": "end date or Present"}
  ],
  "education": [
    {"title": "degree at institution name", "description": "major/field of study and any notable achievements", "startDate": "start year", "endDate": "end year or expected"}
  ],
  "awards": [
    {"title": "award name or achievement title", "description": "brief description or context", "startDate": "date received", "endDate": ""}
  ],
  "certifications": [
    {"title": "certification name", "description": "issuing organization or details", "startDate": "date issued", "endDate": "expiration date or empty"}
  ],
  "competitiveProgramming": [
    {"title": "platform (e.g. LeetCode, Codeforces)", "description": "rating, rank, or notable achievements", "startDate": "", "endDate": ""}
  ]
}

Rules:
- Extract ALL skills mentioned (programming languages, frameworks, tools, soft skills)
- For projects, include ALL projects with their tech stacks
- For experience, include ALL work experience, internships, and positions
- For education, include ALL educational background
- Extract any honors, awards, or achievements under awards
- Extract any certifications or licenses under certifications
- Extract any competitive programming profiles, ranks, or contest achievements under competitiveProgramming
- If a field is not found, use an empty array
- Dates should be in human-readable format (e.g., "Jan 2023", "2022", "Present")`;
}

/**
 * Parse and validate the AI JSON response into our extractedData shape.
 */
function parseExtractionResponse(aiResponse) {
  let cleaned = aiResponse.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  const parsed = JSON.parse(cleaned);

  return {
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.filter((s) => typeof s === 'string' && s.trim())
      : [],
    projects: Array.isArray(parsed.projects)
      ? parsed.projects
          .map((p) => ({
            title: String(p.title || '').trim(),
            description: String(p.description || '').trim(),
            startDate: String(p.startDate || '').trim(),
            endDate: String(p.endDate || '').trim(),
          }))
          .filter((p) => p.title)
      : [],
    experience: Array.isArray(parsed.experience)
      ? parsed.experience
          .map((e) => ({
            title: String(e.title || '').trim(),
            description: String(e.description || '').trim(),
            startDate: String(e.startDate || '').trim(),
            endDate: String(e.endDate || '').trim(),
          }))
          .filter((e) => e.title)
      : [],
    education: Array.isArray(parsed.education)
      ? parsed.education
          .map((e) => ({
            title: String(e.title || '').trim(),
            description: String(e.description || '').trim(),
            startDate: String(e.startDate || '').trim(),
            endDate: String(e.endDate || '').trim(),
          }))
          .filter((e) => e.title)
      : [],
    awards: Array.isArray(parsed.awards)
      ? parsed.awards
          .map((a) => ({
            title: String(a.title || '').trim(),
            description: String(a.description || '').trim(),
            startDate: String(a.startDate || '').trim(),
            endDate: String(a.endDate || '').trim(),
          }))
          .filter((a) => a.title)
      : [],
    certifications: Array.isArray(parsed.certifications)
      ? parsed.certifications
          .map((c) => ({
            title: String(c.title || '').trim(),
            description: String(c.description || '').trim(),
            startDate: String(c.startDate || '').trim(),
            endDate: String(c.endDate || '').trim(),
          }))
          .filter((c) => c.title)
      : [],
    competitiveProgramming: Array.isArray(parsed.competitiveProgramming)
      ? parsed.competitiveProgramming
          .map((cp) => ({
            title: String(cp.title || '').trim(),
            description: String(cp.description || '').trim(),
            startDate: String(cp.startDate || '').trim(),
            endDate: String(cp.endDate || '').trim(),
          }))
          .filter((cp) => cp.title)
      : [],
  };
}

// An extraction still 'pending' after this long is assumed dead and retried
const EXTRACTION_STALE_MS = 2 * 60 * 1000;

async function extractPdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data && data.text ? data.text.trim() : '';
  } catch (_) {
    return '';
  }
}

/**
 * Run the AI extraction for a resume whose text is already stored and update
 * the document. Runs after the HTTP response is sent.
 */
async function runExtractionAsync(resumeId) {
  try {
    const resume = await Resume.findById(resumeId).select('rawText');
    if (!resume) return;
    const rawText = resume.rawText || '';

    let extractedData = { skills: [], projects: [], experience: [], education: [], awards: [], certifications: [], competitiveProgramming: [] };
    let extractionStatus = 'failed';

    if (rawText.length >= 30) {
      try {
        const aiResponse = await groqChat(
          [
            { role: 'system', content: 'You are a resume parsing expert. Respond only with valid JSON.' },
            { role: 'user', content: buildExtractionPrompt(rawText) },
          ],
          { temperature: 0.3, maxTokens: 4096 }
        );
        extractedData = parseExtractionResponse(aiResponse);
        extractionStatus = 'success';
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[resume] extraction failed:', err.message);
        extractionStatus = 'failed';
      }
    }

    await Resume.findByIdAndUpdate(resumeId, { extractedData, extractionStatus, extractionStartedAt: null });
  } catch (_) {
    await Resume.findByIdAndUpdate(resumeId, { extractionStatus: 'failed', extractionStartedAt: null }).catch(() => {});
  }
}

function startExtraction(resumeId) {
  // setImmediate gives Node's event loop a tick to flush the response first
  setImmediate(() => {
    runExtractionAsync(resumeId);
  });
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * Upload: the PDF is parsed in memory (never written to disk, which is wiped
 * on every deploy on Render/Railway), the text is saved, and the slower AI
 * extraction runs after the response. The client polls GET /api/resume.
 */
async function uploadResume(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Resume file is required' });
    }

    // Real PDFs start with %PDF- (the browser-sent MIME type can't be trusted)
    if (req.file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return res.status(400).json({ message: 'Only PDF files are allowed' });
    }

    const rawText = await extractPdfText(req.file.buffer);
    if (rawText.length < 30) {
      return res.status(422).json({
        message: 'Could not read text from this PDF. If it is a scanned image, export it as a text PDF and try again.'
      });
    }

    const resume = await Resume.create({
      userId: user._id,
      fileName: String(req.file.originalname || 'resume.pdf').slice(0, 255),
      rawText,
      extractedData: { skills: [], projects: [], experience: [], education: [] },
      extractionStatus: 'pending',
      extractionStartedAt: new Date(),
      uploadDate: new Date(),
    });

    // Keep only the latest resume per user
    await Resume.deleteMany({ userId: user._id, _id: { $ne: resume._id } });

    res.status(201).json({
      resume: {
        id: resume._id,
        fileName: resume.fileName,
        extractedData: resume.extractedData,
        extractionStatus: resume.extractionStatus,
        uploadDate: resume.uploadDate,
      },
    });

    startExtraction(resume._id);
    return undefined;
  } catch (err) {
    return next(err);
  }
}

async function getResume(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const resume = await Resume.findOne({ userId: user._id }).sort({ uploadDate: -1 });

    if (!resume) {
      return res.status(404).json({ message: 'No resume found. Please upload one first.' });
    }

    // Recover extractions that died with a server restart: retry them once
    const startedAt = resume.extractionStartedAt || resume.updatedAt;
    if (resume.extractionStatus === 'pending' && Date.now() - new Date(startedAt).getTime() > EXTRACTION_STALE_MS) {
      const claimed = await Resume.findOneAndUpdate(
        { _id: resume._id, extractionStatus: 'pending', extractionStartedAt: resume.extractionStartedAt },
        { $set: { extractionStartedAt: new Date() } },
        { new: true }
      );
      if (claimed && resume.rawText) {
        startExtraction(resume._id);
      } else if (claimed) {
        await Resume.updateOne({ _id: resume._id }, { $set: { extractionStatus: 'failed', extractionStartedAt: null } });
        resume.extractionStatus = 'failed';
      }
    }

    const view = resume.toObject();
    delete view.rawText;
    return res.status(200).json({ resume: view });
  } catch (err) {
    return next(err);
  }
}

async function deleteResume(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    if (String(resume.userId) !== String(user._id)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    if (resume.filePath) {
      const fp = path.resolve(resume.filePath);
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (_) {
        // File deletion is best-effort
      }
    }

    await resume.deleteOne();

    return res.status(200).json({ message: 'Resume deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { uploadResume, getResume, deleteResume };
