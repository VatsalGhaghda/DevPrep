/**
 * speechService.js — speech-to-text through Groq's hosted Whisper models.
 *
 * Used by voice interviews when the browser has no built-in speech
 * recognition (Firefox, Safari on some versions, Brave). The audio is sent
 * straight to Groq and is never stored.
 */

const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

function getSttModel() {
  return String(process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo').trim();
}

const EXTENSIONS = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/x-m4a': 'm4a',
  'audio/m4a': 'm4a'
};

function baseMime(mimetype) {
  return String(mimetype || '').split(';')[0].trim().toLowerCase();
}

function isSupportedAudio(mimetype) {
  return Boolean(EXTENSIONS[baseMime(mimetype)]);
}

/**
 * @param {Buffer} buffer      audio bytes
 * @param {string} mimetype    e.g. "audio/webm;codecs=opus"
 * @param {Object} [opts]
 * @param {string} [opts.language]  ISO-639-1 code such as "en"
 * @param {number} [opts.timeoutMs=60000]
 * @returns {Promise<string>} the transcript text
 */
async function transcribeAudio(buffer, mimetype, { language, timeoutMs = 60000 } = {}) {
  const apiKey = process.env.GROQ_API_KEY ? String(process.env.GROQ_API_KEY).trim() : '';
  if (!apiKey) {
    const e = new Error('Voice transcription is not configured on the server');
    e.status = 503;
    throw e;
  }

  const type = baseMime(mimetype);
  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), `answer.${EXTENSIONS[type] || 'webm'}`);
  form.append('model', getSttModel());
  form.append('response_format', 'json');
  form.append('temperature', '0');
  if (language) form.append('language', language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }

    if (!res.ok) {
      const e = new Error(
        (json && json.error && (json.error.message || json.error.type)) || `Transcription failed (${res.status})`
      );
      // Upstream rate limit stays a 429 for the client; other upstream errors are 502
      e.status = res.status === 429 ? 429 : 502;
      throw e;
    }
    return String((json && json.text) || '').trim();
  } catch (err) {
    if (err.name === 'AbortError') {
      const e = new Error('Transcription timed out');
      e.status = 504;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { transcribeAudio, isSupportedAudio };
