-- One row per successful evaluation sign-in. Rows are append-only.

create table if not exists eval_logins (
  id text primary key,
  evaluator_id text,
  email text not null,
  logged_in_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  method text not null
);

create index if not exists eval_logins_logged_in_at_idx on eval_logins (logged_in_at desc);
create index if not exists eval_logins_email_idx on eval_logins (email);

insert into eval_logins (id, evaluator_id, email, logged_in_at, ip_address, user_agent, method)
select s.id, s.evaluator_id, e.email, s.created_at, s.ip_address, s.user_agent, 'email'
from eval_sessions s
join evaluators e on e.id = s.evaluator_id
on conflict (id) do nothing;
