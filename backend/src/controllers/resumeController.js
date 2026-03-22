const fs = require('fs');
const path = require('path');

const pdfParse = require('pdf-parse');

const Resume = require('../models/Resume');
const User = require('../models/User');
const { clerkClient } = require('@clerk/clerk-sdk-node');
const {
  upsertUserFromClerkApi,
  getClerkUserIdFromAuth
} = require('./clerkSyncController');

// ---------------------------------------------------------------------------
// Helpers (same pattern as mockInterviewController)
// ---------------------------------------------------------------------------

async function resolveUser(req) {
  const clerkUserId = getClerkUserIdFromAuth(req);
  if (!clerkUserId) return null;

  let user = await User.findOne({ clerkUserId });
  if (!user) {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    user = await upsertUserFromClerkApi(clerkUser);
  }
  return user;
}

function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY;
  return key ? String(key).trim() : '';
}

function getGroqModel() {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return String(model).trim();
}

async function groqChat(messages, { temperature = 0.3, maxTokens = 4096, timeoutMs = 60000 } = {}) {
  const apiKey = getGroqApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: getGroqModel(),
        messages,
        temperature,
        max_tokens: maxTokens
      }),
      signal: controller.signal
    });

    const text = await res.text();
    let json;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }

    if (!res.ok) {
      const msg = (json && json.error && (json.error.message || json.error.type)) ||
        (json && json.message) || text || `Groq request failed (${res.status})`;
      const e = new Error(msg);
      e.status = res.status;
      throw e;
    }

    const content = json?.choices?.[0]?.message?.content || '';
    return content;
  } finally {
    clearTimeout(t);
  }
}

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
  ]
}

Rules:
- Extract ALL skills mentioned (programming languages, frameworks, tools, soft skills)
- For projects, include ALL projects with their tech stacks
- For experience, include ALL work experience, internships, and positions
- For education, include ALL educational background
- If a field is not found, use an empty array
- Dates should be in human-readable format (e.g., "Jan 2023", "2022", "Present")`;
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

async function uploadResume(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    if (!req.file) {
      return res.status(400).json({ message: 'Resume file is required' });
    }

    // Parse PDF using pdf-parse v1 simple API
    const fileBuffer = fs.readFileSync(req.file.path);
    let rawText = '';

    try {
      const data = await pdfParse(fileBuffer);
      rawText = data && data.text ? data.text.trim() : '';
    } catch (err) {
      console.error('PDF parse error:', err.message);
      rawText = '';
    }


    // Create initial resume record
    const resume = await Resume.create({
      userId: user._id,
      fileName: req.file.originalname,
      filePath: req.file.path,
      rawText,
      extractedData: { skills: [], projects: [], experience: [], education: [] },
      extractionStatus: 'pending',
      uploadDate: new Date()
    });

    // AI extraction with Groq (skip if text too short)
    let extractedData = { skills: [], projects: [], experience: [], education: [] };
    let extractionStatus = 'failed';

    if (rawText.length >= 30) {
      try {
        const prompt = buildExtractionPrompt(rawText);
        const aiResponse = await groqChat([
          { role: 'system', content: 'You are a resume parsing expert. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ]);

        // Parse JSON — strip code fences if model adds them
        let cleaned = aiResponse.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
        }

        const parsed = JSON.parse(cleaned);

        extractedData = {
          skills: Array.isArray(parsed.skills) ? parsed.skills.filter((s) => typeof s === 'string' && s.trim()) : [],
          projects: Array.isArray(parsed.projects) ? parsed.projects.map((p) => ({
            title: String(p.title || '').trim(),
            description: String(p.description || '').trim(),
            startDate: String(p.startDate || '').trim(),
            endDate: String(p.endDate || '').trim()
          })).filter((p) => p.title) : [],
          experience: Array.isArray(parsed.experience) ? parsed.experience.map((e) => ({
            title: String(e.title || '').trim(),
            description: String(e.description || '').trim(),
            startDate: String(e.startDate || '').trim(),
            endDate: String(e.endDate || '').trim()
          })).filter((e) => e.title) : [],
          education: Array.isArray(parsed.education) ? parsed.education.map((e) => ({
            title: String(e.title || '').trim(),
            description: String(e.description || '').trim(),
            startDate: String(e.startDate || '').trim(),
            endDate: String(e.endDate || '').trim()
          })).filter((e) => e.title) : []
        };

        extractionStatus = 'success';
      } catch (aiErr) {
        console.error('Resume AI extraction failed:', aiErr.message);
        extractionStatus = 'failed';
      }
    } else {

    }

    // Update resume with extracted data
    resume.extractedData = extractedData;
    resume.extractionStatus = extractionStatus;
    await resume.save();

    return res.status(201).json({
      resume: {
        id: resume._id,
        fileName: resume.fileName,
        extractedData: resume.extractedData,
        extractionStatus: resume.extractionStatus,
        uploadDate: resume.uploadDate
      }
    });
  } catch (err) {
    return next(err);
  }
}

async function getResume(req, res, next) {
  try {
    const user = await resolveUser(req);
    if (!user) return res.status(401).json({ message: 'Not authorized' });

    const resume = await Resume.findOne({ userId: user._id })
      .sort({ uploadDate: -1 })
      .select('-rawText');

    if (!resume) {
      return res.status(404).json({ message: 'No resume found. Please upload one first.' });
    }

    return res.status(200).json({ resume });
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
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    }

    await resume.deleteOne();

    return res.status(200).json({ message: 'Resume deleted' });
  } catch (err) {
    return next(err);
  }
}

module.exports = { uploadResume, getResume, deleteResume };
