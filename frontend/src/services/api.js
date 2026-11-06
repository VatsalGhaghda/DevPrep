import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Every request passes the Clerk session token explicitly (see below).

// The viewer's time zone, so daily stats (heatmap, streaks) use local days
const TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {
    return 'UTC';
  }
})();
const tzParams = { tz: TIME_ZONE };

/* ── Clerk ── */
export const clerkAPI = {
  syncMe: (clerkToken) =>
    api.post('/clerk/sync/me', {}, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getProfile: (clerkToken) =>
    api.get('/clerk/profile', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  updateProfile: (clerkToken, data) =>
    api.put('/clerk/profile', data, { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Questions ── */
export const questionsAPI = {
  generate: (clerkToken, payload) =>
    api.post('/questions/generate', payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  save: (clerkToken, payload) =>
    api.post('/questions/save', payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getSavedStats: (clerkToken) =>
    api.get('/questions/saved/stats', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getAttempt: (clerkToken, attemptId) =>
    api.get(`/questions/attempts/${attemptId}`, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  startAttempt: (clerkToken, attemptId) =>
    api.post(`/questions/attempts/${attemptId}/start`, {}, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  submitAttempt: (clerkToken, attemptId, answers) =>
    api.post(`/questions/attempts/${attemptId}/submit`, { answers }, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  abandonAttempt: (clerkToken, attemptId) =>
    api.post(`/questions/attempts/${attemptId}/abandon`, {}, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  retakeAttempt: (clerkToken, attemptId) =>
    api.post(`/questions/attempts/${attemptId}/retake`, {}, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  logViolation: (clerkToken, attemptId, payload) =>
    api.post(`/questions/attempts/${attemptId}/violations`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Mock Interview ── */
export const mockInterviewAPI = {
  start: (clerkToken, payload) =>
    api.post('/mock-interviews/start', payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  // Generates the first question and starts the clock (after the device check)
  begin: (clerkToken, sessionId) =>
    api.post(`/mock-interviews/${sessionId}/begin`, {}, { headers: { Authorization: `Bearer ${clerkToken}` }, timeout: 90000 }),
  getSession: (clerkToken, sessionId) =>
    api.get(`/mock-interviews/${sessionId}`, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  sendMessage: (clerkToken, sessionId, content) =>
    api.post(`/mock-interviews/${sessionId}/message`, { content }, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  endSession: (clerkToken, sessionId, status = 'completed') =>
    api.post(`/mock-interviews/${sessionId}/end`, { status }, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getHistory: (clerkToken) =>
    api.get('/mock-interviews/history', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  logViolation: (clerkToken, sessionId, payload) =>
    api.post(`/mock-interviews/${sessionId}/violations`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  retryEvaluation: (clerkToken, sessionId) =>
    api.post(`/mock-interviews/${sessionId}/evaluate`, {}, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  // Voice mode fallback: server-side speech-to-text for one recorded answer
  transcribe: (clerkToken, sessionId, formData) =>
    api.post(`/mock-interviews/${sessionId}/transcribe`, formData, {
      headers: { Authorization: `Bearer ${clerkToken}`, 'Content-Type': 'multipart/form-data' },
      timeout: 90000
    })
};

/* ── Resume ── */
export const resumeAPI = {
  upload: (clerkToken, formData) =>
    api.post('/resume/upload', formData, {
      headers: { Authorization: `Bearer ${clerkToken}`, 'Content-Type': 'multipart/form-data' }
    }),
  getResume: (clerkToken) =>
    api.get('/resume', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  deleteResume: (clerkToken, id) =>
    api.delete(`/resume/${id}`, { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Coding ── */
export const codingAPI = {
  listProblems: (clerkToken, params = {}) =>
    api.get('/coding/problems', { params, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getProblem: (clerkToken, id) =>
    api.get(`/coding/problems/${id}`, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  runCode: (clerkToken, id, payload) =>
    api.post(`/coding/problems/${id}/run`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  submitSolution: (clerkToken, id, payload) =>
    api.post(`/coding/problems/${id}/submit`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  saveDraft: (clerkToken, id, payload) =>
    api.post(`/coding/problems/${id}/save-draft`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  getStatus: (clerkToken, id) =>
    api.get(`/coding/problems/${id}/status`, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  startAttempt: (clerkToken, id) =>
    api.post(`/coding/problems/${id}/attempts`, {}, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  logViolation: (clerkToken, attemptId, payload) =>
    api.post(`/coding/attempts/${attemptId}/violations`, payload, { headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Analytics ── */
export const analyticsAPI = {
  getOverview: (clerkToken) =>
    api.get('/analytics/overview', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getPerformance: (clerkToken) =>
    api.get('/analytics/performance', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getTopics: (clerkToken) =>
    api.get('/analytics/topics', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getCodingStats: (clerkToken) =>
    api.get('/analytics/coding-stats', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getSubmissionActivity: (clerkToken) =>
    api.get('/analytics/submission-activity', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getStreak: (clerkToken) =>
    api.get('/analytics/streak', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getProfileInsights: (clerkToken) =>
    api.get('/analytics/profile-insights', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } }),
  getRecentActivity: (clerkToken) =>
    api.get('/analytics/recent-activity', { params: tzParams, headers: { Authorization: `Bearer ${clerkToken}` } })
};

/* ── Users (public search) ── */
export const userAPI = {
  search: (query) => api.get('/users/search', { params: { q: query } }),
  getPublicProfile: (username) => api.get(`/users/public/${encodeURIComponent(username)}`),
  getPublicAnalytics: (username) =>
    api.get(`/users/public/${encodeURIComponent(username)}/analytics`, { params: tzParams })
};

/* ── Developer analytics (GitHub / LeetCode / Codeforces) ── */
export const devAnalyticsAPI = {
  get: (clerkToken) =>
    api.get('/dev-analytics', { headers: { Authorization: `Bearer ${clerkToken}` } }),
  connect: (clerkToken, platform, value) =>
    api.put(`/dev-analytics/connections/${platform}`, { value }, { headers: { Authorization: `Bearer ${clerkToken}` }, timeout: 90000 }),
  disconnect: (clerkToken, platform) =>
    api.delete(`/dev-analytics/connections/${platform}`, { headers: { Authorization: `Bearer ${clerkToken}` } }),
  sync: (clerkToken, { platform, onlyStale } = {}) =>
    api.post('/dev-analytics/sync', { ...(platform ? { platform } : {}), ...(onlyStale ? { onlyStale } : {}) },
      { headers: { Authorization: `Bearer ${clerkToken}` }, timeout: 120000 }),
  contests: (clerkToken, refresh = false) =>
    api.get('/dev-analytics/contests', { headers: { Authorization: `Bearer ${clerkToken}` }, params: refresh ? { refresh: true } : {} })
};
