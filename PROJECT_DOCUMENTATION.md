# AI-Powered Interview Preparation Platform

## 🏗️ System Architecture

```
Frontend (React – Vercel)
        ↓
Backend API (Node.js – Render)
        ↓
AI Layer (Groq LLM API)
        ↓
Database (MongoDB Atlas)
```

---

## 📋 Table of Contents

1. [User Authentication & Profile Management](#1-user-authentication--profile-management)
2. [Role-Based Interview Question Generator (AI)](#2-role-based-interview-question-generator-ai)
3. [AI-Based Mock Interview (Text Chat)](#3-ai-based-mock-interview-text-chat)
4. [AI Answer Evaluation & Scoring](#4-ai-answer-evaluation--scoring)
5. [Resume Upload & Resume-Based Interview](#5-resume-upload--resume-based-interview)
6. [Coding Round Practice Module](#6-coding-round-practice-module)
7. [Interview Analytics Dashboard](#7-interview-analytics-dashboard)
8. [HR & Behavioral Interview Module](#8-hr--behavioral-interview-module)
9. [Admin / Faculty Panel (Optional)](#9-admin--faculty-panel-optional)
10. [Final Tech Stack Summary](#-final-tech-stack-summary)

---

## 1️⃣ User Authentication & Profile Management

### 🎯 Feature Description

- User registration & login
- Profile stores:
  - Skills
  - Target role
  - Experience level
  - Interview history

### ⚙️ How It Works

```
Clerk Authentication → JWT-like session token
Token → Protected APIs → Dashboard
```

### 🛠️ Tech Stack

- **Frontend:** React + Tailwind CSS
- **Backend:** Node.js + Express.js
- **Auth:** Clerk
- **DB:** MongoDB Atlas

### 🧠 Why This Stack

- Industry-standard
- Secure
- Fully free
- Easy to justify in viva

---

## 2️⃣ Role-Based Interview Question Generator (AI)

### 🎯 Feature Description

Generates MCQ interview questions based on:
- Job role
- Difficulty level
- Topic(s)

Includes:
- Full-window interactive quiz UI
- Save Questions (persist to MongoDB)
- PDF download of the generated question set
- No-repeat across future generations (excludes previously saved questions)

### ⚙️ Flow

```
Role + Difficulty + Topic(s) + Count → Prompt → Groq → MCQ JSON → Quiz UI → Save + PDF
```

### 🧠 AI Model Used

- **Platform:** Groq LLM API
- **Model:** llama-3.3-70b-versatile

### 🛠️ Tech Stack

- **Backend:** Node.js
- **AI Provider:** Groq (OpenAI-compatible Chat Completions API)

### ✅ Why Groq

- Fast responses and consistent JSON generation with proper prompting
- Simple OpenAI-compatible API surface

---

## 3️⃣ AI-Based Mock Interview (Text Chat)

### 🎯 Feature Description

- Simulated interviewer
- One question at a time
- Context-aware follow-ups

### ⚙️ Flow

```
Previous Q&A → Context Prompt → Next Question
```

### 🧠 AI Model Used

- **Platform:** Groq LLM API
- **Model:** llama-3.3-70b-versatile

### 🛠️ Tech Stack

- **Frontend:** React Chat UI
- **State:** Context API
- **Backend:** Express API

### 🧾 Resume Line

*Implemented conversational AI-driven mock interviews using hosted open-source LLMs.*

---

## 4️⃣ AI Answer Evaluation & Scoring

### 🎯 Feature Description

- Scores answers (0–10)
- Identifies strengths & weaknesses
- Suggests improvements

### ⚙️ Flow

```
Answer → Evaluation Prompt → Score + Feedback
```

### 🧠 AI Model Used

- **Model:** Flan-T5-XL
- Best for structured output & scoring

### 🛠️ Tech Stack

- Node.js
- MongoDB (store scores)
- Hugging Face API

### 📊 Sample Output

- **Score:** 7.5/10
- **Strength:** Clear explanation
- **Weakness:** Lacks example
- **Suggestion:** Mention real-world use

---

## 5️⃣ Resume Upload & Resume-Based Interview

### 🎯 Feature Description

- Upload resume (PDF)
- Extract skills & projects
- Generate personalized questions

### ⚙️ Flow

```
PDF → Text Extraction → AI → Questions
```

### 🧠 AI Model Used

- **Model:** Mistral-7B-Instruct

### 🛠️ Tech Stack

- **PDF Parsing:** pdf-parse (open-source)
- **Backend:** Node.js
- **AI:** Hugging Face API

### 💡 Why This Feature is 🔥

*This mimics real company interview rounds.*

---

## 6️⃣ Coding Round Practice Module

### 🎯 Feature Description

- Browser-based coding editor
- Timed coding questions
- Auto test-case validation

### ⚙️ Flow

```
Code → Run Tests → Pass / Fail
```

### 🛠️ Tech Stack

- **Editor:** Monaco Editor
- **Execution:** Node.js sandbox
- **DB:** MongoDB (questions + tests)

### ❌ Why No Paid Judge

- Keeps system free
- Easier to deploy
- Still impressive

---

## 7️⃣ Interview Analytics Dashboard

### 🎯 Feature Description

- Performance tracking
- Topic-wise analysis
- Improvement graphs

### 📊 Metrics

- Average score
- Weak topics
- Interview count

### 🛠️ Tech Stack

- **Charts:** Chart.js
- **Backend:** MongoDB aggregation

### 🧠 Viva-Ready Explanation

*Analytics are generated using aggregated interview performance data.*

---

## 8️⃣ HR & Behavioral Interview Module

### 🎯 Feature Description

- STAR-based HR questions
- Evaluates clarity & structure
- Improves answer framing

### ⚙️ Flow

```
Answer → STAR Prompt → Feedback
```

### 🧠 AI Model Used

- **Model:** Zephyr-7B

### 🛠️ Tech Stack

- Node.js
- Hugging Face API

### ✅ Why This Works

- No paid emotion APIs
- Fully text-based
- Realistic HR feedback

---

## 9️⃣ Admin / Faculty Panel (Optional)

### 🎯 Feature Description

- View platform usage
- Student performance overview
- Topic difficulty analysis

### 🛠️ Tech Stack

- React Admin UI
- Role-based JWT access
- Chart.js

### 🎓 Helps faculty evaluation & grading

---

## 🏆 FINAL TECH STACK SUMMARY (Locked)

- **Frontend:** React + Tailwind CSS (Vercel)
- **Backend:** Node.js + Express (Render)
- **Database:** MongoDB Atlas (Free)
- **AI Platform:** Groq LLM API
- **AI Model:** llama-3.3-70b-versatile
- **Editor:** Monaco Editor
- **Charts:** Chart.js
- **Auth:** Clerk

---

## 🧾 Final Resume One-Liner (Use This 🔥)

> **Developed and deployed a cloud-hosted AI-powered interview preparation platform using Groq LLM API, enabling MCQ quiz generation with save + PDF export, and realistic mock interview simulations.**

---

## 📝 Notes

- All services are free-tier compatible
- Fully deployable without paid subscriptions
- Industry-standard technologies for easy justification
- Scalable architecture for future enhancements

