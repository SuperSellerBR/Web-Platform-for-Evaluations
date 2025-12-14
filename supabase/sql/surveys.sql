-- Tabelas para o editor de questionários

create table if not exists public.surveys (
  id uuid primary key,
  title text not null,
  description text default ''::text,
  status text default 'draft',
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version int default 1
);

create table if not exists public.survey_sections (
  id uuid primary key,
  survey_id uuid references public.surveys(id) on delete cascade,
  title text not null,
  "order" int default 0,
  weight numeric default 1,
  scoring_mode text default 'soma', -- soma | media
  meta jsonb default '{}'::jsonb
);

create table if not exists public.survey_questions (
  id uuid primary key,
  survey_id uuid references public.surveys(id) on delete cascade,
  section_id uuid references public.survey_sections(id) on delete cascade,
  type text not null, -- multiple_choice, checkbox, star_rating, matrix, slider, ranking, text, dropdown, nps, file_upload
  title text not null,
  description text default ''::text,
  required boolean default false,
  "order" int default 0,
  config jsonb default '{}'::jsonb,  -- opções, min/max/step, matrix rows/cols, upload config etc.
  scoring jsonb default '{}'::jsonb, -- pesos por opção, weight da questão etc.
  logic jsonb default '{}'::jsonb,    -- show_if simples
  created_at timestamptz default now()
);

create table if not exists public.survey_responses (
  id uuid primary key,
  survey_id uuid references public.surveys(id) on delete cascade,
  evaluation_id text,
  user_id uuid,
  created_at timestamptz default now(),
  sections_score jsonb, -- [{sectionId, score}]
  raw_answers jsonb      -- cópia das respostas para IA futura
);

create table if not exists public.survey_answers (
  id uuid primary key,
  response_id uuid references public.survey_responses(id) on delete cascade,
  question_id uuid references public.survey_questions(id) on delete cascade,
  value jsonb
);

-- Índices auxiliares
create index if not exists idx_survey_sections_survey on public.survey_sections(survey_id);
create index if not exists idx_survey_questions_survey on public.survey_questions(survey_id);
create index if not exists idx_survey_questions_section on public.survey_questions(section_id);
create index if not exists idx_survey_responses_survey on public.survey_responses(survey_id);
create index if not exists idx_survey_responses_eval on public.survey_responses(evaluation_id);
