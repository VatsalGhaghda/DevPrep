function getHuggingFaceApiKey() {
  const key = process.env.HUGGINGFACE_API_KEY;
  if (!key) {
    throw new Error('HUGGINGFACE_API_KEY is not set');
  }
  return String(key).trim();
}

function getHuggingFaceModel() {
  const model = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
  return String(model).trim();
}

function getHuggingFaceBaseUrl() {
  const raw = process.env.HUGGINGFACE_BASE_URL || 'https://router.huggingface.co/v1';
  const base = String(raw).trim();
  if (base.includes('api-inference.huggingface.co')) {
    return 'https://router.huggingface.co/v1';
  }
  return base.replace(/\/$/, '');
}

async function hfRequest(path, { method = 'POST', body, timeoutMs = 60000 } = {}) {
  const apiKey = getHuggingFaceApiKey();
  const baseUrl = getHuggingFaceBaseUrl();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined,
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
      const msg = (json && (json.error || json.message)) || text || `Hugging Face request failed (${res.status})`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = json || text;
      throw err;
    }

    return json;
  } finally {
    clearTimeout(t);
  }
}

async function runInference({ prompt, model, parameters, options, timeoutMs } = {}) {
  const resolvedModel = String(model || getHuggingFaceModel()).trim();
  const payload = {
    inputs: String(prompt || ''),
    ...(parameters ? { parameters } : {}),
    ...(options ? { options } : {})
  };

  return hfRequest(`/models/${encodeURIComponent(resolvedModel)}`, {
    body: payload,
    timeoutMs
  });
}

async function runChatCompletion({ prompt, model, temperature, maxTokens, timeoutMs } = {}) {
  const resolvedModel = String(model || getHuggingFaceModel()).trim();
  const payload = {
    model: resolvedModel,
    messages: [{ role: 'user', content: String(prompt || '') }],
    ...(typeof temperature === 'number' ? { temperature } : {}),
    ...(typeof maxTokens === 'number' ? { max_tokens: maxTokens } : {})
  };

  return hfRequest('/chat/completions', {
    body: payload,
    timeoutMs
  });
}

module.exports = {
  getHuggingFaceApiKey,
  getHuggingFaceModel,
  getHuggingFaceBaseUrl,
  hfRequest,
  runInference,
  runChatCompletion
};
