-- Separate from any older eval_requests table already in this database.

create table if not exists demo_eval_requests (
  id text primary key,
  email text not null,
  status text not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  ip_address text,
  user_agent text
);

create index if not exists demo_eval_requests_email_idx on demo_eval_requests (email, requested_at desc);
create index if not exists demo_eval_requests_status_idx on demo_eval_requests (status);

insert into demo_eval_requests (id, email, status)
select
  'backfill-' || id,
  email,
  case
    when access_status in ('active', 'invited') then 'approved'
    when access_status = 'revoked' then 'rejected'
    else 'pending'
  end
from evaluators
where email is not null
on conflict (id) do nothing;
