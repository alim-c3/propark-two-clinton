-- A sign-in code is only issued as part of a terms acceptance. Link each code
-- challenge to that acceptance so a code can never exist without one.
alter table eval_otp_challenges add column if not exists terms_acceptance_id text;
