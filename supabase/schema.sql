-- =============================================================
--  SSC-Tutor RAG Chatbot – Supabase schema
--  Run this once in the Supabase SQL Editor (Project → SQL Editor → New query)
-- =============================================================

-- 1. Enable pgvector extension (used for embedding similarity search)
create extension if not exists vector;


-- 2. Profiles table (mirrors auth.users; synced via trigger on signup)
create table if not exists public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  email      text,
  full_name  text,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

alter table public.profiles enable row level security;

create policy "Profiles: own row only (select)"
  on public.profiles for select using (auth.uid() = id);

create policy "Profiles: own row only (update)"
  on public.profiles for update using (auth.uid() = id);

-- Trigger: auto-create a profile row whenever a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. Messages table (stores the full chat history per user)
create table if not exists public.messages (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  image_url  text,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

alter table public.messages enable row level security;

-- Users can only see their own messages
create policy "Messages: own rows only (select)"
  on public.messages for select using (auth.uid() = user_id);

-- Users can only insert their own messages
create policy "Messages: own rows only (insert)"
  on public.messages for insert with check (auth.uid() = user_id);

-- Users can delete their own messages
create policy "Messages: own rows only (delete)"
  on public.messages for delete using (auth.uid() = user_id);

-- Index for fast per-user chronological retrieval
create index if not exists messages_user_id_created_at_idx
  on public.messages (user_id, created_at asc);


-- 4. Documents table (RAG knowledge-base documents)
create table if not exists public.documents (
  id         uuid default gen_random_uuid() primary key,
  title      text not null,
  subject    text not null check (subject in ('science', 'math')),
  chapter    text,
  created_at timestamp with time zone default timezone('utc', now()) not null
);

alter table public.documents enable row level security;

create policy "Documents: readable by all authenticated users"
  on public.documents for select using (true);


-- 5. Document chunks table (text + embedding for RAG retrieval)
create table if not exists public.document_chunks (
  id          uuid default gen_random_uuid() primary key,
  document_id uuid references public.documents(id) on delete cascade not null,
  content     text not null,
  embedding   vector(768),
  created_at  timestamp with time zone default timezone('utc', now()) not null
);

alter table public.document_chunks enable row level security;

create policy "Chunks: readable by all authenticated users"
  on public.document_chunks for select using (true);

-- HNSW index for fast cosine-similarity search (pgvector >= 0.5)
create index if not exists document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);


-- 6. RAG similarity-search RPC (called by lib/rag/retrieve.ts)
create or replace function match_chunks (
  query_embedding vector(768),
  match_count     int
)
returns table (
  id         uuid,
  content    text,
  similarity double precision
)
language plpgsql stable as $$
begin
  return query
  select
    dc.id,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  order by dc.embedding <=> query_embedding
  limit match_count;
end;
$$;
