// Groq-only AI provider

function getGroqApiKey() {
  const key = process.env.GROQ_API_KEY;
  return key ? String(key).trim() : '';
}

function getGroqModel() {
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  return String(model).trim();
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
  const temperature = parameters && typeof parameters.temperature === 'number' ? parameters.temperature : undefined;
  const maxTokens = parameters && typeof parameters.max_new_tokens === 'number' ? parameters.max_new_tokens : undefined;

  return runGroqChatCompletion({ prompt, temperature, maxTokens, timeoutMs });
}

module.exports = {
  generateText
};
