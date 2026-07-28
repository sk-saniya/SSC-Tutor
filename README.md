# SSC-Tutor — Class 10 Science & Math RAG Chatbot

A full-stack Next.js app where students sign up, ask Class 10 NCERT Science
and Math questions by typing, uploading an image or text file, or speaking,
and get answers grounded in real syllabus content via RAG
(retrieval-augmented generation) — plus a generated diagram when one would
help.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase: email/password auth, Postgres + pgvector, chat history storage
- Google Gemini (free tier): answers questions, reads uploaded images and
  text attachments, and generates the embeddings used for retrieval
- Google Gen AI (Imagen 3): generates high-quality labeled diagrams when the answer calls for one
  for one
- Browser Web Speech API: free voice-to-text for the microphone button

## 1. Set up Supabase

1. Go to supabase.com, sign in, and create a new project.
2. Once it's ready, go to **Project Settings → API** and copy the **Project
   URL**, the **anon public** key, and the **service_role** key.
3. Go to **SQL Editor → New query**, paste the entire contents of
   `supabase/schema.sql`, and run it. This turns on pgvector and creates the
   `documents`, `document_chunks`, `messages`, and `profiles` tables along with their
   security policies.
4. (Optional) Under **Authentication → Providers → Email**, you can turn off
   "Confirm email" while testing, so signup logs you in immediately instead
   of waiting on a confirmation email.

## 2. Get a free Gemini API key

Go to https://aistudio.google.com/app/apikey, sign in with a Google account,
and create a key. The free tier covers everything this app does (answering
questions, reading uploaded files/images, and embeddings).

## 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill in the five values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
ADMIN_INGEST_SECRET=        # make up any random string
```

## 4. Install and run

```
npm install
npm run dev
```

Visit http://localhost:3000. Sign up, log in, and you'll land on `/chat`.

## 5. Add study material to the knowledge base (this is the "RAG" part)

Without this step, the chatbot still answers from Gemini's general
knowledge — but it won't have your specific NCERT chapters to ground its
answers in. Add a chapter like this:

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "x-admin-secret: YOUR_ADMIN_INGEST_SECRET" \
  -F "file=@/path/to/chapter.pdf" \
  -F "title=Life Processes" \
  -F "subject=science" \
  -F "chapter=Chapter 6"
```

`file` accepts a `.pdf` or `.txt`. Run this once per chapter you want
searchable — NCERT chapter PDFs work well as a source. The route chunks the
text, embeds each chunk with Gemini, and stores it in `document_chunks`.
After that, every student question first searches this table for relevant
passages before Gemini answers.

## How a question gets answered

1. Student sends text, and/or an uploaded image/txt, and/or a voice
   transcript, from `/chat`.
2. The question gets embedded and matched against `document_chunks` in
   Supabase (`lib/rag/retrieve.ts`) — that's the retrieval step.
3. The matched passages, the question, recent chat history, and any
   uploaded image go to Gemini (`lib/gemini.ts`).
4. If Gemini's answer indicates a diagram would help, the app calls
   Pollinations.ai to generate one and attaches it to the response.
5. Both the question and answer are saved to the `messages` table so chat
   history persists across logins.

## Project structure

```
app/
  page.tsx              home page
  login/page.tsx        sign-in
  signup/page.tsx        sign-up
  chat/page.tsx          server wrapper (auth check) + ChatClient.tsx (UI)
  api/chat/route.ts      RAG retrieval + Gemini answer + image generation
  api/ingest/route.ts    admin: add a chapter to the knowledge base
  api/messages/route.ts  fetch a student's chat history
middleware.ts            protects /chat, refreshes the Supabase session
lib/
  supabase/              browser, server, and service-role Supabase clients
  gemini.ts               Gemini text + embedding calls
  image-gen.ts             Pollinations diagram URL builder
  rag/                    chunking, ingestion, retrieval
supabase/schema.sql       run this once in the Supabase SQL editor
```

## Notes and next steps

This is a working v1, not a finished product — a few things worth doing
before treating it as production-ready: rate-limit `/api/chat` so one
account can't burn through your free Gemini quota, add a real admin login
for `/api/ingest` instead of a single shared secret, and consider chunking
PDFs by section heading rather than a fixed word count for cleaner
citations. The chat history currently has no "delete my data" button in the
UI even though the database supports it — that'd be a good next addition.
