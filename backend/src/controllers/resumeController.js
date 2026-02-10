const fs = require('fs');
const path = require('path');

const pdfParse = require('pdf-parse');

const Resume = require('../models/Resume');

async function uploadResume(req, res, next) {
  try {
    if (!req.file) {
      res.status(400);
      throw new Error('Resume file is required');
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    let extractedText = '';

    try {
      const parsed = await pdfParse(fileBuffer);
      extractedText = parsed && parsed.text ? parsed.text : '';
    } catch (err) {
      extractedText = '';
    }

    const resume = await Resume.create({
      userId: req.user._id,
      fileName: req.file.originalname,
      filePath: req.file.path,
      extractedData: {
        skills: [],
        projects: [],
        experience: [],
        education: []
      },
      uploadDate: new Date()
    });

    res.status(201).json({
      resume: {
        id: resume._id,
        fileName: resume.fileName,
        filePath: resume.filePath,
        uploadDate: resume.uploadDate
      },
      extractedText
    });
  } catch (err) {
    next(err);
  }
}

async function getResume(req, res, next) {
  try {
    const resume = await Resume.findOne({ userId: req.user._id }).sort({ uploadDate: -1 });

    if (!resume) {
      res.status(404);
      throw new Error('Resume not found');
    }

    res.status(200).json({ resume });
  } catch (err) {
    next(err);
  }
}

async function deleteResume(req, res, next) {
  try {
    const resume = req.resource || (await Resume.findById(req.params.id));

    if (!resume) {
      res.status(404);
      throw new Error('Resume not found');
    }

    if (!req.resource && String(resume.userId) !== String(req.user._id)) {
      res.status(403);
      throw new Error('Forbidden');
    }

    if (resume.filePath) {
      const fp = path.resolve(resume.filePath);
      if (fs.existsSync(fp)) {
        fs.unlinkSync(fp);
      }
    }

    await resume.deleteOne();

    res.status(200).json({ message: 'Resume deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadResume, getResume, deleteResume };
