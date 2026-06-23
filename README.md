# Personal RAG Chatbot API

A Retrieval-Augmented Generation (RAG) backend built with NestJS that powers a personal AI avatar. It answers questions about the profile owner's background, projects, skills, and experience by embedding user queries, performing vector similarity search over Supabase pgvector, and generating contextual responses through a multi-LLM fallback pipeline.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [How the RAG Pipeline Works](#how-the-rag-pipeline-works)
  - [1. Embedding & Ingestion](#1-embedding--ingestion)
  - [2. Retrieval](#2-retrieval)
  - [3. Response Generation](#3-response-generation)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)
- [Supabase Setup](#supabase-setup)
- [Installation](#installation)
- [API Reference](#api-reference)
- [Deployment](#deployment)
- [License](#license)

---

## Architecture Overview

```
┌─────────────┐     ┌──────────────────────────────────────────────────────────┐
│  Frontend   │────▶│                    NestJS Backend                        │
│  (Client)   │◀────│                                                          │
└─────────────┘     │  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  │
                    │  │  User       │  │  Retrieves   │  │  Embeddings      │  │
                    │  │  Module     │  │  Module       │  │  Module          │  │
                    │  │            │  │              │  │                  │  │
                    │  │ OTP Auth   │  │ Query → Embed│  │ Chunk → Embed   │  │
                    │  │ Cookies/JWT│  │ → Search     │  │ → Store         │  │
                    │  └─────┬──────┘  └──────┬───────┘  └────────┬────────┘  │
                    │        │                │                    │           │
                    │        ▼                ▼                    ▼           │
                    │  ┌──────────┐    ┌──────────────┐    ┌──────────────┐   │
                    │  │  Redis   │    │  Response     │    │  HuggingFace │   │
                    │  │          │    │  Module       │    │  Inference   │   │
                    │  │ Sessions │    │              │    │  API         │   │
                    │  │ OTPs     │    │ LLM Fallback │    │              │   │
                    │  │ Tokens   │    │ Chat Memory  │    │ bge-small-en │   │
                    │  └──────────┘    └──────┬───────┘    └──────────────┘   │
                    │                         │                               │
                    │                         ▼                               │
                    │              ┌───────────────────┐                      │
                    │              │  Supabase          │                      │
                    │              │  PostgreSQL        │                      │
                    │              │  + pgvector        │                      │
                    │              └───────────────────┘                      │
                    └──────────────────────────────────────────────────────────┘
```

---

## How the RAG Pipeline Works

### 1. Embedding & Ingestion

The ingestion step fetches structured profile data (JSON) from an external portfolio API and converts it into searchable vector embeddings stored in Supabase.

**Data flow:**

```
Portfolio API → Fetch JSON → Chunk by entity type → Generate embeddings → Store in pgvector
```

**Chunking strategy:**

Profile data is split into typed chunks based on entity category. Each chunk type uses a strategy suited to its content structure:

| Entity Type   | Strategy                                  | Overlap |
|---------------|-------------------------------------------|---------|
| Personal Info | Sentence-boundary splitting               | 20%     |
| Experiences   | Per-entry narrative, sentence splitting   | 20%     |
| Projects      | Per-project with features and tech stack  | 20%     |
| Education     | Per-institution entry                     | 20%     |
| Skills        | Grouped list, no overlap needed           | None    |
| Certificates  | Grouped list, no overlap needed           | None    |

The 20% overlap on narrative content ensures that context at chunk boundaries is preserved during retrieval. For structured list data (skills, certificates), clean grouping without overlap produces better search results.

Each chunk is stored as a row in the `documents` table with the following columns:

| Column      | Type          | Description                                     |
|-------------|---------------|-------------------------------------------------|
| `id`        | `UUID`        | Unique identifier (generated per chunk)         |
| `content`   | `TEXT`        | The plain-text chunk content                    |
| `embedding` | `VECTOR(384)` | 384-dimensional vector from `bge-small-en-v1.5` |
| `type`      | `VARCHAR(50)` | Entity type (personal, experience, project, etc)|
| `title`     | `VARCHAR(255)`| Human-readable chunk title                      |

**Embedding model:** `BAAI/bge-small-en-v1.5` via HuggingFace Inference API — produces 384-dimensional vectors optimized for semantic similarity tasks.

**Trigger:** `GET /embeddings/data` fetches fresh profile data, clears existing vectors, and re-embeds all chunks.

---

### 2. Retrieval

When a user sends a chat message, the retrieval step converts the query into the same vector space and finds the most relevant stored chunks.

**Data flow:**

```
User message → Generate query embedding → Supabase RPC (cosine similarity) → Top-K documents → Combined context
```

**How it works:**

1. The raw user message is embedded using the same `bge-small-en-v1.5` model.
2. The embedding is passed to a Supabase PostgreSQL function `match_documents` that computes cosine similarity between the query vector and all stored document vectors.
3. Documents exceeding the similarity threshold (default: `0.5`) are returned, ordered by similarity score, limited to the top 5 matches.
4. The `content` fields of matched documents are concatenated into a single `combinedContent` string, separated by double newlines.

**The `match_documents` function (pgvector):**

```sql
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(384),
    match_threshold FLOAT DEFAULT 0.75,
    match_count INT DEFAULT 5
)
RETURNS TABLE(id UUID, content TEXT, similarity FLOAT, type VARCHAR(50), title VARCHAR(255))
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.content,
           (1 - (d.embedding <=> query_embedding)) AS similarity,
           d.type, d.title
    FROM documents d
    WHERE (1 - (d.embedding <=> query_embedding)) > match_threshold
    ORDER BY (1 - (d.embedding <=> query_embedding)) DESC
    LIMIT match_count;
END;
$$;
```

The `<=>` operator is pgvector's cosine distance operator. The function converts it to similarity by computing `1 - distance`.

---

### 3. Response Generation

The retrieved context and the user's recent conversation history are assembled into a system prompt and sent to an LLM for response generation.

**Data flow:**

```
Combined context + Chat history (Redis) + User message → System prompt → LLM Agent → AI response → Save to Redis
```

**Multi-LLM fallback:**

The system uses `@inngest/agent-kit` to configure multiple LLM providers. If the primary provider fails, the next one in the fallback chain is used:

| Priority | Provider    | Model                        |
|----------|-------------|------------------------------|
| 1        | Groq        | `llama-3.3-70b-versatile`    |
| 2        | OpenRouter  | `openai/gpt-4o`              |
| 3        | Google      | `gemini-2.5-flash`           |
| 4        | OpenAI      | `gpt-4o-mini`                |
| 5        | Anthropic   | `claude-sonnet-4-20250514`   |

You only need API keys for the providers you want to use. The system skips any provider without a configured key.

**Session memory:**

Chat history is stored per-session in Redis using a `chat:{sessionId}` key. Each request loads the last 8 messages from Redis to maintain conversational context. Both the user message and the AI response are appended to the session after each exchange.

---

## Project Structure

```
src/
├── app.module.ts                 # Root module, imports all feature modules
├── app.utils.ts                  # Shared factory functions (Redis, Supabase clients)
├── main.ts                       # Application entry point
│
├── embeddings/                   # Embedding & ingestion pipeline
│   ├── embeddings.module.ts      # Module definition
│   ├── embeddings.controller.ts  # GET /embeddings/data endpoint
│   ├── embeddings.service.ts     # Embedding generation, storage, refresh logic
│   ├── embeddings.guard.ts       # Secret-key auth guard for admin endpoints
│   ├── embeddings.utils.ts       # Chunking strategies and text processing
│   ├── embeddings.types.ts       # TypeScript interfaces for profile data
│   └── embeddings.sql.ts         # SQL schema for documents table and pgvector
│
├── retrieves/                    # Query retrieval pipeline
│   ├── retrieves.module.ts       # Module definition
│   ├── retrieves.controller.ts   # POST /retrieves/chat endpoint
│   ├── retrieves.service.ts      # Query embedding, vector search, context assembly
│   └── retrieves.guard.ts        # JWT + Redis token validation guard
│
├── response/                     # LLM response generation
│   ├── response.module.ts        # Module definition (Redis + model providers)
│   ├── response.service.ts       # Prompt assembly, agent execution, chat storage
│   ├── response.utils.ts         # LLM model factory with fallback chain
│   └── response.type.ts          # TypeScript interfaces for AI responses
│
└── user/                         # Authentication (OTP + JWT)
    ├── user.module.ts            # Module definition
    ├── user.controller.ts        # POST /user/sendOtp, /user/verifyOtp, DELETE /user/history
    ├── user.service.ts           # OTP generation, verification, JWT issuance
    ├── user.dto.ts               # Request validation DTOs
    └── user.utils.ts             # Resend email client, OTP email template
```

---

## Tech Stack

| Component            | Technology                                                    |
|----------------------|---------------------------------------------------------------|
| Framework            | [NestJS](https://nestjs.com/) (TypeScript)                   |
| Database             | [Supabase](https://supabase.com/) (PostgreSQL + pgvector)    |
| Vector Search        | pgvector cosine similarity via Supabase RPC                  |
| Embeddings           | `BAAI/bge-small-en-v1.5` via HuggingFace Inference API      |
| LLM Orchestration    | [@inngest/agent-kit](https://www.inngest.com/agent-kit)      |
| Session Store        | [Redis](https://redis.io/) (ioredis)                         |
| Email (OTP)          | [Resend](https://resend.com/)                                |
| Deployment           | [Vercel](https://vercel.com/) (serverless)                   |

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000

# Supabase — Project Settings → API
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# Redis — connection string from your Redis provider
REDIS_URL=redis://default:password@host:port

# HuggingFace — huggingface.co → Settings → Access Tokens
HF_TOKEN=hf_your_token

# Email delivery — resend.com → API Keys
RESEND_API_KEY=re_your_key

# Security
JWT_SECRET=your_jwt_secret
SECRET_KEY=your_admin_secret_key

# Data source — the API that returns your profile JSON
SITE_BASE=https://your-site.com/api/metaData
# Secret for accessing the profile API
SECRET_KEY=your_profile_api_secret

# Frontend URL (for CORS, when enabled)
FRONTEND_URL=http://localhost:5173

# LLM Providers — add keys for any or all providers
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

---

## Supabase Setup

Run the following SQL in the Supabase SQL Editor to set up the required tables and functions:

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table for storing embeddings
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding VECTOR(384),
    type VARCHAR(50),
    title VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx
ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding VECTOR(384),
    match_threshold FLOAT DEFAULT 0.75,
    match_count INT DEFAULT 5
)
RETURNS TABLE(id UUID, content TEXT, similarity FLOAT, type VARCHAR(50), title VARCHAR(255))
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.content,
           (1 - (d.embedding <=> query_embedding)) AS similarity,
           d.type, d.title
    FROM documents d
    WHERE (1 - (d.embedding <=> query_embedding)) > match_threshold
    ORDER BY (1 - (d.embedding <=> query_embedding)) DESC
    LIMIT match_count;
END;
$$;

-- Verified users table (for OTP authentication)
CREATE TABLE IF NOT EXISTS verified_users (
    email TEXT PRIMARY KEY,
    verified_at TIMESTAMP WITH TIME ZONE,
    last_verified_at TIMESTAMP WITH TIME ZONE
);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Important:** If Row-Level Security (RLS) is enabled on the `documents` table, either disable it for this table or create a policy that allows the service role to read, insert, and delete rows. Using the Supabase service role key (instead of the anon key) bypasses RLS entirely.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/sudipsharma826/ragChatBot-Personal.git
cd ragChatBot-Personal

# Install dependencies
npm install

# Development (watch mode)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server starts on the port defined in `.env` (default: `3000`).

---

## API Reference

### Authentication

#### Send OTP

```
POST /user/sendOtp
```

| Field   | Type   | Required | Description              |
|---------|--------|----------|--------------------------|
| `email` | string | Yes      | Email address for OTP    |

**Response:**
```json
{
  "status": "200",
  "message": "OTP has been sent to user@example.com. Please verify within 5 minutes."
}
```

#### Verify OTP

```
POST /user/verifyOtp
```

| Field   | Type   | Required | Description              |
|---------|--------|----------|--------------------------|
| `email` | string | Yes      | Email used for OTP       |
| `otp`   | string | Yes      | 6-digit OTP from email   |

**Response:**
```json
{
  "status": "200",
  "message": "OTP verified successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "sessionId": "a1b2c3d4-e5f6-7890-1234-56789abcdef0"
}
```

**Note:** The backend automatically sets the `token` as an HTTP-only cookie (`token=...`) valid for 24 hours. The frontend should include credentials (`credentials: 'include'`) in subsequent requests, meaning you don't need to manually send the Authorization header anymore (though it's still supported as a fallback).

The frontend should store the returned `sessionId` (e.g., in `localStorage` or memory) and pass it to the chat endpoint to maintain conversation history.

---

### Chat

#### Send Message

```
POST /retrieves/chat
```
*(Requires HTTP-only `token` cookie or `Authorization: Bearer <JWT_TOKEN>`)*

| Field       | Type   | Required | Description                              |
|-------------|--------|----------|------------------------------------------|
| `message`   | string | Yes      | User's question or message               |
| `sessionId` | string | No       | Session identifier for conversation memory |

**Response:**
```json
{
  "message": "What technologies do you use?",
  "response": {
    "aiMessage": "I mainly work with TypeScript, NestJS, and Next.js for my projects.",
    "combinedContent": "..."
  }
}
```

The `sessionId` groups conversation history in Redis. The frontend should use the `sessionId` returned from the `/user/verifyOtp` response to maintain the context of the user's chat. If a `sessionId` is not provided, the server will treat each message as an isolated query.

---

### Embeddings Management

#### Refresh Embeddings

```
GET /embeddings/data
```

Fetches the latest profile data, re-chunks it, and updates the vector store.

**Response:**
```json
{
  "message": "Embeddings refreshed successfully",
  "totalChunks": 24,
  "provider": "huggingface:bge-small-en-v1.5"
}
```

---

### History Management

#### Delete Chat History

```
DELETE /user/history
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "status": "200",
  "message": "Chat history deleted"
}
```

---

## Deployment

### Vercel

The project includes a `vercel.json` for serverless deployment:

```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.ts" }
  ]
}
```

Set all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Other Platforms

For traditional server deployments (VPS, Docker, etc.):

```bash
npm run build
NODE_ENV=production node dist/main.js
```

---

## License

This project is open-sourced under the [MIT License](LICENSE).
