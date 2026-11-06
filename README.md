<div align="center">

# DevPrep

### Comprehensive Tech Interview & Coding Platform

A modern, full-stack platform designed to help developers prepare for technical interviews. Features include a LeetCode-style coding environment with isolated code execution, AI-powered mock interviews (typed or by voice), resume analysis, a dashboard and profile pages with progress analytics, and Dev Analytics for your GitHub, LeetCode and Codeforces accounts.

**Developed by Vatsal Ghaghda**

[![Frontend](https://img.shields.io/badge/Frontend-React%20%2B%20Tailwind-blue?style=flat-square&logo=react)](https://react.dev)
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green?style=flat-square&logo=nodedotjs)](https://expressjs.com)
[![Database](https://img.shields.io/badge/Database-MongoDB-47A248?style=flat-square&logo=mongodb)](https://mongodb.com)
[![Execution](https://img.shields.io/badge/Code%20Execution-Docker-2496ED?style=flat-square&logo=docker)](https://docker.com)
[![Auth](https://img.shields.io/badge/Auth-Clerk-6C47FF?style=flat-square&logo=clerk)](https://clerk.dev)

</div>

---

## Table of Contents

1. [Features](#features)
2. [Project Structure](#project-structure)
3. [Tech Stack](#tech-stack)
4. [Local Development Setup](#local-development-setup)
5. [Environment Variables](#environment-variables)
6. [Uploading to GitHub](#uploading-to-github)
7. [Deploying the Frontend](#deploying-the-frontend)
8. [Deploying the Backend](#deploying-the-backend)
9. [Post-Deployment Configuration](#post-deployment-configuration)
10. [API Reference (Overview)](#api-reference-overview)

---

## Features

### 💻 Coding Practice Environment
- **LeetCode-Style IDE**: Full-fledged code editor to solve algorithmic challenges.
- **Secure Code Execution**: Each run starts a throwaway Docker container with no network, capped memory/CPU/processes, a read-only filesystem and an unprivileged user.
- **Multiple Languages**: C++, C, Python, Java and JavaScript.
- **Run, Custom Input and Submit**: Run against the sample tests or your own input; Submit judges every test, including hidden ones, and saves the submission.
- **Proctored Attempts**: Runs and submissions belong to an attempt with a violation limit (tab switches, leaving fullscreen, etc.).

### 🤖 AI Mock Interviews
- **AI-Powered Sessions**: Conduct realistic technical, HR, mixed and resume-based mock interviews powered by Groq LLMs.
- **Voice Mode**: The interviewer speaks its questions, and you answer out loud. Answers are recorded and transcribed with Groq Whisper.
- **Device Check First**: Proctored interviews start with a camera, microphone and speaker check. The first question and the timer only start when you press Start.
- **Real-time Feedback**: Get instant feedback on your answers, communication skills, and technical accuracy.
- **Session Tracking**: Review past interview sessions and track your improvement over time.

### 📄 Resume Tools
- **Resume Analysis**: Upload your PDF resume for AI-driven analysis to see how well it matches your target role.
- **Improvement Suggestions**: Receive actionable insights on skills to add and formatting improvements.

### 📊 Dashboard & Profiles
- **Dashboard**: Greeting with your streak and this week's activity, key stats, practice shortcuts with live numbers, next-step suggestions from your own data, a yearly heatmap and recent activity.
- **Detailed Analytics**: Problems solved by difficulty, acceptance rate, streaks, languages, solved categories, interview scores and topics, and achievements.
- **Yearly Heatmap**: One continuous LeetCode-style activity strip for the past 12 months (or any year), split into months, with a per-day breakdown on hover.
- **Public Portfolio**: Share your public profile (`/profile/:username`) to showcase your coding stats, streak, recently solved problems and skills. Profiles are private unless you make them public, and linked coding accounts are never shown publicly.

### 📈 Dev Analytics (`/analytics`)
- **Connected Accounts**: Link GitHub, LeetCode and Codeforces usernames and sync their stats.
- **Insights**: Contribution and submission heatmaps per platform or combined, repositories and languages, recent submissions, ratings and contest history.
- **Contests**: Upcoming contests (Codeforces, LeetCode, and other judges through CLIST).

### 🔒 Authentication & Security
- **Clerk Authentication**: Secure, seamless social and email login powered by Clerk.
- **Protected Routes**: Secure API endpoints ensuring user data privacy.

---

## Project Structure

```text
DevPrep/
├── frontend/                       # React SPA
│   ├── src/
│   │   ├── components/             # Reusable UI (layout, devAnalytics/, profile/, assessment/, interview/…)
│   │   ├── config/                 # Shared navigation config
│   │   ├── hooks/                  # Custom hooks (useReadyAuth, useSecureAssessment, useSpeechToText…)
│   │   ├── pages/                  # Route pages (Dashboard, CodingChallenge, Profile, DevAnalytics…)
│   │   ├── services/               # API service integration (api.js)
│   │   └── App.js                  # Main app routing
│   └── package.json
│
├── backend/                        # Node.js + Express API
│   ├── executor/                   # Sandboxed code execution engine
│   │   ├── runCode.js              # Compiles once, runs every test input (inside the container)
│   │   └── Dockerfile              # Dockerfile for the isolated execution environment
│   ├── src/
│   │   ├── controllers/            # Route controllers (userController, etc.)
│   │   ├── middleware/             # Custom Express middleware (auth, rate limiting)
│   │   ├── models/                 # Mongoose schemas (User, MockInterviewSession, etc.)
│   │   ├── routes/                 # API route definitions
│   │   ├── utils/                  # Helpers (runInDocker, judgeService, aiService, speechService, devAnalytics/…)
│   │   └── server.js               # Express server entry point
│   ├── scripts/                    # Seed scripts (destructive ones need --yes)
│   ├── test/                       # node --test unit tests
│   └── package.json
│
└── README.md                       # Project documentation
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Tailwind CSS, Framer Motion, Monaco Editor |
| **Icons & Charts** | Lucide React, Recharts |
| **Authentication** | Clerk Auth |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB + Mongoose |
| **Code Execution** | Docker (Isolated Sandbox) |
| **AI Integration** | Groq LLM API, Groq Whisper (speech-to-text) |
| **File Parsing** | `pdf-parse`, Multer (in-memory, PDFs are not stored) |

---

## Local Development Setup

### Prerequisites

Make sure you have the following installed:
- **Node.js** 18+ — https://nodejs.org
- **MongoDB** — Local instance or MongoDB Atlas URI
- **Docker** — Required for the code execution sandbox in production. Optional on a development machine (see Step 4)

### Step 1 — Clone the repository

```bash
git clone https://github.com/VatsalGhaghda/DevPrep.git
cd DevPrep
```

### Step 2 — Set up the Frontend

```bash
cd frontend
npm install
npm start
```
Frontend runs at: **http://localhost:3000**

Create `frontend/.env`:
```env
REACT_APP_API_BASE=http://localhost:5000/api
REACT_APP_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

### Step 3 — Set up the Backend

Open a new terminal:

```bash
cd backend
npm install
```

Create a `.env` file inside `backend/`:
Copy `backend/.env.example` to `backend/.env` and fill in the values (see [Environment Variables](#environment-variables)).

Then start the backend (restarts on file changes):
```bash
npm run dev
```
Backend API runs at: **http://localhost:5000**

Run the backend tests with `npm test`.

### Step 4 — Build the code execution sandbox (Important)

Coding practice runs user code inside the `devprep-executor` Docker image. Build it once (and again whenever `backend/executor/` changes):

```bash
cd backend
npm run build:executor      # = docker build -t devprep-executor executor
```

Docker Desktop (or the Docker daemon) must be running while the backend runs.

**No Docker on your dev machine?** With `NODE_ENV=development` and `EXECUTION_MODE` left unset, the backend uses Docker when it is available and otherwise runs code directly on your computer, logging a warning. That is fine for your own testing but has no sandbox. To choose explicitly:
- `EXECUTION_MODE=docker` always uses the sandbox; without Docker or the image, Run/Submit return **503** with a message saying so.
- `EXECUTION_MODE=local` always runs code on this machine without a sandbox.

Production (`NODE_ENV=production`) never falls back, and refuses `local` unless `ALLOW_UNSAFE_LOCAL_EXECUTION=true`. On Windows, Device Guard can block compiled languages (C, C++) when code runs locally.

### Quick start (after the first setup)

Open two terminals in the project folder:

```bash
cd backend && npm run dev     # API on http://localhost:5000
cd frontend && npm start      # App on http://localhost:3000
```

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description | Example |
|---|---|---|
| `REACT_APP_API_BASE` | Backend API base URL | `http://localhost:5000/api` |
| `REACT_APP_CLERK_PUBLISHABLE_KEY` | Clerk Auth Publishable Key | `pk_test_...` |

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` (hides 5xx details, enables proxy trust) |
| `PORT` | Port for the Express server (default: `5000`) |
| `MONGO_URI` | MongoDB connection string |
| `FRONTEND_URL` | Allowed CORS origin, e.g. `http://localhost:3000` |
| `EXTRA_ORIGINS` | Optional comma-separated extra CORS origins |
| `TRUST_PROXY` | Proxy hops in front of the API (default `1` in production, `false` otherwise) |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_WEBHOOK_SECRET` | Signing secret of the Clerk webhook (`/api/webhooks/clerk`) |
| `GROQ_API_KEY` | Groq API key (questions, interviews, resume parsing) |
| `GROQ_MODEL` | Groq model, default `llama-3.3-70b-versatile` |
| `GROQ_STT_MODEL` | Groq speech-to-text model for voice answers, default `whisper-large-v3-turbo` |
| `GITHUB_TOKEN` | Optional GitHub token; needed for the GitHub contribution calendar in Dev Analytics |
| `CLIST_USERNAME` / `CLIST_API_KEY` | Optional; contests from other judges in Dev Analytics |
| `EXECUTION_MODE` | Unset (Docker, with local fallback in development only), `docker` (sandbox only) or `local` (unsandboxed, dev only) |
| `ALLOW_UNSAFE_LOCAL_EXECUTION` | Must be `true` to use `local` mode in production (not recommended) |
| `EXECUTOR_IMAGE` | Sandbox image name (default `devprep-executor`) |
| `EXECUTOR_MEMORY` / `EXECUTOR_CPUS` | Per-run container limits (default `512m` / `1`) |
| `RUN_TIMEOUT_MS` / `COMPILE_TIMEOUT_MS` | Per-test run limit (default `5000`) and compile limit (default `20000`) |
| `MAX_CONCURRENT_EXECUTIONS` / `MAX_EXECUTION_QUEUE` | Simultaneous runs (default `4`) and queue length (default `20`) |
| `CODE_EXECUTION_RATE_LIMIT` | Run/submit requests per user per 5 minutes (default `30`) |
| `ASSESSMENT_*` | Proctoring policy, see `backend/.env.example` |

---

## Uploading to GitHub

### Step 1 — Create a new GitHub repository

1. Go to https://github.com/new
2. Set the repository name to `DevPrep`.
3. Click **Create repository** (Do NOT initialize with a README).

### Step 2 — Initialize Git and push

Open a terminal in the `DevPrep` root folder and run:

```bash
git init
git add .
git commit -m "Initial commit — DevPrep"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/DevPrep.git
git push -u origin main
```

---

## Deploying the Frontend

Vercel is recommended for deploying the React frontend.

1. Push your code to GitHub.
2. Go to **Vercel** and import your `DevPrep` repository.
3. Set the **Root Directory** to `frontend`.
4. Add your Environment Variables (`REACT_APP_API_BASE`, `REACT_APP_CLERK_PUBLISHABLE_KEY`).
5. Click **Deploy**.

---

## Deploying the Backend

Code execution needs a Docker daemon on the same machine as the backend. Managed Node hosts such as Render web services and Railway do **not** provide one, so on those platforms run/submit will return 503.

Options:
1. **A VM with Docker** (any small VPS, e.g. a cloud free-tier instance): install Node and Docker, run `npm ci && npm run build:executor`, and start the API with `npm start` behind a reverse proxy. Everything else works as described here.
2. **A managed host for the API plus a separate execution service** that has Docker, if you want to keep using Render/Railway for the API.

Whatever you choose, set the environment variables above (`MONGO_URI`, `CLERK_SECRET_KEY`, `FRONTEND_URL`, …) and `NODE_ENV=production`.

---

## Post-Deployment Configuration

1. **Update Frontend API URL**: Once the backend is deployed, update `REACT_APP_API_BASE` in your frontend deployment settings to point to the live backend URL.
2. **Update Clerk Settings**: Ensure your live frontend URL is added to your Clerk dashboard's allowed redirect URIs.
3. **CORS Settings**: Set `FRONTEND_URL` on the backend to your deployed frontend URL (add more with `EXTRA_ORIGINS`).
4. **Clerk webhook**: In the Clerk dashboard add a webhook to `https://<backend>/api/webhooks/clerk` for `user.created`, `user.updated` and `user.deleted`, and put its signing secret in `CLERK_WEBHOOK_SECRET`.

---

## API Reference (Overview)

All endpoints except the public ones need `Authorization: Bearer <Clerk session token>`.

### Users & Profiles
- `POST /api/clerk/sync/me` — Create/refresh the signed-in user from Clerk.
- `GET|PUT /api/clerk/profile` — Read/update own profile (name, username, skills, bio, avatar, `isProfilePublic`).
- `GET /api/users/search?q=` — Public user search (prefix match, public profiles only).
- `GET /api/users/public/:username` and `/analytics?tz=` — Public profile and stats.
- `GET /api/analytics/*?tz=` — Own analytics (`coding-stats`, `submission-activity`, `streak`, `overview`, `performance`, `topics`, `profile-insights`, `recent-activity`). `tz` is an IANA time zone for day boundaries.

### Coding Practice
- `GET /api/coding/problems`, `GET /api/coding/problems/:id`
- `POST /api/coding/problems/:id/attempts` — Start/resume a proctored attempt.
- `POST /api/coding/problems/:id/run` — Run against sample tests or custom input.
- `POST /api/coding/problems/:id/submit` — Judge against all tests and save the submission.
- `POST /api/execute/run` — Run code without a problem (playground).

### AI Questions (MCQ quizzes)
- `POST /api/questions/generate` — Generate a timed quiz attempt.
- `POST /api/questions/attempts/:id/start|submit|abandon|retake`

### AI Mock Interviews
- `POST /api/mock-interviews/start` — Create a session (`technical`, `hr`, `mixed`, `resume-based`) in the `ready` state.
- `POST /api/mock-interviews/:id/begin` — Start it after the device check: generates the first question and starts the clock.
- `POST /api/mock-interviews/:id/message` — Send an answer, get the interviewer's reply.
- `POST /api/mock-interviews/:id/transcribe` — Transcribe a recorded voice answer.
- `POST /api/mock-interviews/:id/end` — End and evaluate.
- `POST /api/mock-interviews/:id/evaluate` — Retry a failed evaluation.

### Dev Analytics
- `GET /api/dev-analytics` — Linked accounts, synced stats and activity.
- `PUT|DELETE /api/dev-analytics/connections/:platform` — Link or unlink `github`, `leetcode` or `codeforces`.
- `POST /api/dev-analytics/sync` — Refresh the linked accounts.
- `GET /api/dev-analytics/contests` — Upcoming contests.

### Resume
- `POST /api/resume/upload` (PDF, ≤ 5 MB), `GET /api/resume`, `DELETE /api/resume/:id`

---

<div align="center">

Built with ❤️ by **Vatsal Ghaghda and Harsh Jethava**

[GitHub](https://github.com/VatsalGhaghda) · [LinkedIn](https://linkedin.com/in/vatsal-ghaghda)

</div>