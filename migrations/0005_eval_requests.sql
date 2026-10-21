-- One row each time someone asks to evaluate. Approve, reject, and end
-- update the row. A new submission after reject or end creates a new row.

create table if not exists eval_requests (
  id text primary key,
  email text not null,
  status text not null,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text,
  ip_address text,
  user_agent text
);

create index if not exists eval_requests_email_idx on eval_requests (email, requested_at desc);
create index if not exists eval_requests_status_idx on eval_requests (status);

insert into eval_requests (id, email, status)
select
  'backfill-' || id,
  email,
  case
    when access_status in ('active', 'invited') then 'approved'
    when access_status = 'revoked' then 'rejected'
    else 'pending'
  end
from evaluators
on conflict (id) do nothing;
