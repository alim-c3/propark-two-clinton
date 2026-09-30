-- Evaluation access: evaluators, OTP challenges, sessions, immutable
-- agreement snapshots, and append-only legal acceptances.
-- Historical acceptance rows are never updated or deleted by application code.

create table if not exists evaluators (
  id text primary key,
  user_id text,
  email text not null unique,
  name text,
  organization text,
  email_verified boolean not null default false,
  email_verified_at timestamptz,
  access_status text not null default 'pending',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists evaluators_user_id_idx on evaluators (user_id);
create index if not exists evaluators_access_status_idx on evaluators (access_status);

create table if not exists evaluation_agreements (
  version text primary key,
  name text not null,
  effective_date text not null,
  sha256 text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists legal_acceptances (
  id text primary key,
  user_id text,
  evaluator_id text,
  email text not null,
  name text,
  organization text,
  agreement_type text not null,
  agreement_version text not null,
  agreement_effective_date text not null,
  agreement_hash text not null,
  acceptance_text text not null,
  accepted_at timestamptz not null,
  ip_address text,
  user_agent text,
  acceptance_method text not null,
  environment text,
  account_status text,
  created_at timestamptz not null default now()
);

create index if not exists legal_acceptances_email_idx on legal_acceptances (email);
create index if not exists legal_acceptances_version_idx on legal_acceptances (agreement_version);
create index if not exists legal_acceptances_evaluator_idx on legal_acceptances (evaluator_id);

create table if not exists eval_otp_challenges (
  id text primary key,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  ip_address text
);

create index if not exists eval_otp_email_idx on eval_otp_challenges (email, created_at);

create table if not exists eval_sessions (
  id text primary key,
  evaluator_id text not null references evaluators (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  ip_address text,
  user_agent text
);

create index if not exists eval_sessions_evaluator_idx on eval_sessions (evaluator_id);

create table if not exists eval_invites (
  id text primary key,
  email text not null,
  invited_by text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists eval_invites_email_idx on eval_invites (email);
