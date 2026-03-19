const { runChatCompletion, runInference, getHuggingFaceBaseUrl, getHuggingFaceModel } = require('./huggingface');

function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY;
  return key ? String(key).trim() : '';
}

function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY;
  return key ? String(key).trim() : '';
}

function getGroqModel() {
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  return String(model).trim();
}

function getGeminiModel() {
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const trimmed = String(model).trim();
  const noPrefix = trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed;

  // Some model names show up in examples as "*-latest" but the API may only expose the base id.
  // Example: gemini-2.5-flash-latest -> gemini-2.5-flash
  const latestMatch = noPrefix.match(/^(gemini-\d+(?:\.\d+)?-(?:flash|pro))-latest$/);
  if (latestMatch) return latestMatch[1];

  return noPrefix;
}

function getGeminiApiVersion() {
  const v = process.env.GEMINI_API_VERSION || 'v1beta';
  const trimmed = String(v).trim();
  return trimmed || 'v1beta';
}

async function runGeminiGenerateContent({ prompt, temperature, maxTokens, timeoutMs } = {}) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const model = getGeminiModel();
  const apiVersion = getGeminiApiVersion();
  const url = `https://generativelanguage.googleapis.com/${encodeURIComponent(apiVersion)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), typeof timeoutMs === 'number' ? timeoutMs : 60000);

  try {
    const payload = {
      contents: [{ role: 'user', parts: [{ text: String(prompt || '') }] }],
      generationConfig: {
        ...(typeof temperature === 'number' ? { temperature } : {}),
        ...(typeof maxTokens === 'number' ? { maxOutputTokens: maxTokens } : {})
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }

    if (!res.ok) {
      const msg = (json && (json.error && json.error.message)) || (json && json.message) || text || `Gemini request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = json || text;
      throw err;
    }

    const contentText =
      json &&
      Array.isArray(json.candidates) &&
      json.candidates[0] &&
      json.candidates[0].content &&
      Array.isArray(json.candidates[0].content.parts)
        ? json.candidates[0].content.parts.map((p) => (p && typeof p.text === 'string' ? p.text : '')).join('')
        : '';

    return {
      choices: [
        {
          message: {
            content: contentText
          }
        }
      ],
      _raw: json
    };
  } finally {
    clearTimeout(t);
  }
}

function isGeminiQuotaLikeError(err) {
  const status = err && typeof err.status === 'number' ? err.status : 0;
  const msg = String(err && err.message ? err.message : '').toLowerCase();
  if (status === 429) return true;
  if (msg.includes('quota')) return true;
  if (msg.includes('rate limit')) return true;
  if (msg.includes('billing')) return true;
  return false;
}

async function runGroqChatCompletion({ prompt, temperature, maxTokens, timeoutMs } = {}) {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const model = getGroqModel();
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), typeof timeoutMs === 'number' ? timeoutMs : 60000);

  try {
    const payload = {
      model,
      messages: [{ role: 'user', content: String(prompt || '') }],
      ...(typeof temperature === 'number' ? { temperature } : {}),
      ...(typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {})
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }

    if (!res.ok) {
      const msg =
        (json && json.error && (json.error.message || json.error.type)) ||
        (json && json.message) ||
        text ||
        `Groq request failed (${res.status})`;
      const e = new Error(msg);
      e.status = res.status;
      e.body = json || text;
      throw e;
    }

    // Return OpenAI-like response shape with choices/message/content.
    return json;
  } finally {
    clearTimeout(t);
  }
}

async function generateText({ prompt, model, parameters, options, timeoutMs } = {}) {
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const temperature = parameters && typeof parameters.temperature === 'number' ? parameters.temperature : undefined;
    const maxTokens = parameters && typeof parameters.max_new_tokens === 'number' ? parameters.max_new_tokens : undefined;
    try {
      return await runGeminiGenerateContent({ prompt, temperature, maxTokens, timeoutMs });
    } catch (err) {
      const groqKey = getGroqApiKey();
      if (groqKey && isGeminiQuotaLikeError(err)) {
        return runGroqChatCompletion({ prompt, temperature, maxTokens, timeoutMs });
      }
      throw err;
    }
  }

  const resolvedModel = model || getHuggingFaceModel();
  const baseUrl = getHuggingFaceBaseUrl();
  const isRouter = String(baseUrl || '').includes('router.huggingface.co');

  const temperature = parameters && typeof parameters.temperature === 'number' ? parameters.temperature : undefined;
  const maxTokens = parameters && typeof parameters.max_new_tokens === 'number' ? parameters.max_new_tokens : undefined;

  try {
    return await runChatCompletion({
      prompt,
      model: resolvedModel,
      temperature,
      maxTokens,
      timeoutMs
    });
  } catch (err) {
    // Fallback for older base URLs pointing at /models inference.
    // Hugging Face Router (router.huggingface.co) does NOT support /models/<model>.
    if (isRouter) {
      throw err;
    }

    return runInference({
      prompt,
      model: resolvedModel,
      parameters,
      options,
      timeoutMs
    });
  }
}

module.exports = {
  generateText
};
