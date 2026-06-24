# Personal RAG Chatbot API

A production-ready **Personal RAG (Retrieval-Augmented Generation) backend** built with **NestJS**, **Supabase pgvector**, **Redis**, and a **multi-LLM fallback pipeline**.

This project powers a personal AI avatar that can answer questions about the profile owner’s **background, projects, skills, education, and experience** by retrieving relevant knowledge-base content and combining it with recent conversation history before generating a response.

---

## Table of Contents

* [Overview](#overview)
* [Core Features](#core-features)
* [Architecture](#architecture)
* [How the RAG Pipeline Works](#how-the-rag-pipeline-works)

  * [1. Ingestion & Embedding](#1-ingestion--embedding)
  * [2. Retrieval](#2-retrieval)
  * [3. Response Generation](#3-response-generation)
* [Project Structure](#project-structure)
* [Tech Stack](#tech-stack)
* [Environment Variables](#environment-variables)
* [Supabase Setup](#supabase-setup)
* [Installation](#installation)
* [API Reference](#api-reference)
* [Deployment](#deployment)
* [Important Notes](#important-notes)
* [License](#license)

---

# Overview

This project is a **Personal Retrieval-Augmented Generation (RAG) API**.

Instead of generating answers from the language model alone, the system first retrieves the most relevant chunks from a **personal knowledge base** (portfolio/profile data stored as embeddings in Supabase), then combines that retrieved context with **recent conversation history** and the **current user message** to generate a grounded response.

In short, each answer is generated using **four inputs**:

1. **The current user message**
2. **The last 8 chat messages stored in Redis for that session**
3. **The retrieved knowledge-base context from Supabase pgvector**
4. **The system/persona prompt used to shape the assistant’s behavior**

This design helps the chatbot stay:

* **Grounded** in the profile owner’s real data
* **Context-aware** across multiple chat turns
* **Consistent** in persona, tone, and style

---

# Core Features

* **Personal RAG pipeline** for portfolio/profile Q&A
* **Semantic retrieval** using **Supabase + pgvector**
* **Embeddings generated with** `BAAI/bge-small-en-v1.5`
* **Session-based memory** using **Redis**
* **Last 8 chat messages loaded per request** for conversational continuity
* **OTP-based authentication** with **JWT + HTTP-only cookies**
* **Multi-LLM fallback chain** using `@inngest/agent-kit`
* **Embedding refresh endpoint** for re-ingesting profile data
* **Structured chunking strategy** for personal info, projects, education, skills, and experience

---

# Architecture

```text
┌─────────────┐
│  Frontend   │
│  (Client)   │
└──────┬──────┘
       │ HTTP Requests
       ▼
┌──────────────────────────────────────────────────────────────┐
│                        NestJS Backend                       │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ User Module  │   │ Retrieves    │   │ Response Module │  │
│  │ OTP + JWT    │   │ Module       │   │ Prompt + LLM    │  │
│  │ Cookies/Auth │   │ Vector Search│   │ Fallback + Save │  │
│  └──────┬───────┘   └──────┬───────┘   └────────┬────────┘  │
│         │                  │                    │           │
│         ▼                  ▼                    ▼           │
│    ┌────────┐      ┌───────────────┐     ┌──────────────┐  │
│    │ Redis  │      │ Supabase      │     │ LLM Providers│  │
│    │ OTPs   │      │ PostgreSQL    │     │ Groq/OpenAI/ │  │
│    │ Chat   │      │ + pgvector    │     │ Gemini/etc.  │  │
│    │Memory  │      │ documents     │     │              │  │
│    └────────┘      └───────────────┘     └──────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Embeddings Module                                      │  │
│  │ Fetch profile JSON → chunk → embed → store in DB       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

# How the RAG Pipeline Works

## 1. Ingestion & Embedding

The ingestion layer fetches structured profile data from an external API, converts it into text chunks, generates vector embeddings, and stores them in Supabase.

### Data Flow

```text
Portfolio API / Profile JSON
        ↓
Normalize data
        ↓
Chunk by entity type
        ↓
Generate embeddings
        ↓
Store chunks in Supabase documents table
```

### Chunking Strategy

Different data types are chunked differently to improve retrieval quality.

| Entity Type   | Strategy                                          | Overlap |
| ------------- | ------------------------------------------------- | ------: |
| Personal Info | Sentence-aware chunking                           |     20% |
| Experience    | Per-entry narrative chunking                      |     20% |
| Projects      | Per-project chunking with features and tech stack |     20% |
| Education     | Per-institution chunking                          |     20% |
| Skills        | Grouped list chunks                               |    None |
| Certificates  | Grouped list chunks                               |    None |

### Documents Table Shape

Each chunk is stored in the `documents` table with the following structure:

| Column       | Type           | Description                                          |
| ------------ | -------------- | ---------------------------------------------------- |
| `id`         | `UUID`         | Unique chunk identifier                              |
| `content`    | `TEXT`         | Plain-text content of the chunk                      |
| `embedding`  | `VECTOR(384)`  | Embedding vector generated from `bge-small-en-v1.5`  |
| `type`       | `VARCHAR(50)`  | Chunk category such as `project`, `experience`, etc. |
| `title`      | `VARCHAR(255)` | Human-readable title for the chunk                   |
| `metadata`   | `JSONB`        | Optional extra structured metadata                   |
| `created_at` | `TIMESTAMPTZ`  | Row creation timestamp                               |
| `updated_at` | `TIMESTAMPTZ`  | Last update timestamp                                |

### Embedding Model

* **Model:** `BAAI/bge-small-en-v1.5`
* **Provider:** HuggingFace Inference API
* **Vector dimension:** `384`

### Refresh Process

Calling the embeddings refresh endpoint will:

1. Fetch the latest profile data
2. Re-chunk the content
3. Generate fresh embeddings
4. Update the `documents` table in Supabase

---

## 2. Retrieval

When a user sends a chat message, the backend embeds that message into the same vector space and performs a similarity search against the stored profile chunks.

### Data Flow

```text
User message
   ↓
Generate query embedding
   ↓
Call Supabase RPC: match_documents(...)
   ↓
Get top matching chunks
   ↓
Combine retrieved content into a context block
```

### Retrieval Process

1. The incoming **user message** is embedded using the same embedding model.
2. That vector is passed to a PostgreSQL RPC function called `match_documents`.
3. The function compares the query vector against stored document vectors using cosine similarity.
4. The backend keeps the top relevant matches above the similarity threshold.
5. The retrieved chunk contents are merged into a single `combinedContent` block, which is passed to the response layer.

### Example `match_documents` Function

```sql
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  similarity FLOAT,
  type VARCHAR(50),
  title VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    (1 - (d.embedding <=> query_embedding)) AS similarity,
    d.type,
    d.title
  FROM documents d
  WHERE (1 - (d.embedding <=> query_embedding)) > match_threshold
  ORDER BY (1 - (d.embedding <=> query_embedding)) DESC
  LIMIT match_count;
END;
$$;
```

> `d.embedding <=> query_embedding` is pgvector’s cosine distance operator.
> Similarity is calculated as `1 - distance`.

---

## 3. Response Generation

This is the part where the retrieved knowledge and recent chat history are turned into the final conversational response.

## What is used to generate the final answer?

For every `/retrieves/chat` request, the backend builds the final prompt from:

* **the current user message**
* **the last 8 chat messages loaded from Redis**
* **the retrieved knowledge-base context from Supabase**
* **the system/persona prompt**

So the response is **not generated from retrieval alone**. It is generated from the combination of **message + history + retrieved context + prompt**.

### Response Generation Flow

```text
Current user message
        + last 8 Redis messages
        + retrieved context from vector search
        + system/persona prompt
                         ↓
                 Build final prompt
                         ↓
               Send to LLM fallback chain
                         ↓
                  Receive AI response
                         ↓
 Save user message + AI reply back into Redis session history
```

### Redis Session Memory

Chat history is stored in Redis using a session-based key, for example:

```text
chat:{sessionId}
```

For every new chat request, the backend:

1. Loads the **last 8 messages** from Redis for that `sessionId`
2. Combines those messages with:

   * the **current user message**
   * the **retrieved RAG context**
   * the **system/persona prompt**
3. Sends the final assembled prompt to the LLM
4. Saves **both**:

   * the new **user message**
   * the new **AI response**

back into Redis after the response is generated.

This gives the assistant **short-term conversation memory** while keeping the long-term knowledge base separate inside Supabase.

### Multi-LLM Fallback Pipeline

The project uses `@inngest/agent-kit` to define a fallback chain of providers.
If the first model/provider fails, the next configured provider is used automatically.

| Priority | Provider   | Example Model              |
| -------: | ---------- | -------------------------- |
|        1 | Groq       | `llama-3.3-70b-versatile`  |
|        2 | OpenRouter | `openai/gpt-4o`            |
|        3 | Google     | `gemini-2.5-flash`         |
|        4 | OpenAI     | `gpt-4o-mini`              |
|        5 | Anthropic  | `claude-sonnet-4-20250514` |

Only providers with valid API keys configured in `.env` are used.

---

# Project Structure

```text
src/
├── app.module.ts
├── app.utils.ts
├── main.ts
│
├── embeddings/
│   ├── embeddings.module.ts
│   ├── embeddings.controller.ts
│   ├── embeddings.service.ts
│   ├── embeddings.guard.ts
│   ├── embeddings.utils.ts
│   ├── embeddings.types.ts
│   └── embeddings.sql.ts
│
├── retrieves/
│   ├── retrieves.module.ts
│   ├── retrieves.controller.ts
│   ├── retrieves.service.ts
│   └── retrieves.guard.ts
│
├── response/
│   ├── response.module.ts
│   ├── response.service.ts
│   ├── response.utils.ts
│   └── response.type.ts
│
└── user/
    ├── user.module.ts
    ├── user.controller.ts
    ├── user.service.ts
    ├── user.dto.ts
    └── user.utils.ts
```

## Module Responsibilities

### `embeddings/`

Responsible for:

* fetching profile/portfolio JSON
* chunking the content
* generating embeddings
* storing vectors in Supabase

### `retrieves/`

Responsible for:

* accepting chat requests
* embedding the current user message
* performing vector search in Supabase
* returning the retrieved context to the response layer

### `response/`

Responsible for:

* loading the **last 8 chat messages from Redis**
* combining **user message + Redis history + retrieved context + system prompt**
* sending the final prompt to the LLM fallback chain
* saving the latest user and AI messages back into Redis

### `user/`

Responsible for:

* sending OTP emails
* verifying OTPs
* issuing JWTs
* clearing chat history when requested

---

# Tech Stack

| Layer                  | Technology                                             |
| ---------------------- | ------------------------------------------------------ |
| Framework              | NestJS                                                 |
| Language               | TypeScript                                             |
| Database               | Supabase (PostgreSQL + pgvector)                       |
| Vector Search          | pgvector cosine similarity via Supabase RPC            |
| Embeddings             | `BAAI/bge-small-en-v1.5` via HuggingFace Inference API |
| Cache / Session Memory | Redis                                                  |
| LLM Orchestration      | `@inngest/agent-kit`                                   |
| Email / OTP            | Resend                                                 |
| Deployment             | Vercel                                                 |

---

# Environment Variables

Create a `.env` file in the project root:

```env
# Server
PORT=3000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:5173

# Security
JWT_SECRET=your_jwt_secret
SECRET_KEY=your_admin_secret_key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
# If your implementation uses a service role for privileged writes, add:
# SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis
REDIS_URL=redis://default:password@host:port

# HuggingFace
HF_TOKEN=hf_your_token

# Email / OTP
RESEND_API_KEY=re_your_key

# Portfolio / metadata source
SITE_BASE=https://your-site.com/api/metaData

# LLM providers
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
```

> Keep the README aligned with the actual implementation in your codebase.
> For example, if your backend only uses the publishable/anon key and not the service role key, keep the README consistent with that.

---

# Supabase Setup

Run the following SQL in the Supabase SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

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

CREATE INDEX IF NOT EXISTS documents_embedding_idx
ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding VECTOR(384),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  similarity FLOAT,
  type VARCHAR(50),
  title VARCHAR(255)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    (1 - (d.embedding <=> query_embedding)) AS similarity,
    d.type,
    d.title
  FROM documents d
  WHERE (1 - (d.embedding <=> query_embedding)) > match_threshold
  ORDER BY (1 - (d.embedding <=> query_embedding)) DESC
  LIMIT match_count;
END;
$$;

CREATE TABLE IF NOT EXISTS verified_users (
  email TEXT PRIMARY KEY,
  verified_at TIMESTAMP WITH TIME ZONE,
  last_verified_at TIMESTAMP WITH TIME ZONE
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;

CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
```

## RLS Note

If Row-Level Security (RLS) is enabled on the `documents` table, make sure your backend still has permission to read/write embeddings by either:

* creating the required policies, or
* using a service role key where appropriate

---

# Installation

```bash
# Clone the repository
git clone https://github.com/sudipsharma826/ragChatBot-Personal.git
cd ragChatBot-Personal

# Install dependencies
npm install

# Start in development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

---

# API Reference

# Authentication

## 1. Send OTP

```http
POST /user/sendOtp
```

### Request Body

| Field   | Type     | Required | Description                      |
| ------- | -------- | -------: | -------------------------------- |
| `email` | `string` |      Yes | Email address to receive the OTP |

### Example Response

```json
{
  "status": "200",
  "message": "OTP has been sent to user@example.com. Please verify within 5 minutes."
}
```

---

## 2. Verify OTP

```http
POST /user/verifyOtp
```

### Request Body

| Field   | Type     | Required | Description                        |
| ------- | -------- | -------: | ---------------------------------- |
| `email` | `string` |      Yes | Email used when requesting the OTP |
| `otp`   | `string` |      Yes | 6-digit OTP code                   |

### Example Response

```json
{
  "status": "200",
  "message": "OTP verified successfully",
  "sessionId": "a1b2c3d4-e5f6-7890-1234-56789abcdef0"
}
```

## Authentication Behavior

After successful OTP verification:

* the backend issues a JWT
* the JWT is stored in an **HTTP-only cookie**
* the cookie is typically valid for **24 hours**
* the frontend should send future requests with `credentials: 'include'`

The returned `sessionId` should be stored on the frontend and reused for chat requests so the Redis chat history stays attached to the same conversation.

---

# Chat

## 3. Send Chat Message

```http
POST /retrieves/chat
```

**Requires authentication** via either:

* a valid HTTP-only `token` cookie, or
* `Authorization: Bearer <JWT>`

### Request Body

| Field       | Type     | Required | Description                                    |
| ----------- | -------- | -------: | ---------------------------------------------- |
| `message`   | `string` |      Yes | Current user message                           |
| `sessionId` | `string` |      Yes | Session identifier used for Redis chat history |

### Example Request

```json
{
  "message": "What projects have you built with NestJS?",
  "sessionId": "a1b2c3d4-e5f6-7890-1234-56789abcdef0"
}
```

### Example Response

```json
{
  "message": "What projects have you built with NestJS?",
  "response": {
    "aiMessage": "I have built projects using NestJS for backend APIs and structured service-based applications...",
    "combinedContent": "..."
  }
}
```

## What Happens Internally on `/retrieves/chat`

For each request, the backend:

1. takes the **current `message`**
2. embeds it for vector retrieval
3. fetches relevant chunks from Supabase
4. loads the **last 8 chat messages** from Redis using `sessionId`
5. combines:

   * the current user message
   * Redis history
   * retrieved knowledge-base content
   * the system/persona prompt
6. sends the final prompt to the LLM fallback chain
7. saves the latest **user message** and **AI response** back into Redis

If no `sessionId` is provided, the request becomes effectively stateless and previous conversation context cannot be loaded.

---

# Embeddings Management

## 4. Refresh Embeddings

```http
GET /embeddings/data?secret=<SECRET_KEY>
```

This endpoint:

* fetches the latest profile data
* re-chunks the content
* regenerates embeddings
* updates the vector store

### Example Response

```json
{
  "message": "Embeddings refreshed successfully",
  "totalChunks": 24,
  "provider": "huggingface:bge-small-en-v1.5"
}
```

---

# History Management

## 5. Delete Chat History

```http
DELETE /user/history
```

### Request Body

| Field       | Type     | Required | Description                                           |
| ----------- | -------- | -------: | ----------------------------------------------------- |
| `sessionId` | `string` |      Yes | Session id whose Redis chat history should be deleted |

### Example Response

```json
{
  "status": "200",
  "message": "Chat history deleted"
}
```

---

# Deployment

## Vercel

The project can be deployed to Vercel using a configuration similar to:

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

Add all required environment variables in the Vercel dashboard under **Project Settings → Environment Variables**.

---

# Important Notes

## 1. This is a Personal RAG system, not a generic chatbot

The knowledge base is built from the profile owner’s own data.
The model is expected to answer primarily from retrieved portfolio/profile content plus recent conversation history.

## 2. Final responses are not based on retrieval alone

The response is generated from:

* **the current user message**
* **the last 8 chat messages from Redis**
* **the retrieved vector-search context**
* **the system/persona prompt**

This is important because it explains why the assistant can stay conversational while still remaining grounded in retrieved profile data.

## 3. Redis is used for short-term conversation memory

Redis does **not** store the long-term knowledge base.
It stores session-based chat history so the assistant can preserve recent conversational context across turns.

## 4. Supabase stores the long-term retrieval knowledge base

The actual searchable knowledge base lives in Supabase inside the `documents` table as vectorized chunks.

---

# License

This project is open-sourced under the [MIT License](LICENSE).
